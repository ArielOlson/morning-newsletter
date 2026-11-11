import assert from 'node:assert/strict';
import {requestLive} from './live-request.mjs';
import {readFile} from 'node:fs/promises';
import {decrypt} from '../src/crypto.mjs';
import {createHash} from 'node:crypto';
import {artworkForEdition} from '../src/artwork.mjs';
import {headerPhotosForEdition} from '../src/photography.mjs';

const {website}=JSON.parse(await readFile('config/publishing.json','utf8'));
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const prepared=await readFile('public/data/brief.json','utf8');
// Pace the archive walk and release status-only responses so CDN errors do not
// leave unread bodies/connections accumulating during verification.
let lastRequest=0;
const request=async(path,options)=>{const delay=750-(Date.now()-lastRequest);if(delay>0)await new Promise(r=>setTimeout(r,delay));lastRequest=Date.now();return requestLive(path,website,options);};
const expectStatus=async(path,status,message,options)=>{const r=await request(path,options);try{assert.equal(r.status,status,message);}finally{await r.body?.cancel();}};
const encrypted=await request('data/brief.enc.json');
assert.equal(encrypted.status,200,'Encrypted edition must load');
assert.ok(await decrypt(await encrypted.json(),password)===prepared,'Live edition must exactly match prepared data');
const current=JSON.parse(prepared);
const artworkPaths=new Set(current.photography?[]:[artworkForEdition(current.artwork).src]);
const photoPaths=new Set(headerPhotosForEdition(current).map(p=>p.src));
await expectStatus('data/brief.json',404,'Plaintext edition must not be publicly accessible',{cacheBust:false});
const page=await request('./');assert.equal(page.status,200,'Newsletter must load');
const html=await page.text();assert.match(html,/class="locked"/);
assert.equal(html.includes(password),false,'Password must never appear in HTML');
const assets=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('./assets/')||x.startsWith('assets/'));
assert.ok(assets.length>=3,'Expected local script, styles, and icons');
for(const path of new Set(assets))await expectStatus(path,200,`Asset must load: ${path}`);
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
 for(const p of headerPhotosForEdition(historical))photoPaths.add(p.src);
 await expectStatus(`data/editions/${entry.day}.json`,404,`Plaintext archive must return 404: ${entry.day}`,{cacheBust:false});
}
for(const path of artworkPaths){
 const r=await request(path);assert.equal(r.status,200,'Edition artwork must load');
 const hash=data=>createHash('sha256').update(data).digest('hex');
 assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(await readFile('dist/'+path)),'Live artwork must match the prepared image');
}
if(current.photography){const photos=headerPhotosForEdition(current);assert.equal(photos.length,current.photography.mode==='atmosphere'?1:2,'The edition must have its expected real header photography');}
for(const src of photoPaths){
 const url=new URL(src,website),base=new URL(website),r=await request(url.href);
 assert.equal(r.status,200,`Current or archived header photograph must load: ${url.pathname}`);
 assert.match(r.headers.get('content-type')||'',/^image\//,'Header must be an image');
 if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)){
  const path=decodeURIComponent(url.pathname.slice(base.pathname.length));
  assert.ok(path.startsWith('assets/')&&!path.split('/').includes('..'),'Safe local photo path');
  const hash=data=>createHash('sha256').update(data).digest('hex');
  assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(await readFile('dist/'+path)),'Live header photograph must match the prepared image');
 }else await r.body.cancel();
}
const edition=JSON.parse(prepared);
console.log(`Verified encrypted live edition: ${edition.day}, generated ${edition.generatedAt}; plaintext endpoint absent, page assets, current and archived photographs and legacy artwork verified.`);
