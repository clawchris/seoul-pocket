# 06 · Test and delivery report · v0.2
This report describes executed evidence, not a certification. See qa/ for raw logs. Runtime timestamps in logs are UTC and may roll into 8 September; the product/source review date is 7 September 2026.

## Executed checks
| Check | Result | What it establishes |
|---|---|---|
| Syntax/JSON checks | Passed | Production JS parses and expected files validate. |
| Node unit/contract suite | **77 passed, 0 failed, 0 skipped in this owner package** | Existing domain/crypto/API/SW checks plus 36 new timezone/weather/checklist/stay checks. |
| Production build | Passed | Generated content-derived shell, 23 explicit cached assets, 149,837 bytes before media/audio; build fab3593d12b89358. |
| Plaintext deployment scan | Passed, 27 static files inspected | Exact supplied address/coordinates and generated setup key absent in plaintext from dist; forbidden directory boundaries checked. Not a penetration test. |
| DOM/UI harness | **22 passed; no unhandled page errors** | Selected actual UI flows and overflow at widths 320/390/430/768/1280. Explicit fake storage/crypto/provider adapters. |
| Real-origin smoke attempt | **Blocked before app load** | Chromium navigation returned ERR_BLOCKED_BY_ADMINISTRATOR at localhost. No real-origin behavior was validated by this attempt. |
| Offline audio | Passes with warning | All 28 clips bundled (machine-generated, Apple Yuna ko_KR); native-speaker review still pending, so the manifest stays reviewed:false. |

## Added unit coverage
Timezone tests cover the three fixed IDs, source-zone conversion, UTC offsets, summer/winter Pacific rules, midnight/date rollover, invalid input, the 2026 spring gap and repeated autumn hour. These execute native Intl in Node, not on iOS.

Weather tests use controlled fixtures/mocked provider fetch: schema, location, units, explicit Seoul timestamp, null rain chance, future/stale/expired data, temperature conversion, fixed-upstream endpoint and provider failure. They do not prove live Cloudflare or Open-Meteo success.

Stay tests execute real native Web Crypto to decrypt the supplied seed using the private generated key and compare it to the exact source. They also cover safe map URLs, address-only merge and coordinate-less legacy stays. Clipboard/UI/WebKit behavior is separate. The seed test deliberately skips when a public checkout lacks private/.

Checklist checks validate 12 unique IDs, boolean completion, restore classification and backup rejection of malformed records. The Node tests validate pure restore rules and snapshot validation, not actual IndexedDB transaction execution.

## Added UI coverage
Finite radio choices; sourced local idea import and duplicate avoidance in the current view; user-selected must-try; search; currency swap/presets/number preservation across surfaces; exactly three timezone choices and correct previous-date display; DST gap/repeated-hour interaction; checked-item persistence in the in-memory adapter; supplied stay flow and map link; hidden PIN/driver exclusion; reviewed address merge retaining other fields; Korean cards; weather C/F, refresh failure retaining timestamp, offline label and >6-hour warning; no page-level horizontal overflow on the exercised screens.

The harness replaces storage, encryption, offline registration and network, and embeds the actual UI via page.set_content because browser URL navigation is administratively blocked. These adapters are never shipped in dist. Its synthetic weather/rate/test finds are not live data. The stay rendering uses the real supplied address, so QA screenshots are private. Full-page captures naturally place the fixed nav at the original viewport position; inspect viewport behavior on the actual phone.

## Still unverified or unfinished
Real browser storage persistence across termination; actual service-worker installation/offline cold restart; iPhone Home Screen behavior, keyboard and download/restore; first-entry/changed-passphrase workflow on iOS; live Kakao place-search credentials; deployed rate/weather Functions, headers, cache and quotas; actual map app handoff; reviewed Korean text/audio; independent security audit; genuine group sessions/sync/private R2 transfer. No Cloudflare deployment was created.

## Release interpretation
The local update is substantially implemented and regression-tested. It is **not yet trip-ready**. Run the real-origin smoke script on an allowed test origin, then the physical-device matrix in docs/04. Do not describe checklist completion or cache presence as an automatic pass. Do not weaken the audio gate or confuse backup transfer with shared editing.

## Real-origin user-story suite (added 8 September 2026)
`tests/user_stories.py` drives the deployed production origin in real Chromium (Playwright) at an iPhone viewport and walks every user story in the tracking sheet: shell and tabs, Today, saved finds with photo and links, edit and reload persistence, filters and search, starter ideas, dirty-form guard, phrases and audio, one-button currency and rates, the three-city clock with DST gap and repeat handling, weather, transport, checklist persistence, creating and unlocking the stay vault, PIN reveal, driver card, background lock, loading and merging the preconfigured stay with the owner passphrase, encrypted backup export and non-overwriting restore on a second profile, readiness, place-search token and a live Kakao query, print card, and an offline reload under the service worker.

Two defects found by this suite were fixed the same day. Reloading under the service worker failed with `ERR_FAILED` because Cloudflare Pages redirects `/index.html` to `/` and a cached redirected response cannot satisfy a navigation; the shell is now cached under `/` with the redirect flag stripped, with a regression test. The worker-template change also did not change the cache version, so the build hash now includes the build script.

Run it with `python tests/user_stories.py --base <origin> --token-file <file with API_ACCESS_TOKEN> --setup-passphrase-file private/OWNER_SETUP.md`. Results land in `qa/user-stories-results.json`. Physical-iPhone tests remain a separate, manual gate.

## Independent reviews (8 September 2026)
Three independent review passes ran against the repo and the live origin after the story suite first passed: a security and privacy audit, a code-correctness review, and a UX/design audit measured in real Chromium against the emilkowalski motion rules, the Impeccable craft floor and the Design with Intent inclusion and hardening checklists. None found a critical. Everything rated Medium or higher was fixed the same day and is listed in the commit history: edge caching for rates and weather with no-store elsewhere, a JSON 404 for unknown API routes, https Kakao links, no CORS wildcard on static assets, a stronger passphrase rule and a refusal to reuse the shared setup passphrase for a personal vault, synchronous DOM clearing on lock, a sheet-close race on child transitions, audio playback failure falling back to the device voice, a stricter privacy scanner, required-field errors that name the field, disabled-button contrast, a two-tone focus ring, removal of the hero eyebrow, a proper currency empty state, a weather live region, and passphrase reveal toggles. The story suite passed 43/43 after each fix round (rounds 2, 3 and 4). Still open and deliberately not done here: a Cloudflare WAF rate-limiting rule on /api/* (dashboard-only), native-speaker review of the 28 clips and phrase text, and every physical-iPhone gate in docs/04.
