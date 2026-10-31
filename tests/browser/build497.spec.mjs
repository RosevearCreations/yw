import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const modules=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page,uid='owner',company='owned-one'){
 await page.route('https://yw497.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw497.test/');await page.addStyleTag({content:css});
 await page.evaluate(({uid,company,modules})=>{
  window.__queries=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:uid}})};
  const rows={ywi_companies:[{id:company,name:'Test Grounds',owner_user_id:uid}],
   ywi_company_service_modules:modules.map(module_key=>({company_id:company,module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:1,company_id:company,module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(table){
   const where=[];return {select(){return this},eq(k,v){where.push([k,v]);return this},
    gte(k,v){where.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){window.__queries.push({table,where});return {error:null,data:(rows[table]||[])
     .filter(row=>where.every(([k,v])=>v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },{uid,company,modules});
 await page.addScriptTag({content:owner});await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
}

test('owner can recover a valid previous saved filter without auto-applying audit queries',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('select[aria-label="Filter service audit by action"]').selectOption('enabled');
 await page.locator('[data-owner495-preset="save"]').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('yw:audit-filter-recovery:v497:owner:owned-one'))))
  .toEqual({service:'landscape',action:'enabled',since:''});
 await page.evaluate(()=>localStorage.setItem('yw:owner-audit-filters:v496:owner:owned-one','broken-json'));
 await ownerPage(page);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeDisabled();
 await expect(page.locator('[data-owner497-preset="recover"]')).toBeEnabled();
 await expect(page.locator('[data-owner492-timeline] .yw495-help[role="status"]')).toContainText('RECOVERY AVAILABLE');
 const count=await page.evaluate(()=>window.__queries.length);
 await page.locator('[data-owner497-preset="recover"]').click();
 expect(await page.evaluate(()=>window.__queries.length)).toBe(count);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeEnabled();
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('select[aria-label="Filter service audit by action"]')).toHaveValue('enabled');
 await expect(page.locator('select[aria-label="Filter service audit by service"]')).toHaveValue('landscape');
 await page.locator('[data-owner496-preset="clear"]').click();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('yw:')))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('malformed recovery snapshots are withheld and never cross owner/company identity',async({page})=>{
 await ownerPage(page);
 await page.evaluate(()=>{
  localStorage.setItem('yw:owner-audit-filters:v496:owner:owned-one','broken');
  localStorage.setItem('yw:audit-filter-recovery:v497:owner:owned-one',
   JSON.stringify({service:'landscape',action:'enabled',since:'2026-02-31',token:'foreign'}));
 });
 await ownerPage(page);
 await expect(page.locator('[data-owner497-preset="recover"]')).toBeDisabled();
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeDisabled();
 await expect(page.locator('[data-owner496-preset="clear"]')).toBeEnabled();
 await page.locator('[data-owner496-preset="clear"]').click();
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
 await ownerPage(page,'different-owner','different-company');
 await expect(page.locator('[data-owner497-preset="recover"]')).toBeDisabled();
});

async function reviewerPage(page){
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  const account=(id,primary)=>({profile_id:id,account_name:id,
   account_email:id+'@example.invalid',global_role:'admin',curated_platform_admin:primary,
   owned_company_count:0,active:true,staff_tier:'admin',profile_email_matches_auth:true});
  window.__calls=[];window.__ledger=[{entry_id:1,profile_id:'legacy-a',
   evidence_reference:'QL-269-REVIEW-001',evidence_state:'UNVERIFIED_REFERENCE',
   recorded_at:'2026-10-30T12:00:00Z'}];
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'primary'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_platform_account_audit_490')return {error:null,data:[account('primary',true),account('legacy-a',false)]};
    if(name==='ywi_platform_legacy_evidence_list_493')return {error:null,data:[...window.__ledger]};
    if(name==='ywi_platform_legacy_evidence_record_493'){
     const id=window.__ledger.length+1;window.__ledger.push({entry_id:id,profile_id:args.p_profile_id,
      evidence_reference:args.p_reference,evidence_state:'UNVERIFIED_REFERENCE',
      recorded_at:'2026-10-31T12:00:00Z'});return {error:null,data:id};}
    throw Error('Unexpected RPC: '+name);
   }};
 });
 await page.addScriptTag({content:reviewer});await page.locator('#platform490 > summary').click();
 await page.locator('#platform490Refresh').click();
 await page.locator('[data-platform496-intake="legacy-a"] > summary').click();
 return page.locator('[data-platform496-intake="legacy-a"]');
}

test('reviewer reconciliation proves an unverified reference only, with read-only repeat checks',async({page})=>{
 const intake=await reviewerPage(page);
 const ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 await ticket.fill('QL-269-REVIEW-001');await reconcile.click();
 await expect(intake.locator('[role="status"]')).toContainText('MATCHED 1 UNVERIFIED_REFERENCE');
 await expect(intake.locator('[role="status"]')).toContainText('Owner decision NOT RECEIVED; no role change');
 await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await expect(intake.locator('[role="status"]')).toContainText('NOT FOUND');
 await ticket.fill('QL-269-REVIEW-002');await intake.locator('input[type="checkbox"]').check();
 await intake.getByRole('button',{name:'Record unverified reviewer reference'}).click();
 await expect(intake.locator('[role="status"]')).toContainText('MATCHED 1 UNVERIFIED_REFERENCE');
 await expect(intake.getByRole('button',{name:'Record unverified reviewer reference'})).toBeEnabled();
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.filter(c=>c.name==='ywi_platform_legacy_evidence_record_493')).toEqual([{
  name:'ywi_platform_legacy_evidence_record_493',
  args:{p_profile_id:'legacy-a',p_reference:'QL-269-REVIEW-002'}}]);
 expect(calls.every(c=>['ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493',
  'ywi_platform_legacy_evidence_record_493'].includes(c.name))).toBe(true);
 await page.evaluate(()=>window.__ledger.push({entry_id:3,profile_id:'foreign',
  evidence_reference:'QL-269-REVIEW-003',evidence_state:'UNVERIFIED_REFERENCE',
  recorded_at:'2026-10-31T12:00:00Z'}));
 await reconcile.click();await expect(intake.locator('[role="status"]')).toContainText('WITHHELD');
});

test('management navigation gives screen-reader status, keyboard targets and reduced-motion jump',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{window.__scroll=null;Element.prototype.scrollIntoView=function(options){window.__scroll=options;};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});});
 const nav=page.locator('#owner496Navigator'),input=nav.locator('input');
 await expect(nav.locator('#owner497NavStatus')).toHaveAttribute('aria-live','polite');
 await expect(input).toHaveAttribute('aria-describedby','owner497NavStatus');
 await expect(input).toHaveAttribute('aria-controls','owner497NavResults');
 await input.fill('Safety');await input.press('Enter');
 expect(await page.evaluate(()=>document.activeElement?.querySelector?.('h4')?.textContent))
  .toContain('Safety, equipment');
 expect(await page.evaluate(()=>window.__scroll?.behavior)).toBe('auto');
 await input.fill('not-a-real-card');await expect(nav.locator('#owner497NavStatus')).toContainText('No matching cards');
 await input.press('Escape');await expect(input).toHaveValue('');
 await expect(nav.getByRole('button',{name:'Clear search'})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
