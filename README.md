# Seoul Pocket
An iPhone-first Seoul trip companion, built for Cloudflare Pages. Prepared 7 September 2026.

**Working local app, not a completed deployed group service.** The source includes real local persistence, an encrypted accommodation vault, a generated offline app shell, editable food/place wishlists, photos, phrases and currency tools. Group synchronization and reviewed offline phrase recordings are deliberately not represented as complete.

## Start here
Read `CODEX_START_HERE.md`, then `docs/01-PRODUCT-SPEC.md`. The complete technical contract is in `docs/03-ARCHITECTURE-AND-SECURITY.md`. See `docs/06-TEST-REPORT.md` for exactly what was tested.

## Run locally
Use Node.js 22 or later. There are no package dependencies to install for the local app.
```sh
npm run verify
npm run preview
```
Open `http://localhost:4173`. Use the HTTP server, not `file://`. The preview server serves `dist/` and simulates unavailable API responses; it does not execute Cloudflare Functions. `npm run dev` serves source files but does not generate a service worker. Rebuild and use preview for offline work.

Run Cloudflare integration locally with an installed, version-pinned Wrangler tool, after copying `.dev.vars.example` to `.dev.vars` and supplying real credentials:
```sh
npm run build
npx wrangler pages dev dist
```
The exact Wrangler version is a Codex setup decision to verify against current Cloudflare documentation, not a dependency silently fetched by this starter. Do not commit `.dev.vars`.

## What is implemented
| Area | Current state |
|---|---|
| Today, Saved, Speak, Tools, Trip | Implemented responsive UI |
| Food/place CRUD, links, planned date/time, must-try and visited states | Implemented locally |
| JPEG/PNG/WebP photos | Local resize/re-encode, IndexedDB storage |
| Stay address, room, PIN, Wi-Fi and notes | AES-GCM encrypted local vault; separate passphrase |
| Encrypted backup and non-overwriting restore | Implemented; real-iPhone download/restore validation remains |
| Written Korean phrases | 28 included; phonetics approximate; native review pending |
| Audio button | Device Korean speech fallback; no reviewed recordings shipped |
| USD/KRW converter | Manual/saved rate; optional server-side reference-rate refresh |
| Naver | App/browser handoff; basic search proxy supplied, credentials untested |
| Offline | Generated service worker, app-cache check and persistence request; physical-device gate pending |
| Group sharing | SQL schema and conflict rules only; `/api/sync` returns 501 after authentication |
| Deployment | Configuration supplied; not deployed |

## Files
- `public/`: the production application. This is the only input copied into the static build.
- `functions/`: Cloudflare Pages Functions; backend secrets stay here.
- `migrations/`: future group-storage foundation, not active in local mode.
- `scripts/`: dependency-free build, preview, syntax and audio checks.
- `tests/`: automated tests and separate browser test harnesses. Never publish as application code.
- `docs/`: product, UX, architecture, Codex tasks, travel guidance, test report and sources.
- `qa/`: actual test output and UI screenshots. Screenshot content is illustrative, not a populated real trip.

## Checks
```sh
npm run verify            # syntax, 41 unit/contract tests, production build
npm run check:audio       # deliberately FAILS until real reviewed recordings are supplied
python tests/render_harness.py
# Requires Python Playwright and a Chromium executable at /usr/bin/chromium.
# UI-only test adapters, NOT a real-origin persistence/security/offline test.

python tests/browser_smoke.py --base http://localhost:4173
# Requires independently installed Playwright browsers and a running preview server.
# Supplied for Codex; not executed successfully in the authoring environment.
```

## Non-negotiable limitations
A browser cache is not a backup. Losing browser data or the phone can lose local data. There is no passphrase-reset service. Local finds/photos are not encrypted at rest; the stay vault and exported backups are. External maps, social videos, online search and new exchange rates require their own connectivity. The app does not provide live transit routing, reservations, emergency dispatch or universal translation.

Readiness for an actual trip requires: tested installed-iPhone offline restart; successful backup restoration on another device; tested audio or an explicitly accepted text-only fallback; and real two-device synchronization tests when group sharing is required.
