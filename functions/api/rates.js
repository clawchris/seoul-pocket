import {json} from '../_lib/http.js';
import {validateRate} from '../../public/src/domain.js';
/** Public, fixed upstream request. Cannot be used as an arbitrary URL fetch proxy. */
export async function onRequestGet({env={}}){
 try{
  const response=await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=KRW',{signal:AbortSignal.timeout(4500),cf:{cacheTtl:3600,cacheEverything:true}});
  if(!response.ok)return json({error:'Rate provider unavailable. Use your saved rate or set one manually.'},502);
  const data=await response.json(),row=Array.isArray(data)?data.find(r=>r.base==='USD'&&r.quote==='KRW'):null;
  if(!row)throw new Error('Invalid response');
  return json(validateRate({...row,source:'Frankfurter'}));
 }catch{return json({error:'Could not refresh the reference rate. Existing local rate is unchanged.'},502);}
}
