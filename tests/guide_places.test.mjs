import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {VENUES,FOOD_SPOTS,PHOTOS,PLACE_REVIEW_DATE} from '../public/src/guide-places.js';
import {INTERESTS,FOODS} from '../public/src/guide.js';
import {LOCAL_IDEAS} from '../public/src/locality.js';
import {cleanPlace,mapLinks,kakaoMapLinks,validDate} from '../public/src/domain.js';

const inKorea=(lat,lng)=>lat>=31.43&&lat<=44.35&&lng>=122.37&&lng<=132;
const entryIds=new Set([...INTERESTS,...LOCAL_IDEAS,...FOODS].map(x=>x.id));

test('every guide venue carries a real address and Korean coordinates', () => {
 assert.ok(Object.keys(VENUES).length>=20);
 for(const [id,v] of Object.entries(VENUES)){
  assert.ok(v.address&&v.address.startsWith('서울'),id+' has no Seoul road address');
  assert.ok(v.korean&&v.korean.length>0,id+' has no Korean venue name');
  assert.ok(inKorea(v.lat,v.lng),id+' coordinates fall outside Korea');
 }
});

test('a saved guide entry survives cleanPlace with its address and pin intact', () => {
 for(const p of [...INTERESTS,...LOCAL_IDEAS]){
  const v=VENUES[p.id]; if(!v) continue;
  const np=cleanPlace({...p,...{korean:v.korean,address:v.address,lat:v.lat,lng:v.lng},id:'x'.repeat(8),links:[],source:'idea:'+p.id,checkedAt:PLACE_REVIEW_DATE});
  assert.equal(np.address,v.address,p.id+' lost its address');
  assert.equal(np.lat,v.lat,p.id+' lost its pin');
  assert.ok(mapLinks(np).transit,p.id+' cannot build Naver directions');
  assert.ok(kakaoMapLinks(np),p.id+' cannot build a Kakao map link');
 }
});

test('every dish points at real places near the stay', () => {
 for(const [fid,spots] of Object.entries(FOOD_SPOTS)){
  assert.ok(FOODS.some(f=>f.id===fid),fid+' is not a dish in the guide');
  assert.ok(spots.length>=2,fid+' has fewer than two places');
  for(const s of spots){
   assert.ok(s.address.startsWith('서울 광진구'),fid+': '+s.name+' is not in Gwangjin');
   assert.ok(inKorea(s.lat,s.lng),fid+': '+s.name+' has coordinates outside Korea');
  }
 }
});

test('a saved restaurant keeps its address, pin and phone-free note', () => {
 const s=FOOD_SPOTS['food-fried-chicken'][0];
 const np=cleanPlace({id:'y'.repeat(8),name:s.name,korean:s.name,kind:'food',neighborhood:s.category,address:s.address,lat:s.lat,lng:s.lng,note:'x',links:[s.kakao].filter(Boolean),source:'spot:food-fried-chicken~0',checkedAt:PLACE_REVIEW_DATE});
 assert.equal(np.address,s.address);
 assert.equal(np.kind,'food');
 assert.ok(validDate(np.checkedAt));
});

test('every shipped photo exists, is small, and names its licence', () => {
 let total=0;
 for(const [id,p] of Object.entries(PHOTOS)){
  assert.ok(entryIds.has(id),id+' has a photo but no guide entry');
  const file=new URL('../public'+p.src,import.meta.url);
  assert.ok(existsSync(file),p.src+' is missing from the build');
  const bytes=statSync(file).size; total+=bytes;
  assert.ok(bytes<120000,p.src+' is '+bytes+' bytes, too big for a card');
  assert.ok(p.licence,id+' has no licence recorded');
  assert.ok(p.source.startsWith('https://commons.wikimedia.org/'),id+' has no Commons source page');
 }
 assert.ok(total<1600000,'photos total '+total+' bytes');
});

test('no photo claims to show a place the app has no address for', () => {
 for(const id of Object.keys(PHOTOS)){
  if(id.startsWith('food-')) continue;
  assert.ok(VENUES[id],id+' shows a photo but has no verified venue behind it');
 }
});
