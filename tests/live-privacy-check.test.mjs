import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPlaintextAbsent} from '../scripts/live-privacy-check.mjs';

test('one delayed retry revisits only failed canonical checks',async()=>{
 const calls=[],waits=[];let time=0;
 const result=await verifyPlaintextAbsent(['a','b','c'],async(path,options)=>{
  assert.deepEqual(options,{cacheBust:false,attempts:1});calls.push(path);
  return new Response('',{status:path==='b'&&calls.filter(p=>p==='b').length===1?503:404});
 },{now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms;}});
 assert.deepEqual(calls,['a','b','c','b']);assert.deepEqual(waits,[30000]);assert.deepEqual(result,{checked:3,retried:1});
});
test('exposed plaintext, redirects, forbidden responses and persistent failures fail closed',async()=>{
 for(const status of [200,301,403,503]){let calls=0;
  await assert.rejects(verifyPlaintextAbsent(['a'],async()=>{calls++;return new Response('',{status});},{sleep:async()=>{}}),/real 404/);
  assert.equal(calls,status===503?2:1);
 }
});
test('Retry-After is honored and excessive delays are reported without retry',async()=>{
 let calls=0,time=0;const waits=[];
 await verifyPlaintextAbsent(['a'],async()=>new Response('',{status:++calls===1?429:404,headers:{'retry-after':'45'}}),{now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms;}});
 assert.deepEqual(waits,[45000]);assert.equal(calls,2);
 await assert.rejects(verifyPlaintextAbsent(['a'],async()=>new Response('',{status:503,headers:{'retry-after':'120'}})),/exceeds one minute/);
});
test('network timeout retries once and successful checks never carry across invocations',async()=>{
 let calls=0;const request=async()=>{if(++calls===1)throw new DOMException('Timed out','TimeoutError');return new Response('',{status:404});};
 await verifyPlaintextAbsent(['a'],request,{sleep:async()=>{}});assert.equal(calls,2);
 await verifyPlaintextAbsent(['a'],request);assert.equal(calls,3);
 await assert.rejects(verifyPlaintextAbsent(['a'],async()=>{throw new TypeError('network');},{sleep:async()=>{}}),/network/);
});
