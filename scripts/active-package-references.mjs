import {packageRows} from '../src/packages.mjs';
import assert from 'node:assert/strict';

// Read the same durable aliases and undo choices as the page. Mail status alone
// never closes an order; active saved returns can outlive the discovery window.
export async function activePackageReferences(shipments, state) {
  const rows = await packageRows(shipments, state.packages, state.history.received, true);
  return rows.filter(row => !['received', 'refunded'].includes(row.stage)).map(row => row.shipment);
}

export async function assertActiveReferenceCoverage(snapshot, state) {
  const active = await activePackageReferences(snapshot.shipments, state);
  const references = [...new Set(active.flatMap(x => [x.orderNumber, x.trackingNumber]).filter(Boolean).map(String))];
  for (const account of snapshot.scanAccounts) for (const ref of references) {
    assert.ok(account.searches.some(q => q.complete && q.query.includes('"' + ref + '"')), 'A package was reopened after the scan or an active reference was not searched. Resume coverage before publication.');
  }
}
