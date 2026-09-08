import {json,authorize} from '../_lib/http.js';
import {normalizeKakao} from '../../public/src/domain.js';
/** Basic place metadata from Kakao Local keyword search. No reviews, photos, hours, scraping, or cookies.
 * Kakao replaced Naver here on 2026-09-08: NAVER API Hub needs a Naver Cloud Platform account that the owner
 * cannot open. Kakao Local is free (100k calls/day) with a Kakao account and an app on developers.kakao.com.
 * Secret: KAKAO_REST_API_KEY (App > Platform Key > REST API key). Enable Kakao Map in the app's Usage settings. */
export async function onRequestGet({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.KAKAO_REST_API_KEY)return json({error:'Place search credentials are not configured. Manual saving still works.'},503);
 const q=new URL(request.url).searchParams.get('q')?.trim();if(!q||q.length>100)return json({error:'Enter a search of 1 to 100 characters.'},400);
 try{
  const upstream=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');upstream.search=new URLSearchParams({query:q,size:'5',page:'1',sort:'accuracy'}).toString();
  const response=await fetch(upstream,{headers:{Authorization:'KakaoAK '+env.KAKAO_REST_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(4500)});
  if(!response.ok)return json({error:'Place search is unavailable or its quota was reached. Open Naver directly or save manually.'},502);
  const body=await response.json();if(!Array.isArray(body.documents))throw new Error('Invalid response');
  return json({provider:'Kakao Local',retrievedAt:new Date().toISOString(),items:body.documents.slice(0,5).map(normalizeKakao)});
 }catch{return json({error:'Place search timed out or returned an invalid response. Saved finds remain available.'},502);}
}
