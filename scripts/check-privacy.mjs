import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const norm=s=>String(s).normalize('NFC').toLowerCase().replace(/\s+/g,'');
const unescapeJSON=s=>s.replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
let markers=[],strict=!process.argv.includes('--allow-missing-private');
try{
 const source=JSON.parse(await readFile(path.join(root,'private/stay-source.json'),'utf8'));const instructions=await readFile(path.join(root,'private/OWNER_SETUP.md'),'utf8');const key=instructions.match(/^Seoul-[A-Za-z0-9_-]+$/m)?.[0];
 const coords=[source.lat,source.lng].flatMap(v=>[3,4,5,6].map(d=>Number(v).toFixed(d)));
 markers=[source.addressEn,source.addressKo,key,...coords].filter(Boolean).flatMap(x=>[x,encodeURIComponent(x)]).map(norm);
}catch(e){if(e.code!=='ENOENT')throw e;if(strict){console.error('FAIL: private/stay-source.json is missing, so the exact-value scan cannot run. Pass --allow-missing-private on a machine that is not meant to hold it.');process.exit(1);}}
// Cloudflare Pages deploys `functions/` from the project root alongside `dist`, so a Function is shipped source and is scanned too.
async function tree(dir){try{return await walk(path.join(root,dir));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
const files=[...await tree('dist'),...await tree('functions')];
// Each pattern needs an assignment with a real value on the right. `env.KAKAO_REST_API_KEY` and the word in a comment are clean code,
// and a gate that fails on clean code gets disabled, which leaves the tree less protected than no gate at all.
const credentials=[/API_ACCESS_TOKEN\s*=\s*(?!REPLACE_)\S/,/FETCH_SECRET\s*=\s*\S/,/KAKAO_REST_API_KEY\s*=\s*\S/,/\bKakaoAK\s+[A-Za-z0-9]{16,}/];
let scanned=0;
for(const f of files){
 const rel=path.relative(root,f);
 if(rel.startsWith('dist'+path.sep)&&/(?:^|\/)(?:private|docs|tests|qa)(?:\/|$)/.test(rel))throw new Error('A private or non-runtime directory is inside dist.');
 if(/\.(?:png|jpe?g|webp|gif|ico|m4a|mp3|wav|ogg|woff2?)$/i.test(f))continue;
 const raw=await readFile(f,'utf8'),body=norm(unescapeJSON(raw));scanned++;
 const hit=markers.find(x=>body.includes(x));if(hit)throw new Error('Plaintext stay details or the setup passphrase entered the public build: '+rel);
 const leak=credentials.find(x=>x.test(raw));if(leak)throw new Error('A credential assignment is in the deployed tree ('+rel+'), matched by '+leak+'. Secrets belong in Cloudflare environment variables, never in a shipped file.');
}
console.log(`PASS: deployment boundary inspected (${files.length} files across dist and functions, ${scanned} text files scanned, 4 credential patterns).${markers.length?' Exact address, coordinates at 3 to 6 decimals, the setup key and their URL, JSON and whitespace variants are absent.':' Owner-only source absent; only deployment-directory exclusion and credential patterns were checked.'}`);
