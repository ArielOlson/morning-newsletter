import test from 'node:test';
import assert from 'node:assert/strict';
import {encrypt,decrypt} from '../src/crypto.mjs';
const password=crypto.randomUUID()+crypto.randomUUID(),plain=JSON.stringify({calendar:{events:[{title:'PRIVATE CANARY MEETING'}]},deliveries:{tracking:'PRIVATE TRACKING CANARY'}});
test('encrypted payload only unlocks with the correct password',async()=>{const e=await encrypt(plain,password);assert.equal(JSON.stringify(e).includes('PRIVATE'),false);assert.equal(await decrypt(e,password),plain);await assert.rejects(decrypt(e,password+'wrong'));});
test('tampered ciphertext is rejected and every build uses fresh randomness',async()=>{const a=await encrypt(plain,password),b=await encrypt(plain,password);assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);const raw=Uint8Array.from(atob(a.ciphertext),x=>x.charCodeAt(0));raw[0]^=1;a.ciphertext=btoa(String.fromCharCode(...raw));await assert.rejects(decrypt(a,password));});
test('unexpected encryption parameters fail closed',async()=>{const e=await encrypt(plain,password);await assert.rejects(decrypt({...e,iterations:1},password));await assert.rejects(decrypt({...e,version:2},password));});
