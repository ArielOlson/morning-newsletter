import ical from 'node-ical';
import { DateTime } from 'luxon';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const dayInZone = (date = new Date(), zone = 'America/New_York') => DateTime.fromJSDate(date, { zone }).toISODate();
export const addDays = (day, n, zone = 'America/New_York') => DateTime.fromISO(day, { zone }).plus({ days: n }).toISODate();
export const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
export function validateEvents(events) {
  if (!Array.isArray(events)) throw new Error('events must be an array');
  const ids = new Set();
  for (const event of events) {
    if (!event.id || ids.has(event.id)) throw new Error('Each event needs a unique id');
    ids.add(event.id);
    if (typeof event.title !== 'string' || !event.title.trim()) throw new Error('Each event needs a title');
    for (const key of ['startDate', 'endDate']) {
      if (key === 'endDate' && !event[key]) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event[key] || '') || !DateTime.fromISO(event[key]).isValid) throw new Error('Event dates must be valid YYYY-MM-DD dates');
    }
    if ((event.endDate || event.startDate) < event.startDate) throw new Error('Event endDate must not precede startDate');
    if (event.remindDaysBefore !== undefined && (!Number.isInteger(event.remindDaysBefore) || event.remindDaysBefore < 0 || event.remindDaysBefore > 365)) throw new Error('remindDaysBefore must be 0-365');
    if (event.url && !safeURL(event.url)) throw new Error('Event links must use HTTPS');
  }
  return events;
}
export function remindersFor(events, day, zone = 'America/New_York') {
  return validateEvents(events).filter(e => day >= addDays(e.startDate, -(e.remindDaysBefore ?? 7), zone))
    .map(e => ({ ...e, status: day < e.startDate ? 'upcoming' : day > (e.endDate || e.startDate) ? 'overdue' : 'today' })).sort((a,b) => a.startDate.localeCompare(b.startDate));
}
const localDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function calendarEvents(text, day, zone, lookAheadDays = 14, includeDescriptions = false) {
  if (!text.includes('BEGIN:VCALENDAR') || !text.includes('END:VCALENDAR')) throw new Error('Invalid calendar response');
  const parsed = ical.sync.parseICS(text);
  const from = DateTime.fromISO(day, { zone }).startOf('day');
  const to = from.plus({ days: lookAheadDays });
  const events = [];
  for (const e of Object.values(parsed)) {
    if (e.type !== 'VEVENT' || !e.start || e.status === 'CANCELLED') continue;
    const instances = ical.expandRecurringEvent(e, { from: from.minus({ days: 2 }).toJSDate(), to: to.plus({ days: 2 }).toJSDate(), expandOngoing: true });
    for (const item of instances) {
      const source = item.event;
      if (source.status === 'CANCELLED') continue;
      const startDate = item.isFullDay ? localDay(item.start) : dayInZone(item.start, zone);
      const endDate = item.isFullDay ? localDay(item.end) : dayInZone(new Date(Math.max(+item.start, +item.end - 1)), zone);
      if (startDate >= to.toISODate() || (item.isFullDay ? endDate <= day : item.end < from.toJSDate())) continue;
      events.push({ id: `${e.uid}:${item.start.toISOString()}`, title: item.summary || 'Untitled event',
        start: item.start.toISOString(), end: item.end.toISOString(), startDate, endDate,
        allDay: item.isFullDay, location: source.location || '', note: includeDescriptions ? source.description || '' : '', recurring: item.isRecurring });
    }
  }
  return events.sort((a,b) => a.startDate.localeCompare(b.startDate) || Number(b.allDay)-Number(a.allDay) || a.start.localeCompare(b.start));
}
export function weatherSummary(raw, prefs, day) {
  const d = raw.daily;
  const i = d?.time?.indexOf(day) ?? -1;
  if (i < 0 || !Number.isFinite(d.temperature_2m_max[i]) || !Number.isFinite(d.temperature_2m_min[i]) || !Number.isFinite(d.precipitation_probability_max[i])) throw new Error('Forecast missing required daily data');
  const chance = d.precipitation_probability_max[i];
  const high = Math.round(d.temperature_2m_max[i]);
  const low = Math.round(d.temperature_2m_min[i]);
  const code = d.weather_code[i];
  const condition = code === 0 ? 'Clear skies' : code <= 3 ? 'A little cloud cover' : code <= 48 ? 'Foggy' : code >= 95 ? 'Thunderstorms possible' : [71,73,75,77,85,86].includes(code) ? 'Snow in the forecast' : 'Rain in the forecast';
  const hours = (raw.hourly?.time || []).map((time,j) => ({ time, temperature: Math.round(raw.hourly.temperature_2m[j]), rain: raw.hourly.precipitation_probability[j] })).filter(h => h.time.startsWith(day) && +h.time.slice(11,13)>=6 && +h.time.slice(11,13)<=22);
  const wetHours = hours.filter(h => h.rain >= prefs.umbrellaThreshold);
  const umbrella = chance >= prefs.umbrellaThreshold || (code >= 51 && ![71,73,75,77,85,86].includes(code));
  const clothing = high < 40 ? 'Bundle up: a warm coat, scarf, and gloves.' : high < 55 ? 'A proper jacket will feel good today.' : high < 70 ? 'Take a light layer for the cooler parts of the day.' : high < 85 ? 'Light layers today; a cardigan for indoor AC.' : 'Keep it light and bring water. It will be hot.';
  const uv = d.uv_index_max?.[i];
  return { day, high, low, code, condition, chance, umbrella, clothing,
    advice: umbrella ? `Pack a small umbrella.${wetHours.length ? ` Rain is most likely around ${DateTime.fromISO(wetHours[0].time).toFormat('h a').toLowerCase()}.` : ' Keep an eye on the forecast before heading out.'}` : 'You can probably leave the umbrella at home.',
    uv: Number.isFinite(uv) ? uv : null, wind: d.wind_speed_10m_max?.[i] ?? null,
    hours: hours.filter(h => [8,12,16,20].includes(+h.time.slice(11,13))), source: 'https://open-meteo.com/' };
}
export function parseFeed(xml, source, prefs, now = new Date()) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid news feed');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: true, htmlEntities: true }).parse(xml);
  if (!parsed.rss?.channel && !parsed.feed) throw new Error('Not a news feed');
  const raw = parsed.rss?.channel?.item || parsed.feed?.entry || [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.flatMap(item => {
    const title = String(item.title?.['#text'] || item.title || '').replace(/<[^>]*>/g, '').trim().slice(0,200);
    const link = safeURL(typeof item.link === 'string' ? item.link : item.link?.['@_href']);
    const date = new Date(item.pubDate || item.published || item.updated);
    const age = (+now - +date) / 86400000;
    if (!title || !link || !Number.isFinite(age) || age < -1 || age > prefs.newsMaxAgeDays) return [];
    const lower = title.toLowerCase();
    if (prefs.excludeKeywords?.some(term => lower.includes(term))) return [];
    const score = prefs.interests.filter(term => lower.includes(term)).length;
    if (!score) return [];
    const category = /sample sale/.test(lower) ? 'Sample sales' : /pop.up|opening/.test(lower) ? 'Pop-ups' : /fall|autumn|season|winter|summer|spring|festival|halloween/.test(lower) ? 'Seasonal' : /free/.test(lower) ? 'Free & lovely' : 'Around town';
    return [{ id: link, title, url: link, source: source.name, publishedAt: date.toISOString(), category, score, kind: 'discovery' }];
  });
}

export function parseSales(xml, day, zone = 'America/New_York') {
  const data=new XMLParser({ignoreAttributes:false,processEntities:true,htmlEntities:true}).parse(xml);
  const root=data.pre?.root || data.root;
  if(!root)throw new Error('Sample sale feed changed');
  const items=root.event ? (Array.isArray(root.event)?root.event:[root.event]) : [];
  return items.flatMap(e=>{
    const startDate=DateTime.fromFormat(String(e.event_start_date),'MM/dd/yyyy').toISODate();
    const endDate=DateTime.fromFormat(String(e.event_end_date),'MM/dd/yyyy').toISODate();
    const url=safeURL(e.menu_url);
    if(e.event_market!=='NY'||!startDate||!endDate||endDate<day||startDate>addDays(day,14,zone)||!url||/cancel/i.test(e.event_status))return [];
    const rawImage=String(e.event_main_image||'');
    return [{id:`260:${e.event_id}`,title:`${e.event_name} sample sale`,startDate,endDate,url,category:'Sample sales',kind:'event',source:'260 Sample Sale',image:safeURL(rawImage.startsWith('//')?`https:${rawImage}`:rawImage),neighborhood:/NoMad|FLG/.test(e.event_location)?'NoMad':'Lafayette Street',where:e.event_location,cost:'Prices vary; admission not listed',note:`${e.event_location}. Check the source for daily opening hours and entry details.`}];
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate)).slice(0,20);
}

export function normalizeCalendarURL(value) {
  const url=new URL(String(value).replace(/^webcal:/,'https:'));
  if(url.protocol!=='https:')throw new Error('Calendar must use HTTPS or webcal');
  if(['calendar.google.com','www.google.com'].includes(url.hostname) && url.pathname.startsWith('/calendar') && !url.pathname.endsWith('.ics')){
    let id=url.searchParams.get('src');
    if(!id && url.searchParams.get('cid')){const cid=url.searchParams.get('cid');id=cid.includes('@')?cid:Buffer.from(cid,'base64url').toString('utf8');}
    if(!id || !id.includes('@') || /[\s\x00-\x1f]/.test(id))throw new Error('Use a Google public calendar link or iCal address');
    return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
  }
  return url.href;
}
const cleanText=value=>String(value?.['#text']??value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export const isRoundup=title=>/things.{0,35}(watch|know)|top \d+|what to (watch|know)|morning (brief|roundup)|daily (brief|roundup)/i.test(title);
export function parseFinance(xml,source,now=new Date()){
  if(XMLValidator.validate(xml)!==true)throw new Error('Invalid finance feed');
  const data=new XMLParser({processEntities:true,htmlEntities:true}).parse(xml);
  if(!data.rss?.channel)throw new Error('Not a finance feed');
  const items=data.rss.channel.item||[];
  return (Array.isArray(items)?items:[items]).flatMap(x=>{
    const title=cleanText(x.title),url=safeURL(x.link),date=new Date(x.pubDate),age=(now-date)/86400000;
    if(!title||!url||!Number.isFinite(age)||age<0||age>2||isRoundup(title)||url.includes('/videos/'))return [];
    const lower=title.toLowerCase();
    const topic=/yield|treasury|\bbond|interest rate|\bfed\b|inflation/.test(lower)?'rates':/\boil\b|energy|hormuz/.test(lower)?'energy':/stocks|s&p|nasdaq|dow |market|futures/.test(lower)?'markets':/econom|jobs|gdp|industrial|tariff/.test(lower)?'economy':'business';
    const context={rates:'Higher yields can affect borrowing costs, savings rates, and the price of existing bonds.',energy:'Energy prices feed into transport costs, inflation, and company margins.',markets:'Broad market moves help put individual stock headlines in context.',economy:'Growth and trade data can influence company earnings and interest-rate expectations.',business:'A business development to follow as markets open.'};
    return [{id:url,title,url,source:source.name,publishedAt:date.toISOString(),summary:cleanText(x.description).split(' ').slice(0,24).join(' '),context:context[topic],topic,score:({rates:5,energy:5,markets:5,economy:4,business:1})[topic]-age*.7}];
  });
}
export function curatedFinance(snapshot,now=new Date()){
 const age=(now-new Date(snapshot?.checkedAt))/3600000;
 if(!Number.isFinite(age)||age<0||age>30)return [];
 return (snapshot.stories||[]).filter(x=>x.title&&safeURL(x.url)&&!isRoundup(x.title)&&Array.isArray(x.bullets)&&x.bullets.length&&+new Date(x.publishedAt)<=+now&&+now-new Date(x.publishedAt)<48*3600000).map(x=>({...x,score:100,summary:x.summary||'',basis:x.basis||'Source summary'}));
}
export function topFinance(items){
 const candidates=[...new Map(items.filter(x=>!isRoundup(x.title)).map(x=>[x.url,x])).values()];
 const selected=[],topics=new Set(),sources=new Set();
 while(candidates.length&&selected.length<3){
  candidates.sort((a,b)=>(b.score-(topics.has(b.topic)?10:0)-(sources.has(b.source)?5:0))-(a.score-(topics.has(a.topic)?10:0)-(sources.has(a.source)?5:0))||b.publishedAt.localeCompare(a.publishedAt));
  const x=candidates.shift();selected.push(x);topics.add(x.topic);sources.add(x.source);
 }
 return selected;
}
export function cityKeys(item){
 const keys=item.id?[`id:${item.id}`]:[];
 if(safeURL(item.url)){const u=new URL(item.url);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);u.searchParams.sort();keys.push(`url:${u.href.replace(/\/$/,'')}`);}
 return keys;
}
export function selectCity(items,day,interests={},previous=[]){
 const seen=new Set(),prior=new Set(previous.flatMap(cityKeys));
 const score=x=>(x.priority||0)+(x.tags?.includes('red-sox')?40:0)+(interests.artists?.some(a=>x.title.toLowerCase().includes(a.toLowerCase()))?50:0)+(interests.brands?.some(a=>x.title.toLowerCase().includes(a.toLowerCase()))?30:0);
 const candidates=items.filter(x=>x.startDate&&x.startDate<=addDays(day,14)&&(x.endDate||x.startDate)>=day&&safeURL(x.url)).sort((a,b)=>score(b)-score(a)||a.startDate.localeCompare(b.startDate)).filter(x=>{const keys=cityKeys(x);if(keys.some(k=>seen.has(k)))return false;keys.forEach(k=>seen.add(k));return true;});
 // Yesterday’s events are excluded even if highly ranked or still running.
 // Search the quota space for ten picks with three or four discoveries.
 let states=new Map([['0:0:0',{picks:[],repeats:0,discoveries:0,score:0}]]);
 for(const [rank,item] of candidates.entries()){
  const repeat=cityKeys(item).some(k=>prior.has(k))?1:0,discovery=item.discovery===true?1:0;
  const next=new Map(states);
  for(const state of states.values()){
   const n=state.picks.length+1,r=state.repeats+repeat,d=state.discoveries+discovery;if(n>10||r>0||d>4)continue;
   const value={picks:[...state.picks,item],repeats:r,discoveries:d,score:state.score+candidates.length-rank},key=`${n}:${r}:${d}`;
   if(!next.has(key)||value.score>next.get(key).score)next.set(key,value);
  }
  states=next;
 }
 const best=[...states.values()].sort((a,b)=>b.picks.length-a.picks.length||(b.discoveries>=3)-(a.discoveries>=3)||b.score-a.score)[0];
 const issues=[];if(best.picks.length<10)issues.push(`Only ${best.picks.length} verified events fit today's rotation; more new picks are needed.`);if(best.discoveries<3)issues.push('Research at least three broader discoveries outside the requested priority categories.');
 return {items:best.picks.map(x=>({...x,what:x.what||x.note||x.title,where:x.where||x.location||'Location not confirmed',neighborhood:x.neighborhood||x.where||'Neighborhood not confirmed',when:x.when||null,cost:x.cost||'Not listed by the source'})),repeats:best.repeats,discoveryCount:best.discoveries,issues};
}
export function topCity(items,day,interests={},previous=[]){return selectCity(items,day,interests,previous).items;}
export function redSoxEvents(raw,day,zone='America/New_York'){
 return (raw.dates||[]).flatMap(d=>(d.games||[]).filter(g=>[3313,3289].includes(g.venue?.id)&&g.status?.abstractGameState==='Preview').map(g=>{
  const date=DateTime.fromISO(g.gameDate,{zone}),conditional=/Game 3/.test(g.description||'')&&g.gameType==='W';
  return {id:`mlb:${g.gamePk}`,title:`Red Sox at ${g.teams.home.team.name.replace('New York ','')} · ${g.description||'MLB'}`,startDate:date.toISODate(),endDate:date.toISODate(),kind:'event',category:'Around town',tags:['red-sox'],source:'MLB',url:`https://www.mlb.com/gameday/${g.gamePk}`,where:g.venue.name,neighborhood:g.venue.id===3313?'Concourse, Bronx':'Flushing, Queens',when:`${date.toFormat('LLL d')} · ${g.status.startTimeTBD?'Time TBD':date.toFormat('h:mm a')} ET${conditional?' · If necessary':''}`,cost:'Ticket prices vary; check availability',image:g.venue.id===3313?'https://img.mlbstatic.com/mlb-images/image/private/t_16x9/t_w640/mlb/tcuphjigdobyalzmii8y.jpg':'',imageAlt:g.venue.name,what:conditional?'Potential deciding game; played only if the series needs it.':'A Red Sox game in New York.',checkedAt:new Date().toISOString()};
 })).filter(x=>x.startDate>=day);
}
export function deliverySnapshot(snapshot,now=new Date()){
  const age=(now-new Date(snapshot?.checkedAt))/3600000;
  if(!snapshot||!Number.isFinite(age)||age<0||!Array.isArray(snapshot.shipments))return {state:'unavailable',checkedAt:null,shipments:[]};
  const shipments=[...new Map(snapshot.shipments.map(x=>[x.id,x])).values()].filter(x=>{
    if(!x.id||!x.merchant||!x.status||!Number.isFinite(+new Date(x.updatedAt)))return false;
    return x.status!=='delivered'||(+now-new Date(x.updatedAt))<7*86400000;
  });
  return {state:age>26?'stale':'fresh',checkedAt:snapshot.checkedAt,shipments,scope:snapshot.scope||'Connected email accounts'};
}
export function calendarSnapshot(snapshot,input,day,now=new Date(),lookAheadDays=14){
  const item=snapshot?.calendars?.find(x=>x.input===input),age=(now-new Date(item?.checkedAt))/3600000;
  if(!item||!Number.isFinite(age)||age<0||age>26||item.windowStart>day||item.windowEnd<addDays(day,lookAheadDays)||!Array.isArray(item.events))return null;
  return {events:item.events.filter(x=>x.startDate<addDays(day,lookAheadDays)&&(x.allDay?x.endDate>day:x.endDate>=day)),checkedAt:item.checkedAt};
}

export function mergeCalendarPlans(plans){
 const seen=new Set();return plans.filter(e=>{
  const key=[e.title.trim().toLowerCase(),new Date(e.start).toISOString(),new Date(e.end).toISOString(),e.location||''].join('|');
  if(seen.has(key))return false;seen.add(key);return true;
 }).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||Number(b.allDay)-Number(a.allDay));
}
