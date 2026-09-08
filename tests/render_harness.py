"""Render/interact with the actual UI using explicit in-memory test adapters.
This is NOT an IndexedDB, service-worker, live-network, or iPhone Safari test.
Useful in environments whose browser navigation is administratively blocked.
Never publish this harness or its fake security adapter as application code.
"""
from pathlib import Path
import re, json, argparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def module(name, filename, imports=''):
    code=(ROOT/'public/src'/filename).read_text()
    exports=re.findall(r'export (?:async )?(?:function|const) (\w+)', code)
    code=re.sub(r'^import .*?;\n','',code,flags=re.M)
    code=re.sub(r'export (?=(?:async )?(?:function|const))','',code)
    code=re.sub(r'^export \{.*?\};?\n?','',code,flags=re.M)
    return f'const {name}=(()=>{{\n{imports}\n{code}\nreturn {{{",".join(exports)}}};\n}})();\n'

def bundle():
    result=module('domain','domain.js')+module('dataModule','data.js')+module('uiModule','ui.js','const {escapeHTML}=domain;')
    result+=r'''
if (!crypto.randomUUID) crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
const local={places:[],meta:new Map(),photos:new Map()};
const db={
 all:async(store='places')=>structuredClone(store==='places'?local.places:store==='photos'?[...local.photos.values()]:[...local.meta].map(([id,value])=>({id,value}))),
 getMeta:async id=>structuredClone(local.meta.get(id)),setMeta:async(id,value)=>local.meta.set(id,structuredClone(value)),
 photo:async id=>local.photos.get(id),
 savePlace:async(raw,rev=0,newPhoto=null)=>{const p=domain.cleanPlace(raw),old=local.places.find(x=>x.id===p.id);if((old?.rev||0)!==rev)throw Error('Conflict');p.rev=rev+1;p.updatedAt=new Date().toISOString();local.places=local.places.filter(x=>x.id!==p.id);local.places.push(p);if(newPhoto)local.photos.set(newPhoto.id,newPhoto);return p;},
 deletePlace:async id=>{local.places=local.places.filter(p=>p.id!==id);},
 onOtherTabChange:()=>{},snapshot:async()=>({schema:1,places:local.places,meta:[],photos:[]}),
 validateSnapshot:s=>s,restoreCopies:async()=>({count:0})
};
// Test-only fake envelope. Never used in production or counted as a crypto test.
async function seal(value,pass,purpose='stay'){if(pass.length<12)throw Error('Use at least 12 characters.');return {testOnly:true,pass,purpose,value:structuredClone(value)};}
async function unseal(x,pass){if(x.pass!==pass)throw Error('Could not unlock. Check your passphrase.');return structuredClone(x.value);}
async function preparePhoto(){return null;}
async function serializePhotos(s){return s;}function deserializePhotos(s){return s;}function downloadFile(){}
async function registerWorker(){return null;}async function checkOffline(){return {ready:false,reason:'UI test harness: no service worker is running.'};}
async function requestPersistence(){return false;}function acceptUpdate(){}
async function speakPhrase(){throw Error('No Korean voice is available in this UI test harness.');}
function stopSpeech(){}async function audioManifest(){return {reviewed:false,clips:{}};}
const {cleanPlace,convert,parseAmount,validateRate,staleRate,seoulDate,mapLinks,safeURL,validDate,text}=domain;
const {PHRASES,STARTERS,TRAVEL,REVIEW_DATE}=dataModule;
const {e,icon,button,external,field,textarea,select,toast,errorMessage}=uiModule;
'''
    app=(ROOT/'public/src/app.js').read_text()
    app=re.sub(r'^import .*?;\n','',app,flags=re.M)
    result+=app
    return result

def render(page):
    html=(ROOT/'public/index.html').read_text()
    html=re.sub(r'<script.*?</script>','',html,flags=re.S)
    html=re.sub(r'<link[^>]+>','',html)
    html=html.replace('</head>','<style>'+(ROOT/'public/styles.css').read_text()+'</style></head>')
    page.set_content(html)
    page.add_script_tag(content=bundle())
    page.wait_for_selector('.hero')

def run():
    qa=ROOT/'qa';qa.mkdir(exist_ok=True)
    results=[]
    def passed(name):results.append({'name':name,'status':'passed','scope':'actual DOM, in-memory test adapters'})
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        page.on('dialog',lambda dialog:dialog.accept())
        render(page)
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'01-today-iphone.png'),full_page=True)
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth');passed('390px Today layout has no horizontal overflow')
        page.get_by_role('button',name='Saved',exact=True).click()
        page.get_by_role('button',name='Seoul starter ideas').click()
        page.locator('[data-action="add-starter"]').nth(0).click()
        page.locator('[data-action="add-starter"]').nth(5).click()
        page.get_by_role('button',name='Close panel').click()
        page.wait_for_function("document.querySelectorAll('.place-card').length===2");assert page.locator('.place-card').count()==2;passed('Starter ideas add to a single shared shortlist model')
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'02-saved-iphone.png'),full_page=True)
        page.get_by_role('button',name='Add a place or food idea').click()
        page.get_by_label('Name *',exact=True).fill('A cafe we found')
        page.get_by_label('Korean name',exact=True).fill('우리 카페')
        page.get_by_label('Neighborhood',exact=True).fill('Jongno')
        page.get_by_label('Links, one per line',exact=True).fill('https://www.instagram.com/reel/example/')
        page.get_by_role('button',name='Save on this device',exact=True).click()
        page.wait_for_selector('#sheet:not([open])',state='attached')
        assert page.locator('.place-card').count()==3;passed('Add find form saves name, Korean text, neighborhood, and a social link')
        page.get_by_label('Search saved places').fill('cafe')
        assert page.locator('.place-card').count()==1;passed('Search filters the saved collection')
        page.get_by_label('Search saved places').fill('')
        page.locator('.place-main').filter(has_text='A cafe we found').click()
        assert page.get_by_role('link',name='www.instagram.com').count()==1
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'04-place-detail-iphone.png'),full_page=True)
        page.get_by_role('button',name='Close panel').click()
        page.get_by_role('button',name='Speak',exact=True).click()
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'03-speak-iphone.png'),full_page=False)
        page.get_by_label('Search Korean phrases').fill('water')
        assert page.locator('.phrase').count()==1
        page.get_by_role('button',name='Show card',exact=True).click()
        assert page.locator('.show-card').inner_text().find('물 주세요')>=0;passed('Phrase search and large Korean show-card work')
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'05-phrase-card-iphone.png'),full_page=True)
        page.get_by_role('button',name='Close panel').click()
        page.get_by_role('button',name='Tools',exact=True).click()
        page.get_by_role('button',name='Enter rate',exact=True).click()
        page.get_by_label('KRW for exactly 1 USD').fill('1400')
        page.get_by_role('button',name='Save manual rate').click()
        page.wait_for_selector('#sheet:not([open])',state='attached')
        page.locator('#convert-amount').fill('28000');assert page.locator('#convert-result').inner_text()=='$20.00';passed('Bidirectional converter uses manually entered reference rate')
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'06-tools-iphone.png'),full_page=True)
        page.get_by_role('button',name='Trip',exact=True).click()
        page.get_by_role('button',name='Set up our stay').click()
        page.get_by_role('button',name='Create stay vault').click()
        page.get_by_label('Address in Korean *',exact=True).fill('서울특별시 예시 주소 123 (DEMO)')
        page.get_by_label('Door / building entry PIN',exact=True).fill('7788#')
        page.get_by_label('Choose a vault passphrase').fill('a very long test passphrase')
        page.get_by_label('Confirm passphrase',exact=True).fill('a very long test passphrase')
        page.get_by_role('button',name='Encrypt and save stay').click()
        page.wait_for_selector('#sheet:not([open])',state='attached')
        page.get_by_role('button',name='Unlock stay',exact=True).click()
        page.get_by_label('Vault passphrase',exact=True).fill('a very long test passphrase')
        page.locator('#sheet').get_by_role('button',name='Unlock stay',exact=True).click()
        page.wait_for_selector('.pin-value')
        assert page.locator('.pin-value').inner_text()=='••••'
        page.get_by_role('button',name='Reveal',exact=True).click()
        assert page.locator('.pin-value').inner_text()=='7788#'
        page.get_by_role('button',name='Hide',exact=True).click();passed('Vault reveal is separate from unlock (test-only encryption adapter)')
        page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'07-stay-iphone.png'),full_page=True)
        page.get_by_role('button',name='Show address card').click()
        assert '7788' not in page.locator('#sheet').inner_text();passed('Driver address card omits the entry PIN')
        page.get_by_role('button',name='Close panel').click()
        page.wait_for_function("document.getElementById('sheet').innerText===''");assert not page.locator('#sheet').inner_text();passed('Closing the stay dialog removes its contents from the DOM')
        page.get_by_role('button',name='Offline check',exact=True).click()
        page.wait_for_selector('#sheet .notice')
        assert 'NOT verified' in page.locator('#sheet').inner_text();passed('Offline readiness does not claim unprovided audio is ready')
        page.get_by_role('button',name='Close panel').click()
        page.get_by_role('button',name='Today',exact=True).click()
        for width in [320,375,430,768,1280]:
            page.set_viewport_size({'width':width,'height':900})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'overflow at {width}'
        passed('Today layout fits 320, 375, 430, 768, and 1280px widths')
        page.set_viewport_size({'width':1280,'height':950});page.locator('#toast').evaluate('(el)=>el.classList.remove("visible")');page.wait_for_timeout(250);page.screenshot(path=str(qa/'08-today-desktop.png'),full_page=True)
        assert not errors,errors;passed('No uncaught errors during the exercised UI flows')
        browser.close()
    (qa/'ui-harness-results.json').write_text(json.dumps({'mode':'in-memory browser UI harness; not a real-origin PWA test','results':results},indent=2))
    print(json.dumps({'passed':len(results),'scope':'UI interactions and responsive layout only. IndexedDB, service worker, live APIs, and real iPhone behavior are not covered.'},indent=2))
if __name__=='__main__':run()
