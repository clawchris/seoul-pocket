import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTripKey,sealShared,openShared,tripAAD,b64} from '../public/src/crypto.js';
const salt=b64(new Uint8Array(24).fill(7));
test('shared records round-trip and are bound to their trip and record id',async()=>{
 const key=await deriveTripKey('group passphrase 2026',salt),value={name:'양꼬치',note:'late night',links:[]};
 const env=await sealShared(value,key,tripAAD('trip1','rec1'));
 assert.match(env,/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
 assert.deepEqual(await openShared(env,key,tripAAD('trip1','rec1')),value);
 await assert.rejects(openShared(env,key,tripAAD('trip1','rec2')),/could not be decrypted/);
 await assert.rejects(openShared(env,key,tripAAD('trip2','rec1')),/could not be decrypted/);
 const other=await deriveTripKey('a different passphrase',salt);
 await assert.rejects(openShared(env,other,tripAAD('trip1','rec1')),/passphrase/);
 await assert.rejects(deriveTripKey('short',salt),/12 to 256/);
});
