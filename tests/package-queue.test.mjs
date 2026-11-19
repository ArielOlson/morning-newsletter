import test from 'node:test'; import assert from 'node:assert/strict';
import {createPackageQueue, queueNext, claimRequest, recordResult, reviewEvidence, finalizeQueue, referenceQueries} from '../scripts/package-queue.mjs';
const make = () => createPackageQueue(['a','b'], {shipments: []}, '2026-11-19', 0);
test('global Gmail pacing, pagination and restart preserve completed work', () => {
  let q = make(), next = claimRequest(q, 0);
  recordResult(q, {requestId: next.request.id, messageIds: ['one'], nextPageToken: 'p2'}, 100);
  assert.equal(queueNext(q, 15099).state, 'waiting');
  q = JSON.parse(JSON.stringify(q)); next = claimRequest(q, 15100);
  assert.equal(next.request.pageToken, 'p2');
  recordResult(q, {requestId: next.request.id, messageIds: ['two']}, 15200);
  next = claimRequest(q, 30200); assert.equal(next.request.account, 'b');
  assert.equal(q.accounts[0].searches[0].pages.length, 2);
});
test('rate limits stop both accounts, honor Retry-After and allow one retry', () => {
  const q = make(), first = claimRequest(q, 0);
  recordResult(q, {requestId: first.request.id, error: 'RATE_LIMIT_EXCEEDED', retryAfter: '120'}, 100);
  assert.equal(queueNext(q, 120099).state, 'waiting');
  const retry = claimRequest(q, 120100); assert.equal(retry.request.id, first.request.id);
  recordResult(q, {requestId: retry.request.id, error: 'RATE_LIMIT_EXCEEDED'}, 120200);
  assert.equal(queueNext(q, 9999999).state, 'blocked'); assert.equal(q.interval, 30000);
});
test('incomplete accounts and unreviewed candidates cannot finalize; exclusions stay minimal', () => {
  const q = make(); assert.throws(() => finalizeQueue(q, ['a','b'], 100));
  let next = claimRequest(q, 0); recordResult(q, {requestId: next.request.id, messageIds: ['one']}, 1);
  next = claimRequest(q, 15001); recordResult(q, {requestId: next.request.id, messageIds: []}, 15002);
  assert.throws(() => finalizeQueue(q, ['a','b'], 30000));
  reviewEvidence(q, {accounts: [{account: 'a', reviews: [{messageId: 'one', excludedReason: 'Digital receipt; no shipment', body: 'MUST NOT SAVE'}]}]});
  const saved = finalizeQueue(q, ['a','b'], 30000); assert.equal(JSON.stringify(saved).includes('MUST NOT SAVE'), false);
});
test('already reviewed immutable IDs are reused; references have no arbitrary date cutoff', () => {
  const q = createPackageQueue(['a'], {shipments: [], scanAccounts: [{account: 'a', readIds: [], reviews: [{messageId: 'old', excludedReason: 'Promotional message only'}]}]}, '2026-11-19', 0);
  const next = claimRequest(q, 0); recordResult(q, {requestId: next.request.id, messageIds: ['old']}, 1);
  assert.equal(queueNext(q, 15001).state, 'ready-to-finalize');
  assert.deepEqual(referenceQueries([{orderNumber: '123', trackingNumber: '456'}]), ['{"123" "456"}']);
});

test('late results cannot be attributed to a different page or a new scan',()=>{
 const q=make(),first=claimRequest(q,0);recordResult(q,{requestId:first.request.id,messageIds:['a'],nextPageToken:'next'},1);const second=claimRequest(q,15001);
 assert.notEqual(first.request.id,second.request.id);assert.throws(()=>recordResult(q,{requestId:first.request.id,messageIds:['wrong']},15002),/claimed request/);
 assert.notEqual(claimRequest(make(),0).request.id,first.request.id);
});

test('newly discovered order references reopen coverage across both accounts',()=>{
 const q=make();let request=claimRequest(q,0).request;recordResult(q,{requestId:request.id,messageIds:[]},1);request=claimRequest(q,15001).request;recordResult(q,{requestId:request.id,messageIds:[]},15002);
 reviewEvidence(q,{shipments:[{id:'parcel',merchant:'Example',status:'shipped',updatedAt:'2026-11-19T10:00:00Z',orderNumber:'ORDER-NEW'}]});
 assert.equal(q.accounts[0].searches.length,2);assert.equal(q.accounts[1].searches.length,2);assert.throws(()=>finalizeQueue(q,['a','b'],30000));
});
