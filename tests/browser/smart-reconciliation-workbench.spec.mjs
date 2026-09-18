import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const cockpitSource=fs.readFileSync(path.join(process.cwd(),'js/operations-cockpit.js'),'utf8');

async function mount(page){
  await page.route('https://recon312.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>
      <section id="admin"><div id="ad_stats_grid"></div></section>
    </body></html>`});
  });
  await page.goto('https://recon312.test/');
  await page.evaluate(()=>{
    window.__recon312Calls=[];
    const clone=(value)=>JSON.parse(JSON.stringify(value));
    const item={
      id:'10000000-0000-4000-8000-000000000001',
      reconciliation_session_id:'20000000-0000-4000-8000-000000000001',
      item_date:'2026-09-15',
      item_description:'Customer payment INV-1001',
      amount:150,
      match_status:'unmatched',
      clearing_status:'open',
      difference_reason:null
    };
    const suggestions=[
      {
        rank:1,match_mode:'one_to_one',type:'customer_invoice',
        target_id:'30000000-0000-4000-8000-000000000001',reference:'INV-1001',
        targets:[{target_type:'customer_invoice',target_id:'30000000-0000-4000-8000-000000000001',target_reference:'INV-1001',allocated_amount:150,target_date:'2026-09-15'}],
        group_total:150,partial:false,actionable:true,requires_human_confirmation:true,confidence_band:'high',
        matching_rule:'Exact candidate still requires operator confirmation.',
        explanation:{score:98,confidence_band:'high',target_amount:150,amount_difference:0,amount_coverage_percent:100,components:{amount:55,date:20,reference:15,description:8},summary:'55/55 amount, 20/20 date, 15/15 reference, 8/10 description; 100% amount coverage.'}
      },
      {
        rank:2,match_mode:'one_to_many',type:'multi_target',target_id:null,reference:'INV-1002 + INV-1003',
        targets:[
          {target_type:'customer_invoice',target_id:'30000000-0000-4000-8000-000000000002',target_reference:'INV-1002',allocated_amount:100,target_date:'2026-09-15'},
          {target_type:'customer_invoice',target_id:'30000000-0000-4000-8000-000000000003',target_reference:'INV-1003',allocated_amount:50,target_date:'2026-09-15'}
        ],
        group_total:150,partial:false,actionable:true,requires_human_confirmation:true,confidence_band:'high',
        matching_rule:'Exact-cent split only after operator review.',
        explanation:{score:90,confidence_band:'high',target_amount:150,amount_difference:0,amount_coverage_percent:100,components:{amount:55,date:20,reference:8,description:7},summary:'Exact two-invoice combination; human review required.'}
      },
      {
        rank:3,match_mode:'many_to_one',type:'customer_invoice',
        target_id:'30000000-0000-4000-8000-000000000004',reference:'INV-2000',
        targets:[{target_type:'customer_invoice',target_id:'30000000-0000-4000-8000-000000000004',target_reference:'INV-2000',allocated_amount:200,target_date:'2026-09-15'}],
        related_bank_rows:[{id:item.id,amount:150},{id:'10000000-0000-4000-8000-000000000002',amount:50}],
        group_total:200,partial:false,actionable:false,requires_human_confirmation:true,confidence_band:'medium',
        matching_rule:'Review-only aggregate candidate; no automatic multi-bank-row action.',
        explanation:{score:78,confidence_band:'medium',target_amount:200,amount_difference:0,amount_coverage_percent:100,components:{amount:55,date:15,reference:8,description:0},summary:'Two bank rows appear to map to one invoice; review only.'}
      },
      {
        rank:4,match_mode:'one_to_one',type:'customer_deposit',
        target_id:'40000000-0000-4000-8000-000000000001',reference:'DEP-1',
        targets:[{target_type:'customer_deposit',target_id:'40000000-0000-4000-8000-000000000001',target_reference:'DEP-1',allocated_amount:120,target_date:'2026-09-15'}],
        group_total:120,partial:true,actionable:false,requires_human_confirmation:true,confidence_band:'medium',
        matching_rule:'Partial candidate requires operator review; no automatic application.',
        explanation:{score:68,confidence_band:'medium',target_amount:120,amount_difference:30,amount_coverage_percent:80,components:{amount:30,date:20,reference:8,description:10},summary:'80% amount coverage; partial candidate.'}
      }
    ];
    window.YWIAPI={
      async manageOperations(payload){
        window.__recon312Calls.push(clone(payload));
        if(payload.action==='operations_queue_list'){
          return {ok:true,build:'312',queues:{
            bank_items:[clone(item)],reconciliation:[],payments:[],bank_imports:[],equipment:[],equipment_service:[],
            assets:[],routes:[],quotes:[],portal:[],job_costs:[],job_updates:[],customer_notifications:[],
            execution_proofs:[],execution_costs:[],closeouts:[],profiles:[],banks:[],rails:[],content_signals:[],
            webhook_alerts:[],staging_tests:[],capabilities:{actions:{
              reconciliation_action:{permitted:true,label:'Reconciliation approval'},
              reconciliation_suggest:{permitted:true,label:'Reconciliation suggestions'}
            }}
          }};
        }
        if(payload.action==='reconciliation_suggest') return {ok:true,item:clone(item),suggestions:clone(suggestions)};
        if(payload.action==='reconciliation_action') return {ok:true,record:{id:'50000000-0000-4000-8000-000000000001'},match_explanation:payload.match_explanation||{summary:'Recorded.'}};
        throw new Error('Unexpected action '+payload.action);
      }
    };
  });
  await page.addScriptTag({content:cockpitSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#operationsCockpit')).toBeVisible();
  await expect(page.locator('[data-oc-action="recon-suggest"]')).toBeVisible();
}

test('Build 312 ranks exact, split and review-only reconciliation candidates',async({page})=>{
  await mount(page);
  await page.locator('[data-oc-action="recon-suggest"]').click();
  await expect(page.locator('#oc_recon_suggestions')).toContainText('#1 · INV-1001');
  await expect(page.locator('#oc_recon_suggestions')).toContainText('one → to → many');
  await expect(page.locator('#oc_recon_suggestions')).toContainText('many → to → one');
  await expect(page.locator('#oc_recon_suggestions')).toContainText('high · 98%');

  await page.locator('.oc-suggestion[data-suggestion-index="0"]').click();
  await expect(page.locator('#oc_recon_target')).toHaveValue('INV-1001');
  await expect(page.locator('#oc_recon_action')).toHaveValue('match');

  await page.locator('.oc-suggestion[data-suggestion-index="1"]').click();
  await expect(page.locator('#oc_recon_action')).toHaveValue('split');
  const split=JSON.parse(await page.locator('#oc_recon_form [name="split_rows"]').inputValue());
  expect(split).toHaveLength(2);
  expect(split.reduce((sum,row)=>sum+Number(row.allocated_amount||0),0)).toBe(150);

  await page.locator('.oc-suggestion[data-suggestion-index="2"]').click();
  await expect(page.locator('#oc_status')).toContainText('review-only');
  await expect(page.locator('#oc_recon_target')).toHaveValue('');
});

test('Build 312 exact candidate remains human-confirmed and uses existing reconciliation action only',async({page})=>{
  await mount(page);
  await page.locator('[data-oc-action="recon-suggest"]').click();
  await page.locator('.oc-suggestion[data-suggestion-index="0"]').click();
  await page.locator('#oc_recon_form [name="signoff_note"]').fill('Reviewed against invoice and bank memo.');
  await page.locator('#oc_recon_form button[type="submit"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__recon312Calls.filter((call)=>call.action==='reconciliation_action').length)).toBe(1);
  const call=await page.evaluate(()=>window.__recon312Calls.find((entry)=>entry.action==='reconciliation_action'));
  expect(call.action_type).toBe('match');
  expect(call.target_reference).toBe('INV-1001');
  expect(call.target_type).toBe('customer_invoice');
  expect(call.match_score).toBe(98);
  expect(call.suggestion_context.requires_human_confirmation).toBe(true);
  const calls=await page.evaluate(()=>window.__recon312Calls);
  expect(calls.some((entry)=>entry.action==='payment_action_decision')).toBe(false);
  expect(calls.some((entry)=>/provider|posting/i.test(entry.action))).toBe(false);
});

test('Build 312 review-only partial candidate cannot be submitted as a match',async({page})=>{
  await mount(page);
  await page.locator('[data-oc-action="recon-suggest"]').click();
  await page.locator('.oc-suggestion[data-suggestion-index="3"]').click();
  await expect(page.locator('#oc_status')).toContainText('review-only');
  const before=await page.evaluate(()=>window.__recon312Calls.filter((entry)=>entry.action==='reconciliation_action').length);
  await page.locator('#oc_recon_action').selectOption('match');
  await page.locator('#oc_recon_form button[type="submit"]').click();
  await expect(page.locator('#oc_status')).toContainText('cannot be auto-applied');
  const after=await page.evaluate(()=>window.__recon312Calls.filter((entry)=>entry.action==='reconciliation_action').length);
  expect(after).toBe(before);
});
