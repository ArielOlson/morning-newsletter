import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {open, unlink, readdir} from 'node:fs/promises';
import {dayInZone} from './lib.mjs';
import {assertPackageScan} from './package-scan.mjs';
import {assertRecommendations} from './recommendation-check.mjs';
import {recommendationHistory} from './city-history.mjs';
import {readJSON, atomicJSON, sleep, hash} from './workflow-utils.mjs';
import {fingerprintPaths, runStage} from './daily-stages.mjs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const day = dayInZone(new Date(), 'America/New_York'), directory = `.cache/daily/${day}`, path = directory + '/run.local.json';
const args = process.argv.slice(2).filter(x => x !== '--'), command = args[0] || 'status';
const execute = (program, arguments_, capture = false) => new Promise((resolve, reject) => {
  const child = spawn(program, arguments_, {stdio: capture ? ['ignore','pipe','pipe'] : ['ignore','inherit','inherit'], timeout: program==='gh'?30000:180000}); let output = '';
  if (capture) { child.stdout.on('data', b => output += b); child.stderr.resume(); }
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(output) : reject(Error(`${program} failed; progress retained`)));
});
const reviewKeys=['chatReview','financeReview','recommendationFacts','headerPhoneAndDesktop'];
async function reviewFingerprint(key){
 if(key==='chatReview')return day;
 if(key==='financeReview')return fingerprintPaths(['config/finance.local.json']);
 if(key==='recommendationFacts')return fingerprintPaths(['config/nyc-events.json','config/ideas.local.json']);
 const brief=await readJSON('public/data/brief.json');
 return hash(JSON.stringify(brief.photography)+await fingerprintPaths(['dist/index.html']));
}
async function checkReviews(keys){
 const editorial=await readJSON(directory+'/editorial.local.json',{});
 for(const key of keys){
  const value=editorial[key],time=Date.parse(value?.checkedAt);
  if(!Number.isFinite(time)||time>Date.now()||dayInZone(new Date(time),'America/New_York')!==day||value?.complete!==true||value.input!==await reviewFingerprint(key))throw Error(`Finish and record ${key} for these inputs`);
 }
}
async function preflight() {
  const connections = await readJSON('config/connections.local.json');
  const packages = await readJSON('config/deliveries.local.json');
  assertPackageScan(packages, connections.gmail.map(a => a.account));
  if (dayInZone(new Date(packages.checkedAt), 'America/New_York') !== day) throw Error('Complete today’s package scan before preparing the edition');
  const snapshots = await readJSON('config/calendar-snapshot.local.json');
  const calendar = await readJSON('config/calendar.local.json');
  for (const entry of connections.googleCalendars) {
    const scan = snapshots.calendars.find(x => x.input === calendar.urls[entry.inputIndex]);
    if (!scan || dayInZone(new Date(scan.checkedAt), 'America/New_York') !== day) throw Error('Complete every configured calendar scan today');
  }
  await checkReviews(['chatReview','financeReview','recommendationFacts']);
}
let lock;
try {
  if(command==='reviewed'){
    const key=args[1];if(!reviewKeys.includes(key))throw Error('Unknown editorial review stage');
    const editorial=await readJSON(directory+'/editorial.local.json',{});
    editorial[key]={complete:true,checkedAt:new Date().toISOString(),input:await reviewFingerprint(key)};
    await atomicJSON(directory+'/editorial.local.json',editorial);console.log('Recorded your completed review for the current inputs.');
  }else if (command === 'status') {
    console.log(JSON.stringify(await readJSON(path, {day, next: 'Scan connectors using package:queue; prepare research:plan and private editorial review, then daily prepare/release.'}), null, 2));
  } else {
    if (!['prepare','release'].includes(command)) throw Error('Use daily status, prepare or release');
    await atomicJSON(directory + '/.directory.local.json', {day});
    lock = await open('.cache/daily-run.lock', 'wx', 0o600);await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
    await preflight();
    const source = await fingerprintPaths(['src','scripts','tests','package.json','pnpm-lock.yaml','index.html','vite.config.js']);
    const historyFiles=(await readdir('dist/data/editions')).filter(x=>x.endsWith('.enc.json')&&!x.startsWith(day)).map(x=>'dist/data/editions/'+x);
    const input = await fingerprintPaths(['config',...historyFiles]);
    const stage = (name, key, work, options) => runStage(path, name, key, work, options).then(r => console.log(`${name}: ${r.reused ? 'reused verified result' : 'complete'}`));
    await stage('refresh', hash(day + source + input), () => execute('pnpm',['refresh']), {maxAge: 60 * 60000, outputFingerprint: () => fingerprintPaths(['public/data/brief.json'])});
    const brief = await readJSON('public/data/brief.json');
    if (brief.day !== day || brief.errors?.length) throw Error('Resolve edition source/selection failures before publishing');
    assertRecommendations(brief, (await recommendationHistory(day)).items);
    await stage('tests', source, () => execute('pnpm',['test']));
    const buildInput = hash(source + await fingerprintPaths(['public/data/brief.json','public/assets','config/photography.json']));
    await stage('build', buildInput, () => execute('pnpm',['build']), {outputFingerprint: () => fingerprintPaths(['dist'])});
    if (command === 'release') {
      await checkReviews(['headerPhoneAndDesktop']);
      // The publisher ALWAYS rereads durable state, checks freshness and reconciles the remote.
      await stage('publish', buildInput, () => execute('pnpm',['publish:newsletter']), {maxAge: 0});
      const publication = await readJSON('.cache/publish-state.json');
      const config = await readJSON('config/publishing.json');
      await stage('pages', publication.commit, async () => {
        const until = Date.now() + 10 * 60000;
        while (Date.now() < until) {
          const data = JSON.parse(await execute('gh',['run','list','--repo',config.repository,'--workflow','static.yml','--commit',publication.commit,'--limit','10','--json','headSha,status,conclusion,databaseId'], true));
          const run = data.find(x => x.headSha === publication.commit);
          if (run?.status === 'completed') { if (run.conclusion !== 'success') throw Error('The exact Pages deployment failed'); return; }
          await sleep(10000);
        }
        throw Error('Pages has not finished; resume release to check this commit again');
      });
      await stage('verify', hash(publication.commit + await fingerprintPaths(['dist'])), () => execute('pnpm',['verify:live']), {maxAge: 15 * 60000});
    }
  }
} catch (error) { console.error(error.code === 'EEXIST' ? 'A daily run is already active; inspect a stale lock before restarting.' : error.message); process.exitCode = 1; }
finally { if (lock) { await lock.close(); await unlink('.cache/daily-run.lock'); } }
