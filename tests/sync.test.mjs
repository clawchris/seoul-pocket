import test from 'node:test';
import assert from 'node:assert/strict';
import {migrated} from './_d1.mjs';
import {onRequestPost as create} from '../functions/api/trip/create.js';
import {onRequestPost as join} from '../functions/api/trip/join.js';
import {onRequestPost as rotate,onRequestGet as members} from '../functions/api/trip/invite.js';
import {onRequestPost as sync} from '../functions/api/sync.js';

const token='t'.repeat(40),salt='c2FsdHNhbHRzYWx0c2FsdHNhbHRzYWx0';
const post=(path,body,bearer)=>new Request('https://trip.example'+path,{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
const get=(path,bearer)=>new Request('https://trip.example'+path,{headers:{Authorization:'Bearer '+bearer}});
async function setup(){
 const env={API_ACCESS_TOKEN:token,DB:migrated()};
 const owner=await (await create({request:post('/api/trip/create',{name:'Seoul',salt,memberName:'Chris'},token),env})).json();
 const guest=await (await join({request:post('/api/trip/join',{tripId:owner.tripId,code:owner.invite.code,memberName:'Sam'}),env})).json();
 return {env,owner,guest};
}
const send=(env,bearer,body)=>sync({request:post('/api/sync',{protocol:1,since:0,mutations:[],...body},bearer),env}).then(async r=>({status:r.status,body:await r.json()}));

test('trip creation needs only a name and salt, returns an invite; joining needs only the invite',async()=>{
 const env={API_ACCESS_TOKEN:token,DB:migrated()};
 assert.equal((await create({request:post('/api/trip/create',{name:'Seoul',salt:'short'},token),env})).status,400);
 const r=await create({request:post('/api/trip/create',{name:'Seoul',salt,memberName:'Chris'},token),env}),o=await r.json();
 assert.equal(r.status,201);assert.match(o.tripId,/^[a-f0-9]{16}$/);assert.equal(o.role,'owner');assert.equal(o.invite.code.length,8);assert.equal(o.salt,salt);
 assert.equal((await join({request:post('/api/trip/join',{tripId:o.tripId,code:'WRONGXYZ'}),env})).status,403);
 const j=await join({request:post('/api/trip/join',{tripId:o.tripId,code:o.invite.code.toLowerCase(),memberName:'Sam'}),env}),g=await j.json();
 assert.equal(j.status,201);assert.equal(g.role,'editor');assert.equal(g.salt,salt);assert.notEqual(g.memberToken,o.memberToken);
 const list=await (await members({request:get('/api/trip/invite',g.memberToken),env})).json();
 assert.deepEqual(list.members.map(m=>m.name),['Chris','Sam']);
});

test('sync: versioned put, pull, stale base conflicts, and the winner continues',async()=>{
 const {env,owner,guest}=await setup();
 const a=await send(env,owner.memberToken,{mutations:[{mutationId:'m1-aaaaaaaa',recordId:'rec-11111111',kind:'place',op:'put',baseVersion:0,envelope:'v1.a.b'}]});
 assert.equal(a.status,200);assert.deepEqual(a.body.acks,[{mutationId:'m1-aaaaaaaa',recordId:'rec-11111111',version:1}]);assert.equal(a.body.changes.length,1);assert.equal(a.body.cursor,1);
 const b=await send(env,guest.memberToken,{});
 assert.equal(b.body.changes[0].envelope,'v1.a.b');assert.equal(b.body.changes[0].version,1);
 const stale=await send(env,guest.memberToken,{since:1,mutations:[{mutationId:'m2-bbbbbbbb',recordId:'rec-11111111',kind:'place',op:'put',baseVersion:0,envelope:'v1.c.d'}]});
 assert.equal(stale.body.acks.length,0);assert.equal(stale.body.conflicts[0].current.version,1);assert.equal(stale.body.conflicts[0].current.envelope,'v1.a.b');assert.equal(stale.body.conflicts[0].current.deleted,false);
 const ok=await send(env,guest.memberToken,{since:1,mutations:[{mutationId:'m3-cccccccc',recordId:'rec-11111111',kind:'place',op:'put',baseVersion:1,envelope:'v1.c.d'}]});
 assert.equal(ok.body.acks[0].version,2);
 const pull=await send(env,owner.memberToken,{since:1});
 assert.equal(pull.body.changes.length,1);assert.equal(pull.body.changes[0].version,2);assert.equal(pull.body.cursor,2);assert.equal(pull.body.hasMore,false);
});

test('sync: retries are idempotent and a reused id with different content is refused',async()=>{
 const {env,owner}=await setup();
 const m={mutationId:'m1-aaaaaaaa',recordId:'rec-11111111',kind:'place',op:'put',baseVersion:0,envelope:'v1.a.b'};
 const first=await send(env,owner.memberToken,{mutations:[m]}),again=await send(env,owner.memberToken,{mutations:[m]});
 assert.deepEqual(again.body.acks,first.body.acks);
 const rows=await env.DB.prepare('SELECT COUNT(*) AS n FROM changes').first();assert.equal(rows.n,1);
 const other=await send(env,owner.memberToken,{mutations:[{...m,envelope:'v1.x.y'}]});
 assert.equal(other.body.acks.length,0);assert.match(other.body.errors[0].error,/different change/);
});

test('sync: deletes are tombstones, viewers cannot write, and limits fail closed',async()=>{
 const {env,owner,guest}=await setup();
 await send(env,owner.memberToken,{mutations:[{mutationId:'m1-aaaaaaaa',recordId:'rec-11111111',kind:'place',op:'put',baseVersion:0,envelope:'v1.a.b'}]});
 const del=await send(env,guest.memberToken,{mutations:[{mutationId:'m2-bbbbbbbb',recordId:'rec-11111111',kind:'place',op:'delete',baseVersion:1}]});
 assert.equal(del.body.acks[0].version,2);
 const pull=await send(env,owner.memberToken,{since:1});assert.equal(pull.body.changes[0].deleted,true);
 await env.DB.prepare("UPDATE members SET role='viewer' WHERE name='Sam'").run();
 const denied=await send(env,guest.memberToken,{mutations:[{mutationId:'m3-cccccccc',recordId:'rec-22222222',kind:'place',op:'put',baseVersion:0,envelope:'v1.a.b'}]});
 assert.match(denied.body.errors[0].error,/Viewers/);
 const tooMany=await send(env,owner.memberToken,{mutations:Array.from({length:26},(_,i)=>({mutationId:'id-'+String(i).padStart(8,'0'),recordId:'rec-00000000',kind:'place',op:'put',baseVersion:0,envelope:'x'}))});
 assert.equal(tooMany.status,413);
 assert.equal((await sync({request:post('/api/sync',{protocol:2},owner.memberToken),env})).status,400);
 assert.equal((await sync({request:post('/api/sync',{protocol:1},'nope'),env})).status,401);
 const cross=new Request('https://trip.example/api/sync',{method:'POST',headers:{Authorization:'Bearer '+owner.memberToken,Origin:'https://evil.example'},body:'{}'});
 assert.equal((await sync({request:cross,env})).status,403);
});

test('invite rotation stops the old code at once and only the owner may rotate',async()=>{
 const {env,owner,guest}=await setup();
 assert.equal((await rotate({request:post('/api/trip/invite',{},guest.memberToken),env})).status,403);
 const r=await (await rotate({request:post('/api/trip/invite',{},owner.memberToken),env})).json();
 assert.notEqual(r.invite.code,owner.invite.code);
 assert.equal((await join({request:post('/api/trip/join',{tripId:owner.tripId,code:owner.invite.code}),env})).status,403);
 assert.equal((await join({request:post('/api/trip/join',{tripId:owner.tripId,code:r.invite.code}),env})).status,201);
});

test('a member token unlocks the proxies and a stranger token does not; trip count is capped',async()=>{
 const {authorize}=await import('../functions/_lib/http.js');
 const {env,guest}=await setup();
 const r=(b)=>new Request('https://trip.example/api/places?q=x',{headers:{Authorization:'Bearer '+b}});
 assert.equal(await authorize(r(token),env),null);assert.equal(await authorize(r(guest.memberToken),env),null);assert.equal((await authorize(r('x'.repeat(40)),env)).status,401);
 for(let i=0;i<29;i++)await env.DB.prepare("INSERT INTO trips (id,name,created_at,encryption_salt,key_version) VALUES (?,?,?,?,1)").bind('t'+i,'x','2026',salt).run();
 assert.equal((await create({request:post('/api/trip/create',{name:'Seoul',salt}),env})).status,503);
 const cross=new Request('https://trip.example/api/trip/create',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({name:'x',salt})});
 assert.equal((await create({request:cross,env})).status,403);
});

test('votes are their own record kind and come back with their kind in the change stream',async()=>{
 const {env,owner,guest}=await setup();
 const r=await send(env,guest.memberToken,{mutations:[{mutationId:'m1-aaaaaaaa',recordId:'v-place1-dev1abcd',kind:'vote',op:'put',baseVersion:0,envelope:'v1.a.b'}]});
 assert.equal(r.body.acks[0].version,1);
 const pull=await send(env,owner.memberToken,{});assert.equal(pull.body.changes[0].kind,'vote');
 const bad=await send(env,guest.memberToken,{mutations:[{mutationId:'m2-aaaaaaaa',recordId:'x-00000001',kind:'stay',op:'put',baseVersion:0,envelope:'v1.a.b'}]});
 assert.match(bad.body.errors[0].error,/Invalid/);
});

test('unfurl and media proxy need membership and the fetcher, and never expose the fetcher secret or origin',async()=>{
 const {onRequestPost:unfurl}=await import('../functions/api/unfurl.js');const {onRequestGet:media}=await import('../functions/api/media/[[path]].js');
 const {env,guest}=await setup();
 assert.equal((await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/'}),env})).status,401);
 assert.equal((await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/'},guest.memberToken),env})).status,503);
 const env2={...env,FETCH_ORIGIN:'https://fetcher.example',FETCH_SECRET:'s'.repeat(40)};const old=globalThis.fetch;let seen;
 globalThis.fetch=async(u,o)=>{seen={u:String(u),h:o.headers};return Response.json({id:'563715fe5105464386d7',provider:'instagram',author:'A',caption:'C',title:'T',durationS:7,kind:'video',thumb:'/media/563715fe5105464386d7/thumb.jpg',video:'/media/563715fe5105464386d7/video.mp4',url:'https://www.instagram.com/reel/x/'});};
 try{const r=await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/?igsh=1'},guest.memberToken),env:env2}),b=await r.json();
  assert.equal(r.status,200);assert.equal(seen.u,'https://fetcher.example/unfurl');assert.equal(seen.h['X-Fetch-Secret'],'s'.repeat(40));assert.equal(b.thumb,'/api/media/563715fe5105464386d7/thumb.jpg');assert.equal(b.video,'/api/media/563715fe5105464386d7/video.mp4');assert.equal(JSON.stringify(b).includes('fetcher.example'),false);
  globalThis.fetch=async(u,o)=>{seen={u:String(u),h:o.headers};return new Response('abc',{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-2/10','Content-Length':'3'}});};
  const mr=await media({request:new Request('https://trip.example/api/media/563715fe5105464386d7/video.mp4?t='+guest.memberToken,{headers:{Range:'bytes=0-2'}}),env:env2,params:{path:['563715fe5105464386d7','video.mp4']}});
  assert.equal(mr.status,206);assert.equal(seen.h.Range,'bytes=0-2');assert.equal(mr.headers.get('Content-Range'),'bytes 0-2/10');assert.match(mr.headers.get('Cache-Control'),/private/);
  assert.equal((await media({request:new Request('https://trip.example/api/media/563715fe5105464386d7/video.mp4'),env:env2,params:{path:['563715fe5105464386d7','video.mp4']}})).status,401);
  assert.equal((await media({request:new Request('https://trip.example/api/media/x/../etc?t='+guest.memberToken),env:env2,params:{path:['x','..']}})).status,404);
 }finally{globalThis.fetch=old;}
});
