import {transientStatus, retryDelay} from './retry-policy.mjs';
import assert from 'node:assert/strict';

// Keep successful canonical checks only for this invocation. Retry each failed
// GET once after the first pass, never restart the whole archive walk or turn a
// server error into evidence of absence. A 200/redirect/403 is a hard failure.
export async function verifyPlaintextAbsent(paths,request,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,log=()=>{}}={}){
 const pending=[];
 const check=async(path,retry)=>{
  let r;
  try{r=await request(path,{cacheBust:false,attempts:1});}
  catch(error){
   if(!retry&&(error instanceof TypeError||['TimeoutError','AbortError'].includes(error.name))){pending.push({path,after:now()+30000});log(`Retry queued after network failure: ${path}`);return;}
   throw error;
  }
  const status=r.status,header=r.headers.get('retry-after');
  await r.body?.cancel();
  if(status===404){log(`Verified absent: ${path}`);return;}
  if(!retry&&transientStatus(status)){
   const wait=retryDelay(header,{now:now()});
   assert.ok(!(wait>60000),`Live privacy check unavailable (HTTP ${status}; Retry-After exceeds one minute): ${path}`);
   pending.push({path,after:now()+Math.max(30000,Number.isFinite(wait)?wait:30000)});log(`Retry queued after HTTP ${status}: ${path}`);return;
  }
  assert.equal(status,404,`Plaintext must return a real 404: ${path}`);
 };
 for(const path of new Set(paths))await check(path,false);
 for(const task of pending){const delay=task.after-now();if(delay>0)await sleep(delay);await check(task.path,true);}
 return {checked:new Set(paths).size,retried:pending.length};
}
