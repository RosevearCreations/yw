import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/first-invoice-receivable-confidence-414.js','utf8');
const now=()=>new Date().toISOString();
const record=(more={})=>({
 estimate_id:'estimate-1',estimate_number:'EST-414',first_work_order_id:'work-1',
 first_work_order_number:'WO-414',closeout_id:'close-1',closeout_approved_at:now(),
 invoice_candidate_id:'candidate-1',invoice_candidate_number:'CAND-414',invoice_id:'invoice-1',
 invoice_number:'INV-414',invoice_status:'issued',invoice_date:'2026-10-01',due_date:'2026-11-01',
 total_amount_cents:10000,balance_due_cents:7500,applied_amount_cents:2500,
 receivable_state:'open_receivable_verified',...more
});
const evidence=(overrides={})=>({ok:true,scope:'first_invoice_receivable_confidence',evidence_414:{
 state:'recorded',complete:true,retrieved_at:now(),records:[record()],...overrides}});
async function boot(page,result){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(r=>{
  window.__writes=0;window.__reads=0;
  window.YWIAPI={loadAdminDirectory:async({scope})=>{
    if(scope!=='first_invoice_receivable_confidence')throw Error('Incorrect scope');
    window.__reads++;return structuredClone(r);
  },manageAdminEntity:()=>{window.__writes++;throw Error('Forbidden');}};
 },result);
 await page.addScriptTag({content:script});
 await page.locator('#receivable414 summary').click();
 await page.locator('#receivable414Recheck').click();
}
test('verified open first invoice with balanced payment applications never posts',async({page})=>{
 await boot(page,evidence());
 await expect(page.locator('[data-receivable414-state="verified"]')).toContainText('INV-414');
 await expect(page.locator('[data-receivable414-state="verified"]')).toContainText('75.00');
 await expect(page.locator('[data-receivable414-state="verified"]')).toContainText('Open receivable');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('zero balance without actual payment application remains held',async({page})=>{
 await boot(page,evidence({records:[record({balance_due_cents:0,applied_amount_cents:0,receivable_state:'zero_balance_payment_unproven'})]}));
 await expect(page.locator('[data-receivable414-state="held"]')).toContainText('not evidence of payment');
 await expect(page.locator('[data-receivable414-state="verified"]')).toHaveCount(0);
});
test('missing candidate, missing invoice, draft and discrepancy remain held',async({page})=>{
 await boot(page,evidence({records:[
  record({invoice_candidate_id:null,invoice_candidate_number:null,invoice_id:null,invoice_number:null,receivable_state:'invoice_candidate_missing'}),
  record({invoice_id:null,invoice_number:null,receivable_state:'issued_invoice_missing'}),
  record({invoice_status:'draft',receivable_state:'invoice_not_issued'}),
  record({receivable_state:'receivable_discrepancy_hold'})
 ]}));
 await expect(page.locator('[data-receivable414-state="held"]')).toHaveCount(4);
 await expect(page.locator('[data-receivable414-state="verified"]')).toHaveCount(0);
});
test('withheld, stale and missing source do not imply an invoice or zero balance',async({page})=>{
 await boot(page,evidence({state:'withheld',complete:false,records:[],reason:'query capped'}));
 await expect(page.locator('[data-receivable414-state="withheld"]')).toBeVisible();
 await page.evaluate(r=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(r);},evidence({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#receivable414Recheck').click();
 await expect(page.locator('[data-receivable414-state="withheld"]')).toBeVisible();
 await page.evaluate(r=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(r);},evidence({state:'no_record',records:[]}));
 await page.locator('#receivable414Recheck').click();
 await expect(page.locator('[data-receivable414-state="no_record"]')).toBeVisible();
});
test('renders untrusted invoice labels as text, no injection',async({page})=>{
 await boot(page,evidence({records:[record({invoice_number:'<img src=x onerror=alert(1)>'})]}));
 await expect(page.locator('[data-receivable414-state="verified"]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('[data-receivable414-state="verified"] img')).toHaveCount(0);
});
