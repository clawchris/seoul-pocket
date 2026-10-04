import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, chmod, access, mkdir, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import net from 'node:net';
import {Readable} from 'node:stream';
import {createMediaServer, runYtDlp} from '../media-service/server.mjs';
import {createPublicEgressProxy, isPublicIPv4} from '../media-service/egress.mjs';

const secret = 'x'.repeat(32);

test('portable fetcher contract: auth, validation, cache, metadata, and byte ranges', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-test-'));
  let calls = 0;
  const server = createMediaServer({secret, root, extract:async (url, dir) => {
    calls++;
    assert.equal(url, 'https://www.instagram.com/reel/example/');
    await writeFile(path.join(dir, 'thumb.jpg'), Buffer.from([1, 2, 3]));
    await writeFile(path.join(dir, 'video.mp4'), Buffer.from('abcdefghij'));
    return {uploader:'Example', title:'A reel', description:'Caption', duration:12, width:720, height:1280};
  }});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {'X-Fetch-Secret':secret};
  try {
    assert.equal((await fetch(`${base}/health`)).status, 401);
    assert.equal((await fetch(`${base}/health`, {headers})).status, 200);
    const post = body => fetch(`${base}/unfurl`, {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    assert.equal((await post({url:'http://www.instagram.com/reel/example/'})).status, 400);
    assert.equal((await post({url:'https://evil.example/reel/example/'})).status, 400);
    const [first, second] = await Promise.all([post({url:'https://www.instagram.com/reel/example/?utm_source=test'}), post({url:'https://www.instagram.com/reel/example/'})]);
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    const meta = await first.json();
    assert.deepEqual(await second.json(), meta);
    assert.match(meta.id, /^[a-f0-9]{20}$/);
    assert.equal(meta.thumb, `media/${meta.id}/thumb.jpg`);
    assert.equal(meta.video, `media/${meta.id}/video.mp4`);
    assert.equal(meta.kind, 'video');
    assert.equal(calls, 1);
    assert.equal((await post({url:'https://www.instagram.com/reel/example/'})).status, 200);
    assert.equal(calls, 1);
    const media = `${base}/media/${meta.id}/video.mp4`;
    const partial = await fetch(media, {headers:{...headers, Range:'bytes=2-5'}});
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(partial.headers.get('cache-control'), 'private, no-store');
    assert.equal(await partial.text(), 'cdef');
    assert.equal(await (await fetch(media, {headers:{...headers, Range:'bytes=-3'}})).text(), 'hij');
    assert.equal((await fetch(media, {headers:{...headers, Range:'bytes=20-30'}})).status, 416);
    assert.equal((await fetch(`${base}/media/${meta.id}/../../meta.json`, {headers})).status, 404);
    assert.equal((await fetch(media)).status, 401);
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('egress proxy rejects private and metadata destinations before connecting', async () => {
  assert.equal(isPublicIPv4('127.0.0.1'), false);
  assert.equal(isPublicIPv4('169.254.169.254'), false);
  assert.equal(isPublicIPv4('10.0.0.1'), false);
  assert.equal(isPublicIPv4('100.100.100.200'), false);
  assert.equal(isPublicIPv4('8.8.8.8'), true);
  const proxy = await createPublicEgressProxy({lookup:async () => [{address:'127.0.0.1', family:4}]});
  try {
    const target = new URL(proxy.url);
    const socket = net.connect(Number(target.port), target.hostname);
    await once(socket, 'connect');
    socket.write('CONNECT redirect.example:443 HTTP/1.1\r\nHost: redirect.example:443\r\n\r\n');
    const [data] = await once(socket, 'data');
    assert.match(data.toString(), /^HTTP\/1\.1 403 Forbidden/);
    socket.destroy();
  } finally { await proxy.close(); }
});

test('extractor errors do not expose logs and leave no cached success', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-failure-'));
  const server = createMediaServer({secret, root, extract:async () => { throw new Error('private cookie path and details'); }});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/unfurl`, {method:'POST', headers:{'X-Fetch-Secret':secret, 'Content-Type':'application/json'}, body:JSON.stringify({url:'https://x.com/example/status/123'})});
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {code:'broken'});
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('a preview-only WebP thumbnail keeps its extension and MIME type', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-webp-'));
  const server = createMediaServer({secret, root, extract:async (url, dir) => {
    await writeFile(path.join(dir, 'thumb.webp'), Buffer.from('RIFFfakeWEBP'));
    return {title:'Preview only'};
  }});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = {'X-Fetch-Secret':secret};
    const response = await fetch(`${base}/unfurl`, {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({url:'https://x.com/example/status/456'})});
    const meta = await response.json();
    assert.equal(meta.thumb, `media/${meta.id}/thumb.webp`);
    assert.equal(meta.video, '');
    const image = await fetch(`${base}/${meta.thumb}`, {headers});
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.equal(await image.text(), 'RIFFfakeWEBP');
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('extractor timeout terminates its child process too', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-tree-'));
  const binary = path.join(root, 'fake-yt-dlp');
  const marker = path.join(root, 'orphan.txt');
  await writeFile(binary, `#!${process.execPath}\nconst {spawn}=require('node:child_process');\nspawn(process.execPath,['-e',${JSON.stringify(`setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'orphan'),1500)\n`)}],{stdio:'inherit'});\nsetInterval(()=>{},1000);\n`);
  await chmod(binary, 0o700);
  try {
    await assert.rejects(runYtDlp(['-J', 'https://example.com'], {binary, cwd:root, timeoutMs:300}));
    await new Promise(resolve => setTimeout(resolve, 1700));
    await assert.rejects(access(marker));
  } finally { await rm(root, {recursive:true, force:true}); }
});

test('cache quota refuses new media without removing cached entries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-quota-'));
  const server = createMediaServer({secret, root, maxCacheBytes:400, extract:async () => ({title:'small preview'})});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = id => fetch(`${base}/unfurl`, {method:'POST', headers:{'X-Fetch-Secret':secret, 'Content-Type':'application/json'}, body:JSON.stringify({url:`https://x.com/example/status/${id}`})});
  try {
    const first = await post(1);
    assert.equal(first.status, 200);
    const cached = await first.json();
    assert.equal((await post(2)).status, 503);
    assert.equal((await post(1)).status, 200);
    assert.match(cached.id, /^[a-f0-9]{20}$/);
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('extraction backlog is bounded while identical URLs coalesce', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-queue-'));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const server = createMediaServer({secret, root, extract:async () => { await gate; return {title:'queued'}; }});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = id => fetch(`${base}/unfurl`, {method:'POST', headers:{'X-Fetch-Secret':secret, 'Content-Type':'application/json'}, body:JSON.stringify({url:`https://x.com/example/status/${id}`})});
  try {
    const pending = [post(1), post(2), post(3), post(4)];
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal((await post(5)).status, 503);
    release();
    assert.deepEqual((await Promise.all(pending)).map(response => response.status), [200, 200, 200, 200]);
  } finally { release(); server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('accepted youtu.be subdomains identify as YouTube', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-provider-'));
  const server = createMediaServer({secret, root, extract:async () => ({title:'video'})});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/unfurl`, {method:'POST', headers:{'X-Fetch-Secret':secret, 'Content-Type':'application/json'}, body:JSON.stringify({url:'https://www.youtu.be/example'})});
    assert.equal((await response.json()).provider, 'YouTube');
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});

test('new cache directories are private and abandoned staging counts toward quota', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'media-service-private-'));
  const root = path.join(parent, 'cache');
  const server = createMediaServer({secret, root, maxCacheBytes:400, extract:async () => ({title:'preview'})});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(`${base}/unfurl`, {method:'POST', headers:{'X-Fetch-Secret':secret, 'Content-Type':'application/json'}, body:JSON.stringify({url:'https://x.com/example/status/999'})});
  try {
    assert.equal((await fetch(`${base}/health`, {headers:{'X-Fetch-Secret':secret}})).status, 200);
    assert.equal((await stat(root)).mode & 0o077, 0);
    const abandoned = path.join(root, `.tmp-${'a'.repeat(20)}-prior`);
    await mkdir(abandoned, {mode:0o700});
    await writeFile(path.join(abandoned, 'video.mp4.part'), Buffer.alloc(400));
    assert.equal((await post()).status, 503);
    assert.equal((await stat(abandoned)).isDirectory(), true);
  } finally { server.closeAllConnections(); server.close(); await rm(parent, {recursive:true, force:true}); }
});

test('a cached-file read error closes only that response, not the service', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'media-service-stream-'));
  const server = createMediaServer({secret, root,
    extract:async (_url, dir) => { await writeFile(path.join(dir, 'video.mp4'), Buffer.from('video')); return {title:'Post'}; },
    streamFile:() => new Readable({read() { this.destroy(new Error('read failed')); }})
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {'X-Fetch-Secret':secret};
  try {
    const response = await fetch(`${base}/unfurl`, {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({url:'https://x.com/example/status/stream'})});
    const meta = await response.json();
    await assert.rejects(async () => { const media = await fetch(`${base}/${meta.video}`, {headers}); await media.arrayBuffer(); });
    assert.equal((await fetch(`${base}/health`, {headers})).status, 200);
  } finally { server.closeAllConnections(); server.close(); await rm(root, {recursive:true, force:true}); }
});
