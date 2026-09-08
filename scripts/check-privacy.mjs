import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
let markers=[];
try{const source=JSON.parse(await readFile(path.join(root,'private/stay-source.json'),'utf8'));const instructions=await readFile(path.join(root,'private/OWNER_SETUP.md'),'utf8');const key=instructions.match(/^Seoul-[A-Za-z0-9_-]+$/m)?.[0];markers=[source.addressEn,source.addressKo,String(source.lat),String(source.lng),key].filter(Boolean).flatMap(x=>[x,encodeURIComponent(x)]);}catch(e){if(e.code!=='ENOENT')throw e;}
const files=await walk(path.join(root,'dist'));
for(const f of files){if(/(?:^|\/)(?:private|docs|tests|qa)(?:\/|$)/.test(path.relative(root,f)))throw new Error('A private or non-runtime directory is inside dist.');if(/\.(?:js|json|html|css|txt)$/.test(f)){const body=await readFile(f,'utf8');if(markers.some(x=>body.includes(x)))throw new Error('Plaintext stay details or a setup passphrase entered the public build.');}}
console.log(`PASS: deployment boundary inspected (${files.length} files).${markers.length?' Supplied exact address, coordinates and generated key are absent in plaintext.':' Owner-only source absent; only deployment-directory exclusion was checked.'}`);
