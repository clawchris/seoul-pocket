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
Korean phrases/phonetics are authored starter content, not copied audio or a certified translation. The general pack needs native review. No licensed venue photos or audio have been downloaded into the project. Original interface icons are included. User uploads and externally linked videos retain their owners' rights. Weather/rate/added-find screenshot values are synthetic UI fixtures, not live data. The stay screenshot uses the supplied real address and is private. Local ideas use linked sources; no individual venue photos were copied.


## v0.2 additions: source-to-claim mapping
| ID | Primary source | Used for / boundary |
|---|---|---|
| S27 | [Seoul Stay building listing](https://stay.visitseoul.net/seoul-stay/view/TheHavenStay?lang=en&us=11000) | Search result matches supplied address and exact coordinates. Does not establish the user's unit, booking/property identity or entry instructions. Direct page access was inconsistent; match came from the indexed official result. |
| S28 | [Visit Seoul: Guui transport reference](https://english.visitseoul.net/area/Dido-Jazz-Lounge/ENP040935) | Guui Station is Line 2. This listing's exit is not assumed to be the stay's exit; no venue recommendation implied. |
| S29 | [Gwangjin: Jayang market visit, June 2026](https://www.gwangjin.go.kr/photo/bbs/B0000111/searchMainView.do?menuNo=1100002&nttId=6613088) | Market existence/locality, not individual stall ratings. |
| S30 | [Gwangjin: April 2026 facility inspection](https://m.gwangjin.go.kr/photo/bbs/B0000111/searchMainView.do?menuNo=1100127&nttId=6573394&pageIndex=1) | Reason to recheck current market access. Does not establish present closure. |
| S31 | [Visit Seoul: Konkuk lamb-skewer alley](https://english.visitseoul.net/tours/a-chinese-delicacy-konkuk-univ-lamb-skewer-alley/ENN000641) | Chinese-food area idea. Historic tourism editorial/indexed snippet, not a current business-hours list. Direct page can return a firewall block. |
| S32 | [KTO: Seongsu-dong Cafe Street](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=112801) | Café-street destination; street access hours must not be applied to all cafés. |
| S33 | [KTO: Ttukseom Hangang Park](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=90908) | Riverside leisure/park suggestion. Seasonal facilities/access need current confirmation. |
| S34 | [Seoul city: Ttukseom park/Jayang station](https://english.seoul.go.kr/seoul-light-hangang-bitseom-festival-kicks-off-at-ttukseom-on-thu-oct-3/) | Station/park location only. The 2025 festival dates are NOT proposed as a 2026 event. |
| S35 | [Seoul Facilities Corporation: Children’s Grand Park](https://www.sisul.or.kr/global/main/en/sub/park.jsp) | Operator describes gardens/facilities and multiple gates including Guuimun. |
| S36 | [KTO: Achasan](https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=86170) | Hill/viewpoint suggestion, not a tested route or fitness assessment. |
| S37 | [Open-Meteo forecast API](https://open-meteo.com/en/docs) | Model-based current/hourly/daily fields, timezones, units and codes. |
| S38 | [Open-Meteo pricing/licensing](https://open-meteo.com/en/pricing) | Free endpoint: non-commercial, rate limits, no uptime guarantee; CC BY 4.0 attribution. Recheck before wider deployment. |
| S39 | [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) | Native IANA timezone formatting. Specific round-trip and DST behavior is verified by supplied tests on Node; actual iPhone tests remain. |

Implementation thresholds (30-minute refresh, 90-minute stale, six-hour old) are product choices, not provider promises. A local recommendation is an editorial inference from the stay area and cited place information, not a measured travel-time claim. Recheck transit, access and operating details for actual dates. No search snippets are treated as access to every unseen page detail.
