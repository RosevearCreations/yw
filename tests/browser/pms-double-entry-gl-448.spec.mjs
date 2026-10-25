import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gl,company,companyId,ownerId,journalId,period}
 from '../fixtures/pms-double-entry-gl-448.mjs';
const source=readFileSync('js/pms-double-entry-gl-448.js','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1100:390,height:844});
 await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 .pms-finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px}
 .pms-finance-grid label{display:grid;min-width:0}.pms-finance-grid input,.pms-finance-grid select,.pms-finance-grid textarea{box-sizing:border-box;width:100%;min-width:0}
 .pms-finance-actions{display:flex;flex-wrap:wrap;gap:8px}#owner448GL,.notice{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
 button{min-height:44px;max-width:100%}</style><div id="admin"></div>`);
 await page.evaluate(({opts,company,companyId,ownerId,s})=>{
  window.__writes=[];window.__calls=[];window.__gl=s;window.__signedOut=!!opts.signedOut;
  Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> 'f4480000-0000-4448-8448-000000000001'});
  window.confirm=()=>!opts.cancel;window.prompt=()=> 'SYNTH-OWNER-448';
  const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(key,role,level)=>!opts.noFinance&&role==='admin'&&
   ((key==='admin'&&level==='manage')||(key==='finance'&&level==='manage')||(key==='jobs'&&level==='view'))};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:opts.badSession?'foreign':ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},limit(){return Promise.resolve(ok(
    table==='ywi_companies'?(opts.noCompany?[]:[{...company,owner_user_id:opts.foreignOwner?'foreign':ownerId}]):[]));}}},
   rpc:async(name,args)=>{
    window.__calls.push({name,args});
    if(name==='ywi_rpc_pms_gl_snapshot_448')return ok(opts.foreignSnapshot?
     {...window.__gl,company_id:'a0000000-0000-4000-8000-000000000999'}:window.__gl);
    if(name==='ywi_rpc_pms_gl_toggle_448'){
     window.__writes.push({name,args});window.__gl={...window.__gl,enabled:args.p_enabled,
      captured_at:new Date().toISOString()};return ok({company_id:companyId,enabled:args.p_enabled,
       posting_available:false,bank_access:false});}
    if(name==='ywi_rpc_pms_gl_lock_448'){
     window.__writes.push({name,args});window.__gl={...window.__gl,
      periods:window.__gl.periods.map(p=>({...p,locked:args.p_locked})),captured_at:new Date().toISOString()};
     return ok({company_id:companyId,period_start:args.p_period_start,locked:args.p_locked,test_mode:true});}
    if(name==='ywi_rpc_pms_gl_append_448'||name==='ywi_rpc_pms_gl_review_448'){
     window.__writes.push({name,args});return ok('f4480000-0000-4448-8448-000000000001');}
    if(name==='ywi_rpc_pms_gl_reconcile_448'){
     window.__writes.push({name,args});return ok({company_id:companyId,test_mode:true,
      bank_verified:false,reconciliation_saved:false,posting_available:false,
      matched:false,simulated_actual_net_debit_cents:12500,
      reported_expected_net_debit_cents:args.p_expected_net_debit_cents,
      variance_cents:12500-args.p_expected_net_debit_cents});}
    return {data:null,error:{message:'Unknown '+name}};
   }};
 },{opts,company,companyId,ownerId,s:gl({now:Date.now(),enabled:opts.enabled??false,locked:!!opts.locked})});
 await page.addScriptTag({content:source});
 await page.locator('#owner448GL summary').first().click();
 await page.locator('#pms448Refresh').click();
}
test('GL independently defaults OFF and shows no simulated accounting lines or real posting action',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms448Status')).toContainText('GL simulation OFF');
 await expect(page.locator('[data-pms448-journal]')).toHaveCount(0);
 await expect(page.locator('#pms448Append')).toBeDisabled();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('enabled test GL displays balanced debits/credits with liability control and no real posting',async({page})=>{
 await setup(page,{enabled:true});
 await expect(page.locator('[data-pms448-journal]')).toHaveCount(1);
 await expect(page.locator('#pms448Totals')).toContainText('$125.00');
 await expect(page.locator('#pms448Journals')).toContainText('TEST MODE');
 await expect(page.locator('#pms448Totals')).toContainText('2000');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('unbalanced journal stays local and balanced journal sends only simulation RPC',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('#pms448EntryPanel summary').click();
 await page.locator('#pms448Date').fill('2026-10-15');
 await page.locator('#pms448Narration').fill('Synthetic equipment accrual');
 await page.locator('#pms448Source').fill('SYNTH-EQUIPMENT-448');
 const values=page.locator('#pms448Rows input');
 await values.nth(0).fill('115.00');await values.nth(1).fill('125.00');
 await page.locator('#pms448Append').click();
 await expect(page.locator('#pms448Status')).toContainText('WITHHELD: Every simulated journal must');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms448Refresh').click();
 await values.nth(0).fill('125.00');
 await page.locator('#pms448Append').click();
 await expect(page.locator('#pms448Status')).toContainText('SIMULATION saved');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 expect(await page.evaluate(()=>window.__writes[0])).toMatchObject({name:'ywi_rpc_pms_gl_append_448',args:{
  p_company_id:companyId,p_effective_on:'2026-10-15',p_source_ref:'SYNTH-EQUIPMENT-448',
  p_lines:[{account:'5000',side:'debit',cents:12500},{account:'2000',side:'credit',cents:12500}]}});
});
test('period close prevents future business postings but keeps historical journal readable',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('#pms448PeriodPanel summary').click();
 await page.locator('#pms448Period').fill('2026-10');
 await page.locator('#pms448LockRef').fill('SYNTH-CLOSE-448');
 await page.locator('#pms448Lock').click();
 await expect(page.locator('#pms448Totals')).toContainText('LOCKED — no new entries');
 await expect(page.locator('[data-pms448-journal]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__writes[0])).toMatchObject({name:'ywi_rpc_pms_gl_lock_448',
  args:{p_company_id:companyId,p_period_start:period,p_locked:true,p_reference:'SYNTH-CLOSE-448'}});
});
test('selecting an original journal prepares an exact opposite-line simulation',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('#pms448EntryPanel summary').click();
 await expect(page.locator('#pms448Reversal')).toHaveValue('');
 await page.locator('#pms448Reversal').selectOption(journalId);
 await expect(page.locator('#pms448Date')).toHaveValue('2026-10-10');
 await expect(page.locator('#pms448Source')).toHaveValue('REV-SYNTH-SUPPLIER-448');
 await expect(page.locator('#pms448Rows select').nth(1)).toHaveValue('credit');
 await expect(page.locator('#pms448Rows select').nth(3)).toHaveValue('debit');
 await page.locator('#pms448Append').click();
 expect(await page.evaluate(()=>window.__writes[0])).toMatchObject({name:'ywi_rpc_pms_gl_append_448',
  args:{p_reversal_of:journalId,p_lines:[{account:'5000',side:'credit',cents:12500},
   {account:'2000',side:'debit',cents:12500}]}});
});
test('review and reconciliation require original source and remain review-only',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('[data-pms448-journal] button').first().click();
 expect(await page.evaluate(()=>window.__writes[0])).toMatchObject({name:'ywi_rpc_pms_gl_review_448',
  args:{p_company_id:companyId,p_journal_id:journalId,p_status:'reviewed_for_simulation'}});
 await page.locator('#pms448ReconPanel summary').click();
 await page.locator('#pms448ReconPeriod').fill('2026-10');
 await page.locator('#pms448ReconAccount').selectOption('5000');
 await page.locator('#pms448Expected').fill('120.00');
 await page.locator('#pms448ReconRef').fill('SYNTH-RECON-448');
 await page.locator('#pms448Reconcile').click();
 await expect(page.locator('#pms448ReconcileResult')).toContainText('VARIANCE');
 expect(await page.evaluate(()=>window.__writes[1])).toMatchObject({name:'ywi_rpc_pms_gl_reconcile_448',
  args:{p_company_id:companyId,p_period_start:period,p_account:'5000',
   p_expected_net_debit_cents:12000,p_source_ref:'SYNTH-RECON-448'}});
});
test('foreign company, missing owner permissions and signout scrub test accounts',async({page})=>{
 for(const opts of [{foreignOwner:true},{badSession:true},{noCompany:true},{noFinance:true},{foreignSnapshot:true},{signedOut:true}]){
  await setup(page,{...opts,enabled:true});
  await expect(page.locator('[data-pms448-journal]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page,{enabled:true});await expect(page.locator('[data-pms448-journal]')).toHaveCount(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms448-journal]')).toHaveCount(0);
 await page.locator('#pms448Toggle').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
