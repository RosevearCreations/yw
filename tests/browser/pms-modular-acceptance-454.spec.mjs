import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,ownerId,foreignCompanyId}
 from '../fixtures/pms-modular-acceptance-454.mjs';
const source=readFileSync('js/pms-modular-acceptance-454.js','utf8');
const stylesheet=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1120:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:stylesheet});
 const value=fixture({now:Date.now(),enabled:options.allOff?[]:undefined});
 if(options.foreignSwitch)value.registry[0].company_id=foreignCompanyId;
 if(options.mismatch)value.registry[0].enabled=!value.registry[0].enabled;
 if(options.foreignReceipt)value.receipts[0].company_id=foreignCompanyId;
 await page.evaluate(({value,company,ownerId,options})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:(key)=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  const companyRows=options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?foreignCompanyId:ownerId}];
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.mismatchAuth?foreignCompanyId:ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},eq(){return this},order(){return this},
    limit(){return Promise.resolve(options.historyDenied&&table==='ywi_new_work_gate_receipts_421'?{data:null,error:{message:'denied'}}:
     ok(table==='ywi_companies'?companyRows:table==='ywi_company_service_modules'?value.registry:
     table==='ywi_company_service_module_audit'?value.audit:table==='ywi_new_work_gate_receipts_421'?value.receipts:[]));},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},delete(){window.__writes.push('delete')}};},
   rpc:async name=>{window.__calls.push(name);return options.rpcDenied?{data:null,error:{message:'denied'}}:ok(value.menu)}};
 },{value,company,ownerId,options});
 await page.addScriptTag({content:source});
 await page.locator('#owner454 summary').click();
 await page.locator('#pms454Run').click();
}
test('390px owner source parity: ON/OFF, historical access, Help and no write',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms454Status')).toContainText('VERIFIED SOURCE READ: 3 ON / 4 OFF');
 await expect(page.locator('[data-pms454-state]')).toHaveCount(7);
 await expect(page.locator('[data-pms454-state="landscape"]')).toHaveText('ON · entry shown');
 await expect(page.locator('[data-pms454-state="construction"]')).toHaveText('OFF · no new work');
 await expect(page.locator('#pms454History')).toContainText('1 original Jobs/estimate gate receipts');
 await expect(page.locator('#pms454Release')).toContainText('NOT certified');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms454Run').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-modular-production-acceptance-454"]')).toHaveCount(1);
 await page.locator('#pms454Company').focus();
 await page.keyboard.press('Tab');
 expect(await page.locator('#pms454Run').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
});
test('desktop and all-OFF tenant keep audit read while no new-work route is advertised',async({page})=>{
 await setup(page,{desktop:true,allOff:true});
 await expect(page.locator('#pms454Status')).toContainText('0 ON / 7 OFF');
 await expect(page.locator('[data-pms454-state]')).toHaveCount(7);
 await expect(page.locator('#pms454History')).toContainText('Historical audit read');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign owner, foreign registry/receipt, denied source and unsigned user fail closed',async({page})=>{
 for(const options of [{foreignOwner:true},{foreignSwitch:true},{foreignReceipt:true},
  {rpcDenied:true},{historyDenied:true},{mismatch:true},{noJobs:true},{signedOut:true},
  {mismatchAuth:true}]){
  await setup(page,options);
  await expect(page.locator('#pms454Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-pms454-state]')).toHaveCount(0);
 }
});
test('no real owner company remains HOLD, never silently seeds Yard Rosevear',async({page})=>{
 await setup(page,{noCompany:true});
 await expect(page.locator('#pms454Status')).toContainText('HOLD: no registered owner company');
 expect(await page.evaluate(()=>window.__calls)).not.toContain('ywi_rpc_pms_navigation_443');
});
test('switch, signout and permissions invalidate prior verification without mutations',async({page})=>{
 await setup(page);
 await expect(page.locator('[data-pms454-state]')).toHaveCount(7);
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:company-service-offering-changed')));
 await expect(page.locator('[data-pms454-state]')).toHaveCount(0);
 await expect(page.locator('#pms454Status')).toContainText('HOLD');
 await page.locator('#pms454Run').click();
 await expect(page.locator('[data-pms454-state]')).toHaveCount(7);
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:module-permissions-changed')));
 await expect(page.locator('[data-pms454-state]')).toHaveCount(0);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await page.locator('#pms454Run').click();
 await expect(page.locator('#pms454Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
