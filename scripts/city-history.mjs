import {readFile} from 'node:fs/promises';
import {addDays} from './lib.mjs';
import {decrypt} from '../src/crypto.mjs';

export async function previousCityEdition(day,old={},zone='America/New_York'){
 const yesterday=addDays(day,-1,zone);
 const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const encrypted=await read(`dist/data/editions/${yesterday}.enc.json`);
 let edition;
 if(encrypted){const security=await read('config/security.local.json');edition=JSON.parse(await decrypt(encrypted,security?.password));}
 else edition=await read(`.cache/editions/${yesterday}.json`)||(old.day===yesterday?old:null);
 if(edition&&edition.day!==yesterday)throw Error('Previous edition date mismatch');
 return {day:yesterday,available:!!edition,finds:edition?.finds||[],ideas:edition?.ideas||[],exposures:edition?.recommendationExposures||[]};
}

export async function recommendationHistory(day,old={},zone='America/New_York',days=7){
 const editions=[];
 for(let offset=0;offset<days;offset++){
  const history=await previousCityEdition(addDays(day,-offset,zone),old,zone);
  if(history.available)editions.push(history);
 }
 if(!editions.some(x=>x.day===addDays(day,-1,zone)))throw Error('Yesterday’s edition is missing; recommendation rotation cannot be verified.');
 return {days:editions.map(x=>x.day),items:editions.flatMap(x=>[...x.finds,...x.ideas,...x.exposures])};
}
