# Codex handoff: finish Seoul Pocket

## Copy-ready task
> Finish this repository as an iPhone-first Seoul travel app on Cloudflare Pages. First read AGENTS.md and docs/01 through docs/06. Preserve the working local app and its five-tab UX. Run npm run verify, inspect the existing screenshots and reproduce the real-origin smoke test. Then complete the ordered release tasks in docs/04-CODEX-IMPLEMENTATION-PLAN.md. Prioritize reliable local storage, real-iPhone offline restart, non-destructive backup restore, reviewed offline pronunciation, and group sharing if required by the traveler. Treat the current /api/sync 501 response as an intentional boundary, not working sync. Use per-member authorization, durable outbox writes, server versions and idempotent mutations before enabling shared status. Configure and test Naver and reference rates using server-side secrets. Do not scrape third-party services or invent live travel details. Deploy a staging Cloudflare Pages project first, report the actual URL and test results, and do not describe the app as trip-ready until the documented device gates pass.

## What you are receiving
A working local implementation, not a blank wireframe. 41 Node unit/contract tests and 12 in-memory browser UI checks passed in the authoring environment. The real-browser origin was administratively blocked, so actual IndexedDB, service-worker restart and iPhone behavior remain unverified end to end. The browser UI harness does not validate those subsystems.

## First commands
```sh
node --version                  # 22+
npm run verify
npm run preview
# Open http://localhost:4173; Ctrl-C when done.
```
No dependency installation is needed for those commands. `dist/` is included for convenience, but always rebuild from source. Use a separate environment and pinned Wrangler version for Functions work.

## Inputs that require the owner
Travel dates and arrival airport/terminal; number of travelers and editor/viewer needs; current iPhone/iOS versions; home neighborhood; dietary/accessibility needs; the Cloudflare account and final domain; Naver developer or Cloud account eligibility and keys. Ask the owner to enter the actual door PIN inside the finished app, not into source code, chat logs or sample fixtures.

## Release ordering
A. Reproduce real-origin storage and encryption flows; repair any actual device blockers.
B. Supply and review all 28 audio files, or obtain a conscious text-only scope decision.
C. Wire Cloudflare staging, reference rates and optional Naver search; retain manual fallbacks.
D. Implement group membership and conflict-safe sync when multiple people need a genuinely shared trip. Do not confuse copying an encrypted backup with collaboration.
E. Test two iPhones under airplane mode, stale sessions, interrupted writes, simultaneous edits, app termination, backup restoration and updates.
F. Freeze the trip build, deploy production, onboard each installed Home Screen app and export independent recovery copies.

There is no hidden Cloudflare project, GitHub repository, production database or deployed URL. Credentials and paid services have not been provisioned.
