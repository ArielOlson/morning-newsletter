import {readPackages,changePackageStage,packageRows,packagesKey,setPackageRecord} from './packages.mjs';
export function createPackageView({escape,safeURL,stamp,dateLabel,external,wireLinks,toast,getPassword,isArchive,getHistory,sync}){
 let records={},rows=[],data=null,generation=0,showFinished=false,saving=false,error='';
 const root=document.querySelector('#deliveries-content'),toggle=document.querySelector('#received-toggle');
 const labels={ordered:'Ordered',shipped:'Shipped',delivered:'Delivered',pickup:'Pickup notice',scheduled:'Scheduled',delayed:'Delayed','out-for-delivery':'Out for delivery','in-transit':'In transit'};
 const stateLabels={received:'Received',return:'To return',refund:'Awaiting refund',refunded:'Refunded'};
 const key=import.meta.env.PROD?packagesKey:packagesKey+'-local-preview';
 const password=()=>getPassword()||(import.meta.env.PROD?null:'local-preview-only');
 const button=(row,action,label,legacy=false)=>`<button class="text-button package-button" data-package-key="${row.key}" data-package-action="${action}" ${legacy?`data-received="${escape(row.shipment.id)}"`:''} aria-label="${escape(label+' · '+row.shipment.merchant)}" ${saving||error?'disabled':''}>${label}</button>`;
 function article(row){
  const p=row.shipment,stage=row.stage;
  const actions=stage==='incoming'?button(row,'received','Received',true)+button(row,'return','Return'):stage==='return'?button(row,'refund','Sent Back'):stage==='refund'?button(row,'refunded','Refunded'):button(row,'incoming',`${stateLabels[stage]} ✓ · undo`,true);
  const title=[p.merchant,p.itemName,p.caption||p.detail,stage==='incoming'&&p.expectedDate?`${p.expectedLabel||'Expected'} ${dateLabel(p.expectedDate)}`:'',stateLabels[stage]||labels[p.status]||p.status].filter(Boolean).map(escape).join(' <span aria-hidden="true">|</span> ');
  return `<article class="delivery-item" data-package="${row.key}"><div class="delivery-line-one"><h4>${title}</h4><div class="package-actions">${actions}</div></div><div class="delivery-line-two">${[p.note?`<span>${escape(p.note)}</span>`:'',!p.carrierCheckedAt?'<span>Email update; live carrier status unverified.</span>':'',safeURL(p.trackingURL)?`<a href="${escape(safeURL(p.trackingURL))}" ${external}>Tracking ↗</a>`:'',safeURL(p.emailURL)?`<a href="${escape(safeURL(p.emailURL))}" ${external}>Email ↗</a>`:''].filter(Boolean).join('<span class="separator" aria-hidden="true">|</span>')}</div><p class="find-meta delivery-line-three">Last email update ${p.updatedAt?escape(stamp(p.updatedAt)):'unavailable'}${row.changedAt?` · Your choice saved ${escape(stamp(row.changedAt))}`:''}${p.carrierCheckedAt?` · Carrier checked ${escape(stamp(p.carrierCheckedAt))}`:''}</p></article>`;
 }
 function section(id,title,items,empty){return `<section class="package-section" id="packages-${id}" aria-labelledby="packages-${id}-heading"><h3 id="packages-${id}-heading" tabindex="-1">${title} <span>${items.length}</span></h3>${items.length?items.map(article).join(''):`<p class="package-empty">${empty}</p>`}</section>`;}
 function render(){
  if(!data)return;
  const finished=rows.filter(r=>['received','refunded'].includes(r.stage));
  toggle.textContent=showFinished?'Hide received & refunded':'Show received & refunded';toggle.setAttribute('aria-expanded',String(showFinished));
  document.querySelector('#deliveries-source').textContent=data.checkedAt?`Email scanned ${stamp(data.checkedAt)} · ${data.scope||'Connected Gmail'}. ${sync.connected?'Package choices are saved across connected devices.':'Connect cross-device saving in Made for Ariel before making changes.'}`:'Email scan unavailable. Saved returns and refunds remain below.';
  root.innerHTML=(error?`<p class="notice" role="alert">${escape(error)} Your stored copy is preserved; package buttons are paused until it can be opened.</p>`:'')+(data.state==='stale'?'<p class="notice">The last email scan is over 26 hours old. These statuses may have changed.</p>':'')+section('incoming','Incoming',rows.filter(r=>r.stage==='incoming'),data.state==='unavailable'?'Email scan unavailable.':'No incoming packages to review.')+section('returns','Returns',rows.filter(r=>r.stage==='return'),'No packages marked for return.')+section('refunds','Refunds',rows.filter(r=>r.stage==='refund'),'No refunds awaiting confirmation.')+((showFinished||isArchive())?section('finished','Received & refunded',finished,'No finished packages.'):'');
  wireLinks(root);
 }
 async function load(brief){
  const current=++generation;let next={},failure='';
  try{next=import.meta.env.PROD&&sync.connected?sync.state.packages:await readPackages(password(),localStorage,key);}catch(e){failure=e.message;}
  const list=await packageRows(brief.deliveries?.shipments||[],next,getHistory().received,!isArchive());
  if(current!==generation)return;
  saving=false;records=next;rows=list;error=failure;data=brief.deliveries||{state:'unavailable',shipments:[]};render();
 }
 toggle.addEventListener('click',()=>{showFinished=!showFinished;render();});
 root.addEventListener('click',async event=>{
  const b=event.target.closest('[data-package-action]');if(!b||saving||error)return;
  const row=rows.find(r=>r.key===b.dataset.packageKey);if(!row)return;
  const current=generation,action=b.dataset.packageAction;saving=true;render();
  try{
   const next=import.meta.env.PROD?(await sync.change(state=>{setPackageRecord(state.packages,row.key,row.shipment,action);return state;})).packages:await changePackageStage(password(),row.shipment,action,{key,isCurrent:()=>current===generation&&!!password()});
   if(current!==generation)return;
   const nextRows=await packageRows(data.shipments||[],next,getHistory().received,!isArchive());
   if(current!==generation)return;records=next;rows=nextRows;
   toast(action==='return'?'Moved to Returns. It stays until you mark Sent Back.':action==='refund'?'Moved to Refunds. It stays until you mark Refunded.':action==='incoming'?'Moved back to Incoming.':'Saved. Hidden from future editions on your connected devices.');
  }catch(e){if(current===generation)toast(e.message||'Could not save. Please allow browser storage and try again.');}
  finally{if(current===generation){saving=false;render();const group=action==='return'?'returns':action==='refund'?'refunds':'incoming';root.querySelector(`#packages-${group}-heading`)?.focus({preventScroll:true});}}
 });
 return {load,render,clear(){generation++;records={};rows=[];data=null;error='';saving=false;showFinished=false;root.replaceChildren();}};
}
