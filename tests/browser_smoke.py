"""Real-origin desktop smoke test; run only against an isolated disposable test origin.
Requires: npm run preview; separate Python Playwright installation and Chromium.
No storage/crypto/service-worker mocks. External providers are not required or tested.
This script was NOT passed in the authoring environment: URL navigation was blocked.
A desktop pass is not a physical-iPhone cold-restart or app-eviction test.
"""
import argparse
from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://localhost:4173')
    parser.add_argument('--browser-path')
    args = parser.parse_args()
    with sync_playwright() as p:
        opts = {'headless': True}
        if args.browser_path:
            opts['executable_path'] = args.browser_path
        browser = p.chromium.launch(**opts)
        context = browser.new_context(viewport={'width':390,'height':844}, accept_downloads=True, bypass_csp=True)  # CSP is verified separately with curl; the runner needs eval
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(args.base)
        page.wait_for_selector('.hero')
        page.evaluate('navigator.serviceWorker.ready')
        page.reload()
        page.wait_for_selector('.hero')
        page.get_by_role('button', name='Saved', exact=True).click()
        page.get_by_role('button', name='Add a place or food idea').click()
        page.get_by_label('Name *', exact=True).fill('OFFLINE SMOKE TEST')
        page.get_by_label('Korean name', exact=True).fill('서울')
        page.get_by_role('button', name='Save on this device', exact=True).click()
        expect(page.locator('.place-card')).to_have_count(1)
        page.get_by_role('button', name='Trip', exact=True).click()
        page.get_by_role('button', name='Open checklist', exact=True).click()
        page.locator('[data-check-id="documents"]').check()
        expect(page.locator('#sheet [data-check-progress]')).to_have_text('1/12 checked')
        page.get_by_role('button', name='Close panel').click()
        page.wait_for_function('!document.querySelector("#sheet").open')
        page.get_by_role('button', name='Set up our stay', exact=True).click()
        page.get_by_role('button', name='Create a different stay', exact=True).click()
        page.get_by_label('Address in Korean *', exact=True).fill('서울 테스트 주소')
        page.get_by_label('Door / building entry PIN', exact=True).fill('9999#')
        passphrase = 'test phrase with enough length'
        page.get_by_label('Choose a vault passphrase', exact=True).fill(passphrase)
        page.get_by_label('Confirm passphrase', exact=True).fill(passphrase)
        page.get_by_role('button', name='Encrypt and save stay', exact=True).click()
        expect(page.locator('#sheet')).not_to_be_visible()
        raw = page.evaluate("async()=>{const d=await import('/src/db.js');return JSON.stringify(await d.getMeta('stay'));}")
        assert '9999#' not in raw and passphrase not in raw and 'AES-GCM' in raw
        # Real local rate storage; no live provider or current-rate claim.
        page.evaluate("async()=>{const d=await import('/src/db.js');await d.setMeta('rate',{rate:1400,date:new Date().toISOString().slice(0,10),source:'manual'});}")
        context.set_offline(True)
        page.reload()
        page.wait_for_selector('#nav')
        page.get_by_role('button', name='Saved', exact=True).click()
        expect(page.locator('.place-card')).to_have_count(1)
        page.get_by_role('button', name='Tools', exact=True).click()
        page.locator('#convert-amount').fill('14000')
        expect(page.locator('#convert-result')).to_have_text('$10.00')
        page.get_by_role('button', name='Swap currencies: currently KRW to USD').click()
        expect(page.locator('#convert-amount')).to_have_value('14000')
        assert page.locator('select').count() == 0
        page.locator('[data-action="timezone"]').click()
        page.locator('#zone-date').fill('2026-09-08')
        page.locator('#zone-time').fill('09:00')
        expect(page.locator('#zone-results')).to_contain_text('5:00 PM')
        expect(page.locator('#zone-results')).to_contain_text('Previous date')
        page.get_by_role('button', name='Close panel').click()
        page.get_by_role('button', name='Trip', exact=True).click()
        page.get_by_role('button', name='Open checklist', exact=True).click()
        expect(page.locator('[data-check-id="documents"]')).to_be_checked()
        expect(page.locator('[data-check-id="offline"]')).not_to_be_checked()
        page.get_by_role('button', name='Close panel').click()
        page.get_by_role('button', name='Unlock stay', exact=True).click()
        page.get_by_label('Vault passphrase', exact=True).fill(passphrase)
        page.locator('#sheet').get_by_role('button', name='Unlock stay', exact=True).click()
        expect(page.locator('.pin-value')).to_have_text('••••')
        page.get_by_role('button', name='Reveal', exact=True).click()
        expect(page.locator('.pin-value')).to_have_text('9999#')
        page.get_by_role('button', name='Show address card').click()
        assert '9999' not in page.locator('#sheet').inner_text()
        page.get_by_role('button', name='Close panel').click()
        page.wait_for_function('document.querySelector("#sheet").innerText===""')
        assert not errors, errors
        browser.close()
        print('PASS: real-origin local save, encrypted-at-rest vault, checklist persistence, offline reload/unlock, currency and three-city conversion. Live providers and physical iPhone still untested.')


if __name__ == '__main__':
    main()
