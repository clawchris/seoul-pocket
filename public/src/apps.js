/** Shortcuts into the iPhone apps a traveler actually opens in Seoul. Custom schemes open the installed app; the store link is the fallback. */
export const APPS=Object.freeze([
 {id:'naver-map',name:'Naver Map',korean:'네이버 지도',what:'Live directions, transit and place pages. The map Koreans use.',scheme:'nmap://search?query=&appname=https://seoul-pocket.pages.dev',store:'https://apps.apple.com/app/id311867728'},
 {id:'kakao-map',name:'Kakao Map',korean:'카카오맵',what:'Second map with strong bus and walking routes. Our saved places open here too.',scheme:'kakaomap://open',store:'https://apps.apple.com/app/id304608425'},
 {id:'papago',name:'Papago',korean:'파파고',what:'Naver’s translator. Camera mode reads menus and signs.',scheme:'papago://',store:'https://apps.apple.com/app/id1147874819'},
 {id:'google-translate',name:'Google Translate',korean:'구글 번역',what:'Conversation mode for talking with a host or a driver.',scheme:'googletranslate://',store:'https://apps.apple.com/app/id414706506'},
 {id:'kakao-t',name:'Kakao T',korean:'카카오 T',what:'Taxi hailing. Cards from abroad work in the app.',scheme:'kakaotaxi://',store:'https://apps.apple.com/app/id981110422'},
 {id:'kakaotalk',name:'KakaoTalk',korean:'카카오톡',what:'How hosts and restaurants message. Useful for check-in questions.',scheme:'kakaotalk://',store:'https://apps.apple.com/app/id362057947'}
]);
