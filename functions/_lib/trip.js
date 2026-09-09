import {json,digest} from './http.js';
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function hashToken(token){return hex(await digest('seoul-pocket:member:'+token));}
export function randomToken(bytes=32){return hex(crypto.getRandomValues(new Uint8Array(bytes)));}
export function inviteCode(){const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789',b=crypto.getRandomValues(new Uint8Array(8));return [...b].map(x=>a[x%a.length]).join('');}
export const now=()=>new Date().toISOString();
export function db(env){if(!env.DB)throw new Error('DB binding missing');return env.DB;}
/** Resolves the member for a Bearer member token. Returns {member,trip} or a JSON error response. */
export async function memberFromRequest(request,env){
 if(!env.DB)return json({error:'Shared trips are not enabled on this deployment.'},503);
 const h=request.headers.get('Authorization')||'';if(!h.startsWith('Bearer ')||h.length>200)return json({error:'Sign in to the shared trip again.'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Cross-origin requests are not allowed.'},403);
 const member=await env.DB.prepare('SELECT m.id,m.trip_id,m.role,m.name,m.revoked_at,t.name AS trip_name,t.encryption_salt,t.key_version FROM members m JOIN trips t ON t.id=m.trip_id WHERE m.token_hash=?').bind(await hashToken(h.slice(7))).first();
 if(!member||member.revoked_at)return json({error:'This device is no longer a member of the shared trip.'},401);
 return {member};
}
export function badJSON(){return json({error:'Send a JSON body.'},400);}
export async function readJSON(request,limit=256*1024){const text=await request.text();if(text.length>limit)return null;try{return JSON.parse(text);}catch{return null;}}
