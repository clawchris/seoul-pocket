# Codex engineering instructions · v0.2
Read CODEX_START_HERE.md and docs/01 through docs/07 before changing architecture.

## Product invariants
1. Preserve the five tabs and one Saved model powering food/place wishlists, Today and must-try/visited states. Keep local acknowledged saves independent of online services.
2. Exactly two currencies, USD and KRW, operated by a single swap button. Exactly three time zones: Asia/Seoul, Asia/Singapore, America/Los_Angeles. Do not add arbitrary selectors or hardcode Pacific as PST year-round.
3. Retain only the accepted extras: predeparture checklist, weather and fixed time comparison. Do not reintroduce reservation cards, separate airport/return cards, neighborhood grouping, allergy/favorite-phrase extensions or indoor alternatives. Local ideas are ordinary Saved records, not a new planning subsystem.
4. Never mark a write shared/synced without a durable server acknowledgement. Versions, idempotency, atomic outbox and explicit conflicts are required before sharing is enabled. /api/sync is still a 501 boundary.
5. Never publish the private folder, owner setup passphrase, plaintext accommodation address/coordinates, entry PIN, unit, private screenshots, backups or credentials. public/src/stay-seed.js is an intentional ciphertext-only exception. Read private/OWNER_SETUP.md locally, not into public issue logs.
6. Enter PIN/Wi-Fi inside the app, not in the seed. An existing stay is never overwritten by a deployment or seed load. Address merge touches only address/coordinates and requires explicit encrypted save.
7. Weather uses fixed APPROXIMATE district coordinates, not the exact stay/GPS. Keep model time, fetch time and stale/offline labels. Never turn a failed request or unknown rain chance into invented data. Preserve attribution and recheck non-commercial terms/rate limits.
8. The predeparture checklist is self-reported, not certification. Never auto-complete it from cache presence. Do not restore device-specific confirmations as done on another phone.
9. Do not scrape Naver/social networks or insert third-party tracking scripts. Keep manual entry, Korean address copy and external links as fallbacks.
10. Do not claim device speech is reliable offline audio. Keep the audio release gate until reviewed files and real device playback pass or the owner consciously accepts text-only scope.
11. Never delete IndexedDB as an error-recovery shortcut. Preserve records on migration, failed sync or restore. Do not auto-activate worker updates during edits/secret interactions.
12. The UI harness has deliberately fake adapters; never deploy it or use its results as storage, security, network or offline evidence.

## Implementation discipline
Native ES modules, semantic HTML, escaped text, 48px targets, 16px minimum input text, safe-area spacing and visible finite choices. Avoid em dashes. Do not introduce a framework or add services without a concrete tested need.

Run npm run verify after changes and update docs/06 with actual evidence. Keep tests for DST gaps/repeats, address-only merge, safe map links, weather staleness and restore rules. Rerun the real-origin smoke script in an unrestricted development environment and test installed iPhones separately. No passing desktop suite establishes iOS cold-restart behavior.

Review docs/SOURCES.md again before departure, especially transit payments, pass coverage, API access and venue details. Exact travel dates are still unknown. Do not invent forecasts for those dates, walk times, opening hours, a unit number or a confirmed property identity.
