import {atomicJSON, readJSON} from './workflow-utils.mjs';
export async function verificationCheckpoint(path, fingerprint, {now = Date.now, maxAge = 15 * 60000} = {}) {
  let state = await readJSON(path, null);
  if (!state || state.fingerprint !== fingerprint || !Number.isFinite(state.startedAt) || now() < state.startedAt || now() - state.startedAt > maxAge || state.complete) {
    state = {version: 1, fingerprint, startedAt: now(), passed: {}};
  }
  let writes = Promise.resolve();
  const save = () => { const snapshot = structuredClone(state); writes = writes.then(() => atomicJSON(path, snapshot)); return writes; };
  return {
    has(key) { const time = state.passed[key]; return Number.isFinite(time) && now() >= time && now() - time <= maxAge; },
    async pass(key) { state.passed[key] = now(); await save(); },
    async complete() { state.complete = true; await save(); }
  };
}
