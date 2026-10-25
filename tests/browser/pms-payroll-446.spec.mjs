import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {payroll,company,companyId,ownerId,employeeId,foreignCompanyId} from '../fixtures/pms-payroll-446.mjs';
import {hr} from '../fixtures/pms-hr-garbage-445.mjs';
const source=readFileSync('js/pms-payroll-446.js','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1200:390,height:844});
 await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 .pms-finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}
 .pms-finance-grid label{display:grid;min-width:0}.pms-finance-grid input,.pms-finance-grid select,.pms-finance-grid textarea{box-sizing:border-box;width:100%;min-width:0}
 .pms-finance-actions{display:flex;flex-wrap:wrap;gap:8px}#owner446Payroll,.notice{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}
 </style><div id="admin"></div>`);
 await page.evaluate(({opts,company,companyId,ownerId,employeeId,p,h})=>{
  window.__calls=[];window.__writes=[];window.__payroll=p;window.__hr=h;window.__signedOut=!!opts.signedOut;
  Object.defineProperty(window.crypto,'randomUUID',{configurable:true,value:()=> 'f4460000-0000-4446-8446-000000000001'});
  window.confirm=()=>!opts.cancel;
  const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(name,role,level)=>!opts.noFinance&&role==='admin'&&
   ((name==='admin'&&level==='manage')||(name==='finance'&&level==='manage')||(name==='jobs'&&level==='view'))};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:opts.badSession?'foreign':ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},limit(){return Promise.resolve(ok(
    table==='ywi_companies'?(opts.noCompany?[]:[{...company,owner_user_id:opts.foreignOwner?'foreign':ownerId}]):[]));}}},
   rpc:async(name,args)=>{
    window.__calls.push({name,args});
    if(name==='ywi_rpc_pms_payroll_snapshot_446')return ok(opts.foreignSnapshot?{...window.__payroll,company_id:'a0000000-0000-4000-8000-000000000999'}:window.__payroll);
    if(name==='ywi_rpc_pms_hr_snapshot_445')return ok(window.__hr);
    if(name==='ywi_rpc_pms_payroll_switch_446'){
     window.__writes.push({name,args});window.__payroll={...window.__payroll,enabled:args.p_enabled,
      captured_at:new Date().toISOString()};return ok({company_id:companyId,enabled:args.p_enabled,payroll_executed:false,bank_authorized:false});}
    if(name==='ywi_rpc_pms_payroll_append_446'){
     window.__writes.push({name,args});return ok('f4460000-0000-4446-8446-000000000001');}
    return {data:null,error:{message:'Unknown '+name}};
   }};
 },{opts,company,companyId,ownerId,employeeId,p:payroll({now:Date.now(),enabled:opts.enabled??false,effective:opts.effective??false}),h:hr({now:Date.now()})});
 await page.addScriptTag({content:source});
 await page.locator('#owner446Payroll summary').first().click();
 await page.locator('#pms446Refresh').click();
}
test('default OFF withholds private wages, even if the company HR module exists',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms446Status')).toContainText('WITHHELD PRIVATE RATES');
 await expect(page.locator('[data-pms446-line]')).toHaveCount(0);
 await expect(page.locator('#pms446Append')).toBeDisabled();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('planning wages are readable only after both payroll and parent Accounting gates',async({page})=>{
 await setup(page,{enabled:true,effective:true});
 await expect(page.locator('[data-pms446-line]')).toHaveCount(1);
 await expect(page.locator('#owner446Payroll')).toContainText('$25.50');
 await expect(page.locator('#owner446Payroll')).toContainText('$204.00');
 await page.locator('#pms446NewPanel summary').click();
 await page.locator('#pms446From').fill('2026-10-15');
 await page.locator('#pms446To').fill('2026-10-28');
 await page.locator('#pms446Minutes').fill('480');
 await page.locator('#pms446Rate').fill('27.15');
 await page.locator('#pms446Source').fill('SYNTH-TIMESHEET-002');
 await page.locator('#pms446Append').click();
 await expect(page.locator('#pms446Status')).toContainText('evidence appended');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({name:'ywi_rpc_pms_payroll_append_446',args:{p_company_id:companyId,
  p_employee_id:employeeId,p_rate_cents:2715,p_minutes:480,p_source_ref:'SYNTH-TIMESHEET-002'}});
});
test('manual switch changes no bank/payrun permission and rates stay withheld without parent',async({page})=>{
 await setup(page);
 await page.locator('#pms446Toggle').click();
 await expect(page.locator('#pms446Status')).toContainText('WITHHELD PRIVATE RATES');
 expect(await page.evaluate(()=>window.__writes.map(x=>x.name))).toEqual(['ywi_rpc_pms_payroll_switch_446']);
});
test('cross-company, bad auth and Finance permission mismatch fail closed',async({page})=>{
 for(const opts of [{foreignOwner:true},{badSession:true},{noCompany:true},{noFinance:true},{foreignSnapshot:true},{signedOut:true}]){
  await setup(page,{...opts,enabled:true,effective:true});
  await expect(page.locator('[data-pms446-line]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('sign out wipes private payroll rates and blocks later actions',async({page})=>{
 await setup(page,{enabled:true,effective:true});
 await expect(page.locator('[data-pms446-line]')).toHaveCount(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms446-line]')).toHaveCount(0);
 await page.locator('#pms446Toggle').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
