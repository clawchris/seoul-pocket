import {json,authorize} from '../_lib/http.js';
import {normalizeTour} from '../../public/src/domain.js';
/** Korea Tourism Organization TourAPI 4.0 (English service), nearby attractions by coordinates. Server key only. */
export async function onRequestGet({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.KTO_SERVICE_KEY)return json({error:'Korea Tourism data is not configured.'},503);
 const p=new URL(request.url).searchParams,lat=Number(p.get('lat')),lng=Number(p.get('lng')),radius=Math.min(20000,Math.max(100,Number(p.get('radius'))||2000));
 if(!(lat>=31.43&&lat<=44.35&&lng>=122.37&&lng<=132))return json({error:'Coordinates must be inside Korea.'},400);
 try{
  const upstream=new URL('https://apis.data.go.kr/B551011/EngService2/locationBasedList2');
  upstream.search=new URLSearchParams({serviceKey:env.KTO_SERVICE_KEY,MobileOS:'ETC',MobileApp:'SeoulPocket',_type:'json',arrange:'E',numOfRows:'12',pageNo:'1',mapX:String(lng),mapY:String(lat),radius:String(radius)}).toString();
  const response=await fetch(upstream,{signal:AbortSignal.timeout(6000)});
  if(!response.ok)return json({error:'Korea Tourism data is unavailable right now.'},502);
  return json(normalizeTour(await response.json()));
 }catch{return json({error:'Korea Tourism data timed out or returned an invalid response.'},502);}
}
