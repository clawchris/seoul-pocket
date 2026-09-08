# 01 · Product specification · v0.2
Updated 7 September 2026. This document supersedes the v0.1 recommendations where scope differs. Implementation status is not deployment certification.

## Purpose and users
A small group visiting Seoul for a few days, primarily on iPhones. The app should answer: what did we save, what are we doing today, how do we get there, what can we say, what does this cost, what time is it elsewhere, and how do we get home? The current implementation is device-local. The word “we” does not imply working collaborative storage.

## Accepted scope
Five tabs: Today, Saved, Speak, Tools, Trip. Retain the original food/place collection, pictures/links, Korean phrases, important stay information, conversion and must-try checklist. Add the supplied encrypted stay/map pin, six locality-based ideas, fixed-district weather, fixed three-city conversion and a persistent predeparture checklist.

Explicitly excluded: separate reservation cards, airport/return-home card systems, neighborhood grouping/planning subsystem, customized allergy/favorite-phrase extensions and indoor-alternative planning. Do not reintroduce these as proposed next features. Existing basic address cards, neighborhood text fields, emergency content and transit instructions remain part of the original scope. Airport preparation can be a checklist item without becoming a new subsystem.

## Functional requirements and acceptance
| ID | Requirement | Acceptance |
|---|---|---|
| P01 | Unified Saved records | One food/place record supports name, Korean name, neighborhood, address, notes, ≤8 HTTP/S links, one local image, priority, status and optional planned date/time. Today and must-try are views, not copies. |
| P02 | User-owned media | Resize/re-encode JPEG/PNG/WebP; preserve offline bytes. Reject HEIC with a useful alternative. Social links open externally; no implied offline video download. |
| P03 | Supplied stay | Exact user source sealed with authenticated encryption. Fresh install imports only after correct setup passphrase. No inferred room/PIN/host/dates. |
| P04 | Existing stay compatibility | Deployment never overwrites it. Address merge preserves every other existing field and requires review plus explicit encrypted save. Old coordinate-less vaults still open. |
| P05 | Useful address actions | Korean/English display and copy; coordinate-based Naver route plus browser fallback; driver card excludes PIN/Wi-Fi credentials. Do not promise the final building entrance is verified. |
| P06 | Currency simplicity | Only USD/KRW. One swap button, one amount input, large answer, appropriate presets. Swap preserves typed number. Visible source category/date and stale warning; source/manual controls expanded only when needed. Direction remembered locally. |
| P07 | Local weather | No city picker or GPS prompt. Fixed approximate Gwangjin forecast; current model estimate, feels-like, wind, three days, next 12 hourly periods, rain probability and C/F toggle. |
| P08 | Weather truthfulness | Validate provider schema/units/timezone. Store last successful result; show saved/model timestamps. Label offline, >90-minute stale and >6-hour old states. A failed refresh never replaces data or advances its timestamp. Null rain chance stays unknown. |
| P09 | Three-city time comparison | Exactly Seoul, Singapore, Cupertino/PT. Source chips, date/time, Now, ±30 minutes. Show all three dates, UTC offsets and previous/same/next date. No network request required. |
| P10 | Correct Pacific time | Use America/Los_Angeles through Intl. Reject missing spring-forward times; require choice of first or second occurrence for repeated autumn times. No permanent UTC−8 assumption. |
| P11 | Preparation checklist | 12 explicit tappable confirmations, grouped Before departure / On this iPhone. Save each item locally. Never claim automated certification. Do not restore device-specific checks as completed on a fresh phone. |
| P12 | Local ideas | Six optional sourced ideas in the existing Saved model. Do not mark must-try until user chooses. No fabricated distance, walk time, hours, stock photo or restaurant review. |
| P13 | Korean phrases | 28 draft written cards with Hangul, approximate phonetics, Listen and Show card. Reviewed files are a release gate; device TTS is only a fallback. |
| P14 | Offline/recovery | Cached first-party shell, local finds/images/stay/checklist, offline currency with saved rate and local time conversion. Online navigation/weather/rates clearly separate. Non-overwriting encrypted backups and tested restore required. |

## Layout
Today: local-area identity, four quick actions, compact weather, three-city live strip, preparation progress, planned stops, local-ideas entry.
Saved: search; Everything/Food/Places/Must-try/Visited chips; cards; add; Near our stay and general Seoul ideas.
Speak: search/category chips; Korean/English/phonetic cards; audio and show actions.
Tools: currency at top; time/checklist/transit/help links; detailed district weather.
Trip: encrypted stay; dates; backup/restore; preparation checklist; secondary offline/Naver/print controls; honest local-only status.

## Data and reliability
Local writes must finish before success is shown. Existing data survives failed requests, rejected imports and updates. Plaintext accommodation details stay out of static assets; approximate locality is public. The owner ZIP/private folder must be protected separately. Saved finds/photos are not encrypted locally. A cache is not a backup and browser persistence is not an absolute guarantee [S10–S11].

Weather is optional and network dependent. Open-Meteo's free access is non-commercial, rate-limited and without an uptime guarantee [S37–S38]. It cannot provide a reliable forecast for unknown far-future trip dates or official hazard clearance. Time conversion is local and depends on the phone's clock/timezone database [S39].

## Definition of ready
A testable build is not a travel release. Pass installed-iPhone cold reopen, address/unlock/copy/map handoff, backup restoration, realistic network failures, correct time/date transitions and required offline audio. If sharing is essential, also pass real two-device auth/conflict/retry tests. Show unresolved status until each gate passes. See docs/04 and docs/06.
