import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dayInZone, addDays, calendarEvents, remindersFor, validateEvents, weatherSummary, parseFeed, parseSales, normalizeCalendarURL, parseFinance, topFinance, curatedFinance, deliverySnapshot, calendarSnapshot, mergeCalendarPlans, redSoxEvents } from './lib.mjs';
import {selectIdeas} from './ideas.mjs';
import {selectCity} from './lib.mjs';
import {previousCityEdition} from './city-history.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const readJSON = async (path, fallback) => { try { return JSON.parse(await readFile(path, 'utf8')); } catch(e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw new Error(`Cannot read ${path}: check JSON syntax`); } };
const atomic = async (path, data) => { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(data, null, 2)); await rename(temp,path); };
export async function download(url) {
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'ArielsMorningEdit/1.0 (personal daily reader)' } });
      if (!response.ok) throw new Error('Source unavailable');
      const bytes = await response.text();
      if (bytes.length > 6_000_000) throw new Error('Source too large');
      return bytes;
    } catch { if (attempt === 1) throw new Error('Could not refresh this source'); }
  }
}
async function main() {
  const prefs = await readJSON('config/preferences.json');
  if (!dayInZone(new Date(), prefs.timezone)) throw new Error('Invalid timezone');
  process.env.TZ = prefs.timezone;
  const now = new Date(), day = dayInZone(now, prefs.timezone);
  const sources = await readJSON('config/sources.json');
  const interests=await readJSON('config/interests.local.json',{});
  const calendar = await readJSON('config/calendar.local.json', await readJSON('config/calendar.example.json'));
  if (process.env.ICAL_URLS) calendar.urls = JSON.parse(process.env.ICAL_URLS);
  if (!Array.isArray(calendar.urls) || calendar.urls.some(u => typeof u !== 'string' || !/^((https:\/\/)|(webcal:\/\/))/.test(u))) throw new Error('Calendar urls must be an array of HTTPS or webcal links');
  const linkedCalendar = await readJSON('config/calendar-snapshot.local.json', {});
  const packages = deliverySnapshot(await readJSON('config/deliveries.local.json', null), now);
  const events = validateEvents([...(await readJSON('config/events.json')).events, ...(await readJSON('config/events.local.json', {events:[]})).events, ...(await readJSON('config/nyc-events.json', {events:[]})).events]);
  const old = await readJSON('public/data/brief.json', {});
  const previousCity=await previousCityEdition(day,old,prefs.timezone);
  const status = {}, errors = [];
  async function collect(name, get, fallback) {
    try { const data = await get(); status[name] = { state: 'fresh', updatedAt: now.toISOString() }; return data; }
    catch { errors.push(name); status[name] = { state: fallback ? 'stale' : 'unavailable', updatedAt: old.status?.[name]?.updatedAt || null }; return fallback ?? null; }
  }
  const forecastURL = new URL('https://api.open-meteo.com/v1/forecast');
  forecastURL.search = new URLSearchParams({ latitude: prefs.latitude, longitude: prefs.longitude, timezone: prefs.timezone,
    temperature_unit:'fahrenheit', wind_speed_unit:'mph', forecast_days:'2',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max', hourly:'temperature_2m,precipitation_probability' }).toString();
  async function readCalendar(input,i){
    try { const events=calendarEvents(await download(normalizeCalendarURL(input)),day,prefs.timezone,Math.min(90,Math.max(1,calendar.lookAheadDays||14)),calendar.includeDescriptions);status[`calendar${i}`]={state:'fresh',updatedAt:now.toISOString(),mode:'public-feed'};return events; }
    catch { const snapshot=calendarSnapshot(linkedCalendar,input,day,now);if(snapshot){status[`calendar${i}`]={state:'fresh',updatedAt:snapshot.checkedAt,mode:'connected-account',publicFeedAvailable:false};return snapshot.events;}errors.push(`calendar${i}`);status[`calendar${i}`]={state:'unavailable',updatedAt:null};return []; }
  }
  const jobs = [collect('weather', async()=> weatherSummary(JSON.parse(await download(forecastURL)), prefs, day), old.weather?.day === day ? old.weather : null),
    ...calendar.urls.map(readCalendar),
    ...sources.feeds.map((source,i)=>collect(`news${i}`, async()=>parseFeed(await download(source.url), source, prefs, now), null))];
  const [results, sales, financeResults] = await Promise.all([Promise.all(jobs), collect('sampleSales', async()=>parseSales(await download(sources.sampleSalesFeed),day,prefs.timezone), null), Promise.all((sources.financeFeeds||[]).map((source,i)=>collect(`finance${i}`,async()=>parseFinance(await download(source.url),source,now),null)))]);
  const games=await collect('redSox',async()=>redSoxEvents(JSON.parse(await download(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=111&startDate=${day}&endDate=${addDays(day,14)}`)),day,prefs.timezone),null);
  const finance=topFinance([...financeResults.flatMap(x=>x||[]),...curatedFinance(await readJSON('config/finance.local.json',{}),now)]);
  const weather = results[0];
  const plans = results.slice(1,1+calendar.urls.length).flatMap(x=>x||[]);
  const news = results.slice(1+calendar.urls.length).flatMap(x=>x||[]);
  const deduped = [...new Map(news.sort((a,b)=>b.score-a.score || b.publishedAt.localeCompare(a.publishedAt)).map(x=>[x.url,x])).values()].slice(0,prefs.maxFinds);
  const personal = events.filter(e => !e.category || e.category === 'personal');
  const cityEvents = events.filter(e => e.category && e.category !== 'personal' && (e.endDate || e.startDate) >= day && e.startDate <= addDays(day,14,prefs.timezone)).map(e => ({...e,kind:'event',source:e.source || 'Your picks'}));
  const city=selectCity([...cityEvents,...(games||[]),...(sales||[])],day,interests,previousCity.finds);
  status.city={state:city.issues.length?'partial':'fresh',updatedAt:now.toISOString(),comparedWith:previousCity.available?previousCity.day:null,repeats:city.repeats,discoveryCount:city.discoveryCount,issues:city.issues};
  if(city.issues.length)errors.push('city');
  const brief = { version:1, day, generatedAt:now.toISOString(), name:prefs.name, timezone:prefs.timezone, location:prefs.location,
    weather, calendar: { connected:calendar.urls.length>0, sourceCount:calendar.urls.length, state:calendar.urls.length ? (plans.length || !errors.some(e=>e.startsWith('calendar')) ? (errors.some(e=>e.startsWith('calendar')) ? 'partial' : 'fresh') : 'unavailable') : 'not-connected', events:mergeCalendarPlans(plans) },
    reminders:remindersFor(personal,day,prefs.timezone), upcomingReminders:personal.filter(e=>e.startDate>day && e.startDate<=addDays(day,14,prefs.timezone)),
    finds:city.items, finance, deliveries:packages, directories:sources.directories, status, errors };
  brief.ideas=selectIdeas((await readJSON('config/ideas.local.json',{ideas:[]})).ideas,day,brief.calendar,prefs.timezone);
  status.ideas={state:brief.ideas.length===5?'fresh':'partial',count:brief.ideas.length};
  if(brief.ideas.length<5)errors.push('ideas');
  await atomic('public/data/brief.json',brief);
  // Private calendar details are intentionally excluded from logs and history.
  console.log(`Morning edit updated for ${day}. Weather: ${status.weather.state}. Calendar: ${brief.calendar.state}. NYC finds: ${brief.finds.length}.`);
  if (errors.length) console.warn(`Sources needing attention: ${errors.join(', ')}. The page shows their availability accurately.`);
}
main().catch(() => { console.error('Refresh failed. Check config JSON, calendar URL format, and network access. The previous edition was preserved.'); process.exitCode=1; });
