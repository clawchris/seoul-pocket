import {json} from '../_lib/http.js';
const cached=(value)=>{const r=json(value);r.headers.set('Cache-Control','public, max-age=300');return r;};
import {normalizeForecast,WEATHER_LOCATION} from '../../public/src/weather.js';
/** Public fixed-area proxy. No user GPS, address, arbitrary URL, or credentials accepted. */
export async function onRequestGet(){
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 url.search=new URLSearchParams({latitude:String(WEATHER_LOCATION.latitude),longitude:String(WEATHER_LOCATION.longitude),timezone:'Asia/Seoul',forecast_days:'3',temperature_unit:'celsius',wind_speed_unit:'kmh',current:'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',hourly:'temperature_2m,precipitation_probability,weather_code',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'}).toString();
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(4500),cf:{cacheTtl:600,cacheEverything:true}});
  if(!response.ok)throw new Error('Forecast provider unavailable');
  return cached(normalizeForecast(await response.json()));
 }catch{return json({error:'Weather could not refresh. Your last saved forecast is unchanged.'},502);}
}
