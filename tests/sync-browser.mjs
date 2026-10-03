import {chromium,webkit,devices,expect} from '@playwright/test';
import {preview} from 'vite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {syncFixture} from './sync-fixture.mjs';
import {encrypt} from '../src/crypto.mjs';
const {password}=JSON.parse(await readFile('config/security.local.json','utf8'));
const brief=JSON.parse(await readFile('public/data/brief.json','utf8'));
const server=await preview({preview:{host:'127.0.0.1',port:4181,strictPort:true}});
try{for(const name of ['chrome','webkit']){
 const browser=await (name==='chrome'?chromium.launch({channel:'chrome',headless:true}):webkit.launch({headless:true}));
 try{
 const remote=await syncFixture(password,{remember:false}),contexts=[];
 const unlock=async p=>{await p.locator('#unlock-password').fill(password);await p.locator('#unlock-form button').click();await expect(p.locator('.page')).toBeVisible();};
 const newDevice=async()=>{const c=await browser.newContext(name==='webkit'?devices['iPhone 13']:{viewport:{width:390,height:844}});contexts.push(c);await remote.install(c);const p=await c.newPage();await p.goto('http://127.0.0.1:4181/');await unlock(p);return p;};
 const connect=async p=>{await p.locator('#settings-button').click();await p.locator('#settings-dialog summary').click();await p.locator('#sync-key').fill('github_pat_synthetic_test_only');await p.locator('#sync-form button').click();await expect(p.locator('#sync-form-status')).toContainText('Connected.');await p.locator('.close-settings').click();};
 const a=await newDevice();await connect(a);
 await a.locator('.add-reminder').first().click();const form=a.locator('#reminder-form');await form.locator('[name=title]').fill('Persistent test reminder');await form.locator('[name=startDate]').fill(brief.day);await form.locator('[name=endDate]').fill(brief.day);await form.locator('[type=submit]').click();await expect(a.locator('#reminder-dialog')).toBeHidden();
 const heart=a.locator('#finds-content [data-save]').first(),heartId=await heart.getAttribute('data-save');await heart.click();await expect(heart).toHaveAttribute('aria-pressed','true');
 await a.locator('#packages-incoming [data-package-action="return"]').first().click();await expect(a.locator('#packages-returns .delivery-item')).toHaveCount(1);
 const b=await newDevice();await connect(b);await expect(b.locator('#reminders-content')).toContainText('Persistent test reminder');await expect(b.locator(`[data-save="${heartId}"]`).first()).toHaveAttribute('aria-pressed','true');await expect(b.locator('#packages-returns .delivery-item')).toHaveCount(1);
 const tomorrow=new Date(Date.parse(brief.day+'T12:00:00Z')+86400000).toISOString().slice(0,10),future=await encrypt(JSON.stringify({...brief,day:tomorrow,deliveries:{...brief.deliveries,shipments:[]}}),password);
 await b.route('**/data/brief.enc.json*',r=>r.fulfill({json:future}));await b.reload();await unlock(b);await expect(b.locator('#reminders-content')).toContainText('Persistent test reminder');await expect(b.locator('#packages-returns .delivery-item')).toHaveCount(1);
 await b.locator('#reminders-content .reminder').filter({hasText:'Persistent test reminder'}).locator('[data-complete]').click();await expect(b.locator('#reminders-content')).not.toContainText('Persistent test reminder');
 await b.locator('#packages-returns [data-package-action="refund"]').click();await expect(b.locator('#packages-refunds .delivery-item')).toHaveCount(1);
 // Clearing browser storage loses only the connection. Reconnecting restores confirmed remote state.
 await a.evaluate(()=>localStorage.clear());await a.reload();await unlock(a);await connect(a);await expect(a.locator('#reminders-content')).not.toContainText('Persistent test reminder');await expect(a.locator('#packages-refunds .delivery-item')).toHaveCount(1);await expect(a.locator(`[data-save="${heartId}"]`).first()).toHaveAttribute('aria-pressed','true');
 await a.locator('#packages-refunds [data-package-action="refunded"]').click();await expect(a.locator('#packages-refunds .delivery-item')).toHaveCount(0);
 remote.fail(true);await a.locator('.add-reminder').first().click();await form.locator('[name=title]').fill('Unsaved draft');await form.locator('[name=startDate]').fill(brief.day);await form.locator('[type=submit]').click();await expect(a.locator('#form-status')).toContainText('could not confirm');await expect(form.locator('[name=title]')).toHaveValue('Unsaved draft');assert.ok(!JSON.stringify(await remote.data()).includes('Unsaved draft'));remote.fail(false);
 await a.locator('#reminder-dialog .close-dialog').click();await a.locator('#lock-button').click();await expect(a.locator('#sync-key')).toHaveValue('');await expect(a.locator('#deliveries-content')).toBeEmpty();
 console.log(`${name}: fresh-device restoration, cleared storage recovery, persistent overdue reminder/completion, hearts, returns/refunds, and durable-save failure passed.`);
 for(const c of contexts)await c.close();
 }finally{await browser.close();}
}}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
