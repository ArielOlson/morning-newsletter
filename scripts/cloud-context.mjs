import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile, readdir, lstat, mkdir, open} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {encrypt, decrypt} from '../src/crypto.mjs';

export const operationsRepository = 'ArielOlson/morning-newsletter-operations';
export const contextFile = 'operations.enc.json';
export const contextPaths = [
  'config/calendar.local.json', 'config/connections.local.json',
  'config/calendar-snapshot.local.json', 'config/deliveries.local.json',
  'config/events.local.json', 'config/ideas.local.json',
  'config/interests.local.json', 'config/finance.local.json',
  '.cache/gmail-queue.local.json', '.cache/publish-state.json',
  '.cache/live-verification/result.local.json', 'public/data/brief.json'
];
const allowed = path => contextPaths.includes(path) || /^\.cache\/prepared\/\d{4}-\d{2}-\d{2}\/research\.local\.json$/.test(path);
const forbiddenKeys = /^(password|access_?token|refresh_?token|client_?secret|authorization|rawMail|rawMessage|bodyHtml)$/i;
function inspect(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbiddenKeys.test(key), 'Credentials and raw mail cannot enter the working-data bundle');
    inspect(child);
  }
}
export function validateContext(bundle) {
  assert.equal(bundle?.version, 1, 'Unsupported working-data bundle');
  assert.equal(bundle.kind, 'morning-edit-private-operations');
  assert.ok(Number.isFinite(Date.parse(bundle.createdAt)) && Date.parse(bundle.createdAt) <= Date.now(), 'Invalid bundle timestamp');
  assert.ok(bundle.files && typeof bundle.files === 'object' && !Array.isArray(bundle.files));
  const entries = Object.entries(bundle.files);
  assert.ok(entries.length > 0 && entries.length <= 100, 'Unexpected working-data file count');
  let bytes = 0;
  for (const [path, value] of entries) {
    assert.ok(allowed(path), 'Unexpected file in private working-data bundle');
    assert.equal(typeof value, 'string');
    bytes += Buffer.byteLength(value);
    inspect(JSON.parse(value));
  }
  assert.ok(bytes <= 20_000_000, 'Working-data bundle is too large');
  return bundle;
}
async function safePath(root, path) {
  const absolute = resolve(root, path);
  assert.ok(relative(resolve(root), absolute) === path, 'Unsafe working-data path');
  let current = resolve(root);
  for (const part of path.split('/')) {
    current = join(current, part);
    try { assert.ok(!(await lstat(current)).isSymbolicLink(), 'Private working-data paths cannot be symlinks'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}
export async function packContext(root, password) {
  assert.ok(typeof password === 'string' && password.length, 'Newsletter secret is missing');
  const paths = [...contextPaths];
  try {
    for (const day of await readdir(join(root, '.cache/prepared'))) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) paths.push('.cache/prepared/' + day + '/research.local.json');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = {};
  for (const path of paths) {
    try { files[path] = await readFile(await safePath(root, path), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const bundle = validateContext({version: 1, kind: 'morning-edit-private-operations', createdAt: new Date().toISOString(), files});
  const text = JSON.stringify(bundle);
  assert.ok(!text.includes(password), 'The newsletter secret cannot enter the working-data bundle');
  return {envelope: await encrypt(text, password), fileCount: Object.keys(files).length};
}
export async function restoreContext(root, envelope, password) {
  const bundle = validateContext(JSON.parse(await decrypt(envelope, password)));
  const pending = [];
  // Check the whole transfer before writing anything. Existing different files
  // require reconciliation; cloud restore never resets a working copy.
  for (const [path, text] of Object.entries(bundle.files)) {
    const absolute = await safePath(root, path);
    try { assert.equal(await readFile(absolute, 'utf8'), text, 'Existing private working data differs; reconcile before restoring'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      pending.push({absolute, text});
    }
  }
  for (const {absolute, text} of pending) {
    await mkdir(dirname(absolute), {recursive: true});
    const file = await open(absolute, 'wx', 0o600);
    try { await file.writeFile(text); } finally { await file.close(); }
  }
  return {fileCount: Object.keys(bundle.files).length, restored: pending.length, createdAt: bundle.createdAt};
}

export async function readRepositoryFile(api, metadata) {
  assert.ok(/^[a-f0-9]{40}$/.test(metadata?.sha || ''), 'Invalid private file identity');
  assert.ok(metadata.size > 0 && metadata.size <= 30_000_000, 'Unexpected private file size');
  const blob = metadata.encoding === 'base64' && metadata.content
    ? metadata : await api('repos/' + operationsRepository + '/git/blobs/' + metadata.sha);
  assert.equal(blob.sha, metadata.sha, 'Private file changed');
  assert.equal(blob.encoding, 'base64', 'Private file contents unavailable');
  const bytes = Buffer.from(blob.content, 'base64');
  assert.equal(bytes.length, metadata.size, 'Incomplete private file');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, metadata.sha, 'Private file integrity mismatch');
  return bytes.toString('utf8');
}
