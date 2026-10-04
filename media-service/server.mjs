#!/usr/bin/env node
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash, timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicEgressProxy} from './egress.mjs';

const HOSTS = /^(?:[a-z0-9-]+\.)*(?:tiktok\.com|instagram\.com|youtube\.com|youtu\.be|naver\.com|x\.com|twitter\.com)$/;
const MEDIA_FILE = /^(?:thumb\.(?:jpg|jpeg|webp|png)|image\.(?:jpg|jpeg|webp|png)|video\.mp4)$/;
const TYPES = {jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', png:'image/png', mp4:'video/mp4'};
const MAX_VIDEO = 45 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;
const DEFAULT_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PENDING = 4;

async function limitedBytes(stream, limit) {
  const reader = stream.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length; if (size > limit) throw new Error('too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

function reply(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {'Content-Type':'application/json', 'Content-Length':body.length, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
  res.end(body);
}

function canonical(input) {
  if (typeof input !== 'string' || input.length > 600) throw new Error('invalid');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS.test(url.hostname.toLowerCase())) throw new Error('invalid');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}

function provider(host) {
  if (host.endsWith('tiktok.com')) return 'TikTok';
  if (host.endsWith('instagram.com')) return 'Instagram';
  if (host.endsWith('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) return 'YouTube';
  if (host.endsWith('naver.com')) return 'Naver';
  return 'X';
}

export async function runYtDlp(args, {cwd, cookiesFile, timeoutMs = 120000, binary = 'yt-dlp'} = {}) {
  const proxy = await createPublicEgressProxy();
  try { return await new Promise((resolve, reject) => {
    const fullArgs = ['--ignore-config', '--no-playlist', '--no-warnings', '--force-ipv4', '--downloader', 'native', '--proxy', proxy.url, '--socket-timeout', '15', '--retries', '1', '--fragment-retries', '1', ...(cookiesFile ? ['--cookies', cookiesFile] : []), ...args];
    const env = {...process.env, HTTP_PROXY:proxy.url, HTTPS_PROXY:proxy.url, ALL_PROXY:proxy.url, http_proxy:proxy.url, https_proxy:proxy.url, all_proxy:proxy.url, NO_PROXY:'', no_proxy:''};
    const child = spawn(binary, fullArgs, {cwd, env, stdio:['ignore','pipe','pipe'], detached:process.platform !== 'win32'});
    const killTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio:'ignore'}).on('error', () => child.kill('SIGKILL'));
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    };
    const chunks = []; let size = 0; let stderr = '';
    const timer = setTimeout(killTree, timeoutMs);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > MAX_JSON) killTree(); else chunks.push(chunk); });
    child.stderr.on('data', chunk => { if (stderr.length < 2048) stderr += chunk.toString().slice(0, 2048 - stderr.length); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (code === 0 && size <= MAX_JSON) resolve(Buffer.concat(chunks).toString()); else reject(new Error(`yt-dlp failed (${code}): ${stderr.slice(0, 200)}`)); });
  }); } finally { await proxy.close(); }
}

async function defaultExtract(url, dir, cookiesFile, fetchImpl = fetch) {
  const options = {cwd:dir, cookiesFile};
  let info;
  try { info = JSON.parse(await runYtDlp(['-J', url], {...options, timeoutMs:45000})); }
  catch (error) {
    if (provider(new URL(url).hostname) !== 'TikTok') throw error;
    const response = await fetchImpl(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {redirect:'manual', signal:AbortSignal.timeout(15000)});
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 65536) throw error;
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 65536) throw error;
    const embed = JSON.parse(raw);
    info = {title:embed.title, description:embed.title, uploader:embed.author_name, width:Number(embed.thumbnail_width) || 0, height:Number(embed.thumbnail_height) || 0};
    // Only a known TikTok thumbnail CDN may be downloaded; never follow a redirect supplied by oEmbed.
    try {
      const imageURL = new URL(embed.thumbnail_url);
      if (imageURL.protocol === 'https:' && /^(?:[a-z0-9-]+\.)*(?:muscdn\.com|tiktokcdn\.com)$/.test(imageURL.hostname)) {
        const imageResponse = await fetchImpl(imageURL, {redirect:'manual', signal:AbortSignal.timeout(15000)});
        if (imageResponse.ok && imageResponse.headers.get('content-type')?.startsWith('image/jpeg') && Number(imageResponse.headers.get('content-length') || 0) <= MAX_IMAGE) {
          const bytes = await limitedBytes(imageResponse.body, MAX_IMAGE);
          if (bytes.length > 0 && bytes.length <= MAX_IMAGE) await writeFile(path.join(dir, 'thumb.jpg'), bytes);
        }
      }
    } catch { /* A metadata-only preview is still useful. */ }
    return info;
  }
  // A thumbnail and metadata remain useful when the platform offers no playable MP4.
  await runYtDlp(['--skip-download', '--write-thumbnail', '--convert-thumbnails', 'jpg', '-o', 'thumb.%(ext)s', url], {...options, timeoutMs:20000}).catch(() => {});
  // A single HTTPS MP4 avoids delegating network downloads to ffmpeg outside the guarded proxy.
  await runYtDlp(['-f', 'b[ext=mp4][height<=720][protocol=https]', '--max-filesize', '45M', '-o', 'video.%(ext)s', url], {...options, timeoutMs:75000}).catch(() => {});
  return info;
}

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error('too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function fileWithin(dir, name, cap) {
  const file = path.join(dir, name);
  const info = await stat(file).catch(() => null);
  return info?.isFile() && info.size > 0 && info.size <= cap ? file : null;
}

async function ensurePrivateRoot(root) {
  await mkdir(root, {recursive:true, mode:0o700});
  const info = await stat(root);
  if (!info.isDirectory() || (info.mode & 0o077)) throw new Error('MEDIA_ROOT must be private (0700)');
}

async function cacheBytes(root, exclude = '') {
  let total = 0;
  for (const dir of await readdir(root, {withFileTypes:true})) {
    if (!dir.isDirectory() || dir.name === exclude || !(/^[a-f0-9]{20}$/.test(dir.name) || /^\.tmp-[a-f0-9]{20}-/.test(dir.name))) continue;
    for (const file of await readdir(path.join(root, dir.name), {withFileTypes:true})) {
      if (file.isFile()) total += (await stat(path.join(root, dir.name, file.name))).size;
    }
  }
  return total;
}

async function stageBytes(stage) {
  let total = 0;
  for (const file of await readdir(stage, {withFileTypes:true})) if (file.isFile()) total += (await stat(path.join(stage, file.name))).size;
  return total;
}

async function buildMeta(url, id, dir, info) {
  const files = await readdir(dir);
  for (const name of files) {
    if (name !== 'video.mp4' && !/^(?:thumb|image)\.(?:jpg|jpeg|webp|png)$/.test(name)) { await rm(path.join(dir, name), {recursive:true, force:true}); continue; }
    const cap = name === 'video.mp4' ? MAX_VIDEO : /^\w+\.(?:jpg|jpeg|webp|png)$/.test(name) ? MAX_IMAGE : null;
    if (cap && !await fileWithin(dir, name, cap)) await rm(path.join(dir, name), {force:true});
  }
  const thumbName = files.find(name => /^thumb\.(?:jpg|jpeg|webp|png)$/.test(name) && name.toLowerCase() === name);
  const thumb = thumbName && await fileWithin(dir, thumbName, MAX_IMAGE) ? `media/${id}/${thumbName}` : '';
  const video = await fileWithin(dir, 'video.mp4', MAX_VIDEO) ? `media/${id}/video.mp4` : '';
  const imageName = files.find(name => /^image\.(?:jpg|jpeg|webp|png)$/i.test(name) && name.toLowerCase() === name);
  const image = imageName && await fileWithin(dir, imageName, MAX_IMAGE) ? `media/${id}/${imageName}` : '';
  return {id, provider:provider(new URL(url).hostname), author:String(info.uploader || info.channel || '').slice(0, 160), caption:String(info.description || '').slice(0, 2000), title:String(info.title || '').slice(0, 300), durationS:Number.isFinite(Number(info.duration)) ? Math.max(0, Math.min(86400, Math.round(Number(info.duration)))) : 0, kind:video ? 'video' : 'image', width:Number(info.width) || 0, height:Number(info.height) || 0, thumb, video, image, url};
}

function parseRange(value, total) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) return false; start = Math.max(0, total - suffix); end = total - 1; }
  else { start = Number(match[1]); end = match[2] ? Number(match[2]) : total - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= total || start > end) return false;
  return {start, end:Math.min(end, total - 1)};
}

export function createMediaServer({secret, root, cookiesFile, extract = defaultExtract, maxCacheBytes = DEFAULT_CACHE_BYTES, streamFile = createReadStream} = {}) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('FETCH_SECRET must be at least 32 bytes');
  if (!root || !path.isAbsolute(root)) throw new Error('MEDIA_ROOT must be an absolute path');
  if (!Number.isSafeInteger(maxCacheBytes) || maxCacheBytes < 1) throw new Error('MAX_CACHE_BYTES must be a positive safe integer');
  const active = new Map();
  let queue = Promise.resolve();
  return http.createServer(async (req, res) => {
    try {
      const supplied = req.headers['x-fetch-secret'];
      const expected = Buffer.from(secret); const actual = Buffer.from(typeof supplied === 'string' ? supplied : '');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(res, 401, {code:'unauthorized'});
      await ensurePrivateRoot(root);
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && pathname === '/health') return reply(res, 200, {ok:true});
      if (req.method === 'POST' && pathname === '/unfurl') {
        let url; try { url = canonical((await readBody(req)).url); } catch { return reply(res, 400, {code:'invalid'}); }
        const id = createHash('sha256').update(url).digest('hex').slice(0, 20);
        const finalDir = path.join(root, id);
        const existing = await readFile(path.join(finalDir, 'meta.json'), 'utf8').then(JSON.parse).catch(() => null);
        if (existing) return reply(res, 200, existing);
        if (!active.has(id) && active.size >= MAX_PENDING) return reply(res, 503, {code:'busy'});
        if (!active.has(id)) {
          const job = queue.then(async () => {
          const stage = path.join(root, `.tmp-${id}-${process.pid}-${Date.now()}`);
          if (await cacheBytes(root) >= maxCacheBytes) throw new Error('cache full');
          await mkdir(stage, {mode:0o700});
          try {
            const info = await extract(url, stage, cookiesFile);
            const meta = await buildMeta(url, id, stage, info);
            await writeFile(path.join(stage, 'meta.json'), JSON.stringify(meta));
            if (await cacheBytes(root, path.basename(stage)) + await stageBytes(stage) > maxCacheBytes) throw new Error('cache full');
            await rename(stage, finalDir).catch(async error => { if (error.code !== 'EEXIST' && error.code !== 'ENOTEMPTY') throw error; });
            return JSON.parse(await readFile(path.join(finalDir, 'meta.json'), 'utf8'));
          } finally { await rm(stage, {recursive:true, force:true}); }
          });
          queue = job.catch(() => {});
          active.set(id, job.finally(() => active.delete(id)));
        }
        try { return reply(res, 200, await active.get(id)); }
        catch (error) { return reply(res, error.message === 'cache full' ? 503 : 502, {code:error.message === 'cache full' ? 'full' : 'broken'}); }
      }
      const match = req.method === 'GET' && /^\/media\/([a-f0-9]{20})\/([^/]+)$/.exec(pathname);
      if (match && MEDIA_FILE.test(match[2])) {
        const file = path.join(root, match[1], match[2]);
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) return reply(res, 404, {code:'not_found'});
        const cap = match[2] === 'video.mp4' ? MAX_VIDEO : MAX_IMAGE;
        if (info.size < 1 || info.size > cap) return reply(res, 404, {code:'not_found'});
        const range = parseRange(req.headers.range, info.size);
        if (range === false) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`, 'Cache-Control':'private, no-store', Vary:'X-Fetch-Secret'}); return res.end(); }
        const ext = match[2].split('.').pop();
        const headers = {'Content-Type':TYPES[ext], 'Content-Length':range ? range.end - range.start + 1 : info.size, 'Accept-Ranges':'bytes', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'private, no-store', Vary:'X-Fetch-Secret'};
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
        res.writeHead(range ? 206 : 200, headers);
        const stream = streamFile(file, range || undefined);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
        return;
      }
      return reply(res, 404, {code:'not_found'});
    } catch { if (!res.headersSent) reply(res, 500, {code:'internal'}); else res.destroy(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const secret = process.env.FETCH_SECRET;
  const root = process.env.MEDIA_ROOT;
  const cookiesFile = process.env.COOKIES_FILE || undefined;
  const maxCacheBytes = process.env.MAX_CACHE_BYTES ? Number(process.env.MAX_CACHE_BYTES) : DEFAULT_CACHE_BYTES;
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8791);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  createMediaServer({secret, root, cookiesFile, maxCacheBytes}).listen(port, host, () => console.log(`media service listening on ${host}:${port}`));
}
