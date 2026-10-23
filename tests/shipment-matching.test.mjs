import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileShipments} from '../src/shipment-matching.mjs';
import {packageRows,setPackageRecord} from '../src/packages.mjs';
import {historyId,shipmentIdentity} from '../src/history.mjs';
import {mergePackageEvidence,assertPackageScan,PACKAGE_DISCOVERY_QUERY} from '../scripts/package-scan.mjs';
import {deliverySnapshot} from '../scripts/lib.mjs';

const confirmation={id:'order-10',merchant:'Example shop',orderNumber:'ORDER-10',status:'ordered',caption:'Preparing to ship',updatedAt:'2026-10-20T10:00:00Z'};
const shipped={...confirmation,id:'shipping-10',carrier:'UPS',trackingNumber:'TRACK10',status:'shipped',caption:'Shipped',updatedAt:'2026-10-21T10:00:00Z'};
const delivered={...shipped,id:'delivery-10',status:'delivered',caption:'Delivered',updatedAt:'2026-10-22T10:00:00Z'};
const key=p=>historyId('shipment',shipmentIdentity(p));
test('order confirmation, shipment and delivery collapse with all coverage identities retained',()=>{
 const result=mergePackageEvidence([confirmation,shipped],[delivered]);
 assert.equal(result.length,1);assert.equal(result[0].status,'delivered');
 assert.deepEqual(new Set(result[0].sourceIds),new Set(['order-10','shipping-10','delivery-10']));
 const scan={scanVersion:2,checkedAt:delivered.updatedAt,shipments:result,scanAccounts:[{account:'one',searches:[{query:PACKAGE_DISCOVERY_QUERY,complete:true,checkedAt:delivered.updatedAt,messageIds:['a','b','c']}],readIds:['a','b','c'],reviews:['order-10','shipping-10','delivery-10'].map((id,i)=>({messageId:['a','b','c'][i],shipmentIds:[id]}))}]};
 assertPackageScan(scan,['one']);
 assert.equal(deliverySnapshot({...scan,shipments:[confirmation,shipped,delivered]},new Date(delivered.updatedAt)).shipments.length,1);
});
test('late shipping emails and input ordering never regress a delivered package',()=>{
 const late={...shipped,id:'late',updatedAt:'2026-10-23T10:00:00Z'};
 for(const list of [[confirmation,delivered,late],[late,delivered,confirmation]]){
  const [p]=reconcileShipments(list);assert.equal(p.status,'delivered');assert.equal(p.caption,'Delivered');assert.equal(p.updatedAt,late.updatedAt);
 }
});
test('multiple order updates without tracking combine when their order and item are unambiguous',()=>{
 const parcels=[confirmation,{...shipped,trackingNumber:undefined},{...delivered,trackingNumber:undefined}];
 assert.equal(reconcileShipments(parcels).length,1);assert.equal(reconcileShipments(parcels)[0].status,'delivered');
});
test('tracking matches independently of carrier formatting; no merchant-only merging',()=>{
 assert.equal(reconcileShipments([shipped,{...delivered,carrier:'United Parcel Service',trackingNumber:'track 10'}]).length,1);
 assert.equal(reconcileShipments([confirmation,{...confirmation,id:'other-order',orderNumber:'ORDER-11'}]).length,2);
 assert.equal(reconcileShipments([{...confirmation,orderNumber:undefined},{...confirmation,id:'unidentified',orderNumber:undefined}]).length,2);
});
test('split shipments, different items and exchange orders remain distinct',()=>{
 const split={...shipped,id:'split',trackingNumber:'TRACK11'};
 assert.equal(reconcileShipments([shipped,split]).length,2);
 assert.equal(reconcileShipments([confirmation,shipped,split]).length,3,'An ambiguous summary must not join separate parcels');
 assert.equal(reconcileShipments([{...shipped,itemName:'Brown shoe'},{...confirmation,id:'white-shoe',itemName:'White shoe'}]).length,2);
 assert.equal(reconcileShipments([delivered,{...shipped,id:'exchange',orderNumber:'EXCHANGE-ORDER-10',trackingNumber:'TRACK12'}]).length,2);
});
test('saved Return follows an order from confirmation to tracking and survives missing feed',async()=>{
 const savedKey=await key(confirmation),records={};setPackageRecord(records,savedKey,confirmation,'return');
 let rows=await packageRows([shipped,delivered],records);assert.equal(rows.length,1);assert.equal(rows[0].stage,'return');
 setPackageRecord(records,rows[0].key,rows[0].shipment,'refund');
 rows=await packageRows([],records);assert.equal(rows.length,1);assert.equal(rows[0].stage,'refund');assert.equal(rows[0].shipment.orderNumber,'ORDER-10');
 setPackageRecord(records,rows[0].key,rows[0].shipment,'refunded');
 assert.equal((await packageRows([confirmation,shipped,delivered],records))[0].stage,'refunded');
});
test('latest explicit choice and undo apply across aliases without deleting tombstones',async()=>{
 const a=await key(confirmation),b=await key(shipped);
 const records={[a]:{stage:'return',changedAt:'2026-10-21T10:00:00Z',shipment:confirmation},[b]:{stage:'received',changedAt:'2026-10-22T10:00:00Z',shipment:shipped}};
 const [row]=await packageRows([delivered],records);assert.equal(row.stage,'received');
 setPackageRecord(records,row.key,row.shipment,'incoming');
 assert.equal(records[a].stage,'incoming');assert.equal(records[b].stage,'incoming');
 const rows=await packageRows([confirmation,delivered],records,{[a]:'2026-10-21T10:00:00Z'});assert.equal(rows.length,1);assert.equal(rows[0].stage,'incoming');
 assert.throws(()=>setPackageRecord(records,a,confirmation,'refunded'),/changed/);
});
test('legacy receipt alias hides a tracked update; archives retain historical email evidence',async()=>{
 const legacy={[await key(confirmation)]:'2026-10-21T10:00:00Z'};
 assert.equal((await packageRows(reconcileShipments([confirmation,delivered]),{},legacy))[0].stage,'received');
 const records={};setPackageRecord(records,await key(delivered),delivered,'return');
 const [old]=await packageRows([confirmation],records,{},false);
 assert.equal(old.stage,'return');assert.equal(old.shipment.status,'ordered');
 assert.equal((await packageRows([],records,{},false)).length,0);
});
