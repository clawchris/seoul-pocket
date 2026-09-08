# 03 · Architecture and security contract
Prepared 7 September 2026. **Implemented** and **proposed** are distinguished throughout. This document is a design/implementation handoff, not an independent security audit.

## 1. Architecture decision
The local app uses semantic HTML, CSS and native JavaScript modules, without a runtime package dependency. IndexedDB stores ordinary finds/photos and the encrypted stay envelope. A generated service worker caches static first-party assets. Cloudflare Pages serves the app; Pages Functions handle narrow online integrations. D1 and private R2 are reserved for the group-sharing completion track, not requirements to run the local app [S1–S3].

```
iPhone Home Screen app
  UI → domain validation → IndexedDB transaction → acknowledged local save
  ├─ static files and reviewed audio → versioned first-party CacheStorage
  ├─ Naver/FX request → same-origin Pages Function → fixed provider endpoint
  ├─ map/social link → external application or browser
  └─ future outbox → authorized sync Function → D1 / private R2
```

The app shell contains no real trip data and may be publicly served. Private data must not be included in a build, static JSON fixture, source map or public asset URL. Authentication of a remote trip is separate from unlocking an already cached local stay. Do not require an online authentication redirect just to open downloaded emergency information.

## 2. Source map
`app.js` renders screens and handles events; `ui.js` contains escaped HTML helpers and icons; `domain.js` contains validations, map links, rate rules and the preliminary conflict reducer. `db.js` owns local transaction boundaries; `crypto.js` owns native encryption; `media.js` bounds/re-encodes photos and serializes them for backup; `audio.js` chooses a reviewed clip or device voice; `offline.js` manages registration/readiness/update requests. `scripts/build.mjs` creates the deployable directory and service worker.

This is a compact prototype with substantial behavior. Before large features, split `app.js` by feature without changing storage contracts or adding a framework by default. Preserve escaping and meaningful error states.

## 3. Implemented local storage contract
Database `seoul-pocket`, schema version 1. Stores use keyPath `id`:
- `places`: validated find records.
- `photos`: `{id, blob, width, height}` for local compressed images.
- `meta`: `{id,value}` for `prefs`, `rate`, and encrypted `stay`.

A find contains `id`, `name`, `korean`, `kind`, `neighborhood`, `address`, `note`, `links[]`, `status`, `priority`, `date`, `time`, `lat`, `lng`, `photoId`, `source`, `checkedAt`, `rev`, `updatedAt`. Current statuses are `saved`, `planned`, `visited`, `skipped`. Null coordinate pairs are valid; partial or out-of-region pairs are not. Links allow HTTP/S only and no embedded credentials. A source can identify a provider without suggesting its data was independently verified.

Saving uses a read/write transaction across place and photo stores. Compare the expected local revision before overwriting; commit the new revision and photo together; await transaction completion before success. Deletion checks the revision and removes the associated local photo in the same transaction. Backup snapshot reads all three stores in a single readonly transaction. Cross-tab notifications request a fresh local load.

Schema changes must be additive migrations. Never replace a failed migration with `deleteDatabase()`. On a blocked upgrade, tell the user to close other app copies while preserving data. Add regression coverage with an actual IndexedDB implementation before relying on migration behavior.

## 4. Implemented encryption and limitations
Stay encryption uses native Web Crypto AES-256-GCM, a random 96-bit nonce and a random 128-bit salt. Derivation uses PBKDF2-SHA256 with 600,000 iterations, following a browser-compatible work-factor choice informed by OWASP guidance [S13–S14]. A long unique passphrase is required; the app minimum is 12 characters. This is not a claim that every 12-character string is strong. Profile unlock time on the oldest traveler iPhone rather than arbitrarily reducing the work factor.

The versioned envelope records algorithm, KDF, iterations, purpose, salt, IV and ciphertext. Associated data is `seoul-pocket:v1:stay` or `seoul-pocket:v1:backup`, which separates these two use cases. Parameters and purpose are validated before decryption. Passwords and derived keys are not persisted. The decrypted stay is kept in memory while needed and rendered only inside secret dialogs; JavaScript cannot guarantee forensic memory zeroization.

Closing/backgrounding/idle expiration clears the in-memory stay reference and removes its rendered dialog. Unlock completing after a user leaves the dialog is discarded. The PIN has a second reveal action; the address card and print panel exclude it. The Wi-Fi password disclosure is separate as well, but an unlocked view remains sensitive. Manual screenshots, clipboard history, backups saved to insecure locations, browser extensions and compromised origin code are outside the protection promised here.

**Data classification:** ordinary finds, notes and photos are plaintext in local IndexedDB. Do not put door codes in ordinary notes. The stay envelope is encrypted at rest. Exported backups encrypt the whole export, including photos and the already encrypted stay. Losing the vault passphrase cannot be repaired by the export password alone. There is no account recovery service. Keep passwords in a password manager and test access from the installed app.

## 5. Backup/restore behavior
Maximum incoming backup: 20 MB. Before encrypting, the serialized UTF-8 payload must fit the export budget. Imported arrays, schema, IDs, photos, rates and stay envelope shape are validated. Photos accept bounded JPEG/PNG/WebP blobs. Restoring assigns new IDs to finds/photos and rewrites photo references. Existing finds remain untouched; an existing stay wins over the imported stay. Current settings and rate are preserved, not merged.

This non-overwriting strategy is intentionally conservative. Add an import preview and duplicate-selection controls in a later improvement. Do not change restore into a blanket replacement of the user's active trip. A future stronger backup format should include manifest checksums, migration support and a portable recovery helper; the current backup depends on this application version and its passphrase.

## 6. Offline and update behavior
The build hashes the real public file paths and bytes, then generates a cache name and explicit asset list. Install uses `cache.addAll`; a failed install removes its incomplete new cache. API, non-GET and cross-origin requests bypass caching. Controlled navigations use the cached shell. An update waits for a user action rather than immediately calling `skipWaiting`. The previous application cache is retained alongside the current one; unrelated caches are untouched.

Only first-party app assets and future reviewed audio go in this service-worker cache. User photos/records are in IndexedDB, not public CacheStorage. The readiness check counts expected assets and separately reports local photos, saved rate, vault and audio configuration. It does not prove persistence after operating-system eviction, forced termination or a real iPhone restart. Storage persistence is a request, not a guarantee [S10–S11].

Critical tests: first installation; a second controlled load; entirely offline restart; missing cache entry; interrupted new deployment; accepting an update; open form in another tab; pending local write; database upgrade across app versions; stale installed copy returning after several days. Keep backward compatibility or freeze deployments during the trip. A rollback must be tested as an application/data combination, not only a Pages deployment rollback.

## 7. Implemented online endpoints
| Endpoint | Current contract |
|---|---|
| `GET /api/health` | Static service status; no private details |
| `GET /api/rates` | Fixed USD/KRW reference endpoint, validated response, useful 502 failure |
| `GET /api/naver?q=` | Requires private proxy bearer; 1–100-character search; up to five normalized results |
| `POST /api/sync` | Requires private proxy bearer, then intentionally 501; no writes |

The preview server does not execute these Functions. Mocked-fetch tests check their code, not live upstream compatibility.

Naver secrets use `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`. The temporary `API_ACCESS_TOKEN` is a high-entropy owner-managed development proxy token, entered into memory only and cleared on background. It is **not** production per-member authorization or a group-encryption key. Same-origin checks and comparison of token digests are supplied. No generic URL fetcher exists; upstream hosts are fixed. Search results are stripped of markup and rendered escaped [S5–S9].

Rates use the fixed Frankfurter v2 endpoint with base USD and quote KRW, bounded timeout, validation and a dated local fallback [S15]. A rate reference has no payment-settlement guarantee. Provider failures do not erase an existing rate. Add abuse limiting to public rate refresh and authorized Naver search before opening production endpoints broadly.

## 8. Proposed group sharing: complete before enabling
### Membership and access
Use owner/editor/viewer roles. The server derives allowed trip IDs from authenticated membership, never trusts a body field alone. Supply one-use expiring invites; keep invite secrets out of query strings and logs. A URL fragment may carry the initial secret, but the client must clear it immediately and exchange it over HTTPS. Store only hashes of high-entropy invitation/session secrets. Require owner confirmation for membership management.

Preferred browser session: Secure, HttpOnly, SameSite=Strict, host-only cookie with explicit expiration and revocation. CSRF/origin checks remain required for state changes. Session records, expiry fields and rotation are **not in the current schema** and need a migration. Cached read/unlock works offline; after session expiry, writes remain pending locally until reauthentication. Do not silently delete local content on remote logout. Separate "sign out from shared service" from "erase this device", each clearly explained.

### Encryption for shared storage
Current local envelopes are not a complete end-to-end sharing design. Generate a random trip content key, wrap it with a strong shared recovery passphrase and distribute authorized access outside public links. Keep the stay vault under a separate secret or key to preserve stricter access. For each remote encrypted record use a fresh random nonce and authenticated context containing protocol, trip ID, record ID, kind and key version. Bind identity to ciphertext; the existing local purpose-only envelope is not sufficient for this new context.

An owner rotation creates a new key version and re-encrypts relevant remote content. Revocation blocks new downloads but cannot revoke plaintext or keys already saved on an offline former member's device. Do not claim remote wipe or perfect forward revocation. The server still sees metadata such as record IDs, membership, versions, timing and encrypted sizes. Use a boring encrypted payload protocol and have it reviewed; do not invent a cryptographic primitive.

### Local migration and outbox
Add stores for `outbox`, `conflicts`, `syncMeta` and remote `assetState`; extend each record with `tripId`, `serverVersion`, `localRevision` and pending-mutation association. These are not present in the current local record schema. Keep a separate local-only mode.

In one transaction: update the local record, increment its local revision and enqueue a mutation with UUID and the last acknowledged `baseVersion`. Never enqueue only after a UI success. Preserve acknowledged history long enough to reconcile an in-flight response with newer local edits. Serialize writes per record. When a pending record is edited again during a request, do not reuse a mutation ID with new content; keep the newer edit and create its successor after acknowledging the first. Unsent edits may be coalesced only with rigorously tested rules.

### Wire protocol proposal
`POST /api/sync` takes `{protocol:1, tripId, since, mutations:[...]}`. A mutation contains `{mutationId, recordId, kind, baseVersion, operation, keyVersion, envelope}`. Limit to 25 mutations and 256 KB request bodies as initial design budgets; photos use a separate path. The server returns acknowledged mutation IDs and assigned versions, per-record conflicts/errors, a paginated change stream, `nextCursor` and `hasMore`. HTTP 401 means reauthenticate, 403 means not authorized, 413 means too large, 429 means retry later, and 5xx means keep pending and retry. Never retry invalid mutations forever without exposing the error.

A new record expects version 0. An update/delete expects the current server version. Advance only when compare-and-swap succeeds. A delete is a versioned tombstone, not an immediate disappearance from history. Server timestamps are diagnostic, not ordering authority. For each member/trip/mutation ID, store a request hash and the exact result; an identical retry gets the same result, a different payload with the same ID is rejected.

The record write, change entry and mutation receipt must commit atomically. Use a carefully tested D1 transactional batch with SQL conditions and uniqueness constraints; a SELECT followed by unguarded UPDATE is not enough. D1 documents transaction rollback behavior for batches [S24]. A version mismatch that updates zero rows is not automatically a SQL error, so explicitly ensure it cannot still create a false receipt/change. Prove this with concurrent integration tests. Keep primary-consistent mutation reads initially; do not add read replicas before validating the synchronization guarantees.

On the client, atomically commit acknowledgements, accepted changes and cursor advancement. Do not advance past a failed unapplied page. Keep a fixed pull high-water mark while paginating, so continuing remote edits do not make one pull endless. Never clear dirty state for a newer local edit when an older mutation is acknowledged. A conflicting remote copy goes into a separate conflict record; the user's pending copy remains available. Resolve with a new versioned mutation.

### Photos and R2
Use a private bucket and membership-checked upload/download routes. Upload bounded compressed bytes, bind an asset to a trip/member, and reference it only after server confirmation. A remote asset URL alone is not offline readiness; download the bytes into local IndexedDB and verify integrity before reporting ready. Delete unreferenced remote assets only after a safe retention window; a place deletion must not break another record that shares an asset. No public accommodation photos, public bucket listing or long-lived query-string credentials. R2 is not wired today [S3].

### Retry and retention
Foreground sync on opening, returning to the app and an explicit Sync now action; bounded backoff with jitter on retriable failures. Do not rely on background execution to complete anything critical. Pause on offline, retain every pending mutation and show useful status. Preserve tombstones/receipts at least for the entire active trip plus recovery period; use a documented full-resync policy before pruning history. A suggested owner-confirmed deletion date is 30 days after departure, not a silent default already implemented.

## 9. Deployment/security controls
Static `_headers` supplies a restrictive CSP and no-referrer behavior. Functions add their own response headers because they are a separate serving path. `_routes.json` sends only `/api/*` to Functions. Do not publish `tests/`, fixtures, docs, backups or `.dev.vars`. No analytics or third-party scripts are included. Error telemetry, when added, must redact addresses, names, links with personal tokens, passphrases, ciphertext request bodies and authentication headers.

Production checklist: HTTPS; correct final origin in map handoff; prod/preview secrets separated; no credentials in browser bundles; blocked cross-origin calls; object-level authorization tested; malformed input bounded; no public R2 objects; rate limiting; permission revocation; encrypted backup restore; dependency/tool versions recorded; actual deployed headers checked; no false readiness states.
