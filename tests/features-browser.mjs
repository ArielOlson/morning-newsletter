import {syncFixture} from './sync-fixture.mjs';
import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const brief=JSON.parse(await readFile('public/data/brief.json','utf8'));
const server=process.env.FEATURE_TEST_URL?null:await preview({preview:{host:'127.0.0.1',port:4175,strictPort:true}});
const base=process.env.FEATURE_TEST_URL||'http://127.0.0.1:4175/';
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 await (await syncFixture(password)).install(page.context());
 page.on('pageerror',e=>errors.push(e.message));
 const unlock=async()=>{await page.locator('#unlock-password').fill(password);await page.locator('#unlock-form button').click();await page.locator('.page').waitFor({state:'visible'});};
 await page.goto(base+'?features='+Date.now());await unlock();
 const checkArtwork=async src=>{const art=page.locator('.hero-art img');await art.evaluate(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,12000);}));assert.ok((await art.getAttribute('src')).endsWith(src));assert.ok(await art.evaluate(img=>img.naturalWidth>0),'Edition artwork loads');};
 await checkArtwork(brief.artwork?.src||'assets/morning.png');
 assert.equal(await page.locator('#finds-content .find').count(),20);
 assert.equal(brief.ideas.length,10,'Daily edition has ten free-time ideas');
 assert.equal(await page.locator('#ideas-content .find').count(),brief.ideas.length);
 assert.match(await page.locator('#calendar-source').innerText(),/Calendar 1: checked.*Calendar 2: checked/);
 const heart=page.locator('#finds-content [data-save]').first(),id=await heart.getAttribute('data-save');
 await heart.click();await page.waitForFunction(id=>document.querySelector(`[data-save="${id}"]`).getAttribute('aria-pressed')==='true',id);
 const received=page.locator('[data-received]').first(),shipment=await received.getAttribute('data-received');
 const before=await page.locator('.delivery-item').count();await received.click();
 await page.waitForFunction(n=>document.querySelectorAll('.delivery-item').length===n,before-1);
 await page.locator('#received-toggle').click();assert.match(await page.locator(`[data-received="${shipment}"]`).innerText(),/Received/);
 assert.equal(await page.locator('.delivery-item').first().locator(':scope > *').count(),3);
 await page.locator('#received-toggle').click();
 const idea=page.locator('#ideas-content [data-complete]').first(),ideaId=await idea.getAttribute('data-complete');
 await idea.click();await expect(page.locator(`#ideas-content [data-complete="${ideaId}"]`)).toHaveCount(0);
 const link=page.locator('#finds-content a[target="_blank"]').first();
 // Record a real link interaction without navigating to the external site during this test.
 await link.evaluate(a=>{a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click();});
 await expect(link).toHaveAttribute('data-visited','true');
 await page.reload();await unlock();
 assert.equal(await page.locator(`[data-save="${id}"]`).first().getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator(`[data-received="${shipment}"]`).count(),0);
 assert.equal(await page.locator(`#ideas-content [data-complete="${ideaId}"]`).count(),0);
 assert.equal(await page.locator('#finds-content a[target="_blank"]').first().getAttribute('data-visited'),'true');
 await page.locator('#past-editions-button').click();await page.locator(`[data-edition="${brief.day}"]`).click();
 await page.locator('#archive-banner').waitFor({state:'visible'});
 assert.equal(await page.locator(`[data-save="${id}"]`).first().getAttribute('aria-pressed'),'true');
 assert.match(await page.locator(`[data-received="${shipment}"]`).innerText(),/Received/);
 assert.match(await page.locator(`#ideas-content [data-complete="${ideaId}"]`).innerText(),/Done/);
 await page.locator(`#ideas-content [data-complete="${ideaId}"]`).click();
 await expect(page.locator(`#ideas-content [data-complete="${ideaId}"]`)).toHaveText("Done this");
 await page.locator(`[data-received="${shipment}"]`).click();
 await page.waitForFunction(id=>document.querySelector(`[data-received="${id}"]`)?.textContent==='Received',shipment);
 await page.locator('#past-editions-button').click();
 await page.locator('[data-edition]').first().waitFor();
 assert.ok(await page.locator('[data-edition]').count()>=2);
 await page.locator('[data-edition]').last().click();await page.locator('#archive-dialog').waitFor({state:'hidden'});
 // The earliest archived edition predates daily artwork and retains its original picture.
 await checkArtwork('assets/morning.png');
 await page.locator('#latest-edition').click();await page.locator('#archive-banner').waitFor({state:'hidden'});
 await checkArtwork(brief.artwork?.src||'assets/morning.png');
 assert.equal(await page.locator('.delivery-item').count(),before);
 assert.equal(await page.locator('#ideas-content .find').count(),brief.ideas.length);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No page overflow at ${width}`);}
 const rail=page.locator('#finds-content');
 assert.ok(await rail.evaluate(e=>e.scrollWidth>e.clientWidth));
 await page.locator('[data-scroll="finds-content"][data-direction="1"]').click();assert.ok(await rail.evaluate(e=>e.scrollLeft>0));
 // Scroll each photo into view so lazy loading is checked across the entire rail.
 const photos=rail.locator('img');assert.equal(await photos.count(),20);
 for(const photo of await photos.all()){await photo.scrollIntoViewIfNeeded();await photo.evaluate(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,12000);}));assert.equal(await photo.evaluate(img=>img.naturalWidth>0),true,'Event photo loads');}
 const ideaPhotos=page.locator('#ideas-content img');assert.equal(await ideaPhotos.count(),10);
 for(const photo of await ideaPhotos.all()){await photo.scrollIntoViewIfNeeded();await photo.evaluate(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,12000);}));assert.equal(await photo.evaluate(img=>img.naturalWidth>0),true,'Free-time idea photo loads');}
 await rail.evaluate(e=>e.scrollLeft=0);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'test-results/features-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/features-mobile.png',fullPage:true});
 const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.equal(storage.includes(password),false);assert.equal(storage.includes(shipment),false);assert.equal(storage.includes(brief.ideas[0].title),false);
 assert.deepEqual(errors,[]);
 console.log('Verified ten event photos and ten free-time photos, both calendars, responsive scrolling, persistent encrypted hearts, received packages and undo, completed ideas, link history, and encrypted archive navigation.');
}finally{await browser.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve());}
