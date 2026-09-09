import {cleanPlace,SCHEMA,BACKUP_SCHEMAS,validateRate,text,validDate} from './domain.js';
import {validateChecklistRecord,restorableChecklist} from './checklist.js';
import {validEnvelope} from './crypto.js';
const NAME='seoul-pocket';let opening;
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function complete(tx){const done=new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Storage failed.'));tx.onabort=()=>reject(tx.error||new Error('Storage was not changed.'));});done.catch(()=>{});return done;}
export function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('Local storage is unavailable. Use normal Safari, not a private session.'));return;}
  const r=indexedDB.open(NAME,SCHEMA);
  r.onupgradeneeded=()=>{for(const s of ['places','meta','photos','conflicts'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'});if(!r.result.objectStoreNames.contains('outbox'))r.result.createObjectStore('outbox',{keyPath:'mutationId'});};
  r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};r.onblocked=()=>{opening=null;reject(new Error('Close other Seoul Pocket tabs and reopen.'));};
 });return opening;
}
export async function all(store='places'){const d=await database();return request(d.transaction(store).objectStore(store).getAll());}
export async function getMeta(id){const d=await database();return (await request(d.transaction('meta').objectStore('meta').get(id)))?.value;}
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
 const ob=tx.objectStore('outbox');for(const m of await request(ob.getAll()))if(m.recordId===id)ob.delete(m.mutationId);
 if(mutation&&(p.serverVersion||0)>0)ob.put({...mutation,recordId:id,rev:p.rev,queuedAt:new Date().toISOString()});
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
 validateSnapshot(s);const d=await database(),tx=d.transaction(['places','photos','meta'],'readwrite'),done=complete(tx);
 const meta=tx.objectStore('meta'),currentStay=await request(meta.get('stay')),mapping=new Map();
 for(const p of s.photos){const id=crypto.randomUUID();mapping.set(p.id,id);tx.objectStore('photos').put({...p,id});}
 for(const p of s.places){const copy=cleanPlace({...p,id:crypto.randomUUID(),photoId:mapping.get(p.photoId)||'',rev:1,updatedAt:new Date().toISOString(),serverVersion:0,dirty:false});tx.objectStore('places').put(copy);}
 const stay=s.meta.find(m=>m.id==='stay');if(stay&&!currentStay)meta.put(stay);
 // Restore only general preparation confirmations that are missing on the destination.
 // Device-specific tests are never imported as complete on a different phone.
 const prep=s.meta.filter(m=>typeof m.id==='string'&&m.id.startsWith('check:')&&restorableChecklist(m.id));
 const existingPrep=await Promise.all(prep.map(m=>request(meta.get(m.id))));
 prep.forEach((m,i)=>{if(!existingPrep[i])meta.put({id:m.id,value:m.value});});
 // Existing preferences/rates remain untouched; weather is not restored as current.
 await done;announce();return {count:s.places.length,stayImported:!!stay&&!currentStay,staySkipped:!!stay&&!!currentStay};
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
 const d=await database(),tx=d.transaction(['places','outbox'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),outbox=tx.objectStore('outbox');
 const m=await request(outbox.get(ack.mutationId)),p=await request(places.get(ack.recordId));outbox.delete(ack.mutationId);let followUp=null,queued=false;
 for(const o of await request(outbox.getAll()))if(o.recordId===ack.recordId&&o.mutationId!==ack.mutationId){o.baseVersion=ack.version;outbox.put(o);queued=true;}
 if(p){p.serverVersion=ack.version;if(queued||(m&&p.rev===m.rev)){p.dirty=queued;}else{p.dirty=true;followUp={recordId:p.id,baseVersion:ack.version,place:p};}places.put(p);}
 await done;return followUp;
}
/** Records a conflict: the local copy stays untouched and dirty; the outbox entry is removed so it stops retrying. */
export async function applyConflict(conflict,remotePlace){
 const d=await database(),tx=d.transaction(['places','outbox','conflicts'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 tx.objectStore('outbox').delete(conflict.mutationId);const p=await request(places.get(conflict.recordId));
 if(p){p.conflict=true;places.put(p);tx.objectStore('conflicts').put({id:conflict.recordId,version:conflict.current.version,deleted:!!conflict.current.deleted,remote:remotePlace,seenAt:new Date().toISOString()});}
 else if(!conflict.current.deleted&&remotePlace){places.put(cleanPlace({...remotePlace,id:conflict.recordId,photoId:'',rev:1,updatedAt:new Date().toISOString(),serverVersion:conflict.current.version,dirty:false}));}
 await done;announce();
}
/** Applies a page of remote changes. Clean local records follow the server; dirty ones become conflicts instead of being overwritten. */
export async function applyChanges(changes,decoded,cursor){
 const d=await database(),tx=d.transaction(['places','conflicts','meta','photos'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),conflicts=tx.objectStore('conflicts'),meta=tx.objectStore('meta');
 for(const c of changes){
  const p=await request(places.get(c.recordId)),remote=decoded.get(c.recordId);
  if(p&&(p.serverVersion||0)>=c.version)continue;
  if(p&&p.dirty){if(!p.conflict){p.conflict=true;places.put(p);}conflicts.put({id:c.recordId,version:c.version,deleted:c.deleted,remote:remote||null,seenAt:new Date().toISOString()});continue;}
  if(c.deleted){if(p){places.delete(p.id);if(p.photoId)tx.objectStore('photos').delete(p.photoId);}conflicts.delete(c.recordId);continue;}
  if(!remote)continue;
  places.put(cleanPlace({...remote,id:c.recordId,photoId:p?.photoId||'',rev:(p?.rev||0)+1,updatedAt:new Date().toISOString(),serverVersion:c.version,dirty:false,conflict:false}));conflicts.delete(c.recordId);
 }
 const trip=(await request(meta.get('trip')))?.value;if(trip){trip.cursor=Math.max(trip.cursor||0,cursor);trip.lastSyncAt=new Date().toISOString();meta.put({id:'trip',value:trip});}
 await done;announce();
}
/** Conflict resolution. keepMine re-queues the local copy on top of the server version; useShared adopts the remote copy. */
export async function resolveConflict(id,choice,mutation){
 const d=await database(),tx=d.transaction(['places','conflicts','outbox'],'readwrite'),done=complete(tx),places=tx.objectStore('places'),conflicts=tx.objectStore('conflicts');
 const c=await request(conflicts.get(id)),p=await request(places.get(id));conflicts.delete(id);
 if(!c){await done;return;}
 if(choice==='mine'&&p){p.conflict=false;p.dirty=true;p.serverVersion=c.version;p.rev+=1;p.updatedAt=new Date().toISOString();places.put(p);if(mutation)tx.objectStore('outbox').put({...mutation,recordId:id,rev:p.rev,baseVersion:c.version,queuedAt:p.updatedAt});}
 else if(choice==='shared'){if(c.deleted){if(p)places.delete(id);}else if(c.remote)places.put(cleanPlace({...c.remote,id,photoId:p?.photoId||'',rev:(p?.rev||0)+1,updatedAt:new Date().toISOString(),serverVersion:c.version,dirty:false,conflict:false}));}
 await done;announce();
}
export async function leaveTrip(){
 const d=await database(),tx=d.transaction(['places','meta','outbox','conflicts'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 tx.objectStore('meta').delete('trip');tx.objectStore('meta').delete('tripKey');tx.objectStore('outbox').clear();tx.objectStore('conflicts').clear();
 const all=await request(places.getAll());for(const p of all){p.serverVersion=0;p.dirty=false;p.conflict=false;places.put(p);}
 await done;announce();
}
export async function markAllDirtyForShare(){
 const d=await database(),tx=d.transaction(['places'],'readwrite'),done=complete(tx),places=tx.objectStore('places');
 const all=await request(places.getAll());for(const p of all){p.serverVersion=0;p.dirty=true;places.put(p);}await done;return all;
}
export async function putOutbox(m){const d=await database(),tx=d.transaction('outbox','readwrite'),done=complete(tx),ob=tx.objectStore('outbox');for(const o of await request(ob.getAll()))if(o.recordId===m.recordId)ob.delete(o.mutationId);ob.put(m);await done;}
export async function dropOutbox(mutationId){const d=await database(),tx=d.transaction('outbox','readwrite'),done=complete(tx);tx.objectStore('outbox').delete(mutationId);await done;}
