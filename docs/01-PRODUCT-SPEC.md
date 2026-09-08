# 01 · Product specification
**Product:** Seoul Pocket • **Version:** 0.1 foundation • **Prepared:** 7 September 2026

## 1. The product we are building
A private trip companion that answers, quickly: Where are we going? What did we want to eat? How do I get home? How do I say this? What does that price mean?

The app should remember the group's decisions, not attempt to replace Naver Maps, a booking platform or every travel service. Its highest-value behavior is retaining the important information when connectivity, attention or phone battery is limited. The recommended form is an installable progressive web app, hosted on the user's requested Cloudflare Pages, with local-first storage and a small optional Functions backend. Pages supports Functions and storage bindings [S1–S3]. This stack choice is a design recommendation, not a claim that a web app is inherently as durable as a native app.

### Assumptions, not discovered facts
A short Seoul stay; approximately two to six travelers; predominantly recent iPhones; all trusted companions can edit normal plans by default; no public social feed; no restaurant booking engine. The user's dates, accommodation, nationalities, ages, dietary requirements and phone models are unknown. The first code delivery is single-device; shared functionality is a required completion track when the user confirms collaborative use.

### Success criteria
A traveler can find the Korean accommodation address in two deliberate actions after unlocking, capture a find in under 30 seconds, open a saved item without waiting for an API, and see exactly whether a change is local, pending or shared. Every core action has an offline fallback or an explicit statement that it needs connectivity. These are acceptance targets, not measured field results.

## 2. Scope and traceability
| User intent | Product behavior | Delivery status |
|---|---|---|
| Pull information from Naver | Search basic local metadata, review a result, save; open native Naver or browser | Handoff implemented; protected proxy supplied, live account test pending |
| Address and door PIN | Encrypted stay vault, separate PIN reveal, address-only driver card | Implemented locally; device security/usability review pending |
| Food wants, pictures and social links | Food find cards with photo, notes, multiple links, neighborhood and priority | Implemented locally |
| Destinations | Same find system, kind=place, optional coordinates and scheduled date/time | Implemented locally |
| Useful phrases and audio | 28 offline text phrases with Korean, Romanization, approximate phonetics, show-card and play | Text and device speech implemented; reviewed audio pack missing |
| USD to won | Bidirectional conversion using dated live-reference/manual rate; saved offline fallback | Implemented locally and proxy code supplied |
| Top food/destination checklist | Must-try filter plus visited state on the same finds | Implemented; seed ideas opt-in, not a verified ranking |
| Travel/transit guidance | Offline how-to cards, official links, emergency numbers and airport/return-home notes | Implemented content; date-specific details intentionally not hardcoded |
| Shared "we" workflow | One shared trip, individual membership, offline edits and conflict handling | Specification/schema/reducer only; not connected |

## 3. Information architecture
Five persistent bottom tabs: **Today, Saved, Speak, Tools, Trip**. Help is always in the header. Do not bury the accommodation behind a settings menu: Today has a direct shortcut even though Trip owns its details.

Saved is the single collection for meals and destinations. "Must-try" is a priority, "Visited" a state, and "Today" a dated view. A restaurant must not need separate edits in a wishlist, checklist and itinerary. Unscheduled dish ideas such as mandu are valid items without pretending a restaurant or reservation has been chosen.

## 4. Functional requirements and acceptance
### F01 · Today
Show the current Seoul date/time, trip dates when provided, the selected day's stops ordered by saved time, an unscheduled/prioritized count and quick actions. All planning dates use Asia/Seoul, not the phone's current time zone. In a future multi-day planner, changing days must not mutate the underlying visit state. No live travel-duration estimates in the initial release.
**Accept:** a date-bound stop appears on the correct Seoul day while the phone is set to a US time zone; the home screen renders without an API.

### F02 · Saved finds
A find includes ID, English/display name, Korean name, food/place type, neighborhood, road address, notes, up to eight ordinary web links, one local cover photo, priority, state, optional Seoul date/time, optional coordinate pair and a details-last-checked date. Minimum manual input is a name. Every card offers a visible state and a large detail target. All added text is escaped; only validated HTTP/S external links are saved.
**Accept:** add, edit, search, mark visited, unmark visited, delete with confirmation, and add a photo offline after installation. Reopening shows the committed data. A conflicting same-device tab edit is rejected without overwriting the newer record.

### F03 · Naver
Offer native search/browser fallback without credentials. Where coordinates are known, offer walking and transit route handoff. An optional authenticated Pages Function performs a local-search query using server secrets. Normalize current coordinate fields and reject obsolete formats. A user must review search results before adding.
The documented API provides basic listing fields, not a complete set of photos, reviews, menus, bookings, ratings or opening hours [S5]. The Maps product and native URL handoff are separate integration surfaces [S6–S8]. API-provided website links are not automatically canonical Naver Place IDs.
**Accept:** unconfigured, timed-out or rate-limited search leaves manual entry and saved data working. Never send the accommodation PIN to Naver. Verify provider terms/attribution and the available account product before enabling production persistence.

### F04 · Stay vault
Store accommodation name, Korean/optional English address, unit, host phone, door PIN, Wi-Fi credentials and access notes in a separately encrypted local envelope. A vault passphrase is distinct from the building PIN. Do not persist the passphrase or decrypted key. Require unlock, then a separate reveal for the PIN. Lock on close, background and inactivity. An address-only show-card is safe from accidental PIN inclusion, not from someone seeing the address itself.
**Accept:** raw stored JSON contains neither PIN nor passphrase; wrong passphrases fail; ordinary close/background removes rendered vault text; driver cards and printing omit PIN and Wi-Fi passwords. Test password-manager autofill on real iPhones. Encryption does not protect an already unlocked screen or a compromised application origin [S13–S14].

### F05 · Speak
Current categories: Basics, Food, Transport and Help. A dedicated Shopping category can be added with the next reviewed phrase pack. Search English or Korean; display Hangul prominently; include approximate spoken-English phonetics and Romanization as secondary aids. Every phrase has an audio action and a larger show-card. Stop audio when backgrounded or another phrase begins. Medical/allergy language requires separate human review and should never imply that a generic phrase confirms a dish is safe.
**Accept:** each approved recording matches its phrase, is audible on both traveler iPhones in airplane mode and fails with a useful message rather than silently. Device text-to-speech is a fallback, not the readiness criterion [S12].

### F06 · Currency
Support both USD→KRW and KRW→USD; KRW→USD is the useful on-the-street default. Show reference date, source and a stale warning after 72 hours. Permit a manually entered rate with date when the proxy is unavailable. Store the last valid reference locally and never erase it on refresh failure. Frankfurter is a reference-rate source, not a promise of the amount a card issuer or exchange booth will charge [S15].
**Accept:** with an explicitly assumed rate of 1 USD=1,400 KRW, 28,000 KRW converts to USD20.00 and USD20 to KRW28,000. Reject invalid/negative/nonfinite rates and mismatched currencies. This example is a fixture, not today's rate.

### F07 · Checklists and planning
Must-try and visited are present now. Add a separate predeparture checklist only for tasks such as install Naver, test transit card, download audio, confirm airport transfer and export backup. Reservation status should be explicit: "idea", "requested", "confirmed" or "cancelled"; do not imply that adding a link reserves a table. Structured bookings, map grouping and indoor alternatives are Phase 1 additions.

### F08 · Backup, restore and emergency fallback
Export an authenticated-encrypted JSON backup, including local photos. Current restore imports finds/photos as new IDs and never overwrites existing finds or an existing vault. Trip settings and exchange rates remain untouched; on a fresh device they must be re-entered. An imported vault still needs its original vault passphrase. Maximum backup file is 20 MB; export checks UTF-8 payload size before encryption. Keep compressed trip photos within a practical approximately 8 MB budget until larger archive support exists.
**Accept:** an export saved outside the browser restores on a second device; corrupt files and wrong passwords do not alter live data. Print emergency numbers and, only with explicit consent, the Korean address. PINs/passwords never enter the print layout.

### F09 · Shared trip, completion track
Use private owner/editor/viewer membership. Share invitation access, not the door code, through an expiring invitation. First join requires connectivity; subsequent cached access does not wait for a valid network session. Local changes commit immediately with an outbox mutation in the same transaction. Network sync retries in the foreground and never silently resolves concurrent user edits by timestamp. See the versioned protocol in document 03.
**Accept:** two iPhones see an acknowledged item; concurrent offline edits yield an explicit conflict; deletes do not resurrect; a duplicate retry creates one mutation; an expired session preserves pending changes. Revocation prevents future remote access but cannot erase copies already downloaded to another offline phone.

## 5. Extra features worth adding
| Priority | Feature | Why it earns space |
|---|---|---|
| Before departure | Airport arrival card and return-home route screenshot | Useful at the most connection-sensitive moments |
| Before departure | Reservation cards with Korean venue name, time, source and cancellation notes | Separates an intention from a confirmed commitment |
| Before departure | Packing/setup checklist and per-device offline check | Makes readiness actionable rather than assumed |
| Early enhancement | Group by neighborhood; one indoor alternative per day | Reduces unnecessary cross-city movement and gives flexible plans |
| Early enhancement | Favorites in Speak and custom show-cards | Faster access to repeated phrases; human-reviewed allergy card when relevant |
| Later | Shared expenses | Useful, but not worth delaying reliable navigation handoff and recovery |
| Later | Weather, events, nearby suggestions and itinerary optimization | Additional online dependencies; clearly optional, never block the core |

Do not add chatbot-first navigation, scraped social feeds, background location tracking, offline video downloads, automatic bookings, public profiles or payment-card storage to this short-trip release.

## 6. Reliability and accessibility targets
Design envelope: six travelers, 300 finds, a modest compressed photo collection, 28 short recordings. Aim for a cached shell under 250 KB before user media; the present build is approximately 107 KB uncompressed. Aim for a useful cached screen within one second on target iPhones, local text saves within 300 ms, and network-dependent UI timeouts under eight seconds. These are budgets to measure, not validated performance promises.

No destructive schema reset; no forced update during editing; no request to clear browser data as first-line troubleshooting. Browser storage remains evictable, even with persistence heuristics [S10–S11]. Use 48px touch targets, 16px minimum inputs, visible focus, meaningful labels, Hangul language tags, sufficient contrast and status text that does not rely on color. Test VoiceOver, text scaling, reduced motion, one-handed use, notches, landscape and software keyboards.

## 7. Scope tradeoff before a near departure
Prioritize the offline local app and independent recovery first. Group sync is valuable but must not be improvised under a deadline. When time is insufficient to validate collaboration, explicitly accept a local-only trip, provision each phone with the same reviewed backup and acknowledge that subsequent edits are independent. That is a fallback scope, not automatic synchronization. Audio likewise needs either a tested pack or a conscious text-only fallback, not a false green readiness check.
