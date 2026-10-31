import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page,uid='owner',company='owned-one'){
 await page.route('https://yw500.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw500.test/');await page.addStyleTag({content:css});
 await page.evaluate(({uid,company,keys})=>{
  window.__queries=[];window.__auditFail=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:uid}})};
  const records={ywi_companies:[{id:company,name:'Owner Test Company',owner_user_id:uid}],
   ywi_company_service_modules:keys.map(module_key=>({company_id:company,module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:12,company_id:company,module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
  window.__records=records;
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(table){
   const rules=[];return {select(){return this},eq(k,v){rules.push([k,v]);return this},
    gte(k,v){rules.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){window.__queries.push({table,rules});
     if(window.__auditFail&&table==='ywi_company_service_module_audit'&&rules.some(([k])=>k==='module_key'))
      return {error:{message:'Unavailable'},data:null};
     return {error:null,data:(records[table]||[]).filter(row=>rules.every(([k,v])=>
      v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },{uid,company,keys});
 await page.addScriptTag({content:owner});await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
}
async function recoverPreset(page){
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('select[aria-label="Filter service audit by action"]').selectOption('enabled');
 await page.locator('[data-owner495-preset="save"]').click();
 await page.evaluate(()=>localStorage.setItem('yw:owner-audit-filters:v496:owner:owned-one','damaged-primary'));
 await ownerPage(page);await page.locator('[data-owner497-preset="recover"]').click();
}
async function reviewRecovered(page){
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner498-verification]')).toContainText('VERIFIED RECOVERED VIEW');
 await page.locator('[data-owner499-receipt-review]').click();
}

test('two server-verified, manually reviewed receipts reveal count change without audit persistence',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);await recoverPreset(page);
 const compare=page.locator('[data-owner500-receipt-compare]');
 const details=page.locator('[data-owner500-compare-details]');
 await expect(compare).toBeDisabled();await reviewRecovered(page);
 await expect(compare).toBeDisabled();
 await page.evaluate(()=>window.__records.ywi_company_service_module_audit.push({
  id:13,company_id:'owned-one',module_key:'landscape',action:'enabled',
  previous_enabled:false,next_enabled:true,recorded_at:'2026-10-31T12:00:00Z'}));
 const queriesBefore=await page.evaluate(()=>window.__queries.length);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner500-receipt-compare]')).toBeDisabled();
 await expect(page.locator('[data-owner499-receipt-review]')).toBeEnabled();
 await page.locator('[data-owner499-receipt-review]').click();
 await expect(compare).toBeEnabled();await compare.click();
 await expect(details).toBeVisible();await expect(details).toContainText('COUNT INCREASE +1');
 await expect(details).toContainText('prior 1 · current 2');
 expect(await page.evaluate(()=>window.__queries.length)).toBe(queriesBefore+1);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!localStorage.getItem(k).includes('recorded_at')))).toBe(true);
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(compare).toBeDisabled();await expect(details).toBeHidden();
 await expect(page.locator('[data-owner500-compare-status]')).toContainText('All session-only receipt comparisons cleared');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('receipt count comparison withdraws on failed recheck or owner change',async({page})=>{
 await ownerPage(page);await recoverPreset(page);await reviewRecovered(page);
 await page.evaluate(()=>window.__auditFail=true);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner498-verification]')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner500-receipt-compare]')).toBeDisabled();
 await page.evaluate(()=>window.__auditFail=false);await reviewRecovered(page);
 await expect(page.locator('[data-owner500-receipt-compare]')).toBeEnabled();
 await ownerPage(page,'different-owner','different-company');
 await expect(page.locator('[data-owner500-receipt-compare]')).toBeDisabled();
 await expect(page.locator('[data-owner500-compare-details]')).toBeHidden();
});

async function reviewerPage(page){
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  const account=(id,primary)=>({profile_id:id,account_name:id,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.__calls=[];window.__ledger=[{entry_id:1,profile_id:'legacy-a',
   evidence_reference:'QL-269-REVIEW-001',evidence_state:'UNVERIFIED_REFERENCE',
   recorded_at:'2026-10-30T12:00:00Z'}];
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'primary'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_platform_account_audit_490')return {error:null,data:[account('primary',true),account('legacy-a',false)]};
    if(name==='ywi_platform_legacy_evidence_list_493')return {error:null,data:[...window.__ledger]};
    throw Error('Unexpected RPC: '+name);
   }};
 });
 await page.addScriptTag({content:reviewer});await page.locator('#platform490 > summary').click();
 await page.locator('#platform490Refresh').click();
 await page.locator('[data-platform496-intake="legacy-a"] > summary').click();
 return page.locator('[data-platform496-intake="legacy-a"]');
}

test('reviewer priority follow-up remains copy-only, ages to high and clears on reconciliation',async({page})=>{
 const intake=await reviewerPage(page);
 const ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 const button=intake.locator('[data-platform500-priority]');
 const note=intake.locator('[data-platform500-priority-note]');
 await page.evaluate(()=>{window.__now=Date.now();Date.now=()=>window.__now;});
 await expect(button).toBeDisabled();await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await expect(button).toBeEnabled();await button.click();
 await expect(note).toHaveJSProperty('readOnly',true);
 await expect(note).toHaveValue(/ROUTINE RECHECK/);
 await expect(note).toHaveValue(/QL-269 — UNDER REVIEW/);
 await page.evaluate(()=>window.__now+=26*3600000);
 await intake.locator('[data-platform499-refresh-age]').click();
 await expect(note).toBeHidden();
 await expect(intake.locator('[data-platform500-priority-status]')).toContainText('HIGH RECHECK');
 await button.click();await expect(note).toHaveValue(/LOCAL RECHECK PRIORITY: HIGH RECHECK/);
 await expect(note).toHaveValue(/No signer trust, approval, role change/);
 await ticket.fill('QL-269-REVIEW-001');await expect(button).toBeDisabled();await expect(note).toBeHidden();
 await reconcile.click();await expect(intake.locator('[data-platform500-priority-status]')).toContainText('REFERENCE PRESENT');
 expect((await page.evaluate(()=>window.__calls)).every(c=>[
  'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493'].includes(c.name))).toBe(true);
});

test('priority follow-up fails closed when reviewer session changes',async({page})=>{
 const intake=await reviewerPage(page);
 await intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'}).fill('QL-269-REVIEW-009');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await intake.locator('[data-platform500-priority]').click();
 await expect(intake.locator('[data-platform500-priority-status]')).toContainText('WITHHELD');
 await expect(intake.locator('[data-platform500-priority]')).toBeDisabled();
 await expect(intake.locator('[data-platform500-priority-note]')).toBeHidden();
});

test('management summary requires second keyboard focus, return and explicit acceptance',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{window.__scroll=null;Element.prototype.scrollIntoView=function(opts){window.__scroll=opts;};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});});
 const nav=page.locator('#owner496Navigator'),input=nav.locator('input');
 const back=nav.locator('[data-owner498-return]'),accept=nav.locator('[data-owner498-accept]');
 const retest=nav.locator('[data-owner499-retest]');
 const summaryButton=nav.locator('[data-owner500-retest-summary]');
 const summary=nav.locator('[data-owner500-retest-evidence]');
 await expect(summaryButton).toBeDisabled();await expect(summary).toBeHidden();
 await input.fill('Safety');await input.press('Enter');await back.click();await accept.click();
 await expect(summaryButton).toBeDisabled();await retest.click();
 await input.fill('Safety');await input.press('Enter');await back.click();
 await expect(summaryButton).toBeDisabled();await accept.click();
 await expect(summaryButton).toBeEnabled();await summaryButton.click();
 await expect(summary).toBeVisible();await expect(summary).toContainText('NAVIGATION RETEST EVIDENCE SUMMARY');
 await expect(summary).toContainText('2 manually completed local checks');
 await expect(summary).toContainText('No formal owner acceptance');
 await retest.click();await expect(summaryButton).toBeDisabled();await expect(summary).toBeHidden();
 await expect(input).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
