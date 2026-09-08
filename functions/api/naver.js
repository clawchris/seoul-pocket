import {json,authorize} from '../_lib/http.js';
import {normalizeNaver} from '../../public/src/domain.js';
/** Basic local-search metadata only. No reviews, photos, hours, scraping, or cookies. */
export async function onRequestGet({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)return json({error:'Naver credentials are not configured. Manual saving still works.'},503);
 const q=new URL(request.url).searchParams.get('q')?.trim();if(!q||q.length>100)return json({error:'Enter a search of 1 to 100 characters.'},400);
 try{
  const upstream=new URL('https://openapi.naver.com/v1/search/local.json');upstream.search=new URLSearchParams({query:q,display:'5',start:'1',sort:'random'}).toString();
  const response=await fetch(upstream,{headers:{'X-Naver-Client-Id':env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':env.NAVER_CLIENT_SECRET},signal:AbortSignal.timeout(4500)});
  if(!response.ok)return json({error:'Naver is unavailable or its quota was reached. Open Naver directly or save manually.'},502);
  const body=await response.json();if(!Array.isArray(body.items))throw new Error('Invalid response');
  return json({provider:'NAVER Local Search',retrievedAt:new Date().toISOString(),items:body.items.slice(0,5).map(normalizeNaver)});
 }catch{return json({error:'Naver search timed out or returned an invalid response. Saved finds remain available.'},502);}
}
