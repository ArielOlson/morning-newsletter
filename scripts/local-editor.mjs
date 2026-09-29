import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { validateEvents } from './lib.mjs';
const exec = promisify(execFile);
export function localEditor(){
  let running;
  const refresh=()=>running ||= exec(process.execPath,['scripts/refresh.mjs'],{timeout:120000}).finally(()=>running=null);
  return {name:'local-newsletter-editor',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    if(!req.url?.startsWith('/__local/'))return next();
    if(req.url==='/__local/privacy-setup'&&req.method==='GET'&&/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){
      res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');
      res.end(await readFile('scripts/privacy-setup.html','utf8'));return;
    }
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const finish=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};
    // Local development only. Require a same-origin JSON POST to prevent cross-site writes.
    if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`||!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')||!req.headers['content-type']?.startsWith('application/json'))return finish(403,{error:'Local editor only'});
    try{
      if(req.url==='/__local/security'){const security=JSON.parse(await readFile('config/security.local.json','utf8'));return finish(200,{password:security.password});}
      if(req.url==='/__local/refresh'){await refresh();return finish(200,{ok:true});}
      if(req.url!=='/__local/events')return finish(404,{error:'Not found'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)return finish(413,{error:'Too large'});}
      const event=JSON.parse(body);validateEvents([event]);
      let config;try{config=JSON.parse(await readFile('config/events.local.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={events:[]};}
      config.events.push(event);validateEvents(config.events);await mkdir('config',{recursive:true});const temp=`config/events.local.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(config,null,2)+'\n');await rename(temp,'config/events.local.json');await refresh();finish(200,{ok:true});
    }catch{finish(400,{error:'Could not save or refresh. Check your config.'});}
  });}};
}
