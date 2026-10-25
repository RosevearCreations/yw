import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {accounting,allAccess,company,companyId,ownerId,customerId,propertyId} from '../fixtures/pms-accounting-447.mjs';
const source=readFileSync('js/pms-accounting-447.js','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1180:390,height:844});
 await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 .pms-finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}
 .pms-finance-grid label{display:grid;min-width:0}.pms-finance-grid input,.pms-finance-grid select,.pms-finance-grid textarea{box-sizing:border-box;width:100%;min-width:0}
 .pms-finance-actions{display:flex;flex-wrap:wrap;gap:8px}#owner447Accounting,.notice{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}
 </style><div id="admin"></div>`);
 await page.evaluate(({opts,company,companyId,ownerId,customerId,propertyId,a})=>{
  window.__writes=[];window.__calls=[];window.__accounting=a;window.__signedOut=!!opts.signedOut;
  Object.defineProperty(window.crypto,'randomUUID',{configurable:true,value:()=> 'f4470000-0000-4447-8447-000000000001'});
  window.confirm=()=>!opts.cancel;const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(name,role,level)=>!opts.noFinance&&role==='admin'&&
   ((name==='admin'&&level==='manage')||(name==='finance'&&level==='manage')||(name==='jobs'&&level==='view'))};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:opts.badSession?'foreign':ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},limit(){return Promise.resolve(ok(
    table==='ywi_companies'?(opts.noCompany?[]:[{...company,owner_user_id:opts.foreignOwner?'foreign':ownerId}]):[]));}}},
   rpc:async(name,args)=>{
    window.__calls.push({name,args});
    if(name==='ywi_rpc_pms_accounting_snapshot_447')return ok(opts.foreignSnapshot?{...window.__accounting,company_id:'a0000000-0000-4000-8000-000000000999'}:window.__accounting);
    if(name==='ywi_rpc_company_customers_422')return ok([{id:customerId,name:'Synthetic rural client'}]);
    if(name==='ywi_rpc_customer_history_422')return ok({company_id:companyId,client_id:customerId,
     legacy_unscoped_excluded:true,properties:[{id:propertyId,name:'Synthetic parcel'}]});
    if(name==='ywi_rpc_pms_accounting_config_447'){
     window.__writes.push({name,args});const access={receivables:args.p_receivables,payables:args.p_payables,
      costs:args.p_costs,reports:args.p_reports,payroll_reference:args.p_payroll_reference,bank:false};
     window.__accounting=accountingNotMutable(window.__accounting,args.p_enabled,access);
     return ok({company_id:companyId,enabled:args.p_enabled,access,payment_executed:false,ledger_posted:false});}
    if(name==='ywi_rpc_pms_accounting_append_447'){
     window.__writes.push({name,args});return ok('f4470000-0000-4447-8447-000000000001');}
    return {data:null,error:{message:'Unknown '+name}};
   }};
  function accountingNotMutable(previous,enabled,access){
   return {...previous,enabled,access:enabled?access:{receivables:false,payables:false,costs:false,
    reports:false,payroll_reference:false,bank:false},drafts:[],draft_count:0,captured_at:new Date().toISOString()};}
 },{opts,company,companyId,ownerId,customerId,propertyId,
   a:accounting({now:Date.now(),enabled:opts.enabled??false,access:opts.access??allAccess})});
 await page.addScriptTag({content:source});
 await page.locator('#owner447Accounting summary').first().click();
 await page.locator('#pms447Refresh').click();
}
test('company Accounting starts OFF and all private draft sections and payroll field are hidden',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms447Status')).toContainText('Accounting OFF');
 await expect(page.locator('[data-pms447-draft]')).toHaveCount(0);
 await expect(page.locator('#pms447Append')).toBeDisabled();
 await expect(page.locator('#pms447Section-payroll_reference')).toBeHidden();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('company explicit field scopes govern review-only drafts, no banking or posting',async({page})=>{
 await setup(page,{enabled:true});
 await expect(page.locator('[data-pms447-draft]')).toHaveCount(5);
 await expect(page.locator('#pms447Section-payroll_reference')).toBeVisible();
 await page.locator('#pms447Permissions summary').click();
 await page.locator('#pms447Allow-payables').uncheck();
 await page.locator('#pms447Allow-payroll_reference').uncheck();
 await page.locator('#pms447Save').click();
 await expect(page.locator('#pms447Status')).toContainText('VERIFIED NON-POSTING');
 await expect(page.locator('#pms447Section-payroll_reference')).toBeHidden();
 expect(await page.evaluate(()=>window.__writes[0])).toMatchObject({name:'ywi_rpc_pms_accounting_config_447',
  args:{p_company_id:companyId,p_enabled:true,p_payables:false,p_payroll_reference:false}});
});
test('verified company can append unposted CAD source with customer/property',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('#pms447DraftPanel summary').click();
 await page.locator('#pms447Category').selectOption('job_cost');
 await page.locator('#pms447Title').fill('Synthetic ditch excavation quote');
 await page.locator('#pms447Reference').fill('SYNTH-JOB-447');
 await page.locator('#pms447Amount').fill('125.45');
 await page.locator('#pms447Append').click();
 await expect(page.locator('#pms447Status')).toContainText('draft appended');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({name:'ywi_rpc_pms_accounting_append_447',args:{p_company_id:companyId,
  p_category:'job_cost',p_amount_cents:12545,p_source_ref:'SYNTH-JOB-447',
  p_client_id:customerId,p_site_id:propertyId}});
});
test('Accounting switch OFF removes draft access and cannot be bypassed by category',async({page})=>{
 await setup(page,{enabled:true});
 await page.locator('#pms447Toggle').click();
 await expect(page.locator('#pms447Status')).toContainText('Accounting OFF');
 await expect(page.locator('[data-pms447-draft]')).toHaveCount(0);
 await expect(page.locator('#pms447Append')).toBeDisabled();
 expect(await page.evaluate(()=>window.__writes.map(x=>x.name))).toEqual(['ywi_rpc_pms_accounting_config_447']);
});
test('auth and cross-company boundaries fail closed and signout scrubs entries',async({page})=>{
 for(const opts of [{foreignOwner:true},{badSession:true},{noCompany:true},{noFinance:true},{foreignSnapshot:true},{signedOut:true}]){
  await setup(page,{...opts,enabled:true});
  await expect(page.locator('[data-pms447-draft]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page,{enabled:true});
 await expect(page.locator('[data-pms447-draft]')).toHaveCount(5);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms447-draft]')).toHaveCount(0);
 await page.locator('#pms447Toggle').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
