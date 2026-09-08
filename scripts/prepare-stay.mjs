/** Run deliberately to replace the encrypted first-use seed. Never called by npm run build. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {seal} from '../public/src/crypto.js';
const root=path.resolve(import.meta.dirname,'..');
const source=JSON.parse(await readFile(path.join(root,'private/stay-source.json'),'utf8'));
if(!source.addressKo||typeof source.lat!=='number'||typeof source.lng!=='number')throw new Error('A checked Korean address and coordinates are required.');
if(source.pin||source.wifiPassword)throw new Error('Do not distribute access PINs or Wi-Fi passwords in a first-use seed. Enter them locally.');
const key=process.env.STAY_SETUP_PASSPHRASE||('Seoul-'+randomBytes(18).toString('base64url'));
const seed={id:'guui-stay-v2',envelope:await seal(source,key,'stay')};
await writeFile(path.join(root,'public/src/stay-seed.js'),'// Encrypted first-use address only. The passphrase is outside the web build.\nexport const STAY_SEED='+JSON.stringify(seed,null,2)+';\n');
await mkdir(path.join(root,'private'),{recursive:true});
await writeFile(path.join(root,'private/OWNER_SETUP.md'),`# Private stay setup\n\nDo not publish this file or the private folder. Do not paste this passphrase into GitHub, Cloudflare variables, source code, or a public support issue.\n\n## One-time setup on a new phone\nOpen **Our stay → Load preconfigured stay** and enter this setup/vault passphrase:\n\n\
\
${key}\n\nThe supplied exact address and coordinates are already encrypted in the application seed. The same passphrase unlocks the local vault until you change it with **Edit stay**. Save it in your password manager. Each phone has its own local data.\n\nThe seed contains no door PIN, unit, Wi-Fi password, host identity or dates. Enter those only inside the app. Existing stays are never replaced automatically. To merge this address into an existing stay, unlock it, use **Use supplied address**, enter the setup passphrase, then explicitly save the edited vault; your other fields remain.\n\n## Supplied address\n${source.addressEn}\n\n${source.addressKo}\n\nLatitude: ${source.lat}\nLongitude: ${source.lng}\n\nPublish only dist/ through the supported Pages workflow, keeping functions/ at repository root for Functions deployment. Do not deploy private/, docs/, qa/, this ZIP, or the repository root as your static site. The build checks that the address and setup passphrase are absent in plaintext from dist/.\n\nRegenerating with npm run prepare:stay changes the seed and key for future setup only. It does not migrate existing encrypted vaults. Keep this package private even after changing a local vault passphrase because its original seed remains decryptable with this key.\n`);
console.log('Prepared encrypted first-use stay. Setup instructions written to private/OWNER_SETUP.md. No secrets printed.');
