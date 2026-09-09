export function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
export async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export async function equalSecret(a,b){const x=await digest(a),y=await digest(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
export async function authorize(request,env){
 const configured=env.API_ACCESS_TOKEN;
 if(!configured||configured.length<32||configured.startsWith('REPLACE_'))return json({error:'Private API is not configured.'},503);
 const h=request.headers.get('Authorization')||'';if(!h.startsWith('Bearer ')||h.length>270)return json({error:'Private API access required.'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Cross-origin requests are not allowed.'},403);
 if(await equalSecret(h.slice(7),configured))return null;
 // A shared-trip member token also unlocks the proxies, so nobody on the trip needs the setup token.
 if(env.DB){const {hashToken}=await import('./trip.js');const m=await env.DB.prepare('SELECT id FROM members WHERE token_hash=? AND revoked_at IS NULL').bind(await hashToken(h.slice(7))).first();if(m)return null;}
 return json({error:'Private API access required.'},401);
}
