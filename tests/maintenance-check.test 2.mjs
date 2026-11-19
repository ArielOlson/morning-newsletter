import test from 'node:test'; import assert from 'node:assert/strict';
import {encrypt} from '../src/crypto.mjs';import {assertMaintenanceEdition} from '../scripts/maintenance-check.mjs';
test('maintenance accepts identical content but cannot publish a new or modified edition',async()=>{
 const password='test-only-password',prepared='{"day":"2026-11-18","generatedAt":"original"}';
 const files={'brief.enc.json':JSON.stringify(await encrypt(prepared,password)),'archive.enc.json':JSON.stringify(await encrypt(JSON.stringify({editions:[{day:'2026-11-18',file:'editions/2026-11-18.enc.json'}]}),password))};files['editions/2026-11-18.enc.json']=files['brief.enc.json'];
 const read=async path=>files[path];await assertMaintenanceEdition({prepared,password,local:read,published:read});
 await assert.rejects(assertMaintenanceEdition({prepared:prepared.replace('original','fresh'),password,local:read,published:read}),/preserve/);
 const changed={...files,'editions/2026-11-18.enc.json':JSON.stringify(await encrypt('changed archive',password))};
 await assert.rejects(assertMaintenanceEdition({prepared,password,local:async path=>changed[path],published:read}),/historical/);
});
