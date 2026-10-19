import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/owner-first-use-trial-acceptance-416.js','utf8'),now=()=>new Date().toISOString();
const steps=()=>Array.from({length:10},(_,i)=>({
 handoff:String(406+i),label:'Canonical handoff '+(406+i),
 state:i<3?'source_verified':'unresolved',reason:i<3?null:'Actual receipt missing'
}));
const trial=(more={})=>({first_work_order_id:'wo-416',work_order_number:'WO-416',
 customer_id:'c',property_id:'p',first_order_created_at:now(),
 steps:steps(),unresolved_count:7,trial_acceptance:'operator_review_required',...more});
const data=(more={})=>({ok:true,scope:'owner_first_use_trial_acceptance',acceptance_416:{
 state:'recorded',complete:true,retrieved_at:now(),record_count:1,unresolved_count:7,
 records:[trial()],unresolved_gaps:Array.from({length:7},(_,i)=>({
 first_work_order_id:'wo-416',handoff:String(i+409),reason:'Actual receipt missing'
 })),...more}});
async function boot(page,answer){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(d=>{window.__writes=0;window.__lastCopied=null;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__lastCopied=t;}}});
  window.YWIAPI={loadAdminDirectory:async({scope})=>{
   if(scope!=='owner_first_use_trial_acceptance')throw Error('wrong scope');return structuredClone(d);
  },manageAdminEntity:()=>{window.__writes++;throw Error('Forbidden write');}};},answer);
 await page.addScriptTag({content:script});
 await page.locator('#owner416 summary').click();
 await page.locator('#owner416Recheck').click();
}
test('verified source handoffs still need owner approval and missing gaps stay visible',async({page})=>{
 await boot(page,data());
 await expect(page.locator('[data-owner416-state="gaps"]')).toContainText('WO-416');
 await expect(page.locator('[data-owner416-state="gaps"]')).toContainText('GAP — Actual receipt missing');
 await expect(page.locator('[data-owner416-state="gaps"]')).toContainText('Source verified (operator acceptance pending)');
 await expect(page.locator('[data-owner416-state="gaps"]')).toContainText('Owner acceptance: not recorded.');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('owner must explicitly copy gap receipt; it is not a server-side approval',async({page})=>{
 await boot(page,data());
 expect(await page.evaluate(()=>window.__lastCopied)).toBe(null);
 await page.locator('#owner416Copy').click();
 const r=JSON.parse(await page.evaluate(()=>window.__lastCopied));
 expect(r.build).toBe(416);expect(r.review_status).toBe('owner_review_pending');
 expect(r.unresolved_gaps).toHaveLength(7);
 expect(r.note).toContain('NOT server-stored acceptance');
 await expect(page.locator('#owner416CopyStatus')).toContainText('nothing was sent to the server');
});
test('no record, withheld and stale reads cannot copy approval or fake success',async({page})=>{
 await boot(page,data({state:'no_record',records:[],unresolved_gaps:[]}));
 await expect(page.locator('[data-owner416-state="no_record"]')).toBeVisible();
 await expect(page.locator('#owner416Copy')).toBeDisabled();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),data({state:'withheld',complete:false,records:[],unresolved_gaps:[],reason:'Source capped'}));
 await page.locator('#owner416Recheck').click();
 await expect(page.locator('[data-owner416-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),data({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#owner416Recheck').click();
 await expect(page.locator('[data-owner416-state="withheld"]')).toBeVisible();
 await expect(page.locator('#owner416Copy')).toBeDisabled();
});
test('inconsistent handoff record is blocked and untrusted names escaped',async({page})=>{
 await boot(page,data({records:[trial({work_order_number:'<img src=x onerror=alert(1)>'})]}));
 await expect(page.locator('[data-owner416-state="gaps"]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('[data-owner416-state="gaps"] img')).toHaveCount(0);
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),data({records:[trial({steps:steps().slice(0,9)})]}));
 await page.locator('#owner416Recheck').click();
 await expect(page.locator('#owner416Status')).toContainText('BLOCKED');
 await expect(page.locator('#owner416Copy')).toBeDisabled();
});
