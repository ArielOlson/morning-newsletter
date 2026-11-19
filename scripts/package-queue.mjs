import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {PACKAGE_DISCOVERY_QUERY, PACKAGE_SCAN_VERSION, assertPackageScan, mergePackageEvidence} from './package-scan.mjs';
import {hash} from './workflow-utils.mjs';
import {retryDelay} from './retry-policy.mjs';

export function referenceQueries(shipments) {
  const values = [...new Set(shipments.flatMap(s => [s.orderNumber, s.trackingNumber]).filter(Boolean).map(String))];
  const groups = []; let group = [], length = 0;
  for (const value of values) {
    // Exact quoted references; reject query syntax instead of silently altering an identity.
    assert.ok(!/["\r\n]/.test(value) && value.length <= 160, 'Review an invalid shipment reference');
    if (group.length === 12 || length + value.length > 1200) { groups.push('{'+group.join(' ')+'}'); group = []; length = 0; }
    group.push('"'+value+'"'); length += value.length + 3;
  }
  if (group.length) groups.push('{'+group.join(' ')+'}');
  return groups;
}
export function createPackageQueue(accounts, previous, day, now = Date.now()) {
  assert.ok(accounts.length && new Set(accounts).size === accounts.length);
  const searches = [PACKAGE_DISCOVERY_QUERY, ...referenceQueries(previous.shipments || [])];
  const queues = accounts.map(account => {
    const prior = previous.scanAccounts?.find(a => a.account === account);
    return {account, readIds: [...(prior?.readIds || [])], reviews: structuredClone(prior?.reviews || []), searches: []};
  });
  // Broad searches in every account first, then reference groups. No category/domain filters.
  searches.forEach(query => queues.forEach(a => a.searches.push({id: hash(JSON.stringify([a.account, query])), query, pages: [], complete: false, failures: 0})));
  return {version: 1, runId: randomUUID(), scope: previous.scope || 'All configured email accounts', day, startedAt: new Date(now).toISOString(), interval: 15000, readyAt: now, accounts: queues, inFlight: null, references: [...new Set((previous.shipments || []).flatMap(s => [s.orderNumber,s.trackingNumber]).filter(Boolean).map(String))], baseline: structuredClone(previous.shipments || [])};
}
export function queueNext(queue, now = Date.now()) {
  if (queue.blocked) return {state: 'blocked', reason: queue.blocked};
  if (queue.inFlight) return {state: 'awaiting-result', request: queue.inFlight};
  if (queue.readyAt > now) return {state: 'waiting', readyAt: new Date(queue.readyAt).toISOString(), waitMs: queue.readyAt - now};
  const max = Math.max(...queue.accounts.map(a => a.searches.length));
  for (let i = 0; i < max; i++) for (const a of queue.accounts) {
    const search = a.searches[i];
    if (search && !search.complete) return {state: 'ready', request: {type: 'search', account: a.account, id: hash(JSON.stringify([queue.runId,search.id,search.nextPageToken||''])), searchId: search.id, query: search.query, ...(search.nextPageToken ? {pageToken: search.nextPageToken} : {})}};
  }
  for (const a of queue.accounts) {
    const reviewed = new Set(a.reviews.map(r => r.messageId)), read = new Set(a.readIds);
    const ids = [...new Set(a.searches.flatMap(q => q.pages.flatMap(p => p.messageIds)))];
    const pending = ids.filter(id => !read.has(id) && !reviewed.has(id));
    if (pending.length) return {state: 'ready', request: {type: 'read', account: a.account, id: hash(JSON.stringify([queue.runId, a.account, pending.slice(0, 10)])), messageIds: pending.slice(0, 10)}};
  }
  const missing = queue.accounts.map(a => ({account: a.account, messageIds: [...new Set(a.searches.flatMap(q => q.pages.flatMap(p => p.messageIds)))].filter(id => !a.reviews.some(r => r.messageId === id))})).filter(a => a.messageIds.length);
  return missing.length ? {state: 'needs-review', accounts: missing} : {state: 'ready-to-finalize'};
}
export function claimRequest(queue, now = Date.now()) {
  const next = queueNext(queue, now);
  if (next.state === 'ready') queue.inFlight = {...next.request, claimedAt: now, failures: queue.failures?.[next.request.id] || 0};
  return next;
}
export function recordResult(queue, result, now = Date.now()) {
  const request = queue.inFlight;
  assert.ok(request && result.requestId === request.id, 'Result must match the claimed request');
  const account = queue.accounts.find(a => a.account === request.account);
  queue.failures ||= {};
  if (result.error) {
    const failures = (queue.failures[request.id] || 0) + 1;
    queue.failures[request.id] = failures;
    const throttled = result.error === 'RATE_LIMIT_EXCEEDED';
    if (throttled) queue.interval = 30000;
    queue.readyAt = now + retryDelay(result.retryAfter, {now, minimum: throttled ? 60000 : queue.interval});
    queue.inFlight = null;
    if (failures >= 2) queue.blocked = 'A request failed after its one retry. Previous complete snapshot retained.';
    return;
  }
  if (request.type === 'search') {
    assert.ok(Array.isArray(result.messageIds) && result.messageIds.every(id => typeof id === 'string' && id.length), 'Missing search message IDs');
    assert.ok(!result.truncated, 'Split a capped query; incomplete results cannot be accepted');
    const search = account.searches.find(q => q.id === request.searchId);
    const token = request.pageToken || '';
    assert.ok(!search.pages.some(p => p.token === token), 'Search page already recorded');
    assert.ok(!result.nextPageToken || (result.nextPageToken !== token && !search.pages.some(p => p.token === result.nextPageToken)), 'Repeated page token');
    search.pages.push({token, messageIds: [...new Set(result.messageIds)], checkedAt: new Date(now).toISOString()});
    search.nextPageToken = result.nextPageToken || null;
    search.complete = !search.nextPageToken;
  } else {
    assert.deepEqual([...new Set(result.messageIds)].sort(), [...request.messageIds].sort(), 'Read response omitted a requested message');
    account.readIds = [...new Set([...account.readIds, ...result.messageIds])];
  }
  delete queue.failures[request.id];
  queue.inFlight = null; queue.readyAt = now + queue.interval;
}
export function reviewEvidence(queue, evidence) {
  for (const a of evidence.accounts || []) {
    const account = queue.accounts.find(x => x.account === a.account); assert.ok(account, 'Unknown review account');
    const candidates = new Set(account.searches.flatMap(q => q.pages.flatMap(p => p.messageIds)));
    const reviews = new Map(account.reviews.map(r => [r.messageId, r]));
    for (const review of a.reviews || []) {
      assert.ok(candidates.has(review.messageId), 'Review is outside this scan');
      assert.ok(review.shipmentIds?.length || typeof review.excludedReason === 'string' && review.excludedReason.trim().length >= 8, 'Specific review required');
      // Retain minimal dispositions only, never bodies or attachments.
      reviews.set(review.messageId, {messageId: review.messageId, ...(review.shipmentIds?.length ? {shipmentIds: review.shipmentIds} : {excludedReason: review.excludedReason})});
    }
    account.reviews = [...reviews.values()];
  }
  queue.baseline = mergePackageEvidence(queue.baseline, evidence.shipments || []);
  const references = [...new Set(queue.baseline.flatMap(s => [s.orderNumber,s.trackingNumber]).filter(Boolean).map(String))];
  const added = references.filter(value => !queue.references.includes(value));
  for (const query of referenceQueries(added.map(orderNumber => ({orderNumber})))) for (const account of queue.accounts) {
    if (!account.searches.some(q => q.query === query)) account.searches.push({id: hash(JSON.stringify([account.account,query])), query, pages: [], complete: false, failures: 0});
  }
  queue.references = references;
}
export function finalizeQueue(queue, expectedAccounts, now = Date.now()) {
  assert.ok(!queue.blocked && !queue.inFlight && !queue.completedAt, 'Incomplete or already finalized package scan');
  const snapshot = {scope: queue.scope, scanVersion: PACKAGE_SCAN_VERSION, checkedAt: new Date(now).toISOString(), scanAccounts: queue.accounts.map(a => ({account: a.account, readIds: a.readIds, reviews: a.reviews, searches: a.searches.map(q => ({query: q.query, complete: q.complete, ...(q.nextPageToken ? {nextPageToken: q.nextPageToken} : {}), checkedAt: q.pages.at(-1)?.checkedAt, messageIds: [...new Set(q.pages.flatMap(p => p.messageIds))]}))})), shipments: queue.baseline};
  return assertPackageScan(snapshot, expectedAccounts);
}
