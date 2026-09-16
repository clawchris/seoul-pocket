import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:new URL('..',import.meta.url)});
const code=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
function harness(){
 const handlers={},stores=new Map(),calls=[],requested=[];let skipped=0,claimed=0,fail=false,failing=new Set();
 class Request{constructor(url,options={}){this.url=url;Object.assign(this,options);}}
 const caches={open:async key=>{if(!stores.has(key))stores.set(key,new Map());const data=stores.get(key);return {put:async(k,v)=>{data.set(k.url||k,v);},match:async k=>data.get(k.url||k)};},keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k)};
 class Response{constructor(body,init={}){this.body=body;this.status=init.status??200;this.headers=init.headers||{};this.ok=this.status<300;this.redirected=false;this.asset=body&&body.asset;}}
 const self={location:{origin:'https://trip.example'},clients:{claim:async()=>{claimed++;}},skipWaiting:()=>{skipped++;},addEventListener:(name,fn)=>handlers[name]=fn};
 let installing=false;
 vm.runInNewContext(code,{self,caches,URL,Request,Response,fetch:async r=>{if(installing){requested.push(r);if(fail||failing.has(r.url))throw Error('network failed');const redirected=r.url==='/';return {ok:true,redirected,url:r.url,headers:{},asset:r.url,blob:async()=>({asset:r.url})};}calls.push(r);return {network:true};}});
 async function emit(name,data={}){let pending,answer;installing=name==='install';try{handlers[name]({...data,waitUntil:p=>pending=p,respondWith:p=>answer=p});await pending;}finally{installing=false;}return answer?await answer:undefined;}
 return {emit,stores,calls,get skipped(){return skipped;},get claimed(){return claimed;},set fail(v){fail=v;},set failOnly(v){failing=new Set(v);},requested:()=>requested};
}
test('worker install precaches actual assets, without forcing activation',async()=>{const h=harness();await h.emit('install');const c=[...h.stores.values()][0];assert.ok(c.has('/'));assert.ok(!c.has('/index.html'));assert.ok(c.has('/src/crypto.js'));assert.ok(![...c.keys()].some(k=>k.startsWith('/api/')));assert.equal(h.skipped,0);});
test('failed install removes partial new cache',async()=>{const h=harness();h.fail=true;await assert.rejects(h.emit('install'));assert.equal(h.stores.size,0);});
test('offline navigation returns cached shell without a network request',async()=>{const h=harness();await h.emit('install');const value=await h.emit('fetch',{request:{url:'https://trip.example/',method:'GET',mode:'navigate'}});assert.equal(value.asset,'/');assert.equal(h.calls.length,0);});
test('worker bypasses API, POST, and third-party requests',async()=>{const h=harness();await h.emit('install');for(const request of [{url:'https://trip.example/api/sync',method:'GET'}, {url:'https://trip.example/index.html',method:'POST'}, {url:'https://other.example/image.jpg',method:'GET'}])assert.equal(await h.emit('fetch',{request}),undefined);assert.equal(h.calls.length,0);});
test('readiness detects a missing core asset rather than claiming ready',async()=>{const h=harness();await h.emit('install');let status;const check=async()=>{await h.emit('message',{data:{type:'CHECK_CACHE'},ports:[{postMessage:x=>status=x}]});return status;};
 const first=await check();assert.equal(first.ready,true);assert.equal(first.cached,first.total);assert.equal(first.audioCached,first.audioTotal);assert.ok(first.audioTotal>0);
 const cache=[...h.stores.values()][0];
 // A dropped phrase recording is not a broken install, so readiness must not turn on it.
 const audio=[...cache.keys()].find(k=>k.endsWith('.m4a'));cache.delete(audio);const partial=await check();assert.equal(partial.ready,true);assert.equal(partial.audioCached,partial.audioTotal-1);
 cache.delete('/src/app.js');const broken=await check();assert.equal(broken.ready,false);assert.equal(broken.cached,broken.total-1);});
const OPTIONAL=JSON.parse(code.match(/^const OPTIONAL=(\[.*\]);$/m)[1]);
test('a failed audio file is swallowed while the app still installs, and the shell revalidates instead of re-downloading',async()=>{
 assert.ok(OPTIONAL.length>0);const dropped=OPTIONAL[0];
 const h=harness();h.failOnly=[dropped];await h.emit('install');const cache=[...h.stores.values()][0];
 assert.ok(cache.has('/'));assert.ok(cache.has('/src/app.js'));assert.ok(!cache.has(dropped));
 let status;await h.emit('message',{data:{type:'CHECK_CACHE'},ports:[{postMessage:x=>status=x}]});
 assert.equal(status.ready,true);assert.equal(status.audioCached,status.audioTotal-1);
 // 'reload' forbids the conditional request and re-downloads every byte on every deploy; 'no-cache' lets an unchanged asset answer 304.
 assert.ok(h.requested().length>0);assert.ok(h.requested().every(r=>r.cache==='no-cache'));});
test('a failed core asset still deletes the whole new cache',async()=>{const h=harness();h.failOnly=['/src/app.js'];await assert.rejects(h.emit('install'));assert.equal(h.stores.size,0);});
test('activation preserves one previous app cache and other apps',async()=>{const h=harness();h.stores.set('unrelated-app',new Map());h.stores.set('seoul-pocket-shell-old1',new Map());h.stores.set('seoul-pocket-shell-old2',new Map());await h.emit('install');await h.emit('activate');assert.ok(h.stores.has('unrelated-app'));assert.ok(!h.stores.has('seoul-pocket-shell-old1'));assert.ok(h.stores.has('seoul-pocket-shell-old2'));assert.equal(h.claimed,1);await h.emit('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(h.skipped,1);});

test('a redirected shell response is stored as a plain 200 so navigations can use it',async()=>{const h=harness();await h.emit('install');const shell=[...h.stores.values()][0].get('/');assert.equal(shell.redirected,false);assert.equal(shell.status,200);assert.equal(shell.body.asset,'/');});
