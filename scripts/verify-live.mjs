import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decrypt} from '../src/crypto.mjs';
import {createHash} from 'node:crypto';
import {artworkForEdition} from '../src/artwork.mjs';
import {headerPhotosForEdition} from '../src/photography.mjs';

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
assert.ok(await decrypt(await encrypted.json(),password)===prepared,'Live edition must exactly match prepared data');
const current=JSON.parse(prepared);
const artworkPaths=new Set(current.photography?[]:[artworkForEdition(current.artwork).src]);
const old=await request('data/brief.json');
assert.equal(old.status,404,'Plaintext edition must not be publicly accessible');
const page=await request('./');assert.equal(page.status,200,'Newsletter must load');
const html=await page.text();assert.match(html,/class="locked"/);
assert.equal(html.includes(password),false,'Password must never appear in HTML');
const assets=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('./assets/')||x.startsWith('assets/'));
assert.ok(assets.length>=3,'Expected local script, styles, and icons');
for(const path of new Set(assets))assert.equal((await request(path)).status,200,`Asset must load: ${path}`);
const ar=await request('data/archive.enc.json');assert.equal(ar.status,200);
const liveIndex=JSON.parse(await decrypt(await ar.json(),password));
const localIndex=JSON.parse(await decrypt(JSON.parse(await readFile('dist/data/archive.enc.json','utf8')),password));
assert.deepEqual(liveIndex,localIndex,'Live archive index must match');
for(const entry of liveIndex.editions){
 assert.match(entry.day,/^\d{4}-\d{2}-\d{2}$/);assert.equal(entry.file,`editions/${entry.day}.enc.json`);
 const r=await request('data/'+entry.file);assert.equal(r.status,200);
 const liveText=await decrypt(await r.json(),password);
 assert.ok(liveText===await decrypt(JSON.parse(await readFile('dist/data/'+entry.file,'utf8')),password),'Historical edition must match');
 const historical=JSON.parse(liveText);
 if(!historical.photography)artworkPaths.add(artworkForEdition(historical.artwork).src);
 assert.equal((await request(`data/editions/${entry.day}.json`)).status,404);
}
for(const path of artworkPaths){
 const r=await request(path);assert.equal(r.status,200,'Edition artwork must load');
 const hash=data=>createHash('sha256').update(data).digest('hex');
 assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(await readFile('dist/'+path)),'Live artwork must match the prepared image');
}
if(current.photography){
 const photos=headerPhotosForEdition(current);assert.equal(photos.length,2,'Two real header photos required');
 for(const p of photos){const r=await fetch(p.src,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'Header photograph must load');assert.match(r.headers.get('content-type')||'',/^image\//,'Header must be an image');await r.body.cancel();}
}
const edition=JSON.parse(prepared);
console.log(`Verified encrypted live edition: ${edition.day}, generated ${edition.generatedAt}; plaintext endpoint absent, page assets, current photographs and legacy artwork verified.`);
