import * as db from './db.js';
import {cleanPlace,convert,parseAmount,validateRate,staleRate,seoulDate,mapLinks,safeURL,validDate,text} from './domain.js';
import {seal,unseal} from './crypto.js';
import {preparePhoto,serializePhotos,deserializePhotos,downloadFile} from './media.js';
import {registerWorker,checkOffline,requestPersistence,acceptUpdate} from './offline.js';
import {speakPhrase,stopSpeech,audioManifest} from './audio.js';
import {PHRASES,STARTERS,TRAVEL,REVIEW_DATE} from './data.js';
import {e,icon,button,external,field,textarea,select,toast,errorMessage} from './ui.js';

const $=s=>document.querySelector(s);
const main=$('#main'),sheet=$('#sheet');
const state={tab:'today',places:[],prefs:{name:'Our Seoul trip',start:'',end:''},rate:null,filter:'all',query:'',phraseCategory:'All',phraseQuery:'',vault:null,vaultExists:false,pinVisible:false,formDirty:false,modalKind:'',update:null,apiToken:'',offline:null,searchResults:[],idle:0};
const photoURLs=new Map();
const tabNames={today:'Today',saved:'Saved',speak:'Speak',tools:'Tools',trip:'Trip'};
const statusNames={saved:'Want to go',planned:'Planned',visited:'Been there',skipped:'Skip for now'};
const navIcons={today:'home',saved:'pin',speak:'speak',tools:'tools',trip:'trip'};
const action=(name,id='')=>`data-action="${name}" ${id?`data-id="${e(id)}"`:''}`;

async function load(){
 [state.places,state.rate,state.vaultExists]=await Promise.all([db.all(),db.getMeta('rate'),db.getMeta('stay').then(Boolean)]);
 const prefs=await db.getMeta('prefs');if(prefs)state.prefs={...state.prefs,...prefs};
 // Read existing data as text only; validate when writing or restoring.
 state.places.sort((a,b)=>(Number(b.priority)-Number(a.priority))||String(b.updatedAt).localeCompare(String(a.updatedAt)));
 for(const [id,url] of photoURLs)if(!state.places.some(p=>p.photoId===id)){URL.revokeObjectURL(url);photoURLs.delete(id);}
}
function connection(){
 $('#connection').innerHTML=`<div class="connection ${navigator.onLine?'':'offline'}"><span class="dot"></span>${navigator.onLine?'Connection detected':'Offline'}<span aria-hidden="true">·</span> Saved on this device, not shared${state.update?' · Update available':''}</div>`;
}
function render(){
 $('#header').innerHTML=`<div class="brand"><span class="brand-mark" aria-hidden="true">서</span>Seoul Pocket</div>${button(`${icon('shield')} Help`,'help','header-help row')}`;
 connection();
 $('#nav').innerHTML=Object.keys(tabNames).map(t=>button(`${icon(navIcons[t])}<span>${tabNames[t]}</span>`,'tab',t===state.tab?'active':'',`data-tab="${t}" ${t===state.tab?'aria-current="page"':''}`)).join('');
 main.innerHTML=({today:todayView,saved:savedView,speak:speakView,tools:toolsView,trip:tripView})[state.tab]();
 hydratePhotos(main);
}
function pageTop(title,subtitle,extra=''){return `<div class="page-top"><div class="row between"><h1>${title}</h1>${extra}</div><p>${subtitle}</p></div>`;}
function todayView(){
 const today=seoulDate(),planned=state.places.filter(p=>p.date===today&&p.status!=='skipped').sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 const clock=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit'}).format(new Date());
 const visited=state.places.filter(p=>p.status==='visited').length,musts=state.places.filter(p=>p.priority).length;
 return `<div class="home-layout"><section class="hero"><div class="row between"><span class="eyebrow">Your Seoul, in one pocket</span><span class="time" id="seoul-clock">${e(clock)} KST</span></div><h1>A little less planning.<br>A little more Seoul.</h1><p>Your places, your people, and the things you need along the way.</p><div class="hero-bottom"><span class="tag dark">${state.prefs.start?e(state.prefs.start+' → '+(state.prefs.end||'Set end date')):'Trip dates not set'}</span>${button(icon('arrow'),'preferences','hero-link','aria-label="Set trip dates"')}</div></section>
 <div class="grid2"><button class="quick-card" ${action('stay')}><span class="icon-tile">${icon('lock')}</span><strong>Our stay</strong><span class="caption">Address & entry details</span></button><button class="quick-card" ${action('transport')}><span class="icon-tile">${icon('train')}</span><strong>Get around</strong><span class="caption">Subway, bus & airport</span></button><button class="quick-card" ${action('convert')}><span class="icon-tile">${icon('won')}</span><strong>Won to dollars</strong><span class="caption">A quick price check</span></button><button class="quick-card" ${action('new')}><span class="icon-tile">${icon('plus')}</span><strong>Save a find</strong><span class="caption">Food, places & links</span></button></div></div>
 ${state.update?`<div class="notice neutral spacer">An app update is ready. Your current version still works. ${button('Review & update','update','text-button')}</div>`:''}
 <div class="section-head"><h2>Today, at your pace</h2><span class="caption">${e(today)} · Seoul</span></div>
 ${planned.length?`<div class="places-grid">${planned.map(placeCard).join('')}</div>`:`<div class="empty"><h3>Leave room for a good detour.</h3><p>No stops planned for today. Save a few ideas, then assign a date when you are ready.</p>${button('Explore the shortlist '+icon('arrow'),'tab','secondary','data-tab="saved"')}</div>`}
 <div class="section-head"><h2>Your little collection</h2>${button('View saved','tab','text-button','data-tab="saved"')}</div><div class="metrics"><div class="metric-card"><div class="metric">${state.places.length}</div><div class="metric-label">Saved finds</div></div><div class="metric-card"><div class="metric">${musts}</div><div class="metric-label">Must-tries</div></div><div class="metric-card"><div class="metric">${visited}</div><div class="metric-label">Been there</div></div></div>
 <div class="card spacer"><div class="row"><span class="icon-tile">${icon('download')}</span><div><h3>Ready when the signal is not?</h3><p class="caption">Check the offline copy before you leave.</p></div></div>${button('Check offline readiness','readiness','secondary full')}</div>`;
}
function placeCard(p){return `<article class="place-card"><button type="button" class="place-main" ${action('detail',p.id)}><span class="place-thumb ${p.kind}" ${p.photoId?`data-photo="${e(p.photoId)}"`:''}>${icon(p.kind==='food'?'food':'pin')}</span><span class="place-text"><h3>${e(p.name)}</h3><p>${e(p.korean||p.neighborhood||(p.kind==='food'?'Food idea':'Place idea'))}</p><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food & drink':'Place to go'}</span> ${p.time?`<span class="date-pill">${e(p.time)}</span>`:''}</span></button><div class="place-footer">${button(`${icon(p.status==='visited'?'check':'pin')}${e(statusNames[p.status]||'Want to go')}`,'visit',p.status==='visited'?'done':'',`data-id="${e(p.id)}" aria-label="${p.status==='visited'?'Mark not visited':'Mark visited'}: ${e(p.name)}"`)}${button(`${icon('star')}${p.priority?'Must-try':'Save as must-try'}`,'priority',p.priority?'starred':'',`data-id="${e(p.id)}" aria-pressed="${!!p.priority}"`)}</div></article>`;}
function filteredPlaces(){return state.places.filter(p=>{
 const filter=state.filter==='all'||p.kind===state.filter||(state.filter==='must'&&p.priority)||(state.filter==='visited'&&p.status==='visited');
 return filter&&[p.name,p.korean,p.neighborhood,p.note].join(' ').toLowerCase().includes(state.query.toLowerCase());
 });}
function savedView(){return `${pageTop('Worth a detour.','Restaurants, places, and the reel you do not want to lose.',button(icon('plus'),'new','icon-button','aria-label="Add a place or food idea"'))}
 <div class="search-field">${icon('search')}<input id="place-search" aria-label="Search saved places" type="search" placeholder="Name, neighborhood, or note" value="${e(state.query)}"></div>
 <div class="filters" aria-label="Filter saved places">${[['all','Everything'],['food','Food & drink'],['place','Places'],['must','Must-try checklist'],['visited','Been there']].map(([v,label])=>button(label,'filter','chip '+(state.filter===v?'active':''),`data-filter="${v}" aria-pressed="${state.filter===v}"`)).join('')}</div>
 <div id="saved-results">${savedResults()}</div>
 <div class="row wrap spacer">${button('Seoul starter ideas','starters','secondary')}${button('Search Naver','naver','link-button')}</div><p class="caption spacer">Saved items are on this device only. Group sync is specified, but not connected in this starter.</p>`;}
function savedResults(){const items=filteredPlaces();return items.length?`<p class="caption">${items.length} ${items.length===1?'find':'finds'} · Tap a card to see links, notes, and directions.</p><div class="places-grid">${items.map(placeCard).join('')}</div>`:`<div class="empty"><h3>${state.query?'No matches yet.':'Start with something you love.'}</h3><p>${state.query?'Try a different word, or clear your search.':'Add a place, a dish you want to try, or a link someone sent you. You can add the address later.'}</p>${button('Save a find','new','primary')}</div>`;}
function speakView(){return `${pageTop('A few words go a long way.','Tap to listen, or show a large Korean card.')}
 <div class="notice neutral">Pronunciation guides are approximate. Device speech is not a verified offline recording; test it before traveling.</div>
 <div class="search-field spacer">${icon('search')}<input id="phrase-search" aria-label="Search Korean phrases" type="search" placeholder="Try “water” or “subway”" value="${e(state.phraseQuery)}"></div>
 <div class="filters">${['All','Basics','Food','Transport','Help'].map(c=>button(c,'phrase-filter','chip '+(c===state.phraseCategory?'active':''),`data-category="${c}" aria-pressed="${c===state.phraseCategory}"`)).join('')}</div><div id="phrase-results">${phraseResults()}</div>`;}
function phraseResults(){const items=PHRASES.filter(p=>(state.phraseCategory==='All'||p.category===state.phraseCategory)&&[p.en,p.ko,p.roman].join(' ').toLowerCase().includes(state.phraseQuery.toLowerCase()));return `<div class="stack phrases-grid">${items.map(p=>`<article class="phrase"><div class="row between"><span class="english">${e(p.en)}</span><span class="tag gray">${e(p.category)}</span></div><p class="korean" lang="ko">${e(p.ko)}</p><p class="phonetic">${e(p.phonetic)}</p><div class="phrase-actions">${button(icon('volume')+' Listen','listen','secondary',`data-id="${p.id}" aria-label="Listen: ${e(p.en)}"`)}${button('Show card','phrase-card','link-button',`data-id="${p.id}"`)}</div></article>`).join('')}</div>${items.length?'':'<p>No matching phrases. Try another word.</p>'}`;}
function toolsView(){return `${pageTop('Little things, sorted.','Price checks, getting around, and a little peace of mind.')}<div class="tool-columns"><section class="card"><div class="row between"><h2>Currency, made easy</h2>${icon('won')}</div>${converterMarkup()}</section><section>
 ${toolLink('Transport field guide','Transit cards, routes, airport & last trains','train','transport')}
 ${toolLink('Offline readiness','Check this device before heading out','download','readiness')}
 ${toolLink('Emergency & travel help','112 police · 119 ambulance / fire','shield','help')}
 ${toolLink('Print a fallback card','No door PIN on the printed copy','trip','print')}
 </section></div>`;}
function converterMarkup(){return `<p class="caption">Reference conversion, not your card issuer’s final charge.</p><div class="form-grid"><label>Amount<input id="convert-amount" class="rate-input" inputmode="decimal" value="10000" autocomplete="off"></label><label>From<select id="convert-from"><option value="KRW">KRW · Korean won</option><option value="USD">USD · US dollars</option></select></label></div><div class="rate-label" id="convert-label">Estimated USD</div><output class="rate-result" id="convert-result">${state.rate?'$'+(10000/state.rate.rate).toFixed(2):'Set a rate'}</output><div class="preset">${['5000','10000','20000','50000'].map(v=>button(Number(v).toLocaleString('en-US'),'preset','',`data-value="${v}"`)).join('')}</div><p id="rate-note" class="caption spacer">${rateNote()}</p><div class="row wrap">${button('Refresh rate','refresh-rate','secondary')}${button('Enter rate','manual-rate','link-button')}</div>`;}
function rateNote(){return state.rate?`${state.rate.source==='manual'?'Manual rate':'Frankfurter reference'}: 1 USD = ${Number(state.rate.rate).toLocaleString('en-US',{maximumFractionDigits:4})} KRW. Dated ${e(state.rate.date)}.${staleRate(state.rate)?' More than 72 hours old; refresh before relying on it.':''}`:'No exchange rate has been saved yet. Refresh online, or enter a rate from a source you trust.';}
function toolLink(title,sub,ico,act){return `<button class="tool-link" ${action(act)}><span class="icon-tile">${icon(ico)}</span><div><strong>${title}</strong><span>${sub}</span></div>${icon('arrow')}</button>`;}
function tripView(){return `${pageTop(e(state.prefs.name||'Our Seoul trip'),'Your stay, your backups, and the checks before departure.')}
 <div class="tool-columns"><section><div class="card"><div class="row between"><h2>Our stay</h2>${icon('lock')}</div><p class="small muted">${state.vaultExists?'Encrypted on this device. Unlock to see your address and entry details.':'Add the Korean address, entry PIN, Wi-Fi, and host details to an encrypted stay vault.'}</p>${button(state.vaultExists?'Unlock stay':'Set up our stay','stay','primary full')}</div>
 <div class="section-head"><h2>Trip settings</h2></div>${toolLink('Dates & trip name',state.prefs.start?e(state.prefs.start+' to '+state.prefs.end):'No travel dates set','clock','preferences')}${toolLink('Encrypted backup','Save a recovery copy outside this app','download','backup')}${toolLink('Restore a backup','Imports places as new copies, without replacing yours','trip','restore')}</section>
 <section><div class="notice neutral"><strong>This device, not a shared account.</strong><p class="small">Group sharing needs the authenticated sync service described in the handoff. A public Pages URL does not share your local data.</p></div><div class="section-head"><h2>Before you go</h2></div><div class="card"><div class="checkline">${icon('home')}<span>Add this app to your iPhone Home Screen, then open it from that icon.</span></div><div class="checkline">${icon('download')}<span>Run the offline check and reopen in airplane mode.</span></div><div class="checkline">${icon('volume')}<span>Test Korean audio on each traveler’s iPhone.</span></div><div class="checkline">${icon('lock')}<span>Save the vault passphrase in your password manager, not just in this app.</span></div><div class="checkline">${icon('trip')}<span>Keep an encrypted backup and a separate address card.</span></div></div><div class="row wrap spacer">${button('Offline check','readiness','secondary')}${button('Naver connection','connection','link-button')}</div></section></div>`;}

function openSheet(title,content,kind='generic'){
 state.formDirty=false;state.modalKind=kind;
 sheet.innerHTML=`<div class="sheet-header"><h2 id="sheet-title">${title}</h2>${button(icon('close'),'close','icon-button','aria-label="Close panel"')}</div><div class="sheet-body">${content}</div>`;
 if(!sheet.open)sheet.showModal();sheet.scrollTop=0;hydratePhotos(sheet);
}
function closeSheet(force=false){if(state.formDirty&&!force&&!confirm('Discard the changes in this open form? Your saved copy will be kept.'))return;state.formDirty=false;sheet.close();}
function lockStay(){state.vault=null;state.pinVisible=false;clearTimeout(state.idle);}
sheet.addEventListener('close',()=>{lockStay();state.modalKind='';state.formDirty=false;sheet.innerHTML='';stopSpeech();});
sheet.addEventListener('cancel',ev=>{ev.preventDefault();closeSheet();});
sheet.addEventListener('input',()=>{if(sheet.querySelector('form'))state.formDirty=true;});
function startIdle(){clearTimeout(state.idle);if(state.vault)state.idle=setTimeout(()=>{lockStay();if(sheet.open){closeSheet(true);toast('Stay vault locked after 3 minutes without activity.');}},180000);}
document.addEventListener('pointerdown',startIdle,{passive:true});document.addEventListener('keydown',startIdle);
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.apiToken='';stopSpeech();if(state.modalKind.startsWith('stay')||state.modalKind==='connection'||state.modalKind==='backup'||state.modalKind==='restore'){lockStay();closeSheet(true);}}else {load().then(render).catch(err=>toast(errorMessage(err)));}});

async function hydratePhotos(root){
 for(const el of root.querySelectorAll('[data-photo]')){
  const id=el.dataset.photo;
  try{if(!photoURLs.has(id)){const p=await db.photo(id);if(p?.blob)photoURLs.set(id,URL.createObjectURL(p.blob));}
   if(el.isConnected&&el.dataset.photo===id&&photoURLs.has(id)){const img=document.createElement('img');img.src=photoURLs.get(id);img.alt='Saved place photo';img.loading='lazy';el.replaceChildren(img);}
  }catch{/* Keep the readable placeholder if a local photo is unavailable. */}
 }
}
function placeForm(p={}){
 const id=p.id||crypto.randomUUID();
 openSheet(p.id?'Edit your find':'Save a find',`<form data-form="place" data-id="${id}" data-rev="${p.rev||0}" data-source="${e(p.source||'')}">
 ${field('Name *','name',p.name,'text','required maxlength="140" placeholder="A restaurant, a place, or a dish"')}
 <div class="form-grid">${select('Type','kind',[['food','Food & drink'],['place','Place to go']],p.kind||'food')}${select('Status','status',Object.entries(statusNames),p.status||'saved')}</div>
 ${field('Korean name','korean',p.korean,'text','lang="ko" maxlength="140" placeholder="Useful when searching or showing a driver"')}
 ${field('Neighborhood','neighborhood',p.neighborhood,'text','maxlength="100" placeholder="For example, Jongno or Mapo"')}
 ${field('Korean address','address',p.address,'text','maxlength="350"')}
 ${textarea('Why we saved it / useful notes','note',p.note,'maxlength="3000" placeholder="What to order, reservation details, who recommended it…"')}
 ${textarea('Links, one per line','links',(p.links||[]).join('\n'),'placeholder="https://…\nReels, TikToks, Naver, menus, or booking pages"')}
 <p class="form-help">Links open externally and need a connection. Upload your own screenshot to keep a useful visual offline. Never paste the door PIN into ordinary notes.</p>
 <label>Photo or screenshot<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="form-help">JPEG, PNG, or WebP up to 15 MB. Stored only on this device, compressed locally. No video download or automatic social preview.</p>
 ${p.photoId?`<label class="checkbox-label"><input name="removePhoto" type="checkbox"> Remove current photo</label>`:''}
 <label class="checkbox-label"><input name="priority" type="checkbox" ${p.priority?'checked':''}> Make this a must-try</label>
 <div class="form-grid">${field('Planned date · Seoul','date',p.date,'date')}${field('Time, optional · Seoul','time',p.time,'time')}</div>
 <details><summary>Directions and verification</summary><div class="form-grid">${field('Latitude, optional','lat',p.lat??'','text','inputmode="decimal"')}${field('Longitude, optional','lng',p.lng??'','text','inputmode="decimal"')}</div><p class="form-help">Both coordinates are needed for direct walking or transit handoff. Otherwise the app opens a Naver search.</p>${field('Details last checked','checkedAt',p.checkedAt,'date')}<p class="form-help">This is your verification date, not a claim that the venue is currently open.</p></details>
 <p class="form-error" role="alert"></p><div class="form-actions">${button('Cancel','close','secondary')}<button class="primary" type="submit">Save on this device</button></div></form>`,'place');
}
function showPlace(p){
 const links=mapLinks(p,location.origin);
 openSheet(e(p.name),`${p.photoId?`<div class="detail-image" data-photo="${e(p.photoId)}"></div>`:''}<div class="row wrap"><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food & drink':'Place to go'}</span><span class="tag gray">${e(statusNames[p.status])}</span>${p.priority?'<span class="tag warm">Must-try</span>':''}</div>
 ${p.korean?`<p class="ko-title spacer" lang="ko">${e(p.korean)}</p>`:''}${p.address?`<p lang="ko">${e(p.address)}</p>${button('Copy address','copy-address','secondary',`data-id="${e(p.id)}"`)}`:''}
 ${p.date?`<p class="small spacer">Planned: ${e(p.date)} ${e(p.time)} · Seoul time</p>`:''}
 <p class="detail-note spacer">${e(p.note||'No notes yet.')}</p><div class="detail-links">${external('Open Naver Maps app',links.app)}${external('Open Naver in browser',links.web)}${links.transit?external('Public transit directions',links.transit):''}${links.walk?external('Walking directions',links.walk):''}</div><p class="caption spacer">Naver app buttons require the Naver Maps app. Browser search and copy-address are the fallbacks. Directions and opening information are not stored offline.</p>
 ${(p.links||[]).length?`<h3>Saved links</h3><div class="detail-links">${p.links.map((u,i)=>safeURL(u)?external(e(new URL(u).hostname)+' · link '+(i+1),safeURL(u)):'').join('')}</div>`:''}
 <p class="caption spacer">Details ${p.checkedAt?'last checked '+e(p.checkedAt):'have not been verified'}. ${p.source?e(p.source):'Added by you.'}</p>
 <div class="form-actions">${button('Edit','edit','primary',`data-id="${e(p.id)}"`)}${button('Delete','delete','danger-button',`data-id="${e(p.id)}"`)}</div>`,'detail');
}
function stayEntry(){
 if(state.vault)return showStay();
 openSheet('Our stay',`<div class="vault-locked"><span class="icon-tile">${icon('lock')}</span><h3>${state.vaultExists?'Your stay is locked.':'A safe place for the essentials.'}</h3><p>${state.vaultExists?'The address, door PIN, and Wi-Fi details are encrypted on this device.':'Use a separate vault passphrase, not the building’s door PIN. There is no password-reset service.'}</p></div>
 ${state.vaultExists?`<form data-form="unlock">${field('Vault passphrase','passphrase','','password','required autocomplete="off" maxlength="256"')}<p class="form-error" role="alert"></p><button class="primary full" type="submit">Unlock stay</button></form>`:button('Create stay vault','stay-create','primary full')}
 <p class="caption spacer">The vault locks when this app is backgrounded, the panel is closed, or after 3 minutes of inactivity. Keep the passphrase in your password manager.</p>`,'stay-unlock');
}
function stayForm(){
 const v=state.vault||{};
 openSheet(state.vaultExists?'Edit stay vault':'Create stay vault',`<form data-form="stay">
 ${field('Accommodation name','name',v.name,'text','maxlength="140"')}${textarea('Address in Korean *','addressKo',v.addressKo,'required maxlength="500" lang="ko"')}${textarea('Address in English, optional','addressEn',v.addressEn,'maxlength="500"')}
 ${field('Door / building entry PIN','pin',v.pin,'password','maxlength="100" autocomplete="off"')}${field('Room / unit','room',v.room,'text','maxlength="100"')}
 ${field('Wi-Fi name','wifi',v.wifi,'text','maxlength="150"')}${field('Wi-Fi password','wifiPassword',v.wifiPassword,'password','maxlength="150" autocomplete="off"')}
 ${field('Host or hotel phone','phone',v.phone,'tel','maxlength="60"')}${textarea('Arrival, check-in, and access notes','note',v.note,'maxlength="2000"')}
 <h3>Protect this vault</h3>${field(state.vaultExists?'Passphrase to encrypt this version':'Choose a vault passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirm passphrase','confirm','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}
 <p class="form-help">At least 12 characters. Use a long, unique passphrase. Losing it means losing access unless you have another usable copy. Do not use your short door PIN as the passphrase.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Encrypt and save stay</button></form>`,'stay-edit');
}
function showStay(){
 const v=state.vault;if(!v)return stayEntry();
 openSheet('Our stay',`<div class="row between"><span class="tag">Unlocked on this device</span>${button('Lock now','lock','text-button')}</div><h3 class="spacer">${e(v.name||'Our accommodation')}</h3><p lang="ko" class="ko-title">${e(v.addressKo)}</p>${v.addressEn?`<p>${e(v.addressEn)}</p>`:''}
 <div class="row wrap">${button('Show address card','address-card','primary')}${button('Copy Korean address','copy-stay','secondary')}</div>
 ${v.pin?`<div class="secret"><span class="eyebrow">Entry PIN</span><div class="row between"><span class="pin-value">${state.pinVisible?e(v.pin):'••••'}</span>${button(state.pinVisible?'Hide':'Reveal','reveal-pin','secondary')}</div></div>`:''}
 ${v.room?`<p class="small spacer"><strong>Room / unit:</strong> ${e(v.room)}</p>`:''}${v.wifi?`<p class="small"><strong>Wi-Fi:</strong> ${e(v.wifi)}</p>`:''}${v.wifiPassword?`<details class="secret"><summary>Wi-Fi password</summary><p>${e(v.wifiPassword)}</p></details>`:''}${v.phone?`<p class="small"><strong>Host phone:</strong> ${e(v.phone)}</p>`:''}${v.note?`<p class="detail-note">${e(v.note)}</p>`:''}
 <p class="caption">The door PIN is never placed in map links or the printed fallback card. Avoid screenshots containing it.</p>${button('Edit stay','stay-edit','link-button full')}`,'stay-view');startIdle();
}
function helpSheet(){openSheet('Help in Korea',`<p class="sheet-subtitle">Emergency numbers are available in this app offline. Calling still needs a working telephone connection.</p><div class="emergency-grid"><a href="tel:112"><strong>112</strong>Police</a><a href="tel:119"><strong>119</strong>Ambulance / fire</a></div><div class="card spacer"><h3>1330 travel helpline</h3><p class="small">Travel information and interpretation support. Use the official site for current service hours and online call/chat options.</p><div class="row wrap"><a class="secondary" href="tel:1330">Call 1330</a>${external('Online help','https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140632')}</div></div><p class="caption spacer">A data-only SIM may not provide regular voice calling. Check your phone plan before travel. This app does not contact emergency services automatically.</p>${button('Show “Please help me”','phrase-card','secondary full','data-id="help"')}<p class="source-link spacer">Sources reviewed ${REVIEW_DATE}: ${external('Visit Seoul safety','https://english.visitseoul.net/safety')}</p>`,'help');}
function transportSheet(){openSheet('Getting around Seoul',`<div class="notice neutral">Let Naver Maps handle live routes. Keep names, exit numbers, and screenshots here for the moments without signal.</div>${TRAVEL.map(t=>`<section class="spacer"><h3>${e(t.title)}</h3><p class="small">${e(t.body)}</p>${external('Official information',t.source)}</section>`).join('')}<p class="caption spacer">Research date: ${REVIEW_DATE}. Recheck fare, service area, and airport rules for your actual travel dates.</p>`,'transport');}
function startersSheet(){openSheet('A starting point, not a schedule',`<p class="sheet-subtitle">Choose a few ideas that appeal to you. These are suggestions, not bookings or a verified ranked list. Hours, fees, restaurant details, and exact entrances still need checking.</p><div class="stack">${STARTERS.map(p=>`<div class="card"><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food idea':'Place idea'}</span><h3 class="spacer">${e(p.name)}</h3><p lang="ko" class="small">${e(p.korean)}</p><p class="small muted">${e(p.note)}</p>${button('Add to my saved finds','add-starter','secondary',`data-id="${p.id}"`)}</div>`).join('')}</div>`,'starters');}
function preferences(){openSheet('Make it your trip',`<form data-form="preferences">${field('Trip name','name',state.prefs.name,'text','required maxlength="80"')}${field('Arrival date · Seoul','start',state.prefs.start,'date')}${field('Departure date · Seoul','end',state.prefs.end,'date')}<p class="form-help">Planning dates and the Today screen always use Asia/Seoul. Your actual dates have not been inferred.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Save trip settings</button></form>`,'preferences');}
async function readiness(){
 openSheet('Offline readiness','<p>Checking the copy on this device…</p>','readiness');
 const [offline,persistent,manifest]=await Promise.all([checkOffline(),navigator.storage?.persisted?.().catch(()=>false)??false,audioManifest()]);state.offline=offline;
 if(state.modalKind!=='readiness')return;
 const photos=await db.all('photos'),missing=state.places.filter(p=>p.photoId&&!photos.some(x=>x.id===p.photoId));
 const audioReady=manifest.reviewed&&PHRASES.every(p=>manifest.clips?.[p.id]);
 openSheet('Offline readiness',`<div class="notice ${offline.ready?'neutral':''}"><strong>${offline.ready?'App shell is cached on this device.':'App shell is not confirmed offline.'}</strong><p>${e(offline.ready?'The build files checked are present in the service-worker cache. This does not prove real-iPhone restart behavior.':offline.reason||'Deploy and open the app online before testing.')}</p></div><div class="card spacer"><div class="checkline">${icon('check')}<span>${state.places.length} saved finds in local storage.</span></div><div class="checkline">${icon(missing.length?'photo':'check')}<span>${missing.length?missing.length+' saved finds have missing photos.':photos.length+' local photos available.'}</span></div><div class="checkline">${icon('speak')}<span>${PHRASES.length} written Korean phrases included.</span></div><div class="checkline">${icon('volume')}<span>${audioReady?'Reviewed audio pack is configured. Test actual playback offline.':'Offline pronunciation is NOT verified. Device speech may be available; test each iPhone.'}</span></div><div class="checkline">${icon('won')}<span>${state.rate?'Exchange-rate reference saved, dated '+e(state.rate.date)+'.':'No exchange rate saved yet.'}</span></div><div class="checkline">${icon('lock')}<span>${state.vaultExists?'Encrypted stay vault is saved. Test unlocking offline.':'No stay vault saved yet.'}</span></div></div><p class="small spacer">Storage persistence: <strong>${persistent?'granted by this browser':'not granted or unavailable'}</strong>. Browser data can still be lost if you clear it or lose the device.</p>${button('Request persistent storage','persist','secondary full')}<h3 class="spacer">The test that matters</h3><p class="small">From the iPhone Home Screen, close the app, enable airplane mode, and reopen it. Open a saved photo, unlock the stay vault, convert a price, and play a phrase. Keep a backup outside the browser.</p><p class="caption">Live navigation, Naver search, social videos, rate refreshes, and phone calls are not made offline by this app. Install in Safari using Share → Add to Home Screen, then repeat setup inside the installed app.</p>`,'readiness');
}
function backupSheet(){openSheet('Encrypted trip backup',`<p class="sheet-subtitle">Includes your saved finds, local photos, and the already-encrypted stay vault. Save the file in Files or another location outside this app.</p><form data-form="backup">${field('Backup passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirm backup passphrase','confirm','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}<p class="form-help">You will need this passphrase to import the backup. Your stay vault retains its separate original passphrase.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Create encrypted backup</button></form>`,'backup');}
function restoreSheet(){openSheet('Restore as new copies',`<div class="notice neutral">Existing finds are never replaced. Imported finds become new copies. An existing stay vault is kept; a backup vault is imported only when this device has no vault.</div><form data-form="restore" class="spacer"><label>Encrypted backup file<input type="file" name="backup" required accept=".json,application/json"></label>${field('Backup passphrase','passphrase','','password','required maxlength="256" autocomplete="off"')}<p class="form-help">Maximum file size: 20 MB. Current trip dates and exchange-rate settings are preserved; re-enter those after restoring to a new device.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Import without overwriting</button></form>`,'restore');}
function connectionSheet(){openSheet('Naver search connection',`<p class="sheet-subtitle">The local app works without credentials. Optional Naver search uses a private server-side proxy and needs deployment secrets.</p><form data-form="connection">${field('Private API access token','token','','password','required minlength="32" maxlength="256" autocomplete="off"')}<p class="form-help">Codex creates this token during setup. It is held only in memory and cleared when the app is backgrounded. Never enter your Naver client secret here.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Use for this session</button></form><p class="caption spacer">This connects place search only. It does not enable multi-device sync.</p>`,'connection');}
function naverSheet(){openSheet('Find a place on Naver',`<p class="sheet-subtitle">Search a specific name and neighborhood. Review the returned details before saving.</p><form data-form="naver">${field('Place or food search','query','','search','required maxlength="100" placeholder="경복궁 or 홍대 카페"')}<p class="form-error" role="alert"></p><button class="primary full" type="submit">Search Naver</button></form><div id="naver-results" class="stack spacer"></div><p class="caption spacer">Search requires internet, Naver credentials on the server, and a private API token. Ratings, reviews, menus, hours, and photos are not supplied by this integration.</p>${button('Enter connection token','connection','text-button')}`,'naver');}
function phraseCard(id){const p=PHRASES.find(p=>p.id===id);if(!p)return;openSheet('Show this card',`<div class="show-card"><p class="korean" lang="ko">${e(p.ko)}</p><p class="english">${e(p.en)}</p><p class="phonetic">${e(p.phonetic)}</p><p class="caption">Romanization: ${e(p.roman)}</p>${p.note?`<p class="small">${e(p.note)}</p>`:''}${button(icon('volume')+' Listen','listen','primary','data-id="'+p.id+'"')}</div>`,'phrase');}
function printSheet(){openSheet('A separate fallback card',`<p class="sheet-subtitle">Print or save a PDF of emergency numbers and a few useful phrases. Door PINs, Wi-Fi passwords, and ordinary trip notes are never printed.</p><p class="small">${state.vault?'Your unlocked Korean address can be included.':'To include your address, unlock the stay vault and use its address card’s print button.'}</p>${button('Print non-sensitive card','print-now','primary full')}<p class="caption spacer">The print dialog is handled by your browser. Keep the saved PDF in Files, not just in browser storage.</p>`,'print');}
function printCard(includeAddress=false){
 const address=includeAddress&&state.vault?state.vault.addressKo:'';
 $('#print-panel').innerHTML=`<h1>Seoul Pocket · fallback card</h1>${address?`<h2>Our accommodation</h2><p class="print-korean" lang="ko">${e(address)}</p><p lang="ko">여기로 가 주세요.</p>`:''}<h2>Help in Korea</h2><p>112 · Police<br>119 · Ambulance / fire<br>1330 · Travel information and interpretation support</p><p>Calls need a working telephone connection. Check current non-emergency helpline hours on VISITKOREA.</p><h2>A few useful phrases</h2>${PHRASES.filter(p=>['thanks','help','restroom','here'].includes(p.id)).map(p=>`<p><strong>${e(p.en)}</strong><br><span class="print-korean" lang="ko">${e(p.ko)}</span><br>${e(p.phonetic)}</p>`).join('')}<p>Prepared ${e(seoulDate())}. Source: Visit Seoul safety and VISITKOREA 1330. This card deliberately excludes access PINs and passwords.</p>`;
 window.print();
}
window.addEventListener('afterprint',()=>{$('#print-panel').replaceChildren();});

function getPlace(id){const p=state.places.find(p=>p.id===id);if(!p)throw new Error('That saved find is no longer available.');return p;}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('Copied. Clipboard content may remain until replaced.');}catch{openSheet('Copy this text',`<p class="sheet-subtitle">Clipboard access was unavailable. Select and copy the text below.</p><textarea readonly rows="5">${e(value)}</textarea>`,'copy');}}
async function refreshRate(){
 const response=await fetch('/api/rates',{cache:'no-store',signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw new Error('Could not refresh the rate. Your saved rate is unchanged. Enter a manual rate if needed.');
 const rate=validateRate(await response.json());await db.setMeta('rate',rate);state.rate=rate;render();if(state.modalKind==='converter'){openSheet('Quick currency check',converterMarkup(),'converter');}toast('Reference rate saved on this device.');
}
function updateConverter(){
 const root=sheet.open&&sheet.querySelector('#convert-amount')?sheet:main,amount=root.querySelector('#convert-amount'),from=root.querySelector('#convert-from'),out=root.querySelector('#convert-result');if(!amount||!from||!out)return;
 root.querySelector('#convert-label').textContent=from.value==='USD'?'Estimated KRW':'Estimated USD';
 try{out.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:from.value==='USD'?'KRW':'USD',maximumFractionDigits:from.value==='USD'?0:2}).format(convert(amount.value,state.rate?.rate,from.value));}catch(err){out.textContent=state.rate?'Enter amount':'Set a rate';}
}

document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-action]');if(!b||b.disabled)return;
 const a=b.dataset.action,id=b.dataset.id;
 try{
  switch(a){
   case 'tab': if(sheet.open)closeSheet();state.tab=b.dataset.tab;location.hash=state.tab;render();window.scrollTo({top:0});main.focus({preventScroll:true});break;
   case 'close':closeSheet();break;
   case 'new':placeForm();break;
   case 'edit':placeForm(getPlace(id));break;
   case 'detail':showPlace(getPlace(id));break;
   case 'filter':state.filter=b.dataset.filter;render();break;
   case 'phrase-filter':state.phraseCategory=b.dataset.category;render();break;
   case 'priority':{const p=getPlace(id);await db.savePlace({...p,priority:!p.priority},p.rev);await load();render();break;}
   case 'visit':{const p=getPlace(id);await db.savePlace({...p,status:p.status==='visited'?'saved':'visited'},p.rev);await load();render();toast(p.status==='visited'?'Marked not visited.':'Marked as been there.');break;}
   case 'delete':{const p=getPlace(id);if(confirm('Delete “'+p.name+'” and its local photo?')){await db.deletePlace(p.id,p.rev);closeSheet(true);await load();render();toast('Deleted from this device.');}break;}
   case 'copy-address':await copy(getPlace(id).address);break;
   case 'stay':stayEntry();break;
   case 'stay-create':case 'stay-edit':stayForm();break;
   case 'lock':lockStay();stayEntry();break;
   case 'reveal-pin':state.pinVisible=!state.pinVisible;showStay();break;
   case 'copy-stay':if(state.vault)await copy(state.vault.addressKo);break;
   case 'address-card':if(state.vault){openSheet('Show your driver',`<div class="show-card"><p lang="ko" class="korean">여기로 가 주세요.</p><p class="english" lang="ko">${e(state.vault.addressKo)}</p><p class="small">Please take me here.</p></div><div class="row wrap">${button('Copy Korean address','copy-stay','secondary')}${button('Print address card','print-address','primary')}</div><p class="caption spacer">No door PIN or Wi-Fi password is shown here.</p>`,'stay-address');startIdle();}break;
   case 'print-address':printCard(true);break;
   case 'help':helpSheet();break;
   case 'transport':transportSheet();break;
   case 'starters':startersSheet();break;
   case 'add-starter':{const p=STARTERS.find(x=>x.id===id);if(p){await db.savePlace(cleanPlace({...p,id:crypto.randomUUID(),links:[p.sourceURL],source:'Seoul Pocket starter idea; check current details',priority:true}));await load();render();b.textContent='Added to saved';b.disabled=true;toast('Starter idea saved. Venue details still need checking.');}break;}
   case 'phrase-card':phraseCard(id);break;
   case 'listen':{const p=PHRASES.find(x=>x.id===id);if(p){const mode=await speakPhrase(p);toast(mode==='recording'?'Playing reviewed recording.':'Playing Korean device voice. Offline reliability still needs testing.');}break;}
   case 'preferences':preferences();break;
   case 'convert':openSheet('Quick currency check',converterMarkup(),'converter');break;
   case 'preset':{const root=sheet.open&&sheet.querySelector('#convert-amount')?sheet:main;root.querySelector('#convert-amount').value=b.dataset.value;updateConverter();break;}
   case 'refresh-rate':b.disabled=true;try{await refreshRate();}finally{b.disabled=false;}break;
   case 'manual-rate':openSheet('Set a reference rate',`<form data-form="rate">${field('KRW for exactly 1 USD','rate',state.rate?.rate||'','text','required inputmode="decimal" placeholder="Enter your checked rate"')}${field('Rate date','date',seoulDate(),'date','required')}<p class="form-help">Enter won per dollar, not dollars per won. The app does not include card fees.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Save manual rate</button></form>`,'manual-rate');break;
   case 'readiness':await readiness();break;
   case 'persist':toast(await requestPersistence()?'Persistent storage granted. Still keep backups.':'Persistence was not granted. Keep a separate backup.');await readiness();break;
   case 'backup':backupSheet();break;
   case 'restore':restoreSheet();break;
   case 'connection':connectionSheet();break;
   case 'naver':naverSheet();break;
   case 'import-naver':{const p=state.searchResults[Number(id)];if(p)placeForm({...p,id:undefined,kind:'place',checkedAt:''});break;}
   case 'print':printSheet();break;
   case 'print-now':printCard(false);break;
   case 'update':if(!sheet.open&&confirm('Reload into the prepared new version? Your saved data remains on this device.'))acceptUpdate(state.update);break;
  }
 }catch(err){toast(errorMessage(err));}
});

document.addEventListener('input',ev=>{
 if(ev.target.id==='place-search'){state.query=ev.target.value;$('#saved-results').innerHTML=savedResults();hydratePhotos($('#saved-results'));}
 if(ev.target.id==='phrase-search'){state.phraseQuery=ev.target.value;$('#phrase-results').innerHTML=phraseResults();}
 if(ev.target.id==='convert-amount')updateConverter();
});document.addEventListener('change',ev=>{if(ev.target.id==='convert-from')updateConverter();});

sheet.addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target;if(!form.dataset.form)return;
 const submit=form.querySelector('[type="submit"]'),errBox=form.querySelector('.form-error');submit.disabled=true;errBox.textContent='';
 const f=new FormData(form),values=Object.fromEntries(f);
 try{
  switch(form.dataset.form){
   case 'place':{
    const prior=state.places.find(p=>p.id===form.dataset.id),newPhoto=f.get('photo')?.size?await preparePhoto(f.get('photo')):null;
    const place=cleanPlace({...values,id:form.dataset.id,priority:f.has('priority'),photoId:newPhoto?.id||(f.has('removePhoto')?'':prior?.photoId||''),source:prior?.source||form.dataset.source||''});
    await db.savePlace(place,Number(form.dataset.rev),newPhoto);closeSheet(true);await load();render();toast('Saved on this device.');break;
   }
   case 'preferences':{
    if((values.start&&!validDate(values.start))||(values.end&&!validDate(values.end)))throw new Error('Choose valid dates.');
    if(values.start&&values.end&&values.end<values.start)throw new Error('Departure must be on or after arrival.');
    const prefs={name:text(values.name,80),start:values.start,end:values.end};await db.setMeta('prefs',prefs);state.prefs=prefs;closeSheet(true);render();toast('Trip settings saved.');break;
   }
   case 'stay':{
    if(values.passphrase!==values.confirm)throw new Error('The passphrases do not match.');
    const vault={name:text(values.name,140),addressKo:text(values.addressKo,500),addressEn:text(values.addressEn,500),pin:text(values.pin,100),room:text(values.room,100),wifi:text(values.wifi,150),wifiPassword:text(values.wifiPassword,150),phone:text(values.phone,60),note:text(values.note,2000)};
    if(!vault.addressKo)throw new Error('Add the Korean accommodation address.');
    const cipher=await seal(vault,values.passphrase,'stay');await db.setMeta('stay',cipher);state.vaultExists=true;lockStay();closeSheet(true);render();toast('Stay encrypted and saved. Make a recovery backup.');break;
   }
   case 'unlock':{
    const envelope=await db.getMeta('stay'),vault=await unseal(envelope,values.passphrase,'stay');
    if(document.hidden||!form.isConnected)break;
    state.vault=vault;state.formDirty=false;showStay();break;
   }
   case 'rate':{
    const newRate=validateRate({rate:parseAmount(values.rate),base:'USD',quote:'KRW',date:values.date,source:'manual'});await db.setMeta('rate',newRate);state.rate=newRate;closeSheet(true);render();toast('Manual reference rate saved.');break;
   }
   case 'backup':{
    if(values.passphrase!==values.confirm)throw new Error('The passphrases do not match.');
    const snap=await serializePhotos(await db.snapshot()),serialized=JSON.stringify(snap);if(new TextEncoder().encode(serialized).byteLength>13*1024*1024)throw new Error('This trip is too large for a 20 MB backup. Remove unneeded photos after saving them elsewhere.');
    const envelope=await seal(snap,values.passphrase,'backup');if(!form.isConnected||document.hidden)break;
    downloadFile(JSON.stringify(envelope),'seoul-pocket-backup-'+seoulDate()+'.json');state.formDirty=false;toast('Encrypted backup prepared. Confirm that the file appears in Files or your browser downloads.');break;
   }
   case 'restore':{
    const file=f.get('backup');if(!file?.size||file.size>20*1024*1024)throw new Error('Choose a backup smaller than 20 MB.');
    const envelope=JSON.parse(await file.text()),raw=await unseal(envelope,values.passphrase,'backup');if(!form.isConnected||document.hidden)break;
    const snap=deserializePhotos(raw);db.validateSnapshot(snap);const result=await db.restoreCopies(snap);closeSheet(true);await load();render();toast(`Imported ${result.count} finds as new copies.${result.staySkipped?' Existing stay vault kept.':result.stayImported?' Encrypted stay vault imported.':''}`);break;
   }
   case 'connection':{
    const token=text(values.token,256);if(!/^[a-zA-Z0-9_-]{32,256}$/.test(token))throw new Error('Use the generated private proxy token from setup.');state.apiToken=token;closeSheet(true);toast('Naver proxy token available until the app is backgrounded.');break;
   }
   case 'naver':{
    if(!state.apiToken)throw new Error('Enter the private connection token first. Manual saving works without Naver.');
    const res=await fetch('/api/naver?q='+encodeURIComponent(values.query),{headers:{Authorization:'Bearer '+state.apiToken},cache:'no-store',signal:AbortSignal.timeout(7000)});
    let data;try{data=await res.json();}catch{throw new Error('Naver proxy is not deployed here. Manual saving still works.');}
    if(!res.ok)throw new Error(data.error||'Naver search unavailable.');state.searchResults=Array.isArray(data.items)?data.items.slice(0,5):[];
    const area=sheet.querySelector('#naver-results');if(!area)break;area.innerHTML=state.searchResults.length?state.searchResults.map((p,i)=>`<div class="card"><h3>${e(p.name)}</h3><p class="small">${e(p.address)}</p><p class="caption">${e(p.category)}</p>${button('Review and save','import-naver','secondary',`data-id="${i}"`)}</div>`).join(''):'<p>No results. Try the Korean name and neighborhood.</p>';state.formDirty=false;break;
   }
  }
 }catch(err){if(errBox.isConnected)errBox.textContent=errorMessage(err);else toast(errorMessage(err));}
 finally{submit.disabled=false;}
});

window.addEventListener('online',connection);window.addEventListener('offline',connection);
window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(tabNames[t]){state.tab=t;render();}});
db.onOtherTabChange(()=>load().then(render).catch(err=>toast(errorMessage(err))));
async function start(){
 try{const hash=location.hash.slice(1);if(tabNames[hash])state.tab=hash;await load();render();
  registerWorker(r=>{state.update=r;render();});
  // Warm the voice list; this is not an offline-audio verification.
  if('speechSynthesis'in globalThis){speechSynthesis.getVoices();speechSynthesis.addEventListener('voiceschanged',()=>speechSynthesis.getVoices());}
 }catch(err){main.innerHTML=`<section class="card"><h1>Local storage needs attention.</h1><p>${e(errorMessage(err))}</p><p>Do not clear website data to troubleshoot unless you already have a backup. Try normal Safari and close other open copies.</p><h2>Emergency numbers in Korea</h2><p><a href="tel:112">112 · Police</a><br><a href="tel:119">119 · Ambulance / fire</a></p></section>`;}
}
setInterval(()=>{const clock=$('#seoul-clock');if(clock)clock.textContent=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit'}).format(new Date())+' KST';},30000);
start();
