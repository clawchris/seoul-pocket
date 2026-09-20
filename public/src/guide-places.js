/** Addresses, coordinates and photos for the guide. Every address came from Kakao Local keyword search on 2026-09-20 and
 * was chosen by hand from the result list. Coordinates make each entry pin on the map and open in Naver directions.
 * Photos are Creative Commons or public domain from Wikimedia Commons; credit and licence travel with each one.
 * Nothing here is a booking, a checked opening time or a recommendation of a specific business. */
export const PLACE_REVIEW_DATE='2026-09-20';
export const PLACE_SOURCE='Kakao Local keyword search';

/** id -> the real venue the guide entry points at. */
export const VENUES={
 "lol-park":{korean:"치지직 롤파크",address:"서울 종로구 종로 33",category:"스포츠시설",lat:37.5711116029318,lng:126.981390403895,kakao:"https://place.map.kakao.com/1757200009"},
 "t1-base-camp":{korean:"T1베이스캠프",address:"서울 마포구 양화로 147",category:"게임방,PC방",lat:37.5559614381057,lng:126.922090930728},
 "ffxiv-crystarium":{korean:"카페크리스타리움",address:"서울 마포구 양화로6길 18",category:"카페",lat:37.5490073040732,lng:126.915214428088},
 "kukje-electronics":{korean:"국제전자센터",address:"서울 서초구 효령로 304",category:"상가,아케이드",lat:37.484734498793,lng:127.01769492401},
 "yongma-land":{korean:"용마랜드",address:"서울 중랑구 망우로70길 118",category:"촬영지",lat:37.594777405105326,lng:127.10545378032175},
 "animate-hongdae":{korean:"애니메이트 홍대점",address:"서울 마포구 양화로 188",category:"취미용품점",lat:37.55773922444777,lng:126.9264916573095},
 "aladin-hapjeong":{korean:"알라딘중고서점 합정점",address:"서울 마포구 양화로 78",category:"중고서점",lat:37.55138083951879,lng:126.91691264212548},
 "ggx-genG":{korean:"GGX",address:"서울 중구 을지로 264",category:"게임방,PC방",lat:37.5657600421876,lng:127.007079969366},
 "seongsu-popups":{korean:"성수역 2호선",address:"서울 성동구 아차산로 100",category:"지하철역",lat:37.5445888153751,lng:127.056066999327},
 "myeongdong-kpop":{korean:"명동역 4호선",address:"서울 중구 퇴계로 지하 126",category:"지하철역",lat:37.56096526943837,lng:126.98640235001736},
 "geondae-evening":{korean:"건대입구역 2호선",address:"서울 광진구 아차산로 243",category:"지하철역",lat:37.54040751726388,lng:127.06920291650829},
 "jamsil-cluster":{korean:"롯데월드타워",address:"서울 송파구 올림픽로 300",category:"빌딩",lat:37.51260447840551,lng:127.10255558658325},
 "pc-bang":{korean:"제노PC방 건대후문점",address:"서울 광진구 능동로16길 60",category:"게임방,PC방",lat:37.5452298014105,lng:127.076295583995,kakao:"https://place.map.kakao.com/34295205"},
 "yangjae-stream":{korean:"양재천 벚꽃길",address:"서울 강남구 도곡동 468",category:"도보여행",lat:37.4842278490895,lng:127.05009042856,kakao:"https://place.map.kakao.com/1302325998"},
 "cityrecord":{korean:"씨티레코드",address:"서울 중구 충무로1가 26-1",category:"음반,레코드샵",lat:37.56089657182544,lng:126.98459598416704},
 "local-jayang-market":{korean:"자양전통시장",address:"서울 광진구 자양동 713",category:"시장",lat:37.5348808261609,lng:127.079172429807},
 "local-kondae-skewers":{korean:"양꼬치거리",address:"서울 광진구 자양동 16-35",category:"테마거리",lat:37.540105493816,lng:127.063106107465},
 "local-seongsu-cafes":{korean:"성수동카페거리",address:"서울 성동구 성수동2가 276-5",category:"카페거리",lat:37.54243256842165,lng:127.05639353022181,kakao:"https://place.map.kakao.com/1913815654"},
 "local-ttukseom-park":{korean:"뚝섬한강공원",address:"서울 광진구 자양동 427-6",category:"도시근린공원",lat:37.5292974433415,lng:127.06892112991},
 "local-childrens-park":{korean:"서울어린이대공원",address:"서울 광진구 능동로 216",category:"테마파크",lat:37.5499772549675,lng:127.080235171998},
 "local-achasan":{korean:"아차산등산로입구",address:"서울 광진구 긴고랑로 213",category:"등산로",lat:37.5623270041388,lng:127.096206188343},
};

/** dish id -> real places within walking distance of the Guui and Konkuk area. */
export const FOOD_SPOTS={
 "food-samgyeopsal":[
  {name:"미가",address:"서울 광진구 광나루로24길 23",category:"삼겹살",lat:37.545312432293215,lng:127.07669851072139,phone:"02-458-6828",kakao:"https://place.map.kakao.com/1363202705"},
  {name:"기름칠",address:"서울 광진구 동일로24길 100",category:"삼겹살",lat:37.542316047005,lng:127.07036789834,phone:"0502-5550-5001",kakao:"https://place.map.kakao.com/1173821572"},
  {name:"금쪽삼겹 건대점",address:"서울 광진구 능동로16길 57",category:"삼겹살",lat:37.545351541365,lng:127.076132760446,phone:"",kakao:"https://place.map.kakao.com/464471683"},
  {name:"영화돈",address:"서울 광진구 능동로 175",category:"삼겹살",lat:37.54637139418981,lng:127.07341004577643,phone:"0502-5551-8444",kakao:"https://place.map.kakao.com/275833976"},
 ],
 "food-galbi":[
  {name:"고기굽는놈 건대본점",address:"서울 광진구 아차산로31길 8",category:"갈비",lat:37.5413236953058,lng:127.069439119417,phone:"0503-7152-2178",kakao:"https://place.map.kakao.com/24206169"},
  {name:"한우짝갈비살",address:"서울 광진구 아차산로51길 35",category:"갈비",lat:37.53858451269435,lng:127.08483147451089,phone:"02-458-8830",kakao:"https://place.map.kakao.com/1579718964"},
  {name:"연탄돼지갈비",address:"서울 광진구 자양번영로 69",category:"갈비",lat:37.5357369066869,lng:127.076236128587,phone:"010-9063-8817",kakao:"https://place.map.kakao.com/23435683"},
  {name:"환이네갈비살 2호점",address:"서울 광진구 아차산로29길 47",category:"갈비",lat:37.5429673649546,lng:127.069018577672,phone:"02-466-6158",kakao:"https://place.map.kakao.com/183297748"},
 ],
 "food-dakgalbi":[
  {name:"춘천골닭갈비",address:"서울 광진구 군자로 70",category:"닭요리",lat:37.54892717599075,lng:127.07103838246864,phone:"02-468-7396",kakao:"https://place.map.kakao.com/21235783"},
  {name:"장인닭갈비 건대점",address:"서울 광진구 아차산로 241",category:"닭요리",lat:37.5403971394527,lng:127.069994961014,phone:"02-498-8892",kakao:"https://place.map.kakao.com/2144895047"},
  {name:"고향산천 원조숯불닭갈비",address:"서울 광진구 능동로19길 11",category:"닭요리",lat:37.54695815531449,lng:127.07307000807697,phone:"02-462-8247",kakao:"https://place.map.kakao.com/23491675"},
  {name:"신계닭갈비",address:"서울 광진구 자양번영로3길 12",category:"닭요리",lat:37.5317897715152,lng:127.074591615971,phone:"02-458-8198",kakao:"https://place.map.kakao.com/1037024490"},
 ],
 "food-fried-chicken":[
  {name:"콩닭콩닭 건대본점",address:"서울 광진구 능동로16길 60",category:"치킨",lat:37.5452298014105,lng:127.076295583995,phone:"02-446-5943",kakao:"https://place.map.kakao.com/530430675"},
  {name:"해남닭집",address:"서울 광진구 능동로13길 46",category:"치킨",lat:37.5439831154697,lng:127.069998313511,phone:"02-466-4656",kakao:"https://place.map.kakao.com/11499383"},
  {name:"아미고프란고 건대점",address:"서울 광진구 광나루로20길 36-6",category:"치킨",lat:37.545538738558385,lng:127.07362309855473,phone:"02-452-0999",kakao:"https://place.map.kakao.com/1816055329"},
  {name:"쥬쥬치킨",address:"서울 광진구 아차산로29길 51",category:"치킨",lat:37.5431331083862,lng:127.069087754843,phone:"02-462-5006",kakao:"https://place.map.kakao.com/1205548982"},
 ],
 "food-gimbap":[
  {name:"김밥천국 구의점",address:"서울 광진구 자양로28길 11",category:"분식",lat:37.5423803122253,lng:127.084987400891,phone:"02-453-3370",kakao:"https://place.map.kakao.com/1198866900"},
  {name:"삐사감김밥 건대점",address:"서울 광진구 동일로22길 96",category:"분식",lat:37.5409390025786,lng:127.069381055434,phone:"02-464-0224",kakao:"https://place.map.kakao.com/242057243"},
  {name:"꿈을담은김밥",address:"서울 광진구 자양로 192-1",category:"분식",lat:37.5446901685908,lng:127.085410967276,phone:"02-454-5289",kakao:"https://place.map.kakao.com/18451853"},
  {name:"세종김밥떡볶이",address:"서울 광진구 광나루로 375-1",category:"떡볶이",lat:37.548075316951405,lng:127.07172560015286,phone:"",kakao:"https://place.map.kakao.com/1591951855"},
 ],
 "food-tteokbokki":[
  {name:"또또떡볶이",address:"서울 광진구 능동로19길 7",category:"떡볶이",lat:37.54691922925134,lng:127.07336531883054,phone:"02-467-3009",kakao:"https://place.map.kakao.com/726937270"},
  {name:"은혜즉석떡볶이",address:"서울 광진구 광나루로 381-1",category:"떡볶이",lat:37.54813531833237,lng:127.07232485191693,phone:"02-468-7401",kakao:"https://place.map.kakao.com/11354357"},
  {name:"우리할매떡볶이 건대점",address:"서울 광진구 아차산로29길 28",category:"우리할매떡볶이",lat:37.542106130788,lng:127.068810713458,phone:"02-499-2055",kakao:"https://place.map.kakao.com/193362247"},
  {name:"동대문엽기떡볶이 자양점",address:"서울 광진구 자양로 109",category:"동대문엽기떡볶이",lat:37.5372558016023,lng:127.08319388060605,phone:"02-454-8592",kakao:"https://place.map.kakao.com/1255177871"},
 ],
 "food-eomuk":[
  {name:"아찌떡볶이",address:"서울 광진구 아차산로29길 53",category:"분식",lat:37.5432303818235,lng:127.069146685137,phone:"02-462-8340",kakao:"https://place.map.kakao.com/19238595"},
  {name:"은혜즉석떡볶이",address:"서울 광진구 광나루로 381-1",category:"떡볶이",lat:37.54813531833237,lng:127.07232485191693,phone:"02-468-7401",kakao:"https://place.map.kakao.com/11354357"},
 ],
 "food-mandu":[
  {name:"화원식당",address:"서울 광진구 능동로16길 56-6",category:"중국요리",lat:37.5450497652263,lng:127.076041927462,phone:"02-454-1888",kakao:"https://place.map.kakao.com/21232416"},
  {name:"시옌 건대점",address:"서울 광진구 능동로 137-8",category:"중국요리",lat:37.5433910144621,lng:127.071740348601,phone:"02-498-2280",kakao:"https://place.map.kakao.com/7971958"},
 ],
 "food-kalguksu":[
  {name:"구의동손칼국수",address:"서울 광진구 자양로 154",category:"칼국수",lat:37.541203506143255,lng:127.08386812539251,phone:"02-455-0052",kakao:"https://place.map.kakao.com/1284850607"},
  {name:"밀마당바지락칼국수",address:"서울 광진구 자양로 193",category:"칼국수",lat:37.54475985813857,lng:127.08497765482964,phone:"02-444-2778",kakao:"https://place.map.kakao.com/13073675"},
  {name:"밀숲 건대점",address:"서울 광진구 아차산로34길 5-5",category:"밀숲",lat:37.539784446499375,lng:127.07001701820472,phone:"02-467-4010",kakao:"https://place.map.kakao.com/26598929"},
  {name:"대원칼국수",address:"서울 광진구 자양로18길 56",category:"칼국수",lat:37.5378704863427,lng:127.086670431874,phone:"02-454-3112",kakao:"https://place.map.kakao.com/7831256"},
 ],
 "food-gukbap":[
  {name:"반주옥",address:"서울 광진구 능동로 172",category:"국밥",lat:37.54586367470583,lng:127.07414168562278,phone:"0507-1449-1074",kakao:"https://place.map.kakao.com/1335412367"},
  {name:"마장한우소머리국밥",address:"서울 광진구 자양번영로 81",category:"국밥",lat:37.53688275878035,lng:127.07657673089707,phone:"02-452-0320",kakao:"https://place.map.kakao.com/2024843110"},
  {name:"153콩나물국밥&비빔밥",address:"서울 광진구 아차산로 297",category:"국밥",lat:37.53855798038463,lng:127.07617111192937,phone:"02-456-2319",kakao:"https://place.map.kakao.com/24788475"},
  {name:"굴다리전주콩나물국밥 구의점",address:"서울 광진구 자양로 160",category:"국밥",lat:37.5418690703953,lng:127.084253590437,phone:"02-458-8118",kakao:"https://place.map.kakao.com/2126320601"},
 ],
 "food-jjajangmyeon":[
  {name:"시옌 건대점",address:"서울 광진구 능동로 137-8",category:"중국요리",lat:37.5433910144621,lng:127.071740348601,phone:"02-498-2280",kakao:"https://place.map.kakao.com/7971958"},
  {name:"홍콩정통중국요리",address:"서울 광진구 광나루로24길 29",category:"중국요리",lat:37.5452177774575,lng:127.07677536109509,phone:"02-457-6509",kakao:"https://place.map.kakao.com/18283515"},
  {name:"화원식당",address:"서울 광진구 능동로16길 56-6",category:"중국요리",lat:37.5450497652263,lng:127.076041927462,phone:"02-454-1888",kakao:"https://place.map.kakao.com/21232416"},
  {name:"금하중식당",address:"서울 광진구 아차산로36길 5",category:"중국요리",lat:37.5382896041059,lng:127.074568671791,phone:"02-404-8000",kakao:"https://place.map.kakao.com/27320023"},
 ],
 "food-naengmyeon":[
  {name:"함흥본가면옥 건대점",address:"서울 광진구 광나루로 456",category:"냉면",lat:37.5451805911085,lng:127.07986226799,phone:"02-447-8806",kakao:"https://place.map.kakao.com/10921559"},
  {name:"서북면옥",address:"서울 광진구 자양로 199-1",category:"냉면",lat:37.5453966002957,lng:127.08534387836,phone:"02-457-8319",kakao:"https://place.map.kakao.com/7939102"},
  {name:"속초코다리냉면 롯데백화점스타시티점",address:"서울 광진구 능동로 92",category:"냉면",lat:37.53895816403704,lng:127.07162861042343,phone:"02-2218-2011",kakao:"https://place.map.kakao.com/795927862"},
  {name:"육쌈냉면 건대점",address:"서울 광진구 아차산로29길 19",category:"육쌈냉면",lat:37.541836083462705,lng:127.06837595867269,phone:"02-467-6392",kakao:"https://place.map.kakao.com/27550915"},
 ],
 "food-jjigae":[
  {name:"재희네식당",address:"서울 광진구 군자로 21",category:"찌개,전골",lat:37.5451538491229,lng:127.070945407138,phone:"02-462-7207",kakao:"https://place.map.kakao.com/12183322"},
  {name:"the개미 건대본점",address:"서울 광진구 능동로16길 60",category:"찌개,전골",lat:37.545253195920424,lng:127.07634426574296,phone:"02-452-4015",kakao:"https://place.map.kakao.com/15617396"},
  {name:"엄탕 구의점",address:"서울 광진구 아차산로51길 66",category:"찌개,전골",lat:37.53990071290989,lng:127.08505473931407,phone:"02-455-8528",kakao:"https://place.map.kakao.com/21132017"},
  {name:"502찌개마을&옛날삼겹살 건대직영점",address:"서울 광진구 아차산로 209",category:"찌개,전골",lat:37.5414827910412,lng:127.066979337553,phone:"",kakao:"https://place.map.kakao.com/561756398"},
 ],
};

/** id -> a freely licensed photo shipped with the app so it works offline. */
export const PHOTOS={
 "lol-park":{src:"/img/guide/lol-park.jpg",credit:"self",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:LOL_Park_Entrance.jpg"},
 "t1-base-camp":{src:"/img/guide/t1-base-camp.jpg",credit:"Wvdp",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:T1_Base_Camp_PC_bang_interior_-_2023-07-21.jpg"},
 "kukje-electronics":{src:"/img/guide/kukje-electronics.jpg",credit:"Ominae",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Old_Gen_EB_Sign_in_Kukje_Electronics_Center.jpg"},
 "yongma-land":{src:"/img/guide/yongma-land.jpg",credit:"Christian Bolz",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Yongma_Land.jpg"},
 "animate-hongdae":{src:"/img/guide/animate-hongdae.jpg",credit:"U0894629",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Street_hongdae_Seoul.jpg"},
 "seongsu-popups":{src:"/img/guide/seongsu-popups.jpg",credit:"CartoonChess",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Industrial_buildings_in_Seongsu-dong.jpg"},
 "myeongdong-kpop":{src:"/img/guide/myeongdong-kpop.jpg",credit:"lumoplank",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Myeongdong,_Seoul_-_Myeongdong3165.jpg"},
 "geondae-evening":{src:"/img/guide/geondae-evening.jpg",credit:"Brit in Seoul",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Konkuk_University,_Seoul.jpg"},
 "jamsil-cluster":{src:"/img/guide/jamsil-cluster.jpg",credit:"Шохбоз",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Lotte_World_Tower_(2).jpg"},
 "pc-bang":{src:"/img/guide/pc-bang.jpg",credit:"MatthieuRicard",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:2020-03-08_10.25.33_PC_bang_in_South_Korea.jpg"},
 "yangjae-stream":{src:"/img/guide/yangjae-stream.jpg",credit:"Jeon Han",licence:"CC BY-SA 2.0",source:"https://commons.wikimedia.org/wiki/File:Yangjaecheon_Stream_2016_06.jpg"},
 "local-kondae-skewers":{src:"/img/guide/local-kondae-skewers.jpg",credit:"악미",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:%EC%96%91%EA%BC%AC%EC%B9%98.jpg"},
 "local-seongsu-cafes":{src:"/img/guide/local-seongsu-cafes.jpg",credit:"Sgroey",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Camera_shop_seongsu_seoul_2.jpg"},
 "local-ttukseom-park":{src:"/img/guide/local-ttukseom-park.jpg",credit:"Motoko C. K.",licence:"CC BY 4.0",source:"https://commons.wikimedia.org/wiki/File:Ttukseom_Hangang_Park_20260416_1.jpg"},
 "local-childrens-park":{src:"/img/guide/local-childrens-park.jpg",credit:"InSapphoWeTrust from Los Angeles, California, USA",licence:"CC BY-SA 2.0",source:"https://commons.wikimedia.org/wiki/File:Childrens_Grand_Park_%EC%96%B4%EB%A6%B0%EC%9D%B4%EB%8C%80%EA%B3%B5%EC%9B%90_(5488463272).jpg"},
 "food-samgyeopsal":{src:"/img/guide/food-samgyeopsal.jpg",credit:"by hellochris",licence:"CC BY 2.0",source:"https://commons.wikimedia.org/wiki/File:Korean.cuisine-Samgyeopsal-01.jpg"},
 "food-galbi":{src:"/img/guide/food-galbi.jpg",credit:"ayustety (a flickr user)",licence:"CC BY-SA 2.0",source:"https://commons.wikimedia.org/wiki/File:Korean.food-Galbi-03.jpg"},
 "food-dakgalbi":{src:"/img/guide/food-dakgalbi.jpg",credit:"Fumikas Sagisavas",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Chuncheon_sizzling_chicken_(Dakgalbi).jpg"},
 "food-fried-chicken":{src:"/img/guide/food-fried-chicken.jpg",credit:"Startandstar",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Korean_fried_chicken_240206.jpg"},
 "food-gimbap":{src:"/img/guide/food-gimbap.jpg",credit:"최광모",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Gimbap_02.jpg"},
 "food-tteokbokki":{src:"/img/guide/food-tteokbokki.jpg",credit:"by jetalone (flickr)",licence:"CC BY 2.0",source:"https://commons.wikimedia.org/wiki/File:Korean.snacks-Tteokbokki-08.jpg"},
 "food-eomuk":{src:"/img/guide/food-eomuk.jpg",credit:"Hankook12",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Korean_fishcake_bunsik_eoumuk_01.jpg"},
 "food-mandu":{src:"/img/guide/food-mandu.jpg",credit:"Chloe Lim",licence:"CC BY 2.0",source:"https://commons.wikimedia.org/wiki/File:Jjin-mandu_3.jpg"},
 "food-kalguksu":{src:"/img/guide/food-kalguksu.jpg",credit:"Mobius6",licence:"CC BY-SA 4.0",source:"https://commons.wikimedia.org/wiki/File:Kalguksu_20230408_001.jpg"},
 "food-gukbap":{src:"/img/guide/food-gukbap.jpg",credit:"chomjong",licence:"CC BY 2.0",source:"https://commons.wikimedia.org/wiki/File:Dwaeji-gukbap_1.jpg"},
 "food-jjajangmyeon":{src:"/img/guide/food-jjajangmyeon.jpg",credit:"최광모",licence:"CC0",source:"https://commons.wikimedia.org/wiki/File:Jajangmyeon_(mixed).jpg"},
 "food-naengmyeon":{src:"/img/guide/food-naengmyeon.jpg",credit:"chomjong",licence:"CC BY 2.0",source:"https://commons.wikimedia.org/wiki/File:Mul-naengmyeon_1.jpg"},
 "food-jjigae":{src:"/img/guide/food-jjigae.jpg",credit:"travel oriented",licence:"CC BY-SA 2.0",source:"https://commons.wikimedia.org/wiki/File:Gimchi-jjigae_1.jpg"},
};
