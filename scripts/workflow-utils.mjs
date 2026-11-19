import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicJSON(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
  await rename(temporary, path);
}
// Wait for already-started work on failure; do not leave writes running after return.
export async function mapBounded(items, concurrency, worker) {
  const results = new Array(items.length); let next = 0, failure;
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try { results[index] = await worker(items[index], index); }
      catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
  return results;
}
export function requestGate({interval = 250, now = Date.now, wait = sleep} = {}) {
  let tail = Promise.resolve(), next = 0, pausedUntil = 0;
  return {
    pause(ms) { pausedUntil = Math.max(pausedUntil, now() + ms); },
    before() {
      const turn = tail.then(async () => {
        while (Math.max(next, pausedUntil) > now()) await wait(Math.max(next, pausedUntil) - now());
        next = now() + interval;
      });
      tail = turn.catch(() => {}); return turn;
    }
  };
}

// Finder/sync conflict copies are not executable project inputs or publishable source.
export const isSourceDuplicate = path => /^(scripts|tests|docs)\/.* \d+\.(mjs|js|md|json|css)$/.test(path);
