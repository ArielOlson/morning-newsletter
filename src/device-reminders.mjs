import {encrypt,decrypt} from './crypto.mjs';
export const deviceRemindersKey='morning-edit-device-reminders-v1';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function validateDeviceReminder(item){
 if(!item||typeof item.id!=='string'||!item.id||typeof item.title!=='string'||!item.title.trim()||item.title.length>160)throw Error('Enter a reminder title.');
 if(!validDay(item.startDate)||(item.endDate&&(!validDay(item.endDate)||item.endDate<item.startDate)))throw Error('Choose valid dates, with the last day on or after the first day.');
 if(!Number.isInteger(item.remindDaysBefore)||item.remindDaysBefore<0||item.remindDaysBefore>365)throw Error('Choose a valid reminder lead time.');
 if(typeof item.note!=='string'||item.note.length>1000)throw Error('Keep the note under 1,000 characters.');
 return {...item,title:item.title.trim(),category:'personal',deviceOnly:true};
}
export async function readDeviceReminders(password,storage=localStorage){
 let raw;
 try{raw=storage.getItem(deviceRemindersKey);}catch{throw Object.assign(new Error('Browser storage unavailable'),{code:'storage-unavailable'});}
 if(!raw)return [];
 try{
  const data=JSON.parse(await decrypt(JSON.parse(raw),password));
  if(data.version!==1||!Array.isArray(data.events))throw Error('Unreadable reminders');
  return data.events.map(validateDeviceReminder);
 }catch{throw Object.assign(new Error('Saved reminders unreadable'),{code:'saved-data-unreadable'});}
}
export async function changeDeviceReminders(password,change,{storage=localStorage,isCurrent=()=>true,locks=globalThis.navigator?.locks}={}){
 const run=async()=>{
  if(!password||!isCurrent())throw Error('Unlock the newsletter before saving.');
  const items=await readDeviceReminders(password,storage);
  const next=change(items).map(validateDeviceReminder);
  const encoded=JSON.stringify(await encrypt(JSON.stringify({version:1,events:next}),password));
  if(!isCurrent())throw Error('The newsletter locked before saving. Unlock and try again.');
  storage.setItem(deviceRemindersKey,encoded);
  return next;
 };
 return locks?locks.request(deviceRemindersKey,run):run();
}
export function deviceRemindersFor(events,day){
 return {
  reminders:events.filter(e=>day>=shift(e.startDate,-e.remindDaysBefore)),
  upcomingReminders:events.filter(e=>e.startDate>day&&e.startDate<=shift(day,14))
 };
}

export function reminderSaveMessage(error){
 if(error?.code==='saved-data-unreadable')return 'Could not save: this browser’s saved reminders could not be opened. The stored copy has been kept. Do not clear browser data; please report “saved reminders unreadable” so it can be recovered.';
 if(error?.name==='QuotaExceededError')return 'Could not save: this browser has no storage space available for reminders. Your existing reminders and this draft have been kept.';
 if(error?.code==='storage-unavailable'||error?.name==='SecurityError')return 'Could not save: Safari is blocking this website from storing reminders. Your draft is still here. Check website storage permissions and try again.';
 return 'Could not save your reminder. Your draft and existing reminders have been kept. Unlock the newsletter if needed, then try again.';
}
