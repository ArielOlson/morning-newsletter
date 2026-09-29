import './style.css';
import { decrypt } from './crypto.mjs';
import {historyId,readHistory,changeHistory,shipmentIdentity} from './history.mjs';
let interactionHistory=readHistory(),showReceived=false;
const shipmentKeys=new Map();
const protectedBuild=import.meta.env.PROD;
let password=null, lockTimer, privacyGeneration=0, lastActivity=Date.now();
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch {return '';} };
const external = 'target="_blank" rel="noopener noreferrer"';
const base = import.meta.env.BASE_URL;
let brief = null, saved = [], toastTimer;
try { const value = JSON.parse(localStorage.getItem('morning-edit-saved') || '[]'); saved = Array.isArray(value) ? value.filter(x=>x && typeof x.id==='string' && typeof x.title==='string' && safeURL(x.url)).slice(0,100) : []; } catch {}
const zone = () => brief?.timezone || 'America/New_York';
const localToday = () => new Intl.DateTimeFormat('en-CA',{ timeZone:zone(),year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateLabel = (day,options={month:'short',day:'numeric'}) => new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const timeLabel = date => new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:zone()}).format(new Date(date));
const dateRange = item => item.endDate && item.endDate !== item.startDate ? `${dateLabel(item.startDate)} - ${dateLabel(item.endDate)}` : dateLabel(item.startDate);
function toast(message){ $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000); }
function empty(title,copy,action=''){return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">♡</span><h3>${escape(title)}</h3><p>${escape(copy)}</p>${action}</div>`;}
function showSettings(){ $('#settings-dialog').showModal(); }
$('#settings-button').addEventListener('click',showSettings);$('#about-button').addEventListener('click',showSettings);
document.querySelectorAll('.close-dialog,.close-settings').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{ if(e.target===dialog){ const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } }));
function showView(){ const view = ['week','saved'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today'; ['today','week','saved'].forEach(x=>{$(`#${x}-view`).hidden=x!==view; const link=$(`[data-view="${x}"]`); if(x===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}); if(view==='saved')renderSaved(); }
window.addEventListener('hashchange',showView);
function planHTML(e){ return `<article class="plan"><time>${e.allDay?'All day':escape(timeLabel(e.start))}${!e.allDay && e.end!==e.start ? `<br><span class="small-label">to ${escape(timeLabel(e.end))}</span>`:''}</time><div class="plan-main"><h3>${escape(e.title)}</h3>${e.location?`<p>${escape(e.location)}</p>`:''}${e.note?`<p>${escape(e.note)}</p>`:''}${e.recurring?'<p>Repeats</p>':''}</div></article>`; }
function eventOnDay(e,day){return e.startDate<=day && (e.allDay ? e.endDate>day : e.endDate>=day);}
function renderAgenda(){
  const c=brief.calendar,day=brief.day;
  const events=c.events.filter(e=>eventOnDay(e,day));
  $('#plan-count').textContent=c.connected ? `${events.length} ${events.length===1?'plan':'plans'} today` : 'Calendar';
  $('#agenda-content').classList.remove('loading-block');
  if(!c.connected)$('#agenda-content').innerHTML=empty('Connect your calendar','Add an Apple or Google public calendar link in settings.','<button class="button connect-calendar">Connect my calendar ↗</button>');
  else if(c.state==='unavailable')$('#agenda-content').innerHTML=empty('Calendar unavailable','We couldn’t refresh your plans. Please check your calendar before assuming the day is free.');
  else $('#agenda-content').innerHTML=(c.state==='partial'?'<p class="notice">Some calendars could not refresh. This list may be incomplete.</p>':'')+(events.length?events.map(planHTML).join(''):empty('No plans today','No events on your connected calendar for this date.'));
  $('.connect-calendar')?.addEventListener('click',showSettings);
  const next=c.events.filter(e=>e.startDate>day).slice(0,3);
  $('#upcoming-preview').innerHTML=next.length?`<h3 class="upcoming-heading">Coming up</h3>${next.map(e=>`<div class="upcoming-item"><time>${escape(dateLabel(e.startDate))}${e.allDay?'':` · ${escape(timeLabel(e.start))}`}</time><strong>${escape(e.title)}</strong>${e.location?`<span>${escape(e.location)}</span>`:''}</div>`).join('')}<a class="text-button" href="#week">Full two-week schedule ↗</a>`:'';
  const calendarSources=Object.entries(brief.status||{}).filter(([key])=>key.startsWith('calendar')).map(([,value])=>value);
  $('#calendar-source').textContent=calendarSources.map((x,i)=>`Calendar ${i+1}: ${x.state==='fresh'?`checked ${stamp(x.updatedAt)}`:'unavailable'}`).join(' · ');

}
function renderWeather(){
  const w=brief.weather;
  if(!w){$('#weather-content').innerHTML=empty('The forecast is taking a moment.','Weather couldn’t be refreshed. Check the latest forecast before heading out.','<a class="text-button" href="https://forecast.weather.gov/MapClick.php?lat=40.71&lon=-74.01" target="_blank" rel="noopener noreferrer">Check NYC weather ↗</a>');return;}
  const icon=w.code===0?'☀️':w.code<=3?'⛅':w.code>=95?'⛈️':[71,73,75,77,85,86].includes(w.code)?'❄️':w.code<=48?'🌫️':'🌧️';
  $('#weather-content').innerHTML=`<div class="weather-temp"><span class="temperature">${escape(w.high)}°</span><span class="weather-symbol" aria-hidden="true">${icon}</span></div><p class="weather-range">High ${escape(w.high)}° / Low ${escape(w.low)}° <span> · </span> ${escape(w.chance)}% chance of rain</p><h3 class="weather-condition">${escape(w.condition)}</h3><p class="weather-advice"><strong>${escape(w.advice)}</strong><br>${escape(w.clothing)}${w.uv>=6?' Sunscreen is a good idea, too.':''}</p><div class="hourly">${w.hours.map(h=>`<div><span>${+h.time.slice(11,13)%12||12} ${+h.time.slice(11,13)>=12?'PM':'AM'}</span><strong>${escape(h.temperature)}°</strong><span>${escape(h.rain)}% rain</span></div>`).join('')}</div><div class="weather-source"><span>${brief.status.weather.state==='stale'?'Earlier forecast':'Today’s forecast'}</span><a href="https://open-meteo.com/" ${external}>Open-Meteo ↗</a></div>`;
}
function reminderHTML(e){return `<article class="reminder"><time>${escape(dateRange(e))}</time><div><h3>${escape(e.title)}</h3>${e.note?`<p>${escape(e.note)}</p>`:''}${safeURL(e.url)?`<a class="text-button" href="${escape(safeURL(e.url))}" ${external}>Details ↗</a>`:''}</div></article>`;}
function renderReminders(){ $('#reminders-content').innerHTML=brief.reminders.length?brief.reminders.map(reminderHTML).join(''):'<p class="reminder-empty">No reminders due. Add a date or week to keep it in your morning brief.</p>'; }
function findHTML(f){
 const selected=saved.some(x=>x.id===f.id),url=safeURL(f.url),photo=safeURL(f.image);
 const when=f.when||(f.startDate?dateRange(f):'Choose a day');
 return `<article class="find photo-card"><div class="card-photo">${photo?`<img src="${escape(photo)}" alt="${escape(f.imageAlt||f.title)}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="photo-unavailable">Photo unavailable</span>'}<button class="save-button" data-save="${escape(f.id)}" aria-label="${selected?'Unsave':'Save'} ${escape(f.title)}" aria-pressed="${selected}">${selected?'♥':'♡'}</button></div><h3>${escape(f.title)}</h3><p class="card-date">${escape(when)}</p><p class="card-cost">${escape(f.cost||'Price not confirmed')}</p><p class="card-neighborhood">${escape(f.neighborhood||f.where||'Location not confirmed')}</p>${f.what?`<p class="card-note">${escape(f.what)}</p>`:''}${url?`<a class="text-button" href="${escape(url)}" ${external}>${escape(f.source||'Event details')} ↗</a>`:''}</article>`;
}
function wirePhotos(container){container.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;const label=document.createElement('span');label.className='photo-unavailable';label.textContent='Photo unavailable';img.before(label);},{once:true}));}
function wireCarousel(id){const row=document.getElementById(id);document.querySelectorAll(`[data-scroll="${id}"]`).forEach(b=>b.addEventListener('click',()=>row.scrollBy({left:Number(b.dataset.direction)*row.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})));}
wireCarousel('finds-content');wireCarousel('ideas-content');
function wireSave(container){container.querySelectorAll('[data-save]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.save,index=saved.findIndex(x=>x.id===id); const next=[...saved];
  if(index>=0)next.splice(index,1);else {const item=[...(brief?.finds||[]),...(brief?.ideas||[])].find(x=>x.id===id);if(!item)return;next.push(item);}
  try{localStorage.setItem('morning-edit-saved',JSON.stringify(next));saved=next;toast(index>=0?'Removed from your saved finds.':'Saved.');}catch{toast('This browser can’t save right now. Try allowing local storage.');return;}
  renderFinds();renderIdeas();renderSaved();
}));}
function renderIdeas(){if(!brief)return;$('#ideas-content').innerHTML=brief.ideas?.length?brief.ideas.map(findHTML).join(''):empty('Room for a little inspiration','Your saved restaurant and activity ideas will appear when the timing fits.');wireSave($('#ideas-content'));wirePhotos($('#ideas-content'));}
function renderFinds(){if(!brief)return;
  $('#finds-content').innerHTML=brief.finds.length?brief.finds.slice(0,10).map(findHTML).join(''):empty('No verified picks available.','NYC sources could not provide current events. Try the next edition.');wireSave($('#finds-content'));wirePhotos($('#finds-content'));$('#city-count').textContent=`${brief.finds.length} events for the days ahead`; 
}
const stamp=value=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone()}).format(new Date(value));
function renderFinance(){
  const items=brief.finance||[];
  $('#finance-content').innerHTML=(items.length<3?'<p class="notice">Fewer than three recent stories are available from the finance feeds.</p>':'')+items.map((f,i)=>`<article class="finance-item"><span class="item-number">0${i+1}</span><div><p class="find-meta">${escape(f.source)} · ${escape(stamp(f.publishedAt))}</p><h3><a href="${escape(safeURL(f.url))}" ${external}>${escape(f.title)} ↗</a></h3>${f.bullets?.length?`<ul class="finance-facts">${f.bullets.map(t=>`<li>${escape(t)}</li>`).join('')}</ul>`:f.summary?`<p>${escape(f.summary)}</p>`:''}${f.context?`<p class="finance-context"><strong>Why it matters:</strong> ${escape(f.context)}</p>`:''}${f.basis?`<p class="find-meta">${escape(f.basis)}</p>`:''}</div></article>`).join('');
}
$('#received-toggle').addEventListener('click',()=>{showReceived=!showReceived;$('#received-toggle').textContent=showReceived?'Hide received':'Show received';renderDeliveries();});
window.addEventListener('storage',()=>{interactionHistory=readHistory();if(brief)renderDeliveries();});
function renderDeliveries(){
  const d=brief.deliveries||{state:'unavailable',shipments:[]};
  $('#deliveries-source').textContent=d.checkedAt?`Email scanned ${stamp(d.checkedAt)} · ${d.scope||'Connected Gmail'}. Status is from email unless carrier verification is shown.`:'Email scan unavailable.';
  if(d.state==='unavailable'){$('#deliveries-content').innerHTML=empty('Delivery scan unavailable','The next successful email scan will populate your package updates.');return;}
  const visible=d.shipments.filter(p=>showReceived||!interactionHistory.received[shipmentKeys.get(p.id)]);
  const labels={ordered:'Ordered',shipped:'Shipped',delivered:'Delivered',pickup:'Pickup notice',scheduled:'Scheduled',delayed:'Delayed','out-for-delivery':'Out for delivery','in-transit':'In transit'};
  $('#deliveries-content').innerHTML=(d.state==='stale'?'<p class="notice">The last email scan is over 26 hours old. These statuses may have changed.</p>':'')+(visible.length?visible.map(p=>`<article class="delivery-item"><div class="delivery-line-one"><h3>${[p.merchant,p.itemName,p.caption||p.detail,p.expectedDate?`${p.expectedLabel||'Expected'} ${dateLabel(p.expectedDate)}`:'',labels[p.status]||p.status].filter(Boolean).map(escape).join(' <span aria-hidden="true">|</span> ')}</h3><button class="text-button received-button" data-received="${escape(p.id)}">${interactionHistory.received[shipmentKeys.get(p.id)]?'Received ✓ · undo':'Mark as received'}</button></div><div class="delivery-line-two">${[p.note?`<span>${escape(p.note)}</span>`:'',!p.carrierCheckedAt?'<span>Email update; live carrier status unverified.</span>':'',safeURL(p.trackingURL)?`<a href="${escape(safeURL(p.trackingURL))}" ${external}>Tracking ↗</a>`:'',safeURL(p.emailURL)?`<a href="${escape(safeURL(p.emailURL))}" ${external}>Email ↗</a>`:''].filter(Boolean).join('<span class="separator" aria-hidden="true">|</span>')}</div><p class="find-meta delivery-line-three">Last update ${escape(stamp(p.updatedAt))}${p.carrierCheckedAt?` · Carrier checked ${escape(stamp(p.carrierCheckedAt))}`:''}</p></article>`).join(''):empty('No packages to collect',d.shipments.length?'Received packages are hidden in this browser.':'The latest scan found no active shipments or recent delivery notices.'));
  $('#deliveries-content').querySelectorAll('[data-received]').forEach(b=>b.addEventListener('click',()=>{const key=shipmentKeys.get(b.dataset.received);if(!key)return;try{interactionHistory=changeHistory('received',key,!interactionHistory.received[key]);renderDeliveries();toast('Delivery preference saved in this browser.');}catch{toast('Could not save. Allow browser storage and try again.');}}));
}
function renderSaved(){ $('#saved-count').textContent=saved.length?`(${saved.length})`:''; $('#saved-content').innerHTML=saved.length?saved.map(findHTML).join(''):empty('Keep the good ones.','Tap the heart on any NYC discovery to save it here. Your list stays in this browser.');wireSave($('#saved-content')); }
function renderWeek(){
  const plans=brief.calendar.events;const reminders=[...new Map([...brief.reminders,...brief.upcomingReminders].map(e=>[e.id,e])).values()];
  const groups=new Map();
  for(const item of [...plans.map(x=>({...x,type:'plan'})),...reminders.map(x=>({...x,type:'reminder'}))]){const d=item.startDate<brief.day?brief.day:item.startDate;if(!groups.has(d))groups.set(d,[]);groups.get(d).push(item);}
  $('#week-content').innerHTML=(!brief.calendar.connected?'<p class="notice">Connect Apple or Google Calendar to include your upcoming plans here.</p>':brief.calendar.state!=='fresh'?'<p class="notice">Some calendar plans are unavailable. Check your calendar for your full schedule.</p>':'')+(groups.size?[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,items])=>`<section class="week-day"><h3>${escape(dateLabel(day,{weekday:'long',month:'short',day:'numeric'}))}</h3>${items.map(e=>e.type==='plan'?planHTML(e):reminderHTML(e)).join('')}</section>`).join(''):empty('A fresh page ahead.','Your next two weeks of calendar plans and reminders will appear here.'));
}
function render(){
  $('#edition-date').textContent=dateLabel(brief.day,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();
  $('#greeting').innerHTML=`Good morning,<br><span>${escape(brief.name)}.</span>`;
  $('#freshness').textContent=`Your ${dateLabel(brief.day)} edit · Updated ${timeLabel(brief.generatedAt)}`;
  const stale=brief.day!==localToday();let notices=[];
  if(stale)notices.push(`You’re reading the ${dateLabel(brief.day)} edition. Today’s edition hasn’t arrived yet; the forecast and plans below are for that date.`);
  if(brief.errors?.length)notices.push('Some sources couldn’t refresh. Check the availability notes below.');
  $('#notice').hidden=!notices.length;$('#notice').textContent=notices.join(' ');
  renderAgenda();renderWeather();renderReminders();renderFinds();renderIdeas();renderFinance();renderDeliveries();renderWeek();renderSaved();showView();
}
async function load(){
  if(protectedBuild&&!password)return false;
  const generation=privacyGeneration;
  try{const r=await fetch(`${base}data/${protectedBuild?'brief.enc.json':'brief.json'}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error();const raw=await r.json();const data=protectedBuild?JSON.parse(await decrypt(raw,password)):raw;if(data.version!==1||!data.day||!data.calendar)throw new Error();if(protectedBuild&&(generation!==privacyGeneration||!password))return false;for(const p of data.deliveries?.shipments||[])shipmentKeys.set(p.id,await historyId('shipment',shipmentIdentity(p)));if(protectedBuild&&(generation!==privacyGeneration||!password))return false;brief=data;render();return true;}
  catch{if(protectedBuild&&!brief)return false;if(brief){toast('Couldn’t load a newer edition. Your previous one is still here.');return false;}$('#edition-date').textContent=dateLabel(localToday(),{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();$('#freshness').textContent='Your first edition is waiting to be refreshed.';$('#agenda-content').innerHTML=empty('Let’s make this your morning.','Connect your calendar in settings, then refresh your first edition.','<button class="button connect-calendar">Set up my morning ↗</button>');$('#agenda-content').classList.remove('loading-block');$('.connect-calendar')?.addEventListener('click',showSettings);$('#weather-content').innerHTML='<p class="weather-advice">Your fresh New York forecast will appear after the first refresh.</p>';$('#reminders-content').innerHTML='<p class="reminder-empty">Your date-aware reminders will live here.</p>';$('#finds-content').innerHTML=empty('New York has good things in store.','Fresh discoveries will arrive with your first edition.');renderSaved();showView();return false;}
}
$('#refresh-button').addEventListener('click',async()=>{const b=$('#refresh-button');b.disabled=true;b.textContent='Freshening up…';try{const r=await fetch(`${base}__local/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(r.ok){await load();toast('Edition refreshed. Email and connected calendar use the latest saved scan.');}else {await load();toast('Showing the latest published edition. New data refreshes on schedule.');}}catch{await load();}finally{b.disabled=false;b.textContent='Refresh edition ↻';}});
document.querySelectorAll('.add-reminder').forEach(b=>b.addEventListener('click',()=>{$('#form-status').textContent='';$('#reminder-form').elements.startDate.value=localToday();$('#reminder-dialog').showModal();}));
$('#reminder-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,values=Object.fromEntries(new FormData(form));
  if(values.endDate && values.endDate<values.startDate){$('#form-status').textContent='The last day needs to be on or after the first day.';return;}
  const item={...values,id:crypto.randomUUID(),remindDaysBefore:Number(values.remindDaysBefore),category:'personal'};if(!item.endDate)delete item.endDate;
  const button=form.querySelector('[type=submit]');button.disabled=true;$('#form-status').textContent='Saving your reminder…';
  try{const response=await fetch(`${base}__local/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!response.ok)throw new Error();$('#reminder-dialog').close();form.reset();await load();toast('A note to future you, saved.');}
  catch{$('#form-status').textContent='Saving is available in the local editor. On a hosted site, add this reminder to config/events.local.json and publish the update.';}
  finally{button.disabled=false;}
});
function lockNewsletter(message=''){
  if(!protectedBuild)return;
  password=null;brief=null;privacyGeneration++;clearTimeout(lockTimer);
  document.body.classList.add('locked');
  for(const id of ['agenda-content','upcoming-preview','calendar-source','weather-content','reminders-content','finds-content','ideas-content','finance-content','deliveries-content','deliveries-source','week-content','saved-content'])$(`#${id}`).replaceChildren();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  $('#unlock-password').value='';$('#unlock-status').textContent=message;$('#toast').hidden=true;
}
function resetLockTimer(){if(protectedBuild&&brief){lastActivity=Date.now();clearTimeout(lockTimer);lockTimer=setTimeout(()=>lockNewsletter('Locked after 15 minutes of inactivity.'),15*60*1000);}}
$('#unlock-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;
  $('#unlock-status').textContent='Opening your morning…';password=$('#unlock-password').value;
  const opened=await load();
  if(opened){document.body.classList.remove('locked');$('#unlock-password').value='';$('#unlock-status').textContent='';resetLockTimer();}
  else{password=null;$('#unlock-status').textContent='Couldn’t unlock this edition. Check your password and connection, then try again.';}
  button.disabled=false;
});
$('#lock-button').addEventListener('click',()=>lockNewsletter());
document.addEventListener('pointerdown',resetLockTimer,{passive:true});document.addEventListener('keydown',resetLockTimer);
window.addEventListener('pagehide',()=>lockNewsletter());
$('#lock-button').hidden=!protectedBuild;
if(!protectedBuild){document.body.classList.remove('locked');showView();await load();}

// Recheck when returning to a tab, including across midnight; no weather guesses offline.
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(protectedBuild&&brief&&Date.now()-lastActivity>=15*60*1000)lockNewsletter('Locked after 15 minutes of inactivity.');else load();}});
setInterval(()=>{if(!document.hidden)load();},5*60*1000);
import('./heart.js').then(({mountHeart})=>mountHeart($('#heart-scene'))).catch(()=>{});
