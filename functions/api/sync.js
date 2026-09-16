import {json} from '../_lib/http.js';
import {memberFromRequest,now,readJSON,badJSON} from '../_lib/trip.js';
const MAX_MUTATIONS=25,MAX_ENVELOPE=64*1024,PAGE=200,PAGE_BYTES=512*1024;
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9-]{8,64}$/.test(s);
const shaped=m=>!!m&&validId(m.mutationId)&&validId(m.recordId)&&['place','vote'].includes(m.kind)&&['put','delete'].includes(m.op)&&Number.isInteger(m.baseVersion)&&m.baseVersion>=0&&(m.op!=='put'||(typeof m.envelope==='string'&&m.envelope.length<=MAX_ENVELOPE));
/** Versioned, idempotent sync. A mutation is accepted only when its baseVersion matches the server; otherwise the current
 * server copy comes back as a conflict and nothing is overwritten. Receipts make retries return the same answer.
 * The two read phases are hoisted into one statement each. The record write stays individually awaited because its
 * WHERE version=? compare-and-swap is what makes concurrent writers safe. An applied mutation then batches its change
 * row together with its own receipt, so it still costs two round trips and it keeps its receipt even when the request
 * dies on a later mutation. Only the applied branch needs that, because a lost conflict receipt or a lost version-0
 * delete ack recomputes identically from the same inputs on the retry, so those receipts ride the one tail batch.
 * The record write and the change row are NOT atomic. They are two unbatched statements with no transaction around
 * them, so awaiting one after the other orders them and does nothing more. A change insert that throws leaves the
 * record at version N with no row in the change stream, and the change stream is the only pull path, so that record is
 * invisible to every other phone and no later version of it can be written either, because no client baseVersion will
 * match N again. One DB.batch([write,changeRow]) does not close that window, because a real D1 batch runs inside a
 * transaction, so a compare-and-swap matching zero rows is not an error there and the change row would land for a
 * version that never applied. Closing it needs the change row written as INSERT ... SELECT ... WHERE EXISTS on the
 * record at that version, and tests/_d1.mjs runs batch() as a sequential loop, so no test here can prove either way.
 * The tail batch has a smaller hole. If it fails, a conflict receipt is lost, and a client that retried that mutationId
 * with different content would not get the 'A different change already used this id' error. That check is a safety net
 * against a client bug rather than a correctness guarantee, and the conflict itself recomputes identically. */
export async function onRequestPost({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;const {member}=auth,DB=env.DB,tripId=member.trip_id;
 const body=await readJSON(request,MAX_MUTATIONS*MAX_ENVELOPE+4096);if(!body||body.protocol!==1)return badJSON();
 const since=Number.isInteger(body.since)&&body.since>=0?body.since:0,mutations=Array.isArray(body.mutations)?body.mutations:[];
 if(mutations.length>MAX_MUTATIONS)return json({error:'Send at most 25 changes per request.'},413);
 const acks=[],conflicts=[],errors=[],tail=[];
 const live=mutations.filter(shaped),mutIds=[...new Set(live.map(m=>m.mutationId))],recIds=[...new Set(live.map(m=>m.recordId))];
 const receipts=new Map(),records=new Map();
 if(mutIds.length){const r=await DB.prepare(`SELECT mutation_id,request_hash,response_json FROM mutation_receipts WHERE trip_id=? AND member_id=? AND mutation_id IN (${mutIds.map(()=>'?').join(',')})`).bind(tripId,member.id,...mutIds).all();for(const row of r.results||[])receipts.set(row.mutation_id,row);}
 if(recIds.length){const r=await DB.prepare(`SELECT id,version,encrypted_payload,deleted FROM records WHERE trip_id=? AND id IN (${recIds.map(()=>'?').join(',')})`).bind(tripId,...recIds).all();for(const row of r.results||[])records.set(row.id,row);}
 for(const m of mutations){
  if(!shaped(m)){errors.push({mutationId:m?.mutationId,error:'Invalid change.'});continue;}
  if(member.role==='viewer'){errors.push({mutationId:m.mutationId,error:'Viewers cannot edit.'});continue;}
  const hash=await digestHex(JSON.stringify([m.recordId,m.op,m.baseVersion,m.envelope||'']));
  const receipt=receipts.get(m.mutationId);
  if(receipt){if(receipt.request_hash!==hash){errors.push({mutationId:m.mutationId,error:'A different change already used this id.'});continue;}const r=JSON.parse(receipt.response_json);(r.conflict?conflicts:acks).push(r.conflict||r.ack);continue;}
  const current=records.get(m.recordId)||null;
  const currentVersion=current?current.version:0;
  let result,changeStmt=null;
  // A find created and deleted on one phone before its first sync: the server holds nothing, so there is nothing to tombstone.
  // Acknowledging at version 0 clears the client outbox entry and leaves the next mutation on this id matching the server.
  if(m.op==='delete'&&!current){result={ack:{mutationId:m.mutationId,recordId:m.recordId,version:0}};}
  else if(currentVersion!==m.baseVersion){result={conflict:{mutationId:m.mutationId,recordId:m.recordId,kind:m.kind,current:{version:currentVersion,envelope:current?.encrypted_payload||null,deleted:!!current?.deleted}}};}
  else{
   const version=currentVersion+1,deleted=m.op==='delete'?1:0,payload=m.op==='delete'?(current?.encrypted_payload||''):m.envelope,ts=now();
   const write=current
    ?DB.prepare('UPDATE records SET encrypted_payload=?,key_version=?,version=?,deleted=?,updated_at=?,updated_by=? WHERE trip_id=? AND id=? AND version=?').bind(payload,1,version,deleted,ts,member.id,tripId,m.recordId,currentVersion)
    :DB.prepare('INSERT INTO records (trip_id,id,kind,encrypted_payload,key_version,version,deleted,updated_at,updated_by) VALUES (?,?,?,?,1,?,?,?,?)').bind(tripId,m.recordId,m.kind,payload,version,deleted,ts,member.id);
   let applied;try{const w=await write.run();applied=(w.meta?.changes??1)>0;}catch{applied=false;}
   if(!applied){const again=await DB.prepare('SELECT version,encrypted_payload,deleted FROM records WHERE trip_id=? AND id=?').bind(tripId,m.recordId).first();if(again)records.set(m.recordId,again);else records.delete(m.recordId);result={conflict:{mutationId:m.mutationId,recordId:m.recordId,kind:m.kind,current:{version:again?.version||0,envelope:again?.encrypted_payload||null,deleted:!!again?.deleted}}};}
   else{records.set(m.recordId,{id:m.recordId,version,encrypted_payload:payload,deleted});changeStmt=DB.prepare('INSERT INTO changes (trip_id,record_id,version,encrypted_payload,deleted,changed_at,kind) VALUES (?,?,?,?,?,?,?)').bind(tripId,m.recordId,version,payload,deleted,ts,m.kind);result={ack:{mutationId:m.mutationId,recordId:m.recordId,version}};}
  }
  const receiptStmt=DB.prepare('INSERT OR IGNORE INTO mutation_receipts (trip_id,member_id,mutation_id,request_hash,response_json,created_at) VALUES (?,?,?,?,?,?)').bind(tripId,member.id,m.mutationId,hash,JSON.stringify(result),now());
  if(changeStmt)await DB.batch([changeStmt,receiptStmt]);else tail.push(receiptStmt);
  receipts.set(m.mutationId,{mutation_id:m.mutationId,request_hash:hash,response_json:JSON.stringify(result)});
  (result.conflict?conflicts:acks).push(result.conflict||result.ack);
 }
 if(tail.length)await DB.batch(tail);
 const rows=await DB.prepare('SELECT sequence,record_id,version,encrypted_payload,deleted,kind FROM changes WHERE trip_id=? AND sequence>? ORDER BY sequence LIMIT ?').bind(tripId,since,PAGE+1).all();
 // The response is capped by rows and by bytes, because 200 records at the 64 KB envelope ceiling is 12.5 MB on mobile data.
 // The read above is not: D1 still returns up to 201 payloads and this trims them. Bounding the read needs a second query for
 // LENGTH(encrypted_payload) before fetching, which costs a round trip on every sync to guard a ceiling only pathological data reaches.
 const list=rows.results||[],page=[];let bytes=0;
 for(const c of list){const size=(c.encrypted_payload||'').length;if(page.length>=PAGE)break;if(page.length&&bytes+size>PAGE_BYTES)break;page.push(c);bytes+=size;}
 const hasMore=list.length>page.length;
 await DB.prepare('UPDATE members SET last_seen_at=? WHERE id=?').bind(now(),member.id).run();
 return json({protocol:1,acks,conflicts,errors,changes:page.map(c=>({sequence:c.sequence,recordId:c.record_id,kind:c.kind||'place',version:c.version,envelope:c.encrypted_payload,deleted:!!c.deleted})),cursor:page.length?page[page.length-1].sequence:since,hasMore,serverTime:now()});
}
async function digestHex(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
