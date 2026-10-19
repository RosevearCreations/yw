import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/invoice-candidate-provenance-413.js','utf8');
const now=()=>new Date().toISOString();
const row=(changes={})=>({estimate_id:'est',estimate_number:'EST-413',first_work_order_id:'work-1',
 first_work_order_number:'WO-413',qc_run_id:'qc-1',qc_reviewed_at:now(),closeout_id:'close-1',
 closeout_approved_at:now(),customer_signoff_status:'signed',invoice_candidate_id:'cand-1',
 invoice_candidate_number:'CAND-413',candidate_status:'ready',finance_completion_review_id:'review-1',
 provenance_state:'candidate_ready_unposted',...changes});
const response=(changes={})=>({ok:true,scope:'first_job_invoice_candidate_provenance',trace_413:{
 state:'recorded',complete:true,retrieved_at:now(),records:[row()],...changes}});
async function boot(page,data){await page.setViewportSize({width:390,height:840});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(d=>{window.__writes=0;window.YWIAPI={
 loadAdminDirectory:async({scope})=>{if(scope!=='first_job_invoice_candidate_provenance')throw Error('Incorrect scope');return structuredClone(d)},
 manageAdminEntity:()=>{window.__writes++;throw Error('Forbidden')}}},data);
 await page.addScriptTag({content:script});
 await page.locator('#candidate413 summary').click();await page.locator('#candidate413Recheck').click();
}
test('ready Finance candidate shows provenance but does not claim issued invoice',async({page})=>{
 await boot(page,response());const e=page.locator('[data-candidate413-state="recorded"]');
 await expect(e).toContainText('WO-413');await expect(e).toContainText('CAND-413');
 await expect(e).toContainText('NOT posted or invoiced');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('unapproved QC/closeout, missing candidate and incomplete review authority held',async({page})=>{
 await boot(page,response({records:[
 row({provenance_state:'qc_approval_hold',qc_reviewed_at:null}),
 row({provenance_state:'closeout_or_signoff_hold',closeout_approved_at:null}),
 row({provenance_state:'finance_candidate_missing',invoice_candidate_id:null,candidate_status:null}),
 row({provenance_state:'candidate_provenance_missing',finance_completion_review_id:null})]}));
 await expect(page.locator('[data-candidate413-state="held"]')).toHaveCount(4);
});
test('source cap, stale data, no-record cannot fabricate Finance candidate',async({page})=>{
 await boot(page,response({state:'withheld',complete:false,records:[],reason:'stale source'}));
 await expect(page.locator('[data-candidate413-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),response({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#candidate413Recheck').click();await expect(page.locator('[data-candidate413-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),response({state:'no_record',records:[]}));
 await page.locator('#candidate413Recheck').click();await expect(page.locator('[data-candidate413-state="no_record"]')).toBeVisible();
});
test('does not render untrusted candidate labels as elements',async({page})=>{
 await boot(page,response({records:[row({invoice_candidate_number:'<img src=x onerror=alert(1)>'})]}));
 await expect(page.locator('[data-candidate413-state="recorded"]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('[data-candidate413-state="recorded"] img')).toHaveCount(0);
});
