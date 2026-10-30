import {chromium,webkit,devices,expect} from '@playwright/test';
import {preview} from 'vite';import {readFile} from 'node:fs/promises';
import {syncFixture} from './sync-fixture.mjs';
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const server=await preview({preview:{host:'127.0.0.1',port:4183,strictPort:true}});
try{for(const engine of ['chrome','webkit']){
 const browser=await(engine==='chrome'?chromium.launch({channel:'chrome'}):webkit.launch());
 try{const remote=await syncFixture(password,{remember:false});
 const unlock=async p=>{await p.locator('#unlock-password').fill(password);await p.locator('#unlock-form button').click();await expect(p.locator('.page')).toBeVisible();};
 const device=async()=>{const c=await browser.newContext(engine==='webkit'?devices['iPhone 13']:{viewport:{width:390,height:844}});await remote.install(c);const p=await c.newPage();await p.goto('http://127.0.0.1:4183');await unlock(p);return p;};
 const connect=async p=>{await p.locator('#settings-button').click();await p.locator('#settings-dialog summary').click();await p.locator('#sync-key').fill('github_pat_synthetic_test_only');await p.locator('#sync-form button').click();await expect(p.locator('#sync-form-status')).toContainText('Connected.');await p.locator('.close-settings').click();};
 const a=await device();await expect(a.locator('#finds-panel')).toBeHidden();await expect(a.locator('#ideas-panel')).toBeHidden();
 await a.locator('[data-section-toggle="city"]').focus();await a.keyboard.press('Enter');await expect(a.locator('#finds-panel')).toBeVisible();
 await connect(a);await a.locator('[data-section-toggle="city"]').click();await expect(a.locator('#finds-panel')).toBeHidden();
 const b=await device();await connect(b);await b.locator('[data-section-toggle="ideas"]').click();await expect(b.locator('#ideas-panel')).toBeVisible();
 await a.evaluate(()=>localStorage.clear());await a.reload();await unlock(a);await connect(a);await expect(a.locator('#finds-panel')).toBeHidden();await expect(a.locator('#ideas-panel')).toBeVisible();
 remote.fail(true);await a.locator('[data-section-toggle="ideas"]').click();await expect(a.locator('#toast')).toContainText('could not confirm');await expect(a.locator('#ideas-panel')).toBeVisible();remote.fail(false);
 await expect(a.locator('#ideas-content .find')).toHaveCount(20);await expect(a.locator('#finds-content .find')).toHaveCount(20);
 await expect(a.locator('.idea-group').first().locator('.find')).toHaveCount(8);await expect(a.locator('.idea-group').last().locator('.find')).toHaveCount(12);
 for(const width of [320,390,768,1440]){await a.setViewportSize({width,height:900});expect(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await a.setViewportSize({width:390,height:844});await a.locator('.ideas-section').screenshot({path:`test-results/ideas-groups-${engine}.png`});
 await a.locator('#lock-button').click();await expect(a.locator('#ideas-content')).toBeEmpty();
 console.log(engine+': mobile collapse, keyboard, durable preferences, fresh-device restore and failed-save protection passed.');
 }finally{await browser.close();}
}}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
