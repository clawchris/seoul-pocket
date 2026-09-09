import * as db from './db.js';
import {cleanPlace,convert,parseAmount,validateRate,staleRate,seoulDate,mapLinks,safeURL,validDate,text} from './domain.js';
import {seal,unseal} from './crypto.js';
import {preparePhoto,serializePhotos,deserializePhotos,downloadFile} from './media.js';
import {registerWorker,checkOffline,requestPersistence,acceptUpdate} from './offline.js';
import {speakPhrase,stopSpeech,audioManifest} from './audio.js';
import {PHRASES,STARTERS,TRAVEL,REVIEW_DATE} from './data.js';
import {e,icon,button,external,field,textarea,choice,toast,errorMessage} from './ui.js';

import {ZONES,wallInput,wallToInstants,compareZones,zoneRow} from './timezones.js';
import {validateForecast,forecastState,formatTemperature,weatherDescription,WEATHER_REFRESH_MS,WEATHER_LOCATION} from './weather.js';
import {CHECKLIST,checklistProgress,checklistMetaKey} from './checklist.js';
import {LOCAL_IDEAS,LOCAL_TRANSIT,LOCAL_REVIEW_DATE} from './locality.js';
import {APPS} from './apps.js';
import {loadKakaoSdk,renderMap} from './map.js';
import {kakaoMapLinks} from './domain.js';
import {STAY_SEED} from './stay-seed.js';
import * as sync from './sync.js';
import {cleanStay,mergeStayAddress} from './stay.js';
const $=s=>document.querySelector(s);
const main=$('#main'),sheet=$('#sheet');
const state={tab:'today',places:[],prefs:{name:'Our Seoul trip',start:'',end:''},rate:null,filter:'all',query:'',phraseCategory:'All',phraseQuery:'',vault:null,vaultExists:false,pinVisible:false,formDirty:false,modalKind:'',update:null,apiToken:'',offline:null,searchResults:[],idle:0,toolPrefs:{currencyFrom:'KRW',weatherUnit:'C'},amount:'10000',weather:null,weatherBusy:false,weatherError:'',weatherAttempt:0,checklist:{},tz:{source:'seoul',instant:Date.now(),live:true,candidates:[],error:''},config:null,buzz:new Map()};
const photoURLs=new Map();
const tabNames={today:'Today',saved:'Saved',speak:'Speak',tools:'Tools',trip:'Trip'};
const statusNames={saved:'Want to go',planned:'Planned',visited:'Been there',skipped:'Skip for now'};
const navIcons={today:'home',saved:'pin',speak:'speak',tools:'tools',trip:'trip'};
const action=(name,id='')=>`data-action="${name}" ${id?`data-id="${e(id)}"`:''}`;

async function load(){
 [state.places,state.rate,state.vaultExists]=await Promise.all([db.all(),db.getMeta('rate'),db.getMeta('stay').then(Boolean)]);
 const prefs=await db.getMeta('prefs');if(prefs)state.prefs={...state.prefs,...prefs};
 state.trip=(await db.getMeta('trip'))||null;state.installHidden=!!(await db.getMeta('installHidden'));
 const [toolPrefs,weather,checks]=await Promise.all([db.getMeta('toolPrefs'),db.getMeta('weather'),Promise.all(CHECKLIST.map(x=>db.getMeta(checklistMetaKey(x.id))))]);
 if(toolPrefs){state.toolPrefs.currencyFrom=toolPrefs.currencyFrom==='USD'?'USD':'KRW';state.toolPrefs.weatherUnit=toolPrefs.weatherUnit==='F'?'F':'C';}
 try{state.weather=weather?validateForecast(weather):null;}catch{state.weather=null;state.weatherError='The saved forecast could not be read. Refresh online; other trip data is unchanged.';}
 state.checklist=Object.fromEntries(CHECKLIST.map((x,i)=>[x.id,checks[i]===true]));
 // Read existing data as text only; validate when writing or restoring.
 state.places.sort((a,b)=>(Number(b.priority)-Number(a.priority))||String(b.updatedAt).localeCompare(String(a.updatedAt)));
 for(const [id,url] of photoURLs)if(!state.places.some(p=>p.photoId===id)){URL.revokeObjectURL(url);photoURLs.delete(id);}
}
function ago(iso){const m=Math.round((Date.now()-Date.parse(iso))/60000);return !Number.isFinite(m)?'':m<1?'just now':m<60?m+' min ago':Math.round(m/60)+' h ago';}
function shareStatus(){const s=sync.status;if(!state.trip)return 'Saved on this device, not shared';if(s.signedOut)return 'Shared trip · signed out';if(s.conflicts)return `Shared trip · ${s.conflicts} to resolve`;if(s.pending)return `Shared trip · ${s.pending} waiting to send`;if(s.busy)return 'Shared trip · syncing';return s.lastSyncAt?'Shared trip · synced '+ago(s.lastSyncAt):'Shared trip · not synced yet';}
function syncLine(){const s=sync.status,parts=[];if(s.signedOut)parts.push('This phone is no longer a member. Leave and join again with a new invite.');else{parts.push(s.busy?'Syncing…':s.lastSyncAt?'Last synced '+ago(s.lastSyncAt)+'.':'Not synced yet.');if(s.pending)parts.push(`${s.pending} change${s.pending>1?'s':''} waiting to send.`);if(s.conflicts)parts.push(`${s.conflicts} find${s.conflicts>1?'s need':' needs'} a decision.`);if(s.error)parts.push(s.error);}return e(parts.join(' '));}
function connection(){
 $('#connection').innerHTML=`<div class="connection ${navigator.onLine?'':'offline'}"><span class="dot"></span>${navigator.onLine?'Connection detected':'Offline'}<span aria-hidden="true">·</span> ${e(shareStatus())}${state.update?' · Update available':''}</div>`;
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
 const progress=checklistProgress(state.checklist);
 return `<div class="home-layout"><section class="hero"><div class="row between"><span class="time" id="seoul-clock">${e(clock)} KST · Gwangjin</span></div><h1>Your Seoul trip.<br>Ready when you are.</h1><p>Your saved places, stay details, and everyday travel tools.</p><div class="hero-bottom"><span class="tag dark">${state.prefs.start?e(state.prefs.start+' → '+(state.prefs.end||'Set end date')):'Trip dates not set'}</span>${button(icon('arrow'),'preferences','hero-link','aria-label="Set trip dates"')}</div></section>
 <div class="grid2"><button class="quick-card" ${action('stay')}><span class="icon-tile">${icon('lock')}</span><strong>Our stay</strong><span class="caption">Address, Naver & entry details</span></button><button class="quick-card" ${action('convert')}><span class="icon-tile">${icon('won')}</span><strong>Currency</strong><span class="caption">KRW ⇄ USD · one-tap swap</span></button><button class="quick-card" ${action('transport')}><span class="icon-tile">${icon('train')}</span><strong>Get around</strong><span class="caption">Guui & Seoul transit</span></button><button class="quick-card" ${action('new')}><span class="icon-tile">${icon('plus')}</span><strong>Save a find</strong><span class="caption">Food, places & links</span></button></div></div>
 <section class="card spacer" data-weather="compact">${weatherMarkup(true)}</section>
 <button class="world-clock-strip spacer" ${action('timezone')} aria-label="Compare Seoul, Singapore and Cupertino time"><strong class="strip-title">Seoul, Singapore and Cupertino right now ${icon('arrow')}</strong><span class="world-clock-cells" data-live-clocks>${clockCells()}</span></button>
 <div class="row between spacer"><h2>Before you leave</h2>${button(`<span data-check-progress>${progress.done}/${progress.total} checked</span> ${icon('arrow')}`,'checklist','secondary')}</div>
 ${state.update?`<div class="notice neutral spacer">An app update is ready. ${button('Review & update','update','text-button')}</div>`:''}
 ${installCard()}
 <div class="section-head"><h2>Today’s stops</h2><span class="caption">${e(today)} · Seoul</span></div>
 ${planned.length?`<div class="places-grid">${planned.map(placeCard).join('')}</div>`:`<div class="empty"><h3>No stops planned for today.</h3><p>Keep it flexible. Save an idea, then choose a date when you are ready.</p>${button('Saved finds','tab','secondary','data-tab="saved"')}</div>`}
 <div class="card spacer"><h3>Ideas around your stay</h3><p class="small muted">Jayang market, Kondae food, Seongsu cafés, and east-Seoul green spaces.</p>${button('Browse local ideas','local-ideas','secondary full')}</div>`;
}

function placeCard(p){return `<article class="place-card"><button type="button" class="place-main" ${action('detail',p.id)}><span class="place-thumb ${p.kind}" ${p.photoId?`data-photo="${e(p.photoId)}"`:''}>${icon(p.kind==='food'?'food':'pin')}</span><span class="place-text"><h3>${e(p.name)}</h3><p>${e(p.korean||p.neighborhood||(p.kind==='food'?'Food idea':'Place idea'))}</p><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food & drink':'Place to go'}</span> ${p.conflict?'<span class="tag alert">Needs a decision</span> ':''}${p.time?`<span class="date-pill">${e(p.time)}</span>`:''}</span></button><div class="place-footer">${button(`${icon(p.status==='visited'?'check':'pin')}${e(statusNames[p.status]||'Want to go')}`,'visit',p.status==='visited'?'done':'',`data-id="${e(p.id)}" aria-label="${p.status==='visited'?'Mark not visited':'Mark visited'}: ${e(p.name)}"`)}${button(`${icon('star')}${p.priority?'Must-try':'Save as must-try'}`,'priority',p.priority?'starred':'',`data-id="${e(p.id)}" aria-pressed="${!!p.priority}"`)}</div></article>`;}
function filteredPlaces(){return state.places.filter(p=>{
 const filter=state.filter==='all'||p.kind===state.filter||(state.filter==='must'&&p.priority)||(state.filter==='visited'&&p.status==='visited');
 return filter&&[p.name,p.korean,p.neighborhood,p.note].join(' ').toLowerCase().includes(state.query.toLowerCase());
 });}
function savedView(){return `${pageTop('Worth a detour.','Restaurants, places, and the reel you do not want to lose.',button(icon('plus'),'new','icon-button','aria-label="Add a place or food idea"'))}
 <div class="search-field">${icon('search')}<input id="place-search" aria-label="Search saved places" type="search" placeholder="Name, neighborhood, or note" value="${e(state.query)}"></div>
 <div class="filters" aria-label="Filter saved places">${[['all','Everything'],['food','Food & drink'],['place','Places'],['must','Must-try checklist'],['visited','Been there']].map(([v,label])=>button(label,'filter','chip '+(state.filter===v?'active':''),`data-filter="${v}" aria-pressed="${state.filter===v}"`)).join('')}</div>
 <div id="saved-results">${savedResults()}</div>
 <div class="row wrap spacer">${button(icon('pin')+' Map','map','secondary')}${button('Near our stay','local-ideas','secondary')}${button('More Seoul ideas','starters','link-button')}${button('Search places','naver','link-button')}</div><p class="caption spacer">Saved items are on this device only. Group sync is specified, but not connected in this starter.</p>`;}
function savedResults(){const items=filteredPlaces();return items.length?`<p class="caption">${items.length} ${items.length===1?'find':'finds'} · Tap a card to see links, notes, and directions.</p><div class="places-grid">${items.map(placeCard).join('')}</div>`:`<div class="empty"><h3>${state.query?'No matches yet.':'Start with something you love.'}</h3><p>${state.query?'Try a different word, or clear your search.':'Add a place, a dish you want to try, or a link someone sent you. You can add the address later.'}</p>${button('Save a find','new','primary')}</div>`;}
function speakView(){return `${pageTop('A few words go a long way.','Tap to listen, or show a large Korean card.')}
 <div class="notice neutral">Pronunciation guides are approximate. Listen plays a bundled Korean voice that works offline; it is machine-generated, so show the Korean card when it matters.</div>
 <div class="search-field spacer">${icon('search')}<input id="phrase-search" aria-label="Search Korean phrases" type="search" placeholder="Try “water” or “subway”" value="${e(state.phraseQuery)}"></div>
 <div class="filters">${['All','Basics','Food','Transport','Help'].map(c=>button(c,'phrase-filter','chip '+(c===state.phraseCategory?'active':''),`data-category="${c}" aria-pressed="${c===state.phraseCategory}"`)).join('')}</div><div id="phrase-results">${phraseResults()}</div>`;}
function phraseResults(){const items=PHRASES.filter(p=>(state.phraseCategory==='All'||p.category===state.phraseCategory)&&[p.en,p.ko,p.roman].join(' ').toLowerCase().includes(state.phraseQuery.toLowerCase()));return `<div class="stack phrases-grid">${items.map(p=>`<article class="phrase"><div class="row between"><span class="english">${e(p.en)}</span><span class="tag gray">${e(p.category)}</span></div><p class="korean" lang="ko">${e(p.ko)}</p><p class="phonetic">${e(p.phonetic)}</p><div class="phrase-actions">${button(icon('volume')+' Listen','listen','secondary',`data-id="${p.id}" aria-label="Listen: ${e(p.en)}"`)}${button('Show card','phrase-card','link-button',`data-id="${p.id}"`)}</div></article>`).join('')}</div>${items.length?'':'<p>No matching phrases. Try another word.</p>'}`;}
function toolsView(){return `${pageTop('Everyday tools.','Currency, weather, and the three time zones you use.')}<div class="tool-columns"><section class="card"><div class="row between"><h2>Currency</h2>${icon('won')}</div>${converterMarkup()}</section><section>
 ${toolLink('Time zones','Seoul · Singapore · Cupertino (PT)','clock','timezone')}
 ${toolLink('Predeparture checklist','Your saved preparation checks','check','checklist')}
 ${toolLink('Transport guide','Guui, transit cards & routes','train','transport')}
 ${toolLink('Apps on your phone','Naver Map, Kakao Map, Papago, Kakao T','external','apps')}
 ${toolLink('Emergency & travel help','112 police · 119 ambulance / fire','shield','help')}
 </section></div><section class="card spacer" data-weather="detail">${weatherMarkup(false)}</section>`;}

function converterMarkup(){const from=state.toolPrefs.currencyFrom,to=from==='KRW'?'USD':'KRW',presets=from==='KRW'?['5000','10000','20000','50000']:['5','10','20','50'];
 return `<div class="converter" data-converter><div class="row between spacer"><span class="tag">${from==='KRW'?'Won to dollars':'Dollars to won'}</span>${button(`${from} ${icon('swap')} ${to}`,'swap-currency','secondary currency-toggle',`aria-label="Swap currencies: currently ${from} to ${to}"`)}</div><label class="spacer">Amount in ${from}<input id="convert-amount" class="rate-input" inputmode="decimal" value="${e(state.amount)}" autocomplete="off"></label><div class="rate-label" id="convert-label">Estimated ${to}</div>${state.rate?`<output class="rate-result" id="convert-result" aria-live="polite">${conversionResult()}</output>`:`<output class="caption rate-empty" id="convert-result" aria-live="polite">No rate saved yet.</output><div class="row wrap spacer">${button('Get a reference rate','refresh-rate','primary')}${button('Enter a rate','manual-rate','secondary')}</div>`}<div class="preset">${presets.map(v=>button(Number(v).toLocaleString('en-US'),'preset','',`data-value="${v}"`)).join('')}</div><p class="caption spacer">${state.rate?`${state.rate.source==='manual'?'Manual':'Reference'} rate · ${e(state.rate.date)}${staleRate(state.rate)?' · Over 72 hours old. Refresh before relying on it.':''}`:'No saved exchange rate.'}</p><p class="caption">Tap the arrow button to swap. The typed number stays the same.</p><details><summary>Exchange rate & source</summary><p id="rate-note" class="caption">${rateNote()}</p><div class="row wrap">${button('Refresh rate','refresh-rate','secondary')}${button('Enter rate','manual-rate','link-button')}</div><p class="caption spacer">Reference estimate only. Card and exchange fees are not included.</p></details></div>`;
}
function conversionResult(){const to=state.toolPrefs.currencyFrom==='KRW'?'USD':'KRW';try{return new Intl.NumberFormat('en-US',{style:'currency',currency:to,maximumFractionDigits:to==='KRW'?0:2}).format(convert(state.amount,state.rate?.rate,state.toolPrefs.currencyFrom));}catch{return state.rate?'Enter amount':'Set a rate';}}
function refreshConverterDOM(){document.querySelectorAll('[data-converter]').forEach(el=>{el.outerHTML=converterMarkup();});}

function rateNote(){return state.rate?`${state.rate.source==='manual'?'Manual rate':'Frankfurter reference'}: 1 USD = ${Number(state.rate.rate).toLocaleString('en-US',{maximumFractionDigits:4})} KRW. Dated ${e(state.rate.date)}.${staleRate(state.rate)?' More than 72 hours old; refresh before relying on it.':''}`:'No exchange rate has been saved yet. Refresh online, or enter a rate from a source you trust.';}
function toolLink(title,sub,ico,act){return `<button class="tool-link" ${action(act)}><span class="icon-tile">${icon(ico)}</span><div><strong>${title}</strong><span>${sub}</span></div>${icon('arrow')}</button>`;}
function tripView(){const progress=checklistProgress(state.checklist);if(!state.config)ensureConfig().then(()=>{if(state.tab==='trip')render();}).catch(()=>{});return `${pageTop(e(state.prefs.name||'Our Seoul trip'),'Your stay, backups, and preparation.')}<div class="tool-columns"><section><div class="card"><div class="row between"><h2>Our Guui stay</h2>${icon('lock')}</div><p class="small muted">${state.vaultExists?'Encrypted on this device. Unlock for the address, Naver directions and entry details.':'Your supplied address and coordinates are preconfigured in an encrypted seed. Use the private setup passphrase to load them on this phone.'}</p>${button(state.vaultExists?'Unlock stay':'Set up our stay','stay','primary full')}</div>
 <div class="section-head"><h2>Trip settings</h2></div>${toolLink('Install on your iPhone','Add to Home Screen from Safari','external','install')}${toolLink('Dates & trip name',state.prefs.start?e(state.prefs.start+' to '+state.prefs.end):'No travel dates set','clock','preferences')}${toolLink('Encrypted backup','Save a recovery copy outside this app','download','backup')}${toolLink('Restore a backup','Import new copies; keep existing data','trip','restore')}</section>
 <section><div class="card"><h2>Predeparture checklist</h2><p class="small"><span data-check-progress>${progress.done}/${progress.total} checked</span> · on this device</p><p class="caption">These are your confirmations, not an automatic guarantee that the app is trip-ready.</p>${button('Open checklist','checklist','primary full')}</div><details class="spacer"><summary>Offline checks & connections</summary>${toolLink('Technical offline check','Cache presence is not a cold-restart test','download','readiness')}${toolLink('Place search connection','Optional Kakao place search via the server','search','connection')}${toolLink('Print a fallback card','No entry PIN or Wi-Fi password','trip','print')}</details>${shareCard()}</section></div>`;}
function shareCard(){
 const t=state.trip,s=sync.status;
 if(!t&&state.config&&state.config.sync===false)return `<div class="notice neutral spacer"><strong>Local to this device.</strong><p class="small">Shared trips are not enabled on this deployment yet. Giving someone the Pages URL does not share local edits.</p></div>`;
 if(!t)return `<div class="card spacer"><h2>Share with your group</h2><p class="small">Saved finds sync between phones through an encrypted shared trip. Everyone needs the invite and the group passphrase; the server only stores ciphertext. Photos stay on each phone, and the stay vault is never shared.</p><div class="row wrap">${button('Create a shared trip','share-create','primary')}${button('Join with an invite','share-join','secondary')}</div></div>`;
 return `<div class="card spacer"><div class="row between"><h2>${e(t.name)}</h2><span class="tag">${e(t.role)}</span></div><p class="small">Shared trip on this phone${t.memberName?' as '+e(t.memberName):''}.</p><p class="small" data-sync-line>${syncLine()}</p>${s.conflicts?`<div class="notice"><strong>${s.conflicts} find${s.conflicts>1?'s have':' has'} two versions.</strong><p class="small">Someone changed it after your last sync. Nothing was overwritten; pick which copy to keep.</p>${button('Review','share-conflicts','secondary')}</div>`:''}<div class="row wrap spacer">${button('Sync now','share-sync','primary')}${t.role==='owner'?button('Invite','share-invite','secondary'):''}${button('Members','share-members','secondary')}${button('Leave on this phone','share-leave','link-button')}</div></div>`;
}
function shareCreateSheet(){openSheet('Create a shared trip',`<p class="sheet-subtitle">You become the owner and get an invite to pass on. Choose a group passphrase and share it in person or by a channel you trust; it never reaches the server.</p><form data-form="share-create">${field('Trip name','name',state.prefs.name||'','text','required maxlength="80"')}${field('Your name (shown to the group)','memberName','','text','maxlength="40" autocomplete="nickname"')}${field('Group passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirm group passphrase','confirm','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}<label class="checkbox-label"><input type="checkbox" data-reveal> Show passphrases</label><p class="form-help">Nothing else is needed. Being in a trip also switches on place search and blog buzz on this phone.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Create and share this phone’s finds</button></form>`,'share-create');}
function shareJoinSheet(){openSheet('Join a shared trip',`<p class="sheet-subtitle">Paste the invite the owner sent and type the group passphrase they told you. Finds already on this phone are shared with the group too.</p><form data-form="share-join">${field('Invite','invite','','text','required maxlength="40" autocomplete="off" spellcheck="false" placeholder="16 characters, dash, 8-character code"')}${field('Your name (shown to the group)','memberName','','text','maxlength="40" autocomplete="nickname"')}${field('Group passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="off"')}<label class="checkbox-label"><input type="checkbox" data-reveal> Show passphrase</label><p class="form-help">A wrong passphrase is only noticed when the first shared find fails to decrypt. Leave the trip and join again to fix it.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Join and sync</button></form>`,'share-join');}
function shareInviteSheet(){const t=state.trip;if(!t)return;openSheet('Invite your group',`<p class="sheet-subtitle">Send this invite plus the group passphrase, separately. The invite works for up to 12 joins and expires ${t.invite?.expiresAt?'on '+e(t.invite.expiresAt.slice(0,10)):'in 30 days'}.</p><p class="invite-code" data-invite>${e(sync.inviteText(t)||'No invite on this phone. Make a new one.')}</p><div class="row wrap">${button('Copy invite','copy-invite','primary')}${button('New invite code','share-rotate','secondary')}</div><p class="caption spacer">A new code stops the old one immediately. Members who already joined keep their access.</p>`,'share-invite');}
async function membersSheet(){openSheet('Trip members','<p>Loading…</p>','share-members');try{const r=await sync.members();if(state.modalKind!=='share-members')return;sheet.querySelector('.sheet-body').innerHTML=`<div class="stack">${r.members.map(m=>`<div class="card"><strong>${e(m.name||'Traveler')}</strong><p class="caption">${e(m.role)}${m.lastSeenAt?' · seen '+e(ago(m.lastSeenAt)):''}</p></div>`).join('')}</div><p class="caption spacer">Names are self-chosen and unverified. Members cannot be removed; rotate the invite and start a new trip if the group changes.</p>`;}catch(err){if(state.modalKind==='share-members')sheet.querySelector('.sheet-body').innerHTML=`<p class="form-error" role="alert">${e(errorMessage(err))}</p>`;}}
function conflictsSheet(){const list=state.places.filter(p=>p.conflict);openSheet('Finds with two versions',list.length?`<p class="sheet-subtitle">Open each one and choose Keep mine or Use shared. Your copy is not changed until you decide.</p><div class="stack">${list.map(p=>`<div class="card"><h3>${e(p.name)}</h3>${button('Open','detail','secondary',`data-id="${e(p.id)}"`)}</div>`).join('')}</div>`:'<p>Nothing needs a decision.</p>','share-conflicts');}


function openSheet(title,content,kind='generic'){
 $('#print-panel').replaceChildren();
 if(state.closing){clearTimeout(state.closeTimer);state.closing=false;sheet.classList.remove('closing');}
 state.formDirty=false;state.modalKind=kind;
 sheet.innerHTML=`<div class="sheet-header"><h2 id="sheet-title">${title}</h2>${button(icon('close'),'close','icon-button','aria-label="Close panel"')}</div><div class="sheet-body">${content}</div>`;
 if(!sheet.open)sheet.showModal();sheet.scrollTop=0;hydratePhotos(sheet);
}
const weakPassphrase=p=>p.length<20&&p.trim().split(/\s+/).length<3;
async function isSetupPassphrase(p){try{await unseal(STAY_SEED.envelope,p,'stay');return true;}catch{return false;}}
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function closeSheet(force=false,immediate=false){
 if(!sheet.open)return;
 if(state.closing){if(!immediate)return;clearTimeout(state.closeTimer);state.closing=false;}
 else if(state.formDirty&&!force&&!confirm('Discard the changes in this open form? Your saved copy will be kept.'))return;
 state.formDirty=false;
 // Immediate closes are the lock paths: empty the DOM synchronously so secrets never wait on the queued close event.
 if(immediate||reducedMotion()||document.hidden){if(immediate)sheet.innerHTML='';sheet.close();return;}
 // Exit the way it entered: slide back down, then close. Only the sheet's own transform counts; a timer guards a missing event.
 state.closing=true;sheet.classList.add('closing');
 const done=ev=>{if(ev&&(ev.target!==sheet||ev.propertyName!=='transform'))return;if(!state.closing)return;state.closing=false;sheet.removeEventListener('transitionend',done);clearTimeout(state.closeTimer);sheet.close();};
 sheet.addEventListener('transitionend',done);state.closeTimer=setTimeout(done,240);
}
function lockStay(){state.vault=null;state.pinVisible=false;clearTimeout(state.idle);}
sheet.addEventListener('close',()=>{lockStay();state.modalKind='';state.formDirty=false;state.closing=false;sheet.classList.remove('closing');sheet.innerHTML='';stopSpeech();});
sheet.addEventListener('cancel',ev=>{ev.preventDefault();closeSheet();});
sheet.addEventListener('input',()=>{if(sheet.querySelector('form'))state.formDirty=true;});
function startIdle(){clearTimeout(state.idle);if(state.vault)state.idle=setTimeout(()=>{lockStay();if(sheet.open){closeSheet(true,true);toast('Stay vault locked after 3 minutes without activity.');}},180000);}
document.addEventListener('pointerdown',startIdle,{passive:true});document.addEventListener('keydown',startIdle);
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.apiToken='';stopSpeech();const sensitive=!!state.vault||state.modalKind.startsWith('stay')||state.modalKind==='connection'||state.modalKind==='backup'||state.modalKind==='restore'||state.modalKind==='share-create'||state.modalKind==='share-join';lockStay();if(sensitive)closeSheet(true,true);}else {load().then(render).then(maybeRefreshWeather).catch(err=>toast(errorMessage(err)));}});

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
 ${field('Name *','name',p.name,'text','required maxlength="140"')}<p class="form-help">A restaurant, a place, or a dish. This is the only required field.</p>
 <div class="form-grid">${choice('Type','kind',[['food','Food & drink'],['place','Place to go']],p.kind||'food')}${choice('Status','status',Object.entries(statusNames),p.status||'saved')}</div>
 ${field('Korean name','korean',p.korean,'text','lang="ko" maxlength="140"')}<p class="form-help">Useful when searching or showing a driver.</p>
 ${field('Neighborhood','neighborhood',p.neighborhood,'text','maxlength="100" placeholder="For example, Guui or Seongsu"')}
 ${field('Korean address','address',p.address,'text','maxlength="350"')}
 ${textarea('Why we saved it / useful notes','note',p.note,'maxlength="3000" placeholder="What to order, reservation details, who recommended it…"')}
 ${textarea('Links, one per line','links',(p.links||[]).join('\n'),'placeholder="https://…\nReels, TikToks, Naver, menus, or booking pages"')}
 <p class="form-help">Links open externally and need a connection. Upload your own screenshot to keep a useful visual offline. Never paste the door PIN into ordinary notes.</p>
 <label>Photo or screenshot<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="form-help">JPEG, PNG, or WebP up to 15 MB. Stored only on this device, compressed locally. No video download or automatic social preview.</p>
 ${p.photoId?`<label class="checkbox-label"><input name="removePhoto" type="checkbox"> Remove current photo</label>`:''}
 <label class="checkbox-label"><input name="priority" type="checkbox" ${p.priority?'checked':''}> Make this a must-try</label>
 <div class="form-grid">${field('Planned date · Seoul','date',p.date,'date')}${field('Time, optional · Seoul','time',p.time,'time')}</div>
 <details><summary>Directions and verification</summary><div class="form-grid">${field('Latitude, optional','lat',p.lat??'','text','inputmode="decimal"')}${field('Longitude, optional','lng',p.lng??'','text','inputmode="decimal"')}</div><p class="form-help">Both coordinates are needed for direct walking or transit handoff. Otherwise the app opens a Naver search by name.</p>${field('Details last checked','checkedAt',p.checkedAt,'date')}<p class="form-help">This is your verification date, not a claim that the venue is currently open.</p></details>
 <p class="form-error" role="alert"></p><div class="form-actions">${button('Cancel','close','secondary')}<button class="primary" type="submit">Save on this device</button></div></form>`,'place');
}
async function showPlace(p){
 const links=mapLinks(p,location.origin),c=p.conflict?await db.getConflict(p.id):null;
 const diff=c&&!c.deleted&&c.remote?['name','korean','note','address','date','time','status','priority'].filter(f=>String(c.remote[f]??'')!==String(p[f]??'')):[];
 openSheet(e(p.name),`${c?`<div class="notice"><strong>Two versions of this find.</strong><p class="small">${c.deleted?'Someone deleted the shared copy after you changed it.':diff.length?'The shared copy differs in '+e(diff.join(', '))+'.'+(diff.includes('name')?' Shared name: “'+e(c.remote.name)+'”.':'')+(diff.includes('note')?' Shared note: “'+e(String(c.remote.note).slice(0,140))+'”.':''):'The shared copy was updated by someone else.'} Your copy is shown below and stays until you choose.</p><div class="row wrap">${button('Keep mine','conflict-mine','primary',`data-id="${e(p.id)}"`)}${button(c.deleted?'Delete mine too':'Use shared','conflict-shared','secondary',`data-id="${e(p.id)}"`)}</div></div>`:''}${p.photoId?`<div class="detail-image" data-photo="${e(p.photoId)}"></div>`:''}<div class="row wrap"><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food & drink':'Place to go'}</span><span class="tag gray">${e(statusNames[p.status])}</span>${p.priority?'<span class="tag warm">Must-try</span>':''}</div>
 ${p.korean?`<p class="ko-title spacer" lang="ko">${e(p.korean)}</p>`:''}${p.address?`<p lang="ko">${e(p.address)}</p>${button('Copy address','copy-address','secondary',`data-id="${e(p.id)}"`)}`:''}
 ${p.date?`<p class="small spacer">Planned: ${e(p.date)} ${e(p.time)} · Seoul time</p>`:''}
 <p class="detail-note spacer">${e(p.note||'No notes yet.')}</p><div class="detail-links">${external('Open Naver Maps app',links.app)}${external('Open Naver in browser',links.web)}${links.transit?external('Public transit directions',links.transit):''}${links.walk?external('Walking directions',links.walk):''}${kakaoMapLinks(p)?external('Open in Kakao Map',kakaoMapLinks(p).look):''}</div>
 <div class="buzz spacer" data-buzz="${e(p.id)}">${buzzMarkup(p)}</div><p class="caption spacer">Naver app buttons require the Naver Maps app. Browser search and copy-address are the fallbacks. Directions and opening information are not stored offline.</p>
 ${(p.links||[]).length?`<h3>Saved links</h3><div class="detail-links">${p.links.map((u,i)=>safeURL(u)?external(e(new URL(u).hostname)+' · link '+(i+1),safeURL(u)):'').join('')}</div>`:''}
 <p class="caption spacer">Details ${p.checkedAt?'last checked '+e(p.checkedAt):'have not been verified'}. ${p.source?e(p.source):'Added by you.'}</p>
 <div class="form-actions">${button('Edit','edit','primary',`data-id="${e(p.id)}"`)}${button('Delete','delete','danger-button',`data-id="${e(p.id)}"`)}</div>`,'detail');
}
function stayEntry(){
 if(state.vault)return showStay();
 openSheet('Our stay',`<div class="vault-locked"><span class="icon-tile">${icon('lock')}</span><h3>${state.vaultExists?'Your stay is locked.':'A safe place for the essentials.'}</h3><p>${state.vaultExists?'The address, door PIN, and Wi-Fi details are encrypted on this device.':'Use a separate vault passphrase, not the building’s door PIN. There is no password-reset service.'}</p></div>
 ${state.vaultExists?`<form data-form="unlock">${field('Vault passphrase','passphrase','','password','required autocomplete="current-password" maxlength="256"')}<p class="form-error" role="alert"></p><button class="primary full" type="submit">Unlock stay</button></form>`:`${button('Load preconfigured stay','seed-stay','primary full')}<p class="caption spacer">The setup passphrase is in the private owner notes you were given. It is not the door PIN.</p>${button('Create a different stay','stay-create','link-button full')}`}
 <p class="caption spacer">The vault locks when this app is backgrounded, the panel is closed, or after 3 minutes of inactivity. Keep the passphrase in your password manager.</p>`,'stay-unlock');
}
function stayForm(){
 const v=state.vault||{};
 openSheet(state.vaultExists?'Edit stay vault':'Create stay vault',`<form data-form="stay">
 ${field('Accommodation name','name',v.name,'text','maxlength="140"')}${textarea('Address in Korean *','addressKo',v.addressKo,'required maxlength="500" lang="ko"')}${textarea('Address in English, optional','addressEn',v.addressEn,'maxlength="500"')}
 <details><summary>Coordinates for Naver directions</summary><div class="form-grid">${field('Stay latitude','lat',v.lat??'','text','inputmode="decimal"')}${field('Stay longitude','lng',v.lng??'','text','inputmode="decimal"')}</div></details>
 ${field('Door / building entry PIN','pin',v.pin,'password','maxlength="100" autocomplete="off"')}${field('Room / unit','room',v.room,'text','maxlength="100"')}
 ${field('Wi-Fi name','wifi',v.wifi,'text','maxlength="150"')}${field('Wi-Fi password','wifiPassword',v.wifiPassword,'password','maxlength="150" autocomplete="off"')}
 ${field('Host or hotel phone','phone',v.phone,'tel','maxlength="60"')}${textarea('Arrival, check-in, and access notes','note',v.note,'maxlength="2000"')}
 <h3>Protect this vault</h3>${field(state.vaultExists?'Passphrase to encrypt this version':'Choose a vault passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirm passphrase','confirm','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}<label class="checkbox-label"><input type="checkbox" data-reveal> Show passphrases</label>
 <p class="form-help">At least three words or 20 characters. Use a long, unique passphrase. Losing it means losing access unless you have another usable copy. Do not use your short door PIN as the passphrase.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Encrypt and save stay</button></form>`,'stay-edit');
}
function showStay(){
 const v=state.vault;if(!v)return stayEntry();const maps=mapLinks({name:'Our stay',korean:'숙소',address:v.addressKo,lat:v.lat,lng:v.lng},location.origin);
 openSheet('Our stay',`<div class="row between"><span class="tag">Unlocked on this device</span>${button('Lock now','lock','text-button')}</div><h3 class="spacer">${e(v.name||'Our accommodation')}</h3><p lang="ko" class="ko-title">${e(v.addressKo)}</p>${v.addressEn?`<p>${e(v.addressEn)}</p>`:''}
 <div class="row wrap">${button('Show address card','address-card','primary')}${button('Copy Korean address','copy-stay','secondary')}</div>
 <div class="detail-links spacer">${maps.transit?external('Directions to our stay',maps.transit):external('Our stay in Naver Maps',maps.app)}${external('Naver browser fallback',maps.web)}</div>
 ${v.pin?`<div class="secret"><span class="secret-label">Entry PIN</span><div class="row between"><span class="pin-value">${state.pinVisible?e(v.pin):'••••'}</span>${button(state.pinVisible?'Hide':'Reveal','reveal-pin','secondary')}</div></div>`:''}
 ${v.room?`<p class="small spacer"><strong>Room / unit:</strong> ${e(v.room)}</p>`:''}${v.wifi?`<p class="small"><strong>Wi-Fi:</strong> ${e(v.wifi)}</p>`:''}${v.wifiPassword?`<details class="secret"><summary>Wi-Fi password</summary><p>${e(v.wifiPassword)}</p></details>`:''}${v.phone?`<p class="small"><strong>Host phone:</strong> ${e(v.phone)}</p>`:''}${v.note?`<p class="detail-note">${e(v.note)}</p>`:''}
 <p class="caption">The door PIN is never placed in map links or the printed fallback card. Avoid screenshots containing it.</p>${button('Edit stay','stay-edit','link-button full')}<details><summary>Use the address supplied for this trip</summary><p class="caption">Load the encrypted preconfigured address without discarding your PIN, Wi-Fi or other stay fields. You review and save the change.</p>${button('Use supplied address','merge-stay','secondary full')}</details>`,'stay-view');startIdle();
}
function helpSheet(){openSheet('Help in Korea',`<p class="sheet-subtitle">Emergency numbers are available in this app offline. Calling still needs a working telephone connection.</p><div class="emergency-grid"><a href="tel:112"><strong>112</strong>Police</a><a href="tel:119"><strong>119</strong>Ambulance / fire</a></div><div class="card spacer"><h3>1330 travel helpline</h3><p class="small">Travel information and interpretation support. Use the official site for current service hours and online call/chat options.</p><div class="row wrap"><a class="secondary" href="tel:1330">Call 1330</a>${external('Online help','https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140632')}</div></div><p class="caption spacer">A data-only SIM may not provide regular voice calling. Check your phone plan before travel. This app does not contact emergency services automatically.</p>${button('Show “Please help me”','phrase-card','secondary full','data-id="help"')}<p class="source-link spacer">Sources reviewed ${REVIEW_DATE}: ${external('Visit Seoul safety','https://english.visitseoul.net/safety')}</p>`,'help');}
function transportSheet(){openSheet('Getting around Seoul',`<div class="notice neutral">Let Naver Maps handle live routes. Keep names, exit numbers, and screenshots here for the moments without signal.</div>${[...LOCAL_TRANSIT,...TRAVEL].map(t=>`<section class="spacer"><h3>${e(t.title)}</h3><p class="small">${e(t.body)}</p>${external('Official information',t.source)}</section>`).join('')}<p class="caption spacer">Research date: ${REVIEW_DATE}. Recheck fare, service area, and airport rules for your actual travel dates.</p>`,'transport');}
function startersSheet(local=false){const items=local?LOCAL_IDEAS:STARTERS;openSheet(local?'Around Guui & east Seoul':'More Seoul ideas',`<p class="sheet-subtitle">${local?'Ideas informed by your stay in Gwangjin.':'A starting point, not a ranked list.'} Choose only what appeals to you. These are not bookings, verified hours or measured walking routes.</p><div class="stack">${items.map(p=>{const saved=state.places.some(x=>x.source==='idea:'+p.id);return `<div class="card"><span class="tag ${p.kind==='food'?'warm':''}">${p.kind==='food'?'Food idea':'Place idea'}</span><h3 class="spacer">${e(p.name)}</h3><p lang="ko" class="small">${e(p.korean)}</p><p class="caption">${e(p.neighborhood||'Seoul')}</p><p class="small muted">${e(p.note)}</p><div class="row wrap">${button(saved?'Already saved':'Add to saved finds','add-starter','secondary',`data-id="${p.id}" ${saved?'disabled':''}`)}${external('Source',p.sourceURL)}</div></div>`;}).join('')}</div><p class="caption spacer">Sources checked ${LOCAL_REVIEW_DATE}. Verify the exact destination and current opening details in Naver before heading out.</p>`,local?'local-ideas':'starters');}

function preferences(){openSheet('Make it your trip',`<form data-form="preferences">${field('Trip name','name',state.prefs.name,'text','required maxlength="80"')}${field('Arrival date · Seoul','start',state.prefs.start,'date')}${field('Departure date · Seoul','end',state.prefs.end,'date')}<p class="form-help">Planning dates and the Today screen always use Asia/Seoul. Your actual dates have not been inferred.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Save trip settings</button></form>`,'preferences');}
async function readiness(){
 openSheet('Offline readiness','<p>Checking the copy on this device…</p>','readiness');
 const [offline,persistent,manifest]=await Promise.all([checkOffline(),navigator.storage?.persisted?.().catch(()=>false)??false,audioManifest()]);state.offline=offline;
 if(state.modalKind!=='readiness')return;
 const photos=await db.all('photos'),missing=state.places.filter(p=>p.photoId&&!photos.some(x=>x.id===p.photoId));
 const clipsComplete=PHRASES.every(p=>manifest.clips?.[p.id]),audioReady=manifest.reviewed&&clipsComplete,audioGenerated=!manifest.reviewed&&manifest.generated&&clipsComplete;
 openSheet('Offline readiness',`<div class="notice ${offline.ready?'neutral':''}"><strong>${offline.ready?'App shell is cached on this device.':'App shell is not confirmed offline.'}</strong><p>${e(offline.ready?'The build files checked are present in the service-worker cache. This does not prove real-iPhone restart behavior.':offline.reason||'Deploy and open the app online before testing.')}</p></div><div class="card spacer"><div class="checkline">${icon('check')}<span>${state.places.length} saved finds in local storage.</span></div><div class="checkline">${icon(missing.length?'photo':'check')}<span>${missing.length?missing.length+' saved finds have missing photos.':photos.length+' local photos available.'}</span></div><div class="checkline">${icon('speak')}<span>${PHRASES.length} written Korean phrases included.</span></div><div class="checkline">${icon('volume')}<span>${audioReady?'Reviewed audio pack is configured. Test actual playback offline.':audioGenerated?'Bundled Korean voice for all '+PHRASES.length+' phrases is cached offline. It is machine-generated and not yet native-speaker reviewed.':'Offline pronunciation is NOT verified. Device speech may be available; test each iPhone.'}</span></div><div class="checkline">${icon('won')}<span>${state.rate?'Exchange-rate reference saved, dated '+e(state.rate.date)+'.':'No exchange rate saved yet.'}</span></div><div class="checkline">${icon('lock')}<span>${state.vaultExists?'Encrypted stay vault is saved. Test unlocking offline.':'No stay vault saved yet.'}</span></div></div><p class="small spacer">Storage persistence: <strong>${persistent?'granted by this browser':'not granted or unavailable'}</strong>. Browser data can still be lost if you clear it or lose the device.</p>${button('Request persistent storage','persist','secondary full')}<h3 class="spacer">The test that matters</h3><p class="small">From the iPhone Home Screen, close the app, enable airplane mode, and reopen it. Open a saved photo, unlock the stay vault, convert a price, and play a phrase. Keep a backup outside the browser.</p><p class="caption">Live navigation, place search, social videos, weather/rate refreshes, and phone calls are not made offline by this app. Install in Safari using Share → Add to Home Screen, then repeat setup inside the installed app.</p>`,'readiness');
}
function backupSheet(){openSheet('Encrypted trip backup',`<p class="sheet-subtitle">Includes your saved finds, local photos, checklist records, and the already-encrypted stay vault. Save the file in Files or another location outside this app.</p><form data-form="backup">${field('Backup passphrase','passphrase','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirm backup passphrase','confirm','','password','required minlength="12" maxlength="256" autocomplete="new-password"')}<label class="checkbox-label"><input type="checkbox" data-reveal> Show passphrases</label><p class="form-help">You will need this passphrase to import the backup. Your stay vault retains its separate original passphrase.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Create encrypted backup</button></form>`,'backup');}
function restoreSheet(){openSheet('Restore as new copies',`<div class="notice neutral">Existing finds are never replaced. Imported finds become new copies. An existing stay vault is kept; a backup vault is imported only when this device has no vault.</div><form data-form="restore" class="spacer"><label>Encrypted backup file<input type="file" name="backup" required accept=".json,application/json"></label>${field('Backup passphrase','passphrase','','password','required maxlength="256" autocomplete="off"')}<p class="form-help">Maximum file size: 20 MB. Current trip dates and exchange-rate settings are preserved; re-enter those after restoring to a new device. General preparation checks import only when missing. This phone’s technical checks are not imported as completed.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">Import without overwriting</button></form>`,'restore');}
function connectionSheet(){openSheet('Place search connection',`<p class="sheet-subtitle">The local app works without credentials. Optional place search (Kakao Local) uses a private server-side proxy and needs deployment secrets.</p><form data-form="connection">${field('Private API access token','token','','password','required minlength="32" maxlength="256" autocomplete="off"')}<p class="form-help">The setup notes for this deployment include this token. It is held only in memory and cleared when the app is backgrounded. Never enter the Kakao REST API key here; that stays on the server.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Use for this session</button></form><p class="caption spacer">Only needed on a phone that is not in a shared trip; membership already covers search and buzz.</p>`,'connection');}
function naverSheet(){openSheet('Find a place',`<p class="sheet-subtitle">Search a specific name and neighborhood. Review the returned details before saving.</p><form data-form="naver">${field('Place or food search','query','','search','required maxlength="100" placeholder="경복궁 or 홍대 카페"')}<p class="form-error" role="alert"></p><button class="primary full" type="submit">Search places</button></form><div id="naver-results" class="stack spacer"></div><p class="caption spacer">Search requires internet and either a shared-trip membership or the setup token. Results come from Kakao Local: name, address, category, coordinates and a Kakao Map link. Ratings, reviews, menus, hours and photos are not supplied.</p>${state.trip?'':button('Set up sharing','share-create','text-button')}`,'naver');}
function phraseCard(id){const p=PHRASES.find(p=>p.id===id);if(!p)return;openSheet('Show this card',`<div class="show-card"><p class="korean" lang="ko">${e(p.ko)}</p><p class="english">${e(p.en)}</p><p class="phonetic">${e(p.phonetic)}</p><p class="caption">Romanization: ${e(p.roman)}</p>${p.note?`<p class="small">${e(p.note)}</p>`:''}${button(icon('volume')+' Listen','listen','primary','data-id="'+p.id+'"')}</div>`,'phrase');}
function printSheet(){openSheet('A separate fallback card',`<p class="sheet-subtitle">Print or save a PDF of emergency numbers and a few useful phrases. Door PINs, Wi-Fi passwords, and ordinary trip notes are never printed.</p><p class="small">${state.vault?'Your unlocked Korean address can be included.':'To include your address, unlock the stay vault and use its address card’s print button.'}</p>${button('Print non-sensitive card','print-now','primary full')}<p class="caption spacer">The print dialog is handled by your browser. Keep the saved PDF in Files, not just in browser storage.</p>`,'print');}
function printCard(includeAddress=false){
 const address=includeAddress&&state.vault?state.vault.addressKo:'';
 $('#print-panel').innerHTML=`<h1>Seoul Pocket · fallback card</h1>${address?`<h2>Our accommodation</h2><p class="print-korean" lang="ko">${e(address)}</p><p lang="ko">여기로 가 주세요.</p>`:''}<h2>Help in Korea</h2><p>112 · Police<br>119 · Ambulance / fire<br>1330 · Travel information and interpretation support</p><p>Calls need a working telephone connection. Check current non-emergency helpline hours on VISITKOREA.</p><h2>A few useful phrases</h2>${PHRASES.filter(p=>['thanks','help','restroom','here'].includes(p.id)).map(p=>`<p><strong>${e(p.en)}</strong><br><span class="print-korean" lang="ko">${e(p.ko)}</span><br>${e(p.phonetic)}</p>`).join('')}<p>Prepared ${e(seoulDate())}. Source: Visit Seoul safety and VISITKOREA 1330. This card deliberately excludes access PINs and passwords.</p>`;
 window.print();
}
window.addEventListener('afterprint',()=>{$('#print-panel').replaceChildren();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)$('#print-panel').replaceChildren();});

const proxyToken=()=>state.apiToken||state.trip?.memberToken||'';
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function installCard(){if(installed()||state.installHidden)return '';return `<section class="notice neutral spacer" data-install-card><strong>Put Seoul Pocket on your Home Screen.</strong><p class="small">From the Home Screen icon it opens full screen, keeps working offline and stays signed in to the shared trip.</p><div class="row wrap">${button('Show me how','install','primary')}${button('Not now','install-hide','text-button')}</div></section>`;}
function installSheet(){openSheet('Add to Home Screen',`<p class="sheet-subtitle">${installed()?'You are already using the Home Screen app.':'Takes about ten seconds in Safari.'}</p><ol class="steps"><li>Open <strong>seoul-pocket.pages.dev</strong> in <strong>Safari</strong>, not in a browser inside another app.</li><li>Tap the <strong>Share</strong> button, the square with an arrow pointing up, at the bottom of the screen.</li><li>Scroll the list and tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> in the top right. The icon says Seoul Pocket.</li><li>Open it from that icon from now on. Saved finds, the stay vault and the shared trip on the Safari tab and on the icon are the same data, because both live in this iPhone's Safari storage.</li></ol><p class="caption spacer">If Add to Home Screen is missing, you are in an in-app browser. Tap the compass or “Open in Safari” first.</p>`,'install');}
function getPlace(id){const p=state.places.find(p=>p.id===id);if(!p)throw new Error('That saved find is no longer available.');return p;}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('Copied. Clipboard content may remain until replaced.');}catch{openSheet('Copy this text',`<p class="sheet-subtitle">Clipboard access was unavailable. Select and copy the text below.</p><textarea readonly rows="5">${e(value)}</textarea>`,'copy');}}
async function refreshRate(){
 const response=await fetch('/api/rates',{cache:'no-store',signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw new Error('Could not refresh the rate. Your saved rate is unchanged. Enter a manual rate if needed.');
 const rate=validateRate(await response.json());await db.setMeta('rate',rate);state.rate=rate;refreshConverterDOM();toast('Reference rate saved on this device.');
}
function updateConverter(){const root=sheet.open&&sheet.querySelector('#convert-amount')?sheet:main,amount=root.querySelector('#convert-amount'),out=root.querySelector('#convert-result');if(!amount||!out)return;state.amount=amount.value;out.textContent=conversionResult();}


function clockCells(){return compareZones(Date.now()).map(z=>`<span><strong>${e(z.name)}</strong><b>${e(z.time)}</b><small>${e(z.abbreviation)} · ${e(z.date.slice(5))}</small></span>`).join('');}
function weatherMarkup(compact=false){return `<div aria-live="polite">${weatherInner(compact)}</div>`;}
function weatherInner(compact=false){
 const f=state.weather,meta=forecastState(f),unit=state.toolPrefs.weatherUnit;
 const header=`<div class="row between"><div><h2>Gwangjin weather</h2><p class="caption">Near our stay · Seoul time</p></div>${compact?button(icon('arrow'),'weather','icon-button','aria-label="Open the weather forecast"'):button(unit==='C'?'°C ⇄ °F':'°F ⇄ °C','weather-unit','secondary','aria-label="Toggle Celsius and Fahrenheit"')}</div>`;
 const refresh=button(state.weatherBusy?'Refreshing…':'Refresh weather','refresh-weather','secondary',state.weatherBusy?'disabled':'');
 if(!f)return `${header}<p class="small spacer">${state.weatherBusy?'Checking the forecast…':'No forecast saved yet. Go online to get one.'}</p>${state.weatherError?`<p class="form-error" role="alert">${e(state.weatherError)}</p>`:''}${refresh}<p class="caption spacer">Weather never blocks your saved trip information.</p>`;
 const stale=meta.stale||!navigator.onLine,label=meta.expired?'Old saved conditions':stale?'Last saved conditions':'Latest model estimate';
 const stamp=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(f.fetchedAt));
 const modelStamp=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(f.current.time));
 let content=`${header}<p class="caption spacer">${e(label)} · ${e(weatherDescription(f.current.code))}</p><div class="weather-current"><strong>${formatTemperature(f.current.temperatureC,unit)}</strong><span>${f.current.feelsC!=null?'Feels like '+formatTemperature(f.current.feelsC,unit):'Feels-like unavailable'}<br>${f.current.windKph!=null?'Wind '+Math.round(f.current.windKph)+' km/h':'Wind unavailable'}</span></div><p class="caption">Saved ${e(stamp)} KST.<br>Model time ${e(modelStamp)} KST.</p>`;
 if(stale)content+=`<p class="notice">${!navigator.onLine?'Offline. ':''}${meta.expired?'This copy is over 6 hours old. Do not treat it as current weather.':meta.stale?'This copy is over 90 minutes old. Refresh before relying on it.':'Showing your last saved forecast. It cannot refresh offline.'}</p>`;
 if(state.weatherError)content+=`<p class="form-error" role="alert">${e(state.weatherError)}</p>`;
 if(!compact){
 const days=f.daily.filter(d=>d.date>=seoulDate());
 content+=days.length?`<div class="forecast-days spacer">${days.map(d=>`<div><strong>${e(d.date===seoulDate()?'Today':new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date(d.date+'T12:00:00+09:00')))}</strong><span>${e(d.date.slice(5))}</span><b>${formatTemperature(d.maxC,unit)} / ${formatTemperature(d.minC,unit)}</b><span>${e(weatherDescription(d.code))}</span><span>${d.rainPct==null?'Rain chance unavailable':Math.round(d.rainPct)+'% rain chance'}</span></div>`).join('')}</div>`:'<p class="notice">All saved daily forecasts have expired. Refresh online.</p>';
 const hours=f.hourly.filter(h=>Date.parse(h.time)>=Date.now());
 if(hours.length)content+=`<h3 class="spacer">Coming hours · KST</h3><div class="forecast-hours" tabindex="0" aria-label="Hourly forecast, scroll horizontally">${hours.map(h=>`<div><strong>${e(h.time.slice(11,16))}</strong><b>${formatTemperature(h.temperatureC,unit)}</b><span>${h.rainPct==null?'Rain chance unknown':Math.round(h.rainPct)+'% rain'}</span></div>`).join('')}</div>`;
 content+=`<div class="row wrap spacer">${refresh}${external('Open-Meteo · CC BY 4.0','https://open-meteo.com/','text-button')}</div><p class="caption spacer">Model-based forecast, not a live observation or official warning feed. Fixed approximate Gwangjin location; your precise address and GPS are not sent to the weather provider.</p>`;
 }else content+=`<p class="caption">Open-Meteo model forecast</p>`;
 return content;
}
function refreshWeatherDOM(){document.querySelectorAll('[data-weather]').forEach(el=>{el.innerHTML=weatherMarkup(el.dataset.weather==='compact');});}
async function refreshWeather(manual=false){
 if(state.weatherBusy)return;
 if(!navigator.onLine){state.weatherError='Offline. Your last saved forecast is unchanged.';refreshWeatherDOM();return;}
 if(!manual&&Date.now()-state.weatherAttempt<5*60000)return;
 if(manual&&Date.now()-state.weatherAttempt<15000){toast('Please wait a few seconds before refreshing again.');return;}
 state.weatherBusy=true;state.weatherAttempt=Date.now();state.weatherError='';refreshWeatherDOM();
 try{const res=await fetch('/api/weather',{cache:'no-store',signal:AbortSignal.timeout(6500)});if(!res.ok)throw new Error('Weather is unavailable here. The saved copy is unchanged; Codex must deploy the Pages Function for live refresh.');const forecast=validateForecast(await res.json());await db.setMeta('weather',forecast);state.weather=forecast;}
 catch{state.weatherError='Weather could not refresh. Your saved copy is unchanged. Live refresh requires the deployed Pages Function and a working connection.';}
 finally{state.weatherBusy=false;refreshWeatherDOM();}
}
function maybeRefreshWeather(){if(document.hidden||!navigator.onLine)return;if(!state.weather||Date.now()-Date.parse(state.weather.fetchedAt)>WEATHER_REFRESH_MS)refreshWeather(false);}
function zoneResults(){if(state.tz.error)return '<p class="caption">Resolve the selected time before comparing the cities.</p>';return compareZones(state.tz.instant,state.tz.source).map(z=>`<article class="zone-row ${z.id===state.tz.source?'selected':''}"><div><strong>${e(z.name)}${z.id==='cupertino'?' · PT':''}</strong><span>${e(z.abbreviation)} · ${e(z.offsetText)}</span></div><div><b>${e(z.time)}</b><span>${e(z.date)} · ${e(z.dayLabel)}</span></div></article>`).join('');}
function zoneMessages(){if(!state.tz.error)return '';return `<p class="notice" role="alert">${e(state.tz.error)}</p>${state.tz.candidates.length===2?`<div class="row wrap">${state.tz.candidates.map((t,i)=>button(`${i===0?'First':'Second'} ${zoneRow(t,state.tz.source).abbreviation} (${zoneRow(t,state.tz.source).offsetText})`,'zone-occurrence','secondary',`data-value="${t}"`)).join('')}</div>`:''}`;}
function timezoneSheet(){const v=wallInput(state.tz.instant,state.tz.source);openSheet('Seoul · Singapore · Cupertino',`<p class="sheet-subtitle">Pick the city whose time you know. All three results describe the same moment, including the correct date.</p><div class="zone-buttons" aria-label="Input time zone">${ZONES.map(z=>button(z.id==='cupertino'?'Cupertino · PT':z.name,'zone-source','chip '+(z.id===state.tz.source?'active':''),`data-zone="${z.id}" aria-pressed="${z.id===state.tz.source}"`)).join('')}</div><div class="form-grid spacer"><label>Date in ${e(ZONES.find(z=>z.id===state.tz.source).name)}<input id="zone-date" type="date" min="2000-01-01" max="2100-12-31" value="${v.slice(0,10)}"></label><label>Local time<input id="zone-time" type="time" value="${v.slice(11)}"></label></div><div class="row wrap">${button('−30 min','zone-step','secondary','data-value="-30"')}${button('Now','zone-now','primary')}${button('+30 min','zone-step','secondary','data-value="30"')}</div><p class="caption spacer" id="zone-mode">${state.tz.live?'Showing now. Uses your device clock.':'Comparing the selected moment.'}</p><div id="zone-error">${zoneMessages()}</div><div id="zone-results" class="stack spacer" aria-live="polite">${zoneResults()}</div><p class="caption spacer">Pacific time automatically uses PDT or PST for the selected date. Keep automatic date and time enabled on your iPhone. Conversion works offline using the time-zone rules supplied by the device.</p>`,'timezone');}
function updateTimezone(){
 const date=sheet.querySelector('#zone-date'),time=sheet.querySelector('#zone-time');if(!date||!time)return;
 state.tz.live=false;state.tz.error='';state.tz.candidates=[];
 try{const candidates=wallToInstants(date.value+'T'+time.value,state.tz.source);state.tz.candidates=candidates;if(candidates.length===0)state.tz.error='This time does not exist in Cupertino because clocks move forward. Choose a different time.';else if(candidates.length===2)state.tz.error='This time happens twice when Pacific clocks move back. Choose the first or second occurrence.';else state.tz.instant=candidates[0];}catch(err){state.tz.error=errorMessage(err);}
 sheet.querySelector('#zone-results').innerHTML=zoneResults();sheet.querySelector('#zone-error').innerHTML=zoneMessages();sheet.querySelector('#zone-mode').textContent='Comparing the selected moment.';
}
function checklistSheet(){const progress=checklistProgress(state.checklist);openSheet('Predeparture checklist',`<p class="sheet-subtitle"><span data-check-progress>${progress.done}/${progress.total} checked</span>. Tap an item only after you have done it. Changes are saved on this device.</p><p class="caption">These confirmations are not a certification that the app works. Device-specific checks stay unconfirmed when a backup moves to another phone.</p>${['Before departure','On this iPhone'].map(group=>`<h3 class="spacer">${group}</h3><div class="stack">${CHECKLIST.filter(x=>x.group===group).map(x=>`<div class="checklist-item"><label class="checklist-label"><input type="checkbox" data-check-id="${x.id}" ${state.checklist[x.id]?'checked':''}><span><strong>${e(x.title)}</strong><small>${e(x.detail)}</small></span></label>${x.action?button('Open relevant tool '+icon('arrow'),x.action,'text-button checklist-tool'):''}</div>`).join('')}</div>`).join('')}`,'checklist');}
function seedStaySheet(merge=false){if(merge&&!state.vault)throw new Error('Unlock the existing stay first.');openSheet(merge?'Use supplied address':'Load your preconfigured stay',`<p class="sheet-subtitle">${merge?'Only the Korean/English address and coordinates will change. Your PIN, unit and Wi-Fi fields are kept. Review and explicitly save afterward.':'Your supplied stay address and coordinates are already encrypted in this app. No unit, door PIN or booking details have been assumed.'}</p><form data-form="seed-stay" data-merge="${merge}">${field('Setup passphrase','passphrase','','password','required maxlength="256" autocomplete="one-time-code"')}<p class="form-help">Use the setup passphrase from your private owner notes. It is not your entry PIN.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">${merge?'Load address for review':'Unlock and save on this phone'}</button></form>`,'stay-seed');}

function appsSheet(){openSheet('Apps on your phone',`<p class="sheet-subtitle">Open the app if it is installed, or get it from the App Store first. Install these before the flight.</p><div class="stack">${APPS.map(a=>`<div class="card app-card"><h3>${e(a.name)}</h3><p class="small" lang="ko">${e(a.korean)}</p><p class="small muted">${e(a.what)}</p><div class="row wrap"><a class="primary" href="${e(a.scheme)}">Open ${e(a.name)}</a>${external('App Store',a.store,'secondary')}</div></div>`).join('')}</div><p class="caption spacer">If “Open” does nothing, the app is not installed yet. Naver Map and Kakao Map are the ones to have before you land.</p>`,'apps');}
async function ensureConfig(){if(state.config)return state.config;try{const r=await fetch('/api/config',{signal:AbortSignal.timeout(5000)});state.config=r.ok?await r.json():{kakaoJsKey:'',sync:false};}catch{state.config={kakaoJsKey:'',sync:false};}return state.config;}
async function mapSheet(){
 openSheet('Map',`<p class="sheet-subtitle">Our stay and every saved find that has coordinates. Tap a pin to open it. Live routes still hand off to Naver or Kakao Map.</p><div id="kakao-map" class="kakao-map" role="application" aria-label="Map of saved places"><p class="small map-status">Loading the map…</p></div><p class="caption spacer">Map data © Kakao. The map needs a connection; saved addresses do not.</p>`,'map');
 const el=sheet.querySelector('#kakao-map');const withCoords=state.places.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 try{const cfg=await ensureConfig();if(!sheet.open||state.modalKind!=='map')return;const kakao=await loadKakaoSdk(cfg.kakaoJsKey);if(!sheet.open||state.modalKind!=='map')return;
  el.replaceChildren();renderMap(kakao,el,{places:withCoords,stay:state.vault?{lat:state.vault.lat,lng:state.vault.lng}:null,onPick:id=>{closeSheet(true,true);showPlace(getPlace(id));},onStay:()=>{closeSheet(true,true);stayEntry();}});
  if(!withCoords.length)toast('No saved finds have coordinates yet. Search places to save them with a pin.');
 }catch(err){if(el.isConnected)el.innerHTML=`<p class="form-error" role="alert">${e(errorMessage(err))}</p><div class="stack spacer">${withCoords.map(p=>button(e(p.name),'map-pick','secondary',`data-id="${e(p.id)}"`)).join('')}</div>`;}
}
function buzzMarkup(p){const b=state.buzz.get(p.id);if(!b)return `<h3>Local buzz</h3><p class="caption">How often Korean blogs mention this place, from Kakao blog search.</p>${button('Check blog mentions','buzz','link-button',`data-id="${e(p.id)}"`)}`;
 return `<h3>Local buzz</h3><p class="small"><strong>${b.total.toLocaleString('en-US')}</strong> Korean blog posts mention “${e(b.query)}”. ${b.total>=1000?'Well known.':b.total>=100?'Known locally.':b.total>0?'Quiet.':'No blog mentions found; check the Korean name.'}</p>${b.posts.length?`<div class="detail-links">${b.posts.map(x=>external(`${e(x.date)} · ${e(x.title)}`,x.url)).join('')}</div>`:''}<p class="caption">Checked ${e(b.retrievedAt.slice(0,16).replace('T',' '))} UTC · ${e(b.source)}</p>`;}
async function loadBuzz(p,btn){
 if(!proxyToken()){toast('Join or create a shared trip first (Trip tab). Blog buzz uses the trip membership.');return;}
 const q=p.korean||p.name;btn.disabled=true;btn.textContent='Checking…';
 try{const res=await fetch('/api/buzz?q='+encodeURIComponent(q),{headers:{Authorization:'Bearer '+proxyToken()},cache:'no-store',signal:AbortSignal.timeout(7000)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Blog search unavailable.');state.buzz.set(p.id,data);const box=sheet.querySelector(`[data-buzz="${CSS.escape(p.id)}"]`);if(box)box.innerHTML=buzzMarkup(p);}
 catch(err){btn.disabled=false;btn.textContent='Check blog mentions';toast(errorMessage(err));}
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
   case 'priority':{const p=getPlace(id),np={...p,priority:!p.priority};await db.savePlace(np,p.rev,null,await sync.mutationFor(np));sync.kick();await load();render();break;}
   case 'visit':{const p=getPlace(id),np={...p,status:p.status==='visited'?'saved':'visited'};await db.savePlace(np,p.rev,null,await sync.mutationFor(np));sync.kick();await load();render();toast(p.status==='visited'?'Marked not visited.':'Marked as been there.');break;}
   case 'delete':{const p=getPlace(id);if(confirm('Delete “'+p.name+'” and its local photo?')){await db.deletePlace(p.id,p.rev,await sync.mutationFor(p,'delete'));sync.kick();closeSheet(true);await load();render();toast(state.trip?'Deleted here and for the group.':'Deleted from this device.');}break;}
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
   case 'local-ideas':startersSheet(true);break;
   case 'apps':appsSheet();break;
   case 'share-create':shareCreateSheet();break;
   case 'share-join':shareJoinSheet();break;
   case 'share-invite':shareInviteSheet();break;
   case 'share-rotate':b.disabled=true;try{await sync.rotateInvite();await load();shareInviteSheet();toast('New invite code. The old one no longer works.');}finally{b.disabled=false;}break;
   case 'copy-invite':await copy(sync.inviteText(state.trip));break;
   case 'share-members':await membersSheet();break;
   case 'share-conflicts':conflictsSheet();break;
   case 'share-sync':b.disabled=true;try{await sync.syncNow();await load();render();toast(sync.status.error||'Synced with the group.');}finally{b.disabled=false;}break;
   case 'share-leave':if(confirm('Leave the shared trip on this phone? Your finds stay here and stop syncing.')){await sync.leave();await load();render();toast('Left the shared trip on this phone.');}break;
   case 'conflict-mine':case 'conflict-shared':{const p=getPlace(id);if(a==='conflict-mine')await db.resolveConflict(id,'mine',await sync.mutationFor(p,'put'));else await db.resolveConflict(id,'shared');sync.kick();await load();render();const np=state.places.find(x=>x.id===id);if(np)showPlace(np);else closeSheet(true);toast(a==='conflict-mine'?'Your version will be shared.':'Using the shared version.');break;}
   case 'map':await mapSheet();break;
   case 'map-pick':closeSheet(true,true);showPlace(getPlace(id));break;
   case 'buzz':await loadBuzz(getPlace(id),b);break;
   case 'add-starter':{const p=[...LOCAL_IDEAS,...STARTERS].find(x=>x.id===id);if(p){if(state.places.some(x=>x.source==='idea:'+p.id)){toast('This idea is already saved.');break;}{const np=cleanPlace({...p,id:crypto.randomUUID(),links:[p.sourceURL,p.extraSource].filter(Boolean),source:'idea:'+p.id,checkedAt:'',priority:false});await db.savePlace(np,0,null,await sync.mutationFor(np));sync.kick();}await load();render();b.textContent='Already saved';b.disabled=true;toast('Idea saved. Mark it must-try only when you choose.');}break;}
   case 'phrase-card':phraseCard(id);break;
   case 'listen':{const p=PHRASES.find(x=>x.id===id);if(p){const mode=await speakPhrase(p);toast(mode==='recording'?'Playing reviewed recording.':mode==='generated'?'Playing bundled Korean voice. Works offline; not yet native-speaker reviewed.':'Playing Korean device voice. Offline reliability still needs testing.');}break;}
   case 'preferences':preferences();break;
   case 'convert':openSheet('Quick currency check',converterMarkup(),'converter');break;
   case 'preset':state.amount=b.dataset.value;refreshConverterDOM();break;
   case 'swap-currency':state.toolPrefs.currencyFrom=state.toolPrefs.currencyFrom==='KRW'?'USD':'KRW';refreshConverterDOM();await db.setMeta('toolPrefs',state.toolPrefs);break;
   case 'refresh-rate':b.disabled=true;try{await refreshRate();}finally{b.disabled=false;}break;
   case 'manual-rate':openSheet('Set a reference rate',`<form data-form="rate">${field('KRW for exactly 1 USD','rate',state.rate?.rate||'','text','required inputmode="decimal" placeholder="Enter your checked rate"')}${field('Rate date','date',seoulDate(),'date','required')}<p class="form-help">Enter won per dollar, not dollars per won. The app does not include card fees.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Save manual rate</button></form>`,'manual-rate');break;
   case 'seed-stay':seedStaySheet(false);break;
   case 'merge-stay':seedStaySheet(true);break;
   case 'weather':openSheet('Weather near our stay',`<section data-weather="detail">${weatherMarkup(false)}</section>`,'weather');maybeRefreshWeather();break;
   case 'refresh-weather':await refreshWeather(true);break;
   case 'weather-unit':state.toolPrefs.weatherUnit=state.toolPrefs.weatherUnit==='C'?'F':'C';refreshWeatherDOM();await db.setMeta('toolPrefs',state.toolPrefs);break;
   case 'timezone':if(state.tz.live)state.tz.instant=Date.now();timezoneSheet();break;
   case 'zone-source':if(ZONES.some(z=>z.id===b.dataset.zone)){state.tz.source=b.dataset.zone;state.tz.error='';state.tz.candidates=[];timezoneSheet();}break;
   case 'zone-now':state.tz={...state.tz,instant:Date.now(),live:true,error:'',candidates:[]};timezoneSheet();break;
   case 'zone-step':if(state.tz.error){toast('Choose a valid, unambiguous time first.');break;}state.tz.instant+=Number(b.dataset.value)*60000;state.tz.live=false;timezoneSheet();break;
   case 'zone-occurrence':{const instant=Number(b.dataset.value);if(state.tz.candidates.includes(instant)){state.tz.instant=instant;state.tz.error='';state.tz.live=false;state.tz.candidates=[];timezoneSheet();}break;}
   case 'checklist':checklistSheet();break;
   case 'speak-tab':case 'tools-tab':closeSheet(true);state.tab=a==='speak-tab'?'speak':'tools';location.hash=state.tab;render();break;
   case 'readiness':await readiness();break;
   case 'install':installSheet();break;
   case 'install-hide':state.installHidden=true;await db.setMeta('installHidden',true);render();break;
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
 if(ev.target.id==='zone-date'||ev.target.id==='zone-time')updateTimezone();
});
document.addEventListener('change',async ev=>{
 const input=ev.target;
 if(input.dataset.reveal!==undefined){input.closest('form')?.querySelectorAll('input[name=passphrase],input[name=confirm],input[name=pin],input[name=wifiPassword]').forEach(el=>{el.type=input.checked?'text':'password';});return;}if(input.id==='zone-date'||input.id==='zone-time')updateTimezone();
 if(input.dataset.checkId){const id=input.dataset.checkId,value=input.checked;input.disabled=true;try{await db.setMeta(checklistMetaKey(id),value);state.checklist[id]=value;const p=checklistProgress(state.checklist);document.querySelectorAll('[data-check-progress]').forEach(el=>el.textContent=`${p.done}/${p.total} checked`);}catch(err){input.checked=!value;toast(errorMessage(err));}finally{input.disabled=false;}}
});

sheet.addEventListener('invalid',ev=>{const form=ev.target.form,err=form?.querySelector('.form-error');if(err){const label=form.querySelector(`label:has([name="${ev.target.name}"])`)?.firstChild?.textContent?.replace('*','').trim()||'This field';err.textContent=ev.target.validity.valueMissing?`${label} is needed before saving.`:ev.target.validationMessage;}},true);
sheet.addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target;if(!form.dataset.form)return;
 const submit=form.querySelector('[type="submit"]'),errBox=form.querySelector('.form-error');submit.disabled=true;errBox.textContent='';
 const f=new FormData(form),values=Object.fromEntries(f);
 try{
  switch(form.dataset.form){
   case 'place':{
    const prior=state.places.find(p=>p.id===form.dataset.id),newPhoto=f.get('photo')?.size?await preparePhoto(f.get('photo')):null;
    const place=cleanPlace({...values,id:form.dataset.id,priority:f.has('priority'),photoId:newPhoto?.id||(f.has('removePhoto')?'':prior?.photoId||''),source:prior?.source||form.dataset.source||'',serverVersion:prior?.serverVersion||0});
    await db.savePlace(place,Number(form.dataset.rev),newPhoto,await sync.mutationFor(place));sync.kick();closeSheet(true);await load();render();toast(state.trip?'Saved. It reaches the group when online.':'Saved on this device.');break;
   }
   case 'preferences':{
    if((values.start&&!validDate(values.start))||(values.end&&!validDate(values.end)))throw new Error('Choose valid dates.');
    if(values.start&&values.end&&values.end<values.start)throw new Error('Departure must be on or after arrival.');
    const prefs={name:text(values.name,80),start:values.start,end:values.end};await db.setMeta('prefs',prefs);state.prefs=prefs;closeSheet(true);render();toast('Trip settings saved.');break;
   }
   case 'stay':{
    if(values.passphrase!==values.confirm)throw new Error('The two passphrases differ. Retype the second one.');
    if(weakPassphrase(values.passphrase))throw new Error('Use at least three words or 20 characters. This passphrase protects your door PIN.');
    if(await isSetupPassphrase(values.passphrase))throw new Error('That is the shared setup passphrase from the handoff notes. Choose a passphrase only you know for a vault that holds your PIN.');
    const vault=cleanStay(values);
    if(!vault.addressKo)throw new Error('Add the Korean accommodation address.');
    const cipher=await seal(vault,values.passphrase,'stay');await db.setMeta('stay',cipher);state.vaultExists=true;lockStay();closeSheet(true);render();toast('Stay encrypted and saved. Make a recovery backup.');break;
   }
   case 'seed-stay':{
    const supplied=cleanStay(await unseal(STAY_SEED.envelope,values.passphrase,'stay'));if(document.hidden||!form.isConnected)break;
    if(form.dataset.merge==='true'){if(!state.vault)throw new Error('Unlock the existing stay first.');state.vault=mergeStayAddress(state.vault,supplied);stayForm();state.formDirty=true;}
    else{const inserted=await db.setMetaIfAbsent('stay',STAY_SEED.envelope);if(!inserted){state.vaultExists=true;throw new Error('A stay already exists on this phone. Close this panel and unlock it; nothing was overwritten.');}state.vaultExists=true;if(document.hidden||!form.isConnected){lockStay();break;}state.vault=supplied;state.formDirty=false;render();showStay();toast('Supplied address saved in your encrypted vault. Keep the passphrase separately.');}
    break;
   }
   case 'unlock':{
    const envelope=await db.getMeta('stay'),vault=await unseal(envelope,values.passphrase,'stay');
    if(document.hidden||!form.isConnected)break;
    state.vault=cleanStay(vault);state.formDirty=false;showStay();break;
   }
   case 'rate':{
    const newRate=validateRate({rate:parseAmount(values.rate),base:'USD',quote:'KRW',date:values.date,source:'manual'});await db.setMeta('rate',newRate);state.rate=newRate;closeSheet(true);render();toast('Manual reference rate saved.');break;
   }
   case 'backup':{
    if(values.passphrase!==values.confirm)throw new Error('The two passphrases differ. Retype the second one.');
    if(weakPassphrase(values.passphrase))throw new Error('Use at least three words or 20 characters. A backup leaves this phone, so its passphrase must resist guessing.');
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
    const token=text(values.token,256);if(!/^[a-zA-Z0-9_-]{32,256}$/.test(token))throw new Error('Use the generated private proxy token from setup.');state.apiToken=token;closeSheet(true);toast('Place search token available until the app is backgrounded.');break;
   }
   case 'share-create':{
    if(values.passphrase!==values.confirm)throw new Error('The passphrases do not match.');
    await sync.createTrip({name:text(values.name,80),memberName:text(values.memberName,40),passphrase:values.passphrase});
    await load();closeSheet(true);render();shareInviteSheet();sync.kick(0);break;
   }
   case 'share-join':{
    await sync.joinTrip({invite:values.invite,memberName:text(values.memberName,40),passphrase:values.passphrase});
    await load();closeSheet(true);render();toast('Joined. Syncing with the group.');sync.kick(0);break;
   }
   case 'naver':{
    if(!proxyToken())throw new Error('Join or create a shared trip first (Trip tab); search comes with membership. Manual saving works without it.');
    const res=await fetch('/api/places?q='+encodeURIComponent(values.query),{headers:{Authorization:'Bearer '+proxyToken()},cache:'no-store',signal:AbortSignal.timeout(7000)});
    let data;try{data=await res.json();}catch{throw new Error('Place search is not deployed here. Manual saving still works.');}
    if(!res.ok)throw new Error(data.error||'Place search unavailable.');state.searchResults=Array.isArray(data.items)?data.items.slice(0,5):[];
    const area=sheet.querySelector('#naver-results');if(!area)break;area.innerHTML=state.searchResults.length?state.searchResults.map((p,i)=>`<div class="card"><h3>${e(p.name)}</h3><p class="small">${e(p.address)}</p><p class="caption">${e(p.category)}</p>${button('Review and save','import-naver','secondary',`data-id="${i}"`)}</div>`).join(''):'<p>No results. Try the Korean name and neighborhood.</p>';state.formDirty=false;break;
   }
  }
 }catch(err){if(errBox.isConnected)errBox.textContent=errorMessage(err);else toast(errorMessage(err));}
 finally{submit.disabled=false;}
});

window.addEventListener('online',()=>{connection();maybeRefreshWeather();});window.addEventListener('offline',()=>{connection();refreshWeatherDOM();});
window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(tabNames[t]){state.tab=t;render();}});
db.onOtherTabChange(()=>load().then(render).catch(err=>toast(errorMessage(err))));
async function start(){
 try{const hash=location.hash.slice(1);if(tabNames[hash])state.tab=hash;await load();render();
  registerWorker(r=>{state.update=r;render();});
  sync.onChange(st=>{$('#connection').dataset.syncRuns=st.runs;connection();const line=document.querySelector('[data-sync-line]');if(line)line.innerHTML=syncLine();if(st.changedAt&&st.changedAt!==state.syncSeen){state.syncSeen=st.changedAt;load().then(render).catch(()=>{});}});sync.autoStart();
  maybeRefreshWeather();audioManifest().catch(()=>{});
  // Warm the voice list; this is not an offline-audio verification.
  if('speechSynthesis'in globalThis){speechSynthesis.getVoices();speechSynthesis.addEventListener('voiceschanged',()=>speechSynthesis.getVoices());}
 }catch(err){main.innerHTML=`<section class="card"><h1>Local storage needs attention.</h1><p>${e(errorMessage(err))}</p><p>Do not clear website data to troubleshoot unless you already have a backup. Try normal Safari and close other open copies.</p><h2>Emergency numbers in Korea</h2><p><a href="tel:112">112 · Police</a><br><a href="tel:119">119 · Ambulance / fire</a></p></section>`;}
}
setInterval(()=>{document.querySelectorAll('[data-live-clocks]').forEach(el=>el.innerHTML=clockCells());if(state.modalKind==='timezone'&&state.tz.live&&!document.hidden){state.tz.instant=Date.now();const v=wallInput(state.tz.instant,state.tz.source);sheet.querySelector('#zone-date').value=v.slice(0,10);sheet.querySelector('#zone-time').value=v.slice(11);sheet.querySelector('#zone-results').innerHTML=zoneResults();}refreshWeatherDOM();maybeRefreshWeather();const clock=$('#seoul-clock');if(clock)clock.textContent=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit'}).format(new Date())+' KST · Gwangjin';},30000);
start();
