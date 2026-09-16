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
 const {onRequest:middleware}=await import('../functions/_middleware.js');const {hashToken}=await import('../functions/_lib/trip.js');
 const {env,guest}=await setup();
 // The phone sends a media ticket, the member's stored token_hash, so a value that leaks from the DOM or a request log cannot write.
 const ticket=await hashToken(guest.memberToken);
 assert.equal((await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/'}),env})).status,401);
 assert.equal((await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/'},guest.memberToken),env})).status,503);
 const env2={...env,FETCH_ORIGIN:'https://fetcher.example',FETCH_SECRET:'s'.repeat(40)};const old=globalThis.fetch;let seen;
 globalThis.fetch=async(u,o)=>{seen={u:String(u),h:o.headers};return Response.json({id:'563715fe5105464386d7',provider:'instagram',author:'A',caption:'C',title:'T',durationS:7,kind:'video',thumb:'/media/563715fe5105464386d7/thumb.jpg',video:'/media/563715fe5105464386d7/video.mp4',url:'https://www.instagram.com/reel/x/'});};
 try{const r=await unfurl({request:post('/api/unfurl',{url:'https://www.instagram.com/reel/x/?igsh=1'},guest.memberToken),env:env2}),b=await r.json();
  assert.equal(r.status,200);assert.equal(seen.u,'https://fetcher.example/unfurl');assert.equal(seen.h['X-Fetch-Secret'],'s'.repeat(40));assert.equal(b.thumb,'/api/media/563715fe5105464386d7/thumb.jpg');assert.equal(b.video,'/api/media/563715fe5105464386d7/video.mp4');assert.equal(JSON.stringify(b).includes('fetcher.example'),false);
  globalThis.fetch=async(u,o)=>{seen={u:String(u),h:o.headers};return new Response('abc',{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-2/10','Content-Length':'3'}});};
  // Through onRequest, because Cloudflare runs the middleware over every Function response and it used to replace this header with no-store.
  const mreq=new Request('https://trip.example/api/media/563715fe5105464386d7/video.mp4?t='+ticket,{headers:{Range:'bytes=0-2'}});
  const mr=await middleware({request:mreq,env:env2,next:()=>media({request:mreq,env:env2,params:{path:['563715fe5105464386d7','video.mp4']}})});
  assert.equal(mr.status,206);assert.equal(seen.h.Range,'bytes=0-2');assert.equal(mr.headers.get('Content-Range'),'bytes 0-2/10');assert.equal(mr.headers.get('Cache-Control'),'private, max-age=31536000, immutable');
  assert.equal((await media({request:new Request('https://trip.example/api/media/563715fe5105464386d7/video.mp4'),env:env2,params:{path:['563715fe5105464386d7','video.mp4']}})).status,401);
  assert.equal((await media({request:new Request('https://trip.example/api/media/x/../etc?t='+ticket),env:env2,params:{path:['x','..']}})).status,404);
  // The ticket only reads media. It is not a general credential, so it cannot write to the shared trip.
  assert.equal((await send(env2,ticket,{})).status,401);
  assert.equal((await send(env2,guest.memberToken,{})).status,200);
 }finally{globalThis.fetch=old;}
});

test('unfurl forwards only allowlisted hosts and answers in its own words, never the fetcher\'s',async()=>{
 const {onRequestPost:unfurl}=await import('../functions/api/unfurl.js');
 const {env,guest}=await setup();
 const env2={...env,FETCH_ORIGIN:'https://fetcher.example',FETCH_SECRET:'s'.repeat(40)};
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({id:'a'.repeat(20),provider:'tiktok',url:'https://www.tiktok.com/@u/video/1'});};
 const ask=async url=>{const r=await unfurl({request:post('/api/unfurl',{url},guest.memberToken),env:env2});return {status:r.status,body:await r.json()};};
 try{
  for(const url of ['https://tiktok.com/@u/video/1','https://www.tiktok.com/@u/video/1','https://m.blog.naver.com/someone/1','https://youtu.be/abcdefgh'])assert.equal((await ask(url)).status,200,url);
  assert.equal(calls,4,'the bare host and a subdomain of it both reach the fetcher');
  // A host that merely ends with an allowed name is somebody else's site. The pattern anchors both ends for exactly this.
  for(const url of ['https://example.com/x','https://eviltiktok.com/@u/video/1','https://tiktok.com.attacker.test/@u/video/1','https://notyoutu.be/abcdefgh','https://naver.com.evil.test/x']){
   const r=await ask(url);assert.equal(r.status,400,url);assert.equal(r.body.error,'That site is not supported. Paste a TikTok, Instagram, YouTube, Naver or X link.',url);}
  // Userinfo and an explicit port are how a link gets read as one host and fetched as another, so both are refused before the allowlist runs.
  for(const url of ['https://user:pw@tiktok.com/x','https://tiktok.com:8443/@u/video/1']){
   const r=await ask(url);assert.equal(r.status,400,url);assert.equal(r.body.error,'Paste a full https link.',url);}
  assert.equal(calls,4,'a refused host never reaches the fetcher at all');
  globalThis.fetch=async()=>new Response('yt-dlp died: /home/openclaw/fetcher.py:88 cookies.txt unreadable',{status:500});
  const failed=await ask('https://www.tiktok.com/@u/video/1');
  assert.equal(failed.status,502);
  assert.equal(failed.body.error,'The link could not be read.','the traveler reads the module\'s own line, not the fetcher\'s stderr');
  assert.equal(/yt-dlp|openclaw|cookies/.test(JSON.stringify(failed.body)),false,'upstream text must never be relayed to the browser');
  globalThis.fetch=async()=>new Response('unsupported url: private account',{status:400});
  const rejected=await ask('https://www.instagram.com/reel/x/');
  assert.equal(rejected.status,400);assert.equal(rejected.body.error,'The link could not be read.');
 }finally{globalThis.fetch=old;}
});

test('trip creation is open for the first trip, shut after it, and reopened only by the exact flag',async()=>{
 const env={API_ACCESS_TOKEN:token,DB:migrated()};
 const body={name:'Seoul',salt,memberName:'Chris'};
 // No credential check guards this route, so the gate is all that stands between a public URL and unbounded trip creation.
 assert.equal((await create({request:post('/api/trip/create',body),env})).status,201,'first-run setup on a fresh deployment is open');
 const closed=await create({request:post('/api/trip/create',body),env});
 assert.equal(closed.status,403,'with a trip already present and TRIP_CREATE_OPEN unset, a second trip must be refused');
 assert.match((await closed.json()).error,/already has a trip/);
 assert.equal((await create({request:post('/api/trip/create',body),env:{...env,TRIP_CREATE_OPEN:'1'}})).status,201);
 assert.equal((await create({request:post('/api/trip/create',body),env:{...env,TRIP_CREATE_OPEN:'true'}})).status,403,'only the literal 1 opens the window');
 assert.equal((await create({request:post('/api/trip/create',body),env:{...env,TRIP_CREATE_OPEN:1}})).status,403);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM trips').first()).n,2);
});

test('a change page stops on the byte budget, and its cursor fetches the rest whole',async()=>{
 const {env,owner,guest}=await setup();
 // 64 KB is the envelope ceiling and 512 KB is the page budget, so eight of these fill a page with 192 rows of headroom left.
 const envelope='v1.a.'+'x'.repeat(65531);
 assert.equal(envelope.length,64*1024);
 const rec=n=>'rec-'+String(n).padStart(8,'0');
 const wrote=await send(env,owner.memberToken,{mutations:Array.from({length:12},(_,i)=>({mutationId:'m'+String(i).padStart(9,'0'),recordId:rec(i),kind:'place',op:'put',baseVersion:0,envelope}))});
 assert.equal(wrote.body.acks.length,12);
 const first=await send(env,guest.memberToken,{since:0});
 assert.equal(first.body.changes.length,8,'the page is cut by bytes, not by the 200-row cap');
 assert.ok(first.body.changes.reduce((n,c)=>n+c.envelope.length,0)<=512*1024);
 assert.equal(first.body.hasMore,true);
 assert.equal(first.body.cursor,first.body.changes[7].sequence);
 const second=await send(env,guest.memberToken,{since:first.body.cursor});
 assert.equal(second.body.changes.length,4);
 assert.equal(second.body.hasMore,false);
 const ids=[...first.body.changes,...second.body.changes].map(c=>c.recordId);
 assert.equal(new Set(ids).size,12,'no record is delivered twice across the two pages');
 assert.deepEqual(ids.slice().sort(),Array.from({length:12},(_,i)=>rec(i)).sort(),'and none is lost between them');
});

test('a conflict names its own record kind, on both conflict shapes',async()=>{
 const {env,owner,guest}=await setup();
 const place='rec-11111111',vote='v-place1-dev1abcd';
 await send(env,owner.memberToken,{mutations:[
  {mutationId:'m1-aaaaaaaa',recordId:place,kind:'place',op:'put',baseVersion:0,envelope:'v1.a.b'},
  {mutationId:'m2-aaaaaaaa',recordId:vote,kind:'vote',op:'put',baseVersion:0,envelope:'v1.c.d'}]});
 const stale=await send(env,guest.memberToken,{mutations:[
  {mutationId:'m3-bbbbbbbb',recordId:place,kind:'place',op:'put',baseVersion:0,envelope:'v1.e.f'},
  {mutationId:'m4-bbbbbbbb',recordId:vote,kind:'vote',op:'put',baseVersion:0,envelope:'v1.g.h'}]});
 assert.equal(stale.body.conflicts.length,2);
 const by=new Map(stale.body.conflicts.map(c=>[c.recordId,c]));
 assert.equal(by.get(place).kind,'place');
 assert.equal(by.get(vote).kind,'vote','public/src/sync.js keys its decode on c.kind and skips votes; a vote envelope opened as a place fails AAD and tells the traveler the passphrase is wrong');
 // The other shape: the compare-and-swap loses to a writer that landed between the read and the write.
 const {env:raw,guest:other}=await setup();
 const real=raw.DB,swallow=sql=>sql.startsWith('INSERT INTO records');
 const raced={...real,prepare:sql=>{const st=real.prepare(sql);return swallow(sql)?{...st,bind:(...a)=>({...st.bind(...a),run:async()=>({meta:{changes:0}})})}:st;}};
 const lost=await send({...raw,DB:raced},other.memberToken,{mutations:[{mutationId:'m5-cccccccc',recordId:'v-place2-dev2abcd',kind:'vote',op:'put',baseVersion:0,envelope:'v1.i.j'}]});
 assert.equal(lost.body.conflicts.length,1);
 assert.equal(lost.body.conflicts[0].kind,'vote','the compare-and-swap conflict carries the kind too, or the client guesses from the record id prefix');
});

// A receipt held back for one batch at the end is lost for every mutation in the request when that batch dies, so a phone
// with 25 queued edits comes back to 25 conflicts on records nobody else touched. These two pin the window at one mutation.
const kindOf=s=>s.includes('INTO changes')?'change':s.includes('INTO mutation_receipts')?'receipt':'other';
function tapped(DB,seen){
 const w=(st,sql)=>({first:async()=>{seen.push(kindOf(sql));return st.first();},run:async()=>{seen.push(kindOf(sql));return st.run();},all:async()=>{seen.push(kindOf(sql));return st.all();},__raw:st,__sql:sql});
 return {...DB,prepare:sql=>{const s=DB.prepare(sql);return {...w(s,sql),bind:(...a)=>w(s.bind(...a),sql)};},
  batch:async list=>{seen.push(list.map(s=>kindOf(s.__sql)).join('+'));return DB.batch(list.map(s=>s.__raw));}};
}
const puts=n=>Array.from({length:n},(_,i)=>({mutationId:'mut-'+String(i).padStart(8,'0'),recordId:'rec-'+String(i).padStart(8,'0'),kind:'place',op:'put',baseVersion:0,envelope:'v1.aa.bb'}));

test('a receipt write that dies costs one mutation, not the whole request',async()=>{
 const {env,owner}=await setup();
 const real=env.DB,boom=()=>{throw new Error('worker died');};
 const dead={...real,prepare:sql=>{const s=real.prepare(sql);return sql.includes('mutation_receipts')?{...s,bind:(...a)=>({...s.bind(...a),run:boom})}:s;},batch:async list=>{for(const s of list)await s.run();return [];}};
 await assert.rejects(send({...env,DB:dead},owner.memberToken,{mutations:puts(3)}),/worker died/);
 const count=async t=>(await real.prepare('SELECT COUNT(*) AS n FROM '+t).first()).n;
 assert.equal(await count('records'),1,'the request stops at the first applied mutation instead of writing all three');
 assert.equal(await count('changes'),1);
 assert.equal(await count('mutation_receipts'),0);
 const retry=await send(env,owner.memberToken,{mutations:puts(3)});
 assert.equal(retry.body.acks.length,2,'the two that never ran apply on the retry');
 assert.equal(retry.body.conflicts.length,1,'only the one that landed without a receipt conflicts');
});

test('an applied mutation costs two D1 round trips, its change row and its receipt in one batch',async()=>{
 const one=[],three=[];
 const a=await setup(),r1=await send({...a.env,DB:tapped(a.env.DB,one)},a.owner.memberToken,{mutations:puts(1)});
 const b=await setup(),r3=await send({...b.env,DB:tapped(b.env.DB,three)},b.owner.memberToken,{mutations:puts(3)});
 assert.equal(r1.body.acks.length,1);assert.equal(r3.body.acks.length,3);
 assert.deepEqual(one.filter(s=>s.includes('+')),['change+receipt']);
 assert.deepEqual(three.filter(s=>s.includes('+')),['change+receipt','change+receipt','change+receipt']);
 assert.equal(three.filter(s=>s==='receipt').length,0,'no applied receipt is left for a tail batch');
 assert.equal(three.length-one.length,4,'two extra applied mutations cost exactly two round trips each');
});
