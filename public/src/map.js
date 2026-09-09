/** Interactive Kakao map inside a sheet. The SDK is fetched from Kakao only when the sheet opens and only online. */
let loading=null;
export function loadKakaoSdk(appKey){
 if(globalThis.kakao?.maps)return Promise.resolve(globalThis.kakao);
 if(!appKey)return Promise.reject(new Error('The Kakao JavaScript key is not configured on the server yet.'));
 if(!navigator.onLine)return Promise.reject(new Error('The interactive map needs a connection. Saved addresses and Naver links still work offline.'));
 if(!loading)loading=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+encodeURIComponent(appKey)+'&autoload=false';s.async=true;
  const timer=setTimeout(()=>{loading=null;reject(new Error('The map did not load in time. Check the connection and try again.'));},10000);
  s.onload=()=>{clearTimeout(timer);if(!globalThis.kakao?.maps){loading=null;reject(new Error('Kakao map script loaded without the map library. Check the domain registration in the Kakao console.'));return;}globalThis.kakao.maps.load(()=>resolve(globalThis.kakao));};
  s.onerror=()=>{clearTimeout(timer);loading=null;reject(new Error('Kakao refused the map script. Register this site domain under the Kakao app’s Web platform.'));};
  document.head.appendChild(s);
 });
 return loading;
}
/** Draws markers for places with coordinates and the stay. onPick(id) opens a place; onStay() opens the stay. Returns the map. */
export function renderMap(kakao,el,{places,stay,onPick,onStay}){
 const center=stay?.lat!=null?[stay.lat,stay.lng]:places[0]?[places[0].lat,places[0].lng]:[37.54,127.09];
 const map=new kakao.maps.Map(el,{center:new kakao.maps.LatLng(center[0],center[1]),level:5});
 const bounds=new kakao.maps.LatLngBounds();let count=0;
 const add=(lat,lng,title,handler,isStay)=>{const pos=new kakao.maps.LatLng(lat,lng);const marker=new kakao.maps.Marker({map,position:pos,title,zIndex:isStay?10:1});bounds.extend(pos);count++;
  const label=new kakao.maps.CustomOverlay({position:pos,yAnchor:2.2,content:`<div class="map-label${isStay?' stay':''}">${title.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</div>`});label.setMap(map);
  kakao.maps.event.addListener(marker,'click',handler);};
 if(stay?.lat!=null)add(stay.lat,stay.lng,'Our stay',onStay,true);
 for(const p of places)if(Number.isFinite(p.lat)&&Number.isFinite(p.lng))add(p.lat,p.lng,p.korean||p.name,()=>onPick(p.id),false);
 if(count>1)map.setBounds(bounds,40,40,40,40);
 return map;
}
