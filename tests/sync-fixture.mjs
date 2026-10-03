import {encrypt,decrypt} from '../src/crypto.mjs';
import {emptyState,credentialKey} from '../src/sync.mjs';
export async function syncFixture(password,{remember=true}={}){
 let envelope=await encrypt(JSON.stringify(emptyState()),password),sha=1,fail=false;
 const credential=JSON.stringify(await encrypt('github_pat_synthetic_test_only',password));
 return {
  fail(value){fail=value;},
  async data(){return JSON.parse(await decrypt(envelope,password));},
  async install(context){
   if(remember)await context.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},{key:credentialKey,value:credential});
   await context.route('https://api.github.com/repos/ArielOlson/morning-newsletter-state**',async route=>{
    if(fail)return route.fulfill({status:503,json:{message:'Test outage'}});
    if(!route.request().url().includes('/contents/'))return route.fulfill({json:{private:true,full_name:'ArielOlson/morning-newsletter-state'}});
    if(route.request().method()==='PUT'){
     const body=route.request().postDataJSON();if(body.sha!==String(sha))return route.fulfill({status:409,json:{message:'Conflict'}});
     envelope=JSON.parse(atob(body.content));sha++;return route.fulfill({json:{content:{sha:String(sha)}}});
    }
    return route.fulfill({json:{type:'file',encoding:'base64',sha:String(sha),content:btoa(JSON.stringify(envelope))}});
   });
  }
 };
}
