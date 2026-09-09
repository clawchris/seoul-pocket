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

test('trip creation needs the private token and returns an invite; joining needs only the invite',async()=>{
 const env={API_ACCESS_TOKEN:token,DB:migrated()};
 assert.equal((await create({request:post('/api/trip/create',{name:'Seoul',salt}),env})).status,401);
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
