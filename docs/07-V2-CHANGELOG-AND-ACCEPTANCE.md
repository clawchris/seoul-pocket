# 07 · v0.2 feedback trace and upgrade notes
## Each requested change
| Owner feedback | Applied implementation | Verification |
|---|---|---|
| Incorporate exact stay | Private source + encrypted public seed, fresh-phone setup and existing-vault address-only review; Naver destination coordinates | Real seed decryption; exact-value privacy scan; UI flow; safe route and merge tests |
| Locality-based recommendations | Guui/Gwangjin identity/transit reference and six optional sourced east-Seoul food/place ideas | Valid saved record/source checks; opt-in/dedup UI checks; sources register |
| Currency should just swap | One USD/KRW swap, no dropdown, correct label/presets/output; visible rate date; remembered direction | Domain and DOM checks both directions |
| Apply simplicity elsewhere | Visible radio choices for type/status, fixed city chips, Now/±30m, C/F toggle, direct preparation checks; secondary setup collapsed | Zero select elements in app source/UI; overflow checks |
| Only keep predeparture suggestion | Actual 12-item persistent checklist; all other proposed feature systems removed from active specs/roadmap | Completion/restore rules and UI checks; manual documentation scope review |
| Add weather | Same-origin fixed-district Function, three days/12 hours, saved fallback, provenance, age warnings and C/F | Mocked API/schema/failure tests; weather DOM checks; live deployment remains |
| Seoul / Singapore / PT only | Native-IANA fixed converter with date rollover and DST-aware gap/repeat handling | Native Intl tests plus actual DOM interaction |
| Return every file updated | Source/build/tests/screens, complete specs, blueprint PDF/DOCX, revised Codex handoff | Archive inventory and artifact existence checked at packaging |

## Upgrade without data loss
Keep database name seoul-pocket and schema version 1. New metadata is additive: toolPrefs, validated weather, individual check:<id> values. Existing places/photos/prefs/rate/stay records remain. The new app does not seed over existing records on load. General/local suggestions are opt-in; existing priorities are not reset. Old stays without coordinates still open.

For a fresh phone: decrypt supplied seed after setup passphrase, then insert stay only if absent within an IndexedDB transaction. A racing existing stay wins. For an existing phone: decrypt its own vault, load the supplied address into a draft using the setup phrase, preserve non-address fields, explicitly encrypt/save. Cancelling must leave stored data untouched. Actual cross-tab/IndexedDB races still require the real-browser tests.

Encrypted backup restore keeps existing records, settings and rate. It imports new place/photo copies and only fills a missing stay. It can fill missing general preparation confirmations, but never transfers this-phone readiness confirmations as completed on a new phone. Forecast freshness and personal tool preferences are not restored as current configuration. Re-enter settings/rate and repeat device tests after fresh restore.

## Privacy boundary
The owner handoff is private, including any blueprint or QA image showing the address. The browser receives only encrypted exact stay data plus the public Guui/Gwangjin area and approximate forecast location. A strong private key is required to decrypt the seed. Editing the local vault's key does not revoke the old seed/key already distributed. Protect or retire the original ZIP accordingly. No PIN is included in the seed.

## Scope boundary
Rejected extras are not pending future work. Do not add them under another name. Existing driver address card, general transit guide, emergency card and neighborhood field were part of the original requirements and remain. Group synchronization/audio are unresolved original delivery requirements, not newly proposed travel features.
