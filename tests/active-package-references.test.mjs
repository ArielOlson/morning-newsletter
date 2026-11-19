import test from 'node:test';
import assert from 'node:assert/strict';
import {activePackageReferences, assertActiveReferenceCoverage} from '../scripts/active-package-references.mjs';
import {createPackageQueue, extendReferenceCoverage, reviewEvidence, finalizeQueue} from '../scripts/package-queue.mjs';
import {emptyState} from '../src/sync.mjs';
import {historyId, shipmentIdentity} from '../src/history.mjs';
import {PACKAGE_DISCOVERY_QUERY} from '../scripts/package-scan.mjs';
const parcel = id => ({id,merchant:'Example',status:'delivered',updatedAt:'2026-11-18T12:00:00Z',orderNumber:'order-'+id});
async function choice(state, p, stage) {state.packages[await historyId('shipment',shipmentIdentity(p))] = {stage,shipment:p,changedAt:'2026-11-19T01:00:00Z'};}
test('only explicit finished choices omit extra queries; broad scans, baseline and retained returns survive', async () => {
  const state = emptyState(), finished = parcel('done'), delivered = parcel('delivered'), retained = parcel('return');
  await choice(state,finished,'received'); await choice(state,retained,'return');
  const before = JSON.stringify(state), active = await activePackageReferences([finished,delivered],state);
  assert.deepEqual(active.map(x=>x.id).sort(),['delivered','return']);
  const q = createPackageQueue(['a','b'],{shipments:[finished,delivered]},'2026-11-19',0,active);
  assert.equal(q.baseline.length,2); assert.equal(JSON.stringify(state),before);
  for(const a of q.accounts){assert.equal(a.searches[0].query,PACKAGE_DISCOVERY_QUERY);assert.ok(!a.searches.slice(1).some(x=>x.query.includes('order-done')));assert.ok(a.searches[1].query.includes('order-return'));}
  reviewEvidence(q,{shipments:[]}); assert.equal(q.accounts[0].searches.length,2,'Reviewing unrelated mail does not reopen all closed orders');
  const searched = {shipments:q.baseline,scanAccounts:q.accounts.map(a=>({...a,searches:a.searches.map(s=>({...s,complete:true}))}))};
  await assertActiveReferenceCoverage(searched,state);
  await choice(state,finished,'incoming');
  await assert.rejects(assertActiveReferenceCoverage(searched,state),/reopened/);
  assert.equal(extendReferenceCoverage(q, await activePackageReferences(q.baseline,state)),1);
  assert.ok(q.accounts.every(a=>a.searches.at(-1).query.includes('order-done')));
  assert.throws(()=>finalizeQueue(q,['a','b'],100),'Undo requires complete reference coverage before finalization');
});
test('new message references still expand both accounts even after active filtering', () => {
  const q = createPackageQueue(['a','b'],{shipments:[parcel('closed')]},'2026-11-19',0,[]);
  reviewEvidence(q,{shipments:[parcel('new')]});
  assert.ok(q.accounts.every(a=>a.searches.length===2&&a.searches[1].query.includes('order-new')));
  assert.equal(q.baseline.length,2);
});
