import {json} from '../_lib/http.js';
import {memberFromRequest,now,readJSON,badJSON} from '../_lib/trip.js';
const MAX_MUTATIONS=25,MAX_ENVELOPE=64*1024,PAGE=200;
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9-]{8,64}$/.test(s);
/** Versioned, idempotent sync. A mutation is accepted only when its baseVersion matches the server; otherwise the current
 * server copy comes back as a conflict and nothing is overwritten. Receipts make retries return the same answer. */
export async function onRequestPost({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;const {member}=auth,DB=env.DB,tripId=member.trip_id;
 const body=await readJSON(request,MAX_MUTATIONS*MAX_ENVELOPE+4096);if(!body||body.protocol!==1)return badJSON();
 const since=Number.isInteger(body.since)&&body.since>=0?body.since:0,mutations=Array.isArray(body.mutations)?body.mutations:[];
 if(mutations.length>MAX_MUTATIONS)return json({error:'Send at most 25 changes per request.'},413);
 const acks=[],conflicts=[],errors=[];
 for(const m of mutations){
  if(!validId(m.mutationId)||!validId(m.recordId)||!['place','vote'].includes(m.kind)||!['put','delete'].includes(m.op)||!Number.isInteger(m.baseVersion)||m.baseVersion<0||(m.op==='put'&&(typeof m.envelope!=='string'||m.envelope.length>MAX_ENVELOPE))){errors.push({mutationId:m.mutationId,error:'Invalid change.'});continue;}
  if(member.role==='viewer'){errors.push({mutationId:m.mutationId,error:'Viewers cannot edit.'});continue;}
  const hash=await digestHex(JSON.stringify([m.recordId,m.op,m.baseVersion,m.envelope||'']));
  const receipt=await DB.prepare('SELECT request_hash,response_json FROM mutation_receipts WHERE trip_id=? AND member_id=? AND mutation_id=?').bind(tripId,member.id,m.mutationId).first();
  if(receipt){if(receipt.request_hash!==hash){errors.push({mutationId:m.mutationId,error:'A different change already used this id.'});continue;}const r=JSON.parse(receipt.response_json);(r.conflict?conflicts:acks).push(r.conflict||r.ack);continue;}
  const current=await DB.prepare('SELECT version,encrypted_payload,deleted FROM records WHERE trip_id=? AND id=?').bind(tripId,m.recordId).first();
  const currentVersion=current?current.version:0;
  let result;
  if(currentVersion!==m.baseVersion){result={conflict:{mutationId:m.mutationId,recordId:m.recordId,current:{version:currentVersion,envelope:current?.encrypted_payload||null,deleted:!!current?.deleted}}};}
  else{
   const version=currentVersion+1,deleted=m.op==='delete'?1:0,payload=m.op==='delete'?(current?.encrypted_payload||''):m.envelope,ts=now();
   const write=current
    ?DB.prepare('UPDATE records SET encrypted_payload=?,key_version=?,version=?,deleted=?,updated_at=?,updated_by=? WHERE trip_id=? AND id=? AND version=?').bind(payload,1,version,deleted,ts,member.id,tripId,m.recordId,currentVersion)
    :DB.prepare('INSERT INTO records (trip_id,id,kind,encrypted_payload,key_version,version,deleted,updated_at,updated_by) VALUES (?,?,?,?,1,?,?,?,?)').bind(tripId,m.recordId,m.kind,payload,version,deleted,ts,member.id);
   let applied;try{const w=await write.run();applied=(w.meta?.changes??1)>0;}catch{applied=false;}
   if(!applied){const again=await DB.prepare('SELECT version,encrypted_payload,deleted FROM records WHERE trip_id=? AND id=?').bind(tripId,m.recordId).first();result={conflict:{mutationId:m.mutationId,recordId:m.recordId,current:{version:again?.version||0,envelope:again?.encrypted_payload||null,deleted:!!again?.deleted}}};}
   else{await DB.prepare('INSERT INTO changes (trip_id,record_id,version,encrypted_payload,deleted,changed_at,kind) VALUES (?,?,?,?,?,?,?)').bind(tripId,m.recordId,version,payload,deleted,ts,m.kind).run();result={ack:{mutationId:m.mutationId,recordId:m.recordId,version}};}
  }
  await DB.prepare('INSERT OR IGNORE INTO mutation_receipts (trip_id,member_id,mutation_id,request_hash,response_json,created_at) VALUES (?,?,?,?,?,?)').bind(tripId,member.id,m.mutationId,hash,JSON.stringify(result),now()).run();
  (result.conflict?conflicts:acks).push(result.conflict||result.ack);
 }
 const rows=await DB.prepare('SELECT sequence,record_id,version,encrypted_payload,deleted,kind FROM changes WHERE trip_id=? AND sequence>? ORDER BY sequence LIMIT ?').bind(tripId,since,PAGE+1).all();
 const list=rows.results||[],hasMore=list.length>PAGE,page=list.slice(0,PAGE);
 await DB.prepare('UPDATE members SET last_seen_at=? WHERE id=?').bind(now(),member.id).run();
 return json({protocol:1,acks,conflicts,errors,changes:page.map(c=>({sequence:c.sequence,recordId:c.record_id,kind:c.kind||'place',version:c.version,envelope:c.encrypted_payload,deleted:!!c.deleted})),cursor:page.length?page[page.length-1].sequence:since,hasMore,serverTime:now()});
}
async function digestHex(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
