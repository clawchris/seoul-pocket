/* The four silent-data-loss fixes in public/src/db.js, exercised against tests/_idb.mjs because node has no IndexedDB. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,installIndexedDB} from './_idb.mjs';
import {SCHEMA} from '../public/src/domain.js';
const id=n=>'rec-'+String(n).padStart(8,'0');
const put=(mutationId,recordId,baseVersion=0)=>({mutationId,recordId,kind:'place',op:'put',baseVersion,envelope:'v1.a.b'});
const del=(mutationId,recordId,baseVersion=0)=>({mutationId,recordId,kind:'place',op:'delete',baseVersion});

test('a delete is queued when a create is still unacknowledged, so the server stops pushing the record back',async()=>{
 const db=await freshDB();
 // The create's response was lost: the outbox entry is still there and serverVersion never moved off 0.
 const p=await db.savePlace({id:id(1),name:'Noodle bar'},0,null,put('m1-aaaaaaaa',id(1)));
 assert.equal(p.serverVersion||0,0);assert.equal(p.dirty,true);
 assert.deepEqual((await db.outboxAll()).map(m=>m.mutationId),['m1-aaaaaaaa']);
 await db.deletePlace(p.id,p.rev,del('m2-bbbbbbbb',id(1)));
 assert.equal((await db.all()).length,0);
 const ob=await db.outboxAll();
 assert.deepEqual(ob.map(m=>[m.mutationId,m.op]),[['m2-bbbbbbbb','delete']],'the losing create was replaced by the delete, not left to recreate the record');
 // A place that never left this phone has nothing to tell the server about.
 const local=await db.savePlace({id:id(2),name:'Never shared'},0);
 await db.deletePlace(local.id,local.rev,del('m3-cccccccc',id(2)));
 assert.deepEqual((await db.outboxAll()).map(m=>m.mutationId),['m2-bbbbbbbb']);
});

test('a delete that loses the race comes back as a conflict, and keeping mine deletes again instead of re-uploading',async()=>{
 const db=await freshDB();
 const p=await db.savePlace({id:id(3),name:'Cafe'},0,null,put('m1-aaaaaaaa',id(3)));
 await db.applyAck({mutationId:'m1-aaaaaaaa',recordId:id(3),version:1});
 assert.equal((await db.all())[0].dirty,false);
 await db.deletePlace(id(3),p.rev,del('m2-bbbbbbbb',id(3),1));
 assert.equal((await db.all()).length,0);
 // Someone else edited the same record at version 2, so the delete lost and the shared copy must not vanish.
 await db.applyConflict({mutationId:'m2-bbbbbbbb',recordId:id(3),current:{version:2,deleted:false,envelope:'v1.c.d'}},{name:'Cafe',note:'Sam moved it to Thursday'});
 const [restored]=await db.all();
 assert.equal(restored.id,id(3));assert.equal(restored.note,'Sam moved it to Thursday');
 assert.equal(restored.conflict,true);assert.equal(restored.dirty,true,'dirty keeps applyChanges from overwriting it while the conflict row is open');
 assert.equal(restored.serverVersion,2);
 const c=await db.getConflict(id(3));
 assert.equal(c.mine,'delete','without mine the resolver cannot tell a lost delete from a lost edit');
 assert.equal(c.version,2);assert.equal(c.deleted,false);
 assert.equal((await db.outboxAll()).length,0,'the losing mutation stops retrying');
 await db.resolveConflict(id(3),'mine',del('m3-cccccccc',id(3)));
 assert.equal((await db.all()).length,0,'keeping mine means the traveler removed it');
 assert.deepEqual((await db.outboxAll()).map(m=>[m.op,m.baseVersion]),[['delete',2]]);
 assert.equal(await db.getConflict(id(3)),undefined);
});

test('a restored backup joins the shared trip instead of staying invisible to the group',async()=>{
 const snapshot=()=>({schema:SCHEMA,places:[{id:id(4),name:'Tteokbokki stall'},{id:id(5),name:'Bookshop'}],photos:[],meta:[]});
 const solo=await freshDB();
 const alone=await solo.restoreCopies(snapshot());
 assert.equal(alone.count,2);assert.equal(alone.copies.length,2);
 assert.ok(alone.copies.every(c=>c.dirty===false),'a solo phone has nobody to upload to');
 const shared=await freshDB();
 await shared.setMeta('trip',{tripId:'a'.repeat(16),cursor:0});
 const joined=await shared.restoreCopies(snapshot());
 assert.equal(joined.copies.length,2,'the copies come back so the caller can queue their outbox entries');
 assert.ok(joined.copies.every(c=>c.dirty===true));
 assert.ok(joined.copies.every(c=>c.serverVersion===0));
 const stored=await shared.all();
 assert.equal(stored.length,2);
 assert.ok(stored.every(p=>p.dirty===true),'the stored rows agree with the returned copies');
 assert.equal(new Set(joined.copies.map(c=>c.id)).size,2);
 assert.ok(joined.copies.every(c=>c.id!==id(4)&&c.id!==id(5)),'restores are new copies, never overwrites');
});

test('one unusable record is skipped, reported, and never wedges the change cursor',async()=>{
 const db=await freshDB();
 await db.setMeta('trip',{tripId:'a'.repeat(16),cursor:0});
 const changes=[{recordId:id(6),kind:'place',version:1,deleted:false},{recordId:id(7),kind:'place',version:2,deleted:false},{recordId:id(8),kind:'place',version:3,deleted:false}];
 const decoded=new Map([[id(6),{name:'Good one'}],[id(7),{name:''}],[id(8),{name:'Also good'}]]);
 const r=await db.applyChanges(changes,decoded,3);
 assert.equal(r.rejected,1,'the record cleanPlace refused is counted, not swallowed');
 assert.equal(r.skipped,0,'nothing here failed to decrypt');
 const trip=await db.getMeta('trip');
 assert.equal(trip.cursor,3,'the cursor advances past the bad record, so later pages still arrive');
 assert.deepEqual(trip.rejectedIds,[id(7)]);assert.deepEqual(trip.skippedIds,[]);
 assert.deepEqual((await db.all()).map(p=>p.id).sort(),[id(6),id(8)]);
 // The next page still applies, and a record that becomes readable drops off the skipped list.
 const again=await db.applyChanges([{recordId:id(7),kind:'place',version:4,deleted:false}],new Map([[id(7),{name:'Readable now'}]]),4);
 assert.equal(again.rejected,0);assert.equal(again.skipped,0);
 const after=await db.getMeta('trip');
 assert.equal(after.cursor,4);assert.deepEqual(after.skippedIds,[]);assert.deepEqual(after.rejectedIds,[]);
 assert.equal((await db.all()).length,3);
});

/* A validation failure and a decryption failure are different accidents with different remedies, and the trip screen tells the
 * traveler to leave and rejoin on the decryption one. Folding the two counts together points a working phone at that instruction. */
test('a record that decrypts but fails validation is counted as rejected and never as undecryptable',async()=>{
 const db=await freshDB();
 await db.setMeta('trip',{tripId:'a'.repeat(16),cursor:0});
 // id(9) decrypted perfectly and cleanPlace refused it. id(10) never decrypted, so sync.js passes it in as undecryptable.
 const vote='v-'+id(11)+'-0123456789ab';
 const changes=[{recordId:id(9),kind:'place',version:1,deleted:false},{recordId:id(10),kind:'place',version:2,deleted:false},{recordId:vote,kind:'vote',version:3,deleted:false}];
 const r=await db.applyChanges(changes,new Map([[id(9),{name:''}],[vote,{placeId:'not-the-one-in-the-id'}]]),3,[id(10)]);
 assert.equal(r.rejected,2,'both the place and the vote this build cannot clean are counted as rejections');
 assert.equal(r.skipped,1,'and neither is folded into the count that blames the group passphrase');
 const trip=await db.getMeta('trip');
 assert.deepEqual(trip.rejectedIds.sort(),[id(9),vote].sort());
 assert.deepEqual(trip.skippedIds,[id(10)],'only a record that failed to decrypt may reach the passphrase message');
 assert.deepEqual((await db.all()).map(p=>p.id),[]);
 // A later page that can read them clears both lists, so neither count sticks after the app is fixed.
 const again=await db.applyChanges([{recordId:id(9),kind:'place',version:4,deleted:false},{recordId:id(10),kind:'place',version:5,deleted:false}],new Map([[id(9),{name:'Readable now'}],[id(10),{name:'Decrypted now'}]]),5);
 assert.equal(again.rejected,1,'the vote is still unreadable and stays counted');
 assert.equal(again.skipped,0);
 const after=await db.getMeta('trip');
 assert.deepEqual(after.rejectedIds,[vote]);assert.deepEqual(after.skippedIds,[]);
});

/* tests/_idb.mjs used to drop a request issued after its transaction committed, leaving the caller awaiting a promise that never
 * settled. A hang gives a test author no stack and no message, so both ways of arriving late now throw. */
test('the IndexedDB stand-in refuses a read issued after its transaction committed, instead of hanging',async()=>{
 const idb=installIndexedDB();
 const open=idb.open('probe',1);
 await new Promise((resolve,reject)=>{open.onupgradeneeded=()=>open.result.createObjectStore('items',{keyPath:'id'});open.onsuccess=resolve;open.onerror=()=>reject(open.error);});
 const tx=open.result.transaction('items','readwrite'),store=tx.objectStore('items');
 await new Promise(resolve=>{tx.oncomplete=resolve;store.put({id:'a',name:'Noodle bar'});});
 assert.throws(()=>tx.objectStore('items'),/InvalidStateError.*objectStore\("items"\) was called after this transaction was done/s,'objectStore on a committed transaction names what arrived late');
 assert.throws(()=>store.put({id:'b',name:'Too late'}),/TransactionInactiveError.*a write was issued after this transaction was done/s);
 // A facade captured while the transaction was open is the way a read slips past objectStore and reaches the commit check.
 const late=store.get('a');
 await assert.rejects(new Promise((resolve,reject)=>{late.onsuccess=()=>resolve(late.result);late.onerror=()=>reject(late.error);}),/TransactionInactiveError.*a read settled after this transaction was done/s);
 const fresh=open.result.transaction('items');
 const row=await new Promise((resolve,reject)=>{const r=fresh.objectStore('items').get('a');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 assert.equal(row.name,'Noodle bar','the committed write is still there; only the late access is refused');
});
