import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPlace,safeURL,escapeHTML,parseAmount,convert,validateRate,staleRate,seoulDate,mapLinks,normalizeNaver,normalizeKakao,validDate,resolveSync,mergeEditedPlace} from '../public/src/domain.js';
import {PHRASES,STARTERS} from '../public/src/data.js';
import {FOODS,DAY_PLANS,SEARCH_NAMES} from '../public/src/guide.js';
import {validateSnapshot} from '../public/src/db.js';

test('place normalization preserves Korean, strips whitespace, and bounds fields',()=>{
 const p=cleanPlace({id:'x',name:'  Test ',korean:'경복궁',links:['https://example.com/a'],note:'n'.repeat(4000)});
 assert.equal(p.name,'Test');assert.equal(p.korean,'경복궁');assert.equal(p.note.length,3000);assert.equal(p.rev,0);
});
test('places require a name and a safe identifier',()=>{assert.throws(()=>cleanPlace({id:'x',name:''}));assert.throws(()=>cleanPlace({id:'../bad',name:'yes'}));});
test('URL validation rejects scripts, data URLs, embedded credentials, and broken URLs',()=>{
 for(const s of ['javascript:alert(1)','data:text/html,bad','https://me:pw@example.com','not a URL'])assert.equal(safeURL(s),'');
 assert.equal(safeURL('https://www.tiktok.com/@user/video/123'),'https://www.tiktok.com/@user/video/123');
});
test('HTML escaping prevents markup and attribute insertion',()=>{assert.equal(escapeHTML('<img x="a">&\''),'&lt;img x=&quot;a&quot;&gt;&amp;&#39;');});
test('invalid link input is rejected instead of silently discarded',()=>assert.throws(()=>cleanPlace({id:'x',name:'A',links:'javascript:foo()'})));
test('calendar validation catches impossible dates',()=>{assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-9-7'),false);});
test('currency handles commas, decimals, and both directions',()=>{assert.equal(parseAmount('10,000'),10000);assert.equal(convert('20',1400,'USD'),28000);assert.equal(convert('28,000',1400,'KRW'),20);assert.equal(convert('0',1400,'KRW'),0);});
test('currency rejects partial, negative, huge, and exponent input',()=>{for(const s of ['12abc','-5','1e6','','Infinity','2,000,000,000,000'])assert.throws(()=>parseAmount(s));assert.throws(()=>convert('1',0));});
test('provider rate validates pair and date',()=>{const x=validateRate({base:'USD',quote:'KRW',rate:1400,date:'2026-01-01'});assert.equal(x.source,'Frankfurter');assert.throws(()=>validateRate({base:'KRW',quote:'USD',rate:1,date:'2026-01-01'}));assert.throws(()=>validateRate({base:'USD',quote:'KRW',rate:'oops',date:'2026-01-01'}));});
test('staleness is based on provider date, not fetch time',()=>{assert.equal(staleRate({date:'2026-01-01'},Date.parse('2026-01-05')),true);assert.equal(staleRate({date:'2026-01-01'},Date.parse('2026-01-02')),false);});
test('trip dates use Seoul even when it is yesterday in the US',()=>assert.equal(seoulDate(new Date('2026-09-07T16:00:00Z')),'2026-09-08'));
test('Naver links encode text and include the web app identifier',()=>{const l=mapLinks({name:'A & B',korean:'경복궁',address:'서울',lat:37.58,lng:126.97},'https://trip.example');const a=new URL(l.app);assert.equal(a.searchParams.get('appname'),'https://trip.example');assert.match(l.transit,/route\/public/);assert.equal(new URL(l.transit).searchParams.get('dlat'),'37.58');assert.equal(new URL(l.transit).searchParams.get('slat'),null);});
test('missing coordinates yield search links, not invented directions',()=>{const l=mapLinks({name:'Some cafe'});assert.equal(l.transit,'');assert.equal(l.walk,'');assert.match(l.web,/map.naver.com/);});
test('Naver scaled WGS84 normalization and legacy-coordinate rejection',()=>{const p=normalizeNaver({title:'<b>Test</b> &amp; A',mapx:'1269784000',mapy:'375665000',roadAddress:'Seoul',link:'https://example.com'});assert.equal(p.name,'Test & A');assert.equal(p.lng,126.9784);assert.equal(p.lat,37.5665);const old=normalizeNaver({mapx:'311277',mapy:'552097'});assert.equal(old.lat,null);assert.equal(old.lng,null);});
test('half coordinates and out-of-region coordinates are rejected',()=>{assert.throws(()=>cleanPlace({id:'x',name:'A',lat:37}));assert.throws(()=>cleanPlace({id:'x',name:'A',lat:0,lng:0}));});
test('sync conflict reducer never silently accepts an overwrite',()=>{const result=resolveSync({dirty:true,baseVersion:2},{version:3});assert.equal(result.action,'conflict');assert.equal(resolveSync({dirty:true,baseVersion:3},{version:3}).action,'push-local');assert.equal(resolveSync({dirty:false},{version:3}).action,'accept-remote');});
test('seed content has unique IDs and required phrase fields',()=>{assert.equal(new Set(PHRASES.map(p=>p.id)).size,PHRASES.length);assert.equal(PHRASES.length,28);for(const p of PHRASES)for(const key of ['en','ko','phonetic','roman'])assert.ok(p[key]);assert.equal(STARTERS.length,12);});
// The sheets these feed are counted by tests/user_stories.py, which needs a Playwright venv and a run against production.
// Pinning the lengths here fails a content edit in the second that produces it, on the machine that produced it.
test('guide content counts are pinned where a content edit can see them fail',()=>{assert.equal(FOODS.length,13);assert.equal(DAY_PLANS.length,8);assert.equal(SEARCH_NAMES.length,8);assert.equal(new Set(FOODS.map(f=>f.id)).size,FOODS.length);});
test('backup validation rejects unsupported versions and missing photo references',()=>{assert.throws(()=>validateSnapshot({schema:2}));assert.throws(()=>validateSnapshot({schema:1,places:[{id:'a',name:'A',photoId:'missing'}],photos:[],meta:[]}));assert.ok(validateSnapshot({schema:1,places:[],photos:[],meta:[]}));});

test('Kakao WGS84 normalization, category tail and out-of-region rejection',()=>{const p=normalizeKakao({place_name:'양꼬치',road_address_name:'서울 광진구',category_name:'음식점 > 양식 > 양꼬치',x:'127.0712',y:'37.5401',place_url:'http://place.map.kakao.com/1'});assert.equal(p.lat,37.5401);assert.equal(p.lng,127.0712);assert.equal(p.category,'양꼬치');assert.equal(p.links[0],'https://place.map.kakao.com/1');assert.equal(p.source,'Kakao Local');const far=normalizeKakao({place_name:'x',x:'-122.0',y:'37.3'});assert.equal(far.lat,null);});

test('social media attachments and votes are validated before they are stored or shared',async()=>{
 const {cleanMedia,cleanVote,cleanPlace}=await import('../public/src/domain.js');
 const m=cleanMedia({id:'563715fe5105464386d7',provider:'instagram',author:'Seoul Food',caption:'c'.repeat(700),kind:'video',durationS:7.53,thumb:'/api/media/563715fe5105464386d7/thumb.jpg',video:'/api/media/563715fe5105464386d7/video.mp4',image:'https://evil.example/x.jpg',url:'https://www.instagram.com/reel/DBhP4P8i4aj/'});
 assert.equal(m.caption.length,600);assert.equal(m.durationS,8);assert.equal(m.image,'');assert.equal(m.video,'/api/media/563715fe5105464386d7/video.mp4');
 assert.equal(cleanMedia({id:'../../etc'}),null);assert.equal(cleanPlace({id:'p1',name:'x',media:{id:'bad'}}).media,null);
 const v=cleanVote({id:'v-p1-0123456789ab',placeId:'p1',name:'Sam',vote:'in',at:'2026-09-14T00:00:00.000Z'});assert.equal(v.vote,'in');
 assert.throws(()=>cleanVote({id:'v-p2-0123456789ab',placeId:'p1',vote:'in'}),/Invalid vote/);
 assert.equal(cleanVote({id:'v-p1-0123456789ab',placeId:'p1',vote:'maybe'}).vote,'in');
});

test('a card title from a social caption is one short clause, never the whole caption',async()=>{
 const {postName}=await import('../public/src/domain.js');
 assert.equal(postName({title:'Video by seoulfoodmeatco',caption:'We don’t talk about bruno….but with this food menu, we might have to!! Introducing bruno exclusive a la carte 🍴',author:'Seoul Food Meat Company'}),'We don’t talk about bruno');
 assert.equal(postName({caption:'#seoul #foodie https://t.co/x Gwangjang market night eats are unreal and you should absolutely go there twice'}).length<=59,true);
 assert.equal(postName({caption:'   ',author:'someone'}),'someone');
 assert.equal(postName({}),'Shared post');
 assert.equal(postName({title:'Best tteokbokki in Sindang'}),'Best tteokbokki in Sindang');
});

test('trip-guide content is well formed and cannot collide with other saved ideas',async()=>{
 const g=await import('../public/src/guide.js');
 const {LOCAL_IDEAS}=await import('../public/src/locality.js');const {STARTERS}=await import('../public/src/data.js');
 const all=[...g.INTERESTS,...g.FOODS,...LOCAL_IDEAS,...STARTERS];
 assert.equal(new Set(all.map(x=>x.id)).size,all.length,'idea IDs collide across lists');
 for(const p of g.INTERESTS){assert.ok(p.name&&p.korean&&p.note&&p.tag,p.id);assert.ok(['food','place'].includes(p.kind),p.id);assert.ok(['A','B'].includes(p.tier),p.id);assert.ok(!/\bopen(s|ing)? (at|from|daily)\b|guaranteed|\bbooked\b/i.test(p.note),'no invented hours or bookings: '+p.id);}
 for(const f of g.FOODS)assert.ok(f.name&&f.korean&&f.note,f.id);
 assert.equal(new Set(g.DAY_PLANS.map(d=>d.id)).size,g.DAY_PLANS.length);
 assert.equal(g.GUIDE_DATES.start,'2026-09-28');assert.equal(g.GUIDE_DATES.end,'2026-10-05');
 // Was 8 until 2026-09-20, when Square Enix Store Seoul came out: Korean place search returns nothing for it.
 assert.ok(g.INTERESTS.filter(p=>p.tier==='A').length>=7);
 assert.ok(g.SEARCH_NAMES.every(n=>n.en&&n.ko));
});

test('an edit carries a shared find\'s media, sharer, source and server version through untouched',()=>{
 const prior={id:'rec-11111111',name:'Old name',photoId:'ph-1',priority:false,source:'Instagram',serverVersion:7,sharedBy:'Sam',media:{id:'563715fe5105464386d7',provider:'instagram',kind:'video',video:'/api/media/563715fe5105464386d7/video.mp4'}};
 const edited=mergeEditedPlace(prior,{name:'New name',note:'Sam moved it to Thursday'},{id:prior.id,priority:true});
 assert.equal(edited.name,'New name');assert.equal(edited.note,'Sam moved it to Thursday');assert.equal(edited.id,'rec-11111111');assert.equal(edited.priority,true);
 assert.deepEqual(edited.media,prior.media,'a dropped media object is a destroyed attachment on a find somebody shared');
 assert.equal(edited.sharedBy,'Sam');
 assert.equal(edited.source,'Instagram');
 assert.equal(edited.serverVersion,7,'serverVersion reset to 0 makes the next push claim baseVersion 0 on a record the server already holds, so every edit of a shared find comes back a conflict and the traveler is asked to resolve an edit they just made');
 assert.ok(cleanPlace(edited).name,'the merged record still survives normalization');
});

test('a brand-new find has no prior to carry, and falls back without inventing one',()=>{
 const fresh=mergeEditedPlace(undefined,{name:'Tteokbokki stall'},{id:'rec-22222222',formSource:'Kakao Local'});
 assert.equal(fresh.id,'rec-22222222');assert.equal(fresh.source,'Kakao Local');assert.equal(fresh.serverVersion,0);assert.equal(fresh.media,null);assert.equal(fresh.sharedBy,'');assert.equal(fresh.photoId,'');assert.equal(fresh.priority,false);
 assert.equal(mergeEditedPlace(undefined,{name:'X'},{}).id,'','no id in the options and no prior means the caller has to supply one');
 assert.equal(mergeEditedPlace({id:'rec-33333333',source:'Instagram'},{name:'X'},{formSource:'Kakao Local'}).source,'Instagram','the prior source wins over whatever the form last rendered');
 assert.equal(mergeEditedPlace({id:'rec-33333333'},{name:'X'},{}).id,'rec-33333333');
});

test('an edit keeps the existing photo unless the form replaced it or cleared it',()=>{
 const prior={id:'rec-11111111',photoId:'ph-1'};
 assert.equal(mergeEditedPlace(prior,{name:'A'},{}).photoId,'ph-1');
 assert.equal(mergeEditedPlace(prior,{name:'A'},{newPhotoId:'ph-2'}).photoId,'ph-2');
 assert.equal(mergeEditedPlace(prior,{name:'A'},{removePhoto:true}).photoId,'');
 assert.equal(mergeEditedPlace(prior,{name:'A'},{newPhotoId:'ph-2',removePhoto:true}).photoId,'ph-2','a fresh photo beats the remove checkbox the form left behind');
 assert.equal(mergeEditedPlace(undefined,{name:'A'},{removePhoto:true}).photoId,'');
});
