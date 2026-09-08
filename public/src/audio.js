let active=null;let pack;
export async function audioManifest(){if(!pack)pack=await fetch('/audio/manifest.json').then(r=>r.json()).catch(()=>({reviewed:false,clips:{}}));return pack;}
export function stopSpeech(){globalThis.speechSynthesis?.cancel();if(active){active.pause();active=null;}}
export async function speakPhrase(phrase){
 stopSpeech();const m=await audioManifest(),file=(m.reviewed||m.generated)?m.clips?.[phrase.id]:null;
 if(file&&/^\/audio\/[a-zA-Z0-9_.-]+\.(mp3|m4a|wav|ogg)$/.test(file)){
   active=new Audio(file);await active.play();return m.reviewed?'recording':'generated';
 }
 if(!('speechSynthesis'in globalThis))throw new Error('Speech is unavailable. Use Show card, or add reviewed Korean recordings before the trip.');
 const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase().startsWith('ko')&&v.localService)||voices.find(v=>v.lang.toLowerCase().startsWith('ko'));
 if(!voice)throw new Error('No Korean voice is available yet. Check Korean voice availability in iPhone settings, then test it in airplane mode. The written card still works.');
 const utterance=new SpeechSynthesisUtterance(phrase.ko);utterance.lang='ko-KR';utterance.voice=voice;utterance.rate=0.8;
 return new Promise((resolve,reject)=>{let started=false;const timer=setTimeout(()=>{if(!started){speechSynthesis.cancel();reject(new Error('Speech did not start. Use Show card.'));}},4500);utterance.onstart=()=>{started=true;clearTimeout(timer);resolve(voice.localService?'device-local':'device-network');};utterance.onerror=()=>{clearTimeout(timer);reject(new Error('Speech failed. The written card remains available.'));};speechSynthesis.speak(utterance);});
}
