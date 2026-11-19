import test from 'node:test'; import assert from 'node:assert/strict';
import {inventory, probe} from '../scripts/research-plan.mjs';
test('inventory exposes stale evidence and excludes cooldown/season/expiry without relabeling',()=>{
 const make=(id,extra={})=>({id,url:'https://example.test/'+id,ideaGroup:'dining',costType:'paid',...extra});
 const old=make('old');const result=inventory([old,make('new'),make('expired',{availableThrough:'2026-10-01'}),make('summer',{seasonStart:'06-01',seasonEnd:'08-31'})],[],'2026-11-19',[old]);
 assert.equal(result.eligibleBeforeSelection,1);assert.deepEqual(result.needsFactRecheck,['new']);assert.equal(result.buckets['dining-paid'],1);
});
test('image checks reject HTML and HTTP errors and never claim editorial facts',async()=>{
 assert.equal((await probe('https://example.test/photo',true,async()=>new Response('<html/>',{headers:{'content-type':'text/html'}}))).ok,false);
 assert.equal((await probe('https://example.test/page',false,async()=>new Response('',{status:403}))).ok,false);
 const result=await probe('https://example.test/photo',true,async()=>new Response('image',{headers:{'content-type':'image/jpeg'}}));assert.ok(result.checkedAt);assert.equal(result.factsVerified,undefined);
});
