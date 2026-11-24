import test from 'node:test';
import assert from 'node:assert/strict';
import {planPreparation, validatePreparation, preparationLinks, reusablePreparationLinks, preparationDay, selectPreparation, preparationDigest, assertCurrentPreparation, digest, PREPARATION_MAX_AGE} from '../scripts/prepared-research.mjs';
import {emptyState} from '../src/sync.mjs';
import {historyId} from '../src/history.mjs';
import {selectHeaderPhotos} from '../src/photography.mjs';
const now = Date.parse('2026-11-19T02:00:00Z'), day = '2026-11-19';
const card = id => ({id, title: id, url: `https://example.com/${id}`, image: `https://example.com/${id}.jpg`, imageAlt: id, what: 'Source details.', neighborhood: 'Manhattan', cost: 'Verified cost', checkedAt: new Date(now).toISOString()});
const events = Array.from({length: 40}, (_, i) => ({...card('event'+i), startDate: day, endDate: '2026-11-30', discovery: i < 12}));
const ideas = Array.from({length: 44}, (_, i) => ({...card('idea'+i), suggested: true, ideaGroup: i < 12 ? 'dining' : 'activity', costType: i < 24 ? 'paid' : 'free'}));
const photo = {day: '2026-11-18', editionDay: day, availableThrough: '2026-11-30', src: 'https://example.com/scene.jpg', url: 'https://example.com/scene', source: 'Photographer', alt: 'Autumn scenery', width: 1800, height: 1200, checkedAt: new Date(now).toISOString()};
const inputs = () => ({day, events, ideas, catalog: {photos: [photo]}, interests: {}, history: []});
function seal() {
  const b = planPreparation(inputs(), now);
  b.review = {fingerprint: b.fingerprint, checkedAt: new Date(now).toISOString()};
  b.links = preparationLinks(b).map(x => ({...x, ok: true, checkedAt: new Date(now).toISOString()}));
  b.sealedAt = new Date(now).toISOString(); b.seal = digest([b.fingerprint,b.review,b.links]);
  return b;
}
test('preparation keeps raw records, reserves, real evening times and tomorrow-only header selection', () => {
  const b = seal(); validatePreparation(b, day, now + 8 * 3600000);
  assert.equal(b.events.length, 24); assert.equal(b.ideas.length, 24);
  assert.ok(b.ideas.every(x => !x.what.startsWith('Suggested for you.')));
  assert.equal(b.photo.day, '2026-11-18');
  assert.equal(selectHeaderPhotos({day: '2026-11-18'}, {photos: [photo]}).length, 0);
  assert.equal(selectHeaderPhotos({day}, {photos: [photo]}).length, 1);
  assert.equal(selectHeaderPhotos({day: '2026-11-20'}, {photos: [photo]})[0].day, '2026-11-18');
  assert.equal(preparationDay(['--tomorrow'], new Date(now)), day);
  assert.throws(() => preparationDay(['--for','2026-12-01'], new Date(now)));
});
test('new durable completions and all same-day historical exposures use spares without weakening quotas', async () => {
  const b = seal(), state = emptyState();
  const completed = b.ideas.find(x => x.ideaGroup === 'dining');
  state.history.completed[await historyId('idea', completed.id)] = new Date(now).toISOString();
  const exposed = b.events[0];
  const result = await selectPreparation(b, {...inputs(), history: {items: [exposed]}, choices: {state}});
  assert.equal(result.city.items.length, 20); assert.equal(result.ideas.length, 20);
  assert.ok(!result.city.items.some(x => x.id === exposed.id));
  assert.ok(!result.ideas.some(x => x.id === completed.id));
  assert.ok(result.ideas.every(x => x.what === 'Suggested for you. Source details.'));
  await assert.rejects(selectPreparation(b, {...inputs(), history: {items: b.events}, choices: {state}}), /twenty/);
});
test('missing, outdated, future-dated or edited preparation never passes as ready', () => {
  assert.throws(() => validatePreparation(null, day, now));
  assert.throws(() => validatePreparation(seal(), day, now + PREPARATION_MAX_AGE + 1), /too old/);
  assert.throws(() => validatePreparation(seal(), day, now - 1), /future/);
  assert.throws(() => validatePreparation(seal(), '2026-11-20', now), /missing/);
  const b = seal(); b.events[0].cost = 'Changed'; assert.throws(() => validatePreparation(b, day, now), /changed/);
  const failed = seal(); failed.links[0].ok = false; failed.seal = digest([failed.fingerprint,failed.review,failed.links]); assert.throws(() => validatePreparation(failed, day, now), /availability/);
  const stale = seal(); stale.events[0].checkedAt = '2026-11-10T12:00:00Z'; stale.fingerprint = preparationDigest(stale); stale.review.fingerprint = stale.fingerprint;
  assert.throws(() => validatePreparation(stale, day, now, {sealed:false}), /Source facts/);
});
test('new unrelated research does not invalidate preparation but changed selected facts do', () => {
  const b = seal(); assert.doesNotThrow(() => assertCurrentPreparation(b, {...inputs(), events:[...events,card('extra')]}));
  assert.throws(() => assertCurrentPreparation(b, {...inputs(), events: events.map(x => x.id === b.events[0].id ? {...x,cost:'Changed'} : x)}), /changed/);
  assert.throws(() => planPreparation({...inputs(), ideas: ideas.filter(x => x.ideaGroup !== 'dining')}, now), /twenty/);
});

test('replanning one source preserves only recent exact availability checks and requires fresh review', () => {
  const previous = seal(), next = planPreparation(inputs(), now + 1000);
  next.events[0].url = 'https://example.com/replacement';
  next.fingerprint = preparationDigest(next);
  previous.links[2].ok = false;
  previous.links[3].checkedAt = new Date(now - 3600000).toISOString();
  previous.links[4].checkedAt = new Date(now + 10000).toISOString();
  previous.links[5].image = !previous.links[5].image;
  next.links = reusablePreparationLinks(previous, next, now + 1000);
  assert.ok(!next.links.some(x => x.url === previous.events[0].url));
  for (const i of [2,3,4,5]) assert.ok(!next.links.some(x => x.url === previous.links[i].url));
  assert.ok(next.links.some(x => x.url === previous.links[6].url && x.checkedAt === new Date(now).toISOString()));
  assert.equal(next.review, undefined); assert.equal(next.seal, undefined);
  assert.throws(() => validatePreparation(next, day, now + 1000, {sealed:false}), /review/);
});
