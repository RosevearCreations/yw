import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const admin=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page,uid='owner',companyId='owned-one'){
 await page.route('https://yw496.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw496.test/');
 await page.addStyleTag({content:css});
 await page.evaluate(({uid,companyId,keys})=>{
  window.__identity=uid;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const roster=[{id:companyId,name:'Test Grounds',owner_user_id:uid}];
  const modules=keys.map(module_key=>({company_id:companyId,module_key,enabled:module_key==='landscape'}));
  const events=[{id:1,company_id:companyId,module_key:'landscape',action:'enabled',
   previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}];
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(table){
   const rules=[];return {select(){return this},eq(k,v){rules.push([k,v]);return this},
    gte(k,v){rules.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){const rows=table==='ywi_companies'?roster:
      table==='ywi_company_service_modules'?modules:events;
      return {error:null,data:rows.filter(row=>rules.every(([k,v])=>
       v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },{uid,companyId,keys});
 await page.addScriptTag({content:owner});
 await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
}

test('owner audit filters persist across page loads only within the owner/company namespace',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await ownerPage(page);
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('select[aria-label="Filter service audit by action"]').selectOption('enabled');
 await page.locator('[data-owner495-preset="save"]').click();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:owner-audit-filters:v496:'))))
  .toEqual(['yw:owner-audit-filters:v496:owner:owned-one']);
 await ownerPage(page);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeEnabled();
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('select[aria-label="Filter service audit by service"]')).toHaveValue('landscape');
 await expect(page.locator('select[aria-label="Filter service audit by action"]')).toHaveValue('enabled');
 await ownerPage(page,'other-owner','owned-two');
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeDisabled();
 await ownerPage(page);
 await page.locator('[data-owner496-preset="clear"]').click();
 await ownerPage(page);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeDisabled();
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('invalid device preset is ignored and logout clears its authenticated UI',async({page})=>{
 await ownerPage(page);
 await page.evaluate(()=>localStorage.setItem('yw:owner-audit-filters:v496:owner:owned-one',
  JSON.stringify({service:'foreign',action:'enabled',since:''})));
 await ownerPage(page);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeDisabled();
 await page.locator('[data-owner495-preset="save"]').click();
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-owner496-preset]')).toHaveCount(0);
 await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
});

test('independent reviewer response records only an unverified reference, never role authority',async({page})=>{
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  window.__calls=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'primary'}})};
  const row=(id,primary)=>({profile_id:id,account_name:id,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},
   rpc:async(name,args)=>{window.__calls.push({name,args});return {error:null,data:
    name==='ywi_platform_account_audit_490'?[row('primary',true),row('legacy-a',false)]:
    name==='ywi_platform_legacy_evidence_list_493'?[]:1};}};
 });
 await page.addScriptTag({content:admin});
 await page.locator('#platform490 > summary').click();await page.locator('#platform490Refresh').click();
 const intake=page.locator('[data-platform496-intake="legacy-a"]');
 await intake.locator('summary').click();
 await intake.locator('input[type="text"]').fill('QL-269-REVIEW-002');
 await intake.getByRole('button',{name:'Record unverified reviewer reference'}).click();
 await expect(intake.locator('[role="status"]')).toContainText('WITHHELD');
 expect((await page.evaluate(()=>window.__calls)).map(x=>x.name))
  .toEqual(['ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493']);
 await intake.locator('input[type="checkbox"]').check();
 await intake.getByRole('button',{name:'Record unverified reviewer reference'}).click();
 await expect(page.locator('#platform490Status')).toContainText('Reconciled for review only');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.filter(x=>x.name==='ywi_platform_legacy_evidence_record_493'))
  .toEqual([{name:'ywi_platform_legacy_evidence_record_493',
   args:{p_profile_id:'legacy-a',p_reference:'QL-269-REVIEW-002'}}]);
 expect(calls.every(x=>['ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493',
  'ywi_platform_legacy_evidence_record_493'].includes(x.name))).toBe(true);
});

test('management card search offers keyboard-friendly jump targets without changing records',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:{
  loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}}));
 const nav=page.locator('#owner496Navigator');
 await expect(nav).toBeVisible();
 await nav.locator('input').fill('Safety');
 await expect(nav.getByRole('button',{name:'Safety, equipment & workforce blockers'})).toBeVisible();
 await nav.getByRole('button',{name:'Safety, equipment & workforce blockers'}).click();
 expect(await page.evaluate(()=>document.activeElement?.querySelector?.('h4')?.textContent))
  .toContain('Safety, equipment');
 await nav.getByRole('button',{name:'Clear search'}).click();
 await expect(nav.locator('input')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
