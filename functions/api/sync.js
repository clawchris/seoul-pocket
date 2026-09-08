import {json,authorize} from '../_lib/http.js';
/** Deliberately fails closed until per-member auth, CAS, receipts, and conflict UI are implemented.
 * See docs/03-ARCHITECTURE-AND-SECURITY.md and migrations/0001_shared_trip.sql.
 * Never replace this with a whole-trip last-write-wins upload.
 */
export async function onRequest(context){
 const denied=await authorize(context.request,context.env);if(denied)return denied;
 return json({error:'Shared sync is not implemented in this starter. Nothing has been uploaded.',code:'SYNC_NOT_IMPLEMENTED'},501);
}
