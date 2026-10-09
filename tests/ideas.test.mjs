import test from 'node:test';import assert from 'node:assert/strict';import {selectIdeas} from '../scripts/ideas.mjs';
const card=(id,extra={})=>({id,title:id,url:'https://example.com/'+id,suggested:true,costType:'paid',what:'Try this.',...extra});
const pool=Array.from({length:36},(_,i)=>card('idea'+i,{costType:i<18?'paid':'free',priority:100-i}));
test('twenty flexible ideas keep free and paid variety even when paid options outrank free',()=>{
 const result=selectIdeas(pool,'2026-10-08',{});assert.equal(result.length,20);
 assert.ok(result.filter(x=>x.costType==='free').length>=8);assert.ok(result.filter(x=>x.costType==='paid').length>=8);
 assert.ok(result.every(x=>x.what.startsWith('Suggested for you.')));
 assert.deepEqual(result.slice(0,4).map(x=>x.costType),['free','paid','free','paid']);
});
test('flexible ideas never assign dates, even on Tuesday or from legacy timing fields',()=>{
 const input=[card('flex',{when:'Tomorrow at 7',timing:'Tomorrow',suggestedDate:'2026-10-10'}),card('weekend',{planWeekend:true}),card('sunday',{preferredWeekday:7}),card('dated',{dateSpecific:true})];
 const result=selectIdeas(input,'2026-10-13',{state:'fresh',sourceCount:4,events:[]});assert.equal(result.length,1);assert.equal(result[0].id,'flex');
 assert.ok(!result[0].when&&!result[0].timing&&!result[0].suggestedDate);
});
test('budget quotas never admit repeats or unknown costs and still prioritize eligible wishes',()=>{
 const wish=card('wish',{suggested:false,what:'On your list.'}),old=card('old',{costType:'free'});
 const result=selectIdeas([wish,old,{...old,id:'alias',url:old.url+'?utm_source=x'},card('unknown',{costType:undefined}),...pool],'2026-10-08',{},'America/New_York',[old]);
 assert.ok(result.some(x=>x.id==='wish'&&x.what==='On your list.'));
 assert.ok(result.every(x=>!['old','alias','unknown'].includes(x.id)));assert.equal(result.length,20);
});
test('seasonal and closed suggestions remain excluded without erasing the source list',()=>{
 const items=[card('fall',{seasonStart:'09-01',seasonEnd:'10-31'}),card('winter',{seasonStart:'12-01',seasonEnd:'01-31'}),card('closed',{availableThrough:'2026-09-29'})];
 assert.deepEqual(selectIdeas(items,'2026-10-08',{}).map(x=>x.id),['fall']);assert.deepEqual(selectIdeas(items,'2027-01-10',{}).map(x=>x.id),['winter']);assert.equal(items.length,3);
});
