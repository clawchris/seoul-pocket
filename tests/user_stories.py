"""Real-origin user-story suite. Runs every story from the tracking sheet against a deployed origin.
Usage: python tests/user_stories.py --base https://seoul-pocket.pages.dev [--token FILE] [--setup-passphrase-file private/OWNER_SETUP.md]
Requires Python Playwright with Chromium. bypass_csp is on so the test runner may evaluate scripts; the deployed CSP is checked separately with curl.
Prints one line per story: PASS/FAIL id - note. Exit code 1 when any story fails.
"""
import argparse, json, re, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

RESULTS = []
DEBUG_PAGE = None

def story(sid, fn):
    try:
        note = fn() or ''
        RESULTS.append((sid, 'PASS', note)); print(f'PASS {sid} {note}', flush=True)
    except Exception as err:  # noqa
        tb = traceback.extract_tb(err.__traceback__); where = next((f'line {f.lineno}' for f in reversed(tb) if f.filename.endswith('user_stories.py')), '')
        msg = ((str(err).splitlines() or [type(err).__name__])[0][:220] + ' @' + where).strip()
        try:
            ctxinfo = DEBUG_PAGE.evaluate("()=>({sheet:document.querySelector('#sheet').open, title:document.querySelector('#sheet-title')?.innerText, cards:[...document.querySelectorAll('.place-card h3')].map(x=>x.innerText), toast:document.querySelector('#toast')?.innerText, tab:document.querySelector('#nav .active')?.innerText.trim()})") if DEBUG_PAGE else ''
        except Exception as e2: ctxinfo = f'(no ctx: {e2})'
        RESULTS.append((sid, 'FAIL', msg)); print(f'FAIL {sid} {msg} | {ctxinfo}', flush=True)
        try:
            if DEBUG_PAGE and DEBUG_PAGE.locator('#sheet').evaluate('s=>s.open'): DEBUG_PAGE.evaluate("document.querySelector('#sheet').close()")
        except Exception: pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:4173')
    ap.add_argument('--token-file', help='file containing API_ACCESS_TOKEN=... for place search')
    ap.add_argument('--setup-passphrase-file', help='private/OWNER_SETUP.md; passphrase is read, never printed')
    ap.add_argument('--headed', action='store_true')
    a = ap.parse_args()
    token = ''
    if a.token_file and Path(a.token_file).exists():
        m = re.search(r'API_ACCESS_TOKEN=(\S+)', Path(a.token_file).read_text()); token = m.group(1) if m else ''
    setup = ''
    if a.setup_passphrase_file and Path(a.setup_passphrase_file).exists():
        m = re.search(r'passphrase:\s*\n+\s*`?([^\s`]+)`?', Path(a.setup_passphrase_file).read_text()); setup = m.group(1) if m else ''
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not a.headed)
        ctx = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  accept_downloads=True, bypass_csp=True, permissions=['clipboard-read','clipboard-write'])
        page = ctx.new_page()
        global DEBUG_PAGE; DEBUG_PAGE = page
        errors = []; dialogs = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
        sheet = page.locator('#sheet')
        def close():
            if sheet.evaluate('s=>s.open'):
                page.evaluate("document.querySelector('#sheet').close()")
        def tab(name):
            page.locator(f'#nav [data-tab="{name}"]').click(); page.wait_for_timeout(150)
        def act(name, scope=None):
            (scope or page).locator(f'[data-action="{name}"]').first.click(); page.wait_for_timeout(250)
        today = page.evaluate("new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())") if False else None

        page.goto(a.base); page.wait_for_selector('.hero')
        today = page.evaluate("new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())")

        def s01():
            tabs = page.locator('#nav button').all_inner_texts()
            assert [t.strip() for t in tabs] == ['Today','Saved','Speak','Tools','Trip'], tabs
            assert 'Saved on this device' in page.locator('#connection').inner_text()
            assert page.locator('#nav .active').inner_text().strip() == 'Today'
        story('S01', s01)
        def s02():
            tab('tools'); assert page.evaluate('location.hash') == '#tools'
            page.goto(a.base + '#trip'); page.wait_for_selector('#nav'); assert page.locator('#nav .active').inner_text().strip() == 'Trip'
            tab('today')
        story('S02', s02)
        def s05():
            act('help'); t = sheet.inner_text()
            assert '112' in t and '119' in t and '1330' in t
            hrefs = sheet.locator('a[href^="tel:"]').evaluate_all('els=>els.map(e=>e.getAttribute("href"))')
            assert hrefs == ['tel:112','tel:119','tel:1330'], hrefs; close()
        story('S05', s05)
        def s10():
            h = page.locator('.hero').inner_text(); assert 'KST' in h and 'Trip dates not set' in h
        story('S10', s10)
        def s11():
            act('preferences'); f = sheet.locator('form')
            f.locator('[name=name]').fill('Seoul test trip'); f.locator('[name=start]').fill('2026-10-10'); f.locator('[name=end]').fill('2026-10-05')
            f.locator('button[type=submit]').click(); page.wait_for_timeout(300)
            assert 'on or after' in f.locator('.form-error').inner_text()
            f.locator('[name=end]').fill('2026-10-14'); f.locator('button[type=submit]').click(); page.wait_for_timeout(400)
            assert not sheet.evaluate('s=>s.open'); assert '2026-10-10' in page.locator('.hero').inner_text()
        story('S11', s11)
        def s12():
            for name, title in [('stay','Our stay'),('convert','Quick currency check'),('transport','Getting around Seoul'),('new','Save a find')]:
                act(name); assert sheet.locator('#sheet-title').inner_text() == title, name; close()
        story('S12', s12)
        def s14():
            assert page.locator('[data-live-clocks]').inner_text().count('Seoul') == 1
            assert 'Singapore' in page.locator('[data-live-clocks]').inner_text() and 'Cupertino' in page.locator('[data-live-clocks]').inner_text()
            page.wait_for_function("document.querySelector('[data-weather=compact]').innerText.includes('°')", timeout=15000)
        story('S14', s14)
        def s15():
            assert '0/12' in page.locator('[data-check-progress]').first.inner_text()
            act('local-ideas'); assert sheet.locator('.card').count() == 6; close()
        story('S15', s15)
        # Saved
        def s20():
            tab('saved'); act('new'); f = sheet.locator('form[data-form=place]')
            f.locator('[name=name]').fill('Mandu'); f.locator('button[type=submit]').click(); page.wait_for_timeout(500)
            assert page.locator('.place-card h3').all_inner_texts() == ['Mandu']
            assert page.locator('.place-card .tag').first.inner_text() == 'Food & drink'
        story('S20', s20)
        def s21():
            act('new'); f = sheet.locator('form[data-form=place]')
            f.locator('[name=name]').fill('Gwangjang Market'); f.locator('input[name=kind][value=place]').check()
            f.locator('[name=korean]').fill('광장시장'); f.locator('[name=neighborhood]').fill('Jongno'); f.locator('[name=address]').fill('서울 종로구 창경궁로 88')
            f.locator('[name=note]').fill('bindaetteok and mayak gimbap')
            f.locator('[name=links]').fill('https://www.instagram.com/reel/abc123/\njavascript:alert(1)')
            f.locator('button[type=submit]').click(); page.wait_for_timeout(300)
            assert 'http' in f.locator('.form-error').inner_text().lower()
            f.locator('[name=links]').fill('https://www.instagram.com/reel/abc123/\nhttps://place.map.kakao.com/8073593')
            f.locator('[name=date]').fill(today); f.locator('[name=time]').fill('18:30')
            f.locator('summary').first.click(); f.locator('[name=lat]').fill('37.57005'); f.locator('[name=lng]').fill('126.99894')
            f.locator('[name=priority]').check()
            f.locator('input[name=photo]').set_input_files({'name':'test.png','mimeType':'image/png','buffer':png_bytes()})
            f.locator('button[type=submit]').click(); page.wait_for_timeout(1200)
            assert not sheet.evaluate('s=>s.open'), sheet.locator('.form-error').inner_text()
            card = page.locator('.place-card', has_text='Gwangjang'); card.locator('.place-main').click(); page.wait_for_timeout(400)
            links = sheet.locator('a[href]').evaluate_all('els=>els.map(e=>e.getAttribute("href"))')
            assert any(h.startswith('nmap://route/public?dlat=37.57005') for h in links), links
            assert any(h.startswith('nmap://route/walk') for h in links)
            assert any('map.naver.com' in h for h in links)
            assert any('instagram.com' in h for h in links) and not any(h.startswith('javascript') for h in links)
            assert 'Planned: '+today in sheet.inner_text(); close()
        story('S21', s21)
        def s22():
            assert page.locator('.place-thumb img').count() == 1
            act('new'); f = sheet.locator('form[data-form=place]'); f.locator('[name=name]').fill('HEIC test')
            f.locator('input[name=photo]').set_input_files({'name':'photo.heic','mimeType':'image/heic','buffer':b'\x00'*100})
            f.locator('button[type=submit]').click(); page.wait_for_timeout(600)
            err = f.locator('.form-error').inner_text(); assert err and sheet.evaluate('s=>s.open'), 'HEIC should be rejected with a message'
            close(); return 'HEIC message: ' + err[:80]
        story('S22', s22)
        def s23():
            page.locator('.place-card', has_text='Gwangjang').locator('.place-main').click(); page.wait_for_timeout(300)
            act('edit', sheet); f = sheet.locator('form[data-form=place]')
            assert f.locator('[name=name]').input_value() == 'Gwangjang Market' and f.locator('[name=lat]').input_value() == '37.57005'
            f.locator('[name=note]').fill('EDITED note'); f.locator('input[name=status][value=planned]').check(); f.locator('button[type=submit]').click(); page.wait_for_timeout(600)
            page.reload(); page.wait_for_selector('#nav'); tab('saved')
            page.locator('.place-card', has_text='Gwangjang').locator('.place-main').click(); page.wait_for_timeout(300)
            assert 'EDITED note' in sheet.inner_text() and 'Planned' in sheet.inner_text(); close()
        story('S23', s23)
        def s24():
            m = page.locator('.place-card', has_text='Mandu'); m.locator('[data-action=visit]').click(); page.wait_for_timeout(500)
            m = page.locator('.place-card', has_text='Mandu'); assert 'Been there' in m.locator('[data-action=visit]').inner_text()
            m.locator('[data-action=priority]').click(); page.wait_for_timeout(500)
            assert page.locator('.place-card h3').all_inner_texts()[0] in ('Mandu','Gwangjang Market')
            m = page.locator('.place-card', has_text='Mandu'); assert m.locator('[data-action=priority]').get_attribute('aria-pressed') == 'true'
        story('S24', s24)
        def s25():
            out = {}
            for f in ['food','place','must','visited','all']:
                page.locator(f'[data-action=filter][data-filter={f}]').click(); page.wait_for_timeout(200); out[f] = page.locator('.place-card h3').all_inner_texts()
            assert out['food'] == ['Mandu'] and out['place'] == ['Gwangjang Market'] and out['visited'] == ['Mandu'] and len(out['must']) == 2 and len(out['all']) == 2, out
            page.locator('#place-search').fill('EDITED'); page.wait_for_timeout(200); assert page.locator('.place-card h3').all_inner_texts() == ['Gwangjang Market']
            page.locator('#place-search').fill('zzz'); page.wait_for_timeout(200); assert 'No matches' in page.locator('.empty').inner_text()
            page.locator('#place-search').fill(''); page.wait_for_timeout(200)
        story('S25', s25)
        def s27():
            act('starters'); assert sheet.locator('.card').count() == 12
            sheet.locator('[data-action=add-starter]').first.click(); page.wait_for_timeout(500)
            assert sheet.locator('button:has-text("Already saved")').count() >= 1; close()
            act('local-ideas'); sheet.locator('[data-action=add-starter]').first.click(); page.wait_for_timeout(500); close()
            assert page.locator('.place-card').count() == 4
        story('S27', s27)
        def s29():
            act('new'); sheet.locator('[name=name]').fill('dirty'); dialogs.clear(); page.keyboard.press('Escape'); page.wait_for_timeout(300)
            assert dialogs and 'Discard' in dialogs[0], dialogs; assert not sheet.evaluate('s=>s.open')
            assert page.locator('.place-card', has_text='dirty').count() == 0
        story('S29', s29)
        def s26():
            page.locator('.place-card', has_text='HEIC').count()
            page.locator('.place-card', has_text='Mandu').locator('.place-main').click(); page.wait_for_timeout(300); dialogs.clear()
            act('delete', sheet); page.wait_for_timeout(500)
            assert dialogs and 'Delete' in dialogs[0]; assert page.locator('.place-card', has_text='Mandu').count() == 0
        story('S26', s26)
        # Speak
        def s30():
            tab('speak'); assert page.locator('.phrase').count() == 28
            page.locator('[data-action=phrase-filter][data-category=Food]').click(); page.wait_for_timeout(200); n = page.locator('.phrase').count(); assert 0 < n < 28
            page.locator('[data-action=phrase-filter][data-category=All]').click(); page.locator('#phrase-search').fill('water'); page.wait_for_timeout(200)
            assert page.locator('.phrase').count() >= 1 and 'water' in page.locator('.phrase').first.inner_text().lower(); page.locator('#phrase-search').fill('')
        story('S30', s30)
        def s31():
            page.locator('[data-action=listen]').first.click()
            t = ''
            for _ in range(12):
                page.wait_for_timeout(400); t = page.locator('#toast').inner_text()
                if 'voice' in t.lower() or 'recording' in t.lower() or 'speech' in t.lower(): break
            assert 'voice' in t.lower() or 'recording' in t.lower() or 'speech' in t.lower(), t; return t[:80]
        story('S31', s31)
        def s32():
            page.locator('[data-action=phrase-card]').first.click(); page.wait_for_timeout(300)
            c = sheet.locator('.show-card'); assert c.locator('.korean').inner_text() and c.locator('.phonetic').inner_text() and 'Romanization' in c.inner_text(); close()
        story('S32', s32)
        # Tools
        def s40():
            tab('tools'); assert page.locator('select').count() == 0
            page.locator('#convert-amount').fill('14000'); page.wait_for_timeout(200)
            page.locator('[data-action=swap-currency]').click(); page.wait_for_timeout(200)
            assert page.locator('#convert-amount').input_value() == '14000'
            assert 'Dollars to won' in page.locator('[data-converter] .tag').inner_text()
            assert page.locator('.preset button').first.inner_text() == '5'
            page.locator('[data-action=swap-currency]').click(); page.wait_for_timeout(200)
        story('S40', s40)
        def s41():
            page.locator('[data-converter] summary').click(); act('refresh-rate'); page.wait_for_timeout(2500)
            page.locator('#convert-amount').fill('14000'); page.wait_for_timeout(200)
            cap = page.locator('[data-converter]').inner_text(); assert 'Reference rate' in cap and '$' in page.locator('#convert-result').inner_text(), cap
            return page.locator('#convert-result').inner_text()
        story('S41', s41)
        def s42():
            if not page.locator('[data-action=manual-rate]').is_visible(): page.locator('[data-converter] summary').click()
            act('manual-rate'); f = sheet.locator('form[data-form=rate]'); f.locator('[name=rate]').fill('-5'); f.locator('button[type=submit]').click(); page.wait_for_timeout(300)
            assert f.locator('.form-error').inner_text()
            f.locator('[name=rate]').fill('1400'); f.locator('button[type=submit]').click(); page.wait_for_timeout(500); assert not sheet.evaluate('s=>s.open')
            page.locator('#convert-amount').fill('14000'); page.wait_for_timeout(200)
            assert page.locator('#convert-result').inner_text() == '$10.00' and 'Manual rate' in page.locator('[data-converter]').inner_text()
        story('S42', s42)
        def s43():
            act('timezone'); page.locator('#zone-date').fill('2026-09-08'); page.locator('#zone-time').fill('09:00'); page.wait_for_timeout(200)
            r = page.locator('#zone-results').inner_text(); assert '5:00 PM' in r and 'Previous date' in r and '8:00 AM' in r, r
            page.locator('[data-action=zone-source][data-zone=cupertino]').click(); page.wait_for_timeout(200)
            page.locator('#zone-date').fill('2026-03-08'); page.locator('#zone-time').fill('02:30'); page.wait_for_timeout(200)
            assert 'does not exist' in page.locator('#zone-error').inner_text()
            page.locator('#zone-date').fill('2026-11-01'); page.locator('#zone-time').fill('01:30'); page.wait_for_timeout(200)
            assert 'twice' in page.locator('#zone-error').inner_text() and page.locator('[data-action=zone-occurrence]').count() == 2
            page.locator('[data-action=zone-occurrence]').first.click(); page.wait_for_timeout(200); assert not page.locator('#zone-error').inner_text().strip()
            act('zone-now'); assert 'Showing now' in page.locator('#zone-mode').inner_text(); close()
        story('S43', s43)
        def s44():
            page.wait_for_function("document.querySelector('[data-weather=detail]').innerText.includes('°C')", timeout=15000)
            t = page.locator('[data-weather=detail]').inner_text(); assert 'Feels like' in t and 'Wind' in t and 'Coming hours' in t and 'Model time' in t, t[:200]
            act('weather-unit'); page.wait_for_timeout(200); assert '°F' in page.locator('[data-weather=detail] .weather-current').inner_text()
            act('weather-unit'); page.wait_for_timeout(200)
        story('S44', s44)
        def s45():
            act('transport'); t = sheet.inner_text(); assert 'Official information' in t and 'Research date' in t and sheet.locator('section').count() >= 5; close()
        story('S45', s45)
        def s46():
            act('checklist'); assert sheet.locator('input[data-check-id]').count() == 12
            sheet.locator('[data-check-id=documents]').check(); page.wait_for_timeout(400)
            trace = []
            for _ in range(12):
                trace.append(page.evaluate("()=>[document.querySelector('#sheet').open, document.querySelector('#sheet-title')?.innerText, document.querySelector('#sheet').className, document.querySelector('#sheet [data-check-progress]')?.innerText]")); page.wait_for_timeout(250)
            assert trace[-1][0] and trace[-1][3] and '1/12' in trace[-1][3], 'trace: ' + str(trace)
            sheet.locator('.checklist-tool').first.click()
            trace2 = []
            for _ in range(12):
                page.wait_for_timeout(250); trace2.append(page.evaluate("()=>[document.querySelector('#sheet').open, document.querySelector('#sheet-title')?.innerText, document.querySelector('#sheet').className, document.querySelector('#toast')?.innerText, document.activeElement?.outerHTML?.slice(0,60)]"))
            assert trace2[-1][0] and trace2[-1][1] != 'Predeparture checklist', 'trace2: ' + str(trace2); close()
            page.reload(); page.wait_for_selector('#nav'); tab('trip'); assert '1/12' in page.locator('[data-check-progress]').first.inner_text(), 'checklist state must survive a reload'
        story('S46', s46)
        # Trip / stay
        def s51():
            tab('trip'); act('stay'); act('stay-create', sheet); f = sheet.locator('form[data-form=stay]')
            f.locator('[name=addressKo]').fill('서울 테스트 주소 1'); f.locator('[name=pin]').fill('9999#'); f.locator('[name=wifi]').fill('TestWifi'); f.locator('[name=wifiPassword]').fill('wifi-secret')
            f.locator('[name=passphrase]').fill('short'); f.locator('[name=confirm]').fill('short'); f.locator('button[type=submit]').click(); page.wait_for_timeout(300)
            assert sheet.evaluate('s=>s.open'), 'short passphrase must be rejected'
            pw = 'test phrase with enough length'; f.locator('[name=passphrase]').fill(pw); f.locator('[name=confirm]').fill(pw + 'x'); f.locator('button[type=submit]').click(); page.wait_for_timeout(300)
            assert 'match' in f.locator('.form-error').inner_text()
            f.locator('[name=confirm]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500); assert not sheet.evaluate('s=>s.open')
            raw = page.evaluate("async()=>{const d=await import('/src/db.js');return JSON.stringify(await d.getMeta('stay'));}")
            assert '9999#' not in raw and 'wifi-secret' not in raw and pw not in raw and 'AES-GCM' in raw
            assert 'Unlock stay' in page.locator('#main').inner_text()
        story('S51', s51)
        pw = 'test phrase with enough length'
        def s52():
            act('stay'); f = sheet.locator('form[data-form=unlock]'); f.locator('[name=passphrase]').fill('wrong passphrase here'); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            assert f.locator('.form-error').inner_text(), 'wrong passphrase must show an error'
            f.locator('[name=passphrase]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            t = sheet.inner_text(); assert 'Unlocked on this device' in t and '서울 테스트 주소 1' in t and '••••' in t and '9999#' not in t, t[:300]
            hrefs = sheet.locator('a[href]').evaluate_all('els=>els.map(e=>e.getAttribute("href"))'); assert any('nmap://' in h for h in hrefs)
        story('S52', s52)
        def s53():
            act('reveal-pin', sheet); assert '9999#' in sheet.locator('.pin-value').inner_text(); act('reveal-pin', sheet); assert '••••' in sheet.locator('.pin-value').inner_text()
        story('S53', s53)
        def s54():
            act('address-card', sheet); t = sheet.inner_text(); assert '여기로 가 주세요' in t and '서울 테스트 주소 1' in t and '9999#' not in t and 'wifi-secret' not in t
            act('copy-stay', sheet); page.wait_for_timeout(300); assert '서울 테스트 주소 1' == page.evaluate('navigator.clipboard.readText()')
        story('S54', s54)
        def s55():
            close(); act('stay'); assert sheet.locator('form[data-form=unlock]').count() == 1, 'vault must lock when the sheet closes'
            f = sheet.locator('form[data-form=unlock]'); f.locator('[name=passphrase]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(300)
            assert not sheet.evaluate('s=>s.open'), 'backgrounding must close the unlocked stay'
            page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true});Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(500)
        story('S55', s55)
        def s56():
            if not setup: raise Exception('SKIP no setup passphrase file supplied')
            act('stay'); f = sheet.locator('form[data-form=unlock]'); f.locator('[name=passphrase]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            sheet.locator('summary', has_text='supplied').click(); act('merge-stay', sheet); f = sheet.locator('form[data-form=seed-stay]')
            f.locator('[name=passphrase]').fill('wrong-setup-passphrase-1'); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500); assert f.locator('.form-error').inner_text()
            f.locator('[name=passphrase]').fill(setup); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            f2 = sheet.locator('form[data-form=stay]'); assert '광진구' in f2.locator('[name=addressKo]').input_value() and f2.locator('[name=pin]').input_value() == '9999#'
            assert abs(float(f2.locator('[name=lat]').input_value()) - 37.5412) < 0.001
            f2.locator('[name=passphrase]').fill(pw); f2.locator('[name=confirm]').fill(pw); f2.locator('button[type=submit]').click(); page.wait_for_timeout(1500); assert not sheet.evaluate('s=>s.open')
            act('stay'); f = sheet.locator('form[data-form=unlock]'); f.locator('[name=passphrase]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            t = sheet.inner_text(); assert '광진구' in t and '••••' in t; close()
        story('S56', s56)
        def s50():
            if not setup: raise Exception('SKIP no setup passphrase file supplied')
            c2 = browser.new_context(viewport={'width':390,'height':844}, bypass_csp=True); p2 = c2.new_page(); p2.goto(a.base + '#trip'); p2.wait_for_selector('#nav')
            sh = p2.locator('#sheet'); p2.locator('[data-action=stay]').first.click(); p2.wait_for_timeout(300)
            p2.locator('[data-action=seed-stay]').click(); p2.wait_for_timeout(300); f = sh.locator('form[data-form=seed-stay]')
            f.locator('[name=passphrase]').fill('wrong-setup-passphrase-1'); f.locator('button[type=submit]').click(); p2.wait_for_timeout(1500); assert f.locator('.form-error').inner_text()
            f.locator('[name=passphrase]').fill(setup); f.locator('button[type=submit]').click(); p2.wait_for_timeout(2000)
            t = sh.inner_text(); assert 'Unlocked on this device' in t and '광진구 광나루로38길 81' in t, t[:300]
            hrefs = sh.locator('a[href]').evaluate_all('els=>els.map(e=>e.getAttribute("href"))'); assert any('dlat=37.5412' in h for h in hrefs), hrefs
            raw = p2.evaluate("async()=>{const d=await import('/src/db.js');return JSON.stringify(await d.getMeta('stay'));}"); assert '광나루로' not in raw and 'AES-GCM' in raw
            c2.close()
        story('S50', s50)
        def s57():
            tab('trip'); act('backup'); f = sheet.locator('form[data-form=backup]')
            f.locator('[name=passphrase]').fill('backup passphrase long enough'); f.locator('[name=confirm]').fill('backup passphrase long enough')
            with page.expect_download(timeout=15000) as dl: f.locator('button[type=submit]').click()
            d = dl.value; path = d.path(); data = json.loads(Path(path).read_text()); assert d.suggested_filename.startswith('seoul-pocket-backup-'), d.suggested_filename; assert 'AES-GCM' in json.dumps(data) and 'Gwangjang' not in json.dumps(data), list(data)[:6]
            page.evaluate("window.__backup=arguments") if False else None; close(); return d.suggested_filename
        story('S57', s57)
        backup_path = [None]
        def s58():
            tab('trip'); act('backup'); f = sheet.locator('form[data-form=backup]')
            f.locator('[name=passphrase]').fill('backup passphrase long enough'); f.locator('[name=confirm]').fill('backup passphrase long enough')
            with page.expect_download(timeout=15000) as dl: f.locator('button[type=submit]').click()
            bp = dl.value.path(); close(); backup_path[0] = bp
            before = page.evaluate("async()=>{const d=await import('/src/db.js');return (await d.all()).length}")
            act('restore'); f = sheet.locator('form[data-form=restore]'); f.locator('input[name=backup]').set_input_files(bp); f.locator('[name=passphrase]').fill('wrong backup passphrase'); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
            assert f.locator('.form-error').inner_text(); assert page.evaluate("async()=>{const d=await import('/src/db.js');return (await d.all()).length}") == before
            f.locator('[name=passphrase]').fill('backup passphrase long enough'); f.locator('button[type=submit]').click(); page.wait_for_timeout(2500)
            assert not sheet.evaluate('s=>s.open'); after = page.evaluate("async()=>{const d=await import('/src/db.js');return (await d.all()).length}"); assert after == before * 2, (before, after)
            assert 'Existing stay vault kept' in page.locator('#toast').inner_text()
            c3 = browser.new_context(viewport={'width':390,'height':844}, bypass_csp=True); p3 = c3.new_page(); p3.goto(a.base + '#trip'); p3.wait_for_selector('#nav')
            p3.locator('[data-action=restore]').click(); p3.wait_for_timeout(300); f3 = p3.locator('#sheet form[data-form=restore]'); f3.locator('input[name=backup]').set_input_files(bp); f3.locator('[name=passphrase]').fill('backup passphrase long enough'); f3.locator('button[type=submit]').click(); p3.wait_for_timeout(2500)
            assert 'vault imported' in p3.locator('#toast').inner_text(), p3.locator('#toast').inner_text()
            assert p3.evaluate("async()=>{const d=await import('/src/db.js');return (await d.all()).length}") == before
            p3.locator('[data-action=checklist]').first.click(); p3.wait_for_timeout(300); assert p3.locator('[data-check-id=documents]').is_checked() and not p3.locator('[data-check-id=install]').is_checked(); c3.close()
        story('S58', s58)
        def s59():
            tab('trip'); page.locator('summary', has_text='Offline checks').click(); act('readiness'); page.wait_for_timeout(2500)
            t = sheet.inner_text(); assert 'cached on this device' in t and ('NOT verified' in t or 'machine-generated' in t or 'Reviewed audio pack' in t) and 'written Korean phrases' in t, t[:300]
            act('persist', sheet); page.wait_for_timeout(1500); assert 'Persist' in page.locator('#toast').inner_text(); close()
        story('S59', s59)
        def s60():
            page.locator('summary', has_text='Offline checks').click() if not page.locator('[data-action=connection]').is_visible() else None
            act('connection'); f = sheet.locator('form[data-form=connection]'); f.locator('[name=token]').fill('tooshort'); f.locator('button[type=submit]').click(); page.wait_for_timeout(300); assert sheet.evaluate('s=>s.open')
            f.locator('[name=token]').fill(token or 'x'*40); f.locator('button[type=submit]').click(); page.wait_for_timeout(400); assert not sheet.evaluate('s=>s.open')
        story('S60', s60)
        def s28():
            if not token: raise Exception('SKIP no token file supplied')
            tab('saved'); act('naver'); f = sheet.locator('form[data-form=naver]'); f.locator('[name=query]').fill('건대 양꼬치'); f.locator('button[type=submit]').click(); page.wait_for_timeout(4000)
            cards = sheet.locator('#naver-results .card'); assert cards.count() >= 1, sheet.locator('.form-error').inner_text()
            first = cards.first.inner_text(); sheet.locator('[data-action=import-naver]').first.click(); page.wait_for_timeout(400)
            f2 = sheet.locator('form[data-form=place]'); assert f2.locator('[name=name]').input_value() and f2.locator('[name=lat]').input_value(); f2.locator('button[type=submit]').click(); page.wait_for_timeout(800)
            return first.splitlines()[0]
        story('S28', s28)
        def s61():
            tab('trip'); page.evaluate("window.print=()=>{window.__printed=document.querySelector('#print-panel').innerText}")
            page.locator('summary', has_text='Offline checks').click(); act('print'); act('print-now', sheet); page.wait_for_timeout(300)
            t = page.evaluate('window.__printed'); assert '112' in t and '119' in t and '9999#' not in t and 'wifi-secret' not in t and '테스트 주소' not in t; close()
        story('S61', s61)
        # Offline
        def s80():
            ctx.set_offline(True); page.reload(); page.wait_for_selector('#nav', timeout=15000)
            browser_flipped = not page.evaluate('navigator.onLine')
            if not browser_flipped:
                # Headless Chromium does not flip navigator.onLine under network emulation. This exercises the app's offline handler only; the real network check is the fetch below.
                page.evaluate("Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});window.dispatchEvent(new Event('offline'))"); page.wait_for_timeout(200)
            assert 'Offline' in page.locator('#connection').inner_text(), page.locator('#connection').inner_text()
            assert page.evaluate("fetch('/api/health').then(()=>false).catch(()=>true)"), 'network must actually be offline'
            tab('saved'); assert page.locator('.place-card').count() >= 1 and page.locator('.place-thumb img').count() >= 1
            tab('speak'); assert page.locator('.phrase').count() == 28
            tab('tools'); page.locator('#convert-amount').fill('14000'); page.wait_for_timeout(200); assert page.locator('#convert-result').inner_text() == '$10.00'
            assert 'Last saved' in page.locator('[data-weather=detail]').inner_text() or 'Offline' in page.locator('[data-weather=detail]').inner_text()
            tab('trip'); act('stay'); f = sheet.locator('form[data-form=unlock]'); f.locator('[name=passphrase]').fill(pw); f.locator('button[type=submit]').click(); page.wait_for_timeout(1500); assert 'Unlocked' in sheet.inner_text(); close()
            ctx.set_offline(False); page.evaluate("delete navigator.onLine")
        story('S80', s80)
        def s04():
            ctx.set_offline(False); page.reload(); page.wait_for_selector('#nav')
            assert page.evaluate('navigator.onLine'), 'online flag must recover after the offline story'
            assert page.evaluate("async()=>{const r=await navigator.serviceWorker.getRegistration();return !!(r&&r.active)}")
        story('S04', s04)
        def s03():
            assert not [e for e in errors if 'ResizeObserver' not in e], errors
        story('S03', s03)
        browser.close()
    fails = [r for r in RESULTS if r[1] == 'FAIL' and not r[2].startswith('SKIP')]
    print(f'\n{len([r for r in RESULTS if r[1]=="PASS"])} passed, {len(fails)} failed, {len([r for r in RESULTS if r[2].startswith("SKIP")])} skipped')
    Path('qa').mkdir(exist_ok=True); Path('qa/user-stories-results.json').write_text(json.dumps([{'id':i,'result':r,'note':n} for i,r,n in RESULTS], ensure_ascii=False, indent=1))
    sys.exit(1 if fails else 0)

def png_bytes():
    import zlib, struct
    w, h = 64, 48
    raw = b''.join(b'\x00' + bytes([200, 60, 60] * w) for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

if __name__ == '__main__':
    main()
