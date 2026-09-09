import {json,authorize} from '../_lib/http.js';
import {normalizeBuzz} from '../../public/src/domain.js';
/** Local buzz: how many Korean blog posts mention a place, with the latest few. Kakao (Daum) blog search, server key only. */
export async function onRequestGet({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.KAKAO_REST_API_KEY)return json({error:'Place search credentials are not configured.'},503);
 const q=new URL(request.url).searchParams.get('q')?.trim();if(!q||q.length>100)return json({error:'Enter a search of 1 to 100 characters.'},400);
 try{
  const upstream=new URL('https://dapi.kakao.com/v2/search/blog');upstream.search=new URLSearchParams({query:q,size:'5',page:'1',sort:'recency'}).toString();
  const response=await fetch(upstream,{headers:{Authorization:'KakaoAK '+env.KAKAO_REST_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(4500)});
  if(!response.ok)return json({error:'Blog search is unavailable right now.'},502);
  return json(normalizeBuzz(await response.json(),q));
 }catch{return json({error:'Blog search timed out or returned an invalid response.'},502);}
}
