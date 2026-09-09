import {json} from '../_lib/http.js';
/** Public, non-secret runtime configuration. The Kakao JavaScript key is domain-restricted in the Kakao console and is
 * meant to ship to browsers; it is kept out of the repo so the repo stays account-free. */
export async function onRequestGet({env}){
 const r=json({kakaoJsKey:typeof env.KAKAO_JS_KEY==='string'&&/^[a-f0-9]{32}$/.test(env.KAKAO_JS_KEY)?env.KAKAO_JS_KEY:'',tourism:!!env.KTO_SERVICE_KEY,placeSearch:!!env.KAKAO_REST_API_KEY,sync:!!env.DB});
 r.headers.set('Cache-Control','public, max-age=300');return r;
}
