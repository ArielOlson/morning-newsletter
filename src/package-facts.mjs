const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const mailURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='mail.google.com'?url.href:null;}catch{return null;}};
export function packageFacts(shipment){
 const result={};
 for(const field of ['refundEstimate','returnMethod']){
  const fact=shipment[field];
  if(!fact||!date(fact.sourceDate)||!date(fact.checkedAt)||!mailURL(fact.emailURL))continue;
  const evidence={sourceDate:fact.sourceDate,checkedAt:fact.checkedAt,emailURL:mailURL(fact.emailURL)};
  if(field==='refundEstimate'&&Number.isFinite(fact.amount)&&fact.amount>=0&&/^[A-Z]{3}$/.test(fact.currency)&&['email-estimate','retailer-issued'].includes(fact.basis))result[field]={...evidence,amount:fact.amount,currency:fact.currency,basis:fact.basis,note:typeof fact.note==='string'?fact.note.slice(0,500):''};
  if(field==='returnMethod'&&typeof fact.label==='string'&&fact.label.trim())result[field]={...evidence,label:fact.label.trim().slice(0,200)};
 }
 return result;
}
export function newestPackageFacts(shipments){
 const facts=shipments.map(packageFacts),result={};
 for(const field of ['refundEstimate','returnMethod']){
  const newest=facts.map(f=>f[field]).filter(Boolean).sort((a,b)=>Date.parse(b.sourceDate)-Date.parse(a.sourceDate)||Date.parse(b.checkedAt)-Date.parse(a.checkedAt))[0];
  if(newest)result[field]=newest;
 }
 return result;
}
export function refundLabel(fact){
 let amount;try{amount=new Intl.NumberFormat('en-US',{style:'currency',currency:fact.currency}).format(fact.amount);}catch{return '';}
 return `${fact.basis==='retailer-issued'?'Retailer-issued refund':'Estimated refund'}: ${amount}`;
}
