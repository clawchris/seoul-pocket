/** Minimal IndexedDB stand-in for node, the same bargain tests/_d1.mjs makes for D1: enough of the API for public/src/db.js and
 * nothing more. Object stores keyed by keyPath, get/getAll/put/delete/clear, and transactions that buffer their writes and commit
 * on a timer, so oncomplete lands after every awaited request the way a live transaction does. Not a complete IndexedDB: no
 * indexes, no cursors, no key ranges, no versionchange blocking, no structured key ordering beyond insertion order.
 * Three divergences from live IndexedDB that a test written here will not survive on a phone.
 * Two readwrite transactions open on the same store do not serialise. Real IndexedDB queues the second behind the first and runs
 * them one at a time; this one lets their reads and writes interleave, and whichever commits last wins the keys it touched. A
 * test whose expected result depends on write ordering between two open transactions passes here and fails in Safari.
 * tx.onerror never fires. Only oncomplete and onabort do, so nothing here exercises the transaction error path in db.js.
 * tests/_d1.mjs batch() is a sequential loop over run(), not one atomic batch. A statement that fails partway through leaves the
 * earlier ones applied, so no test against either stand-in can show that a real D1 batch rolls back. */
const clone=v=>v===undefined?undefined:structuredClone(v);
function transaction(rec,names,mode){
 const overlays=new Map();let pending=0,state='active';
 // Touching a transaction after it has committed used to leave the caller awaiting a request that never settled, which is a hang
 // with no stack and no message. It throws instead, saying what arrived late and what to do about it.
 const tooLate=(name,what)=>new Error(name+': '+what+' after this transaction was '+state+'. A tests/_idb.mjs transaction commits as soon as every request it issued has settled, so work queued behind an await on the last request arrives after the commit. Open a new transaction for it.');
 const tx={mode,error:null,oncomplete:null,onerror:null,onabort:null,
  abort(){if(state!=='active')return;state='aborted';setTimeout(()=>tx.onabort?.(),0);},
  objectStore(name){
   if(state!=='active')throw tooLate('InvalidStateError','objectStore('+JSON.stringify(name)+') was called');
   if(!names.includes(name))throw new Error('NotFoundError: '+name+' is not in this transaction.');
   const store=rec.stores.get(name);if(!store)throw new Error('NotFoundError: no object store '+name+'.');
   if(!overlays.has(name))overlays.set(name,{ops:new Map(),cleared:false});
   return facade(store,overlays.get(name));
  }};
 // A request settles on its own timer, so every microtask the caller queues off the previous one runs before the commit check.
 function settle(read){
  pending++;const r={result:undefined,error:null,onsuccess:null,onerror:null};
  setTimeout(()=>{pending--;if(state!=='active'){r.error=tooLate('TransactionInactiveError','a read settled');if(!r.onerror)throw r.error;r.onerror();return;}try{r.result=read();}catch(err){r.error=err;r.onerror?.();schedule();return;}r.onsuccess?.();schedule();},0);
  return r;
 }
 function schedule(){setTimeout(()=>{
  if(state!=='active'||pending)return;state='done';
  for(const [name,o] of overlays){const s=rec.stores.get(name);if(o.cleared)s.data.clear();for(const [k,op] of o.ops)op.op==='put'?s.data.set(k,op.value):s.data.delete(k);}
  tx.oncomplete?.();
 },0);}
 function facade(store,overlay){
  const write=()=>{if(mode!=='readwrite')throw new Error('ReadOnlyError: this transaction is read-only.');if(state!=='active')throw tooLate('TransactionInactiveError','a write was issued');};
  const read=id=>{const op=overlay.ops.get(id);if(op)return op.op==='put'?clone(op.value):undefined;if(overlay.cleared)return undefined;return clone(store.data.get(id));};
  const readAll=()=>{const out=new Map();if(!overlay.cleared)for(const [k,v] of store.data)out.set(k,v);for(const [k,op] of overlay.ops)op.op==='put'?out.set(k,op.value):out.delete(k);return [...out.values()].map(clone);};
  return {
   get:id=>settle(()=>read(id)),
   getAll:()=>settle(()=>readAll()),
   put(value){write();const key=value?.[store.keyPath];if(typeof key!=='string'&&typeof key!=='number')throw new Error('DataError: no '+store.keyPath+' on the stored value.');overlay.ops.set(key,{op:'put',value:clone(value)});return settle(()=>key);},
   delete(id){write();overlay.ops.set(id,{op:'delete'});return settle(()=>undefined);},
   clear(){write();overlay.cleared=true;overlay.ops.clear();return settle(()=>undefined);},
  };
 }
 schedule();
 return tx;
}
function connection(rec){
 return {onversionchange:null,close(){},
  objectStoreNames:{contains:n=>rec.stores.has(n)},
  createObjectStore(name,options={}){const store={keyPath:options.keyPath,data:new Map()};rec.stores.set(name,store);return store;},
  transaction(names,mode='readonly'){return transaction(rec,Array.isArray(names)?names:[names],mode);}};
}
/** Replaces globalThis.indexedDB with an empty one. Call it before importing a fresh copy of db.js. */
export function installIndexedDB(){
 const dbs=new Map();
 globalThis.indexedDB={open(name,version){
  const r={result:null,error:null,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};
  setTimeout(()=>{
   let rec=dbs.get(name);if(!rec){rec={version:0,stores:new Map()};dbs.set(name,rec);}
   r.result=connection(rec);
   if(version>rec.version){rec.version=version;r.onupgradeneeded?.();}
   r.onsuccess?.();
  },0);
  return r;
 }};
 return globalThis.indexedDB;
}
let instance=0;
/** db.js caches its connection in a module-level variable, so each case gets a fresh module and a fresh database. */
export async function freshDB(){installIndexedDB();return import('../public/src/db.js?case='+(++instance));}
