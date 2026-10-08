import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {decrypt} from '../src/crypto.mjs';
import {validState,syncRepo} from '../src/sync.mjs';
import {historyId} from '../src/history.mjs';
const exec=promisify(execFile);
// Read-only. Daily builds never write or replace the private choices repository.
export async function readRecommendationState(){
 const gh=async args=>JSON.parse((await exec('gh',args,{timeout:30000,maxBuffer:6000000})).stdout);
 for(let attempt=0;attempt<2;attempt++)try{
  const repo=await gh(['api','repos/'+syncRepo]);
  if(!repo.private||repo.full_name!==syncRepo)throw Error('Unexpected state repository');
  const file=await gh(['api','repos/'+syncRepo+'/contents/state.enc.json?ref=main']);
  const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
  const state=validState(JSON.parse(await decrypt(JSON.parse(Buffer.from(file.content,'base64').toString()),password)));
  return {state,checkedAt:new Date().toISOString(),sha:file.sha};
 }catch{if(attempt)throw Error('Private recommendation choices unavailable; preserve the published edition and reconnect GitHub.');}
}
export async function eligibleRecommendations(items,state){
 const exclusions=Object.values(state.recommendationExclusions||{}).filter(x=>x?.active!==false);
 const normalized=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const result=[];
 for(const item of items){
  if(state.history.completed[await historyId('idea',item.id)])continue;
  const title=normalized(item.title);
  if(exclusions.some(x=>(x.ids||[]).includes(item.id)||(x.urls||[]).some(u=>item.url?.split(/[?#]/)[0].replace(/\/$/,'')===u.split(/[?#]/)[0].replace(/\/$/,''))||(x.phrases||[]).some(p=>normalized(p)&&title.includes(normalized(p)))))continue;
  result.push(item);
 }
 return result;
}
