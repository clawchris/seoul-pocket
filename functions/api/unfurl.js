import {json} from '../_lib/http.js';
import {memberFromRequest,readJSON,badJSON} from '../_lib/trip.js';
/** Turns a social link into a find: forwards to the private fetcher (yt-dlp on the owner's box) and returns its metadata.
 * Members only; the fetcher origin and secret never reach the browser. */
export async function onRequestPost({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;
 if(!env.FETCH_ORIGIN||!env.FETCH_SECRET)return json({error:'Link previews are not configured on this deployment.'},503);
 const body=await readJSON(request,4096);if(!body)return badJSON();
 const url=String(body.url||'').trim();if(!/^https:\/\/\S{8,600}$/.test(url))return json({error:'Paste a full https link.'},400);
 try{
  const r=await fetch(env.FETCH_ORIGIN+'/unfurl',{method:'POST',headers:{'Content-Type':'application/json','X-Fetch-Secret':env.FETCH_SECRET},body:JSON.stringify({url}),signal:AbortSignal.timeout(150000)});
  const data=await r.json().catch(()=>({error:'The link service gave an unreadable answer.'}));
  if(!r.ok)return json({error:data.error||'The link could not be read.'},r.status===400?400:502);
  return json({id:data.id,provider:data.provider,author:data.author,caption:data.caption,title:data.title,durationS:data.durationS,kind:data.kind,width:data.width,height:data.height,thumb:data.thumb?`/api/media/${data.id}/${data.thumb.split('/').pop()}`:'',video:data.video?`/api/media/${data.id}/video.mp4`:'',image:data.image?`/api/media/${data.id}/${data.image.split('/').pop()}`:'',url:data.url});
 }catch{return json({error:'The link service did not answer in time. Try again in a minute.'},504);}
}
