import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRecoveryEvidence} from '../scripts/history-recovery.mjs';
import {cityKeys} from '../scripts/lib.mjs';
const card={id:'walk',url:'https://example.org/walk?utm_source=old',recommendationKey:'park-walk'};
const edition=(day,finds=[card])=>({day,generatedAt:`${day}T08:00:00Z`,finds,ideas:[],recommendationExposures:[]});
function fixture(){const e=edition('2026-10-09');return {day:'2026-10-14',zone:'America/New_York',head:'abc',runs:[{head_sha:'abc',status:'completed',conclusion:'success'}],totalRuns:1,versions:[{sha:'abc',current:e,editions:[e]}],live:e,local:[e],observedAt:'2026-10-14T12:00:00Z'};}
test('verified missed days retain all historical exclusions and actual live observations without invented editions',()=>{
 const f=fixture(),before=JSON.stringify(f),r=verifyRecoveryEvidence(f);
 assert.deepEqual(r.days,['2026-10-09']);assert.equal(r.recovery.observedAt,f.observedAt);assert.deepEqual(r.observed,[card]);assert.equal(JSON.stringify(f),before);
 const keys=new Set(r.items.flatMap(cityKeys));assert.ok(cityKeys({...card,id:'renamed',url:'https://example.org/walk?utm_source=new'}).some(k=>keys.has(k)));
});
test('missing published archive is never interpreted as a missed run',()=>{
 const f=fixture(),prior=edition('2026-10-08');f.versions.push({sha:'prior',current:prior,editions:[prior]});
 assert.throws(()=>verifyRecoveryEvidence(f),/archive was removed/);
 const g=fixture();g.live=g.versions[0].current=edition('2026-10-13');assert.throws(()=>verifyRecoveryEvidence(g),/restored/);
});
test('tampered local or live editions and missing historical payloads fail closed',()=>{
 const f=fixture();f.local=[{...f.live,finds:[]}];assert.throws(()=>verifyRecoveryEvidence(f),/Local history differs/);
 const g=fixture();g.live={...g.live,finds:[]};assert.throws(()=>verifyRecoveryEvidence(g),/Live edition differs/);
 const h=fixture();h.versions[0].editions=[];assert.throws(()=>verifyRecoveryEvidence(h),/missing from its archive/);
});
test('incomplete, unavailable, running or unverified deployment history blocks recovery',()=>{
 for(const mutate of [f=>f.totalRuns++,f=>f.runs=[],f=>f.runs[0].status='in_progress',f=>f.head='other',f=>f.runs.push({head_sha:'missing',status:'completed',conclusion:'success'})]){
  const f=fixture();mutate(f);assert.throws(()=>verifyRecoveryEvidence(f));
 }
});
test('a second interruption retains earlier observed cards and records the current real observation',()=>{
 const f=fixture(),next=edition('2026-10-14',[{id:'new',url:'https://example.org/new'}]);next.recommendationExposures=[card];
 f.day='2026-10-20';f.observedAt='2026-10-20T08:00:00Z';f.versions[0]={sha:'abc',current:next,editions:[f.live,next]};f.live=next;f.local=f.versions[0].editions;
 const r=verifyRecoveryEvidence(f);assert.ok(r.observed.some(x=>x.id==='walk'));assert.ok(r.items.some(x=>x.id==='new'));assert.equal(r.recovery.lastPublishedDay,'2026-10-14');
});
