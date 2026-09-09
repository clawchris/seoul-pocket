# Seoul Pocket · v0.2
An iPhone-first, local-first Seoul travel companion for Cloudflare Pages. Updated for the supplied Guui/Gwangjin stay and the owner's revised scope. Product/source review: 7 September 2026.

**Deployed at https://seoul-pocket.pages.dev, local-first, with an optional encrypted shared trip.** Exact stay details are preconfigured as authenticated ciphertext. USD/KRW uses a swap button. Weather, fixed three-city time conversion, a persistent preparation checklist, Kakao place search, an app-shortcut sheet, a Kakao interactive map, and local blog buzz are implemented. Shared trips (D1, client-side encryption, versioned sync with explicit conflicts) are built and proven against a local database; the production binding waits on a D1-capable Cloudflare token. Real iPhone testing and reviewed offline audio remain release work.

## Start
```sh
node --version                 # 22 or later
npm run verify
npm run preview                # http://localhost:4173
```
No package installation is required for the application or Node tests. Use HTTP, not file://. Preview serves dist and returns controlled unavailable responses for APIs; it does not execute Pages Functions. For integration, use a separately installed, pinned Wrangler version and `wrangler pages dev dist`. The Kakao REST API key belongs in server-only configuration. See CODEX_START_HERE.md and docs/04.

## Private setup: read before publishing
This ZIP is a **private handoff**, not a public site bundle. On each phone use **Our stay → Load preconfigured stay** with the passphrase in `private/OWNER_SETUP.md`. The original exact English/Korean address and coordinates are in `private/stay-source.json`; they are not plaintext in public assets. Keep the setup passphrase in your password manager. It initially unlocks the local stay too; change it through Edit stay if desired.

The seed contains no entry PIN, unit, Wi-Fi password, host identity or travel dates. Existing local stays are never automatically replaced. Unlock an existing stay and use **Use supplied address** to copy only address/coordinates into a draft, preserve the other fields, then review and explicitly save.

Publish **dist/** through a Pages workflow that also deploys root-level **functions/**. Do not publish private/, docs/, qa/, tests/, the ZIP, or the repository root. Do not upload the private setup to a public Git repository. `.gitignore` is a precaution, not access control. The encrypted seed remains decryptable by its original setup key even after changing a local vault's password. A public site's UI also identifies the Guui/Gwangjin area; it is not location-anonymous.

## Implemented scope
| Area | v0.2 behavior |
|---|---|
| Five tabs | Today, Saved, Speak, Tools, Trip |
| Saved finds | Food/places, notes, up to eight links, one compressed JPEG/PNG/WebP photo, planned date/time, must-try and visited |
| Stay | Encrypted preconfigured address/map pin; editable local PIN/Wi-Fi; address-only migration; driver card excludes secrets |
| Currency | Only USD/KRW; one swap button; remembered direction; visible rate date/staleness; presets; manual and reference rates |
| Weather | Fixed approximate Gwangjin location; Celsius/Fahrenheit toggle; three days and next 12 hourly periods; dated cached fallback |
| Time zones | Only Seoul, Singapore, Cupertino/PT; Now, date/time, ±30 minutes; exact date rollover; DST gap/repeated-hour handling |
| Preparation | 12 persistent user-confirmed checks; device checks cannot transfer as completed via backup |
| Local recommendations | Six opt-in Guui/east-Seoul ideas, using the existing Saved model; source links; no fabricated hours/walk times |
| Phrases | 28 written phrases and show cards; all 28 bundled as machine-generated Korean clips (Apple Yuna TTS) cached offline; native-speaker review pending; device speech is the fallback |
| Recovery | Encrypted exports, non-overwriting restore, generated app shell/cache checks |
| Sharing | Optional shared trip: owner creates with the proxy token, others join with a 16+8 character invite and a group passphrase; every find is sealed on the phone (AES-GCM, key from PBKDF2 over the passphrase and a server salt, record id bound as AAD); versioned compare-and-swap sync with idempotent receipts; conflicts are shown, never auto-merged; photos and the stay vault never leave the phone |
| Map and nearby | Kakao Maps JavaScript SDK (needs `KAKAO_JS_KEY`, loaded only when the map sheet opens); Kakao blog buzz per find |
| App shortcuts | One sheet of deep links: Naver Map, Kakao Map, Kakao T, Papago, Google Translate, Subway, Kakao Talk, with App Store fallbacks |

The rejected extra feature proposals are removed from the roadmap. No separate reservation, airport-card, neighborhood-grouping, dietary/favorites or indoor-alternative systems are in scope.

## Repository map
public/ is the only static build input. functions/ holds Pages endpoints. scripts/ builds, previews, checks privacy and optionally reseals a supplied stay. tests/ contains Node tests, a UI-only harness and an unpassed real-origin smoke script. migrations/ is the D1 schema for shared trips (apply with `wrangler d1 migrations apply seoul-pocket --remote` once the database exists); local-only use needs no database. docs/ contains the full specifications and evidence. private/ contains owner-only material; qa/ contains private screenshots and logs.

## Verification commands
```sh
npm run verify                    # Node checks (crypto, domain, API proxies, sync server over node:sqlite) + syntax + build + plaintext deployment scan
wrangler pages dev dist -c wrangler.local.toml   # Functions with a local D1; then python tests/sync_stories.py --base http://127.0.0.1:8788 --token-file .dev.vars
npm run check:audio               # passes with a warning: clips exist but are machine-generated until a Korean speaker sets reviewed/reviewer
python tests/render_harness.py    # requires separate Python Playwright + /usr/bin/chromium
python tests/browser_smoke.py --base http://localhost:4173
```
The 22 UI harness checks use explicit in-memory storage, fake crypto and network fixtures. They do not prove actual IndexedDB, service-worker or iPhone reliability. Browser navigation to localhost was administratively blocked; the real-origin attempt did not pass. Logs explain this.

`npm run prepare:stay` is an intentional owner operation, not part of build: it reads private/stay-source.json and replaces the encrypted public seed and private setup key. Do not run it as routine deployment or to migrate existing vaults. The seed-decryption test and full exact-value privacy scan require private/; without it the test skips and the scan only verifies directory boundaries.

Browser storage can be lost. Keep independent backups. Saved finds/photos are plaintext locally; the stay and exported backup are encrypted. No passphrase recovery is provided. Maps/social video/live APIs need connectivity. Weather uses the free non-commercial Open-Meteo endpoint, which has usage limits and no uptime guarantee; review terms before a broader or commercial release. Sources and release gates: docs/SOURCES.md and docs/04.
