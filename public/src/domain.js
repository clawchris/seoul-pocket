/** Pure domain rules, shared by the UI and tests. No network or browser globals. */
export const SCHEMA = 1;
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
  return {id, name, korean:text(raw.korean,140), kind:KINDS.includes(raw.kind)?raw.kind:'place', neighborhood:text(raw.neighborhood,100), address:text(raw.address,350), note:text(raw.note,3000), links:sourceLinks.filter(Boolean).slice(0,8).map(safeURL), status:STATUSES.includes(raw.status)?raw.status:'saved', priority:!!raw.priority, date, time, lat, lng, photoId:text(raw.photoId,90), source:text(raw.source,200), checkedAt:validDate(raw.checkedAt)?raw.checkedAt:'', rev:Number.isSafeInteger(raw.rev)&&raw.rev>=0?raw.rev:0, updatedAt:text(raw.updatedAt,40)};
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
  const links=[item.place_url].map(safeURL).filter(Boolean);
  const category=strip((item.category_name||'').split('>').pop().trim());
  return {name:strip(item.place_name),korean:strip(item.place_name),address:strip(item.road_address_name||item.address_name),category,phone:strip(item.phone||''),links,lat,lng,source:'Kakao Local'};
}
export function resolveSync(local, remote) {
  if (!local) return {action:'accept-remote',record:remote};
  if (!remote) return {action:'push-local',record:local};
  if (local.dirty && local.baseVersion !== remote.version) return {action:'conflict',local,remote};
  return local.dirty ? {action:'push-local',record:local} : {action:'accept-remote',record:remote};
}
