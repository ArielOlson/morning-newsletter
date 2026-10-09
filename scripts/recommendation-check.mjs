import assert from 'node:assert/strict';
import {cityKeys,isSampleSale} from './lib.mjs';
import {EVENT_COUNT,IDEA_COUNT,MIN_DISCOVERIES,MAX_DISCOVERIES,MIN_FREE_IDEAS,MIN_PAID_IDEAS,ideaBudget} from './recommendation-policy.mjs';
export function assertRecommendations(brief,history){
 assert.equal(brief.finds?.length,EVENT_COUNT,'Research twenty eligible NYC events before publication.');
 assert.equal(brief.ideas?.length,IDEA_COUNT,'Research twenty eligible free-time ideas before publication.');
 const discoveries=brief.finds.filter(x=>x.discovery).length;
 assert.ok(discoveries>=MIN_DISCOVERIES&&discoveries<=MAX_DISCOVERIES,'Include six to eight broader discoveries.');
 assert.ok(brief.ideas.filter(x=>ideaBudget(x)==='free').length>=MIN_FREE_IDEAS&&brief.ideas.filter(x=>ideaBudget(x)==='paid').length>=MIN_PAID_IDEAS,'Include at least eight free and eight paid ideas.');
 assert.ok(brief.ideas.every(x=>ideaBudget(x)&&!x.dateSpecific&&!x.planWeekend&&!x.preferredWeekday&&!x.suggestedDate&&!x.startDate&&!x.endDate&&!x.when&&!x.timing),'Ideas must have verified costs and flexible timing without assigned dates.');
 assert.equal(brief.status?.recommendations?.cooldownDays,7,'Refresh using the current seven-day recommendation rules.');
 assert.ok(brief.finds.filter(isSampleSale).length<=2,'At most two sample sales may be published.');
 const prior=new Set(history.flatMap(cityKeys)),seen=new Set();
 for(const item of [...brief.finds,...brief.ideas]){
  const keys=cityKeys(item);assert.ok(keys.length&&keys.every(k=>!prior.has(k)),'A recommendation repeats within the last seven days.');
  assert.ok(keys.every(k=>!seen.has(k)),'A recommendation is duplicated across the two carousels.');keys.forEach(k=>seen.add(k));
 }
}
