import {json} from '../../_lib/http.js';
import {memberFromRequest,memberFromMediaTicket} from '../../_lib/trip.js';
/** Streams a cached thumbnail, image or video from the private fetcher to a trip member. Range requests pass through so
 * <video> can seek. The browser may cache the bytes for a year; the id is a content hash of the source link. */
export async function onRequestGet({request,env,params}){
 const parts=Array.isArray(params.path)?params.path:[params.path];
 const tokenParam=new URL(request.url).searchParams.get('t');
 const auth=tokenParam?await memberFromMediaTicket(tokenParam,env):await memberFromRequest(request,env);if(auth instanceof Response)return auth;
 if(!env.FETCH_ORIGIN||!env.FETCH_SECRET)return json({error:'Link previews are not configured on this deployment.'},503);
 if(parts.length!==2||!/^[a-f0-9]{20}$/.test(parts[0])||!/^[a-z]+\.(mp4|jpg|jpeg|webp|png)$/i.test(parts[1]))return json({error:'Not found.'},404);
 const headers={'X-Fetch-Secret':env.FETCH_SECRET};const range=request.headers.get('Range');if(range)headers.Range=range;
 const r=await fetch(`${env.FETCH_ORIGIN}/media/${parts[0]}/${parts[1]}`,{headers,redirect:'manual',signal:AbortSignal.timeout(60000)}).catch(()=>null);
 if(!r)return json({error:'The media service did not answer.'},504);
 if(!r.ok&&r.status!==206)return json({error:'Not found.'},r.status===404?404:502);
 const h=new Headers();for(const k of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(r.headers.get(k))h.set(k,r.headers.get(k));
 h.set('Cache-Control','private, max-age=31536000, immutable');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');
 return new Response(r.body,{status:r.status,headers:h});
}
