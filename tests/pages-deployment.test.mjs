import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {waitForPages} from '../scripts/pages-deployment.mjs';
test('Pages transient artifact failure retries only once and waits for the new attempt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pages-retry-')),checkpoint=join(dir,'retry.json');let time=0,polls=0,retries=0;
 const failed={id:10,head_sha:'abc',status:'completed',conclusion:'failure',run_attempt:1};
 try{
  const result=await waitForPages({commit:'abc',checkpoint,now:()=>time,wait:async ms=>time+=ms,getRun:async()=>++polls<=2?failed:{...failed,conclusion:'success',run_attempt:2},failedLog:async()=> 'No artifacts named "github-pages" were found',rerun:async()=>retries++});
  assert.equal(result.run_attempt,2);assert.equal(retries,1);assert.equal(polls,3);
  await assert.rejects(waitForPages({commit:'abc',checkpoint,now:()=>time,wait:async ms=>time+=ms,getRun:async()=>({...failed,run_attempt:2}),failedLog:async()=>'',rerun:async()=>retries++}),/allowed retry/);
  assert.equal(retries,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Pages does not retry code failures, cancellation or a different commit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pages-no-retry-'));let retries=0,time=0;
 const base={commit:'expected',checkpoint:join(dir,'state.json'),now:()=>time,wait:async ms=>time+=ms,timeout:100,failedLog:async()=> 'Invalid configuration',rerun:async()=>retries++};
 try{
  await assert.rejects(waitForPages({...base,getRun:async()=>({head_sha:'expected',status:'completed',conclusion:'failure'})}),/inspect/);
  await assert.rejects(waitForPages({...base,getRun:async()=>({head_sha:'expected',status:'completed',conclusion:'cancelled'})}),/cancelled/);
  await assert.rejects(waitForPages({...base,getRun:async()=>({head_sha:'other',status:'completed',conclusion:'success'})}),/not finished/);
  assert.equal(retries,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
