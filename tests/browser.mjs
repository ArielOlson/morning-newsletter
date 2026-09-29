import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
const url=process.env.TEST_URL || 'http://127.0.0.1:5173/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results',{recursive:true});
const readOptional=async path=>{try{return await readFile(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const eventPath='config/events.local.json',briefPath='public/data/brief.json';
const originalEvents=await readOptional(eventPath),originalBrief=await readOptional(briefPath);
try{
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#freshness').textContent.includes('Updated'));await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#greeting').innerText(),'Good morning,\nAriel.');
  assert.equal(await page.locator('.hero-art img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.locator('#settings-button').click();await page.getByRole('heading',{name:'Your morning, your way.'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#settings-dialog').isVisible(),false);
  const saves=page.locator('#finds-content .save-button');if(await saves.count()){
    const title=await saves.first().getAttribute('aria-label');await saves.first().click();await page.getByRole('link',{name:/^Saved/}).click();await page.locator('#saved-content .find').waitFor();assert.match(await page.locator('#saved-content').innerText(),new RegExp(title.slice(5,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await page.reload();await page.locator('#saved-content .find').waitFor();await page.locator('#saved-content .save-button').first().click();assert.match(await page.locator('#saved-content').innerText(),/Keep the good ones/);
  }
  await page.getByRole('link',{name:'Today',exact:true}).click();assert.equal(await page.locator('[data-filter]').count(),0);
  assert.equal(await page.locator('#finds-content .find').count(),10);
  assert.equal(await page.locator('#finds-content .card-photo').count(),10);
  assert.equal(await page.locator('#finance-content .finance-item').count(),3);
  assert.ok(await page.locator('#deliveries-content .delivery-item').count()>0);
  assert.match(await page.locator('#deliveries-content').innerText(),/live carrier status unverified/);
  assert.match(await page.locator('#calendar-source').innerText(),/Calendar 1: checked/);
  assert.ok(await page.locator('#upcoming-preview .upcoming-item').count()>0);
  await page.getByRole('button',{name:'+ Add a reminder'}).first().click();await page.getByLabel('What should you remember?').fill('Browser verification reminder');await page.getByLabel('A little context').fill('This test is removed automatically.');await page.getByRole('button',{name:'Save reminder ♡'}).click();await page.waitForFunction(()=>!document.querySelector('#reminder-dialog').open,{},{timeout:90000});assert.match(await page.locator('#reminders-content').innerText(),/Browser verification reminder/);assert.match(await readFile(eventPath,'utf8'),/Browser verification reminder/);
  await page.getByRole('link',{name:'Coming up',exact:true}).click();await page.locator('#week-view').waitFor();assert.match(await page.locator('#week-content').innerText(),/Browser verification reminder/);
  await page.getByRole('link',{name:'Today',exact:true}).click();
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No horizontal overflow at ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  const denied=await context.request.post(`${url}__local/events`,{headers:{Origin:'https://example.org','Content-Type':'application/json'},data:{}});assert.equal(denied.status(),403);
  const secret=await context.request.get(`${url}config/calendar.local.json`);assert.equal(secret.status(),403);
  await page.route('**/data/brief.json*',async route=>{const fixture=JSON.parse(originalBrief);fixture.day='2001-01-01';fixture.weather=null;fixture.calendar={connected:true,state:'unavailable',events:[]};fixture.deliveries.state='stale';fixture.errors=['weather','calendar0'];await route.fulfill({json:fixture});});
  await page.reload();await page.locator('#notice').waitFor();assert.match(await page.locator('#notice').innerText(),/hasn’t arrived/);assert.match(await page.locator('#agenda-content').innerText(),/couldn’t refresh/);assert.match(await page.locator('#weather-content').innerText(),/couldn’t be refreshed/);
  assert.match(await page.locator('#deliveries-content').innerText(),/over 26 hours old/);
  assert.deepEqual(errors,[]);console.log('Browser checks passed: desktop/mobile layout, calendar setup, saved items, ten NYC photo cards, finance, deliveries, reminder persistence, look-ahead, source failure, stale edition, private config protection, and cross-origin write protection.');
}finally{
  if(originalEvents)await writeFile(eventPath,originalEvents);else await rm(eventPath,{force:true});
  if(originalBrief)await writeFile(briefPath,originalBrief);
  await browser.close();
}
