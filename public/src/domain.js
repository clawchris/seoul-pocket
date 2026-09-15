/** Pure domain rules, shared by the UI and tests. No network or browser globals. */
export const SCHEMA = 3;
export const BACKUP_SCHEMAS = [1,2,3];
export const STATUSES = ['saved', 'planned', 'visited', 'skipped'];
export const KINDS = ['food', 'place'];
export function text(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function safeURL(value) {
  if (!value) return '';
  try { const u = new URL(String(value)); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return ''; return u.href; } catch { return ''; }
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
const mediaPath=v=>typeof v==='string'&&/^\/api\/media\/[a-f0-9]{20}\/[a-z]+\.(mp4|jpg|jpeg|webp|png)$/i.test(v)?v:'';
/** A social post attached to a find: metadata only, files are fetched per phone. */
export function cleanMedia(raw){
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[a-f0-9]{20}$/.test(raw.id))return null;
  return {id:raw.id,provider:text(raw.provider,30),author:text(raw.author,80),caption:text(raw.caption,600),title:text(raw.title,140),kind:raw.kind==='image'?'image':'video',durationS:Number.isFinite(Number(raw.durationS))?Math.max(0,Math.round(Number(raw.durationS))):0,width:Number.isSafeInteger(raw.width)?raw.width:0,height:Number.isSafeInteger(raw.height)?raw.height:0,url:safeURL(raw.url)||'',thumb:mediaPath(raw.thumb),video:mediaPath(raw.video),image:mediaPath(raw.image)};
}
/** A card title from a social caption: the first clause, short enough to read at a glance. The full caption stays in the note. */
export function postName(meta,fallback='Shared post'){
  const titled=text(meta?.title,140),caption=text(meta?.caption,600);
  let base=titled&&!/^(video|photo|post|reel) by /i.test(titled)?titled:caption;
  base=String(base||'').replace(/https?:\/\/\S+/g,' ').replace(/#[^\s#]+/g,' ').replace(/\s+/g,' ').trim();
  const stop=base.search(/[.!?\n]|\.{3}|…/); if(stop>12)base=base.slice(0,stop);
  base=base.trim();
  if(base.length>58){const cut=base.slice(0,58);const sp=cut.lastIndexOf(' ');base=(sp>24?cut.slice(0,sp):cut).trim()+'…';}
  base=base.replace(/[\s,;:·\-]+$/,'');
  return text(base,140)||text(meta?.author,80)||fallback;
}
export function cleanVote(raw){
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^v-[a-zA-Z0-9_-]{1,90}-[a-f0-9]{12}$/.test(raw.id))throw new Error('Invalid vote.');
  const placeId=text(raw.placeId,90);if(!placeId||!raw.id.startsWith('v-'+placeId+'-'))throw new Error('Invalid vote.');
  return {id:raw.id,placeId,name:text(raw.name,40)||'Traveler',vote:raw.vote==='pass'?'pass':'in',at:validDate(String(raw.at||'').slice(0,10))?String(raw.at).slice(0,24):new Date().toISOString(),serverVersion:Number.isSafeInteger(raw.serverVersion)?raw.serverVersion:0};
}
export function cleanPlace(raw, id = raw.id) {
  const name = text(raw.name, 140); if (!name) throw new Error('Add a name first.');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(id)) throw new Error('Invalid item identifier.');
  const sourceLinks = Array.isArray(raw.links) ? raw.links : String(raw.links || '').split(/\n/);
  if (sourceLinks.filter(Boolean).some(u => !safeURL(u))) throw new Error('Use full http or https links.');
  const date = text(raw.date, 10); if (date && !validDate(date)) throw new Error('Use a valid calendar date.');
  const lat = raw.lat === '' || raw.lat == null ? null : Number(raw.lat);
  const lng = raw.lng === '' || raw.lng == null ? null : Number(raw.lng);
  if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || lat < 31.43 || lat > 44.35 || !Number.isFinite(lng) || lng < 122.37 || lng > 132))) throw new Error('Enter both coordinates within Korea, or leave both blank.');
  const time = text(raw.time,5); if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a valid time.');
  return {id, name, korean:text(raw.korean,140), kind:KINDS.includes(raw.kind)?raw.kind:'place', neighborhood:text(raw.neighborhood,100), address:text(raw.address,350), note:text(raw.note,3000), links:sourceLinks.filter(Boolean).slice(0,8).map(safeURL), status:STATUSES.includes(raw.status)?raw.status:'saved', priority:!!raw.priority, date, time, lat, lng, photoId:text(raw.photoId,90), source:text(raw.source,200), checkedAt:validDate(raw.checkedAt)?raw.checkedAt:'', rev:Number.isSafeInteger(raw.rev)&&raw.rev>=0?raw.rev:0, updatedAt:text(raw.updatedAt,40), serverVersion:Number.isSafeInteger(raw.serverVersion)&&raw.serverVersion>=0?raw.serverVersion:0, dirty:!!raw.dirty, conflict:!!raw.conflict, media:cleanMedia(raw.media), sharedBy:text(raw.sharedBy,40)};
}
export function parseAmount(value) {
  const s=String(value).trim().replaceAll(',','');
  if (!/^\d+(\.\d{0,4})?$/.test(s)) throw new Error('Enter a positive number, using a decimal point.');
  const n=Number(s); if (!Number.isFinite(n) || n>1e12) throw new Error('That amount is too large.'); return n;
}
export function convert(value, rate, from='USD') {
  const n=parseAmount(value); if (!Number.isFinite(rate) || rate<=0) throw new Error('Set or refresh the exchange rate first.');
  return from==='USD' ? n*rate : n/rate;
}
export function validateRate(raw) {
  const rate=Number(raw.rate); if (!Number.isFinite(rate) || rate<=0 || rate>100000) throw new Error('The rate provider returned an invalid rate.');
  if (raw.base !== 'USD' || raw.quote !== 'KRW' || !validDate(raw.date)) throw new Error('The rate provider returned the wrong currency or date.');
  const date=Date.parse(raw.date+'T00:00:00Z'); if (date>Date.now()+86400000) throw new Error('The rate date is in the future.');
  return {rate, base:'USD',quote:'KRW',date:raw.date,source:raw.source==='manual'?'manual':'Frankfurter',fetchedAt:new Date().toISOString()};
}
export function staleRate(rate, now=Date.now()) { return !rate || now-Date.parse(rate.date+'T00:00:00Z')>72*3600000; }
export function seoulDate(date=new Date()) { const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`; }
export function mapLinks(place, origin='https://seoul-pocket.example') {
  const query=[place.korean||place.name,place.address||place.neighborhood,'서울'].filter(Boolean).join(' ');
  const app = new URL('nmap://search'); app.searchParams.set('query',query); app.searchParams.set('appname',origin);
  const links={app:app.href,web:'https://map.naver.com/p/search/'+encodeURIComponent(query),transit:'',walk:''};
  if(Number.isFinite(place.lat)&&Number.isFinite(place.lng)) {
    for(const [key,mode] of [['transit','public'],['walk','walk']]) {
      const u=new URL('nmap://route/'+mode); u.search=new URLSearchParams({dlat:String(place.lat),dlng:String(place.lng),dname:place.korean||place.name,appname:origin}).toString();links[key]=u.href;
    }
  }
  return links;
}
export function normalizeNaver(item) {
  const strip=s=>text(s,350).replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');
  // Current Local Search returns scaled WGS84 values. Reject old KATECH examples and out-of-region values.
  let lng=Number(item.mapx)/1e7, lat=Number(item.mapy)/1e7;
  if(!(lat>=31.43&&lat<=44.35&&lng>=122.37&&lng<=132)) lat=lng=null;
  return {name:strip(item.title),korean:strip(item.title),address:strip(item.roadAddress||item.address),category:strip(item.category),links:safeURL(item.link)?[safeURL(item.link)]:[],lat,lng,source:'NAVER Local Search'};
}
export function normalizeKakao(item) {
  const strip=s=>text(s,350);
  // Kakao returns WGS84 degrees as strings: x = longitude, y = latitude. Reject out-of-region values.
  let lng=Number(item.x), lat=Number(item.y);
  if(!(lat>=31.43&&lat<=44.35&&lng>=122.37&&lng<=132)) lat=lng=null;
  const links=[item.place_url].map(u=>safeURL(String(u||'').replace(/^http:\/\//,'https://'))).filter(Boolean);
  const category=strip((item.category_name||'').split('>').pop().trim());
  return {name:strip(item.place_name),korean:strip(item.place_name),address:strip(item.road_address_name||item.address_name),category,phone:strip(item.phone||''),links,lat,lng,source:'Kakao Local'};
}
export function normalizeBuzz(raw,query){
  const docs=Array.isArray(raw?.documents)?raw.documents:[],meta=raw?.meta||{};
  const strip=s=>text(s,200).replace(/<[^>]*>/g,'').replace(/&#(x?[0-9a-f]+);/gi,(_,c)=>{const n=c[0]==='x'||c[0]==='X'?parseInt(c.slice(1),16):parseInt(c,10);return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/gi,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[k.toLowerCase()]).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');
  return {query:text(query,100),total:Number.isFinite(meta.total_count)?meta.total_count:0,retrievedAt:new Date().toISOString(),source:'Kakao blog search',
    posts:docs.slice(0,5).map(d=>({title:strip(d.title),blog:strip(d.blogname),date:typeof d.datetime==='string'?d.datetime.slice(0,10):'',url:safeURL(String(d.url||'').replace(/^http:\/\//,'https://'))})).filter(x=>x.url)};
}

export function kakaoMapLinks(place){
  if(!(Number.isFinite(place.lat)&&Number.isFinite(place.lng)))return null;
  const name=encodeURIComponent(place.korean||place.name||'');
  return {look:`kakaomap://look?p=${place.lat},${place.lng}`,route:`kakaomap://route?ep=${place.lat},${place.lng}&by=PUBLICTRANSIT`,web:`https://map.kakao.com/link/map/${name},${place.lat},${place.lng}`};
}
export function resolveSync(local, remote) {
  if (!local) return {action:'accept-remote',record:remote};
  if (!remote) return {action:'push-local',record:local};
  if (local.dirty && local.baseVersion !== remote.version) return {action:'conflict',local,remote};
  return local.dirty ? {action:'push-local',record:local} : {action:'accept-remote',record:remote};
}
