import test from 'node:test';
import assert from 'node:assert/strict';
import {NEAR_GROUPS,NEAR_REVIEW_DATE,NEAR_ANCHOR} from '../public/src/near-stay.js';
import {cleanPlace,mapLinks,kakaoMapLinks,validDate} from '../public/src/domain.js';

const all=NEAR_GROUPS.flatMap(g=>g.places.map(p=>({...p,group:g.id})));

test('the near-stay list is a real, grouped set of places', () => {
 assert.ok(NEAR_GROUPS.length>=6);
 assert.ok(all.length>=60,'only '+all.length+' places');
 assert.ok(validDate(NEAR_REVIEW_DATE));
 assert.ok(NEAR_ANCHOR.includes('Guui'));
 for(const g of NEAR_GROUPS){assert.ok(g.id&&g.label&&g.blurb,g.id);assert.ok(g.places.length>=5,g.id+' has only '+g.places.length);}
});

test('every place sits in Gwangjin within walking distance and carries a pin', () => {
 for(const p of all){
  assert.ok(p.address.startsWith('서울 광진구'),p.name+' is outside Gwangjin: '+p.address);
  assert.ok(Number.isFinite(p.lat)&&p.lat>=31.43&&p.lat<=44.35,p.name+' has a bad latitude');
  assert.ok(Number.isFinite(p.lng)&&p.lng>=122.37&&p.lng<=132,p.name+' has a bad longitude');
  assert.ok(Number.isInteger(p.metres)&&p.metres<=2500,p.name+' is '+p.metres+' m away');
  assert.ok(p.kakao.startsWith('https://place.map.kakao.com/'),p.name+' has no Kakao page');
 }
});

test('each group is ordered nearest first', () => {
 for(const g of NEAR_GROUPS){
  const d=g.places.map(p=>p.metres);
  assert.deepEqual(d,[...d].sort((a,b)=>a-b),g.id+' is not sorted by distance');
 }
});

test('no chain outlet is presented as a local find', () => {
 const chains=['메가MGC','컴포즈','이디야','스타벅스','투썸','빽다방','김밥천국','다이소','파리바게뜨','맘스터치','올리브영','교촌','BBQ'];
 for(const p of all) for(const c of chains) assert.ok(!p.name.includes(c),p.name+' is a chain outlet');
});

test('no place duplicates another by name and address', () => {
 const keys=all.map(p=>p.name+'|'+p.address);
 assert.equal(new Set(keys).size,keys.length,'duplicate places in the list');
});

test('saving a near-stay place keeps its address and pin', () => {
 for(const p of all.slice(0,20)){
  const np=cleanPlace({id:'z'.repeat(8),name:p.name,korean:p.name,kind:'place',neighborhood:p.category,address:p.address,lat:p.lat,lng:p.lng,note:'x',links:[p.kakao],source:'near:x',checkedAt:NEAR_REVIEW_DATE});
  assert.equal(np.address,p.address);
  assert.ok(mapLinks(np).transit,p.name+' cannot build Naver directions');
  assert.ok(kakaoMapLinks(np),p.name+' cannot build a Kakao link');
 }
});

test('the list never claims a rating, a review score or checked hours', () => {
 const banned=/\b(rating|rated|stars?|review score|best|top-rated|recommended|must-visit|open(s|ing)? (at|from|daily))\b/i;
 for(const g of NEAR_GROUPS){
  assert.ok(!banned.test(g.label+' '+g.blurb),g.id+' claims a rating or hours');
  for(const p of all) assert.ok(!banned.test(p.category),p.name+' claims a rating');
 }
});
