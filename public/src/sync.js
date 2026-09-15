/** Shared-trip sync client. Records are sealed on the phone with a key derived from the group passphrase; the server only ever
 * sees ciphertext, versions and tombstones. Nothing local is overwritten by the server: a dirty local copy that loses a version
 * race becomes a conflict the traveler resolves by hand. */
import * as db from './db.js';
import {deriveTripKey,sealShared,openShared,tripAAD,b64} from './crypto.js';
import {cleanPlace,cleanVote} from './domain.js';

const SHARED_FIELDS=['name','korean','kind','status','neighborhood','address','note','links','lat','lng','date','time','priority','source','checkedAt','media','sharedBy'];
const VOTE_FIELDS=['placeId','name','vote','at'];
export const status={busy:false,error:'',pending:0,conflicts:0,lastSyncAt:'',signedOut:false,changedAt:0,runs:0,undecryptable:0};
const listeners=new Set();
export function onChange(cb){listeners.add(cb);return()=>listeners.delete(cb);}
function emit(){for(const cb of listeners)cb(status);}

export async function trip(){return (await db.getMeta('trip'))||null;}
async function key(){const k=await db.getMeta('tripKey');if(!k)throw new Error('This phone has no trip key. Leave the shared trip and join again.');return k;}
function shareable(p){const out={};for(const f of SHARED_FIELDS)out[f]=p[f];return out;}
export function parseInvite(raw){const s=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');const m=/^([A-F0-9]{16})[-:]?([A-Z0-9]{8})$/.exec(s);return m?{tripId:m[1].toLowerCase(),code:m[2]}:null;}
export const inviteText=t=>t?.invite?`${t.tripId}-${t.invite.code}`:'';

async function api(path,body,token,method='POST'){
 const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 const res=await fetch(path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data;try{data=await res.json();}catch{throw new Error('The shared-trip service did not answer. Check the connection and the deployment.');}
 if(!res.ok){const err=new Error(data.error||'Shared trip request failed.');err.status=res.status;throw err;}
 return data;
}

/** Builds the outbox entry for a local write. Returns null when this phone is not in a shared trip, so local-only use is unchanged. */
export async function mutationFor(record,op='put',kind='place'){
 const t=await trip();if(!t)return null;
 const k=await key(),p=kind==='vote'?cleanVote(record):cleanPlace(record);
 const m={mutationId:crypto.randomUUID(),kind,op,baseVersion:p.serverVersion||0};
 const body=kind==='vote'?Object.fromEntries(VOTE_FIELDS.map(f=>[f,p[f]])):shareable(p);
 if(op==='put')m.envelope=await sealShared(body,k,tripAAD(t.tripId,p.id,kind));
 return m;
}

export async function createTrip({name,memberName,passphrase}){
 const salt=b64(crypto.getRandomValues(new Uint8Array(24)));
 const k=await deriveTripKey(passphrase,salt);
 const created=await api('/api/trip/create',{name,salt,memberName});
 await adopt(created,k,memberName);
 return created;
}
export async function joinTrip({invite,memberName,passphrase}){
 const parsed=parseInvite(invite);if(!parsed)throw new Error('Paste the invite exactly as shared: 16 characters, a dash, then the 8-character code.');
 const joined=await api('/api/trip/join',{...parsed,memberName});
 const k=await deriveTripKey(passphrase,joined.salt);
 await adopt(joined,k,memberName);
 return joined;
}
async function adopt(t,k,memberName){
 await db.setMeta('tripKey',k);
 await db.setMeta('trip',{tripId:t.tripId,name:t.name,role:t.role,salt:t.salt,memberToken:t.memberToken,memberName,invite:t.invite||null,cursor:0,lastSyncAt:'',joinedAt:new Date().toISOString(),deviceId:crypto.randomUUID().replace(/-/g,'').slice(0,12)});
 // Everything already on this phone is offered to the group. Photos stay local.
 const all=await db.markAllDirtyForShare();
 for(const p of all){const m=await mutationFor(p,'put');await db.putOutbox({...m,recordId:p.id,rev:p.rev,queuedAt:new Date().toISOString()});}
 status.signedOut=false;status.error='';
 await refreshCounts();
}
export async function rotateInvite(){
 const t=await trip();if(!t)throw new Error('Not in a shared trip.');
 const r=await api('/api/trip/invite',{},t.memberToken);
 await db.setMeta('trip',{...t,invite:r.invite});return r.invite;
}
export async function members(){const t=await trip();if(!t)throw new Error('Not in a shared trip.');return api('/api/trip/invite',null,t.memberToken,'GET');}
export async function leave(){await db.leaveTrip();status.error='';status.signedOut=false;status.undecryptable=0;await refreshCounts();}

export async function refreshCounts(){
 const [o,c,t]=await Promise.all([db.outboxAll(),db.conflictsAll(),trip()]);
 status.pending=o.length;status.conflicts=c.length;status.lastSyncAt=t?.lastSyncAt||'';emit();
}

let inFlight=null,kickTimer=0;
/** Debounced trigger used after local writes, on reconnect and on foreground. */
export function kick(delay=800){clearTimeout(kickTimer);refreshCounts().catch(()=>{});kickTimer=setTimeout(()=>{syncNow().catch(()=>{});},delay);}
/** One full exchange: push the outbox (25 at a time), apply acks and conflicts, then pull and apply every remote change page. */
export function syncNow(){if(inFlight)return inFlight;inFlight=run().finally(()=>{inFlight=null;});return inFlight;}
async function run(){
 const t=await trip();if(!t)return;
 if(!navigator.onLine){await refreshCounts();return;}
 status.busy=true;status.error='';emit();
 try{
  const k=await key();let more=true,guard=0;
  while(more&&guard++<20){
   const current=await trip();if(!current)return;
   const outbox=(await db.outboxAll()).sort((a,b)=>String(a.queuedAt).localeCompare(String(b.queuedAt)));
   const batch=[],seen=new Set();
   for(const m of outbox){if(seen.has(m.recordId))continue;seen.add(m.recordId);batch.push({mutationId:m.mutationId,recordId:m.recordId,kind:m.kind||'place',op:m.op,baseVersion:m.baseVersion,envelope:m.envelope});if(batch.length===25)break;}
   const r=await api('/api/sync',{protocol:1,since:current.cursor||0,mutations:batch},current.memberToken);
   for(const ack of r.acks||[]){const follow=await db.applyAck(ack);if(follow){const m=await mutationFor(follow.place,'put');m.baseVersion=follow.baseVersion;await db.putOutbox({...m,recordId:follow.recordId,rev:follow.place.rev,queuedAt:new Date().toISOString()});}}
   for(const c of r.conflicts||[]){let remote=null;if(!c.current.deleted&&c.current.envelope){try{remote=await openShared(c.current.envelope,k,tripAAD(current.tripId,c.recordId));}catch(err){status.error=err.message;}}await db.applyConflict(c,remote);}
   for(const err of r.errors||[]){await db.dropOutbox(err.mutationId);status.error=err.error||'A change was rejected.';}
   const decoded=new Map();
   for(const c of r.changes||[]){if(c.deleted||!c.envelope)continue;try{decoded.set(c.recordId,await openShared(c.envelope,k,tripAAD(current.tripId,c.recordId,c.kind||'place')));}catch(err){status.error=err.message;status.undecryptable++;}}
   await db.applyChanges(r.changes||[],decoded,r.cursor);
   if((r.acks||[]).length||(r.conflicts||[]).length||(r.changes||[]).length)status.changedAt=Date.now();
   more=!!r.hasMore||(await db.outboxAll()).some(m=>!seen.has(m.recordId));
  }
 }catch(err){status.error=err.message;if(err.status===401)status.signedOut=true;}
 finally{status.busy=false;status.runs++;await refreshCounts();hydrateThumbs().catch(()=>{});}
}
/** Wires the automatic triggers once. Returns nothing; the UI reads `status` and subscribes with onChange. */
export function autoStart(){
 window.addEventListener('online',()=>kick(300));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick(300);});
 setInterval(()=>{if(!document.hidden&&navigator.onLine)kick(0);},45000);
 kick(0);
}

/** Social links. The fetcher runs on the owner's box; the phone only ever sees /api/media paths. */
export async function unfurl(url){
 const t=await trip();if(!t)throw new Error('Join or create a shared trip first (Trip tab). Link previews run through the trip service.');
 if(!navigator.onLine)throw new Error('Link previews need a connection. Save it by hand for now and add the link later.');
 const meta=await api('/api/unfurl',{url},t.memberToken);
 const photo=await fetchThumb(meta.thumb||meta.image,t.memberToken);
 return {meta,photo};
}
async function fetchThumb(path,token){
 if(!path)return null;
 const r=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'force-cache'});if(!r.ok)return null;
 const blob=await r.blob();if(!/^image\//.test(blob.type)||blob.size>3*1024*1024)return null;
 let width=0,height=0;try{const bmp=await createImageBitmap(blob);width=bmp.width;height=bmp.height;bmp.close();}catch{}
 return {id:crypto.randomUUID(),blob,width,height};
}
let hydrating=false;
/** Phones that received a find with a social post fetch its thumbnail once, so cards work offline afterwards. */
export async function hydrateThumbs(){
 if(hydrating||!navigator.onLine)return;hydrating=true;let changed=false;
 try{const t=await trip();if(!t)return;for(const p of await db.placesNeedingThumb()){const photo=await fetchThumb(p.media.thumb||p.media.image,t.memberToken);if(photo&&await db.attachPhoto(p.id,photo))changed=true;}}
 finally{hydrating=false;if(changed){status.changedAt=Date.now();emit();}}
}
export const mediaSrc=async path=>{const t=await trip();return t&&path?`${path}?t=${encodeURIComponent(t.memberToken)}`:'';};
export async function castVote(place,vote){
 let t=await trip();if(!t)throw new Error('Votes need a shared trip.');
 if(!t.deviceId){t={...t,deviceId:crypto.randomUUID().replace(/-/g,'').slice(0,12)};await db.setMeta('trip',t);}
 const v={id:`v-${place.id}-${t.deviceId}`,placeId:place.id,name:t.memberName||'Traveler',vote,at:new Date().toISOString()};
 const existing=(await db.votesAll()).find(x=>x.id===v.id);if(existing)v.serverVersion=existing.serverVersion||0;
 const m=await mutationFor(v,'put','vote');await db.putVote(v,m);kick(300);return v;
}
