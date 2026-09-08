import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:new URL('..',import.meta.url)});
const code=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
function harness(){
 const handlers={},stores=new Map(),calls=[];let skipped=0,claimed=0,fail=false;
 class Request{constructor(url,options={}){this.url=url;Object.assign(this,options);}}
 const caches={open:async key=>{if(!stores.has(key))stores.set(key,new Map());const data=stores.get(key);return {put:async(k,v)=>{data.set(k.url||k,v);},match:async k=>data.get(k.url||k)};},keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k)};
 class Response{constructor(body,init={}){this.body=body;this.status=init.status??200;this.headers=init.headers||{};this.ok=this.status<300;this.redirected=false;this.asset=body&&body.asset;}}
 const self={location:{origin:'https://trip.example'},clients:{claim:async()=>{claimed++;}},skipWaiting:()=>{skipped++;},addEventListener:(name,fn)=>handlers[name]=fn};
 let installing=false;
 vm.runInNewContext(code,{self,caches,URL,Request,Response,fetch:async r=>{if(installing){if(fail)throw Error('network failed');const redirected=r.url==='/';return {ok:true,redirected,url:r.url,headers:{},asset:r.url,blob:async()=>({asset:r.url})};}calls.push(r);return {network:true};}});
 async function emit(name,data={}){let pending,answer;installing=name==='install';try{handlers[name]({...data,waitUntil:p=>pending=p,respondWith:p=>answer=p});await pending;}finally{installing=false;}return answer?await answer:undefined;}
 return {emit,stores,calls,get skipped(){return skipped;},get claimed(){return claimed;},set fail(v){fail=v;}};
}
test('worker install precaches actual assets, without forcing activation',async()=>{const h=harness();await h.emit('install');const c=[...h.stores.values()][0];assert.ok(c.has('/'));assert.ok(!c.has('/index.html'));assert.ok(c.has('/src/crypto.js'));assert.ok(![...c.keys()].some(k=>k.startsWith('/api/')));assert.equal(h.skipped,0);});
test('failed install removes partial new cache',async()=>{const h=harness();h.fail=true;await assert.rejects(h.emit('install'));assert.equal(h.stores.size,0);});
test('offline navigation returns cached shell without a network request',async()=>{const h=harness();await h.emit('install');const value=await h.emit('fetch',{request:{url:'https://trip.example/',method:'GET',mode:'navigate'}});assert.equal(value.asset,'/');assert.equal(h.calls.length,0);});
test('worker bypasses API, POST, and third-party requests',async()=>{const h=harness();await h.emit('install');for(const request of [{url:'https://trip.example/api/sync',method:'GET'}, {url:'https://trip.example/index.html',method:'POST'}, {url:'https://other.example/image.jpg',method:'GET'}])assert.equal(await h.emit('fetch',{request}),undefined);assert.equal(h.calls.length,0);});
test('readiness detects a missing cached asset rather than claiming ready',async()=>{const h=harness();await h.emit('install');let status;await h.emit('message',{data:{type:'CHECK_CACHE'},ports:[{postMessage:x=>status=x}]});assert.equal(status.ready,true);[...h.stores.values()][0].delete('/src/app.js');await h.emit('message',{data:{type:'CHECK_CACHE'},ports:[{postMessage:x=>status=x}]});assert.equal(status.ready,false);});
test('activation preserves one previous app cache and other apps',async()=>{const h=harness();h.stores.set('unrelated-app',new Map());h.stores.set('seoul-pocket-shell-old1',new Map());h.stores.set('seoul-pocket-shell-old2',new Map());await h.emit('install');await h.emit('activate');assert.ok(h.stores.has('unrelated-app'));assert.ok(!h.stores.has('seoul-pocket-shell-old1'));assert.ok(h.stores.has('seoul-pocket-shell-old2'));assert.equal(h.claimed,1);await h.emit('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(h.skipped,1);});

test('a redirected shell response is stored as a plain 200 so navigations can use it',async()=>{const h=harness();await h.emit('install');const shell=[...h.stores.values()][0].get('/');assert.equal(shell.redirected,false);assert.equal(shell.status,200);assert.equal(shell.body.asset,'/');});
