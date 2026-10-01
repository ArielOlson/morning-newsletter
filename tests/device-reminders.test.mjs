import test from 'node:test';
import assert from 'node:assert/strict';
import {readDeviceReminders,changeDeviceReminders,deviceRemindersFor,deviceRemindersKey,validateDeviceReminder,reminderSaveMessage} from '../src/device-reminders.mjs';
const reminder={id:'stable-reminder',title:'Private appointment',note:'Private note',startDate:'2026-11-03',endDate:'2026-11-05',remindDaysBefore:3};
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('phone reminders stay encrypted and preserve IDs across edits and deletions',async()=>{
 const storage=store(),opts={storage,locks:null},password='test-only-password';
 await changeDeviceReminders(password,()=>[reminder],opts);
 const raw=storage.getItem(deviceRemindersKey);assert.ok(!raw.includes(reminder.title));assert.ok(!raw.includes(password));
 assert.equal((await readDeviceReminders(password,storage))[0].id,reminder.id);
 await changeDeviceReminders(password,items=>items.map(x=>({...x,title:'Updated'})),opts);
 assert.equal((await readDeviceReminders(password,storage))[0].title,'Updated');
 await changeDeviceReminders(password,()=>[],opts);assert.deepEqual(await readDeviceReminders(password,storage),[]);
});
test('invalid dates, whitespace titles, and reverse ranges are rejected',()=>{
 for(const patch of [{title:' '},{startDate:'2026-02-30'},{endDate:'2026-11-02'},{remindDaysBefore:-1}])assert.throws(()=>validateDeviceReminder({...reminder,...patch}));
});
test('lead time and inclusive date ranges remain correct across DST and future editions',()=>{
 assert.equal(deviceRemindersFor([reminder],'2026-10-30').reminders.length,0);
 assert.equal(deviceRemindersFor([reminder],'2026-10-31').reminders.length,1);
 assert.equal(deviceRemindersFor([reminder],'2026-11-05').reminders.length,1);
 assert.equal(deviceRemindersFor([reminder],'2026-11-06').reminders.length,1);
 assert.equal(deviceRemindersFor([reminder],'2026-10-21').upcomingReminders.length,1);
});
test('corrupt storage, write failures, and locking never erase the previous saved copy',async()=>{
 const storage=store(),opts={storage,locks:null};await changeDeviceReminders('test',()=>[reminder],opts);const original=storage.getItem(deviceRemindersKey);
 await assert.rejects(changeDeviceReminders('wrong',()=>[],opts));assert.equal(storage.getItem(deviceRemindersKey),original);
 await assert.rejects(changeDeviceReminders('test',()=>[],{...opts,isCurrent:()=>false}));assert.equal(storage.getItem(deviceRemindersKey),original);
 const failing={getItem:storage.getItem,setItem:()=>{throw Error('Quota exceeded');}};await assert.rejects(changeDeviceReminders('test',()=>[],{storage:failing,locks:null}));assert.equal(storage.getItem(deviceRemindersKey),original);
});

test('a JSON storage error is explained without destroying stored reminders',async()=>{
 const storage=store();storage.setItem(deviceRemindersKey,'{broken-json');
 await assert.rejects(changeDeviceReminders('test',()=>[reminder],{storage,locks:null}),error=>{
  assert.equal(error.code,'saved-data-unreadable');assert.match(reminderSaveMessage(error),/Do not clear browser data/);return true;
 });
 assert.equal(storage.getItem(deviceRemindersKey),'{broken-json');
 assert.match(reminderSaveMessage({name:'QuotaExceededError'}),/no storage space/);
 assert.match(reminderSaveMessage({name:'SecurityError'}),/blocking/);
});
