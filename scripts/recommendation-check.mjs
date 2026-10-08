import assert from 'node:assert/strict';
import {cityKeys,isSampleSale} from './lib.mjs';
export function assertRecommendations(brief,history){
 assert.equal(brief.finds?.length,10,'Research ten eligible NYC events before publication.');
 assert.equal(brief.ideas?.length,10,'Research ten eligible free-time ideas before publication.');
 assert.equal(brief.status?.recommendations?.cooldownDays,7,'Refresh using the current seven-day recommendation rules.');
 assert.ok(brief.finds.filter(isSampleSale).length<=2,'At most two sample sales may be published.');
 const prior=new Set(history.flatMap(cityKeys)),seen=new Set();
 for(const item of [...brief.finds,...brief.ideas]){
  const keys=cityKeys(item);assert.ok(keys.length&&keys.every(k=>!prior.has(k)),'A recommendation repeats within the last seven days.');
  assert.ok(keys.every(k=>!seen.has(k)),'A recommendation is duplicated across the two carousels.');keys.forEach(k=>seen.add(k));
 }
}
