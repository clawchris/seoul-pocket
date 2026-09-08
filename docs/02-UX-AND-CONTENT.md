# 02 · UX and content system
Prepared 7 September 2026. Screenshots in `qa/` show the implemented app with illustrative fixtures, not the user's real travel information.

## 1. Visual direction
Warm off-white background, dark jade primary actions, light sage surfaces and restrained peach for food/priority. Use the system sans-serif stack, with system Hangul fallbacks. Avoid a map-first dashboard: a crowded map is less useful than a clear answer to the immediate task. Rounded cards are interactive where the whole surface is a button, with secondary controls kept separate. Icons always have text or accessible labels.

The source is the executable layout reference: `public/styles.css`, `public/index.html`, `public/src/ui.js` and `public/src/app.js`. Desktop adapts with a centered wider content column, not a completely different application. Photos are user-supplied, not hotlinked placeholders from unknown websites.

## 2. Global shell
Header: Seoul Pocket mark and Help. Status line: actual connectivity hint plus local/shared state. `navigator.onLine` is only a connection hint; it must not be presented as proof that the server is reachable. Bottom navigation is always visible and respects the iPhone safe area. Help opens emergency numbers and the official tourist helpline page. The app does not dispatch help automatically.

Sheets use native `<dialog>` semantics, a labeled heading, one obvious close target and their own scroll area. Long forms stay inside the sheet. Escape and close respect dirty-form confirmation. Secret sheets are removed from the DOM when closed. Errors appear in the form next to the action, not only in a disappearing toast. Save success is shown only after the local transaction completes.

## 3. Screen layouts
### Today
Reading order: trip/date heading; compact Seoul clock; primary stay shortcut; travel/conversion/add shortcuts; today's timed stops; remaining must-try count; setup/backup prompt where needed. Empty state asks for dates or a first find instead of filling the day with invented plans. A scheduled item uses the same record as Saved. A basic date/time assignment is implemented; a full day-by-day drag-and-drop planner is not.

### Saved
Heading "Worth a detour." and an always visible add action; search; horizontally scrollable chips for Everything, Food & drink, Places, Must-try and Visited; result count; photo cards. Cards show display name, Korean name, type and state, with an independent priority control. Starter ideas are an explicit action near the empty/list footer, not automatically inserted into the user's trip.

Detail view: photo when present; type/state/priority; large Korean name/address and copy action; planned Seoul date/time; notes; Naver app and browser actions; walking/transit handoff when coordinates exist; saved external links; details-last-checked provenance; edit/delete. Phone numbers, opening times and bookings are not fabricated from a Naver search result.

Add/edit: required name first; kind; Korean name/neighborhood/address; notes; links one per line; photo upload; priority/state; optional date/time; optional coordinates; checked date. Avoid forcing someone to complete a database form just to save a reel. The next iteration may add a paste-first capture flow, but manual entry is the dependable baseline now.

### Speak
Search; category chips; stacked phrase cards with English meaning, Hangul, phonetic hint and play/show controls. Korean is the primary text to show another person. A show-card enlarges the phrase and hides navigation complexity inside a modal, but retains a clear close action. Device speech failure is explained; no silent or decorative play button.

### Tools
Converter first: amount, direction, prominent result, rate/date/source, refresh and manual-rate actions. Below: transit guide, Naver search, offline check and emergency fallback. Currency starts without a fabricated rate. Tools that need connectivity are visibly different from things saved on the device.

### Trip
Trip name/dates; stay vault lock state; group-sharing status; backup and restore; installation/readiness instructions. The local build explicitly states that group sync is not connected. Eventually show member names/roles, last acknowledged sync and pending-conflict count. A public app shell is not an invitation to a private trip; only authorized members should reach remote private data.

## 4. Critical flows
**Save a social find:** add → name and link → optional photo or screenshot → save locally → add a neighborhood/date later. Open social content outside the app. A reel URL is a reference, not an offline copy of the video. No social login is collected.

**Get home:** Today → Our stay → unlock → Korean address → copy or show driver card. Revealing the door PIN is separate. The address-card path must never include room access codes, Wi-Fi passwords or hidden offscreen secret elements.

**Choose dinner:** Saved → Food & drink → Must-try → choose by neighborhood → open Naver for live route/current information → mark visited afterwards. In a future grouped view, preserve manual choices rather than automatically reordering the whole day.

**No signal:** reopen the installed app → saved data renders from IndexedDB → converter uses the last saved rate → written phrases remain present → reviewed local recording plays when installed. A connection-dependent link says it still needs the relevant service. Cache presence and actual device playback remain separate tests.

**Future conflict:** an item badge says "Needs review" → show "Your offline change" and "Shared change" with author/server version → choose a version or edit a combined copy → submit a new versioned mutation. Until resolved, retain both. Never hide conflicts under a successful sync toast.

## 5. State vocabulary
| Condition | Required language |
|---|---|
| Current local save | Saved on this device |
| No shared implementation | Saved on this device, not shared |
| Future outbox entry | Saved here · waiting to share |
| Server acknowledged | Shared · last confirmed [time] |
| Conflict | Your change is safe · review another version |
| Network failure | Could not connect · saved information is still available |
| Cache inventory passed | App shell is cached on this device |
| iPhone test not run | Offline restart has not been tested on this phone |
| No reviewed audio | Offline pronunciation is NOT verified |
| Stale currency reference | Using a saved rate from [date] |
| Venue detail unknown | Details have not been verified |

Do not use one green "Ready" indicator to imply that every dependency works. The current readiness sheet distinguishes cache files, photos, written phrases, configured audio, stored rate, vault and storage persistence. A complete release also needs recorded physical-device test results, sync status and backup-restoration evidence.

## 6. Content standards
Names are useful in both scripts; phonetics are approximate, not a replacement for audio or Hangul. Do not infer English spelling as a canonical Korean address. Preserve the user's original source links. Every seeded place/dish is an idea, not a booking, editorial ranking or independently verified business listing. Live hours, last admission, days closed, resident restrictions, station accessibility and fare coverage are checked for the actual travel dates.

Guide cards include a research date and official source. The current transit content distinguishes digital Tmoney from direct open-loop bank-card payment, a distinction necessary because those capabilities are not the same [S16–S19]. The general phrase pack has not been reviewed by a native Korean speaker; medical/allergy claims remain outside the approved scope.

## 7. Accessibility and failure review
Verify 320, 375, 390 and 430px widths; 200% text enlargement; visible keyboard on long forms; landscape safe areas; VoiceOver navigation and dialog focus return; Korean pronunciation language settings; reduced motion; strong sunlight contrast; low storage; absent Korean voice; failed photo decoding; declined clipboard permission. A copied address action must report failure and retain a selectable address instead of pretending it copied.

The current browser harness checks selected DOM flows and responsive overflow only. It does not establish VoiceOver compliance or native-iPhone keyboard behavior. The device review must use the installed Home Screen app, not only a desktop simulator.
