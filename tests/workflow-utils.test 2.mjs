import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mapBounded, requestGate, sleep} from '../scripts/workflow-utils.mjs';
import {verificationCheckpoint} from '../scripts/verification-checkpoint.mjs';
test('bounded workers never exceed two and finish in-flight work before rejecting', async () => {
  let active = 0, peak = 0, completed = 0;
  await assert.rejects(mapBounded([0,1,2,3,4], 2, async i => {
    active++; peak = Math.max(peak, active);
    try { await sleep(i ? 15 : 1); if (i === 0) throw Error('stop'); completed++; }
    finally { active--; }
  }), /stop/);
  assert.equal(peak, 2); assert.equal(active, 0); assert.equal(completed, 1);
});
test('website gate applies a shared backoff to later requests', async () => {
  let time = 0; const waits = [];
  const gate = requestGate({interval: 250, now: () => time, wait: async ms => { waits.push(ms); time += ms; }});
  await gate.before(); gate.pause(30000);
  await Promise.all([gate.before(), gate.before()]);
  assert.deepEqual(waits, [30000, 250]);
});
test('verification resumes only recent checks for the exact build and never completed runs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'morning-checkpoint-')), path = join(dir, 'check.json'); let time = 1000;
  try {
    let c = await verificationCheckpoint(path, 'build-a', {now: () => time});
    await Promise.all([c.pass('archive-a'), c.pass('privacy-a')]);
    c = await verificationCheckpoint(path, 'build-a', {now: () => time}); assert.ok(c.has('archive-a') && c.has('privacy-a'));
    assert.equal((await verificationCheckpoint(path, 'build-b', {now: () => time})).has('archive-a'), false);
    time += 16 * 60000;
    assert.equal((await verificationCheckpoint(path, 'build-a', {now: () => time})).has('archive-a'), false);
    c = await verificationCheckpoint(path, 'build-c', {now: () => time}); await c.pass('one'); await c.complete();
    assert.equal((await verificationCheckpoint(path, 'build-c', {now: () => time})).has('one'), false);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
