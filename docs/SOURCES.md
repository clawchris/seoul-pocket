# Primary sources and recheck register
Research date: **2026-09-07**. These links support factual integration/travel statements; implementation choices and proposed requirements are the author's design. Provider pages can change. Review this register again before deployment and for the actual travel dates. No source is represented as permission to scrape or republish all provider content.

| ID | Primary source | Used for / recheck trigger |
|---|---|---|
| S1 | [Cloudflare Pages](https://developers.cloudflare.com/pages/) | Static app and Functions platform |
| S2 | [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) | Repeatable deploys and project workflow constraints |
| S3 | [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/) | D1/R2 bindings; confirm preview and production settings |
| S4 | [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) | Wrangler deployment and dashboard limitations |
| S5 | [Naver Developers Local Search](https://developers.naver.com/docs/serviceapi/search/local/local.md) | Basic fields, credentials, max five results; API does not expose a full venue profile |
| S6 | [Naver coordinate migration notice](https://developers.naver.com/notice/article/12567) | WGS84 coordinate change; reject obsolete example format |
| S7 | [Naver Maps URL scheme](https://guide.ncloud-docs.com/docs/en/maps-url-scheme) | Native search/walk/public-transit handoff and required appname |
| S8 | [Naver Cloud Maps overview](https://guide.ncloud-docs.com/docs/en/maps-overview) | Distinguish Maps from Search |
| S9 | [Naver Cloud API Hub Local Search](https://api.ncloud-docs.com/docs/naver-api-hub-search-local) | Alternative product surface; verify actual account/credential compatibility |
| S10 | [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | Quotas, persistence heuristics and eviction risk |
| S11 | [WebKit tracking prevention](https://webkit.org/tracking-prevention/) | Home Screen app/storage treatment; not an eviction guarantee |
| S12 | [MDN speechSynthesis.getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices) | Device voice availability and enumeration |
| S13 | [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) | Authenticated encryption and threat-model limits |
| S14 | [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | PBKDF2 work-factor reference; not proof of this implementation's security |
| S15 | [Frankfurter official API](https://frankfurter.dev/) | Reference exchange rates and v2 contract |
| S16 | [MobileTmoney publisher App Store listing](https://apps.apple.com/us/app/mobiletmoney/id1470361790) | Current international flow and supported Apple Pay top-up card brands; ignore superseded 2025 reviews |
| S17 | [Korea Tourism Organization transport cards](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140663) | Transit-card options and date-dependent pass changes |
| S18 | [Seoul Climate Card](https://english.seoul.go.kr/policy/transportation/climate-card/) | Current pass validity and service area; recheck actual trip dates |
| S19 | [Seoul open-loop payment rollout](https://english.seoul.go.kr/seoul-implements-open-loop-payments-for-international-tourists/) | Phased rollout, not universal current foreign-bank-card acceptance |
| S20 | [Visit Seoul subway](https://english.visitseoul.net/subway) and [bus](https://english.visitseoul.net/bus) | Basic transit use |
| S21 | [Naver Maps publisher App Store listing](https://apps.apple.com/app/id311867728) | Current native navigation application |
| S22 | [AREX official](https://www.airportrailroad.com/) | Airport service types; routes/fares/schedules need date checks |
| S23 | [Visit Seoul safety](https://english.visitseoul.net/safety) and [KTO 1330](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140632) | Emergency numbers and tourist help; service-hours caveat |
| S24 | [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | Transactional batch behavior; test real concurrency rather than assuming zero-row update is an error |
| S25 | [Visit Seoul first-time guide](https://english.visitseoul.net/mvp/IfyouvisitSeoulforthefirsttime/ENN036597) | Broad destination inspiration, not a ranked/vendor-vetted recommendation list |
| S26 | [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) | Hosting/backend usage differ; no guaranteed cost estimate |

## Important tensions in the evidence
Tmoney's current publisher description/release notes differ materially from older user reviews and older setup advice. The guide follows the current publisher documentation while requiring a real card/device test. A Tmoney card in Apple Wallet is a different capability from tapping a foreign credit card directly at a gate.

Climate Card coverage is date dependent and official pages may reflect different policy stages. The app therefore links current guidance instead of embedding a supposedly permanent fare/airport rule. Confirm the actual dates before making the pass recommendation.

Some older Naver code samples show outdated result counts or coordinate formats. The implementation follows the current parameter table and the coordinate migration notice, not every historical sample. Naver Cloud API Hub onboarding may differ from the traditional Developers API targeted by the proxy.

## Content provenance
Korean phrases/phonetics are authored starter content, not copied audio or a certified translation. The general pack needs native review. No licensed venue photos or audio have been downloaded into the project. Original interface icons are included. User uploads and externally linked videos retain their owners' rights. The screenshot cafe/address/rate are synthetic fixtures, not real trip data or current financial quotes.
