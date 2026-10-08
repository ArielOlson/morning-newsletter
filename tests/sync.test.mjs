import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync,emptyState,importLegacy} from '../src/sync.mjs';
import {encrypt,decrypt} from '../src/crypto.mjs';
const password='synthetic-sync-secret';
async function remote(){
 let content=await encrypt(JSON.stringify(emptyState()),password),sha=1,fail=false,conflict=false,writes=0;
 return {fail(v){fail=v;},conflict(){conflict=true;},get writes(){return writes;},async data(){return JSON.parse(await decrypt(content,password));},async fetch(url,options={}){
  if(fail)return new Response('{}',{status:503});
  if(!url.includes('/contents/'))return Response.json({private:true,full_name:'ArielOlson/morning-newsletter-state'});
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);
   if(conflict){conflict=false;const s=JSON.parse(await decrypt(content,password));s.saved.other={id:'other',title:'Other device'};content=await encrypt(JSON.stringify(s),password);sha++;}
   if(body.sha!==String(sha))return new Response('{}',{status:409});
   content=JSON.parse(atob(body.content));sha++;writes++;return Response.json({content:{sha:String(sha)}});
  }
  return Response.json({type:'file',encoding:'base64',sha:String(sha),content:btoa(JSON.stringify(content))});
 }};
}
test('fresh devices restore durable reminders and completions; conflicts preserve unrelated changes',async()=>{
 const r=await remote(),a=createSync({fetcher:r.fetch}),b=createSync({fetcher:r.fetch});
 await a.connect('test',password);await a.change(s=>{s.reminders.a={id:'a',title:'Keep until complete'};s.recommendationExclusions={visited:{active:true,phrases:['Completed destination']}};s.recommendationProfile={interests:['trivia']};return s;});
 await b.connect('test',password);assert.equal(b.state.reminders.a.title,'Keep until complete');
 r.conflict();await b.change(s=>{s.history.completed.a='now';return s;});
 await a.refresh();assert.ok(a.state.saved.other);assert.equal(a.state.history.completed.a,'now');
 a.clear();const clean=createSync({fetcher:r.fetch});await clean.connect('test',password);assert.equal(clean.state.history.completed.a,'now');
 assert.equal((await r.data()).reminders.a.title,'Keep until complete');assert.equal(clean.state.recommendationExclusions.visited.active,true);assert.deepEqual(clean.state.recommendationProfile.interests,['trivia']);
});
test('failed writes and missing files do not clear previous saves or claim success',async()=>{
 const r=await remote(),a=createSync({fetcher:r.fetch});await a.connect('test',password);
 r.fail(true);await assert.rejects(a.change(s=>{s.reminders.b={id:'b'};return s;}));assert.equal(a.state.reminders.b,undefined);assert.equal(r.writes,0);
 r.fail(false);let active=true;const b=createSync({fetcher:r.fetch,isCurrent:()=>active});await b.connect('test',password);active=false;await assert.rejects(b.change(s=>s));assert.equal(r.writes,0);
 const missing=createSync({fetcher:async url=>url.includes('contents')?new Response('{}',{status:404}):Response.json({private:true,full_name:'ArielOlson/morning-newsletter-state'})});await assert.rejects(missing.connect('test',password),/nothing was reset/);assert.equal(missing.connected,false);
});
test('legacy imports cannot resurrect deleted items or undone completion marks',()=>{
 const s=emptyState();s.reminders.a=null;s.saved.a=null;s.history.completed.a=null;
 importLegacy(s,{reminders:{a:{id:'a'},b:{id:'b'}},saved:{a:{id:'a'}},history:{completed:{a:'old',b:'old'}}});
 assert.equal(s.reminders.a,null);assert.equal(s.saved.a,null);assert.equal(s.history.completed.a,null);assert.ok(s.reminders.b);assert.equal(s.history.completed.b,'old');
});
