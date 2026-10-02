import test from 'node:test';
import assert from 'node:assert/strict';
import {readPackages,changePackageStage,packageRows,packagesKey} from '../src/packages.mjs';
import {historyId,shipmentIdentity} from '../src/history.mjs';
const store=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
const parcel={id:'notice-one',merchant:'PRIVATE RETAILER',carrier:'UPS',trackingNumber:'PRIVATE123',updatedAt:'2026-10-02T08:00:00Z',detail:'A parcel',rawEmail:'Never retain this'};
const password='test-only-packages-key';
test('return and refund stages outlive the shipment feed; completion persists and keeps contents encrypted',async()=>{
 const storage=store(),options={storage};
 let ledger=await changePackageStage(password,parcel,'return',options);
 assert.equal((await packageRows([],ledger))[0].stage,'return');
 ledger=await changePackageStage(password,parcel,'refund',options);
 assert.equal((await packageRows([],await readPackages(password,storage)))[0].stage,'refund');
 ledger=await changePackageStage(password,parcel,'refunded',options);
 assert.equal((await packageRows([{...parcel,id:'notice-two'}],ledger))[0].stage,'refunded');
 assert.equal((await packageRows([],ledger,{},false)).length,0,'Past editions do not gain newer parcels');
 const raw=storage.getItem(packagesKey);assert.ok(!raw.includes('PRIVATE'));assert.ok(!JSON.stringify(ledger).includes('rawEmail'));
 await assert.rejects(changePackageStage('wrong-password',parcel,'incoming',options));assert.equal(storage.getItem(packagesKey),raw);
});
test('received marks migrate without resurrecting packages and explicit undo overrides legacy marks',async()=>{
 const storage=store(),key=await historyId('shipment',shipmentIdentity(parcel)),legacy={[key]:'2026-10-01T08:00:00Z'};
 assert.equal((await packageRows([parcel],{},legacy))[0].stage,'received');
 let ledger=await changePackageStage(password,parcel,'incoming',{storage});
 assert.equal((await packageRows([parcel],ledger,legacy))[0].stage,'incoming');
 ledger=await changePackageStage(password,parcel,'received',{storage});
 assert.equal((await packageRows([{...parcel,id:'another-email'}],ledger))[0].stage,'received');
});
test('wrong transitions, failed writes and lock races do not lose the saved workflow',async()=>{
 const storage=store();await changePackageStage(password,parcel,'return',{storage});const raw=storage.getItem(packagesKey);
 await assert.rejects(changePackageStage(password,parcel,'refunded',{storage}));assert.equal(storage.getItem(packagesKey),raw);
 await assert.rejects(changePackageStage(password,parcel,'refund',{storage:{getItem:storage.getItem,setItem(){throw Error('quota');}}}));assert.equal(storage.getItem(packagesKey),raw);
 let n=0;await assert.rejects(changePackageStage(password,parcel,'refund',{storage,isCurrent:()=>++n===1}));assert.equal(storage.getItem(packagesKey),raw);
});
