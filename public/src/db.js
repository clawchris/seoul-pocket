import {cleanPlace,SCHEMA,validateRate,text,validDate} from './domain.js';
import {validateChecklistRecord,restorableChecklist} from './checklist.js';
import {validEnvelope} from './crypto.js';
const NAME='seoul-pocket';let opening;
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function complete(tx){const done=new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Storage failed.'));tx.onabort=()=>reject(tx.error||new Error('Storage was not changed.'));});done.catch(()=>{});return done;}
export function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('Local storage is unavailable. Use normal Safari, not a private session.'));return;}
  const r=indexedDB.open(NAME,SCHEMA);
  r.onupgradeneeded=()=>{for(const s of ['places','meta','photos'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'});};
  r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};r.onblocked=()=>{opening=null;reject(new Error('Close other Seoul Pocket tabs and reopen.'));};
 });return opening;
}
export async function all(store='places'){const d=await database();return request(d.transaction(store).objectStore(store).getAll());}
export async function getMeta(id){const d=await database();return (await request(d.transaction('meta').objectStore('meta').get(id)))?.value;}
export async function setMeta(id,value){const d=await database(),tx=d.transaction('meta','readwrite'),done=complete(tx);tx.objectStore('meta').put({id,value});await done;announce();}
/** Atomic first-use insert. Never overwrites an existing vault, including one from another tab. */
export async function setMetaIfAbsent(id,value){const d=await database(),tx=d.transaction('meta','readwrite'),done=complete(tx),store=tx.objectStore('meta'),existing=await request(store.get(id));if(!existing)store.put({id,value});await done;if(!existing)announce();return !existing;}
export async function photo(id){const d=await database();return request(d.transaction('photos').objectStore('photos').get(id));}
export async function savePlace(raw,expectedRev=0,newPhoto=null){
 const p=cleanPlace(raw),d=await database(),tx=d.transaction(['places','photos'],'readwrite'),done=complete(tx),store=tx.objectStore('places');
 const existing=await request(store.get(p.id));
 if((existing?.rev||0)!==expectedRev){tx.abort();await done.catch(()=>{});throw new Error('This item changed in another tab. Close this form and open it again; your newer saved copy is safe.');}
 p.rev=expectedRev+1;p.updatedAt=new Date().toISOString();
 if(newPhoto)tx.objectStore('photos').put(newPhoto);
 if(existing?.photoId && existing.photoId!==p.photoId)tx.objectStore('photos').delete(existing.photoId);
 store.put(p);await done;announce();return p;
}
export async function deletePlace(id,expectedRev){
 const d=await database(),tx=d.transaction(['places','photos'],'readwrite'),done=complete(tx),s=tx.objectStore('places'),p=await request(s.get(id));
 if(!p||p.rev!==expectedRev){tx.abort();await done.catch(()=>{});throw new Error('This item changed. Reopen it before deleting.');}
 s.delete(id);if(p.photoId)tx.objectStore('photos').delete(p.photoId);await done;announce();
}
export async function snapshot(){const d=await database(),tx=d.transaction(['places','meta','photos'],'readonly'),done=complete(tx);const [places,meta,photos]=await Promise.all(['places','meta','photos'].map(s=>request(tx.objectStore(s).getAll())));await done;return {schema:SCHEMA,exportedAt:new Date().toISOString(),places,meta,photos};}
export function validateSnapshot(s){
 if(!s||s.schema!==SCHEMA||!Array.isArray(s.places)||s.places.length>1000||!Array.isArray(s.photos)||s.photos.length>1000||!Array.isArray(s.meta)||s.meta.length>50)throw new Error('Unsupported or oversized backup.');
 const ids=new Set();for(const p of s.places){cleanPlace(p);if(ids.has(p.id))throw new Error('Duplicate item in backup.');ids.add(p.id);}
 const photos=new Set();for(const p of s.photos){if(typeof p.id!=='string'||photos.has(p.id)||!(p.blob instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(p.blob.type)||p.blob.size>1024*1024)throw new Error('Invalid backup photo.');photos.add(p.id);}
 for(const p of s.places)if(p.photoId&&!photos.has(p.photoId))throw new Error('A photo is missing from the backup.');
 const metaIds=new Set();for(const m of s.meta){if(!m||typeof m.id!=='string'||!m.id||m.id.length>100||metaIds.has(m.id))throw new Error('Invalid or duplicate backup metadata.');metaIds.add(m.id);if(m.id==='stay')validEnvelope(m.value,'stay');if(m.id==='rate')validateRate(m.value);if(m.id.startsWith('check:'))validateChecklistRecord(m.id,m.value);}
 return s;
}
/** Restores as new copies. Never overwrites existing places or an existing stay vault. */
export async function restoreCopies(s){
 validateSnapshot(s);const d=await database(),tx=d.transaction(['places','photos','meta'],'readwrite'),done=complete(tx);
 const meta=tx.objectStore('meta'),currentStay=await request(meta.get('stay')),mapping=new Map();
 for(const p of s.photos){const id=crypto.randomUUID();mapping.set(p.id,id);tx.objectStore('photos').put({...p,id});}
 for(const p of s.places){const copy=cleanPlace({...p,id:crypto.randomUUID(),photoId:mapping.get(p.photoId)||'',rev:1,updatedAt:new Date().toISOString()});tx.objectStore('places').put(copy);}
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
