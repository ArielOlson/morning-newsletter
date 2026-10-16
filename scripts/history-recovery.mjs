import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {decrypt} from '../src/crypto.mjs';
import {addDays} from './lib.mjs';

const cards=e=>[...(e.finds||[]),...(e.ideas||[]),...(e.recommendationExposures||[])];
const identity=({id,url,recommendationKey})=>({id,url,...(recommendationKey?{recommendationKey}:{})});

// Pure verification boundary: absent files alone never establish a missed run.
export function verifyRecoveryEvidence({day,zone,head,runs,totalRuns,versions,live,local,observedAt}){
 assert.equal(runs.length,totalRuns,'Incomplete deployment history');
 assert.ok(runs.length&&runs.every(r=>r.status==='completed'),'Deployment history unavailable or still changing');
 const successes=runs.filter(r=>r.conclusion==='success');
 assert.equal(successes[0]?.head_sha,head,'Main must match the latest successful deployment');
 const latest=versions.find(v=>v.sha===head);
 assert.ok(latest,'Published commit is missing');
 assert.deepEqual(live,latest.current,'Live edition differs from the published commit');
 const priorRecovery=live.status?.recommendations?.recovery;
 const continuation=live.day===day&&priorRecovery?.mode==='verified-publication-gap';
 if(continuation){
  const anchor=versions.find(v=>v.sha===priorRecovery.commit);
  assert.ok(anchor&&anchor.current.day===priorRecovery.lastPublishedDay&&anchor.current.day<addDays(day,-1,zone),'Same-day recovery requires its verified original published anchor');
 }else assert.ok(live.day<addDays(day,-1,zone),'A published yesterday edition must be restored, not bypassed');
 assert.ok(Number.isFinite(Date.parse(observedAt)),'Missing actual observation time');
 const latestDays=new Map(latest.editions.map(e=>[e.day,e]));
 assert.deepEqual(latestDays.get(live.day),live,'Published current edition is missing from its archive');
 for(const run of successes)assert.ok(versions.some(v=>v.sha===run.head_sha),'A deployed commit could not be verified');
 for(const version of versions){
  assert.ok(version.current?.day&&Array.isArray(version.editions),'Invalid publication history');
  assert.deepEqual(version.editions.find(e=>e.day===version.current.day),version.current,'A published edition is missing from its commit archive');
  for(const edition of version.editions)assert.ok(latestDays.has(edition.day),'A previously published archive was removed');
 }
 for(const [date,edition] of latestDays){
  const localEdition=local.find(e=>e.day===date);
  if(continuation&&date===day){
   assert.ok(localEdition,'Local current-day archive is missing');
   const exposures=new Set(cards(localEdition).map(c=>JSON.stringify(identity(c))));
   assert.ok(cards(edition).every(c=>exposures.has(JSON.stringify(identity(c)))),'Same-day update lost published recommendation exposures');
  }else assert.deepEqual(localEdition,edition,'Local history differs from the verified published archive');
 }
 const items=versions.flatMap(v=>[v.current,...v.editions]).filter(e=>e.day<day).flatMap(cards).map(identity);
 return {days:[...latestDays.keys()].sort().reverse(),items,
  observed:cards(live).map(identity),recovery:continuation?{...priorRecovery,verifiedCommit:head,observedAt}:{mode:'verified-publication-gap',commit:head,lastPublishedDay:live.day,observedAt}};
}

export async function recoverPublicationGap(day,zone='America/New_York'){
 const config=JSON.parse(await readFile('config/publishing.json','utf8'));
 const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
 const run=(program,args)=>execFileSync(program,args,{cwd:'.cache/publish-repo',encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
 const git=(...args)=>run('git',args);
 const expected=[`https://github.com/${config.repository}`,`https://github.com/${config.repository}.git`,`git@github.com:${config.repository}.git`];
 assert.ok(expected.includes(git('remote','get-url','origin')),'Unexpected history repository');
 git('-c','credential.https://github.com.helper=!gh auth git-credential','fetch','origin',config.branch);
 assert.equal(git('rev-parse','--is-shallow-repository'),'false','Full Git history is required for recovery');
 const head=git('rev-parse',`origin/${config.branch}`);
 const pages=JSON.parse(run('gh',['api',`repos/${config.repository}/actions/workflows/static.yml/runs?per_page=100`,'--paginate','--slurp']));
 const runs=pages.flatMap(p=>p.workflow_runs),totalRuns=pages[0]?.total_count;
 assert.ok(pages.every(p=>p.total_count===totalRuns),'Deployment history changed during verification');
 const required=new Set([head,...runs.filter(r=>r.conclusion==='success').map(r=>r.head_sha),...git('log','--format=%H',head,'--','dist/data/brief.enc.json').split('\n')]);
 const revisions=git('rev-list','--reverse',head).split('\n').filter(sha=>required.has(sha));
 assert.equal(revisions.length,required.size,'Published commits are missing from complete Git history');
 const cache=new Map();
 async function decode(text){const key=createHash('sha256').update(text).digest('hex');if(!cache.has(key))cache.set(key,JSON.parse(await decrypt(JSON.parse(text),password)));return cache.get(key);}
 const versions=[];let archiveIntroduced=false;
 for(const sha of revisions){
  assert.match(sha,/^[a-f0-9]{40}$/);
  git('merge-base','--is-ancestor',sha,head);
  const at=path=>decode(git('show',`${sha}:dist/data/${path}`));
  const current=await at('brief.enc.json');
  // Early encrypted releases predate the archive feature. Their actual current
  // payload is still evidence, and its day must exist in the latest archive.
  const hasArchive=!!git('ls-tree','--name-only',sha,'dist/data/archive.enc.json');
  if(!hasArchive){assert.equal(archiveIntroduced,false,'An archive was removed after introduction');versions.push({sha,current,editions:[current]});continue;}
  archiveIntroduced=true;
  const index=await at('archive.enc.json'),editions=[];
  assert.ok(index.editions?.length,'Empty archive');
  for(const entry of index.editions){
   assert.match(entry.day,/^\d{4}-\d{2}-\d{2}$/);assert.equal(entry.file,`editions/${entry.day}.enc.json`);
   const edition=await at(entry.file);assert.equal(edition.day,entry.day);assert.equal(edition.generatedAt,entry.generatedAt);editions.push(edition);
  }
  assert.equal(new Set(editions.map(e=>e.day)).size,editions.length,'Duplicate archived days');
  versions.push({sha,current,editions});
 }
 const get=async path=>{
  const url=new URL(path,config.website);url.searchParams.set('historyCheck',Date.now());
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'Live history unavailable');
  return decode(await r.text());
 };
 const live=await get('data/brief.enc.json'),liveIndex=await get('data/archive.enc.json');
 const published=versions.find(v=>v.sha===head),local=[];
 assert.deepEqual(liveIndex,await decode(git('show',`${head}:dist/data/archive.enc.json`)),'Live archive index differs from GitHub');
 for(const entry of liveIndex.editions){
  const remote=await get(`data/${entry.file}`);
  assert.deepEqual(remote,published.editions.find(e=>e.day===entry.day),'Live historical edition differs from GitHub');
  local.push(await decode(await readFile(`dist/data/${entry.file}`,'utf8')));
 }
 // Recheck HEAD after all reads so publication cannot race a changing remote.
 assert.equal(run('gh',['api',`repos/${config.repository}/commits/${config.branch}`,'--jq','.sha']),head,'Remote changed during recovery');
 return verifyRecoveryEvidence({day,zone,head,runs,totalRuns,versions,live,local,observedAt:new Date().toISOString()});
}
