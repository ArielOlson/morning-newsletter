import test from 'node:test';import assert from 'node:assert/strict';import {selectIdeas} from '../scripts/ideas.mjs';
const idea={id:'orchard',title:'Orchard',url:'https://example.com',what:'Go picking.',seasonStart:'09-01',seasonEnd:'10-31',planWeekend:true,preferredWeekday:7};
const calendar={state:'fresh',sourceCount:2,events:[]};
test('Tuesday suggests a free Sunday across both calendars; partial data never implies availability',()=>{assert.equal(selectIdeas([idea],'2026-09-29',calendar)[0].suggestedDate,'2026-10-04');assert.equal(selectIdeas([idea],'2026-09-29',{...calendar,state:'partial'})[0].suggestedDate,undefined);assert.equal(selectIdeas([idea],'2026-09-29',{...calendar,events:[{startDate:'2026-10-04',endDate:'2026-10-05',allDay:true}]}).length,0);});
test('seasonal ideas stay in their window, year wrapping works, and Monday never asserts free weekend',()=>{assert.equal(selectIdeas([idea],'2026-11-01',calendar).length,0);assert.equal(selectIdeas([idea],'2026-09-28',calendar)[0].suggestedDate,undefined);assert.equal(selectIdeas([{...idea,seasonStart:'12-01',seasonEnd:'01-31'}],'2027-01-10',calendar).length,1);});
test('five ideas favor personal wishes, label suggestions and backfill unavailable seasonal plans',()=>{
 const suggestions=Array.from({length:6},(_,i)=>({id:'suggestion'+i,title:'Suggestion',url:'https://example.com/'+i,suggested:true,what:'Try this.'}));
 const wish={id:'wish',title:'My wish',url:'https://example.com/wish',what:'On your list.'};
 const result=selectIdeas([...suggestions,idea,wish,wish],'2026-11-02',calendar);
 assert.equal(result.length,5);assert.equal(result[0].id,'wish');assert.equal(result[0].what,'On your list.');assert.ok(result.slice(1).every(x=>x.what.startsWith('Suggested for you.')));assert.equal(new Set(result.map(x=>x.id)).size,5);
 const busy={...calendar,events:[{startDate:'2026-10-04',endDate:'2026-10-05',allDay:true}]};
 assert.equal(selectIdeas([idea,...suggestions],'2026-09-29',busy).length,5);
 assert.ok(!selectIdeas([{...wish,availableThrough:'2026-09-29'},...suggestions],'2026-09-30',calendar).some(x=>x.id==='wish'));
});
