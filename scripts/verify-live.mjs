import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decrypt} from '../src/crypto.mjs';

const {website}=JSON.parse(await readFile('config/publishing.json','utf8'));
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const prepared=await readFile('public/data/brief.json','utf8');
const nonce=Date.now();
async function request(path){
  const url=new URL(path,website);url.searchParams.set('verify',nonce);
  return fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
}
const encrypted=await request('data/brief.enc.json');
assert.equal(encrypted.status,200,'Encrypted edition must load');
assert.equal(await decrypt(await encrypted.json(),password),prepared,'Live edition must exactly match prepared data');
const old=await request('data/brief.json');
assert.equal(old.status,404,'Plaintext edition must not be publicly accessible');
const page=await request('./');assert.equal(page.status,200,'Newsletter must load');
const html=await page.text();assert.match(html,/class="locked"/);
assert.equal(html.includes(password),false,'Password must never appear in HTML');
const assets=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('./assets/')||x.startsWith('assets/'));
assert.ok(assets.length>=3,'Expected local script, styles, and icons');
for(const path of new Set(assets))assert.equal((await request(path)).status,200,`Asset must load: ${path}`);
const edition=JSON.parse(prepared);
console.log(`Verified encrypted live edition: ${edition.day}, generated ${edition.generatedAt}; plaintext endpoint absent and page assets load.`);
