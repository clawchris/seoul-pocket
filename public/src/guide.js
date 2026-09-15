/** Content from the owner's own Seoul trip guide (Gaming, esports and K-pop, 14 September 2026).
 * Everything here is an idea to consider, never a booking, a verified opening time or a measured route.
 * Temporary pop-ups and collaborations are marked as such: check them again close to the day. */
export const GUIDE_REVIEW_DATE='2026-09-14';
export const GUIDE_DATES={start:'2026-09-28',end:'2026-10-05'};

/** Gaming, esports and K-pop destinations. tier A is the owner's own shortlist. Each can be saved as a find. */
export const INTERESTS=[
 {id:'lol-park',name:'LoL Park',korean:'롤파크',kind:'place',neighborhood:'Jongno',tier:'A',tag:'League of Legends',note:'The Riot/LCK arena destination with League displays, merchandise and PC-café elements. Worth the trip as a place even with no match on. A live LCK match may not fall in your dates, so do not plan the day around one. Check the current schedule and public opening before going.'},
 {id:'t1-base-camp',name:'T1 Base Camp',korean:'T1 베이스캠프',kind:'place',neighborhood:'Hongdae',tier:'A',tag:'League of Legends',note:'A T1-themed PC bang with merchandise and an esports atmosphere. Pairs naturally with the rest of the Hongdae gaming and K-pop cluster. A North American Riot account is not a Korean League account; treat playing as a bonus.'},
 {id:'square-enix-store',name:'Square Enix Store Seoul',korean:'스퀘어에닉스 스토어',kind:'place',neighborhood:'Seoul',tier:'A',tag:'Final Fantasy',note:'The officially licensed store and the strongest permanent stop for Final Fantasy and Square Enix goods. Confirm the current address and opening hours in Naver Map before travelling across the city.'},
 {id:'ffxiv-crystarium',name:'FFXIV Cafe Crystarium',korean:'파이널판타지14 카페',kind:'food',neighborhood:'Hapjeong',tier:'A',tag:'Final Fantasy',note:'An official Final Fantasy XIV themed café with themed food and decor. Reservations matter, so check availability for your exact date well before the day. Worth combining with the Hongdae and Hapjeong route.'},
 {id:'kukje-electronics',name:'Kukje Electronics Center',korean:'국제전자센터',kind:'place',neighborhood:'Seocho',tier:'A',tag:'Game shopping',note:'Many sellers under one roof, with physical games, figures, collectibles and older stock. Go with time to browse. A specific item may simply not be there that day.'},
 {id:'seongsu-popups',name:'Seongsu pop-up district',korean:'성수동',kind:'place',neighborhood:'Seongsu · Seongdong',tier:'A',tag:'Pop-ups',note:'Cafés, concept stores and rotating brand pop-ups, and the area most likely to host a short-term game or K-pop collaboration. Close to Guui. Which pop-ups exist depends entirely on your dates, so check it again on 28 September.'},
 {id:'yongma-land',name:'Yongma Land',korean:'용마랜드',kind:'place',neighborhood:'Mangu · Jungnang',tier:'A',tag:'TWICE',note:'A disused amusement park used as a filming location associated with TWICE “Like OOH-AHH”, and the strongest TWICE-specific place in Seoul. It is privately run with an entry fee and irregular hours; confirm access before going.'},
 {id:'pc-bang',name:'A Korean PC bang',korean:'PC방',kind:'place',neighborhood:'Anywhere · Geondae is closest',tier:'A',tag:'Lost Ark',note:'The most fitting Lost Ark experience: the Korean client, Korean PC-bang promotions and the room itself. Any decent PC bang works, and there is one near Konkuk University. A North American Steam account is not the Korean service; treat playing your own account as a bonus.'},
 {id:'myeongdong-kpop',name:'Myeongdong K-pop and street food',korean:'명동',kind:'food',neighborhood:'Myeongdong · Jung-gu',tier:'B',tag:'K-pop',note:'One walk that combines older album hunting, current K-pop shops, the Myeongdong Theater area for the KPop Demon Hunters connection, and street food. Do it as an evening rather than a store-to-store list.'},
 {id:'geondae-evening',name:'Konkuk University evening',korean:'건대입구',kind:'food',neighborhood:'Gwangjin',tier:'B',tag:'Near home',note:'One Line 2 stop from Guui. Go without a plan: student restaurants, bars, cafés, karaoke and late nightlife. The easiest good evening from this stay.'},
 {id:'jamsil-cluster',name:'Jamsil: Lotte World Tower and Seokchon Lake',korean:'잠실',kind:'place',neighborhood:'Songpa',tier:'B',tag:'Day out',note:'An easy Line 2 ride: the tower, the lake walk, and Jamsil baseball if a KBO home game falls in your dates. Check the fixture list rather than assuming a game.'},
 {id:'animate-hongdae',name:'Animate Hongdae and AK Plaza',korean:'애니메이트 홍대',kind:'place',neighborhood:'Hongdae',tier:'B',tag:'Game shopping',note:'Japanese games, anime, figures and character merchandise, in the same walk as T1 Base Camp and the Hongdae K-pop shops.'},
 {id:'aladin-hapjeong',name:'Aladin used bookstore, Hapjeong',korean:'알라딘 중고서점 합정',kind:'place',neighborhood:'Hapjeong',tier:'B',tag:'4Minute · SISTAR',note:'Used CDs and DVDs, and the realistic way to find 4Minute and SISTAR back catalogue. Inserts and photocards are often missing from used copies, so check each item in the shop.'},
 {id:'buruttrak-myeongdong',name:'Buruttrak record shop',korean:'부루트랙',kind:'place',neighborhood:'Myeongdong',tier:'B',tag:'4Minute · SISTAR',note:'A long-running record shop for browsing older Korean music next to current K-pop. A good place to ask directly about 4Minute and SISTAR releases.'},
 {id:'ggx-genG',name:'Gen.G GGX',korean:'젠지 GGX',kind:'place',neighborhood:'Seoul',tier:'B',tag:'Esports',note:'An esports and PC-bang experience run by Gen.G, a good addition on a gaming day rather than a headline stop.'},
 {id:'yangjae-stream',name:'Yangjae Stream',korean:'양재천',kind:'place',neighborhood:'Gangnam · Seocho',tier:'B',tag:'TWICE',note:'The filming location for Mina’s cherry-blossom sequence in TWICE “CHEER UP”. Late September has none of the spring look, so go for the location itself or skip it.'}
];

/** Cautions carried over from the guide, shown above the list so they are read before anything is saved. */
export const INTEREST_NOTES=[
 'Company offices are not attractions. JYP, RBW, Shift Up and IMC Games are workplaces, and the guide advises against visiting or waiting outside any of them.',
 'Pop-ups and collaboration cafés are temporary. Anything advertised as a current collaboration, including Stellar Blade, Lost Ark and KPop Demon Hunters, has to be rechecked close to the day.',
 'Korean game services run separate accounts. A North American Riot or Steam account does not carry over, so plan to watch and browse rather than to log in.',
 'HYOLYN is active solo, so search 효린 separately from 씨스타. For MAMAMOO, search the members too: 솔라, 문별, 휘인, 화사.'
];

/** Korean names worth searching in Naver Map or Kakao. */
export const SEARCH_NAMES=[
 {en:'TWICE',ko:'트와이스'},{en:'4Minute',ko:'포미닛'},{en:'SISTAR',ko:'씨스타'},{en:'HYOLYN',ko:'효린'},
 {en:'MAMAMOO',ko:'마마무'},{en:'Jay Park',ko:'박재범'},{en:'Tree of Savior',ko:'트리 오브 세이비어'},{en:'PC bang',ko:'PC방'}
];

/** Food categories to try at least once, from the guide. Each can be saved as a find to hunt down. */
export const FOODS=[
 {id:'food-samgyeopsal',name:'Samgyeopsal',korean:'삼겹살',note:'Pork belly Korean BBQ, the essential group meal. Wrap meat, lettuce or perilla, garlic and ssamjang into one bite.'},
 {id:'food-galbi',name:'Galbi',korean:'갈비',note:'Marinated ribs, the other classic Korean BBQ.'},
 {id:'food-dakgalbi',name:'Dakgalbi',korean:'닭갈비',note:'Spicy stir-fried chicken, often cooked at your table.'},
 {id:'food-fried-chicken',name:'Korean fried chicken',korean:'치킨',note:'Try both plain crispy and a sauced version, ideally in the same sitting.'},
 {id:'food-gimbap',name:'Gimbap',korean:'김밥',note:'Rice rolls. The easiest casual meal or snack.'},
 {id:'food-tteokbokki',name:'Tteokbokki',korean:'떡볶이',note:'Spicy and sweet rice cakes, the classic street food.'},
 {id:'food-eomuk',name:'Eomuk',korean:'어묵',note:'Fishcake, usually from a street stall with the broth.'},
 {id:'food-mandu',name:'Mandu',korean:'만두',note:'Korean dumplings, steamed or fried.'},
 {id:'food-kalguksu',name:'Kalguksu',korean:'칼국수',note:'Knife-cut noodle soup.'},
 {id:'food-gukbap',name:'Gukbap',korean:'국밥',note:'Rice with soup. A very common comforting meal category.'},
 {id:'food-jjajangmyeon',name:'Jjajangmyeon and tangsuyuk',korean:'짜장면 탕수육',note:'Korean-Chinese black bean noodles with sweet and sour pork.'},
 {id:'food-naengmyeon',name:'Naengmyeon',korean:'냉면',note:'Cold noodles. Distinctive enough to be worth one meal.'},
 {id:'food-jjigae',name:'Jjigae, three ways',korean:'김치찌개 된장찌개 순두부찌개',note:'The three core stews: kimchi, fermented soybean and soft tofu.'}
];
export const FOOD_EXPERIENCES=[
 'Do Korean BBQ properly at least once: meat, lettuce or perilla, garlic and ssamjang wrapped into a single bite.',
 'Eat inside a traditional market rather than only walking through one.',
 'Do a convenience-store haul from CU, GS25, 7-Eleven or emart24.',
 'Try a late-night restaurant or a pocha-style food-and-drink evening.'
];
export const CONDIMENTS=[
 {name:'Ganjang',korean:'간장',note:'Korean soy-based sauces.'},
 {name:'Ssamjang',korean:'쌈장',note:'Savoury fermented dipping paste, the one for BBQ wraps.'},
 {name:'Gochujang',korean:'고추장',note:'Fermented red pepper paste.'},
 {name:'Gochugaru',korean:'고춧가루',note:'Korean red pepper flakes.'},
 {name:'Sesame oil and salt',korean:'기름장',note:'The simple dip for grilled meat.'},
 {name:'Yangnyeom',korean:'양념',note:'The broad family of seasoned, spicy and sweet sauces.'}
];

/** Day shapes grouped by geography, so a day is not spent on the subway. */
export const DAY_PLANS=[
 {id:'local-easy',title:'Local and easy',body:'Guui, then Geondae for dinner, then Ttukseom Hangang Park in the evening.'},
 {id:'gaming-west',title:'Gaming, west',body:'Hongdae for Animate and the K-pop shops, then T1 Base Camp, then Hapjeong and the FFXIV café if it is booked.'},
 {id:'gaming-south',title:'Gaming, central and south',body:'Kukje Electronics Center, then the Square Enix Store, then dinner nearby.'},
 {id:'popup-day',title:'Pop-up day',body:'Seongsu, plus whatever temporary gaming or K-pop events the 28 September check turns up.'},
 {id:'twice-day',title:'TWICE and eastern Seoul',body:'Yongma Land, then food and cafés on your own side of the city.'},
 {id:'kpop-kdh',title:'K-pop and KPop Demon Hunters',body:'Myeongdong: older album hunt, current K-pop shops, the Myeongdong Theater area, then street food.'},
 {id:'classic',title:'Classic Seoul',body:'Gyeongbokgung, Bukchon, Insadong, Ikseon-dong, then Cheonggyecheon.'},
 {id:'jamsil',title:'Jamsil',body:'Seokchon Lake, Lotte World Tower, then baseball or an evening out.'}
];

/** The neighbourhoods reachable from the Guui base, and why each one matters. */
export const AREAS=[
 {name:'Guui and Gwangjin-gu',body:'Home. Everyday restaurants, cafés, convenience stores and residential Seoul.'},
 {name:'Konkuk University · Geondae',body:'One Line 2 stop. Student dining, bars, cafés, karaoke and nightlife.'},
 {name:'Seongsu',body:'Very close. Cafés, fashion and the pop-up district to watch for collaborations.'},
 {name:'Jamsil',body:'An easy Line 2 ride. Lotte World, the tower, Seokchon Lake and Jamsil baseball.'},
 {name:'Ttukseom and the Han River',body:'An evening by the river with takeout food.'},
 {name:'Achasan',body:'Local hiking with views over the river and eastern Seoul.'}
];

/** Transit guidance from the trip guide. Naver Map stays the authority for live routes. */
export const GUIDE_TRANSIT=[
 {title:'Getting from the airport to Guui',body:'Two routes were weighed. The airport limousine bus toward the Konkuk University and Gwangjin area, then a short taxi or one subway stop, is the easier one with luggage. AREX from Incheon to Hongik University, then Line 2 east to Guui, is cheaper but means more handling of bags. Decide which one you are taking before you land.'},
 {title:'Exit numbers decide your walk',body:'Different exits from the same station can leave you several blocks apart. Take the exit number from Naver Map, not the general direction, and check it again at the platform.'},
 {title:'T-money, and whether a Climate Card is worth it',body:'A T-money card covers pay-as-you-go subway and bus travel. A short-term Climate Card can pay off over consecutive days of heavy Seoul transit, so compare it against your actual plan rather than buying it by default.'},
 {title:'You do not need to learn the network',body:'Follow the line colour, the station name and number, the direction and the exit that Naver Map gives you. That is enough for the whole trip.'}
];
/** Small things that are different day to day, from the trip guide. */
export const CULTURE_NOTES=[
 'Tipping is generally not expected.',
 'Utensils are often in a drawer under the tabletop, and water or side dishes may be self-service.',
 'Some restaurants have a call button at the table. Use it rather than waiting to catch an eye.',
 'Subways are quieter than comparable transit at home, though boarding can be fast and dense.',
 'Bins are hard to find, so expect to carry a cup or wrapper for a while.',
 'Cards work nearly everywhere, but keep some cash for markets, stalls and the occasional machine.',
 'Take your shoes off entering a home when the entryway makes that expectation clear.',
 '1330 is the tourist assistance line and works as a multilingual safety net.'
];
