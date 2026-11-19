import assert from 'node:assert/strict';
import {decrypt} from '../src/crypto.mjs';
// Maintenance can change code, never edition content, freshness, or archive membership.
export async function assertMaintenanceEdition({prepared, password, local, published}) {
  assert.equal(await decrypt(JSON.parse(await published('brief.enc.json')), password), prepared, 'Maintenance must preserve the published edition exactly');
  assert.equal(await decrypt(JSON.parse(await local('brief.enc.json')), password), prepared, 'Maintenance build must preserve the edition');
  const current = JSON.parse(await decrypt(JSON.parse(await local('archive.enc.json')), password));
  const baseline = JSON.parse(await decrypt(JSON.parse(await published('archive.enc.json')), password));
  assert.deepEqual(current, baseline, 'Maintenance must preserve archive membership and dates');
  for (const entry of baseline.editions) {
    assert.match(entry.day, /^\d{4}-\d{2}-\d{2}$/); assert.equal(entry.file, `editions/${entry.day}.enc.json`);
    assert.equal(await decrypt(JSON.parse(await local(entry.file)), password), await decrypt(JSON.parse(await published(entry.file)), password), 'Maintenance must preserve every historical edition');
  }
}
