import assert from 'node:assert/strict';

// Search is deliberately independent of Gmail category, read state and retailer
// domain. Shopify, Apple relay and marketing-labelled transaction mail count.
export const PACKAGE_DISCOVERY_QUERY='newer_than:30d {subject:order subject:shipment subject:shipped subject:tracking subject:delivered subject:delivery subject:package subject:arrived subject:arriving subject:dispatch subject:"on the way" subject:"on its way" subject:"en route" subject:"ready to ship" subject:refund subject:return subject:returned subject:canceled subject:cancelled subject:subscription subject:autoship}';
export const PACKAGE_SCAN_VERSION=2;
export function assertPackageScan(snapshot,expectedAccounts){
 assert.equal(snapshot.scanVersion,PACKAGE_SCAN_VERSION,'Run the complete order-and-shipment discovery scan.');
 assert.ok(Number.isFinite(Date.parse(snapshot.checkedAt)),'Missing actual scan time.');
 const accounts=snapshot.scanAccounts;
 assert.ok(Array.isArray(accounts)&&accounts.length===expectedAccounts.length,'Package scan must cover every configured Gmail account.');
 assert.deepEqual([...accounts.map(a=>a.account)].sort(),[...expectedAccounts].sort(),'Package scan account mismatch.');
 const shipments=new Set(snapshot.shipments.map(s=>s.id));
 for(const a of accounts){
  assert.ok(a.searches?.some(q=>q.query===PACKAGE_DISCOVERY_QUERY),'Broad discovery query was not run.');
  const matched=new Set();
  for(const q of a.searches){
   assert.ok(q.complete===true&&!q.nextPageToken&&Array.isArray(q.messageIds),'Incomplete search or unprocessed pagination.');
   assert.ok(Date.parse(q.checkedAt)<=Date.parse(snapshot.checkedAt),'Invalid search check time.');
   q.messageIds.forEach(id=>matched.add(id));
  }
  const read=new Set(a.readIds),reviewed=new Map((a.reviews||[]).map(r=>[r.messageId,r]));
  assert.equal(reviewed.size,a.reviews?.length,'Duplicate message review.');
  for(const id of matched){
   const r=reviewed.get(id);
   assert.ok(r,'A discovered message was silently dropped.');
   if(r.shipmentIds?.length){
    assert.ok(read.has(id),'Read shipment evidence before importing it.');
    assert.ok(r.shipmentIds.every(x=>shipments.has(x)),'Shipment review points to a missing parcel.');
   }else assert.ok(typeof r.excludedReason==='string'&&r.excludedReason.trim().length>=8,'Every excluded match needs a specific reason.');
  }
 }
 return snapshot;
}

// Only explicitly supplied newer evidence replaces a record. Absence in a query
// is never a delivery/receipt signal and never deletes an unresolved shipment.
export function mergePackageEvidence(previous=[],updates=[]){
 const merged=new Map(previous.map(s=>[s.id,s]));
 for(const next of updates){
  assert.ok(next.id&&next.merchant&&next.status&&Number.isFinite(Date.parse(next.updatedAt)),'Invalid shipment evidence.');
  const prior=merged.get(next.id);
  if(!prior||Date.parse(next.updatedAt)>=Date.parse(prior.updatedAt))merged.set(next.id,{...prior,...next});
 }
 return [...merged.values()];
}
