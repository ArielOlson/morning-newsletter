import test from 'node:test';
import assert from 'node:assert/strict';
import {requestLive} from '../scripts/live-request.mjs';
const site='https://example.test/newsletter/';
test('transient CDN failure retries once with a new cache key and honors Retry-After',async()=>{
 const calls=[],waits=[];let time=100;
 const r=await requestLive('data/old.json',site,{now:()=>time++,sleep:async ms=>waits.push(ms),fetcher:async u=>{calls.push(u.href);return new Response('',{status:calls.length===1?503:404,headers:{'retry-after':'3'}})}});
 assert.equal(r.status,404);assert.equal(calls.length,2);assert.notEqual(calls[0],calls[1]);assert.deepEqual(waits,[3000]);
});
test('an exposed plaintext response and persistent server failures are never accepted as 404',async()=>{
 for(const status of [200,404,503]){let calls=0;const r=await requestLive('data/old.json',site,{sleep:async()=>{},fetcher:async()=>{calls++;return new Response('',{status})}});assert.equal(r.status,status);assert.equal(calls,status===503?2:1);}
});
test('network failure retries once; long Retry-After is left for the caller to report',async()=>{
 let calls=0;await assert.rejects(requestLive('data/old.json',site,{sleep:async()=>{},fetcher:async()=>{calls++;throw new Error('network')}}),/network/);assert.equal(calls,2);
 const r=await requestLive('data/old.json',site,{sleep:async()=>{throw new Error('must not retry early')},fetcher:async()=>new Response('',{status:429,headers:{'retry-after':'120'}})});assert.equal(r.status,429);
});

test('plaintext checks use the canonical URL with cache revalidation and retain strict status',async()=>{
 const calls=[];const r=await requestLive('data/brief.json',site,{cacheBust:false,sleep:async()=>{},fetcher:async(u,options)=>{calls.push([u.href,options.headers['Cache-Control']]);return new Response('',{status:calls.length===1?503:404})}});
 assert.equal(r.status,404);assert.deepEqual(calls,[[site+'data/brief.json','no-cache'],[site+'data/brief.json','no-cache']]);
});

test('external artwork retains its exact URL and normal cache behavior',async()=>{
 const src='https://photo.example/image.jpg?width=1600&signature=abc';let seen;
 const r=await requestLive(src,site,{fetcher:async(u,options)=>{seen={url:u.href,cache:options.cache,headers:options.headers};return new Response('photo',{status:200})}});
 assert.equal(r.status,200);assert.deepEqual(seen,{url:src,cache:'default',headers:{}});
});
