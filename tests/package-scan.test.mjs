import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKAGE_DISCOVERY_QUERY,assertPackageScan,mergePackageEvidence} from '../scripts/package-scan.mjs';
const date='2026-10-15T14:00:00Z';
const shipment={id:'parcel',merchant:'Example Store',status:'shipped',updatedAt:date};
const account=name=>({account:name,searches:[{query:PACKAGE_DISCOVERY_QUERY,complete:true,checkedAt:date,messageIds:['confirmation','shipping','promotion']}],readIds:['confirmation','shipping'],reviews:[{messageId:'confirmation',shipmentIds:['parcel']},{messageId:'shipping',shipmentIds:['parcel']},{messageId:'promotion',excludedReason:'Generic sale advertisement, not an order'}]});
const fixture=()=>({scanVersion:2,checkedAt:date,shipments:[shipment],scanAccounts:[account('one'),account('two')]});
test('order confirmations, ordinary on-the-way subjects and shared senders are discoverable without category exclusions',()=>{
 for(const term of ['subject:order','subject:"on the way"','subject:"ready to ship"','subject:returned','subject:autoship'])assert.ok(PACKAGE_DISCOVERY_QUERY.includes(term));
 assert.doesNotMatch(PACKAGE_DISCOVERY_QUERY,/-category:|is:unread|in:inbox|from:/);
 assertPackageScan(fixture(),['one','two']);
});
test('missing account, unread shipment, omitted review or unfinished pagination blocks completeness',()=>{
 for(const mutate of [x=>x.scanAccounts.pop(),x=>x.scanAccounts[0].reviews.pop(),x=>x.scanAccounts[0].readIds=[],x=>x.scanAccounts[0].searches[0].nextPageToken='more',x=>x.scanAccounts[0].reviews[0].shipmentIds=['absent']]){
  const x=fixture();mutate(x);assert.throws(()=>assertPackageScan(x,['one','two']));
 }
});
test('scans preserve unresolved and old delivered parcels and never regress newer evidence',()=>{
 const older={...shipment,updatedAt:'2026-09-01T00:00:00Z',status:'ordered'};
 const delivered={...older,id:'old-delivery',status:'delivered'};
 assert.deepEqual(mergePackageEvidence([shipment,delivered],[older]),[shipment,delivered]);
 assert.deepEqual(mergePackageEvidence([older],[shipment]),[shipment]);
});
