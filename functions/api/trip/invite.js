import {json} from '../../_lib/http.js';
import {memberFromRequest,hashToken,randomToken,inviteCode,now} from '../../_lib/trip.js';
/** Owner rotates the invite: the old code stops working immediately. */
export async function onRequestPost({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;const {member}=auth;
 if(member.role!=='owner')return json({error:'Only the trip owner can make invite codes.'},403);
 const code=inviteCode(),expires=new Date(Date.now()+30*86400000).toISOString();
 await env.DB.batch([
  env.DB.prepare('UPDATE invites SET consumed_at=? WHERE trip_id=? AND consumed_at IS NULL').bind(now(),member.trip_id),
  env.DB.prepare('INSERT INTO invites (id,trip_id,secret_hash,role,expires_at) VALUES (?,?,?,?,?)').bind(randomToken(8),member.trip_id,await hashToken(member.trip_id+':'+code),'editor',expires)
 ]);
 return json({tripId:member.trip_id,invite:{code,expiresAt:expires}});
}
export async function onRequestGet({request,env}){
 const auth=await memberFromRequest(request,env);if(auth instanceof Response)return auth;const {member}=auth;
 const members=await env.DB.prepare('SELECT name,role,last_seen_at FROM members WHERE trip_id=? AND revoked_at IS NULL ORDER BY created_at').bind(member.trip_id).all();
 return json({tripId:member.trip_id,name:member.trip_name,role:member.role,members:(members.results||[]).map(m=>({name:m.name||'Traveler',role:m.role,lastSeenAt:m.last_seen_at}))});
}
