import {readJSON, atomicJSON, sleep} from './workflow-utils.mjs';
// Retry only known hosting/artifact availability failures, once per commit across resumes.
export async function waitForPages({commit, checkpoint, getRun, failedLog, rerun, now = Date.now, wait = sleep, timeout = 600000}) {
  let saved = await readJSON(checkpoint, {});
  if (saved.commit !== commit) saved = {commit, retried: false};
  const deadline = now() + timeout;
  while (now() < deadline) {
    const run = await getRun();
    if (run && run.head_sha === commit && run.status === 'completed') {
      if (run.conclusion === 'success') return run;
      // The rerun API can return before the run's attempt/status has updated.
      if (saved.retried && run.id === saved.runId && run.run_attempt <= saved.attempt) { await wait(10000); continue; }
      if (run.conclusion !== 'failure' || saved.retried) throw Error('The exact Pages deployment failed after its allowed retry, or was cancelled');
      const log = await failedLog(run.id);
      if (!/No artifacts named .github-pages.|Fetching artifact metadata failed|Pages artifact did not become available|HTTP (?:502|503|504)|Service Unavailable|Internal Server Error/.test(log)) throw Error('Pages failed; inspect the deployment error before retrying');
      saved = {commit, retried: true, runId: run.id, attempt: run.run_attempt};
      await atomicJSON(checkpoint, saved); // Never replay the retry after a process interruption.
      await rerun(run.id);
    }
    await wait(10000);
  }
  throw Error('Pages has not finished; resume release to check the same commit');
}
