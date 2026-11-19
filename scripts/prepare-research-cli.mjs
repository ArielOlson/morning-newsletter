import {fileURLToPath} from 'node:url';
import {open, unlink} from 'node:fs/promises';
import {preparationDay, preparedPath, planPreparation, preparationDigest, preparationLinks, validatePreparation, preparationInputs, assertCurrentPreparation, selectPreparation, loadPreparation, digest} from './prepared-research.mjs';
import {eligibleRecommendations} from './recommendation-state.mjs';
import {readJSON, atomicJSON, mapBounded} from './workflow-utils.mjs';
import {probe} from './research-plan.mjs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2).filter(x => x !== '--'), command = args[0] || 'status';
let lock;
try {
  const day = preparationDay(args), path = preparedPath(day);
  if (!['status','plan','links','reviewed','seal','check'].includes(command)) throw Error('Use research:prepare status, plan, links, reviewed, seal or check');
  await atomicJSON('.cache/prepared/.directory.local.json', {private: true});
  lock = await open('.cache/prepared/run.lock', 'wx', 0o600);
  await lock.writeFile(JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
  let bundle = await readJSON(path, null);
  if (command === 'status') console.log(JSON.stringify({day, prepared: !!bundle?.sealedAt, plannedAt: bundle?.plannedAt, sealedAt: bundle?.sealedAt, path}));
  else if (command === 'plan') {
    const inputs = await preparationInputs(day);
    const next = planPreparation({...inputs, events: await eligibleRecommendations(inputs.events, inputs.choices.state), ideas: await eligibleRecommendations(inputs.ideas, inputs.choices.state), history: inputs.history.items});
    if (next.fingerprint !== bundle?.fingerprint) { bundle = next; await atomicJSON(path, bundle); }
    console.log(JSON.stringify({day, events: 24, ideas: 24, path, sealed: !!bundle.sealedAt}));
  } else if (command === 'check') {
    const ready = await loadPreparation(day);
    console.log(JSON.stringify({day, ready: true, events: ready.selection.city.items.length, ideas: ready.selection.ideas.length, preparedAt: ready.bundle.sealedAt}));
  } else {
    if (!bundle || bundle.fingerprint !== preparationDigest(bundle)) throw Error('Plan and inspect the current research first');
    assertCurrentPreparation(bundle, await preparationInputs(day));
    if (command === 'links') {
      const existing = bundle.links || [];
      bundle.links = await mapBounded(preparationLinks(bundle), 2, async item => {
        const old = existing.find(x => x.url === item.url && x.image === item.image && x.ok && Date.parse(x.checkedAt) <= Date.now() && Date.now() - Date.parse(x.checkedAt) < 3600000);
        if (old) return old;
        try { return {...item, ...await probe(item.url, item.image)}; }
        catch { return {...item, ok: false, reason: 'Unavailable; inspect or replace'}; }
      });
      delete bundle.sealedAt; delete bundle.seal;
      await atomicJSON(path, bundle);
      const failed = bundle.links.filter(x => !x.ok).length;
      console.log(JSON.stringify({day, failed, note: 'Availability is not editorial fact or photo verification.'}));
      if (failed) process.exitCode = 1;
    } else if (command === 'reviewed') {
      bundle.review = {checkedAt: new Date().toISOString(), fingerprint: bundle.fingerprint};
      delete bundle.sealedAt; delete bundle.seal;
      await atomicJSON(path, bundle);
      console.log('Recorded your completed source, card-photo and original-header review.');
    } else {
      validatePreparation(bundle, day, Date.now(), {sealed: false});
      await selectPreparation(bundle, await preparationInputs(day));
      bundle.sealedAt = new Date().toISOString(); bundle.seal = digest([bundle.fingerprint, bundle.review, bundle.links]);
      await atomicJSON(path, bundle);
      console.log(JSON.stringify({day, sealedAt: bundle.sealedAt, path, note: 'Private preparation only; no edition was built or published.'}));
    }
  }
} catch (error) { console.error(error.code === 'EEXIST' ? 'Preparation is already running; inspect the lock owner before resuming.' : error.message); process.exitCode = 1; }
finally { if (lock) { await lock.close(); await unlink('.cache/prepared/run.lock'); } }
