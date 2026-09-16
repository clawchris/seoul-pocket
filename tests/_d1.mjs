/** Minimal D1 look-alike over node:sqlite for tests. Supports prepare().bind().first()/run()/all() and batch().
 * batch() is a sequential loop over run(), not one atomic batch. A statement that throws partway through leaves the earlier ones
 * applied, so no test here can show that a real D1 batch rolls back. tests/_idb.mjs carries the same note for the same reason. */
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function fakeD1(){
 const db=new DatabaseSync(':memory:');
 const wrap=(sql,args)=>({
  first:async()=>db.prepare(sql).get(...args)??null,
  run:async()=>{const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},
  all:async()=>({results:db.prepare(sql).all(...args)}),
 });
 return {
  prepare:sql=>({...wrap(sql,[]),bind:(...args)=>wrap(sql,args)}),
  batch:async list=>{const out=[];for(const s of list)out.push(await s.run());return out;},
  exec:sql=>db.exec(sql),
 };
}
export function migrated(){const d=fakeD1();for(const f of ['0001_shared_trip.sql','0002_invite_uses.sql','0003_record_kinds.sql'])d.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));return d;}
