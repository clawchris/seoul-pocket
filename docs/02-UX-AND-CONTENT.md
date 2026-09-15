# 02 · UX and content contract · v0.2
## Interaction principle
Prefer a visible action over a selector or a configuration screen. Never hide information necessary to understand an estimate, an old forecast, a local save or a locked vault. Use progressive disclosure for technical setup, not for safety-critical status.

Persistent bottom navigation contains exactly five tabs. Use semantic buttons/native radio groups, explicit labels, 48px targets, input text ≥16px and iPhone safe-area insets. Modals scroll within the viewport; the close button stays identifiable. Avoid hover-only behavior, tiny icon-only actions without names, em dashes, forced long onboarding and automatic full-screen reloads during edits.

## Currency
Tools shows the converter directly; Today opens the same tool in a sheet. There is one amount and one KRW ⇄ USD button. The numeric input is preserved when changing direction, so 10 USD becomes a request to convert 10 KRW, not a round-trip approximation of 10 dollars. The label, result currency and quick amount buttons all change together. This behavior is explained in one sentence. Direction persists; the current typed amount remains while navigating this session. Date/source category and an old-rate warning are visible without expanding details. Advanced rate entry/refresh lives in Exchange rate & source. No SGD conversion is in scope.

## Three-city time sheet
A compact live comparison appears on Today. The sheet starts with Now in Seoul, offers exactly Seoul, Singapore, Cupertino · PT, then native date and time inputs. Changing source preserves the selected instant. Editing the time pauses live updates. Now restores live comparison. ±30 minutes operates on the selected instant; dates always move with it.

Each result has city, local time, YYYY-MM-DD, KST/SGT/PDT/PST, numeric UTC offset and its date relationship to the source city. In a Pacific DST gap, show no conversions and explain why that wall time does not exist. During a repeated hour, ask First occurrence (PDT) or Second occurrence (PST). Never silently normalize a missing or ambiguous time. Dates are interpreted in the selected source zone, not the phone's current zone.

## Weather
Compact summary on Today; detailed card in Tools and a weather sheet. Display temperature, feels-like, wind, model description and timestamps. Use a C/F button, not a settings menu. Three daily cells show explicit month/day, high/low and rain chance. The next 12 hourly periods scroll horizontally inside the card, without page-wide overflow. Label all forecast times as Seoul time.

No result yet: explain that a live connection to the deployed weather Function is needed. Cached result: show its age and whether offline. Refresh failed: retain data and timestamps, state that refresh failed. Older than 90 minutes: stale warning. Older than six hours: old-snapshot warning, not an apparently current weather report. Weather does not auto-reschedule plans or certify a walk as safe. Keep Open-Meteo attribution and acknowledge normalization/unit conversion [S37–S38].

## Stay
Fresh phone: Our stay → Load preconfigured stay → setup passphrase → decrypted address view. This is a one-time import into that phone's vault, not a server login. Afterward, normal unlock is used. Let the owner change the passphrase with Edit stay. An existing stay opens unchanged. Use supplied address loads only address/coordinates into an editable draft; review/save is mandatory and current PIN/Wi-Fi/notes remain.

A Korean driver card must not contain entry codes, Wi-Fi credentials or the setup key. Naver gets only the destination data needed for the user's explicit route action. Copy address is separate from reveal PIN. Backgrounding, closing or inactivity locks the vault. Browser clipboard/history/screenshots are outside the encrypted-at-rest guarantee.

## Saved and locality
Food/place and visit-status choices use visible radio chips. Near our stay opens six opt-in ideas in the existing system. The source, date checked and caveats are available, but no suggested idea is silently marked must-try. Searching a neighborhood is distinct from a verified individual restaurant. Existing neighborhood text is not a proposed neighborhood planning feature.

## Predeparture checklist
Two groups, twelve large checkbox rows, saved X/12 progress, links to relevant existing tools. Check only after doing the task. Saving an item must complete before claiming success; on failure restore the previous visual state. User confirmations are not automatic proof of readiness. Device-specific confirmations are not transferable through backup. General preparation confirmations may import only into previously missing keys.

## The owner's trip guide in the app (14 September 2026)
The gaming, esports and K-pop guide is content, not a document to read. Its destinations live in a Gaming & K-pop sheet reached from Saved, next to the existing idea lists, and each entry can be saved as an ordinary find so it joins search, filters, votes and sync. The guide's own cautions open that sheet, because they change what a person does: company offices are not attractions, pop-ups are temporary, and Korean game accounts are separate. Tier A is labelled "Your shortlist" and tier B "Worth adding if the day allows", which is the guide's own ranking rather than an invented one.

Food is a separate sheet under Tools, because a dish is a thing to eat once, not a place to navigate to. Day plans are a third sheet, listing the eight day shapes and the neighbourhoods reachable from the stay. Transit and cultural notes were added to the existing transport sheet rather than a new surface. Seven preparation items joined the checklist, which is now 19 items. The exact Korean address never appears in any of this; the checklist item points at the stay vault instead.

## Sharing a post (14 September 2026)
A single link box sits at the top of Today, directly under the hero, and at the top of Saved. It has one field and one button. Paste, tap Share, and the post becomes a find that opens on its own. No other input is asked for; the name and note are prefilled from the post and can be edited afterwards. Outside a shared trip the box explains that sharing needs a trip and offers to set one up. Save a find stays the manual form.

## Home Screen install (9 September 2026)
A Today card, shown only when the app is running in a browser tab and not yet dismissed, explains why the Home Screen icon matters and opens a five-step Safari guide (Share, Add to Home Screen, Add). The same guide is reachable from Trip → Install on your iPhone and from the checklist item. The guide says plainly that the tab and the icon share one storage on the phone, and what to do when the option is missing inside an in-app browser. Dismissal is per device.

## Content rules and failure language
Use “Saved on this device, not shared,” not a cloud icon suggesting synchronization. In a shared trip the status line says “Shared trip · synced 3 min ago”, “… 2 waiting to send”, “… 1 to resolve” or “… signed out”; each is computed from local outbox, conflict and acknowledgement state, never from a request having been sent. Conflicts are worded as “Two versions of this find” with “Keep mine” and “Use shared”; the app never says merged. “Connection detected” does not mean provider reachable. “Cached” is not “tested offline.” “Device speech” is not “reviewed offline audio.” “Reference rate” is not final card settlement. Distinguish model/fetch time, user-supplied/verified information and an area suggestion/confirmed booking.

Actual QA screenshots are in qa/. Weather, rates and added finds use test fixtures. The stay screen uses the owner's supplied address; the screenshots and overview are private. Full-page captures show the fixed bottom bar at the original viewport position; that does not represent its position after scrolling on a phone.
