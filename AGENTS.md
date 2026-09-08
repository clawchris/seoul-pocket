# Engineering instructions for Codex
Read `CODEX_START_HERE.md` and all numbered `docs/` before changing architecture.

## Product invariants
1. Saved trip information must open without a network response. Network failure must never prevent an acknowledged local save.
2. Preserve the five-tab information architecture. One find record powers Saved, Today and the must-try checklist. Do not create three divergent lists.
3. Never label a write "synced" until the server acknowledges it and the acknowledgement is durably committed locally.
4. Never replace an existing user record because a remote timestamp is newer. Use server versions, idempotency and an explicit conflict path.
5. The entry PIN is a secret, not a login password. Never include it in map links, search, analytics, public builds, screenshots or driver cards.
6. No real secrets, Naver credentials, sessions or trip information in the repository or `public/`.
7. Do not scrape Naver, Instagram or TikTok or embed third-party scripts to obtain content. Keep manual input and external links usable.
8. Do not claim offline audio is ready because `speechSynthesis` exists. Require actual reviewed assets and physical-iPhone playback tests.
9. Do not silently clear or reset IndexedDB to repair an error. Preserve the old copy, explain the problem and provide recovery.
10. Do not auto-activate a service-worker update during an edit, vault interaction or pending write. Never wipe the previous cache before the new one is complete.
11. No implementation can guarantee browser storage will never be evicted. Keep independent encrypted backups and a minimal emergency fallback.
12. Do not deploy or share `tests/render_harness.py` as app code. Its crypto adapter is intentionally fake and only exercises UI states.

## Development
The runtime intentionally has zero dependencies. Use native ES modules unless a specific tested need justifies a dependency. Do not migrate to Next.js or another framework just to connect three endpoints. Use semantic HTML, escaped dynamic text, 48px targets, safe-area insets and input fonts at least 16px. Avoid em dashes in user-facing copy.

Run `npm run verify` after changes. Update the honest status table and test report. `npm run check:audio` is a release gate, not a test to weaken until it passes. Add failing regression tests before fixing storage/sync/security defects. Test deployed headers, Functions routing and physical iPhones separately; passing Node tests does not establish those properties.

The research date is 2026-09-07. Recheck Naver product onboarding, transit-card support and Climate Card rules against `docs/SOURCES.md` for the actual travel dates. Do not substitute stale assumptions about Apple Pay or invent venue opening hours.
