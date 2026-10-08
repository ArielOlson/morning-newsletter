import {encrypt,decrypt} from './crypto.mjs';
export const syncRepo='ArielOlson/morning-newsletter-state';
export const credentialKey='morning-edit-sync-credential-v1';
export const emptyState=()=>({version:1,reminders:{},packages:{},saved:{},history:{received:{},completed:{},clicked:{}}});
export const activeValues=bucket=>Object.values(bucket||{}).filter(Boolean);
export function validState(s){
 if(s?.version!==1)throw Error('Saved data has an unsupported format. Nothing was replaced.');
 for(const k of ['reminders','packages','saved','history'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))throw Error('Saved data could not be read. Nothing was replaced.');
 for(const k of ['received','completed','clicked'])if(!s.history[k]||typeof s.history[k]!=='object'||Array.isArray(s.history[k]))throw Error('Saved history could not be read. Nothing was replaced.');
 for(const k of ['recommendationExclusions','recommendationProfile'])if(s[k]!==undefined&&(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k])))throw Error('Saved preferences could not be read. Nothing was replaced.');
 return s;
}
// Every mutation reads the latest version and uses GitHub's SHA precondition.
// Conflict retries reapply only the requested change, never a stale whole-device snapshot.
export function createSync({fetcher=fetch,isCurrent=()=>true,onChange=()=>{}}={}){
 let token=null,password=null,state=null,queue=Promise.resolve(),epoch=0;
 const api='https://api.github.com/repos/'+syncRepo;
 async function request(path,options={}){
  const response=await fetcher(api+path,{...options,cache:'no-store',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...options.headers},signal:AbortSignal.timeout(20000)});
  if(!response.ok){const error=Error(response.status===401||response.status===403?'GitHub access needs reconnecting. Your saved data is still there.':response.status===404?'Private saved data is unavailable. Check the repository and access key; nothing was reset.':'GitHub could not confirm this save. Please try again.');error.status=response.status;error.code='sync-error';throw error;}
  return response.json();
 }
 async function read(){
  const result=await request('/contents/state.enc.json?ref=main&t='+Date.now());
  if(result.type!=='file'||!result.sha||result.encoding!=='base64'||!result.content)throw Error('Saved data could not be read. Nothing was replaced.');
  const envelope=JSON.parse(atob(result.content.replace(/\s/g,'')));
  return {sha:result.sha,data:validState(JSON.parse(await decrypt(envelope,password)))};
 }
 async function connect(accessKey,secret){
  const current=++epoch;token=accessKey.trim();password=secret;
  try{const repo=await request('');if(repo.private!==true||repo.full_name!==syncRepo)throw Error('Sync requires the designated private repository.');const result=await read();if(current!==epoch||!isCurrent())throw Error('Unlock before connecting.');state=result.data;onChange();return state;}
  catch(error){if(current===epoch){token=null;password=null;state=null;}throw error;}
 }
 function refresh(){
  const current=epoch;
  const run=async()=>{if(!token)return null;const result=await read();if(current!==epoch||!isCurrent())return null;state=result.data;onChange();return state;};
  const result=queue.then(run);queue=result.catch(()=>{});return result;
 }
 function change(apply){
  const current=epoch;
  const run=async()=>{
   if(!token||!state)throw Object.assign(Error('Connect cross-device saving in Settings before saving. Nothing has been lost.'),{code:'sync-error'});
   for(let attempt=0;attempt<3;attempt++){
    if(current!==epoch||!isCurrent())throw Error('Unlock before saving.');
    const latest=await read();const next=validState(apply(structuredClone(latest.data)));
    const encoded=JSON.stringify(await encrypt(JSON.stringify(next),password));
    if(current!==epoch||!isCurrent())throw Error('The newsletter locked before saving.');
    try{await request('/contents/state.enc.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update encrypted newsletter choices',branch:'main',sha:latest.sha,content:btoa(encoded)})});if(current===epoch&&isCurrent()){state=next;onChange();}return next;}
    catch(error){if(![409,422].includes(error.status)||attempt===2)throw error;}
   }
  };
  const result=queue.then(run);queue=result.catch(()=>{});return result;
 }
 return {connect,refresh,change,get state(){return state;},get connected(){return !!state&&!!token;},clear(){epoch++;token=null;password=null;state=null;onChange();}};
}
export function importLegacy(remote,legacy){
 for(const bucket of ['reminders','packages','saved'])for(const [id,value] of Object.entries(legacy[bucket]||{}))if(!Object.hasOwn(remote[bucket],id))remote[bucket][id]=value;
 for(const bucket of ['received','completed','clicked'])for(const [id,value] of Object.entries(legacy.history?.[bucket]||{}))if(!Object.hasOwn(remote.history[bucket],id))remote.history[bucket][id]=value;
 return remote;
}
