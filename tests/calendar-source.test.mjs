import test from 'node:test';
import assert from 'node:assert/strict';
import {readCalendarSource} from '../scripts/calendar-source.mjs';
import {calendarSnapshot,mergeCalendarPlans} from '../scripts/lib.mjs';
const now=new Date('2026-10-01T13:00:00Z'),day='2026-10-01',input='https://example.com/calendar.ics';
const event={id:'work-event',title:'Work event',start:'2026-10-01T18:00:00-04:00',end:'2026-10-01T21:00:00-04:00',startDate:day,endDate:day,allDay:false,location:''};
const scan={input,checkedAt:'2026-10-01T12:00:00Z',windowStart:day,windowEnd:'2026-10-16',events:[event]};
const args={input,day,now,zone:'America/New_York',lookAheadDays:15,label:'Work',snapshot:{calendars:[scan]}};
test('complete connected scan wins over a public feed that can omit private events',async()=>{
 let calls=0;const result=await readCalendarSource({...args,download:async()=>{calls++;throw Error('Should not fetch');}});
 assert.equal(calls,0);assert.equal(result.events[0].title,event.title);assert.equal(result.events[0].calendarLabel,'Work');assert.equal(result.status.updatedAt,scan.checkedAt);assert.equal(result.status.mode,'connected-account');
});
test('empty successful secondary scan stays empty without replacing it from another source',async()=>{
 const result=await readCalendarSource({...args,snapshot:{calendars:[{...scan,events:[]}]},download:async()=>{throw Error('Should not fetch');}});
 assert.deepEqual(result.events,[]);assert.equal(result.status.state,'fresh');
});
test('stale or incomplete connected data falls back, and a failed fallback is unavailable',async()=>{
 for(const invalid of [{...scan,checkedAt:'2026-09-29T12:00:00Z'},{...scan,windowEnd:'2026-10-15'}]){
 let calls=0;const result=await readCalendarSource({...args,snapshot:{calendars:[invalid]},download:async()=>{calls++;throw Error('Unavailable');}});
 assert.equal(calls,1);assert.equal(result.status.state,'unavailable');assert.equal(result.status.updatedAt,null);assert.deepEqual(result.events,[]);
 }
 const result=await readCalendarSource({...args,snapshot:{},download:async()=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:public-event\r\nDTSTART:20261001T140000Z\r\nDTEND:20261001T150000Z\r\nSUMMARY:Public event\r\nEND:VEVENT\r\nEND:VCALENDAR`});
 assert.equal(result.status.mode,'public-feed');assert.equal(result.events[0].title,'Public event');
});
test('snapshot bounds match the configured feed window and mixed offsets sort chronologically',()=>{
 const later={...event,id:'outside',startDate:'2026-10-16',endDate:'2026-10-16'};
 assert.equal(calendarSnapshot({calendars:[{...scan,events:[event,later]}]},input,day,now,15).events.length,1);
 const earlier={...event,id:'early',title:'Earlier',start:'2026-10-01T20:00:00Z',end:'2026-10-01T21:00:00Z'};
 assert.deepEqual(mergeCalendarPlans([event,earlier]).map(x=>x.id),['early','work-event']);
});
