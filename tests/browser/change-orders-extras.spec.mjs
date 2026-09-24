import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-change-orders-extras-ui.js'),'utf8');
async function boot(page){
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{
   window.__co344=[];
   const data={ok:true,
    change_order_extras:[{id:'c1',change_order_number:'CO-1',work_order_number:'WO-1',work_order_id:'w1',lifecycle_stage:'needs_customer_authorization',service_context:'snow_clearing_removal',season_context:'winter',scope_summary:'Extra ice removal at rear entrance',estimated_cost_delta:30,estimated_charge_delta:75,evidence_count:2}],
    change_order_evidence:[{id:'e1',change_order_id:'c1',evidence_type:'photo'}],
    change_order_budget_applications:[],
    change_order_work_orders:[{id:'w1',work_order_number:'WO-1',status:'in_progress',work_type:'snow'}],
    change_order_invoice_candidates:[{id:'i1',candidate_number:'INV-CAND-1',candidate_status:'draft',work_order_id:'w1',total_amount:300}]
   };
   window.YWIAPI={
    loadAdminDirectory:async(q)=>{window.__co344.push({kind:'load',q});return structuredClone(data);},
    manageOperations:async(q)=>{window.__co344.push({kind:'manage',q});return {ok:true,record:{id:q.change_order_id||'c2',change_order_number:'CO-2'},invoice_created:false,finance_posted:false,customer_billing_mutated:false};}
   };
 });
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIChangeOrdersExtrasUI.mount({api:window.YWIAPI}));
}
test('Build 344 renders controlled four-season change-order workflow',async({page})=>{
 await boot(page);
 const panel=page.locator('#changeOrdersExtras344');
 await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
 await expect(panel).toContainText('No hidden field pricing or billing');
 await expect(panel).toContainText('winter snow clearing/removal');
 await expect(panel).toContainText('Finance authority');
 await expect(panel).toContainText('CO-1');
});
test('Build 344 crew discovery sends no price fields',async({page})=>{
 await boot(page);
 await page.selectOption('#co344WorkOrder','w1');
 await page.selectOption('#co344Service','snow_clearing_removal');
 await page.selectOption('#co344Season','winter');
 await page.fill('#co344Discovery','Unexpected ice accumulation needs extra treatment.');
 await page.click('#co344Discover');
 const calls=await page.evaluate(()=>window.__co344.filter(x=>x.kind==='manage').map(x=>x.q));
 const call=calls.find(x=>x.action==='change_order_discovery_save');
 expect(call).toBeTruthy();
 expect(call.estimated_charge_delta).toBeUndefined();
 expect(call.estimated_cost_delta).toBeUndefined();
});
test('Build 344 captures supervisor pricing then explicit authorization',async({page})=>{
 await boot(page);
 await page.selectOption('#co344ReviewChange','c1');
 await page.fill('#co344Cost','30');
 await page.fill('#co344Charge','75');
 await page.fill('#co344ReviewedScope','Extra ice removal at rear entrance');
 await page.click('#co344ReviewSave');
 await page.selectOption('#co344AuthDecision','authorize');
 await page.selectOption('#co344AuthMethod','email');
 await page.fill('#co344AuthRef','EMAIL-APPROVAL-123');
 await page.fill('#co344AuthName','Test Customer');
 await page.click('#co344AuthSave');
 const calls=await page.evaluate(()=>window.__co344.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='change_order_review_price'&&x.estimated_charge_delta===75)).toBeTruthy();
 expect(calls.some(x=>x.action==='change_order_customer_authorization'&&x.customer_approval_reference==='EMAIL-APPROVAL-123')).toBeTruthy();
});
test('Build 344 applies once and only records Finance evidence linkage',async({page})=>{
 await boot(page);
 await page.selectOption('#co344ApplyChange','c1');
 await page.click('#co344Apply');
 await page.selectOption('#co344InvoiceStatus','linked');
 await page.selectOption('#co344InvoiceCandidate','i1');
 await page.fill('#co344InvoiceRef','Closeout evidence ready for Finance review');
 await page.click('#co344InvoiceSave');
 const calls=await page.evaluate(()=>window.__co344.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='change_order_apply')).toBeTruthy();
 expect(calls.some(x=>x.action==='change_order_invoice_evidence_save'&&x.invoice_candidate_id==='i1')).toBeTruthy();
 expect(calls.some(x=>['invoice_create','ar_invoice_create','finance_post','payment_apply'].includes(x.action))).toBeFalsy();
});
