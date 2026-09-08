import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {PHRASES} from '../public/src/data.js';
const root=path.resolve(import.meta.dirname,'..'),m=JSON.parse(await readFile(path.join(root,'public/audio/manifest.json'),'utf8'));
const missing=[];
for(const p of PHRASES){const url=m.clips?.[p.id];if(!url||!/^\/audio\/[a-zA-Z0-9_.-]+\.(mp3|m4a|wav|ogg)$/.test(url)){missing.push(p.id);continue;}try{if((await stat(path.join(root,'public',url))).size<128)missing.push(p.id);}catch{missing.push(p.id);}}
if(!m.reviewed||!m.reviewer||missing.length){console.error('NOT FLIGHT READY: reviewed offline audio is incomplete.',{reviewed:m.reviewed,reviewer:m.reviewer,missing});process.exit(1);}
console.log('All phrase recordings exist and are marked reviewed. Human listening and real-iPhone airplane-mode tests are still required.');
