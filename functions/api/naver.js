import {json,authorize} from '../_lib/http.js';
import {normalizeNaver} from '../../public/src/domain.js';
/** Basic local-search metadata only. No reviews, photos, hours, scraping, or cookies.
 * Targets NAVER API Hub on Naver Cloud Platform (launched 2026-06-25). The legacy developers.naver.com
 * endpoint stopped issuing new credentials on 2026-07-31 and its keys stop working on 2026-06-30 (2027).
 * Credentials come from NCP console > AI·NAVER API > application > Authentication information. */
export async function onRequestGet({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)return json({error:'Naver credentials are not configured. Manual saving still works.'},503);
 const q=new URL(request.url).searchParams.get('q')?.trim();if(!q||q.length>100)return json({error:'Enter a search of 1 to 100 characters.'},400);
 try{
  const upstream=new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');upstream.search=new URLSearchParams({query:q,display:'5',start:'1',sort:'random'}).toString();
  const response=await fetch(upstream,{headers:{'X-NCP-APIGW-API-KEY-ID':env.NAVER_CLIENT_ID,'X-NCP-APIGW-API-KEY':env.NAVER_CLIENT_SECRET,Accept:'application/json'},signal:AbortSignal.timeout(4500)});
  if(!response.ok)return json({error:'Naver is unavailable or its quota was reached. Open Naver directly or save manually.'},502);
  const body=await response.json();if(!Array.isArray(body.items))throw new Error('Invalid response');
  return json({provider:'NAVER Local Search',retrievedAt:new Date().toISOString(),items:body.items.slice(0,5).map(normalizeNaver)});
 }catch{return json({error:'Naver search timed out or returned an invalid response. Saved finds remain available.'},502);}
}
