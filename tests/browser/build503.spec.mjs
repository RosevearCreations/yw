import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerFixture(page){
 await page.route('https://yw503.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw503.test/');await page.addStyleTag({content:css});
 await page.evaluate(keys=>{
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'owner'}})};
  window.__records={ywi_companies:[{id:'owned',name:'Owner Co',owner_user_id:'owner'}],
   ywi_company_service_modules:keys.map(module_key=>({company_id:'owned',module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:1,company_id:'owned',module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
   const rules=[];return {select(){return this},eq(k,v){rules.push([k,v]);return this},
    gte(k,v){rules.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){return {error:null,data:(window.__records[table]||[]).filter(row=>
      rules.every(([k,v])=>v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },keys);
 await page.addScriptTag({content:owner});await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('select[aria-label="Filter service audit by action"]').selectOption('enabled');
 await page.locator('[data-owner495-preset="save"]').click();
 await page.evaluate(()=>localStorage.setItem('yw:owner-audit-filters:v496:owner:owned','damaged'));
 await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
 await page.locator('[data-owner497-preset="recover"]').click();
 await page.locator('[data-owner495-preset="restore"]').click();
 await page.locator('[data-owner499-receipt-review]').click();
 await page.evaluate(()=>window.__records.ywi_company_service_module_audit.push({id:2,
  company_id:'owned',module_key:'landscape',action:'enabled',previous_enabled:false,
  next_enabled:true,recorded_at:'2026-10-31T12:00:00Z'}));
 await page.locator('[data-owner495-preset="restore"]').click();
 await page.locator('[data-owner499-receipt-review]').click();
 await page.locator('[data-owner500-receipt-compare]').click();
}

test('owner drill-down distinguishes receipt delta from fresh owner-scope recheck',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerFixture(page);
 await page.locator('[data-owner501-history]').click();
 await page.locator('[data-owner503-drilldown]').click();
 const detail=page.locator('[data-owner503-drill-detail]');
 await expect(detail).toContainText('Previous reviewed receipt: 1 event(s)');
 await expect(detail).toContainText('Current reviewed receipt: 2 event(s)');
 await expect(detail).toContainText('RECEIPT DELTA +1');
 await expect(detail).toContainText('SCOPE RECHECK PENDING');
 await page.locator('[data-owner501-scope-recheck]').click();
 await expect(detail).toContainText('STABLE');
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(detail).toBeHidden();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!String(localStorage.getItem(k)).includes('recorded_at')))).toBe(true);
});

async function reviewerFixture(page){
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  const account=(id,primary)=>({profile_id:id,account_name:id,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.__ledger=[];window.__ledgerFail=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'primary'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},rpc:async name=>{
   if(name==='ywi_platform_account_audit_490')return {error:null,data:[account('primary',true),account('legacy-a',false)]};
   if(name==='ywi_platform_legacy_evidence_list_493')return window.__ledgerFail?
     {error:{message:'Unavailable'},data:null}:{error:null,data:[...window.__ledger]};
   throw Error('Unexpected RPC: '+name);
  }};
 });
 await page.addScriptTag({content:reviewer});await page.locator('#platform490 > summary').click();
 await page.locator('#platform490Refresh').click();
 await page.locator('[data-platform496-intake="legacy-a"] > summary').click();
 const intake=page.locator('[data-platform496-intake="legacy-a"]');
 await intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'}).fill('QL-269-REVIEW-009');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 return intake;
}

test('selected exception resolution remains not-ready, then fails closed on missing ledger',async({page})=>{
 const intake=await reviewerFixture(page);
 const select=intake.locator('[data-platform503-resolution-select]');
 const check=intake.locator('[data-platform503-resolution]');
 const status=intake.locator('[data-platform503-resolution-status]');
 const note=intake.locator('[data-platform503-resolution-note]');
 await select.selectOption({index:1});await check.click();
 await expect(status).toContainText('RESOLUTION NOT READY');
 await expect(status).toContainText('REFERENCE ABSENT');
 await expect(note).toContainText('QL-269 UNDER REVIEW');
 await page.evaluate(()=>window.__ledger.push({entry_id:1,profile_id:'legacy-a',
  evidence_reference:'QL-269-REVIEW-009',evidence_state:'UNVERIFIED_REFERENCE',
  recorded_at:'2026-10-31T12:00:00Z'}));
 await check.click();await expect(status).toContainText('REFERENCE PRESENT AS UNVERIFIED');
 await expect(note).toContainText('PENDING: obtain a separately authorized owner decision');
 await page.evaluate(()=>window.__ledgerFail=true);
 await check.click();await expect(status).toContainText('WITHHELD');await expect(note).toBeHidden();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await check.click();await expect(status).toContainText('WITHHELD');await expect(note).toBeHidden();
});

test('management high-contrast mode follows two distinct keyboard card checks',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{
  Element.prototype.scrollIntoView=function(){};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'fixture'})}});
 });
 const nav=page.locator('#owner496Navigator'),search=nav.locator('input');
 const retest=nav.locator('[data-owner499-retest]');
 for(const word of ['Safety','receivables']){
  await search.fill(word);await search.press('Enter');
  await nav.locator('[data-owner498-return]').click();
  await nav.locator('[data-owner498-accept]').click();
  if(word==='Safety')await retest.click();
 }
 await nav.locator('[data-owner501-multi-card-review]').click();
 const high=nav.locator('[data-owner503-high-contrast]');
 const check=nav.locator('[data-owner503-keyboard-check]');
 const evidence=nav.locator('[data-owner503-keyboard-evidence]');
 await expect(check).toBeDisabled();await high.click();
 await expect(high).toHaveAttribute('aria-pressed','true');
 await check.click();await expect(evidence).toContainText('HIGH-CONTRAST KEYBOARD FOLLOW-UP PASS');
 await expect(search).toBeFocused();
 await search.press('Escape');await expect(search).toHaveValue('');
 await high.click();await expect(evidence).toBeHidden();await expect(check).toBeDisabled();
 await expect(high).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
