import {cleanPlace,cleanVote,SCHEMA,BACKUP_SCHEMAS,validateRate,text,validDate} from './domain.js';
import {validateChecklistRecord,restorableChecklist} from './checklist.js';
import {validEnvelope} from './crypto.js';
const NAME='seoul-pocket';let opening;
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function complete(tx){const done=new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Storage failed.'));tx.onabort=()=>reject(tx.error||new Error('Storage was not changed.'));});done.catch(()=>{});return done;}
export function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('Local storage is unavailable. Use normal Safari, not a private session.'));return;}
  const r=indexedDB.open(NAME,SCHEMA);
  r.onupgradeneeded=()=>{for(const s of ['places','meta','photos','conflicts','votes'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'});if(!r.result.objectStoreNames.contains('outbox'))r.result.createObjectStore('outbox',{keyPath:'mutationId'});};
  r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};r.onblocked=()=>{opening=null;reject(new Error('Close other Seoul Pocket tabs and reopen.'));};
 });return opening;
}
export async function all(store='places'){const d=await database();return request(d.transaction(store).objectStore(store).getAll());}
export async function getMeta(id){const d=await database();return (await request(d.transaction('meta').objectStore('meta').get(id)))?.value;}
/** One transaction for every meta key. A screen refresh reads seven named keys plus one per checklist item; separately that is 26 transactions. */
export async function metaAll(){const d=await database();const rows=await request(d.transaction('meta').objectStore('meta').getAll());return new Map(rows.map(r=>[r.id,r.value]));}
export async function setMeta(id,value){const d=await database(),tx=d.transaction('meta','readwrite'),done=complete(tx);tx.objectStore('meta').put({id,value});await done;announce();}
/** Atomic first-use insert. Never overwrites an existing vault, including one from another tab. */
export async function setMetaIfAbsent(id,value){const d=await database(),tx=d.transaction('meta','readwrite'),done=complete(tx),store=tx.objectStore('meta'),existing=await request(store.get(id));if(!existing)store.put({id,value});await done;if(!existing)announce();return !existing;}
export async function photo(id){const d=await database();return request(d.transaction('photos').objectStore('photos').get(id));}
export async function savePlace(raw,expectedRev=0,newPhoto=null,mutation=null){
 const p=cleanPlace(raw),d=await database(),tx=d.transaction(['places','photos','outbox'],'readwrite'),done=complete(tx),store=tx.objectStore('places');
 const existing=await request(store.get(p.id));
 if((existing?.rev||0)!==expectedRev){tx.abort();await done.catch(()=>{});throw new Error('This item changed in another tab. Close this form and open it again; your newer saved copy is safe.');}
 p.rev=expectedRev+1;p.updatedAt=new Date().toISOString();
 if(existing){p.serverVersion=existing.serverVersion||0;}
 if(mutation){p.dirty=true;const ob=tx.objectStore('outbox');for(const m of await request(ob.getAll()))if(m.recordId===p.id)ob.delete(m.mutationId);ob.put({...mutation,recordId:p.id,rev:p.rev,queuedAt:p.updatedAt});}
 if(newPhoto)tx.objectStore('photos').put(newPhoto);
 if(existing?.photoId && existing.photoId!==p.photoId)tx.objectStore('photos').delete(existing.photoId);
 store.put(p);await done;announce();return p;
}
export async function deletePlace(id,expectedRev,mutation=null){
 const d=await database(),tx=d.transaction(['places','photos','outbox','conflicts'],'readwrite'),done=complete(tx),s=tx.objectStore('places'),p=await request(s.get(id));
 if(!p||p.rev!==expectedRev){tx.abort();await done.catch(()=>{});throw new Error('This item changed. Reopen it before deleting.');}
 s.delete(id);if(p.photoId)tx.objectStore('photos').delete(p.photoId);tx.objectStore('conflicts').delete(id);
 // A create whose response was lost leaves serverVersion 0 while the server already holds the record, so a queued-but-unacked
 // create is also grounds for queuing the delete. Without it the server keeps pushing the record back forever.
 const ob=tx.objectStore('outbox');let hadPending=false;
 for(const m of await request(ob.getAll()))if(m.recordId===id){hadPending=true;ob.delete(m.mutationId);}
 if(mutation&&((p.serverVersion||0)>0||hadPending))ob.put({...mutation,recordId:id,rev:p.rev,queuedAt:new Date().toISOString()});
 await done;announce();
}
export async function snapshot(){const d=await database(),tx=d.transaction(['places','meta','photos'],'readonly'),done=complete(tx);const [places,meta,photos]=await Promise.all(['places','meta','photos'].map(s=>request(tx.objectStore(s).getAll())));await done;return {schema:SCHEMA,exportedAt:new Date().toISOString(),places,meta,photos};}
export function validateSnapshot(s){
 if(!s||!BACKUP_SCHEMAS.includes(s.schema)||!Array.isArray(s.places)||s.places.length>1000||!Array.isArray(s.photos)||s.photos.length>1000||!Array.isArray(s.meta)||s.meta.length>50)throw new Error('Unsupported or oversized backup.');
 const ids=new Set();for(const p of s.places){cleanPlace(p);if(ids.has(p.id))throw new Error('Duplicate item in backup.');ids.add(p.id);}
 const photos=new Set();for(const p of s.photos){if(typeof p.id!=='string'||photos.has(p.id)||!(p.blob instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(p.blob.type)||p.blob.size>1024*1024)throw new Error('Invalid backup photo.');photos.add(p.id);}
 for(const p of s.places)if(p.photoId&&!photos.has(p.photoId))throw new Error('A photo is missing from the backup.');
 for(const m of s.meta){if(m.id==='stay')validEnvelope(m.value,'stay');if(m.id==='rate')validateRate(m.value);if(typeof m.id==='string'&&m.id.startsWith('check:'))validateChecklistRecord(m.id,m.value);}
 return s;
}
/** Restores as new copies. Never overwrites existing places or an existing stay vault. */
export async function restoreCopies(s){
 validateSnapshot(s);const d=await database();
 // The trip is read before the write transaction opens. Sealing an envelope is a non-IndexedDB await and Safari auto-commits a
 // live transaction across one, so the caller queues the outbox entries from the returned copies after this resolves.
 const shared=!!((await request(d.transaction('meta').objectStore('meta').get('trip')))?.value);
 const tx=d.transaction(['places','photos','meta'],'readwrite'),done=complete(tx);
 const meta=tx.objectStore('meta'),currentStay=await request(meta.get('stay')),mapping=new Map(),copies=[];
 for(const p of s.photos){const id=crypto.randomUUID();mapping.set(p.id,id);tx.objectStore('photos').put({...p,id});}
 for(const p of s.places){const copy=cleanPlace({...p,id:crypto.randomUUID(),photoId:mapping.get(p.photoId)||'',rev:1,updatedAt:new Date().toISOString(),serverVersion:0,dirty:shared});tx.objectStore('places').put(copy);copies.push(copy);}
 const stay=s.meta.find(m=>m.id==='stay');if(stay&&!currentStay)meta.put(stay);
 // Restore only general preparation confirmations that are missing on the destination.
 // Device-specific tests are never imported as complete on a different phone.
 const prep=s.meta.filter(m=>typeof m.id==='string'&&m.id.startsWith('check:')&&restorableChecklist(m.id));
 const existingPrep=await Promise.all(prep.map(m=>request(meta.get(m.id))));
 prep.forEach((m,i)=>{if(!existingPrep[i])meta.put({id:m.id,value:m.value});});
 // Existing preferences/rates remain untouched; weather is not restored as current.
 await done;announce();return {count:s.places.length,copies,stayImported:!!stay&&!currentStay,staySkipped:!!stay&&!!currentStay};
}
const channel=typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('seoul-pocket-updates'):null;
function announce(){channel?.postMessage('changed');}
export function onOtherTabChange(cb){if(channel)channel.onmessage=cb;}

/* Shared-trip helpers. Every write that changes both a place and its sync bookkeeping happens in one transaction. */
export async function outboxAll(){const d=await database();return request(d.transaction('outbox').objectStore('outbox').getAll());}
export async function conflictsAll(){const d=await database();return request(d.transaction('conflicts').objectStore('conflicts').getAll());}
export async function getConflict(id){const d=await database();return request(d.transaction('conflicts').objectStore('conflicts').get(id));}
/** Applies one server acknowledgement: clears the outbox entry and, when the place has not moved on locally, marks it clean at the new version.
 * Returns a follow-up mutation request when the place was edited again while the request was in flight. */
export async function applyAck(ack){
 const d=await database(),tx=d.transaction(['places','outbox','votes'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),outbox=tx.objectStore('outbox');
 const m=await request(outbox.get(ack.mutationId)),p=await request(places.get(ack.recordId));outbox.delete(ack.mutationId);let followUp=null,queued=false;
 if(!p&&ack.recordId.startsWith('v-')){const v=await request(tx.objectStore('votes').get(ack.recordId));if(v){v.serverVersion=ack.version;tx.objectStore('votes').put(v);}await done;return null;}
 for(const o of await request(outbox.getAll()))if(o.recordId===ack.recordId&&o.mutationId!==ack.mutationId){o.baseVersion=ack.version;outbox.put(o);queued=true;}
 if(p){p.serverVersion=ack.version;if(queued||(m&&p.rev===m.rev)){p.dirty=queued;}else{p.dirty=true;followUp={recordId:p.id,baseVersion:ack.version,place:p};}places.put(p);}
 await done;return followUp;
}
/** Records a conflict: the local copy stays untouched and dirty; the outbox entry is removed so it stops retrying. */
export async function applyConflict(conflict,remotePlace){
 const d=await database(),tx=d.transaction(['places','outbox','conflicts','votes'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 if(conflict.recordId.startsWith('v-')){const ob=tx.objectStore('outbox'),m=await request(ob.get(conflict.mutationId));ob.delete(conflict.mutationId);if(m&&!conflict.current.deleted){ob.put({...m,mutationId:crypto.randomUUID(),baseVersion:conflict.current.version});}const v=await request(tx.objectStore('votes').get(conflict.recordId));if(v){v.serverVersion=conflict.current.version;tx.objectStore('votes').put(v);}await done;return;}
 const ob=tx.objectStore('outbox'),losing=await request(ob.get(conflict.mutationId));ob.delete(conflict.mutationId);
 const p=await request(places.get(conflict.recordId)),at=new Date().toISOString();
 if(p){p.conflict=true;places.put(p);tx.objectStore('conflicts').put({id:conflict.recordId,version:conflict.current.version,deleted:!!conflict.current.deleted,remote:remotePlace,seenAt:at});}
 else if(losing?.op==='delete'&&!conflict.current.deleted&&remotePlace){
  // A local delete lost the race, so the shared copy comes back and waits for a decision instead of vanishing.
  // dirty:true is bookkeeping, not a claim that the content differs. applyChanges keys its do-not-overwrite path on p.dirty,
  // so dirty:false would let a later remote change write conflict:false while the conflicts row survives and the counter sticks.
  places.put(cleanPlace({...remotePlace,id:conflict.recordId,photoId:'',rev:1,updatedAt:at,serverVersion:conflict.current.version,dirty:true,conflict:true}));
  tx.objectStore('conflicts').put({id:conflict.recordId,version:conflict.current.version,deleted:false,remote:remotePlace,mine:'delete',seenAt:at});
 }
 else if(!conflict.current.deleted&&remotePlace){places.put(cleanPlace({...remotePlace,id:conflict.recordId,photoId:'',rev:1,updatedAt:at,serverVersion:conflict.current.version,dirty:false}));}
 await done;announce();
}
/** Applies a page of remote changes. Clean local records follow the server; dirty ones become conflicts instead of being overwritten. */
export async function applyChanges(changes,decoded,cursor,undecryptable=[]){
 const d=await database(),tx=d.transaction(['places','conflicts','meta','photos','votes'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),conflicts=tx.objectStore('conflicts'),meta=tx.objectStore('meta'),votes=tx.objectStore('votes');
 // A record the server sends that this phone cannot decrypt or cannot clean is skipped, never thrown out of here. The cursor
 // write below sits after the loop, so one bad record would wedge every future page of incoming sync.
 // The two failures stay in separate lists all the way to the screen. A record that decrypted and then failed cleanPlace or
 // cleanVote says nothing about the group passphrase, and counting it as undecryptable tells a working phone to leave the trip.
 const skipped=new Set(undecryptable),rejected=new Set(),applied=new Set();
 for(const c of changes){
  const remote=decoded.get(c.recordId);
  if(c.kind==='vote'){if(c.deleted){votes.delete(c.recordId);applied.add(c.recordId);}else if(remote){try{votes.put(cleanVote({...remote,id:c.recordId,serverVersion:c.version}));applied.add(c.recordId);}catch{rejected.add(c.recordId);}}continue;}
  const p=await request(places.get(c.recordId));
  if(p&&(p.serverVersion||0)>=c.version)continue;
  // A lost delete waiting for a decision carries mine:'delete' on its conflicts row. A later remote change must carry that marker
  // across: without it resolveConflict rebuilds the record on both buttons and the traveler can never finish the delete.
  if(p&&p.dirty){if(!p.conflict){p.conflict=true;places.put(p);}const held=await request(conflicts.get(c.recordId)),row={id:c.recordId,version:c.version,deleted:c.deleted,remote:remote||null,seenAt:new Date().toISOString()};if(held?.mine)row.mine=held.mine;conflicts.put(row);applied.add(c.recordId);continue;}
  if(c.deleted){if(p){places.delete(p.id);if(p.photoId)tx.objectStore('photos').delete(p.photoId);}conflicts.delete(c.recordId);applied.add(c.recordId);continue;}
  if(!remote)continue;
  try{places.put(cleanPlace({...remote,id:c.recordId,photoId:p?.photoId||'',rev:(p?.rev||0)+1,updatedAt:new Date().toISOString(),serverVersion:c.version,dirty:false,conflict:false}));conflicts.delete(c.recordId);applied.add(c.recordId);}
  catch{rejected.add(c.recordId);}
 }
 let skippedIds=[],rejectedIds=[];
 const trip=(await request(meta.get('trip')))?.value;
 if(trip){
  trip.cursor=Math.max(trip.cursor||0,cursor);trip.lastSyncAt=new Date().toISOString();
  // The cursor is persisted and the skip is not, so a skipped record would otherwise be lost silently at the next launch.
  // A record moves between the two lists when its failure changes, so each loop clears the id from the list it no longer belongs to.
  const list=new Set(trip.skippedIds||[]),bad=new Set(trip.rejectedIds||[]);
  for(const id of applied){list.delete(id);bad.delete(id);}
  for(const id of skipped){list.add(id);bad.delete(id);}
  for(const id of rejected){bad.add(id);list.delete(id);}
  trip.skippedIds=skippedIds=[...list].slice(0,200);trip.rejectedIds=rejectedIds=[...bad].slice(0,200);meta.put({id:'trip',value:trip});
 }
 await done;announce();return {rejected:rejectedIds.length,skipped:skippedIds.length};
}
/** Conflict resolution. keepMine re-queues the local copy on top of the server version; useShared adopts the remote copy. */
export async function resolveConflict(id,choice,mutation){
 const d=await database(),tx=d.transaction(['places','conflicts','outbox'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),conflicts=tx.objectStore('conflicts');
 const c=await request(conflicts.get(id)),p=await request(places.get(id));conflicts.delete(id);
 if(!c){await done;return;}
 // Keeping mine on a lost delete means deleting again on top of the newer server version, not re-uploading what the traveler removed.
 let acted=false;
 if(choice==='mine'&&p&&c.mine==='delete'){places.delete(id);if(mutation&&mutation.op==='delete')tx.objectStore('outbox').put({...mutation,recordId:id,rev:p.rev,baseVersion:c.version,queuedAt:new Date().toISOString()});acted=true;}
 else if(choice==='mine'&&p){p.conflict=false;p.dirty=true;p.serverVersion=c.version;p.rev+=1;p.updatedAt=new Date().toISOString();places.put(p);if(mutation)tx.objectStore('outbox').put({...mutation,recordId:id,rev:p.rev,baseVersion:c.version,queuedAt:p.updatedAt});acted=true;}
 else if(choice==='shared'){if(c.deleted){if(p)places.delete(id);acted=true;}else if(c.remote){places.put(cleanPlace({...c.remote,id,photoId:p?.photoId||'',rev:(p?.rev||0)+1,updatedAt:new Date().toISOString(),serverVersion:c.version,dirty:false,conflict:false}));acted=true;}}
 // A decision always clears the badge. A conflict whose remote copy never decrypted has nothing to adopt, so the local copy stays
 // and the flag clears; leaving it set strands the find on "Needs a decision" with its conflicts row already deleted.
 if(!acted&&p&&p.conflict){p.conflict=false;places.put(p);}
 await done;announce();
}
export async function leaveTrip(){
 const d=await database(),tx=d.transaction(['places','meta','outbox','conflicts','votes'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 tx.objectStore('meta').delete('trip');tx.objectStore('meta').delete('tripKey');tx.objectStore('outbox').clear();tx.objectStore('conflicts').clear();tx.objectStore('votes').clear();
 const all=await request(places.getAll());for(const p of all){p.serverVersion=0;p.dirty=false;p.conflict=false;places.put(p);}
 await done;announce();
}
export async function markAllDirtyForShare(){
 const d=await database(),tx=d.transaction(['places'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 const all=await request(places.getAll());for(const p of all){p.serverVersion=0;p.dirty=true;places.put(p);}await done;return all;
}
/** Queues many outbox entries in one transaction with one getAll, so a large restore is not one full outbox scan per record. */
export async function putOutboxMany(list){
 if(!list.length)return;
 const d=await database(),tx=d.transaction('outbox','readwrite'),done=complete(tx),ob=tx.objectStore('outbox'),ids=new Set(list.map(m=>m.recordId));
 for(const o of await request(ob.getAll()))if(ids.has(o.recordId))ob.delete(o.mutationId);
 for(const m of list)ob.put(m);
 await done;
}
export async function putOutbox(m){const d=await database(),tx=d.transaction('outbox','readwrite'),done=complete(tx),ob=tx.objectStore('outbox');for(const o of await request(ob.getAll()))if(o.recordId===m.recordId)ob.delete(o.mutationId);ob.put(m);await done;}
export async function dropOutbox(mutationId){const d=await database(),tx=d.transaction('outbox','readwrite'),done=complete(tx);tx.objectStore('outbox').delete(mutationId);await done;}

/* Votes and social media attachments. */
export async function votesAll(){const d=await database();return request(d.transaction('votes').objectStore('votes').getAll());}
export async function putVote(raw,mutation){
 const v=cleanVote(raw),d=await database(),tx=d.transaction(['votes','outbox'],'readwrite'),done=complete(tx);tx.objectStore('votes').put(v);
 if(mutation){const ob=tx.objectStore('outbox');for(const m of await request(ob.getAll()))if(m.recordId===v.id)ob.delete(m.mutationId);ob.put({...mutation,recordId:v.id,rev:1,queuedAt:new Date().toISOString()});}
 await done;announce();return v;
}
/** Stores a fetched thumbnail for a place without touching its shared fields, so nothing is re-synced. */
export async function attachPhoto(placeId,photo){
 const d=await database(),tx=d.transaction(['places','photos'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),p=await request(places.get(placeId));
 if(!p){tx.abort();await done.catch(()=>{});return false;}
 if(p.photoId){tx.abort();await done.catch(()=>{});return false;}
 tx.objectStore('photos').put(photo);p.photoId=photo.id;places.put(p);await done;announce();return true;
}
export async function placesNeedingThumb(){const all=await all_();return all.filter(p=>p.media&&(p.media.thumb||p.media.image)&&!p.photoId);}
async function all_(){const d=await database();return request(d.transaction('places').objectStore('places').getAll());}
