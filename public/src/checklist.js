/** User-confirmed preparation. Device checks must never be restored as completed on a new phone. */
export const CHECKLIST=Object.freeze([
 {id:'documents',group:'Before departure',device:false,title:'Check travel documents',detail:'Confirm passport, entry requirements for your nationality, tickets, and travel insurance with the relevant official sources.'},
 {id:'stay-details',group:'Before departure',device:false,title:'Confirm the stay with the host',detail:'Verify the Korean address, map pin, unit and entry instructions. Put the entry PIN only in the encrypted stay vault.'},
 {id:'transit-plan',group:'Before departure',device:false,title:'Check the airport and transit plan',detail:'Confirm the arrival terminal and route to Guui. Test your transit-card setup and keep a payment fallback.'},
 {id:'data-power',group:'Before departure',device:false,title:'Prepare mobile data and power',detail:'Check your data plan, charging cable, adapter and power bank. Know whether your phone plan supports ordinary voice calls.'},
 {id:'install',group:'On this iPhone',device:true,title:'Install and open the Home Screen app',detail:'Add Seoul Pocket to your iPhone Home Screen, then reopen it from that icon.',action:'readiness'},
 {id:'maps',group:'On this iPhone',device:true,title:'Test Naver and your saved address',detail:'Open the stay in Naver, verify the entrance with your host, and keep a separate copy of the Korean address.',action:'stay'},
 {id:'vault',group:'On this iPhone',device:true,title:'Unlock the stay and save its passphrase',detail:'Use your password manager and verify that the saved passphrase works. Never store the only recovery copy in this app.',action:'stay'},
 {id:'audio',group:'On this iPhone',device:true,title:'Test the Korean phrases in airplane mode',detail:'Play the phrases you need. Device speech is not a verified offline audio pack.',action:'speak-tab'},
 {id:'rates-weather',group:'On this iPhone',device:true,title:'Save a rate and check the forecast',detail:'Refresh the exchange rate and Gwangjin forecast online. Check the source and timestamps. Weather cannot refresh offline.',action:'tools-tab'},
 {id:'clock',group:'On this iPhone',device:true,title:'Check Seoul, Singapore and Cupertino time',detail:'Enable automatic date and time on your iPhone. Confirm the date rollover in the app; Cupertino adjusts for daylight saving.',action:'timezone'},
 {id:'offline',group:'On this iPhone',device:true,title:'Force-close and reopen in airplane mode',detail:'Read a saved find, photo and Korean phrase; unlock the stay and convert a price. A cache check alone is not this test.',action:'readiness'},
 {id:'backup',group:'On this iPhone',device:true,title:'Export and test an independent backup',detail:'Save a backup outside this app and verify restoration on a separate browser/device. Keep the vault passphrase separately.',action:'backup'}
]);
export function checklistProgress(completed={}){const done=CHECKLIST.filter(x=>completed[x.id]===true).length;return {done,total:CHECKLIST.length};}
export function checklistMetaKey(id){if(!CHECKLIST.some(x=>x.id===id))throw new Error('Unknown checklist item.');return 'check:'+id;}
export function validateChecklistRecord(id,value){if(!id.startsWith('check:')||!CHECKLIST.some(x=>id==='check:'+x.id)||typeof value!=='boolean')throw new Error('Invalid checklist record.');return value;}
export function restorableChecklist(id){return CHECKLIST.some(x=>'check:'+x.id===id&&!x.device);}
