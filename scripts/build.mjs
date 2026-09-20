import {cp, mkdir, readdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),pub=path.join(root,'public'),out=path.join(root,'dist');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await cp(pub,out,{recursive:true});
const paths=(await files(out)).filter(p=>!path.basename(p).startsWith('_')).sort();
const hash=createHash('sha256');hash.update(await readFile(new URL(import.meta.url)));for(const p of paths){hash.update(path.relative(out,p));hash.update(await readFile(p));}
// The build script (which embeds the worker template) is part of the hash so a worker-only change still produces a new cache version.
const version=hash.digest('hex').slice(0,16),assets=paths.map(p=>'/'+path.relative(out,p).split(path.sep).join('/')).map(p=>p==='/index.html'?'/':p);
// Recorded audio is 60% of the install and the app works without it: audio.js falls back to speechSynthesis and the phrase card
// still renders the written Korean. One dropped file on Korean mobile data must not cost the traveler the whole offline app.
const spare=p=>p.endsWith('.m4a')||p.startsWith('/img/guide/');
const optional=assets.filter(spare),core=assets.filter(p=>!spare(p));
// Cloudflare Pages answers /index.html with a 308 to /. A cached redirected response cannot satisfy a navigation
// request (Chrome fails it with ERR_FAILED), so the shell is cached under '/' and stored without its redirect flag.
const script=`/* Generated from actual file contents. Only first-party assets, including the encrypted address seed. No live API responses. */
const VERSION=${JSON.stringify(version)};
const CACHE='seoul-pocket-shell-'+VERSION;
const CORE=${JSON.stringify(core)};
const OPTIONAL=${JSON.stringify(optional)};
const ASSETS=CORE.concat(OPTIONAL);
// 'no-cache' revalidates with the origin the way 'reload' does, but it still sends the conditional request, so an unchanged
// asset comes back 304 with no body. _headers sets Cache-Control: no-cache on /* and Pages emits ETags, so the path exists.
const store=async(cache,p)=>{const r=await fetch(new Request(p,{cache:'no-cache'}));if(!r.ok)throw new Error('Failed to cache '+p);await cache.put(p,r.redirected?new Response(await r.blob(),{status:200,headers:r.headers}):r);};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await Promise.all(CORE.map(p=>store(cache,p)));}
 catch(err){await caches.delete(CACHE);throw err;}
 // A missing audio file leaves the app fully usable, so it never costs the traveler the install.
 await Promise.all(OPTIONAL.map(p=>store(cache,p).catch(()=>{})));
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
  // Readiness is the core tier, so a phone that skipped an audio file is reported as the working install it is.
  const cache=await caches.open(CACHE),hits=await Promise.all(CORE.map(p=>cache.match(p))),extra=await Promise.all(OPTIONAL.map(p=>cache.match(p)));
  const ready=hits.every(Boolean);
  event.ports[0]?.postMessage({ready,cached:hits.filter(Boolean).length,total:CORE.length,audioCached:extra.filter(Boolean).length,audioTotal:OPTIONAL.length,version:VERSION,reason:ready?'':'Some app files are missing.'});
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match('/')||fetch(event.request);})());return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(url.pathname)||fetch(event.request);})());
});
`;
await writeFile(path.join(out,'sw.js'),script);
const bytes=await Promise.all(paths.map(async p=>(await readFile(p)).byteLength));
const manifest={version,generatedAt:new Date().toISOString(),assets:assets.length,totalBytes:bytes.reduce((a,b)=>a+b,0)};
await writeFile(path.join(out,'build-info.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
