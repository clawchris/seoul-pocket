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
// A source rule, not a test, because the reason is a design preference rather than a behaviour. ui.js states it: small finite
// choices use visible radio chips instead of hidden dropdown menus, so every option is readable without a tap. Use choice() from ui.js.
let checkedUI=0;
for(const f of await walk(path.join(root,'public/src'))){
 if(!/\.js$/.test(f))continue;checkedUI++;
 if((await readFile(f,'utf8')).includes('<select'))throw new Error(`${path.relative(root,f)} renders a <select>. Small finite choices use visible radio chips instead of hidden dropdown menus (see the choice() helper and its note in public/src/ui.js), so every option stays readable without a tap.`);
}
console.log(`Syntax checked ${count} JavaScript modules and 4 JSON files. No dropdown menus in ${checkedUI} front-end modules.`);
