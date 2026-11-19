import {atomicJSON, readJSON, hash} from './workflow-utils.mjs';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
export async function fingerprintPaths(paths) {
  const entries = [];
  async function visit(path) {
    try { entries.push([path, hash(await readFile(path))]); }
    catch (error) {
      if (error.code === 'ENOENT') { entries.push([path, 'absent']); return; }
      if (error.code !== 'EISDIR') throw error;
      for (const item of (await readdir(path)).sort()) await visit(join(path,item));
    }
  }
  for (const path of paths) await visit(path);
  return hash(JSON.stringify(entries));
}
export async function runStage(path, name, input, work, {now = Date.now, maxAge = Infinity, outputFingerprint = async () => null} = {}) {
  const state = await readJSON(path, {version: 1, stages: {}}), old = state.stages[name];
  const output = await outputFingerprint();
  if (old?.state === 'complete' && old.input === input && old.output === output && now() >= old.finishedAt && now() - old.finishedAt < maxAge) return {reused: true};
  state.stages[name] = {state: 'running', input, startedAt: now()}; await atomicJSON(path, state);
  try {
    await work(); const finishedAt = now();
    state.stages[name] = {...state.stages[name], state: 'complete', finishedAt, seconds: (finishedAt - state.stages[name].startedAt)/1000, output: await outputFingerprint()};
    await atomicJSON(path, state); return {reused: false};
  } catch (error) {
    state.stages[name] = {...state.stages[name], state: 'failed', finishedAt: now()};
    await atomicJSON(path, state); throw error;
  }
}
