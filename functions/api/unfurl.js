import {json} from '../_lib/http.js';
import {memberFromRequest,readJSON,badJSON} from '../_lib/trip.js';
/** Turns a social link into a find: forwards to the private fetcher (yt-dlp on the owner's box) and returns its metadata.
 * Members only; the fetcher origin and secret never reach the browser. */
const HOSTS=/^(?:[a-z0-9-]+\.)*(?:tiktok\.com|instagram\.com|youtube\.com|youtu\.be|naver\.com|x\.com|twitter\.com)$/;
const SITES=[[/tiktok\.com$/,'TikTok'],[/instagram\.com$/,'Instagram'],[/youtube\.com$|youtu\.be$/,'YouTube'],[/naver\.com$/,'Naver'],[/x\.com$|twitter\.com$/,'X']];
/** The fetcher labels a failure with a code; only the code crosses over, never its error text, which carries paths and yt-dlp output.
 * gone: the site itself says the post is removed or private. broken: the post is live but this server cannot open it. */
async function failure(r,host){
 const code=(await r.json().catch(()=>null))?.code,site=(SITES.find(([re])=>re.test(host))||[,'the site'])[1];
 if(code==='gone')return json({error:`This post was removed or is private on ${site}.`},404);
 if(code==='broken')return json({error:`Seoul Pocket cannot open ${site} posts right now. Tell Chris, the post itself is fine.`},502);
 return json({error:'The link could not be read.'},r.status===400?400:502);
}
export async function onRequestPost({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;
 if(!env.FETCH_ORIGIN||!env.FETCH_SECRET)return json({error:'Link previews are not configured on this deployment.'},503);
 const body=await readJSON(request,4096);if(!body)return badJSON();
 const url=String(body.url||'').trim();if(!/^https:\/\/\S{8,600}$/.test(url))return json({error:'Paste a full https link.'},400);
 let host;try{const u=new URL(url);if(u.username||u.password||u.port)throw 0;host=u.hostname.toLowerCase();}catch{return json({error:'Paste a full https link.'},400);}
 if(!HOSTS.test(host))return json({error:'That site is not supported. Paste a TikTok, Instagram, YouTube, Naver or X link.'},400);
 try{
  const r=await fetch(env.FETCH_ORIGIN+'/unfurl',{method:'POST',headers:{'Content-Type':'application/json','X-Fetch-Secret':env.FETCH_SECRET},body:JSON.stringify({url}),redirect:'manual',signal:AbortSignal.timeout(150000)});
  if(!r.ok)return failure(r,host);
  const data=await r.json().catch(()=>null);if(!data)return json({error:'The link could not be read.'},502);
  return json({id:data.id,provider:data.provider,author:data.author,caption:data.caption,title:data.title,durationS:data.durationS,kind:data.kind,width:data.width,height:data.height,thumb:data.thumb?`/api/media/${data.id}/${data.thumb.split('/').pop()}`:'',video:data.video?`/api/media/${data.id}/video.mp4`:'',image:data.image?`/api/media/${data.id}/${data.image.split('/').pop()}`:'',url:data.url});
 }catch{return json({error:'The link service did not answer in time. Try again in a minute.'},504);}
}
