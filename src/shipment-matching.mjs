import {shipmentIdentity} from './history.mjs';

const strings=values=>[...new Set(values.filter(x=>typeof x==='string'&&x.trim()))];
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const tracking=p=>normalize(p.trackingNumber);
const merchant=p=>normalize((p.merchant||'').split('·')[0]);
const order=p=>p.orderNumber?`${merchant(p)}:${normalize(p.orderNumber)}`:'';
const item=p=>normalize(p.orderItemKey||p.itemName);
export const shipmentSourceIds=p=>strings([p.id,...(p.sourceIds||[])]);
export const shipmentIdentities=p=>strings([shipmentIdentity(p),...(p.identityAliases||[])]);
const strongKeys=p=>[
 ...shipmentSourceIds(p).map(x=>'id:'+x),
 ...shipmentIdentities(p).map(x=>'identity:'+x),
 ...(tracking(p)?['tracking:'+tracking(p)]:[])
];
const time=p=>Date.parse(p.updatedAt)||0;
const progress={scheduled:0,ordered:1,'preparing-to-ship':2,'label-created':2,shipped:3,'in-transit':3,'out-for-delivery':4,delivered:5};

function combine(parcels){
 if(parcels.length===1)return {...parcels[0]};
 const sorted=[...parcels].sort((a,b)=>time(a)-time(b));
 const newest=sorted.at(-1),result=Object.assign({},...sorted);
 // Delayed email arrival must not move a delivered parcel back to preparing.
 // Exceptions/returns/cancellations keep their actual newest evidence.
 if(progress[newest.status]!==undefined){
  const furthest=sorted.reduce((best,p)=>(progress[p.status]??-1)>=(progress[best.status]??-1)?p:best,sorted[0]);
  if(progress[furthest.status]>progress[newest.status]){
   for(const key of ['status','caption','detail','note','expectedDate','expectedLabel','emailURL']){
    if(furthest[key]!==undefined)result[key]=furthest[key];else delete result[key];
   }
  }
 }
 // Retain every identity, so prior receipts/returns and coverage reviews still
 // resolve after a confirmation acquires tracking or a carrier label changes.
 const ids=strings(parcels.flatMap(shipmentSourceIds)),identities=strings(parcels.flatMap(shipmentIdentities));
 result.id=parcels.find(p=>tracking(p))?.id||parcels[0].id;
 if(ids.length>1||parcels.some(p=>p.sourceIds))result.sourceIds=ids;
 if(identities.length>1||parcels.some(p=>p.identityAliases))result.identityAliases=identities;
 return result;
}

// Use explicit evidence only. Merchant names, nearby dates and similar titles
// alone never identify an order. Distinct tracking numbers remain split parcels.
export function shipmentGroups(shipments){
 const parent=shipments.map((_,i)=>i);
 const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
 const join=(a,b)=>{parent[root(b)]=root(a);};
 const keys=new Map();
 shipments.forEach((p,i)=>{for(const key of strongKeys(p)){if(keys.has(key))join(i,keys.get(key));else keys.set(key,i);}});
 const groups=()=>{
  const map=new Map();shipments.forEach((p,i)=>{const key=root(i);if(!map.has(key))map.set(key,[]);map.get(key).push(i);});
  return [...map.values()];
 };
 const initial=groups(),orders=new Map();
 for(const indices of initial){
  for(const key of new Set(indices.map(i=>order(shipments[i])).filter(Boolean))){
   if(!orders.has(key))orders.set(key,[]);orders.get(key).push(indices);
  }
 }
 const facts=indices=>({tracks:new Set(indices.map(i=>tracking(shipments[i])).filter(Boolean)),items:new Set(indices.map(i=>item(shipments[i])).filter(Boolean))});
 const compatible=(a,b)=>{
  const x=facts(a),y=facts(b);
  if(x.tracks.size&&y.tracks.size)return false;
  if(x.items.size&&y.items.size&&![...x.items].some(k=>y.items.has(k)))return false;
  return true;
 };
 for(const candidates of orders.values()){
  const tracks=new Set(candidates.flatMap(a=>[...facts(a).tracks]));
  const items=new Set(candidates.flatMap(a=>[...facts(a).items]));
  if(tracks.size<=1&&items.size<=1){
   candidates.slice(1).forEach(b=>join(candidates[0][0],b[0]));continue;
  }
  // Only a unique, mutual match can attach an untracked notice to an order.
  // This prevents an order summary bridging two separate parcels/items.
  const matches=candidates.map(a=>candidates.filter(b=>a!==b&&compatible(a,b)));
  candidates.forEach((a,i)=>{if(matches[i].length===1){const b=matches[i][0],j=candidates.indexOf(b);if(matches[j].length===1)join(a[0],b[0]);}});
 }
 return groups().map(indices=>({indices,shipment:combine(indices.map(i=>shipments[i]))}));
}

export const reconcileShipments=shipments=>shipmentGroups(shipments).map(g=>g.shipment);
