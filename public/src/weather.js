/** A saved model forecast, never a safety alert or a live weather-station reading. */
export const WEATHER_LOCATION=Object.freeze({latitude:37.54,longitude:127.09,label:'Gwangjin-gu, Seoul',timezone:'Asia/Seoul'});
export const WEATHER_REFRESH_MS=30*60000;
const codes={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail'};
export function weatherDescription(code){return codes[code]||'Conditions unavailable';}
function numeric(n,min,max,label){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error(`Invalid weather ${label}.`);return n;}
function nullable(n,min,max,label){return n==null?null:numeric(n,min,max,label);}
function weatherCode(n){if(!Number.isInteger(n)||!(n in codes))throw new Error('Invalid weather code.');return n;}
function dateValid(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function modelTime(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!dateValid(value.slice(0,10))||+value.slice(11,13)>23||+value.slice(14)>59)throw new Error('Invalid weather time.');return value+':00+09:00';}
export function normalizeForecast(raw,now=Date.now()){
  if(!raw||raw.timezone!=='Asia/Seoul'||raw.utc_offset_seconds!==32400)throw new Error('Unexpected forecast time zone.');
  if(typeof raw.latitude!=='number'||typeof raw.longitude!=='number'||Math.abs(raw.latitude-WEATHER_LOCATION.latitude)>0.25||Math.abs(raw.longitude-WEATHER_LOCATION.longitude)>0.25)throw new Error('Unexpected forecast location.');
  if(raw.current_units?.temperature_2m!=='°C'||raw.current_units?.apparent_temperature!=='°C'||raw.current_units?.wind_speed_10m!=='km/h'||raw.hourly_units?.temperature_2m!=='°C'||raw.hourly_units?.precipitation_probability!=='%'||raw.daily_units?.temperature_2m_max!=='°C'||raw.daily_units?.temperature_2m_min!=='°C'||raw.daily_units?.precipitation_probability_max!=='%')throw new Error('Unexpected weather units.');
  const c=raw.current,d=raw.daily,h=raw.hourly;
  if(!c||!d||!h||!Array.isArray(d.time)||d.time.length<1||d.time.length>7||!Array.isArray(h.time)||h.time.length>192)throw new Error('Incomplete weather forecast.');
  const mt=modelTime(c.time);
  const current={time:mt,temperatureC:numeric(c.temperature_2m,-90,65,'temperature'),feelsC:nullable(c.apparent_temperature,-110,85,'feels-like'),windKph:nullable(c.wind_speed_10m,0,450,'wind'),code:weatherCode(c.weather_code)};
  const daily=d.time.map((date,i)=>{if(!dateValid(date))throw new Error('Invalid forecast date.');const minC=numeric(d.temperature_2m_min?.[i],-90,65,'low'),maxC=numeric(d.temperature_2m_max?.[i],-90,65,'high');if(minC>maxC)throw new Error('Invalid forecast range.');return {date,minC,maxC,code:weatherCode(d.weather_code?.[i]),rainPct:nullable(d.precipitation_probability_max?.[i],0,100,'rain probability')};});
  const hourly=h.time.map((value,i)=>({time:modelTime(value),temperatureC:numeric(h.temperature_2m?.[i],-90,65,'hourly temperature'),rainPct:nullable(h.precipitation_probability?.[i],0,100,'rain probability'),code:weatherCode(h.weather_code?.[i])})).filter(row=>Date.parse(row.time)>=Date.parse(mt)).slice(0,12);
  return validateForecast({v:1,location:WEATHER_LOCATION.label,timezone:'Asia/Seoul',source:'Open-Meteo',fetchedAt:new Date(now).toISOString(),current,daily,hourly},now);
}
export function validateForecast(f,now=Date.now()){
  if(!f||f.v!==1||f.location!==WEATHER_LOCATION.label||f.timezone!=='Asia/Seoul'||f.source!=='Open-Meteo')throw new Error('Invalid saved forecast.');
  const fetched=Date.parse(f.fetchedAt),model=Date.parse(f.current?.time);
  if(!Number.isFinite(fetched)||!Number.isFinite(model)||fetched>now+300000||model>now+2*3600000||!f.current.time.endsWith('+09:00'))throw new Error('Invalid forecast timestamp.');
  const c=f.current;numeric(c.temperatureC,-90,65,'temperature');nullable(c.feelsC,-110,85,'feels-like');nullable(c.windKph,0,450,'wind');weatherCode(c.code);
  if(!Array.isArray(f.daily)||f.daily.length<1||f.daily.length>7||!Array.isArray(f.hourly)||f.hourly.length>12)throw new Error('Invalid forecast length.');
  let prev='';for(const d of f.daily){if(!dateValid(d.date)||d.date<=prev)throw new Error('Invalid daily forecast dates.');prev=d.date;numeric(d.minC,-90,65,'low');numeric(d.maxC,-90,65,'high');if(d.minC>d.maxC)throw new Error('Invalid forecast range.');nullable(d.rainPct,0,100,'rain');weatherCode(d.code);}
  let prior=-Infinity;for(const h of f.hourly){const t=Date.parse(h.time);if(!Number.isFinite(t)||!h.time.endsWith('+09:00')||t<=prior)throw new Error('Invalid hourly timestamp.');prior=t;numeric(h.temperatureC,-90,65,'hourly temperature');nullable(h.rainPct,0,100,'rain');weatherCode(h.code);}
  // Copy only the fields the client is allowed to store and display.
  return {v:1,location:WEATHER_LOCATION.label,timezone:'Asia/Seoul',source:'Open-Meteo',fetchedAt:f.fetchedAt,current:{time:c.time,temperatureC:c.temperatureC,feelsC:c.feelsC,windKph:c.windKph,code:c.code},daily:f.daily.map(({date,minC,maxC,code,rainPct})=>({date,minC,maxC,code,rainPct})),hourly:f.hourly.map(({time,temperatureC,rainPct,code})=>({time,temperatureC,rainPct,code}))};
}
export function forecastState(f,now=Date.now()){
  if(!f)return {missing:true,stale:true,expired:false,ageMinutes:null};
  const age=Math.max(now-Date.parse(f.fetchedAt),now-Date.parse(f.current.time));
  return {missing:false,stale:age>90*60000,expired:age>6*3600000,ageMinutes:Math.max(0,Math.floor(age/60000))};
}
export function formatTemperature(c,unit='C'){if(c==null||!Number.isFinite(c))return 'Unavailable';return `${Math.round(unit==='F'?c*9/5+32:c)}°${unit==='F'?'F':'C'}`;}
