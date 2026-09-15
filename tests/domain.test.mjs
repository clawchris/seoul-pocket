import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPlace,safeURL,escapeHTML,parseAmount,convert,validateRate,staleRate,seoulDate,mapLinks,normalizeNaver,normalizeKakao,validDate,resolveSync} from '../public/src/domain.js';
import {PHRASES,STARTERS} from '../public/src/data.js';
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
