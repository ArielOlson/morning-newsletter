import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCity,cityKeys,isSampleSale} from '../scripts/lib.mjs';
import {selectIdeas} from '../scripts/ideas.mjs';
import {eligibleRecommendations} from '../scripts/recommendation-state.mjs';
import {assertRecommendations} from '../scripts/recommendation-check.mjs';
import {historyId} from '../src/history.mjs';
import {emptyState} from '../src/sync.mjs';
const card=(id,extra={})=>({id,title:id,url:'https://example.com/'+id,startDate:'2026-10-07',endDate:'2026-10-20',...extra});
test('sample sales remain capped at two even when they dominate priority and feed',()=>{
 const sales=Array.from({length:20},(_,i)=>card('260:'+i,{priority:1000}));
 const other=Array.from({length:18},(_,i)=>card('event'+i,{discovery:i<6}));
 const picked=selectCity([...sales,...other],'2026-10-07');assert.equal(picked.items.length,20);assert.equal(picked.items.filter(isSampleSale).length,2);assert.equal(picked.discoveryCount,6);
 assert.equal(selectCity(sales,'2026-10-07').items.length,2);
});
test('cross-section rotation recognizes aliases and does not fill shortages with old cards',()=>{
 const old=card('old',{url:'https://www.example.com/show/?utm_source=a'});
 const renamed=card('new',{url:'https://example.com/show?ref=mail#tickets'});
 assert.ok(cityKeys(old).some(k=>cityKeys(renamed).includes(k)));
 assert.equal(selectCity([renamed],'2026-10-07',{},[old]).items.length,0);
 assert.equal(selectIdeas([renamed],'2026-10-07',{},'America/New_York',[old]).length,0);
 assert.equal(selectIdeas([old,renamed],'2026-10-07',{}).length,1);
});
test('completed and visited preferences exclude renamed cards; unrelated state and explicit undo survive',async()=>{
 const s=emptyState(),done=card('done');s.history.completed[await historyId('idea',done.id)]='2026-10-07';s.recommendationExclusions={visit:{active:true,phrases:['Beacon']}};
 const input=[done,card('new-beacon',{title:'A weekend in Beacon'}),card('new')];
 assert.deepEqual((await eligibleRecommendations(input,s)).map(x=>x.id),['new']);
 s.history.completed[await historyId('idea',done.id)]=null;s.recommendationExclusions.visit.active=false;
 assert.equal((await eligibleRecommendations(input,s)).length,3);
});
test('publication guard rejects previous-week repeats, excess sales, cross-section duplicates and short editions',()=>{
 const brief={finds:Array.from({length:20},(_,i)=>card('event'+i)),ideas:Array.from({length:10},(_,i)=>card('idea'+i)),status:{recommendations:{cooldownDays:7}}};
 assert.doesNotThrow(()=>assertRecommendations(brief,[]));
 assert.throws(()=>assertRecommendations(brief,[brief.ideas[0]]),/seven days/);
 assert.throws(()=>assertRecommendations({...brief,ideas:brief.finds.slice(0,10)},[]),/duplicated/);
 assert.throws(()=>assertRecommendations({...brief,ideas:[]},[]),/ten eligible/);
 assert.throws(()=>assertRecommendations({...brief,finds:brief.finds.map((x,i)=>({...x,category:i<3?'Sample sales':'Seasonal'}))},[]),/two sample sales/);
});
