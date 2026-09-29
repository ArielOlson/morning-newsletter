import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt } from '../src/crypto.mjs';
import { dayInZone } from './lib.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const checkout=resolve(root,'.cache/publish-repo');
const statePath=resolve(root,'.cache/publish-state.json');
const config=JSON.parse(await readFile(resolve(root,'config/publishing.json'),'utf8'));
const run=(program,args,cwd=checkout)=>execFileSync(program,program==='git'?['-c','credential.https://github.com.helper=!gh auth git-credential',...args]:args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim();
const optionalJSON=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
// Deliberate publication boundary: local snapshots and connection settings never enter Git.
const paths=['.gitignore','.node-version','.github/workflows/static.yml','AGENTS.md','DESIGN.md','README.md','index.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','vite.config.js','src','scripts','tests','docs','public/assets','config/calendar.example.json','config/events.example.json','config/events.json','config/nyc-events.json','config/preferences.json','config/sources.json','config/publishing.json','dist'];
const managed=path=>paths.some(p=>path===p||path.startsWith(`${p}/`));
const privatePath=path=>/(^|\/)\.env[^/]*$|(^|\/)config\/.*\.local\.json$|(^|\/)test-results\/|^public\/data\//.test(path);
let passwordBytes;
async function checkTree(path){
 for(const entry of await readdir(path,{withFileTypes:true})){
  const full=resolve(path,entry.name),rel=relative(root,full);
  if(entry.isSymbolicLink()||privatePath(rel)||(rel.startsWith('dist/data/')&&entry.isFile()&&!rel.endsWith('.enc.json')))throw new Error(`Refusing unexpected private file or symlink in publication: ${rel}`);
  if(entry.isDirectory())await checkTree(full);
  else if((await readFile(full)).includes(passwordBytes))throw new Error(`Refusing a file containing the newsletter password: ${rel}`);
 }
}
try{
 const briefText=await readFile(resolve(root,'public/data/brief.json'),'utf8');
 const brief=JSON.parse(briefText),age=Date.now()-Date.parse(brief.generatedAt);
 if(brief.day!==dayInZone(new Date(),brief.timezone)||!Number.isFinite(age)||age<0||age>90*60*1000)throw new Error('Refresh today’s edition before publishing (maximum age: 90 minutes).');
 const security=await optionalJSON(resolve(root,'config/security.local.json'));
 if(!security?.password)throw new Error('Newsletter encryption must be configured before publication.');
 passwordBytes=Buffer.from(security.password);
 const encrypted=await optionalJSON(resolve(root,'dist/data/brief.enc.json'));
 if(!encrypted || await decrypt(encrypted,security.password)!==briefText)throw new Error('Encrypted build is out of date. Run pnpm build before publishing.');
 if(await optionalJSON(resolve(root,'dist/data/brief.json')))throw new Error('Plaintext newsletter detected in build; refusing publication.');
 for(const dir of ['src','scripts','tests','docs','public/assets','dist'])await checkTree(resolve(root,dir));
 for(const path of paths.filter(p=>p.includes('.')&&!['public/assets'].includes(p))){
  try{if((await readFile(resolve(root,path))).includes(passwordBytes))throw new Error(`Refusing a file containing the newsletter password: ${path}`);}catch(e){if(!['ENOENT','EISDIR'].includes(e.code))throw e;}
 }
 await mkdir(resolve(root,'.cache'),{recursive:true});
 try{await readFile(resolve(checkout,'.git/HEAD'));}catch(e){if(e.code!=='ENOENT')throw e;run('gh',['repo','clone',config.repository,checkout],root);}
 const remote=run('git',['remote','get-url','origin']);
 if(![`https://github.com/${config.repository}`,`https://github.com/${config.repository}.git`,`git@github.com:${config.repository}.git`].includes(remote))throw new Error('Publishing checkout has an unexpected remote.');
 if(run('git',['status','--porcelain']))throw new Error('Publishing checkout has unfinished changes; review them before retrying.');
 if(run('git',['branch','--show-current'])!==config.branch)throw new Error('Publishing checkout is on a different branch.');
 run('git',['pull','--ff-only','origin',config.branch]);
 const prior=await optionalJSON(statePath);
 if(prior?.commit && run('git',['rev-parse',`origin/${config.branch}`])!==prior.commit){
  const changed=run('git',['diff','--name-only',`${prior.commit}..origin/${config.branch}`]).split('\n').filter(managed);
  if(changed.length)throw new Error(`Remote project files changed since the last publication. Reconcile these locally before retrying: ${changed.join(', ')}`);
 }
 const tracked=run('git',['ls-files']).split('\n');
 const privateFiles=tracked.filter(privatePath);
 if(privateFiles.length)run('git',['rm','--cached','--',...privateFiles]);
 // The old cloud refresh would replace connected snapshots with an incomplete edition.
 if(tracked.includes('.github/workflows/morning-edit.yml'))run('git',['rm','--','.github/workflows/morning-edit.yml']);
 await rm(resolve(checkout,'dist'),{recursive:true,force:true});
 const copied=[];
 for(const path of paths){
  try{await cp(resolve(root,path),resolve(checkout,path),{recursive:true});copied.push(path);}catch(e){if(e.code==='ENOENT'&&path==='.node-version')continue;throw e;}
 }
 run('git',['add','--',...copied]);
 const staged=run('git',['diff','--cached','--name-only','--diff-filter=ACMR']).split('\n').filter(Boolean);
 if(staged.some(privatePath))throw new Error('Private files were staged unexpectedly; refusing publication.');
 if(run('git',['diff','--cached','--name-only'])){
  run('git',['-c','user.name=Ariel Olson','-c','user.email=arielolson@users.noreply.github.com','commit','-m',`Update morning newsletter for ${brief.day}`]);
 }
 const commit=run('git',['rev-parse','HEAD']);
 run('git',['push','origin',config.branch]);
 await writeFile(statePath,JSON.stringify({commit,publishedAt:new Date().toISOString(),edition:brief.day},null,2)+'\n');
 console.log(`Pushed ${commit} to ${config.repository}. Verify the Pages workflow and ${config.website} before claiming deployment success.`);
}catch(e){
 console.error(e.status ? `Publication command failed (exit ${e.status}); inspect GitHub authentication and the publishing checkout before retrying.` : e.message);
 // Avoid echoing command stderr, which may include credential-bearing remote URLs.
 process.exitCode=1;
}
