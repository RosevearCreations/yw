import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/operations-cockpit.js'),'utf8');

async function mount(page,{approvedQueue=false}={}){
  await page.route('https://ar313.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="admin"><div id="ad_stats_grid"></div></section></body></html>'});
  });
  await page.goto('https://ar313.test/');
  await page.evaluate(({approvedQueue})=>{
    const invoice={id:'10000000-0000-4000-8000-000000000001',invoice_number:'INV-313-1',invoice_date:'2026-09-01',due_date:'2026-09-30',invoice_status:'open',total_amount:150,balance_due:150,client_id:'20000000-0000-4000-8000-000000000001'};
    const payment={id:'30000000-0000-4000-8000-000000000001',payment_number:'PAY-313-1',reference_number:'BANK-313',payment_date:'2026-09-15',amount:125,unapplied_amount:125,application_status:'unapplied',client_id:invoice.client_id};
    const deposit={id:'40000000-0000-4000-8000-000000000001',payment_reference:'DEP-313-1',paid_amount:80,requested_amount:80,deposit_status:'paid',paid_at:'2026-09-14T12:00:00Z',client_id:invoice.client_id};
    window.__ar313Calls=[];
    window.__ar313State={invoice,payment,deposit,payments:approvedQueue?[{
      id:'50000000-0000-4000-8000-000000000001',action_type:'apply_payment',action_status:'approved',posting_status:'not_posted',ledger_side:'ar',
      transaction_date:'2026-09-18',customer_or_vendor_name:'Example Customer',invoice_reference:invoice.invoice_number,payment_reference:payment.payment_number,
      amount:100,proof_reference:'BANK-313',metadata:{payment_application:{application_type:'receipt',client_name:'Example Customer',source_reference:payment.payment_number}}
    }]:[]};
    const clone=(v)=>JSON.parse(JSON.stringify(v));
    const pass=(key,message)=>({key,status:'pass',message});
    window.YWIAPI={
      async manageOperations(payload){
        window.__ar313Calls.push(clone(payload));
        const s=window.__ar313State;
        if(payload.action==='operations_queue_list') return {ok:true,build:'313',queues:{
          payments:clone(s.payments),ar_invoices:[clone(s.invoice)],ar_payments:[clone(s.payment)],customer_deposits:[clone(s.deposit)],ar_applications:[],
          bank_imports:[],reconciliation:[],bank_items:[],profiles:[],banks:[],rails:[],equipment:[],equipment_service:[],assets:[],routes:[],quotes:[],portal:[],
          job_costs:[],job_updates:[],customer_notifications:[],execution_proofs:[],execution_costs:[],closeouts:[],content_signals:[],webhook_alerts:[],staging_tests:[],
          capabilities:{actions:{
            payment_application_preview:{permitted:true,label:'A/R preview'},
            payment_action_request:{permitted:true,label:'Payment request'},
            payment_action_decision:{permitted:true,label:'Payment approval'}
          }}
        }};
        if(payload.action==='payment_application_preview'){
          const sourceAvailable=payload.application_type==='deposit'?80:payload.application_type==='overpayment'?125:125;
          const needsInvoice=payload.application_type!=='overpayment';
          const allowed=Number(payload.amount)>0 && Number(payload.amount)<=sourceAvailable && (!needsInvoice || (payload.invoice_id===s.invoice.id && Number(payload.amount)<=s.invoice.balance_due)) && Boolean(payload.proof_reference);
          const validations=[
            pass('invoice',needsInvoice?'Invoice found.':'No invoice required for overpayment classification.'),
            pass('source','Authoritative source found.'),
            pass('customer_identity','Customer identity matches invoice and source.'),
            allowed?pass('amount','Amount fits available balances.'):{key:'available_balance',status:'fail',message:'Amount exceeds the available source or invoice balance.'},
            pass('date','Application date is on or after source date.'),
            pass('open_period','A/R period is open.'),
            pass('proof','Proof reference supplied.')
          ];
          return {ok:true,posting_enabled:false,preview:{allowed,application:{
            application_type:payload.application_type,application_date:payload.application_date,amount:Number(payload.amount),
            invoice_id:payload.invoice_id||null,invoice_reference:payload.invoice_id?s.invoice.invoice_number:null,invoice_balance:payload.invoice_id?s.invoice.balance_due:0,
            payment_id:payload.payment_id||null,payment_reference:payload.payment_id?s.payment.payment_number:null,
            deposit_id:payload.deposit_id||null,deposit_reference:payload.deposit_id?s.deposit.payment_reference:null,
            source_reference:payload.application_type==='deposit'?s.deposit.payment_reference:s.payment.payment_number,
            source_type:payload.application_type==='deposit'?'customer_deposit':'ar_payment',available_amount:sourceAvailable,
            client_id:s.invoice.client_id,client_name:'Example Customer',posting_enabled:false
          },validations}};
        }
        if(payload.action==='payment_action_request'){
          const record={id:'50000000-0000-4000-8000-000000000002',action_type:payload.application_type==='receipt'?'apply_payment':'apply_'+payload.application_type,
            action_status:'submitted',posting_status:'not_posted',ledger_side:'ar',transaction_date:payload.application_date,customer_or_vendor_name:'Example Customer',
            invoice_reference:s.invoice.invoice_number,payment_reference:s.payment.payment_number,amount:Number(payload.amount),proof_reference:payload.proof_reference,
            metadata:{payment_application:{application_type:payload.application_type,client_name:'Example Customer',source_reference:s.payment.payment_number}}};
          s.payments.unshift(record);
          return {ok:true,posting_enabled:false,record};
        }
        if(payload.action==='payment_action_decision'){
          if(payload.decision==='post') throw new Error('posting must remain disabled');
          return {ok:true,record:{id:payload.request_id,action_status:payload.decision==='approve'?'approved':'rejected',posting_status:'not_posted'}};
        }
        throw new Error('Unexpected action '+payload.action);
      }
    };
  },{approvedQueue});
  await page.addScriptTag({content:source});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#operationsCockpit')).toBeVisible();
  await expect(page.locator('#oc_ar_application_form')).toBeVisible();
  await expect(page.locator('#oc_ar_application_submit')).toBeDisabled();
}

test('Build 313 validates a receipt then submits an auditable review request without posting',async({page})=>{
  await mount(page);
  const form=page.locator('#oc_ar_application_form');
  await form.locator('[name="application_type"]').selectOption('receipt');
  await form.locator('[name="invoice_id"]').selectOption('10000000-0000-4000-8000-000000000001');
  await form.locator('[name="payment_id"]').selectOption('30000000-0000-4000-8000-000000000001');
  await form.locator('[name="application_date"]').fill('2026-09-18');
  await form.locator('[name="amount"]').fill('100');
  await form.locator('[name="proof_reference"]').fill('BANK-313');
  await form.locator('[name="reason"]').fill('Apply confirmed receipt to open invoice.');
  await page.locator('#oc_ar_application_preview_btn').click();
  await expect(page.locator('#oc_ar_application_preview')).toContainText('ready for review');
  await expect(page.locator('#oc_ar_application_preview')).toContainText('Posting');
  await expect(page.locator('#oc_ar_application_preview')).toContainText('OFF');
  await expect(page.locator('#oc_ar_application_submit')).toBeEnabled();
  await page.locator('#oc_ar_application_submit').click();
  await expect.poll(async()=>page.evaluate(()=>window.__ar313Calls.filter((x)=>x.action==='payment_action_request').length)).toBe(1);
  const request=await page.evaluate(()=>window.__ar313Calls.find((x)=>x.action==='payment_action_request'));
  expect(request.application_type).toBe('receipt');
  expect(request.invoice_id).toBe('10000000-0000-4000-8000-000000000001');
  expect(request.payment_id).toBe('30000000-0000-4000-8000-000000000001');
  expect(request.idempotency_key).toMatch(/^ar_application_/);
  const calls=await page.evaluate(()=>window.__ar313Calls);
  expect(calls.some((x)=>x.action==='payment_action_decision'&&x.decision==='post')).toBe(false);
});

test('Build 313 blocks an amount beyond the available source or invoice balance',async({page})=>{
  await mount(page);
  const form=page.locator('#oc_ar_application_form');
  await form.locator('[name="application_type"]').selectOption('receipt');
  await form.locator('[name="invoice_id"]').selectOption('10000000-0000-4000-8000-000000000001');
  await form.locator('[name="payment_id"]').selectOption('30000000-0000-4000-8000-000000000001');
  await form.locator('[name="application_date"]').fill('2026-09-18');
  await form.locator('[name="amount"]').fill('140');
  await form.locator('[name="proof_reference"]').fill('BANK-313');
  await form.locator('[name="reason"]').fill('Attempt amount above payment availability.');
  await page.locator('#oc_ar_application_preview_btn').click();
  await expect(page.locator('#oc_ar_application_preview')).toContainText('blocked');
  await expect(page.locator('#oc_ar_application_preview')).toContainText('Amount exceeds');
  await expect(page.locator('#oc_ar_application_submit')).toBeDisabled();
  expect(await page.evaluate(()=>window.__ar313Calls.filter((x)=>x.action==='payment_action_request').length)).toBe(0);
});

test('Build 313 handles paid deposit source and exposes no ledger-post control',async({page})=>{
  await mount(page,{approvedQueue:true});
  const form=page.locator('#oc_ar_application_form');
  await form.locator('[name="application_type"]').selectOption('deposit');
  await form.locator('[name="invoice_id"]').selectOption('10000000-0000-4000-8000-000000000001');
  await form.locator('[name="deposit_id"]').selectOption('40000000-0000-4000-8000-000000000001');
  await form.locator('[name="application_date"]').fill('2026-09-18');
  await form.locator('[name="amount"]').fill('80');
  await form.locator('[name="proof_reference"]').fill('DEP-313-1');
  await form.locator('[name="reason"]').fill('Apply paid customer deposit to invoice.');
  await page.locator('#oc_ar_application_preview_btn').click();
  await expect(page.locator('#oc_ar_application_preview')).toContainText('ready for review');
  await expect(page.locator('#oc_payment_queue')).toContainText('posting remains disabled');
  await expect(page.locator('[data-oc-action="payment-post"]')).toHaveCount(0);
});
