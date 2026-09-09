"""Shared-trip stories, run with two independent browser contexts against an origin that has the D1 binding.
Usage: python tests/sync_stories.py --base http://127.0.0.1:8788 --token-file .dev.vars
Prints PASS/FAIL per story; exit 1 on any failure. Stories: T01 create, T02 join+pull, T03 conflict use-shared, T04 conflict keep-mine,
T05 delete propagates, T06 wrong passphrase is reported, T07 invite rotation, T08 leave returns to local-only.
"""
import argparse, re, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

PASS = 'super secret group phrase 2026'
RESULTS = []
def story(sid, fn):
    try:
        note = fn() or ''; RESULTS.append((sid, True)); print(f'PASS {sid} {note}', flush=True)
    except Exception as err:
        import traceback; tb = traceback.extract_tb(err.__traceback__); where = next((f'line {f.lineno}' for f in reversed(tb) if f.filename.endswith('sync_stories.py')), '')
        RESULTS.append((sid, False)); print(f'FAIL {sid} {str(err).splitlines()[0][:300]} @{where}', flush=True)

def new_page(browser, base):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True, permissions=['clipboard-read', 'clipboard-write'])
    page = ctx.new_page(); page.goto(base + '#trip'); page.wait_for_selector('#nav'); return page

def tab(page, name):
    page.click(f'[data-tab="{name}"]'); page.wait_for_timeout(150)

def sync_now(page):
    tab(page, 'trip'); before = page.evaluate("()=>Number(document.querySelector('#connection').dataset.syncRuns||0)")
    page.click('[data-action="share-sync"]')
    page.wait_for_function(f"()=>Number(document.querySelector('#connection').dataset.syncRuns||0)>{before}&&!document.querySelector('[data-action=\"share-sync\"]')?.disabled", timeout=20000)
    page.wait_for_timeout(200); return page.locator('[data-sync-line]').inner_text()

def add_place(page, name, note=''):
    tab(page, 'today'); page.click('[data-action="new"]'); page.fill('form[data-form="place"] input[name="name"]', name)
    if note: page.fill('form[data-form="place"] textarea[name="note"]', note)
    page.click('form[data-form="place"] button[type="submit"]'); page.wait_for_function("()=>!document.querySelector('#sheet').open")

def edit_note(page, name, note):
    tab(page, 'saved'); page.click(f'.place-card:has-text("{name}") .place-main'); page.click('[data-action="edit"]')
    page.fill('form[data-form="place"] textarea[name="note"]', note); page.click('form[data-form="place"] button[type="submit"]')
    page.wait_for_function("()=>!document.querySelector('#sheet').open")

def card_names(page):
    tab(page, 'saved'); return page.locator('.place-card h3').all_inner_texts()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://127.0.0.1:8788'); ap.add_argument('--token-file', default='.dev.vars'); a = ap.parse_args()
    token = re.search(r'API_ACCESS_TOKEN=(\S+)', Path(a.token_file).read_text()).group(1)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        A = new_page(browser, a.base); B = new_page(browser, a.base)
        invite = {'text': ''}
        def t01():
            A.click('[data-action="share-create"]'); f = 'form[data-form="share-create"] '
            A.fill(f + 'input[name="name"]', 'Sync test trip'); A.fill(f + 'input[name="memberName"]', 'Alpha')
            A.fill(f + 'input[name="passphrase"]', PASS); A.fill(f + 'input[name="confirm"]', PASS); A.fill(f + 'input[name="token"]', token)
            A.click(f + 'button[type="submit"]'); A.wait_for_selector('[data-invite]', timeout=20000)
            invite['text'] = A.locator('[data-invite]').inner_text().strip(); assert re.fullmatch(r'[a-f0-9]{16}-[A-Z0-9]{8}', invite['text']), invite['text']
            A.click('[data-action="close"]'); expect(A.locator('#connection')).to_contain_text('Shared trip', timeout=5000)
            add_place(A, 'Sync Test Place', 'from A v1'); expect(A.locator('#toast')).to_contain_text('reaches the group')
            line = sync_now(A); assert 'waiting' not in line; return invite['text']
        story('T01 owner creates a trip, gets an invite, first find syncs', t01)
        def t02():
            B.click('[data-action="share-join"]'); f = 'form[data-form="share-join"] '
            B.fill(f + 'input[name="invite"]', invite['text'].lower()); B.fill(f + 'input[name="memberName"]', 'Beta'); B.fill(f + 'input[name="passphrase"]', PASS)
            B.click(f + 'button[type="submit"]'); B.wait_for_function("()=>!document.querySelector('#sheet').open", timeout=20000)
            sync_now(B); names = card_names(B); assert 'Sync Test Place' in names, names
            B.click('.place-card:has-text("Sync Test Place") .place-main'); expect(B.locator('#sheet')).to_contain_text('from A v1'); B.click('[data-action="close"]')
            A.click('[data-action="share-members"]'); A.wait_for_selector('#sheet .card'); txt = A.locator('#sheet').inner_text(); assert 'Alpha' in txt and 'Beta' in txt, txt; A.click('[data-action="close"]')
        story('T02 guest joins with the invite and pulls the find; members list shows both', t02)
        def t03():
            A.context.set_offline(True); edit_note(A, 'Sync Test Place', 'from A v2')  # edited underground, cannot see B's change
            edit_note(B, 'Sync Test Place', 'from B v2'); sync_now(B)
            A.context.set_offline(False); sync_now(A); tab(A, 'saved'); expect(A.locator('.place-card:has-text("Sync Test Place")')).to_contain_text('Needs a decision')
            A.click('.place-card:has-text("Sync Test Place") .place-main'); expect(A.locator('#sheet')).to_contain_text('Two versions'); expect(A.locator('#sheet')).to_contain_text('from A v2')
            A.click('[data-action="conflict-shared"]'); expect(A.locator('#sheet')).to_contain_text('from B v2'); expect(A.locator('#sheet')).not_to_contain_text('Two versions'); A.click('[data-action="close"]')
            line = sync_now(A); assert 'decision' not in line, line
        story('T03 concurrent edits: nothing is overwritten and "Use shared" adopts the other copy', t03)
        def t04():
            A.context.set_offline(True); edit_note(A, 'Sync Test Place', 'from A v3')
            edit_note(B, 'Sync Test Place', 'from B v3'); sync_now(B)
            A.context.set_offline(False); sync_now(A); tab(A, 'saved')
            A.click('.place-card:has-text("Sync Test Place") .place-main'); expect(A.locator('#sheet')).to_contain_text('Two versions')
            A.click('[data-action="conflict-mine"]'); expect(A.locator('#sheet')).to_contain_text('from A v3'); A.click('[data-action="close"]'); sync_now(A)
            sync_now(B); tab(B, 'saved'); B.click('.place-card:has-text("Sync Test Place") .place-main'); expect(B.locator('#sheet')).to_contain_text('from A v3'); B.click('[data-action="close"]')
        story('T04 "Keep mine" re-shares the local copy on top of the newer version', t04)
        def t05():
            add_place(A, 'Doomed Place'); sync_now(A); sync_now(B); assert 'Doomed Place' in card_names(B)
            tab(A, 'saved'); A.click('.place-card:has-text("Doomed Place") .place-main'); A.once('dialog', lambda d: d.accept()); A.click('[data-action="delete"]')
            A.wait_for_function("()=>!document.querySelector('#sheet').open"); sync_now(A); sync_now(B); assert 'Doomed Place' not in card_names(B)
        story('T05 a delete becomes a tombstone and disappears on the other phone', t05)
        def t06():
            C = new_page(browser, a.base); C.click('[data-action="share-join"]'); f = 'form[data-form="share-join"] '
            C.fill(f + 'input[name="invite"]', invite['text']); C.fill(f + 'input[name="passphrase"]', 'a completely wrong passphrase'); C.click(f + 'button[type="submit"]')
            C.wait_for_function("()=>!document.querySelector('#sheet').open", timeout=20000); tab(C, 'trip'); C.click('[data-action="share-sync"]')
            C.wait_for_function("()=>/passphrase/.test(document.querySelector('[data-sync-line]')?.textContent||'')", timeout=20000)
            assert 'Sync Test Place' not in card_names(C); C.context.close()
        story('T06 a wrong group passphrase is reported and nothing unreadable is stored as a find', t06)
        def t07():
            tab(A, 'trip'); A.click('[data-action="share-invite"]'); A.click('[data-action="share-rotate"]'); A.wait_for_function(f"()=>document.querySelector('[data-invite]')?.textContent.trim()!=='{invite['text']}'", timeout=10000)
            fresh = A.locator('[data-invite]').inner_text().strip(); A.click('[data-action="close"]')
            C = new_page(browser, a.base); C.click('[data-action="share-join"]'); f = 'form[data-form="share-join"] '
            C.fill(f + 'input[name="invite"]', invite['text']); C.fill(f + 'input[name="passphrase"]', PASS); C.click(f + 'button[type="submit"]')
            expect(C.locator('form[data-form="share-join"] .form-error')).to_contain_text('not valid'); C.context.close(); invite['text'] = fresh
        story('T07 rotating the invite stops the old code at once', t07)
        def t08():
            tab(B, 'trip'); B.once('dialog', lambda d: d.accept()); B.click('[data-action="share-leave"]')
            expect(B.locator('#connection')).to_contain_text('not shared'); assert 'Sync Test Place' in card_names(B)
            B.reload(); B.wait_for_selector('#nav'); expect(B.locator('#connection')).to_contain_text('not shared')
        story('T08 leaving keeps local finds and returns the phone to local-only', t08)
        browser.close()
    failed = [s for s, ok in RESULTS if not ok]; print(f'{len(RESULTS)-len(failed)}/{len(RESULTS)} passed'); sys.exit(1 if failed else 0)

if __name__ == '__main__': main()
