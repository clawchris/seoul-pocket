# 06 · Test report and known limitations
Report date: 7 September 2026. Build timestamps in `qa/verify.log` use the execution environment's UTC clock, which is on 8 September. No performance/confidence percentage has been invented.

## Executed checks
| Check | Result | What it establishes |
|---|---|---|
| `npm run check` | Passed | Production JavaScript parses; required JSON parses |
| `npm test` | 41 passed, 0 failed | Domain, Web Crypto, mocked API and generated-worker logic |
| `npm run build` | Passed | Actual public files copied and content-hashed worker generated |
| `tests/render_harness.py` | 12 passed | Selected actual DOM flows with explicit in-memory adapters |
| Responsive harness widths | 320, 375, 390, 430, 768, 1280px | No horizontal overflow in the exercised Today view |
| UI screenshots | Generated and visually inspected | Layout evidence for selected populated/empty states |

The 41 tests comprise 18 domain/content checks, 7 native Web Crypto checks, 10 mocked API/auth checks and 6 service-worker VM checks. See the named TAP output in `qa/verify.log`. The worker tests run the actual generated worker JavaScript against simulated lifecycle/cache APIs; they are not evidence that Safari has installed or retained that worker.

The UI harness checks: Today overflow; adding starter ideas; creating a saved social find; search; phrase search/show-card; manual currency conversion; separate vault/PIN reveal; driver-card secret exclusion; dialog cleanup; unverified-audio messaging; additional viewport widths; no uncaught page errors across those flows. It uses a fake in-memory encryption adapter only to drive UI states. Actual encryption is separately tested using Web Crypto in Node. The harness must never be deployed as application code.

## Execution-environment constraint
The available Chromium browser refused normal localhost navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Browser policies were not altered. To inspect the real UI, its HTML/CSS/application logic was rendered through a page-content harness with explicit adapters. The result is not a real-origin PWA test.

`tests/browser_smoke.py` is provided for an unrestricted development environment. It targets the real production modules, IndexedDB and service worker. It has not been successfully executed here and must not be described as passed.

## Not yet tested or completed
Real iPhone Safari/Home Screen behavior; actual IndexedDB persistence across termination/restart; low-storage eviction; actual quota-failure handling; service-worker install/update/rollback in a real browser; VoiceOver and text scaling; native Naver URL handoff; live Naver account credentials/results; live Frankfurter network response in the deployed app; Cloudflare deployed headers and bindings; real R2/D1 integrations; multiuser authentication/sync; physical-device backup download/restore; real Korean voice availability; human review or airplane-mode playback of 28 recordings.

`npm run check:audio` is expected to fail because there is no reviewed recording pack. The visible application reports that offline pronunciation is not verified. This is an explicit incomplete deliverable, not a passing feature hidden behind a stub.

## Implemented safeguards, not guarantees
Local commits precede success messages. A revision conflict rejects an overwrite. Backups use a coherent snapshot and restore as new copies. Encrypted envelopes authenticate their contents. Naver requests go only to a fixed upstream host. External links reject executable schemes. Cached shell requests exclude APIs and third parties. API credentials are not bundled. Failed worker installation removes the incomplete cache, and updates are not forced immediately.

Those safeguards reduce specific risks; they do not prove the app cannot lose data. Browser storage can be cleared/evicted, keys can be forgotten, a phone can be lost and application code can contain undiscovered defects. Independent recovery copies and physical-device release gates remain necessary.

## Known current constraints
One device owns its own edits; copying a backup is not ongoing sharing. Photos are one cover image per find; HEIC input has a clear unsupported path (export JPEG/use screenshot). Backups are capped at 20 MB. Restore preserves current settings/rate and imports a stay only when there is no existing vault. There is no portable standalone backup decryptor. Ordinary finds/photos are not encrypted locally. Offline text phrases are present; offline recordings are absent. Naver metadata import may require account-product adaptation. Structured reservations, weather, predeparture task lists and full day planning are proposed, not complete.

The existing long-form `app.js` should be modularized before major features, with regression coverage. No continuous integration service or remote repository has been created. No production URL exists.

## Release decision
**Foundation ready for Codex continuation. Not certified trip-ready.** Release for the actual trip only after the installed-iPhone restart/recovery tests pass, audio expectations are satisfied, providers are validated where enabled and genuine two-device synchronization passes whenever a shared trip is required. Maintain explicit scope decisions for a local-only or text-only fallback.
