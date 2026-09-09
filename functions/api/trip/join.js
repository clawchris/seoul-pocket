import {json} from '../../_lib/http.js';
import {hashToken,randomToken,now,readJSON,badJSON} from '../../_lib/trip.js';
/** Joins with a trip id and invite code. No proxy token needed, so a coworker only needs the two values the owner shares. */
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:'Shared trips are not enabled on this deployment.'},503);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Cross-origin requests are not allowed.'},403);
 const body=await readJSON(request,4096);if(!body)return badJSON();
 const tripId=String(body.tripId||'').trim(),code=String(body.code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''),member=String(body.memberName||'').trim().slice(0,40);
 if(!/^[a-f0-9]{16}$/.test(tripId)||code.length!==8)return json({error:'Check the trip id and the 8-character invite code.'},400);
 const invite=await env.DB.prepare('SELECT i.id,i.role,i.expires_at,i.uses,i.max_uses,i.consumed_at,t.name,t.encryption_salt FROM invites i JOIN trips t ON t.id=i.trip_id WHERE i.trip_id=? AND i.secret_hash=?').bind(tripId,await hashToken(tripId+':'+code)).first();
 if(!invite||invite.consumed_at||invite.expires_at<now()||invite.uses>=invite.max_uses)return json({error:'That invite is not valid any more. Ask the trip owner for a new code.'},403);
 const token=randomToken();
 await env.DB.batch([
  env.DB.prepare('INSERT INTO members (id,trip_id,role,token_hash,created_at,name,last_seen_at) VALUES (?,?,?,?,?,?,?)').bind(randomToken(8),tripId,invite.role,await hashToken(token),now(),member,now()),
  env.DB.prepare('UPDATE invites SET uses=uses+1 WHERE id=?').bind(invite.id)
 ]);
 return json({tripId,name:invite.name,salt:invite.encryption_salt,role:invite.role,memberToken:token},201);
}
