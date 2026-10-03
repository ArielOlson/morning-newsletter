import {syncFixture} from './sync-fixture.mjs';
import {chromium,webkit,devices,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {encrypt} from '../src/crypto.mjs';
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const base=JSON.parse(await readFile('public/data/brief.json','utf8'));
const parcel=(id)=>({id,merchant:`Example shop ${id}`,itemName:'Cotton sweater',status:'delivered',updatedAt:'2026-10-02T08:00:00Z',carrier:'UPS',trackingNumber:`TEST${id}`,note:'Delivery confirmed by email; collection not confirmed.'});
const fixtures=await Promise.all([[parcel('A'),parcel('B'),parcel('C')],[]].map(shipments=>encrypt(JSON.stringify({...base,deliveries:{state:'ready',checkedAt:'2026-10-02T08:00:00Z',scope:'Test accounts',shipments}}),password)));
const server=await preview({preview:{host:'127.0.0.1',port:4178,strictPort:true}});
await mkdir('test-results',{recursive:true});
try{for(const engine of ['chrome','webkit']){
 const browser=await (engine==='chrome'?chromium.launch({channel:'chrome',headless:true}):webkit.launch({headless:true}));
 try{
 const context=await browser.newContext(engine==='webkit'?{...devices['iPhone 13'],reducedMotion:'reduce'}:{viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const remote=await syncFixture(password);await remote.install(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let edition=0;
 await page.route('**/data/brief.enc.json*',route=>route.fulfill({json:fixtures[edition]}));
 const unlock=async()=>{await page.locator('#unlock-password').fill(password);await page.locator('#unlock-form button').click();await page.locator('.page').waitFor({state:'visible'});};
 const reload=async()=>{await page.reload();await unlock();};
 const group=s=>page.locator(`#packages-${s} .delivery-item`);
 await page.goto('http://127.0.0.1:4178/');await unlock();await expect(group('incoming')).toHaveCount(3);
 await page.locator('#packages-incoming [data-package-action="received"]').first().click();await expect(group('incoming')).toHaveCount(2);
 await page.locator('#packages-incoming [data-package-action="return"]').first().click();await expect(group('returns')).toHaveCount(1);
 await reload();await expect(group('incoming')).toHaveCount(1);await expect(group('returns')).toHaveCount(1);
 await page.locator('#packages-incoming [data-package-action="return"]').click();await expect(group('returns')).toHaveCount(2);
 await page.locator('#packages-returns [data-package-action="refund"]').first().click();await expect(group('refunds')).toHaveCount(1);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow ${engine} ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.locator('#deliveries-content').screenshot({path:`test-results/packages-${engine}.png`});
 edition=1;await reload();await expect(group('incoming')).toHaveCount(0);await expect(group('returns')).toHaveCount(1);await expect(group('refunds')).toHaveCount(1);
 // Block writes: a failed save must not move the parcel or erase its previous encrypted record.
 remote.fail(true);
 await page.locator('#packages-returns [data-package-action="refund"]').click();await expect(page.locator('#packages-returns [data-package-action="refund"]')).toBeEnabled();await expect(group('returns')).toHaveCount(1);
 remote.fail(false);
 await page.locator('#packages-returns [data-package-action="refund"]').click();await expect(group('returns')).toHaveCount(0);await expect(group('refunds')).toHaveCount(2);
 await reload();await expect(group('refunds')).toHaveCount(2);
 await page.locator('#packages-refunds [data-package-action="refunded"]').first().click();await expect(group('refunds')).toHaveCount(1);
 await reload();await expect(group('refunds')).toHaveCount(1);
 await page.locator('#received-toggle').click();await expect(group('finished')).toHaveCount(2);
 const raw=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!raw.includes('Example shop')&&!raw.includes('TEST')&&!raw.includes(password));
 await page.locator('#lock-button').click();await expect(page.locator('#deliveries-content')).toBeEmpty();assert.deepEqual(errors,[]);
 console.log(`${engine}: received, returns, refunds, retained snapshots, reloads, write failures, encryption, lock and responsive layout passed.`);
 }finally{await browser.close();}
}}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
