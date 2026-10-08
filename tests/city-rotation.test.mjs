import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCity,cityKeys} from '../scripts/lib.mjs';
import {previousCityEdition,recommendationHistory} from '../scripts/city-history.mjs';
import {encrypt} from '../src/crypto.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const event=(id,discovery=false,priority=0)=>({id,title:id,url:`https://events.example/${id}`,startDate:'2026-09-30',endDate:'2026-10-04',discovery,priority});
test('ten city picks include 3–4 discoveries and no yesterday repeats, even high priority',()=>{
 const yesterday=Array.from({length:10},(_,i)=>event('old'+i,false,100));
 const pool=[...yesterday,...Array.from({length:8},(_,i)=>event('new'+i)),...Array.from({length:6},(_,i)=>event('discovery'+i,true))];
 const result=selectCity(pool,'2026-09-30',{},yesterday);
 assert.equal(result.items.length,10);assert.equal(result.repeats,0);assert.ok(result.discoveryCount>=3&&result.discoveryCount<=4);assert.deepEqual(result.issues,[]);
});
test('a discovery shortage never reintroduces yesterday’s events',()=>{
 const prior=[event('d1',true,100),event('d2',true,100),event('d3',true,100),event('target',false,999)];
 const result=selectCity([...prior,...Array.from({length:7},(_,i)=>event('fresh'+i))],'2026-09-30',{},prior);
 assert.equal(result.items.length,7);assert.equal(result.discoveryCount,0);assert.equal(result.repeats,0);assert.equal(result.issues.length,2);assert.ok(result.items.every(x=>x.id.startsWith('fresh')));
});
test('repeat cap never relaxes to fill a shortage; tracking links and changed IDs cannot evade it',()=>{
 const prior=Array.from({length:10},(_,i)=>event('old'+i));
 const result=selectCity(prior.map(x=>({...x,id:'new-id-'+x.id,url:x.url+'?utm_source=newsletter'})),'2026-09-30',{},prior);
 assert.equal(result.items.length,0);assert.equal(result.repeats,0);assert.equal(result.issues.length,2);
 assert.deepEqual(cityKeys({url:'https://events.example/a/?utm_source=x#today'}),['url:https://events.example/a']);
});
test('same-day rebuilds compare with yesterday from encrypted history, with private fallback',async()=>{
 const original=process.cwd(),dir=await mkdtemp(join(tmpdir(),'city-history-'));process.chdir(dir);
 try{
  await mkdir('dist/data/editions',{recursive:true});await mkdir('config');await mkdir('.cache/editions',{recursive:true});
  const yesterday={day:'2026-09-29',finds:[event('yesterday')],ideas:[event('yesterday-idea')]},today={day:'2026-09-30',finds:[event('today')],ideas:[event('today-idea')]};
  await writeFile('config/security.local.json',JSON.stringify({password:'test-only-archive-secret'}));
  await writeFile('dist/data/editions/2026-09-29.enc.json',JSON.stringify(await encrypt(JSON.stringify(yesterday),'test-only-archive-secret')));
  await writeFile('.cache/editions/2026-09-29.json',JSON.stringify({...yesterday,finds:[event('unpublished')]}));
  assert.deepEqual((await previousCityEdition('2026-09-30',today)).finds,yesterday.finds);
  assert.deepEqual((await previousCityEdition('2026-09-30',today)).ideas,yesterday.ideas);
  await rm('dist/data/editions/2026-09-29.enc.json');assert.equal((await previousCityEdition('2026-09-30',today)).finds[0].id,'unpublished');
  assert.equal((await previousCityEdition('2026-10-02',today)).available,false);
 }finally{process.chdir(original);await rm(dir,{recursive:true,force:true});}
});

test('weekly history blocks alternating pools and includes every same-day exposure across both sections',async()=>{
 const original=process.cwd(),dir=await mkdtemp(join(tmpdir(),'weekly-history-'));process.chdir(dir);
 try{
  await mkdir('.cache/editions',{recursive:true});
  for(const day of ['2026-10-06','2026-10-05','2026-09-30','2026-09-29'])await writeFile(`.cache/editions/${day}.json`,JSON.stringify({day,finds:[{id:'event:'+day}],ideas:[{id:'idea:'+day}],recommendationExposures:[{id:'earlier:'+day}]}));
  const history=await recommendationHistory('2026-10-07',{day:'2026-10-07',finds:[{id:'today'}]});
  assert.deepEqual(history.days,['2026-10-06','2026-10-05','2026-09-30']);
  assert.equal(history.items.length,9);assert.ok(history.items.some(x=>x.id==='earlier:2026-10-06'));
  assert.ok(history.items.some(x=>x.id==='idea:2026-10-05'));assert.ok(!history.items.some(x=>x.id==='today'));
  await rm('.cache/editions/2026-10-06.json');await assert.rejects(recommendationHistory('2026-10-07'),/missing/);
 }finally{process.chdir(original);await rm(dir,{recursive:true,force:true});}
});
