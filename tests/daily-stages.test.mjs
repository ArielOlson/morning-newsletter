import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile} from 'node:fs/promises'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {runStage, fingerprintPaths} from '../scripts/daily-stages.mjs';
test('daily stages resume successes but invalidate changed inputs, outputs, expiry and failures', async () => {
 const dir=await mkdtemp(join(tmpdir(),'daily-stage-')),path=join(dir,'run.json');let calls=0,time=0,output='one';
 const options={now:()=>time,maxAge:100,outputFingerprint:async()=>output};
 try{
  const work=async()=>{calls++;};
  await runStage(path,'build','input',work,options);
  assert.equal((await runStage(path,'build','input',work,options)).reused,true);
  output='tampered';await runStage(path,'build','input',work,options);assert.equal(calls,2);
  await runStage(path,'build','changed',work,options);assert.equal(calls,3);
  time=101;await runStage(path,'build','changed',work,options);assert.equal(calls,4);
  await assert.rejects(runStage(path,'verify','input',async()=>{throw Error('network');},options));
  assert.equal((await runStage(path,'verify','input',work,options)).reused,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('duplicate source copies do not invalidate a successful daily stage',async()=>{
 const original=process.cwd(),dir=await mkdtemp(join(tmpdir(),'source-copies-'));
 try{process.chdir(dir);await mkdir('scripts');await writeFile('scripts/check.mjs','canonical');const before=await fingerprintPaths(['scripts']);await writeFile('scripts/check 2.mjs','old copy');assert.equal(await fingerprintPaths(['scripts']),before);await writeFile('scripts/check.mjs','changed canonical');assert.notEqual(await fingerprintPaths(['scripts']),before);}
 finally{process.chdir(original);await rm(dir,{recursive:true,force:true});}
});
