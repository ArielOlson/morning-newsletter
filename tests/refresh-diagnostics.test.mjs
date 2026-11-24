import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshFailureDiagnostic} from '../scripts/refresh-diagnostics.mjs';
test('refresh diagnostic preserves a wrapped Git timeout without private arguments or output', () => {
  const secret = 'private-password-calendar-feed-and-edition';
  const failure = Object.assign(new Error(secret), {code:'ETIMEDOUT',path:'/usr/bin/git',spawnargs:['ls-tree',secret],stdout:secret,stderr:secret,signal:'SIGTERM'});
  const report = refreshFailureDiagnostic(new Error('history wrapper', {cause:failure}), 'recommendation-history', new Date('2026-11-23T20:30:00Z'));
  assert.equal(report.phase, 'recommendation-history');
  assert.deepEqual(report.errors[1], {name:'Error',code:'ETIMEDOUT',signal:'SIGTERM',operation:'git ls-tree'});
  assert.ok(!JSON.stringify(report).includes(secret));
});
test('refresh diagnostic permits only known history assertions, never assertion payloads', () => {
  const failure = Object.assign(new Error('Live edition differs from the published commit\nprivate actual and expected'), {name:'AssertionError',code:'ERR_ASSERTION',actual:{private:'secret'},expected:{private:'value'}});
  const report = refreshFailureDiagnostic(failure, 'recommendation-history');
  assert.equal(report.errors[0].check, 'Live edition differs from the published commit');
  assert.ok(!JSON.stringify(report).includes('private'));
  assert.equal(refreshFailureDiagnostic(new Error('https://private.example/token'), 'secret-phase').phase, 'unknown');
});
test('refresh diagnostic bounds cyclic causes and rejects unknown metadata', () => {
  const failure = Object.assign(new Error('secret'), {name:'secret',code:'secret',path:'secret',signal:'secret'});failure.cause=failure;
  assert.deepEqual(refreshFailureDiagnostic(failure, 'configuration').errors, [{name:'Error'}]);
});
