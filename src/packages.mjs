import {encrypt,decrypt} from './crypto.mjs';
import {historyId,shipmentIdentity} from './history.mjs';
import {shipmentGroups,shipmentIdentities,reconcileShipments} from './shipment-matching.mjs';
export const packagesKey='morning-edit-packages-v1';
const stages=['incoming','received','return','refund','refunded'];
const fields=['id','merchant','orderNumber','orderItemKey','itemName','caption','detail','note','status','updatedAt','carrierCheckedAt','expectedDate','expectedLabel','carrier','trackingNumber','trackingURL','emailURL'];
const snapshot=p=>({...Object.fromEntries(fields.filter(k=>typeof p[k]==='string').map(k=>[k,p[k]])),...Object.fromEntries(['sourceIds','identityAliases'].filter(k=>Array.isArray(p[k])).map(k=>[k,p[k].filter(x=>typeof x==='string')]))});
const latestChoice=entries=>entries.sort((a,b)=>Date.parse(b[1].changedAt)-Date.parse(a[1].changedAt)||a[0].localeCompare(b[0]))[0];
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
 const saved=Object.entries(records),all=[...shipments,...saved.map(([,r])=>r.shipment)],rows=[];
 for(const {shipment,indices} of shipmentGroups(all)){
  const inEdition=indices.filter(i=>i<shipments.length);
  if(!includeRetained&&!inEdition.length)continue;
  const choices=indices.filter(i=>i>=shipments.length).map(i=>saved[i-shipments.length]);
  const hashes=await Promise.all(shipmentIdentities(shipment).map(id=>historyId('shipment',id)));
  for(const hash of hashes)if(records[hash]&&!choices.some(([k])=>k===hash))choices.push([hash,records[hash]]);
  const choice=latestChoice(choices),legacy=hashes.map(k=>received[k]).filter(Boolean).sort().at(-1);
  // Old editions keep their own email status; current durable choices still apply.
  const display=includeRetained?shipment:reconcileShipments(inEdition.map(i=>shipments[i]))[0];
  rows.push({key:choice?.[0]||await historyId('shipment',shipmentIdentity(shipment)),shipment:{...display,sourceIds:shipment.sourceIds,identityAliases:shipment.identityAliases},stage:choice?.[1].stage||(legacy?'received':'incoming'),changedAt:choice?.[1].changedAt||legacy});
 }
 return rows;
}

export function setPackageRecord(records,id,shipment,stage){
  const saved=Object.entries(records),group=shipmentGroups([shipment,...saved.map(([,r])=>r.shipment)]).find(g=>g.indices.includes(0));
  const matches=group.indices.filter(i=>i>0).map(i=>saved[i-1]);
  if(records[id]&&!matches.some(([k])=>k===id))matches.push([id,records[id]]);
  const from=latestChoice(matches)?.[1].stage||'incoming';
  const allowed={incoming:['incoming','received','return'],received:['incoming'],return:['refund'],refund:['refunded'],refunded:['incoming']};
  if(!allowed[from].includes(stage))throw Error('This package changed. Refresh the page and try again.');
  const record={stage,changedAt:new Date().toISOString(),shipment:snapshot(group.shipment)};
  // Keep alias tombstones, including explicit Incoming undo. A stale device or
  // legacy import must not resurrect the older receipt/return under another key.
  for(const key of new Set([id,...matches.map(([key])=>key)]))records[key]=record;
 return records;
}
