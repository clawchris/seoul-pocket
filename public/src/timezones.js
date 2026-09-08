/** Fixed trip zones. Native Intl rules include Pacific daylight-saving changes. */
export const ZONES = Object.freeze([
  {id:'seoul',name:'Seoul',zone:'Asia/Seoul',short:'KST'},
  {id:'singapore',name:'Singapore',zone:'Asia/Singapore',short:'SGT'},
  {id:'cupertino',name:'Cupertino',zone:'America/Los_Angeles',short:'PT'}
]);
const formatters=new Map();
function zoneFor(id){const z=ZONES.find(z=>z.id===id);if(!z)throw new Error('Choose Seoul, Singapore, or Cupertino.');return z;}
function formatter(id){if(!formatters.has(id))formatters.set(id,new Intl.DateTimeFormat('en-GB',{timeZone:zoneFor(id).zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));return formatters.get(id);}
export function wallParts(instant,id){
  const date=new Date(instant);if(!Number.isFinite(date.getTime()))throw new Error('Enter a valid date and time.');
  return Object.fromEntries(formatter(id).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
export function wallInput(instant,id){const p=wallParts(instant,id);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function offsetMinutes(instant,id){const p=wallParts(instant,id),t=new Date(instant).getTime();return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(t/1000)*1000)/60000);}
export function offsetLabel(minutes){const sign=minutes>=0?'+':'−',n=Math.abs(minutes);return `UTC${sign}${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function zoneRow(instant,id){
  const z=zoneFor(id),p=wallParts(instant,id),offset=offsetMinutes(instant,id),hour=+p.hour;
  return {...z,date:`${p.year}-${p.month}-${p.day}`,time:`${hour%12||12}:${p.minute} ${hour<12?'AM':'PM'}`,wall:wallInput(instant,id),offset,offsetText:offsetLabel(offset),abbreviation:id==='cupertino'?(offset===-420?'PDT':offset===-480?'PST':'PT'):z.short};
}
/** Return zero instants for a DST gap and two for a repeated hour; never silently guess. */
export function wallToInstants(value,id){
  zoneFor(id);
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Enter both a date and a time.');
  const [y,m,d,h,min]=value.match(/\d+/g).map(Number);
  if(y<2000||y>2100||m<1||m>12||h>23||min>59)throw new Error('Choose a valid date between 2000 and 2100.');
  const nominal=Date.UTC(y,m-1,d,h,min);
  if(new Date(nominal).toISOString().slice(0,16)!==value)throw new Error('Choose a valid calendar date.');
  // Sample surrounding offsets instead of assuming a fixed UTC-8 Pacific zone.
  const offsets=new Set([-48,-24,0,24,48].map(hours=>offsetMinutes(nominal+hours*3600000,id)));
  return [...offsets].map(offset=>nominal-offset*60000).filter(t=>wallInput(t,id)===value).sort((a,b)=>a-b);
}
export function compareZones(instant,source='seoul'){
  const base=zoneRow(instant,source),dayNumber=d=>Date.parse(d+'T00:00:00Z')/86400000;
  return ZONES.map(z=>{const row=zoneRow(instant,z.id),days=dayNumber(row.date)-dayNumber(base.date);return {...row,dayDifference:days,dayLabel:days===0?'Same date':days===-1?'Previous date':days===1?'Next date':`${days>0?'+':''}${days} days`};});
}
