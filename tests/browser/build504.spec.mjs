import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerFixture(page){
 await page.route('https://yw504.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw504.test/');await page.addStyleTag({content:css});
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

test('owner prepares a session-only packet and withdraws it on recheck or clear',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerFixture(page);
 const button=page.locator('[data-owner504-handoff]');
 const note=page.locator('[data-owner504-handoff-note]');
 await expect(button).toBeDisabled();
 await page.locator('[data-owner501-history]').click();
 await page.locator('[data-owner503-drilldown]').click();
 await button.click();
 await expect(note).toHaveValue(/COPY-ONLY OWNER AUDIT COMPARISON REVIEW/);
 await expect(note).toHaveValue(/Comparison: DELTA 1/);
 await expect(note).toHaveValue(/Owner-scope read: PENDING/);
 await page.locator('[data-owner501-scope-recheck]').click();
 await expect(note).toBeHidden();
 await button.click();
 await expect(note).toHaveValue(/Last owner-scope read \(UTC\):/);
 await expect(note).toHaveValue(/Not saved, sent, approved or written to the server/);
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(note).toBeHidden();await expect(button).toBeDisabled();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!String(localStorage.getItem(k)).includes('Comparison recorded')))).toBe(true);
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

test('resolution gate matrix stays independent of reference presence and closes on failure',async({page})=>{
 const intake=await reviewerFixture(page);
 const select=intake.locator('[data-platform503-resolution-select]');
 const check=intake.locator('[data-platform503-resolution]');
 const matrix=intake.locator('[data-platform504-resolution-matrix]');
 await select.selectOption({index:1});await check.click();
 await expect(matrix.locator('li')).toHaveCount(5);
 await expect(matrix).toContainText('MISSING — EVIDENCE REQUIRED');
 await expect(matrix).toContainText('Owner authority decision · NOT RECEIVED');
 await expect(matrix).toContainText('DISABLED — QL-269 UNDER REVIEW');
 await page.evaluate(()=>window.__ledger.push({entry_id:1,profile_id:'legacy-a',
  evidence_reference:'QL-269-REVIEW-009',evidence_state:'UNVERIFIED_REFERENCE',
  recorded_at:'2026-10-31T12:00:00Z'}));
 await check.click();await expect(matrix).toContainText('FOUND — UNVERIFIED');
 await expect(matrix).toContainText('PENDING INDEPENDENT VERIFICATION');
 await select.selectOption('');await expect(matrix).toBeHidden();
 await select.selectOption({index:1});await page.evaluate(()=>window.__ledgerFail=true);
 await check.click();await expect(matrix).toBeHidden();
 await expect(intake.locator('[data-platform503-resolution-status]')).toContainText('WITHHELD');
});

test('management contrast preference survives reload and supports keyboard toggle',async({page})=>{
 await page.route('https://yw504-contrast.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
 const mount=async()=>{
  await page.goto('https://yw504-contrast.test/');await page.addStyleTag({content:css});
  await page.addScriptTag({content:management});
  await page.evaluate(()=>{Element.prototype.scrollIntoView=function(){};
   window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'fixture'})}});});
 };
 await page.setViewportSize({width:390,height:844});await mount();
 let nav=page.locator('#owner496Navigator'),button=nav.locator('[data-owner503-high-contrast]');
 await expect(button).toHaveAttribute('aria-pressed','false');
 await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
 await expect(nav.locator('[data-owner504-contrast-preference]')).toContainText('saved on this device');
 expect(await page.evaluate(()=>localStorage.getItem('yw:management-high-contrast:v504'))).toBe('on');
 await mount();nav=page.locator('#owner496Navigator');button=nav.locator('[data-owner503-high-contrast]');
 await expect(button).toHaveAttribute('aria-pressed','true');
 await expect(nav).toHaveClass(/yw503-high-contrast/);
 await expect(nav.locator('[data-owner504-contrast-preference]')).toContainText('RESTORED');
 await nav.locator('input').press('Alt+Shift+H');
 await expect(button).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>localStorage.getItem('yw:management-high-contrast:v504'))).toBe('off');
 await mount();await expect(page.locator('[data-owner503-high-contrast]')).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
