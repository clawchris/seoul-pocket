import {cp, mkdir, readdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),pub=path.join(root,'public'),out=path.join(root,'dist');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await cp(pub,out,{recursive:true});
const paths=(await files(out)).filter(p=>!path.basename(p).startsWith('_')).sort();
const hash=createHash('sha256');for(const p of paths){hash.update(path.relative(out,p));hash.update(await readFile(p));}
const version=hash.digest('hex').slice(0,16),assets=paths.map(p=>'/'+path.relative(out,p).split(path.sep).join('/'));
const script=`/* Generated from actual file contents. Only first-party assets, including the encrypted address seed. No live API responses. */
const VERSION=${JSON.stringify(version)};
const CACHE='seoul-pocket-shell-'+VERSION;
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await cache.addAll(ASSETS.map(p=>new Request(p,{cache:'reload'})));}
 catch(err){await caches.delete(CACHE);throw err;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=(await caches.keys()).filter(k=>k.startsWith('seoul-pocket-shell-'));
 // Keep the current and immediately preceding app cache, without touching other apps.
 const old=names.filter(k=>k!==CACHE);for(const name of old.slice(0,-1))await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
 if(event.data?.type==='CHECK_CACHE')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),hits=await Promise.all(ASSETS.map(p=>cache.match(p)));
  event.ports[0]?.postMessage({ready:hits.every(Boolean),cached:hits.filter(Boolean).length,total:ASSETS.length,version:VERSION,reason:hits.every(Boolean)?'':'Some app files are missing.'});
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match('/index.html')||fetch(event.request);})());return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(url.pathname)||fetch(event.request);})());
});
`;
await writeFile(path.join(out,'sw.js'),script);
const bytes=await Promise.all(paths.map(async p=>(await readFile(p)).byteLength));
const manifest={version,generatedAt:new Date().toISOString(),assets:assets.length,totalBytes:bytes.reduce((a,b)=>a+b,0)};
await writeFile(path.join(out,'build-info.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
