# 04 · Codex implementation and release plan · v0.2
The requested functional update is implemented. Complete the integration and reliability work below. Do not restart the app, add a framework by default or revive declined extra features.

## Stage A · reproduce and protect the owner data
Read the scope, architecture, change trace and private setup. Run npm run verify. Confirm the exact supplied source decrypts correctly and the runtime plaintext scan passes. Do not publish private/, QA screenshots, documents or the whole ZIP. `prepare:stay` is not a deployment step.

Run tests/browser_smoke.py on an allowed disposable real HTTP origin. It uses real production IndexedDB/Web Crypto/service-worker modules, not the UI harness adapters. Add real-browser tests for image persistence and checklist restore behavior, as current Node coverage does not execute actual IndexedDB transactions. Verify v0.1 populated databases remain readable and no deployed seed replaces an existing vault.

Exit: real-origin local save/reload, encrypted vault, offline reload, actual backup restore and old-data upgrade pass. Record exact browsers/versions and commands, not an unsupported confidence percentage.

## Stage B · deploy staging and prove live services
Use a supported Pages Git/Wrangler deployment that includes root functions/. Static output is dist. Keep staging/production secrets and data separate. Validate deployed CSP/security headers, /api routing and HTTPS. Confirm dist is the only static root. Pin the tooling version actually tested [S1–S4].

Weather: /api/weather is a public fixed-district GET with no client-provided coordinates or upstream URL. Verify live Open-Meteo response/schema/timezone, timeout handling, cache behavior, quotas and attribution. The free endpoint is for non-commercial use and has no uptime guarantee; re-evaluate for commercial/public-scale deployment [S37–S38]. Add platform abuse/rate limiting before exposing broadly. A 10-minute upstream cache hint is not a proven deployed hit ratio or abuse barrier.

Rates: test real USD/KRW response, reference date, manual entry, offline use, malformed result and failed refresh. Naver: obtain valid server-side credentials for the selected API product, test Korean result/address/coordinate fields, native app handoff and browser fallback. Keep manual saving functional if Naver is unavailable [S5–S9,S15]. Do not store the development proxy token as a production shared-session system.

Exit: live success and error evidence on actual staging URL. No integration is complete merely because mocked Node contract tests pass.

## Stage C · finish reliable pronunciation
Supply permitted audio recordings for all 28 phrase IDs, fill the existing manifest/review fields, have Korean text/phonetics/audio reviewed and rebuild. Run npm run check:audio. Test each needed phrase in airplane mode on the oldest traveler iPhone. Do not weaken the test or call device TTS equivalent. A consciously accepted text-only scope must be explicit.

## Stage D · genuine sharing, only if required
The original “we” suggests multiple users; confirm whether independent phone copies are acceptable or shared edits are essential. /api/sync remains a 501 placeholder. The full versioned protocol is in docs/03. Implement per-member permissions, secure sessions, invitations, encrypted shared payloads, private media and atomic local outbox, server versions, receipts, tombstones, cursors and explicit conflict resolution. Test simultaneous offline edits, lost acknowledgements, retries and revoked members. Preserve local-only mode and do not sync device-readiness confirmations as shared completion.

## Stage E · physical iPhone acceptance matrix
| Test | Required outcome |
|---|---|
| Install and relaunch | Home Screen copy opens from icon, correct safe-area/keyboard behavior and readable controls |
| Fresh supplied stay | Correct setup phrase loads exact source; wrong phrase fails; no inferred room/PIN; owner can change local vault phrase |
| Existing stay | Address-only review retains PIN/room/Wi-Fi/notes; cancel and redeploy leave saved envelope untouched |
| Background privacy | Open/unlock, switch app during decryption/copy/edit, return: no unlocked secret dialog or resurfaced completed-decryption sheet |
| Navigation | Actual Naver app search/route and browser fallback; correct destination pin; no PIN in any URL; Korean copy works |
| Offline cold restart | Force-close installed app, airplane mode, reopen; read find/photo, unlock address, convert saved-rate price, compare dates/time, reopen checked items |
| Currency | Swap both ways, type decimal/comma-formatted amount, use presets, navigate/reopen; visible stale date, no incorrect label/currency |
| Pacific transitions | 2026-03-08 02:30 Cupertino rejected; 2026-11-01 01:30 requires first/second; verify summer/winter and previous-date labels |
| Weather | Obtain real forecast, go offline, fail refresh, age snapshot past 90m/6h; keep original data/timestamps and clear warnings; C/F numeric conversion |
| Locality | Add each idea once; source/caveats retained; priority remains user-chosen; verify current entrance/route before travel |
| Recovery | Export/download, independently reopen backup file and restore on another device; no existing records overwritten; device checklist tests not imported as done |
| Updates | Rebuild with a harmless change; failed install retains old cache; no active edit lost; deployed worker version changes only after safe acceptance |
| Audio | Reviewed clips work offline; missing playback is an honest failure, not silently marked ready |
| Shared release | Two actual devices converge safely with explicit conflicts/retries; expired sessions do not erase pending local edits |

Desktop tests are useful but are not substitutes for this matrix. Test on each traveler phone, including the oldest iOS version. Keep automatic time enabled and test the installed app, not only a Safari tab.

## Stage F · production freeze
Confirm travel dates, airport and entry procedure; validate the map pin with the host; complete the user's checklist through real actions. Export independent recovery copies. Freeze the tested version shortly before travel, record deployed URL/build hash/configuration and avoid unnecessary mid-trip changes. Unresolved audio or sharing must be a clearly accepted reduced scope, not described as finished.

## Inputs still unresolved
Travel dates/terminal, exact unit and host entry instructions, real device versions, group editing requirement, Cloudflare account/domain and optional Naver API credentials. The supplied exact location is already configured privately. No other feature proposals are pending acceptance.
