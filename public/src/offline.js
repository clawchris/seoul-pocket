let registration=null;
export async function registerWorker(onUpdate){
 if(!('serviceWorker'in navigator))return null;
 try{
  registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  if(registration.waiting)onUpdate(registration);
  registration.addEventListener('updatefound',()=>{const w=registration.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)onUpdate(registration);});});
  return registration;
 }catch{return null;}
}
export async function checkOffline(){
 if(!('serviceWorker'in navigator))return {ready:false,reason:'Service workers are unavailable.'};
 const r=await navigator.serviceWorker.getRegistration();if(!r?.active)return {ready:false,reason:'Open the deployed app online once, then try again.'};
 return new Promise(resolve=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>resolve({ready:false,reason:'Offline check timed out.'}),5000);
  channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};r.active.postMessage({type:'CHECK_CACHE'},[channel.port2]);
 });
}
export async function requestPersistence(){try{return await navigator.storage?.persist?.()??false;}catch{return false;}}
export function acceptUpdate(r){if(!r?.waiting)return; navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});r.waiting.postMessage({type:'ACTIVATE_UPDATE'});}
