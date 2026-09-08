/** Browser-native encryption. AAD separates a stay vault from an exported backup. */
const enc=new TextEncoder(), dec=new TextDecoder();
const ITERATIONS=600000;
function b64(bytes) { let s=''; for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384)); return btoa(s); }
function unb64(s) { if(typeof s!=='string'||s.length>32*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new Error('Invalid encrypted file.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
async function keyFor(passphrase,salt,iterations) {
  const material=await crypto.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function seal(value,passphrase,purpose='stay') {
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256) throw new Error('Use a passphrase of 12 to 256 characters, not your door PIN.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFor(passphrase,salt,ITERATIONS);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('seoul-pocket:v1:'+purpose)},key,enc.encode(JSON.stringify(value)));
  return {v:1,algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,purpose,salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))};
}
export function validEnvelope(x,purpose) {
  if(!x||x.v!==1||x.algorithm!=='AES-GCM'||x.kdf!=='PBKDF2-SHA256'||x.iterations!==ITERATIONS||x.purpose!==purpose)throw new Error('Unsupported encrypted file.');
  if(unb64(x.salt).length!==16||unb64(x.iv).length!==12||unb64(x.cipher).length<16)throw new Error('Invalid encrypted file.');return x;
}
export async function unseal(envelope,passphrase,purpose='stay') {
  validEnvelope(envelope,purpose);
  if(typeof passphrase!=='string'||passphrase.length>256)throw new Error('Invalid passphrase.');
  try {
    const key=await keyFor(passphrase,unb64(envelope.salt),envelope.iterations);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:enc.encode('seoul-pocket:v1:'+purpose)},key,unb64(envelope.cipher));
    return JSON.parse(dec.decode(plain));
  } catch {throw new Error('Could not unlock. Check your passphrase or restore an undamaged backup.');}
}
export { b64, unb64 };
