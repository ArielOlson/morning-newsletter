import {DINING_COUNT,ACTIVITY_COUNT,ideaGroup} from '../src/idea-groups.mjs';
import {safeURL,cityKeys} from './lib.mjs';
import {IDEA_COUNT,MIN_FREE_IDEAS,MIN_PAID_IDEAS,ideaBudget} from './recommendation-policy.mjs';
export function selectIdeas(items,day,calendar,zone='America/New_York',previous=[]){
 const md=day.slice(5);
 const seen=new Set(),prior=new Set(previous.flatMap(cityKeys));
 const eligible=items.filter(x=>x.id&&x.title&&safeURL(x.url)&&!x.dateSpecific&&!x.planWeekend&&!x.preferredWeekday&&(!x.availableThrough||x.availableThrough>=day)&&!cityKeys(x).some(key=>prior.has(key))).filter(x=>{
  if(!x.seasonStart||!x.seasonEnd)return true;
  return x.seasonStart<=x.seasonEnd?md>=x.seasonStart&&md<=x.seasonEnd:md>=x.seasonStart||md<=x.seasonEnd;
 }).sort((a,b)=>Number(a.suggested===true)-Number(b.suggested===true)||(b.priority||0)-(a.priority||0)).filter(x=>{const keys=cityKeys(x);if(keys.some(k=>seen.has(k)))return false;keys.forEach(k=>seen.add(k));return true;}).map(x=>{
  const idea={...x,kind:'idea',what:x.suggested===true?`Suggested for you. ${x.what||''}`:x.what};
  for(const key of ['when','timing','suggestedDate','startDate','endDate'])delete idea[key];
  return idea;
 });
 // Solve both category and price quotas; unknown groups never silently count.
 const buckets={dining:{free:[],paid:[]},activity:{free:[],paid:[]}};
 for(const x of eligible){const group=ideaGroup(x),budget=ideaBudget(x);if(group&&budget)buckets[group][budget].push(x);}
 let best=null;
 for(let diningFree=0;diningFree<=DINING_COUNT;diningFree++)for(let activityFree=0;activityFree<=ACTIVITY_COUNT;activityFree++){
  const totalFree=diningFree+activityFree;
  if(totalFree<MIN_FREE_IDEAS||IDEA_COUNT-totalFree<MIN_PAID_IDEAS)continue;
  const needs=[['dining','free',diningFree],['dining','paid',DINING_COUNT-diningFree],['activity','free',activityFree],['activity','paid',ACTIVITY_COUNT-activityFree]];
  if(needs.some(([g,b,n])=>buckets[g][b].length<n))continue;
  const chosen=new Set(needs.flatMap(([g,b,n])=>buckets[g][b].slice(0,n)));
  const picks=eligible.filter(x=>chosen.has(x)),wishCount=picks.filter(x=>!x.suggested).length;
  const score=picks.reduce((sum,x)=>sum+eligible.indexOf(x),0),balance=Math.abs(totalFree-10);
  if(!best||wishCount>best.wishCount||wishCount===best.wishCount&&(balance<best.balance||balance===best.balance&&score<best.score))best={picks,wishCount,balance,score};
 }
 if(best)return best.picks;
 // A partial result remains visibly partial and is blocked by publication guards.
 return ['dining','activity'].flatMap(group=>eligible.filter(x=>ideaGroup(x)===group&&ideaBudget(x)).slice(0,group==='dining'?DINING_COUNT:ACTIVITY_COUNT));
}
