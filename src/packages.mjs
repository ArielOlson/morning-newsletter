import {encrypt,decrypt} from './crypto.mjs';
import {historyId,shipmentIdentity} from './history.mjs';
export const packagesKey='morning-edit-packages-v1';
const stages=['incoming','received','return','refund','refunded'];
const fields=['id','merchant','itemName','caption','detail','note','status','updatedAt','carrierCheckedAt','expectedDate','expectedLabel','carrier','trackingNumber','trackingURL','emailURL'];
const snapshot=p=>Object.fromEntries(fields.filter(k=>typeof p[k]==='string').map(k=>[k,p[k]]));
const latest=(a,b)=>a&&Date.parse(a.updatedAt)>Date.parse(b.updatedAt)?a:b;
export async function readPackages(password,storage=localStorage,key=packagesKey){
 const raw=storage.getItem(key);if(!raw)return {};
 try{
  const data=JSON.parse(await decrypt(JSON.parse(raw),password));
  if(data.version!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw Error();
  for(const [id,r] of Object.entries(data.records))if(!/^[a-f0-9]{64}$/.test(id)||!stages.includes(r.stage)||!r.shipment?.id||!Number.isFinite(Date.parse(r.changedAt)))throw Error();
  return data.records;
 }catch{throw Error('Saved package choices could not be opened. The stored copy has been kept.');}
}
export async function changePackageStage(password,shipment,stage,{storage=localStorage,key=packagesKey,isCurrent=()=>true,locks=globalThis.navigator?.locks}={}){
 const run=async()=>{
  if(!password||!isCurrent())throw Error('Unlock the newsletter before saving.');
  if(!stages.includes(stage)||!shipment.id)throw Error('Invalid package choice.');
  const records=await readPackages(password,storage,key),id=await historyId('shipment',shipmentIdentity(shipment));
  setPackageRecord(records,id,shipment,stage);
  const encoded=JSON.stringify(await encrypt(JSON.stringify({version:1,records}),password));
  if(!isCurrent())throw Error('The newsletter locked before saving. Unlock and try again.');
  try{storage.setItem(key,encoded);}catch{throw Error('Could not save your choice. Allow browser storage or free some space, then try again.');}return records;
 };
 return locks?locks.request(key,run):run();
}
export async function packageRows(shipments,records,received={},includeRetained=true){
 const rows=new Map();
 for(const shipment of shipments){const key=await historyId('shipment',shipmentIdentity(shipment)),record=records[key];rows.set(key,{key,shipment,stage:record?.stage||(received[key]?'received':'incoming'),changedAt:record?.changedAt||received[key]});}
 if(includeRetained)for(const [key,record] of Object.entries(records))if(!rows.has(key))rows.set(key,{key,...record});
 return [...rows.values()];
}

export function setPackageRecord(records,id,shipment,stage){
  const from=records[id]?.stage||'incoming';
  const allowed={incoming:['incoming','received','return'],received:['incoming'],return:['refund'],refund:['refunded'],refunded:['incoming']};
  if(!allowed[from].includes(stage))throw Error('This package changed. Refresh the page and try again.');
  records[id]={stage,changedAt:new Date().toISOString(),shipment:snapshot(latest(records[id]?.shipment,shipment))};
 return records;
}
