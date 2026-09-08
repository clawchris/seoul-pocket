# 04 · Codex implementation and deployment plan
Prepared 7 September 2026. Each ticket needs a demonstrated result, not just a changed checkbox.

## Stage A: validate and stabilize the existing local app
**A1 · Reproduce.** Run `npm run verify`. It should pass 41 Node checks and build `dist/`. Inspect all five tabs on localhost. Use `tests/browser_smoke.py` with a real browser allowed to navigate to the test origin. This smoke script is supplied, not proven by the authoring environment. Fix the test or app when a reproducible failure appears; do not erase data to get a clean result.

**A2 · Real IndexedDB and failure tests.** Add tests for create/edit/delete, same-tab and cross-tab revision conflicts, atomic photo save, interrupted writes, quota exceptions, a migration from schema 1, a coherent backup snapshot and non-overwriting restore. Exercise a real origin, not the in-memory screenshot adapter. Add a local-storage usage indicator and export-size warning before asking users to delete photos.

**A3 · iPhone UX and accessibility.** Test installed Home Screen mode on both traveler phones, Safari normal mode, keyboards, VoiceOver, landscape and enlarged text. Validate copy-address fallback, native Naver handoff and returning from Naver. Test stay-passphrase autofill with the actual password manager: background-lock behavior must not accidentally make the vault impossible to unlock. Do not silently weaken background locking to fix a convenience issue.

**A4 · Recovery drill.** Export to Files, verify the file exists, restore into a separate clean test profile/phone and unlock with the original vault password. Confirm existing finds and an existing vault survive an import. Document that preferences/rate need re-entry on a clean device. Test the UTF-8 size boundary with Korean notes and photos. Printed fallback must not contain a PIN or Wi-Fi password.

## Stage B: finish pronunciation
**B1 · Audio asset pack.** Record or obtain permitted Korean audio for all 28 IDs in `PHRASES`. Prefer a native speaker; generated speech is acceptable only after human listening review and rights confirmation. Use short, consistently normalized files with no leading silence. Include source/license/permission metadata and the reviewer's name/date in `public/audio/manifest.json`. A practical initial format is MP3; verify actual iPhone playback rather than relying on the extension.

**B2 · Release check.** Fill `clips` with same-origin `/audio/<id>.mp3` paths, set reviewed only after the review, run `npm run check:audio`, rebuild and reinstall/update. Test every clip in airplane mode on each iPhone, including audio after an app restart and after another audio app was used. The current device-speech fallback remains useful but does not satisfy offline-audio acceptance.

## Stage C: wire Cloudflare and integrations
**C1 · Staging project.** Pick Git-connected Pages for repeatable review builds, or Wrangler direct upload. Cloudflare documents both workflows; their project workflow constraints differ [S2, S4]. For this repository: build command `npm run build`, build output `dist`, Node 22+. Keep `functions/` at the repository root. Do not drag-and-drop only `dist/` and assume the server Functions were deployed; use the supported Git/Wrangler path. Pin a verified Wrangler version in development tooling and commit its lockfile if added.

**C2 · Secrets.** Generate an independent high-entropy development proxy token. Set `API_ACCESS_TOKEN`, `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` in staging secrets, never `public/`. `.dev.vars.example` is a template. Do not reuse real group membership secrets here. After adding sessions, remove the owner-token UI from normal traveler onboarding.

**C3 · Provider verification.** Call deployed health/rates and validate the actual USD/KRW provider payload, date handling and failure fallback. For Naver, the proxy targets NAVER API Hub (`naverapihub.apigw.ntruss.com`, `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY` headers) as of 8 September 2026. The legacy Developers Center stopped issuing new credentials on 31 July 2026, so only Naver Cloud Platform keys are valid here; do not point the proxy back at `openapi.naver.com` [S5, S9]. Test a Korean query and coordinate output; check attribution/retention requirements. An unavailable account must not block a release with manual entry and map handoff.

**C4 · Deployment hardening.** Confirm `_headers` and middleware headers on actual responses; verify `/api/*` routing; negative-test unauthorized requests and malformed input; add rate limits and request-size limits. Ensure errors expose no upstream secrets. Verify no test files, backups or real itinerary fixtures are in `dist/`. Test the update path against an already installed staging app. No production deployment has happened in this handoff.

## Stage D: implement genuine group sharing, when required
**D1 · Membership.** Add session/invite expiration schema; implement owner, editor and viewer access; object-level authorization; join/revoke and secure cookies. Scope every storage query to the authorized trip. Test one member of Trip A against all Trip B endpoints, including photos.

**D2 · Shared encryption.** Implement the reviewed trip-key/envelope context in document 03. Distinguish server membership from decrypting cached content. Keep the stay under stricter protection. Test tampering, wrong key, cross-trip substitution and key versions. Explain that revocation cannot erase already downloaded data.

**D3 · Outbox + server CAS.** Add the local migration and atomic record/outbox writes. Implement mutation receipts, payload hashes, compare-and-swap, tombstones and a durable paginated cursor. Implement explicit conflict UI. Do not simply connect `resolveSync()` to last-write-wins storage and call it complete.

**D4 · Private photo sync.** Provision private R2, enforce type/size limits, track upload completion, cache the actual downloaded blob on each phone and handle orphan cleanup safely. Include shared photos in offline readiness and recovery testing.

**D5 · Adversarial sync tests.** Two devices edit one record offline; delete vs edit; retry after server commit but before client acknowledgement; duplicate mutation ID with different payload; session expires with pending edits; device creates a newer local edit while the old request is in flight; crash while applying a change page; pagination with concurrent writes; key rotation; viewer tries to write. Preserve both versions or fail clearly, never falsely report shared success.

## Stage E: traveler additions and content validation
Add structured reservation cards, an arrival/airport card, neighborhood grouping and a predeparture checklist. These add more value than a chatbot or embedded social feed. Populate actual places only after the owner supplies dates, area and interests. Review Korean text and any custom dietary/accessibility card. Recheck transit payment support, Climate Card coverage and operating details against dated official sources. The seed list is deliberately not a ranked itinerary.

## Stage F: physical-device release gate
Use the actual final production origin. Safari and the installed app may not share all storage behavior; perform onboarding and tests inside the installed app itself [S10–S11].

| Scenario | Evidence required |
|---|---|
| Airplane-mode cold reopen | Home, find text, saved photo, vault, rate and phrase open |
| Force-quit/restart | Acknowledged local edits remain available |
| Background during unlock/edit | No surprise secret exposure or misleading saved state |
| Low storage/quota denial | Clear failure; previous data remains intact |
| Bad network/captive portal | Core UI works; online tool times out usefully |
| Phone A/B concurrency | Explicit conflict or correct acknowledged ordering |
| Independent backup restore | Recovered finds/photo/vault on the other phone |
| Naver handoff and fallback | Installed app opens; browser/copy path remains usable |
| Audio | Every reviewed clip plays without internet |
| Update/rollback | No lost edit, mixed app files or broken schema |
| Emergency fallback | Numbers and address available outside the browser, no PIN leak |

Record device, OS, installed/Safari mode, build hash, test date and outcome. No "95% confident" label substitutes for these observations. Keep unresolved failures visible.

## Operational runbook
About one week before departure: provision both phones, enter the Korean address privately, choose a few neighborhood-based ideas, validate transit payment and complete the recovery drill. The day before: refresh rate/reference content, confirm airport route and last-leg fallback, run airplane-mode tests and export again. During travel: sync when online, export after meaningful changes, and avoid unnecessary app upgrades. After travel: export the keepsake data and explicitly decide what remote/private data to delete.

Owner decisions still needed: dates; group size/editing roles; iPhone versions; accommodation neighborhood; dietary/accessibility requirements; Cloudflare account/domain; Naver account availability. The owner should input secrets into the app, not into a public repository or prompt.
