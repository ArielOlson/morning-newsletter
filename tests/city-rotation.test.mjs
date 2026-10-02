import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCity,cityKeys} from '../scripts/lib.mjs';
import {previousCityEdition} from '../scripts/city-history.mjs';
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
  const yesterday={day:'2026-09-29',finds:[event('yesterday')]},today={day:'2026-09-30',finds:[event('today')]};
  await writeFile('config/security.local.json',JSON.stringify({password:'test-only-archive-secret'}));
  await writeFile('dist/data/editions/2026-09-29.enc.json',JSON.stringify(await encrypt(JSON.stringify(yesterday),'test-only-archive-secret')));
  await writeFile('.cache/editions/2026-09-29.json',JSON.stringify({...yesterday,finds:[event('unpublished')]}));
  assert.deepEqual((await previousCityEdition('2026-09-30',today)).finds,yesterday.finds);
  await rm('dist/data/editions/2026-09-29.enc.json');assert.equal((await previousCityEdition('2026-09-30',today)).finds[0].id,'unpublished');
  assert.equal((await previousCityEdition('2026-10-02',today)).available,false);
 }finally{process.chdir(original);await rm(dir,{recursive:true,force:true});}
});
