import {json,authorize} from '../../_lib/http.js';
import {hashToken,randomToken,inviteCode,now,readJSON,badJSON} from '../../_lib/trip.js';
/** Creates a shared trip. Guarded by the owner's private proxy token so strangers cannot fill the database. */
export async function onRequestPost({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.DB)return json({error:'Shared trips are not enabled on this deployment.'},503);
 const body=await readJSON(request);if(!body)return badJSON();
 const name=String(body.name||'').trim().slice(0,80),salt=String(body.salt||''),member=String(body.memberName||'').trim().slice(0,40);
 if(!name||!/^[A-Za-z0-9+/=]{20,48}$/.test(salt))return json({error:'A trip name and a client-generated salt are required.'},400);
 const tripId=randomToken(8),token=randomToken(),code=inviteCode(),expires=new Date(Date.now()+30*86400000).toISOString();
 await env.DB.batch([
  env.DB.prepare('INSERT INTO trips (id,name,created_at,encryption_salt,key_version) VALUES (?,?,?,?,1)').bind(tripId,name,now(),salt),
  env.DB.prepare('INSERT INTO members (id,trip_id,role,token_hash,created_at,name,last_seen_at) VALUES (?,?,?,?,?,?,?)').bind(randomToken(8),tripId,'owner',await hashToken(token),now(),member,now()),
  env.DB.prepare('INSERT INTO invites (id,trip_id,secret_hash,role,expires_at) VALUES (?,?,?,?,?)').bind(randomToken(8),tripId,await hashToken(tripId+':'+code),'editor',expires)
 ]);
 return json({tripId,name,salt,role:'owner',memberToken:token,invite:{code,expiresAt:expires}},201);
}
