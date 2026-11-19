import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requestLive} from './live-request.mjs';
import {decrypt} from '../src/crypto.mjs';
import {artworkForEdition} from '../src/artwork.mjs';
import {headerPhotosForEdition} from '../src/photography.mjs';
import {hash, readJSON, atomicJSON, mapBounded, requestGate} from './workflow-utils.mjs';
import {verificationCheckpoint} from './verification-checkpoint.mjs';

const started = Date.now();
const {website} = await readJSON('config/publishing.json');
const {password} = await readJSON('config/security.local.json');
const prepared = await readFile('public/data/brief.json', 'utf8');
const current = JSON.parse(prepared);
const indexBytes = await readFile('dist/data/archive.enc.json');
const localIndex = JSON.parse(await decrypt(JSON.parse(indexBytes), password));
const currentBytes = await readFile('dist/data/brief.enc.json');
assert.equal(await decrypt(JSON.parse(currentBytes), password), prepared, 'Build must match the prepared edition');
const localHTML = await readFile('dist/index.html', 'utf8');
const published = await readJSON('.cache/publish-state.json', {});
const gate = requestGate();
let requests = 0, retries = 0;
const request = (path, options = {}) => requestLive(path, website, {
  ...options,
  fetcher: async (url, init) => { await gate.before(); requests++; return fetch(url, init); },
  onBackoff: ms => { retries++; gate.pause(ms); }
});
const bytes = async (path, options) => {
  const response = await request(path, options);
  try { assert.equal(response.status, 200, 'Required live resource must load'); return Buffer.from(await response.arrayBuffer()); }
  finally { if (!response.bodyUsed) await response.body?.cancel(); }
};
// These deployment anchors are always checked afresh, including resumed runs.
async function anchors() {
  assert.equal(await decrypt(JSON.parse(await bytes('data/brief.enc.json')), password), prepared, 'Live edition must exactly match prepared data');
  assert.deepEqual(JSON.parse(await decrypt(JSON.parse(await bytes('data/archive.enc.json')), password)), localIndex, 'Live archive index must match');
  const html = (await bytes('./')).toString();
  assert.equal(html, localHTML, 'Live page must match this build');
  assert.match(html, /class="locked"/); assert.equal(html.includes(password), false);
}
await anchors();
const tasks = [], manifest = [];
const add = (kind, path, digest, check) => { const key = hash(JSON.stringify([kind, path, digest])); manifest.push(key); tasks.push({key, kind, check}); };
const photos = new Set(), artwork = new Set();
const collectPhotos = edition => {
  if (!edition.photography) artwork.add(artworkForEdition(edition.artwork).src);
  for (const photo of headerPhotosForEdition(edition)) photos.add(photo.src);
};
collectPhotos(current);
for (const entry of localIndex.editions) {
  assert.match(entry.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(entry.file, `editions/${entry.day}.enc.json`);
  const path = 'data/' + entry.file, local = await readFile('dist/' + path);
  const text = await decrypt(JSON.parse(local), password), edition = JSON.parse(text);
  assert.equal(edition.day, entry.day); collectPhotos(edition);
  add('archive', path, hash(local), async () => assert.equal(await decrypt(JSON.parse(await bytes(path)), password), text, 'Historical edition must match'));
}
const assets = [...new Set([...localHTML.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x => x[1]).filter(x => x.startsWith('./assets/') || x.startsWith('assets/')))];
assert.ok(assets.length >= 3);
for (const path of new Set([...assets, ...artwork])) {
  const assetURL = new URL(path, website), baseURL = new URL(website);
  assert.ok(assetURL.origin === baseURL.origin && assetURL.pathname.startsWith(baseURL.pathname));
  const relativePath = decodeURIComponent(assetURL.pathname.slice(baseURL.pathname.length));
  assert.ok(relativePath.startsWith('assets/') && !relativePath.split('/').includes('..'));
  const expected = hash(await readFile('dist/' + relativePath));
  add('asset', path, expected, async () => assert.equal(hash(await bytes(path, {cacheBust: false})), expected, 'Live asset must match'));
}
for (const src of photos) {
  const url = new URL(src, website), base = new URL(website);
  const hosted = url.origin === base.origin && url.pathname.startsWith(base.pathname);
  let expected;
  if (hosted) {
    const path = decodeURIComponent(url.pathname.slice(base.pathname.length));
    assert.ok(path.startsWith('assets/') && !path.split('/').includes('..'));
    expected = hash(await readFile('dist/' + path));
  }
  add('photo', src, expected || 'external-image', async () => {
    const response = await request(src, {cacheBust: false});
    try {
      assert.equal(response.status, 200, 'Current or archived photo must load');
      assert.match(response.headers.get('content-type') || '', /^image\//);
      if (expected) assert.equal(hash(Buffer.from(await response.arrayBuffer())), expected, 'Live photo must match');
    } finally { if (!response.bodyUsed) await response.body?.cancel(); }
  });
}
const plaintext = ['data/brief.json', ...localIndex.editions.map(e => `data/editions/${e.day}.json`)];
for (const path of plaintext) add('privacy', path, 'canonical-404', async () => {
  const response = await request(path, {cacheBust: false});
  try { assert.equal(response.status, 404, 'Plaintext must return a real 404'); }
  finally { await response.body?.cancel(); }
});
if (current.photography) assert.equal(headerPhotosForEdition(current).length, current.photography.mode === 'atmosphere' ? 1 : 2);
const fingerprint = hash(JSON.stringify([website, published.commit, hash(currentBytes), hash(indexBytes), hash(localHTML), manifest]));
const checkpoint = await verificationCheckpoint('.cache/live-verification/checkpoint.local.json', fingerprint);
let checked = 0, resumed = 0;
await mapBounded(tasks, 2, async task => {
  if (checkpoint.has(task.key)) resumed++;
  else { await task.check(); await checkpoint.pass(task.key); }
  checked++;
  if (checked % 10 === 0 || checked === tasks.length) console.log(`Live checks: ${checked}/${tasks.length}; ${resumed} reused from this interrupted verification.`);
});
await anchors(); // A changed deployment during the scan cannot pass.
await checkpoint.complete();
const report = {version: 1, edition: current.day, commit: published.commit, checkedAt: new Date().toISOString(), seconds: +( (Date.now() - started) / 1000).toFixed(2), checks: tasks.length + 6, requests, retries, resumed, archives: localIndex.editions.length, plaintextURLsAbsent: plaintext.length};
await atomicJSON('.cache/live-verification/result.local.json', report);
console.log(`Verified encrypted live edition ${current.day}; ${report.archives} archives, ${plaintext.length} canonical plaintext 404s, page/assets/photos. ${report.seconds}s, ${requests} requests, ${retries} retries.`);
