import {stat} from 'node:fs/promises';
import {artworkForEdition,defaultArtwork,seasonForDay} from '../src/artwork.mjs';

export async function selectArtwork(entries,day,now=new Date()){
 const candidates=(entries||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day||'')&&x.day<=day&&artworkForEdition(x)!==defaultArtwork&&Number.isFinite(Date.parse(x.generatedAt))&&Date.parse(x.generatedAt)<=+now).sort((a,b)=>b.day.localeCompare(a.day)||b.generatedAt.localeCompare(a.generatedAt));
 for(const entry of candidates){
  try{const file=await stat(`public/${entry.src}`);if(!file.isFile()||!file.size)continue;}catch{continue;}
  const {day:artDay,src,alt,width,height,season,generatedAt}=entry;
  return {artwork:{day:artDay,src,alt,width,height,season,generatedAt},status:{state:artDay===day&&season===seasonForDay(day)?'fresh':'stale',updatedAt:generatedAt}};
 }
 return {artwork:defaultArtwork,status:{state:'unavailable',updatedAt:null}};
}
