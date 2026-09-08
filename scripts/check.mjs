import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
async function walk(dir){const es=await readdir(dir,{withFileTypes:true});return(await Promise.all(es.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
let count=0;
for(const folder of ['public/src','functions','scripts','tests'])for(const f of await walk(path.join(root,folder))){
 if(!/\.(js|mjs)$/.test(f))continue;const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(1);}count++;
}
for(const f of ['public/audio/manifest.json','public/manifest.webmanifest','public/_routes.json','package.json'])JSON.parse(await readFile(path.join(root,f),'utf8'));
console.log(`Syntax checked ${count} JavaScript modules and 4 JSON files.`);
