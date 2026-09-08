"""Real-origin smoke test. Requires a running `npm run preview` server.
Not executed in the authoring environment, where browser URL navigation is blocked.
Install test tooling separately: python -m pip install playwright; playwright install chromium
Run: python tests/browser_smoke.py --base http://localhost:4173
This uses the REAL production IndexedDB, Web Crypto and service worker modules.
It is a desktop Chromium smoke check, not a substitute for the physical-iPhone checklist.
"""
import argparse, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://localhost:4173');parser.add_argument('--browser-path');args=parser.parse_args()
    with sync_playwright() as p, tempfile.TemporaryDirectory() as temp:
        opts={'headless':True}
        if args.browser_path:opts['executable_path']=args.browser_path
        browser=p.chromium.launch(**opts);ctx=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
        page=ctx.new_page();page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.base);page.wait_for_selector('.hero');page.evaluate('navigator.serviceWorker.ready');page.reload();page.wait_for_selector('.hero')
        page.get_by_role('button',name='Saved',exact=True).click();page.get_by_role('button',name='Add a place or food idea').click()
        page.get_by_label('Name *',exact=True).fill('OFFLINE SMOKE TEST');page.get_by_label('Korean name',exact=True).fill('서울')
        page.get_by_role('button',name='Save on this device',exact=True).click();expect(page.locator('.place-card')).to_have_count(1)
        page.get_by_role('button',name='Trip',exact=True).click();page.get_by_role('button',name='Set up our stay').click();page.get_by_role('button',name='Create stay vault').click()
        page.get_by_label('Address in Korean *',exact=True).fill('서울 테스트 주소');page.get_by_label('Door / building entry PIN',exact=True).fill('9999#')
        for label in ['Choose a vault passphrase','Confirm passphrase']:page.get_by_label(label,exact=True).fill('test phrase with enough length')
        page.get_by_role('button',name='Encrypt and save stay').click();expect(page.locator('#sheet')).not_to_be_visible()
        # Inspect the actual IndexedDB vault; secrets must not be present in stored envelope JSON.
        raw=page.evaluate("""async()=>{const d=await import('/src/db.js');return JSON.stringify(await d.getMeta('stay'));}""")
        assert '9999#' not in raw and 'test phrase with enough length' not in raw and 'AES-GCM' in raw
        ctx.set_offline(True);page.reload();page.wait_for_selector('#nav')
        page.get_by_role('button',name='Saved',exact=True).click();expect(page.locator('.place-card')).to_have_count(1)
        page.get_by_role('button',name='Trip',exact=True).click();page.get_by_role('button',name='Unlock stay',exact=True).click()
        page.get_by_label('Vault passphrase',exact=True).fill('test phrase with enough length');page.locator('#sheet').get_by_role('button',name='Unlock stay',exact=True).click()
        expect(page.locator('.pin-value')).to_have_text('••••');page.get_by_role('button',name='Reveal',exact=True).click();expect(page.locator('.pin-value')).to_have_text('9999#')
        page.get_by_role('button',name='Show address card').click();assert '9999' not in page.locator('#sheet').inner_text()
        page.get_by_role('button',name='Close panel').click();page.wait_for_function("document.getElementById('sheet').innerText===''")
        page.get_by_role('button',name='Offline check',exact=True).click();expect(page.locator('#sheet')).to_contain_text('App shell is cached on this device.')
        assert not errors,errors;browser.close()
        print('PASS: real-origin local save, encrypted-at-rest vault, offline reload and offline unlock. Physical iPhone tests still required.')
if __name__=='__main__':main()
