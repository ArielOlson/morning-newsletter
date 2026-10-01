import {calendarEvents, calendarSnapshot, normalizeCalendarURL} from './lib.mjs';

// A complete authenticated scan includes private events that a public feed may omit.
export async function readCalendarSource({input,snapshot,day,now,zone,lookAheadDays=14,includeDescriptions=false,label,download}) {
 const connected=calendarSnapshot(snapshot,input,day,now,lookAheadDays);
 const decorate=events=>events.map(event=>({...event,...(label?{calendarLabel:label}:{})}));
 if(connected)return {events:decorate(connected.events),status:{state:'fresh',updatedAt:connected.checkedAt,mode:'connected-account',label}};
 try{
  const events=calendarEvents(await download(normalizeCalendarURL(input)),day,zone,lookAheadDays,includeDescriptions);
  return {events:decorate(events),status:{state:'fresh',updatedAt:now.toISOString(),mode:'public-feed',label}};
 }catch{
  return {events:[],status:{state:'unavailable',updatedAt:null,label}};
 }
}
