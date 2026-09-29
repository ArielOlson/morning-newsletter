import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {encrypt,decrypt} from '../src/crypto.mjs';
const validDay=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||'');
export async function prepareArchive(current,password){
 const editions=new Map(),cache='.cache/editions';await mkdir(cache,{recursive:true});
 // Preserve committed encrypted history on fresh checkouts before Vite empties dist/.
 let previous;try{previous=JSON.parse(await readFile('dist/data/archive.enc.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous){const index=JSON.parse(await decrypt(previous,password));for(const entry of index.editions){if(!validDay(entry.day)||entry.file!==`editions/${entry.day}.enc.json`)throw Error('Invalid archive index');const raw=JSON.parse(await readFile(`dist/data/${entry.file}`,'utf8'));const text=await decrypt(raw,password),b=JSON.parse(text);if(b.day!==entry.day)throw Error('Archive date mismatch');editions.set(b.day,text);}}
 for(const file of await readdir(cache)){if(!/^\d{4}-\d{2}-\d{2}\.json$/.test(file))continue;const text=await readFile(`${cache}/${file}`,'utf8'),b=JSON.parse(text);if(b.version!==1||!b.calendar||b.day!==file.slice(0,10))throw Error('Invalid cached edition');if(!editions.has(b.day)||JSON.parse(editions.get(b.day)).generatedAt<b.generatedAt)editions.set(b.day,text);}
 const brief=JSON.parse(current);if(!validDay(brief.day))throw Error('Invalid current edition day');editions.set(brief.day,current);
 const index={version:1,editions:[]},files=[];await mkdir('public/data/editions',{recursive:true});
 for(const [day,text] of [...editions].sort(([a],[b])=>b.localeCompare(a))){
  const b=JSON.parse(text);await writeFile(`${cache}/${day}.json`,text);await writeFile(`public/data/editions/${day}.json`,text);
  index.editions.push({day,generatedAt:b.generatedAt,file:`editions/${day}.enc.json`});files.push({file:`editions/${day}.enc.json`,envelope:await encrypt(text,password)});
 }
 await writeFile('public/data/archive.json',JSON.stringify(index));
 return {index:await encrypt(JSON.stringify(index),password),files};
}
