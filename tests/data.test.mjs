import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvents, remindersFor, validateEvents, weatherSummary, parseFeed, dayInZone, addDays } from '../scripts/lib.mjs';
process.env.TZ='America/New_York';
const wrap = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;
test('New York dates and reminders are inclusive across daylight saving',()=>{
  assert.equal(dayInZone(new Date('2026-09-28T02:00:00Z')),'2026-09-27');
  assert.equal(addDays('2026-10-31',2),'2026-11-02');
  const events=[{id:'a',title:'Birthday week',startDate:'2026-11-02',endDate:'2026-11-08',remindDaysBefore:2}];
  assert.equal(remindersFor(events,'2026-10-30').length,0);
  assert.equal(remindersFor(events,'2026-10-31')[0].status,'upcoming');
  assert.equal(remindersFor(events,'2026-11-08')[0].status,'today');
  assert.equal(remindersFor(events,'2026-11-09').length,0);
});
test('bad dates, reversed ranges, duplicate IDs and unsafe URLs fail validation',()=>{
  for(const e of [{startDate:'2026-02-30'},{startDate:'2026-10-03',endDate:'2026-10-02'},{startDate:'2026-10-03',url:'javascript:alert(1)'},{startDate:'2026-10-03',remindDaysBefore:-1}])assert.throws(()=>validateEvents([{id:'x',title:'Test',...e}]));
  assert.throws(()=>validateEvents([{id:'x',title:'Test',startDate:'2026-10-03'},{id:'x',title:'Test',startDate:'2026-10-03'}]));
});
test('calendar RRULE preserves local time through DST and handles cancellation, EXDATE and moved occurrence',()=>{
  const text=wrap(`BEGIN:VEVENT\r\nUID:weekly\r\nDTSTART;TZID=America/New_York:20261025T090000\r\nDTEND;TZID=America/New_York:20261025T100000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE;TZID=America/New_York:20261108T090000\r\nSUMMARY:Weekly coffee\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:weekly\r\nRECURRENCE-ID;TZID=America/New_York:20261115T090000\r\nDTSTART;TZID=America/New_York:20261115T110000\r\nDTEND;TZID=America/New_York:20261115T120000\r\nSUMMARY:Moved coffee\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:cancelled\r\nDTSTART:20261101T180000Z\r\nSTATUS:CANCELLED\r\nSUMMARY:Cancelled\r\nEND:VEVENT`);
  const events=calendarEvents(text,'2026-10-25','America/New_York',30);
  assert.equal(events.length,3);
  assert.equal(events[0].start,'2026-10-25T13:00:00.000Z');
  assert.equal(events[1].start,'2026-11-01T14:00:00.000Z');
  assert.equal(events[2].title,'Moved coffee');
  assert.equal(events[2].start,'2026-11-15T16:00:00.000Z');
});
test('all-day multi-day events retain dates and exclusive end; ongoing timed plans included',()=>{
  const text=wrap(`BEGIN:VEVENT\r\nUID:trip\r\nDTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261103\r\nSUMMARY:Trip\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:overnight\r\nDTSTART;TZID=America/New_York:20261031T230000\r\nDTEND;TZID=America/New_York:20261101T020000\r\nSUMMARY:Overnight\r\nEND:VEVENT`);
  const e=calendarEvents(text,'2026-11-01','America/New_York',3);
  assert.equal(e.length,2);assert.equal(e[0].startDate,'2026-10-31');assert.equal(e[0].endDate,'2026-11-03');assert.equal(e[0].allDay,true);
  assert.equal(calendarEvents(text,'2026-11-03','America/New_York',3).length,0);
  assert.throws(()=>calendarEvents('<html>Not a calendar</html>','2026-11-01','America/New_York'));
});
test('umbrella advice uses the full-day rain chance and does not manufacture missing weather',()=>{
  const raw={daily:{time:['2026-09-27'],temperature_2m_max:[69],temperature_2m_min:[52],precipitation_probability_max:[50],weather_code:[61]},hourly:{time:['2026-09-27T08:00'],temperature_2m:[57],precipitation_probability:[50]}};
  const summary=weatherSummary(raw,{umbrellaThreshold:35},'2026-09-27');assert.equal(summary.umbrella,true);assert.match(summary.advice,/8 am/);assert.match(summary.clothing,/light layer/);
  assert.throws(()=>weatherSummary(raw,{umbrellaThreshold:35},'2026-09-28'));
});
test('news excludes stale, unrelated and unsafe stories, preserving publication date as a lead',()=>{
  const item=(title,date,link)=>`<item><title>${title}</title><pubDate>${date}</pubDate><link>${link}</link></item>`;
  const xml=`<rss><channel>${item('A fall market opens','Sun, 27 Sep 2026 10:00:00 GMT','https://example.com/fall')}${item('Ancient sample sale','Sun, 01 Mar 2026 10:00:00 GMT','https://example.com/old')}${item('Sample sale','Sun, 27 Sep 2026 10:00:00 GMT','javascript:alert(1)')}${item('Political update','Sun, 27 Sep 2026 10:00:00 GMT','https://example.com/news')}</channel></rss>`;
  const parsed=parseFeed(xml,{name:'Test'},{interests:['fall','sample sale'],newsMaxAgeDays:10},new Date('2026-09-27T12:00:00Z'));
  assert.equal(parsed.length,1);assert.equal(parsed[0].kind,'discovery');assert.equal(parsed[0].category,'Seasonal');assert.equal(parsed[0].startDate,undefined);
});

test('sample sales use real dates and exclude expired and non-NYC events',async()=>{
  const {parseSales}=await import('../scripts/lib.mjs');
  const event=(market,start,end)=>`<event><event_id>${market}-${start}</event_id><event_name>Test brand</event_name><event_market>${market}</event_market><event_start_date>${start}</event_start_date><event_end_date>${end}</event_end_date><event_location>Soho</event_location><menu_url>https://260samplesale.com/pages/events/test</menu_url></event>`;
  const sales=parseSales(`<pre><root>${event('NY','09/28/2026','10/04/2026')}${event('NY','09/01/2026','09/03/2026')}${event('LA','09/28/2026','10/04/2026')}</root></pre>`,'2026-09-27');assert.equal(sales.length,1);assert.equal(sales[0].startDate,'2026-09-28');assert.equal(sales[0].kind,'event');
});

test('Google sharing links normalize to public ICS; Apple and direct ICS are supported',async()=>{
 const {normalizeCalendarURL}=await import('../scripts/lib.mjs');
 const id='test@example.com';const expected='https://calendar.google.com/calendar/ical/test%40example.com/public/basic.ics';
 assert.equal(normalizeCalendarURL(`https://calendar.google.com/calendar/u/1?cid=${Buffer.from(id).toString('base64')}`),expected);
 assert.equal(normalizeCalendarURL('https://calendar.google.com/calendar/embed?src=test%40example.com'),expected);
 assert.equal(normalizeCalendarURL('webcal://example.com/feed.ics'),'https://example.com/feed.ics');
 assert.equal(normalizeCalendarURL(expected),expected);
 assert.throws(()=>normalizeCalendarURL('javascript:bad'));assert.throws(()=>normalizeCalendarURL('https://calendar.google.com/calendar/u/1'));
});
test('connected calendar fallback rejects old scans and incomplete date windows',async()=>{
 const {calendarSnapshot}=await import('../scripts/lib.mjs');const now=new Date('2026-09-28T06:00:00Z');
 const c={input:'configured',checkedAt:now.toISOString(),windowStart:'2026-09-28',windowEnd:'2026-10-12',events:[]};
 assert.ok(calendarSnapshot({calendars:[c]},'configured','2026-09-28',now));
 assert.equal(calendarSnapshot({calendars:[c]},'different','2026-09-28',now),null);
 assert.equal(calendarSnapshot({calendars:[{...c,checkedAt:'2026-09-26T00:00:00Z'}]},'configured','2026-09-28',now),null);
 assert.equal(calendarSnapshot({calendars:[{...c,windowEnd:'2026-10-01'}]},'configured','2026-09-28',now),null);
});
test('finance returns three distinct recent stories, excludes future and stale items',async()=>{
 const {parseFinance,topFinance}=await import('../scripts/lib.mjs');
 const item=(title,link,date='Mon, 28 Sep 2026 01:00:00 GMT')=>`<item><title>${title}</title><link>https://example.com/${link}</link><pubDate>${date}</pubDate><description>A short explanation.</description></item>`;
 const rows=parseFinance(`<rss><channel>${item('Oil prices rise','a')}${item('Bond yields rise','b')}${item('Stocks dip','c')}${item('Oil rises again','d')}${item('Old stocks','old','Mon, 01 Jun 2026 01:00:00 GMT')}${item('Future stocks','future','Mon, 30 Sep 2030 01:00:00 GMT')}</channel></rss>`,{name:'CNBC'},new Date('2026-09-28T06:00:00Z'));
 assert.equal(rows.length,4);const selected=topFinance([...rows,...rows]);assert.equal(selected.length,3);assert.equal(new Set(selected.map(x=>x.topic)).size,3);
});
test('city selection removes expired events, deduplicates, caps at three and provides detail fields',async()=>{
 const {topCity}=await import('../scripts/lib.mjs');
 const events=[{id:'expired',endDate:'2026-09-27',priority:99},...Array.from({length:5},(_,i)=>({id:String(i),title:'Event',url:`https://example.com/${i}`,kind:'event',startDate:'2026-09-29',endDate:'2026-10-02'}))];
 const chosen=topCity([...events,events[1]],'2026-09-28');assert.equal(chosen.length,3);assert.equal(new Set(chosen.map(x=>x.id)).size,3);assert.equal(chosen.some(x=>x.id==='expired'),false);assert.equal(chosen[0].cost,'Not listed by the source');
});
test('delivery scans retain separate parcels, flag stale data and expire old delivered records',async()=>{
 const {deliverySnapshot}=await import('../scripts/lib.mjs');const now=new Date('2026-09-28T06:00:00Z');
 const shipments=[{id:'one',merchant:'Store',status:'shipped',updatedAt:'2026-09-20T00:00:00Z'},{id:'two',merchant:'Store',status:'delivered',updatedAt:'2026-09-27T00:00:00Z'},{id:'old',merchant:'Store',status:'delivered',updatedAt:'2026-09-01T00:00:00Z'}];
 const result=deliverySnapshot({checkedAt:'2026-09-28T05:00:00Z',shipments},now);assert.equal(result.state,'fresh');assert.deepEqual(result.shipments.map(x=>x.id),['one','two']);
 assert.equal(deliverySnapshot({checkedAt:'2026-09-26T05:00:00Z',shipments},now).state,'stale');assert.equal(deliverySnapshot(null,now).state,'unavailable');
});

test('two calendars merge shared events and sort by time',async()=>{const {mergeCalendarPlans}=await import('../scripts/lib.mjs');const e={id:'a',title:'Dinner',start:'2026-09-30T18:00:00-04:00',end:'2026-09-30T19:00:00-04:00',location:'Cafe'};assert.equal(mergeCalendarPlans([e,{...e,id:'b',start:'2026-09-30T22:00:00Z',end:'2026-09-30T23:00:00Z'}]).length,1);});
