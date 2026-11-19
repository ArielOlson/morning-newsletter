import assert from 'node:assert/strict';
import {addDays, dayInZone, selectCity, cityKeys} from './lib.mjs';
import {selectIdeas} from './ideas.mjs';
import {selectHeaderPhotos} from '../src/photography.mjs';
import {assertRecommendations} from './recommendation-check.mjs';
import {recommendationHistory} from './city-history.mjs';
import {readRecommendationState, eligibleRecommendations} from './recommendation-state.mjs';
import {hash, readJSON} from './workflow-utils.mjs';

export const PREPARATION_MAX_AGE = 18 * 60 * 60000;
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const digest = value => hash(JSON.stringify(stable(value)));
export const preparedPath = day => `.cache/prepared/${day}/research.local.json`;
export function preparationDay(args, now = new Date()) {
  const today = dayInZone(now, 'America/New_York');
  const index = args.indexOf('--for');
  const day = index >= 0 ? args[index + 1] : args.includes('--tomorrow') ? addDays(today, 1) : today;
  assert.ok([today, addDays(today, 1)].includes(day), 'Prepare only today or tomorrow in New York');
  return day;
}
export function preparationLinks(bundle) {
  return [...new Map([
    ...[...bundle.events, ...bundle.ideas].flatMap(x => [{url: x.url, image: false}, {url: x.image, image: true}]),
    {url: bundle.photo.src, image: true}, {url: bundle.photo.url, image: false}
  ].map(x => [JSON.stringify(x), x])).values()];
}
export const preparationDigest = bundle => digest({day: bundle.day, events: bundle.events, ideas: bundle.ideas, photo: bundle.photo});
const rawPicks = (items, pool) => items.map(x => structuredClone(pool.find(raw => raw.id === x.id)));
const uniqueFrom = (items, excluded) => {
  const seen = new Set(excluded.flatMap(cityKeys));
  return items.filter(x => { const keys = cityKeys(x); if (keys.some(k => seen.has(k))) return false; keys.forEach(k => seen.add(k)); return true; });
};

// Store raw source records. Reusing rendered ideas would duplicate their labels.
export function planPreparation({day, events, ideas, catalog, interests, history}, now = Date.now()) {
  const city = selectCity(events, day, interests, history);
  const selectedIdeas = selectIdeas(ideas, day, {}, 'America/New_York', [...history, ...city.items]);
  const selected = {finds: city.items, ideas: selectedIdeas, status: {recommendations: {cooldownDays: 7}}};
  assertRecommendations(selected, history);
  const excluded = [...history, ...city.items, ...selectedIdeas];
  const moreEvents = uniqueFrom(selectCity(events, day, interests, excluded).items, excluded);
  const reserveEvents = [...moreEvents.filter(x => x.discovery === true).slice(0, 2), ...moreEvents.filter(x => x.discovery !== true).slice(0, 2)];
  assert.equal(reserveEvents.length, 4, 'Prepare four spare events: two broader discoveries and two priority picks');
  const moreIdeas = uniqueFrom(selectIdeas(ideas, day, {}, 'America/New_York', [...excluded, ...reserveEvents]), [...excluded, ...reserveEvents]);
  const reserveIdeas = [...moreIdeas.filter(x => x.ideaGroup === 'dining').slice(0, 2), ...moreIdeas.filter(x => x.ideaGroup === 'activity' && x.costType === 'free').slice(0, 1), ...moreIdeas.filter(x => x.ideaGroup === 'activity' && x.costType === 'paid').slice(0, 1)];
  assert.equal(reserveIdeas.length, 4, 'Prepare four spare ideas: two dining, one free activity and one paid activity');
  const preparedEvents = rawPicks([...city.items, ...reserveEvents], events);
  const preparedIdeas = rawPicks([...selectedIdeas, ...reserveIdeas], ideas);
  const photo = selectHeaderPhotos({day, finds: preparedEvents, ideas: preparedIdeas}, catalog)[0];
  assert.ok(photo, 'Choose an independent seasonal header photograph');
  const bundle = {version: 1, day, plannedAt: new Date(now).toISOString(), events: preparedEvents, ideas: preparedIdeas, photo: structuredClone(photo)};
  bundle.fingerprint = preparationDigest(bundle);
  return bundle;
}
function recent(timestamp, now, age, label) {
  const value = Date.parse(timestamp);
  assert.ok(Number.isFinite(value) && value <= now && now - value <= age, `${label} is missing, future-dated or too old`);
}
export function validatePreparation(bundle, day, now = Date.now(), {sealed = true} = {}) {
  assert.ok(bundle?.version === 1 && bundle.day === day, 'Prepared research is missing for this edition');
  assert.equal(bundle.fingerprint, preparationDigest(bundle), 'Prepared research changed; review it again');
  assert.equal(bundle.events.length, 24, 'Prepare twenty events plus four replacements');
  assert.equal(bundle.ideas.length, 24, 'Prepare twenty ideas plus four replacements');
  recent(bundle.review?.checkedAt, now, PREPARATION_MAX_AGE, 'Editorial and original-photo review');
  assert.equal(bundle.review?.fingerprint, bundle.fingerprint, 'Review these exact sources and the original photo before sealing');
  if (sealed) { recent(bundle.sealedAt, now, PREPARATION_MAX_AGE, 'Prepared bundle'); assert.equal(bundle.seal, digest([bundle.fingerprint, bundle.review, bundle.links]), 'Preparation evidence changed after sealing'); }
  for (const item of [...bundle.events, ...bundle.ideas]) {
    for (const key of ['id', 'title', 'url', 'image', 'imageAlt', 'what', 'cost', 'neighborhood']) assert.ok(typeof item[key] === 'string' && item[key].trim(), `Prepared card lacks ${key}`);
    recent(item.checkedAt, now, 24 * 60 * 60000, 'Source facts');
  }
  const p = bundle.photo;
  assert.ok(Number.isInteger(p.width) && p.width > 0 && Number.isInteger(p.height) && p.height > 0, 'Record native header dimensions');
  assert.ok(p.day <= dayInZone(new Date(now), 'America/New_York'), 'Header first-selection date cannot be in the future');
  // An eligible prior scene is allowed with its unchanged original dates.
  assert.ok(Date.parse(p.checkedAt) <= now, 'Record the actual header source check time');
  for (const item of preparationLinks(bundle)) {
    const result = bundle.links?.find(x => x.url === item.url && x.image === item.image && x.ok);
    recent(result?.checkedAt, now, PREPARATION_MAX_AGE, 'Source or photograph availability check');
  }
  assert.equal(selectHeaderPhotos({day, finds: bundle.events, ideas: bundle.ideas}, {photos: [p]}).length, 1, 'Prepared header is no longer eligible or reuses a card photo');
  return bundle;
}
export function assertCurrentPreparation(bundle, {events, ideas, catalog}) {
  for (const [prepared, current] of [[bundle.events, events], [bundle.ideas, ideas]]) {
    for (const item of prepared) assert.ok(current.some(x => x.id === item.id && digest(x) === digest(item)), 'A prepared source changed; recheck and reseal it');
  }
  assert.ok(catalog.photos.some(x => digest(x) === digest(bundle.photo)), 'The prepared photo changed');
}
export async function preparationInputs(day, context = {}) {
  const history = context.history || await recommendationHistory(day, await readJSON('public/data/brief.json', {}));
  const choices = context.choices || await readRecommendationState();
  const events = (await readJSON('config/nyc-events.json', {events: []})).events;
  const ideas = (await readJSON('config/ideas.local.json', {ideas: []})).ideas;
  const catalog = await readJSON('config/photography.json', {photos: []});
  const interests = await readJSON('config/interests.local.json', {});
  return {day, history, choices, events, ideas, catalog, interests};
}
export async function selectPreparation(bundle, inputs) {
  const events = await eligibleRecommendations(bundle.events, inputs.choices.state);
  const ideas = await eligibleRecommendations(bundle.ideas, inputs.choices.state);
  const city = selectCity(events, bundle.day, inputs.interests, inputs.history.items);
  const selectedIdeas = selectIdeas(ideas, bundle.day, {}, 'America/New_York', [...inputs.history.items, ...city.items]);
  assertRecommendations({finds: city.items, ideas: selectedIdeas, status: {recommendations: {cooldownDays: 7}}}, inputs.history.items);
  return {city, ideas: selectedIdeas, photo: bundle.photo};
}
export async function loadPreparation(day, context = {}) {
  const bundle = validatePreparation(await readJSON(preparedPath(day), null), day);
  const inputs = await preparationInputs(day, context);
  assertCurrentPreparation(bundle, inputs);
  const selection = await selectPreparation(bundle, inputs);
  return {bundle, selection};
}
