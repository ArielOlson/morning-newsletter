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
 // Reserve room for both budgets, then preserve editorial/wish ranking within each.
 const selected=new Set();
 for(const [budget,count] of [['free',MIN_FREE_IDEAS],['paid',MIN_PAID_IDEAS]])for(const x of eligible.filter(x=>ideaBudget(x)===budget).slice(0,count))selected.add(x);
 for(const x of eligible)if(selected.size<IDEA_COUNT&&ideaBudget(x))selected.add(x);
 const free=eligible.filter(x=>selected.has(x)&&ideaBudget(x)==='free'),paid=eligible.filter(x=>selected.has(x)&&ideaBudget(x)==='paid');
 const result=[];while(free.length||paid.length){if(free.length)result.push(free.shift());if(paid.length)result.push(paid.shift());}
 return result;
}
