"""Actual DOM/UI test using explicit in-memory adapters.
NOT an IndexedDB, service-worker, live-network, native-crypto, or iPhone Safari test.
Authoring Chromium blocks real-origin navigation administratively; no policy is changed.
Never publish this harness, its fixtures, or its fake crypto adapter as application code.
Run: python tests/render_harness.py
"""
from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]

def module(name,filename,imports=''):
    code=(ROOT/'public/src'/filename).read_text()
    exports=re.findall(r'export (?:async )?(?:function|const) (\w+)',code)
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    code=re.sub(r'export (?=(?:async )?(?:function|const))','',code)
    code=re.sub(r'^export \{.*?\};?\n?','',code,flags=re.M)
    return f'const {name}=(()=>{{\n{imports}\n{code}\nreturn {{{",".join(exports)}}};\n}})();\n'

def bundle():
    result=module('domain','domain.js')+module('dataModule','data.js')+module('uiModule','ui.js','const {escapeHTML}=domain;')
    result+=module('tzModule','timezones.js')+module('weatherModule','weather.js')+module('checkModule','checklist.js')+module('localModule','locality.js')+module('seedModule','stay-seed.js')+module('stayModule','stay.js','const {text}=domain;')
    # The real encrypted seed is tested separately with native Web Crypto in Node.
    source=json.loads((ROOT/'private/stay-source.json').read_text()) if (ROOT/'private/stay-source.json').exists() else {'name':'Our Guui stay','addressKo':'서울 테스트 주소','addressEn':'Test address','lat':37.54,'lng':127.09,'pin':'','room':'','wifi':'','wifiPassword':'','phone':'','note':'UI test only'}
    result+='const testStaySource='+json.dumps(source,ensure_ascii=False)+';\n'
    raw=(ROOT/'tests/fixtures/weather.mjs').read_text().replace('export function','function')
    result+=raw
    result+=r'''
if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const local={places:[],meta:new Map(),photos:new Map()};
const db={
 all:async(store='places')=>structuredClone(store==='places'?local.places:store==='photos'?[...local.photos.values()]:[...local.meta].map(([id,value])=>({id,value}))),
 getMeta:async id=>structuredClone(local.meta.get(id)),setMeta:async(id,value)=>local.meta.set(id,structuredClone(value)),
 setMetaIfAbsent:async(id,value)=>{if(local.meta.has(id))return false;local.meta.set(id,structuredClone(value));return true;},
 photo:async id=>local.photos.get(id),
 savePlace:async(raw,rev=0,newPhoto=null)=>{const p=domain.cleanPlace(raw),old=local.places.find(x=>x.id===p.id);if((old?.rev||0)!==rev)throw Error('Conflict');p.rev=rev+1;p.updatedAt=new Date().toISOString();local.places=local.places.filter(x=>x.id!==p.id);local.places.push(p);if(newPhoto)local.photos.set(newPhoto.id,newPhoto);return p;},
 deletePlace:async id=>{local.places=local.places.filter(p=>p.id!==id);},onOtherTabChange:()=>{},
 snapshot:async()=>({schema:1,places:local.places,meta:[...local.meta].map(([id,value])=>({id,value})),photos:[]}),validateSnapshot:s=>s,restoreCopies:async()=>({count:0})
};
async function seal(value,pass,purpose='stay'){if(pass.length<12)throw Error('Use at least 12 characters.');return {testOnly:true,pass,purpose,value:structuredClone(value)};}
async function unseal(x,pass){if(x.cipher===seedModule.STAY_SEED.envelope.cipher){if(pass!=='ui-harness-setup')throw Error('Could not unlock. Check your passphrase.');return structuredClone(testStaySource);}if(x.pass!==pass)throw Error('Could not unlock. Check your passphrase.');return structuredClone(x.value);}
async function preparePhoto(){return null;}async function serializePhotos(s){return s;}function deserializePhotos(s){return s;}function downloadFile(){}
async function registerWorker(){return null;}async function checkOffline(){return {ready:false,reason:'UI test harness: no service worker is running.'};}
async function requestPersistence(){return false;}function acceptUpdate(){}
async function speakPhrase(){throw Error('No Korean voice is available in this UI test harness.');}function stopSpeech(){}async function audioManifest(){return {reviewed:false,clips:{}};}
window.weatherMockFailure=false;
window.fetch=async url=>{if(String(url)==='/api/weather'){if(window.weatherMockFailure)return new Response('{}',{status:502});return Response.json(weatherModule.normalizeForecast(weatherRaw()));}if(String(url)==='/api/rates')return Response.json({base:'USD',quote:'KRW',rate:1400,date:domain.seoulDate(),source:'manual'});return new Response('{}',{status:404});};
const {cleanPlace,convert,parseAmount,validateRate,staleRate,seoulDate,mapLinks,safeURL,validDate,text}=domain;
const {PHRASES,STARTERS,TRAVEL,REVIEW_DATE}=dataModule;
const {e,icon,button,external,field,textarea,choice,toast,errorMessage}=uiModule;
const {ZONES,wallInput,wallToInstants,compareZones,zoneRow}=tzModule;
const {validateForecast,forecastState,formatTemperature,weatherDescription,WEATHER_REFRESH_MS}=weatherModule;
const {CHECKLIST,checklistProgress,checklistMetaKey}=checkModule;
const {LOCAL_IDEAS,LOCAL_TRANSIT,LOCAL_REVIEW_DATE}=localModule;
const {STAY_SEED}=seedModule;
const {cleanStay,mergeStayAddress}=stayModule;
'''
    app=(ROOT/'public/src/app.js').read_text();result+=re.sub(r'^import .*?;\n','',app,flags=re.M)
    return result

def render(page):
    html=(ROOT/'public/index.html').read_text();html=re.sub(r'<script.*?</script>','',html,flags=re.S);html=re.sub(r'<link[^>]+>','',html)
    html=html.replace('</head>','<style>'+(ROOT/'public/styles.css').read_text()+'</style></head>');page.set_content(html);page.add_script_tag(content=bundle());page.wait_for_selector('.hero');page.wait_for_timeout(200)

def run():
    qa=ROOT/'qa';qa.mkdir(exist_ok=True);results=[]
    def passed(name):results.append({'name':name,'status':'passed','scope':'actual DOM with in-memory test adapters; not real persistence/network/crypto'})
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)));page.on('dialog',lambda d:d.accept());render(page)
        def close():
            page.get_by_role('button',name='Close panel',exact=True).click();page.wait_for_function("!document.querySelector('#sheet').open && document.querySelector('#sheet').innerText===''")
        def shot(name,full=True):
            page.locator('#toast').evaluate('(e)=>e.classList.remove("visible")');page.wait_for_timeout(120);page.screenshot(path=str(qa/name),full_page=full)
        shot('01-today-iphone.png');passed('Today shows Guui base, saved forecast, three city clocks and checklist progress')
        for width in [320,390,430,768,1280]:
            page.set_viewport_size({'width':width,'height':844});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
        passed('Today has no page-level horizontal overflow at 320/390/430/768/1280 pixels');page.set_viewport_size({'width':390,'height':844})
        page.get_by_role('button',name='Saved',exact=True).click();page.get_by_role('button',name='Near our stay',exact=True).click()
        expect(page.locator('#sheet .card')).to_have_count(6);page.locator('[data-action="add-starter"]').nth(0).click();page.locator('[data-action="add-starter"]').nth(2).click();close();expect(page.locator('.place-card')).to_have_count(2)
        assert page.evaluate('state.places.every(p=>!p.priority)');passed('Local suggestions save into the existing collection without silently making them must-tries')
        page.get_by_role('button',name='Near our stay',exact=True).click();expect(page.locator('[data-action="add-starter"]').nth(0)).to_be_disabled();close();passed('Reopening local ideas shows already-saved entries instead of duplicating them')
        page.get_by_role('button',name='Add a place or food idea',exact=True).click();assert page.locator('#sheet select').count()==0
        page.get_by_label('Name *',exact=True).fill('A café from a Reel');page.get_by_label('Korean name',exact=True).fill('카페');page.get_by_label('Neighborhood',exact=True).fill('Seongsu');page.get_by_label('Links, one per line',exact=True).fill('https://www.instagram.com/reel/example/');page.get_by_label('Make this a must-try',exact=True).check();page.get_by_role('button',name='Save on this device',exact=True).click();page.wait_for_function('!document.querySelector("#sheet").open');expect(page.locator('.place-card')).to_have_count(3);passed('Finite radio choices and add-find form preserve a social link and explicit must-try')
        page.get_by_label('Search saved places').fill('Reel');expect(page.locator('.place-card')).to_have_count(1);page.get_by_label('Search saved places').fill('');shot('02-saved-iphone.png');passed('Saved search still filters user-added and local ideas')
        page.get_by_role('button',name='Tools',exact=True).click();page.get_by_role('button',name='Get a reference rate',exact=True).click();page.wait_for_function('state.rate!==null');page.locator('#convert-amount').fill('14000');expect(page.locator('#convert-result')).to_have_text('$10.00');assert page.locator('select').count()==0
        page.get_by_role('button',name='Swap currencies: currently KRW to USD',exact=True).click();expect(page.locator('#convert-amount')).to_have_value('14000');expect(page.locator('#convert-result')).to_have_text('₩19,600,000');expect(page.locator('[data-action="preset"]').first).to_have_text('5');passed('Currency swaps without a dropdown, preserves the typed number and changes presets correctly')
        page.locator('[data-action="preset"][data-value="10"]').click();expect(page.locator('#convert-result')).to_have_text('₩14,000');page.get_by_role('button',name='Swap currencies: currently USD to KRW').click();page.locator('[data-action="preset"][data-value="10000"]').click();shot('06-tools-iphone.png')
        page.get_by_role('button',name='Today',exact=True).click();page.locator('[data-action="convert"]').click();expect(page.locator('#sheet #convert-amount')).to_have_value('10000');shot('09-currency-iphone.png',False);close();passed('Currency amount and direction remain consistent between Today sheet and Tools')
        page.locator('[data-action="timezone"]').first.click();assert page.locator('#sheet [data-action="zone-source"]').count()==3;assert page.locator('#sheet select').count()==0
        page.locator('#zone-date').fill('2026-09-08');page.locator('#zone-time').fill('09:00');expect(page.locator('#zone-results')).to_contain_text('9:00 AM');expect(page.locator('#zone-results')).to_contain_text('8:00 AM');expect(page.locator('#zone-results')).to_contain_text('5:00 PM');expect(page.locator('#zone-results')).to_contain_text('Previous date');shot('10-timezones-iphone.png',False);passed('Time converter shows all three cities and the Pacific previous-date rollover')
        page.locator('[data-action="zone-source"][data-zone="cupertino"]').click();page.locator('#zone-date').fill('2026-03-08');page.locator('#zone-time').fill('02:30');expect(page.locator('#zone-error')).to_contain_text('does not exist');expect(page.locator('#zone-results .zone-row')).to_have_count(0);passed('Pacific spring-forward gap displays an error, not a misleading conversion')
        page.locator('#zone-date').fill('2026-11-01');page.locator('#zone-time').fill('01:30');expect(page.locator('[data-action="zone-occurrence"]')).to_have_count(2);page.locator('[data-action="zone-occurrence"]').nth(1).click();expect(page.locator('#zone-results')).to_contain_text('PST');passed('Pacific repeated hour requires an explicit first/second occurrence');close()
        page.get_by_role('button',name='Trip',exact=True).click();page.get_by_role('button',name='Open checklist',exact=True).click();page.locator('[data-check-id="documents"]').check();page.locator('[data-check-id="offline"]').check();expect(page.locator('#sheet [data-check-progress]')).to_have_text('2/12 checked');close();page.get_by_role('button',name='Open checklist',exact=True).click();expect(page.locator('[data-check-id="documents"]')).to_be_checked();expect(page.locator('[data-check-id="maps"]')).not_to_be_checked();shot('11-checklist-iphone.png',False);passed('Checklist saves/reopens explicit confirmations and does not auto-complete other tests');close()
        page.get_by_role('button',name='Set up our stay',exact=True).click();page.get_by_role('button',name='Load preconfigured stay',exact=True).click();page.get_by_label('Setup passphrase',exact=True).fill('ui-harness-setup');page.get_by_role('button',name='Unlock and save on this phone',exact=True).click();page.wait_for_selector('[data-action="stay-edit"]');expect(page.locator('#sheet')).to_contain_text('Our Guui stay');assert page.locator('#sheet a[href^="nmap://route/public"]').count()==1
        href=page.locator('#sheet a[href^="nmap://route/public"]').get_attribute('href');assert 'dlat=' in href and 'dlng=' in href;shot('07-stay-iphone.png',False);passed('Preconfigured stay setup presents the supplied address and coordinate-based Naver handoff in the UI')
        page.get_by_role('button',name='Edit stay',exact=True).click();page.get_by_label('Door / building entry PIN',exact=True).fill('9999#');page.get_by_label('Wi-Fi name',exact=True).fill('Test Wi-Fi');page.get_by_label('Passphrase to encrypt this version',exact=True).fill('test phrase long enough');page.get_by_label('Confirm passphrase',exact=True).fill('test phrase long enough');page.get_by_role('button',name='Encrypt and save stay',exact=True).click();page.wait_for_function('!document.querySelector("#sheet").open')
        page.get_by_role('button',name='Unlock stay',exact=True).click();page.get_by_label('Vault passphrase',exact=True).fill('test phrase long enough');page.locator('#sheet').get_by_role('button',name='Unlock stay',exact=True).click();expect(page.locator('.pin-value')).to_have_text('••••');page.get_by_role('button',name='Show address card',exact=True).click();assert '9999' not in page.locator('#sheet').inner_text();passed('Stay card hides the entry PIN and driver card excludes it');close()
        page.get_by_role('button',name='Unlock stay',exact=True).click();page.get_by_label('Vault passphrase',exact=True).fill('test phrase long enough');page.locator('#sheet').get_by_role('button',name='Unlock stay',exact=True).click();page.locator('#sheet summary').filter(has_text='Use the address supplied').click();page.get_by_role('button',name='Use supplied address',exact=True).click();page.get_by_label('Setup passphrase',exact=True).fill('ui-harness-setup');page.get_by_role('button',name='Load address for review',exact=True).click();expect(page.get_by_label('Door / building entry PIN',exact=True)).to_have_value('9999#');expect(page.get_by_label('Wi-Fi name',exact=True)).to_have_value('Test Wi-Fi');passed('Address-only merge retains the existing PIN and Wi-Fi, and requires explicit review/save');close()
        page.get_by_role('button',name='Speak',exact=True).click();shot('03-speak-iphone.png');page.locator('[data-action="phrase-card"]').first.click();shot('05-phrase-card-iphone.png',False);close();passed('Korean phrase list and large show-card remain functional')
        page.get_by_role('button',name='Tools',exact=True).click();expect(page.locator('.weather-current')).to_contain_text('25°C');page.get_by_role('button',name='Toggle Celsius and Fahrenheit',exact=True).click();expect(page.locator('.weather-current')).to_contain_text('78°F');passed('Weather unit toggle converts the number as well as the suffix')
        stamp=page.evaluate('state.weather.fetchedAt');page.evaluate('window.weatherMockFailure=true;state.weatherAttempt=0');page.get_by_role('button',name='Refresh weather',exact=True).click();expect(page.locator('[data-weather="detail"]')).to_contain_text('could not refresh');assert page.evaluate('state.weather.fetchedAt')==stamp;passed('Failed weather refresh retains the last saved forecast and its original timestamp')
        ctx.set_offline(True);page.wait_for_timeout(100);expect(page.locator('[data-weather="detail"]')).to_contain_text('Offline.');passed('Offline weather is labelled as a saved copy rather than live conditions')
        page.evaluate('state.weather.fetchedAt=new Date(Date.now()-8*3600000).toISOString();state.weather.current.time=new Date(Date.now()-8*3600000+9*3600000).toISOString().slice(0,19)+"+09:00";refreshWeatherDOM()');expect(page.locator('[data-weather="detail"]')).to_contain_text('over 6 hours old');shot('12-weather-stale-iphone.png');passed('Expired forecast shows a prominent age warning')
        ctx.set_offline(False);page.evaluate('window.weatherMockFailure=false;state.weatherAttempt=0');page.get_by_role('button',name='Refresh weather',exact=True).click();page.wait_for_function('!state.weatherBusy');page.get_by_role('button',name='Toggle Celsius and Fahrenheit',exact=True).click();page.get_by_role('button',name='Today',exact=True).click();page.locator('[data-action="weather"]').click();shot('13-weather-iphone.png',False);close()
        for tab in ['Saved','Speak','Tools','Trip']:
            page.get_by_role('button',name=tab,exact=True).click()
            for w in [320,390,430,768,1280]:
                page.set_viewport_size({'width':w,'height':844});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(tab,w)
        passed('All five tabs avoid page-level overflow at five target widths')
        page.set_viewport_size({'width':1280,'height':900});page.get_by_role('button',name='Today',exact=True).click();shot('08-today-desktop.png')
        assert not errors,errors;passed('No unhandled JavaScript page errors in the exercised UI flows');browser.close()
    (qa/'ui-harness-results.json').write_text(json.dumps({'scope':'DOM/UI with explicitly mocked storage, crypto, offline and network adapters. No real-origin persistence or physical-device claim.','passed':len(results),'results':results},indent=2))
    print(json.dumps({'passed':len(results),'pageErrors':errors,'scope':'in-memory UI harness'},indent=2))
if __name__=='__main__':run()
