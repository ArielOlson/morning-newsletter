import {DateTime} from 'luxon';
import {safeURL} from './lib.mjs';
export function selectIdeas(items,day,calendar,zone='America/New_York'){
 const today=DateTime.fromISO(day,{zone}),md=day.slice(5);
 const seen=new Set();
 return items.filter(x=>x.id&&x.title&&safeURL(x.url)&&(!x.availableThrough||x.availableThrough>=day)).filter(x=>{
  if(!x.seasonStart||!x.seasonEnd)return true;
  return x.seasonStart<=x.seasonEnd?md>=x.seasonStart&&md<=x.seasonEnd:md>=x.seasonStart||md<=x.seasonEnd;
 }).sort((a,b)=>Number(a.suggested===true)-Number(b.suggested===true)).filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).map(x=>{
  const idea={...x,kind:'idea',when:x.timing||'Choose a day',what:x.suggested===true?`Suggested for you. ${x.what||''}`:x.what};
  if(x.planWeekend&&today.weekday===2){
   if(calendar.state!=='fresh'||calendar.sourceCount<2){idea.what+=` Weekend availability could not be confirmed across all configured calendars.`;return idea;}
   const days=[6,7].map(n=>today.plus({days:n-today.weekday}).toISODate());
   const free=days.filter(d=>!calendar.events.some(e=>e.startDate<=d&&(e.allDay?e.endDate>d:e.endDate>=d)));
   const chosen=free.find(d=>DateTime.fromISO(d).weekday===(x.preferredWeekday||6))||(!x.preferredWeekday?free[0]:null);
   if(!chosen)return null;
   idea.suggestedDate=chosen;idea.when=`Suggested ${DateTime.fromISO(chosen).toFormat('ccc, LLL d')} · not booked`;
   idea.what+=` No plans found across the configured calendars that day; confirm before booking.`;
  }
  return idea;
 }).filter(Boolean).slice(0,5);
}
