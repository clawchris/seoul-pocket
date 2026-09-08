/** Test data only. Never copied to public/ or dist/. */
export function weatherRaw(now=Date.now()){
 const t=new Date(Math.floor(now/3600000)*3600000+9*3600000).toISOString().slice(0,16),day=t.slice(0,10);
 const hours=Array.from({length:24},(_,i)=>new Date(Date.parse(t+'Z')+i*3600000).toISOString().slice(0,16));
 const dates=Array.from({length:3},(_,i)=>new Date(Date.parse(day+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
 return {latitude:37.54,longitude:127.09,timezone:'Asia/Seoul',utc_offset_seconds:32400,current_units:{temperature_2m:'°C',apparent_temperature:'°C',wind_speed_10m:'km/h'},hourly_units:{temperature_2m:'°C',precipitation_probability:'%'},daily_units:{temperature_2m_max:'°C',temperature_2m_min:'°C',precipitation_probability_max:'%'},current:{time:t,temperature_2m:25.3,apparent_temperature:27.1,wind_speed_10m:11.8,weather_code:2},daily:{time:dates,temperature_2m_min:[20,19,20],temperature_2m_max:[28,26,27],weather_code:[2,61,3],precipitation_probability_max:[20,70,30]},hourly:{time:hours,temperature_2m:hours.map(()=>25),weather_code:hours.map(()=>2),precipitation_probability:hours.map(()=>20)}};
}
