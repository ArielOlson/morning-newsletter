import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dayInZone, addDays, selectCity, cityKeys} from './lib.mjs';
import {selectIdeas} from './ideas.mjs';
import {recommendationHistory} from './city-history.mjs';
import {readRecommendationState, eligibleRecommendations} from './recommendation-state.mjs';
import {selectHeaderPhotos} from '../src/photography.mjs';
import {hash, readJSON, atomicJSON, mapBounded} from './workflow-utils.mjs';

export function inventory(items, selected, day, history) {
  const prior = new Set(history.flatMap(cityKeys));
  const eligible = items.filter(x => (!x.availableThrough || x.availableThrough >= day) && !cityKeys(x).some(k => prior.has(k)) && !x.dateSpecific && !x.planWeekend && !x.preferredWeekday).filter(x => {
    const md = day.slice(5); return !x.seasonStart || !x.seasonEnd || (x.seasonStart <= x.seasonEnd ? md >= x.seasonStart && md <= x.seasonEnd : md >= x.seasonStart || md <= x.seasonEnd);
  });
  return {total: items.length, eligibleBeforeSelection: eligible.length, selected: selected.length,
    buckets: Object.fromEntries(['dining','activity'].flatMap(group => ['free','paid'].map(cost => [group+'-'+cost, eligible.filter(x => x.ideaGroup === group && x.costType === cost).length]))),
    needsFactRecheck: eligible.filter(x => !x.checkedAt || x.checkedAt.slice(0,10) < addDays(day,-7)).map(x => x.id),
    missingFields: eligible.filter(x => !x.cost || !x.what || !x.image || !x.imageAlt || !x.url).map(x => x.id)};
}
export async function probe(url, image = false, fetcher = fetch) {
  const response = await fetcher(url, {signal: AbortSignal.timeout(15000), headers: {'User-Agent': 'ArielsMorningEdit/1.0'}});
  if (!response.ok) { await response.body?.cancel(); return {ok: false, status: response.status}; }
  const contentType = response.headers.get('content-type') || '';
  if (image && !contentType.startsWith('image/')) { await response.body?.cancel(); return {ok: false, reason: 'Image URL did not return an image'}; }
  const reader = response.body.getReader(), maximum = image ? 12_000_000 : 2_000_000; let size = 0;
  try { while (true) { const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); return {ok: false, reason: 'Resource exceeds review limit'}; } } }
  finally { reader.releaseLock(); }
  return {ok: size > 0, status: response.status, contentType, bytes: size, checkedAt: new Date().toISOString()};
}
async function main() {
  process.chdir(fileURLToPath(new URL('..', import.meta.url)));
  const day = dayInZone(new Date(), 'America/New_York'), old = await readJSON('public/data/brief.json', {});
  const history = await recommendationHistory(day, old), choices = await readRecommendationState();
  const events = (await readJSON('config/nyc-events.json', {events: []})).events;
  const interests = await readJSON('config/interests.local.json', {});
  const city = selectCity(await eligibleRecommendations(events.filter(x => x.startDate <= addDays(day,14) && (x.endDate || x.startDate) >= day), choices.state), day, interests, history.items);
  const pool = await eligibleRecommendations((await readJSON('config/ideas.local.json', {ideas: []})).ideas, choices.state);
  const ideas = selectIdeas(pool, day, {}, 'America/New_York', [...history.items, ...city.items]);
  const header = selectHeaderPhotos({day, finds: city.items, ideas}, await readJSON('config/photography.json', {photos: []}));
  const cards = [...city.items, ...ideas], fingerprint = hash(JSON.stringify([cards, header]));
  const report = {version: 1, day, checkedAt: new Date().toISOString(), fingerprint, stateCheckedAt: choices.checkedAt, city: {selected: city.items.length, issues: city.issues}, ideas: inventory(pool, ideas, day, [...history.items, ...city.items]), cards, header};
  const path = `.cache/daily/${day}/research.local.json`;
  if (process.argv.includes('--check-links')) {
    const previous = await readJSON(path, {}), cached = previous.fingerprint === fingerprint ? previous.links || [] : [];
    const links = [...new Map([...cards.flatMap(x => [{url: x.url, image: false}, {url: x.image, image: true}]), ...header.map(x => ({url: x.src, image: true}))].filter(x => x.url).map(x => [JSON.stringify(x), x])).values()];
    report.links = await mapBounded(links, 2, async item => {
      const old = cached.find(x => x.url === item.url && x.image === item.image && x.ok && Date.now() - Date.parse(x.checkedAt) < 3600000);
      if (old) return old;
      try { return {...item, ...await probe(item.url, item.image)}; }
      catch { return {...item, ok: false, reason: 'Resource unavailable; inspect or replace'}; }
    });
  }
  await atomicJSON(path, report);
  console.log(JSON.stringify({day, events: report.city, ideas: report.ideas, ...(report.links ? {failedLinks: report.links.filter(x => !x.ok).length} : {}), report: path, note: 'Availability checks do not verify dates, prices, photo suitability, or user preferences. Inspect sources and images before publication.'}));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch(() => { console.error('Research planning failed; check private state, history and source access.'); process.exitCode = 1; });
