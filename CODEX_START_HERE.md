# Codex handoff: finish Seoul Pocket v0.2

## Copy-ready task
> Finish the supplied v0.2 repository as an iPhone-first Seoul travel app on Cloudflare Pages. Read AGENTS.md and docs/01–07, then private/OWNER_SETUP.md locally. The exact supplied stay is already sealed into public/src/stay-seed.js; do not publish the private setup or regenerate the key during routine build. Preserve the five tabs, single Saved model, one-button USD/KRW swap, fixed Seoul/Singapore/Cupertino converter, Gwangjin weather and 12-item predeparture checklist. The earlier extra-feature proposals were declined; do not implement them. Run npm run verify, inspect the updated screenshots and reproduce tests/browser_smoke.py on a real origin. Complete the release gates in docs/04, not a cosmetic rewrite. Deploy Pages staging with the actual Functions, validate live weather/rates/Kakao place-search credentials and abuse controls, test offline cold restart and backup restoration on the actual iPhones, and finish reviewed Korean audio. When genuinely shared editing is required, complete the authenticated versioned sync design before displaying shared status. Report actual deployed URLs and passed/failed checks. Never call this trip-ready solely because the build or UI harness passes.

## First commands
```sh
node --version                  # 22+
npm run verify
npm run preview                 # http://localhost:4173; does not run Functions
```
No npm installation is required. Use separate, pinned deployment/browser test tools. Rebuild dist from source. Functions stay at repository root for a supported Pages workflow.

## Load the provided stay
On a fresh phone, open **Our stay → Load preconfigured stay** and use the setup passphrase in `private/OWNER_SETUP.md`. It is also the initial local vault passphrase. Keep it separately in a password manager. It is not a door PIN. The exact English/Korean address and coordinates have been preserved without inventing a unit or booking identity. Existing vaults use **Use supplied address** after unlocking; this creates a reviewed address-only edit, not a destructive replacement.

The private ZIP includes the setup key and plaintext source, so the ZIP itself must not be published. Serve only dist, deploy Functions separately through the Pages workflow, and keep private/docs/qa/tests out of static hosting and public Git. Ordinary saved finds/photos remain unencrypted locally.

## Executed evidence
77 Node unit/contract checks and 22 UI-harness checks passed, with zero unhandled page errors. Syntax/build/plaintext deployment scan passed. The seed decrypts to the exact owner source in the real Web Crypto test. The UI harness uses fake storage, crypto and provider data; it proves only selected DOM flows and viewport behavior. A real-origin browser attempt failed at navigation with ERR_BLOCKED_BY_ADMINISTRATOR. No installed-iPhone or live Cloudflare behavior has been established. The missing reviewed-audio gate still fails intentionally.

## Owner inputs still needed
Travel dates, arrival airport/terminal, number of travelers and whether shared editing is essential, actual iPhone/iOS versions, Cloudflare account/project/domain, and the Kakao REST API key for place search. The stay location and the three timezone choices are already known. Ask for entry PIN/room/Wi-Fi only inside the app, never in source or chat logs.

## Release order
A. Reproduce genuine IndexedDB/Web Crypto/service-worker behavior; test non-destructive upgrade from v0.1, encrypted seed setup and the existing-stay address-only path.
B. Wire staging Pages Functions, weather, dated reference rates and Kakao place search; test failures/quotas/headers and retain local fallbacks.
C. Audio: 28 machine-generated clips (Apple Yuna) ship and are cached offline. Have a Korean speaker listen to every clip, replace any that are wrong, then set reviewed and reviewer in public/audio/manifest.json. Test playback offline on the oldest phone.
D. Finish membership, permissions, private media and conflict-safe sync only when shared editing is needed. Copying backups is not collaboration.
E. Run the physical-phone acceptance matrix in docs/04 including timezone transitions, cached stale weather, force-close/airplane-mode reopen and independent backup restore.
F. Freeze the tested production build, onboard each Home Screen app, export recovery copies and record the real release evidence.

No Cloudflare project, production database, live deployment or external account was created in this handoff. The weather code is wired to a real provider contract, but deployed live behavior is unverified.
