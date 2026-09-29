import {DateTime} from 'luxon';
import {safeURL} from './lib.mjs';
export function selectIdeas(items,day,calendar,zone='America/New_York'){
 const today=DateTime.fromISO(day,{zone}),md=day.slice(5);
 return items.filter(x=>x.id&&x.title&&safeURL(x.url)).filter(x=>{
  if(!x.seasonStart||!x.seasonEnd)return true;
  return x.seasonStart<=x.seasonEnd?md>=x.seasonStart&&md<=x.seasonEnd:md>=x.seasonStart||md<=x.seasonEnd;
 }).map(x=>{
  const idea={...x,kind:'idea',when:x.timing||'Choose a day'};
  if(x.planWeekend&&today.weekday===2){
   if(calendar.state!=='fresh'||calendar.sourceCount<2){idea.what=`${x.what} Weekend availability could not be confirmed on both calendars.`;return idea;}
   const days=[6,7].map(n=>today.plus({days:n-today.weekday}).toISODate());
   const free=days.filter(d=>!calendar.events.some(e=>e.startDate<=d&&(e.allDay?e.endDate>d:e.endDate>=d)));
   const chosen=free.find(d=>DateTime.fromISO(d).weekday===(x.preferredWeekday||6))||(!x.preferredWeekday?free[0]:null);
   if(!chosen)return null;
   idea.suggestedDate=chosen;idea.when=`Suggested ${DateTime.fromISO(chosen).toFormat('ccc, LLL d')} · not booked`;
   idea.what=`${x.what} No plans found on either calendar that day; confirm before booking.`;
  }
  return idea;
 }).filter(Boolean).slice(0,10);
}
