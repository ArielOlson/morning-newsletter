import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile, open, unlink} from 'node:fs/promises';
import {mergePackageEvidence} from './package-scan.mjs';
import {dayInZone} from './lib.mjs';
import {readJSON, atomicJSON} from './workflow-utils.mjs';
import {createPackageQueue, claimRequest, queueNext, recordResult, reviewEvidence, finalizeQueue} from './package-queue.mjs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const day = dayInZone(new Date(), 'America/New_York');
const path = '.cache/gmail-queue.local.json', command = process.argv[2] || 'status';
const connections = await readJSON('config/connections.local.json');
const accounts = connections.gmail.map(a => a.account);
// A short file lock prevents two local agents from claiming the same request.
await atomicJSON(`.cache/daily/${day}/.directory.local.json`, {day});
const lockPath = path + '.lock'; let lock;
try {
  lock = await open(lockPath, 'wx', 0o600);await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  let queue = await readJSON(path, null);
  if (queue && queue.day !== day && queue.inFlight && !['record','abandon'].includes(command)) throw Error('Resolve the prior scan’s claimed request before starting a new day');
  if(command==='new-scan' && queue && !queue.completedAt)throw Error('Finish the active scan before starting another; do not bypass its retry limit');
  if (!queue || queue.day !== day && !queue.inFlight || command==='new-scan') {
    const priorQueue = queue;
    let previous = await readJSON('config/deliveries.local.json', {shipments: []});
    if (priorQueue) {
      await atomicJSON(`.cache/daily/${priorQueue.day}/gmail-${priorQueue.runId}.local.json`,priorQueue);
      previous = {...previous, shipments: mergePackageEvidence(previous.shipments,priorQueue.baseline), scanAccounts: priorQueue.accounts};
    }
    queue = createPackageQueue(accounts, previous, day);
    if(priorQueue) {queue.interval=priorQueue.interval;queue.readyAt=Math.max(queue.readyAt,priorQueue.readyAt);}
    await atomicJSON(path, queue);
  }
  if (JSON.stringify(queue.accounts.map(a => a.account)) !== JSON.stringify(accounts)) throw Error('Account configuration changed; reconcile this scan before continuing');
  if(queue.completedAt && !['status','next'].includes(command)) throw Error('This scan is already finalized; do not advance its check time');
  if (queue.completedAt) console.log(JSON.stringify({state:'complete',checkedAt:queue.completedAt}));
  else if (command === 'abandon') {
    if(!queue.inFlight)throw Error('No claimed request to release');
    recordResult(queue,{requestId:queue.inFlight.id,error:'INTERRUPTED'});await atomicJSON(path,queue);console.log(JSON.stringify(queueNext(queue)));
  }
  else if (command === 'next') { const next = claimRequest(queue); await atomicJSON(path, queue); console.log(JSON.stringify(next)); }
  else if (command === 'record' || command === 'review') {
    const input = process.argv[3]; if (!input) throw Error('Provide a private JSON evidence/result file');
    const value = JSON.parse(await readFile(resolve(input), 'utf8'));
    if (command === 'record') recordResult(queue, value); else reviewEvidence(queue, value);
    await atomicJSON(path, queue); console.log(JSON.stringify(queueNext(queue)));
  } else if (command === 'finalize') {
    const snapshot = finalizeQueue(queue, accounts);
    await atomicJSON('config/deliveries.local.json', snapshot);
    queue.completedAt = snapshot.checkedAt; await atomicJSON(path, queue);
    console.log('Complete package coverage saved.');
  } else if (command === 'status' || command === 'new-scan') console.log(JSON.stringify(queueNext(queue)));
  else throw Error('Use status, next, record, review or finalize');
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Another package queue command is running. If it crashed, inspect and remove only its stale lock.' : error.message);
  process.exitCode = 1;
} finally { if (lock) { await lock.close(); await unlink(lockPath); } }
