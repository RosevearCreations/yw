import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page){
 await page.route('https://yw502.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw502.test/');await page.addStyleTag({content:css});
 await page.evaluate(keys=>{
  window.__auditFail=false;window.__queries=0;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'owner'}})};
  window.__records={ywi_companies:[{id:'owned-one',name:'Owner Test Company',owner_user_id:'owner'}],
   ywi_company_service_modules:keys.map(module_key=>({company_id:'owned-one',module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:12,company_id:'owned-one',module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
   const rules=[];return {select(){return this},eq(k,v){rules.push([k,v]);return this},
    gte(k,v){rules.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){window.__queries++;
     if(window.__auditFail&&table==='ywi_company_service_module_audit'&&rules.some(([k])=>k==='module_key'))
      return {error:{message:'Unavailable'},data:null};
     return {error:null,data:(window.__records[table]||[]).filter(row=>rules.every(([k,v])=>
      v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },keys);
 await page.addScriptTag({content:owner});await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
}
async function ownerComparison(page){
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('select[aria-label="Filter service audit by action"]').selectOption('enabled');
 await page.locator('[data-owner495-preset="save"]').click();
 await page.evaluate(()=>localStorage.setItem('yw:owner-audit-filters:v496:owner:owned-one','damaged-primary'));
 await ownerPage(page);await page.locator('[data-owner497-preset="recover"]').click();
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner498-verification]')).toContainText('VERIFIED RECOVERED VIEW');
 await page.locator('[data-owner499-receipt-review]').click();
 await page.evaluate(()=>window.__records.ywi_company_service_module_audit.push({id:13,
  company_id:'owned-one',module_key:'landscape',action:'enabled',previous_enabled:false,
  next_enabled:true,recorded_at:'2026-10-31T12:00:00Z'}));
 await page.locator('[data-owner495-preset="restore"]').click();
 await page.locator('[data-owner499-receipt-review]').click();
 await page.locator('[data-owner500-receipt-compare]').click();
}

test('owner history filters pending and moved scope, and retries failed fresh reads',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);await ownerComparison(page);
 const history=page.locator('[data-owner501-history]'),filter=page.locator('[data-owner502-history-filter]');
 const list=page.locator('[data-owner501-history-list]'),retry=page.locator('[data-owner502-scope-recovery]');
 await history.click();await filter.selectOption('pending');
 await expect(list.locator('li')).toHaveCount(1);
 await expect(list).toContainText('Scope not rechecked');
 await page.evaluate(()=>window.__auditFail=true);
 await page.locator('[data-owner501-scope-recheck]').click();
 await expect(page.locator('[data-owner501-history-status]')).toContainText('WITHHELD');
 await expect(retry).toBeEnabled();
 await page.evaluate(()=>{window.__auditFail=false;window.__records.ywi_company_service_module_audit.push({id:14,
  company_id:'owned-one',module_key:'landscape',action:'enabled',previous_enabled:false,
  next_enabled:true,recorded_at:'2026-10-31T13:00:00Z'});});
 await retry.click();await expect(page.locator('[data-owner501-history-status]')).toContainText('COUNT MOVED');
 await expect(retry).toBeDisabled();
 await history.click();await expect(list).toContainText('No session comparison matches');
 await filter.selectOption('moved');await expect(list).toContainText('3 matching server event(s)');
 await filter.selectOption('stable');await expect(list).toContainText('No session comparison matches');
 await filter.selectOption('all');await expect(list.locator('li')).toHaveCount(1);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!localStorage.getItem(k).includes('recorded_at')))).toBe(true);
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(retry).toBeDisabled();await expect(list).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('owner recovery refuses a changed authentication session',async({page})=>{
 await ownerPage(page);await ownerComparison(page);
 await page.evaluate(()=>window.__auditFail=true);
 await page.locator('[data-owner501-scope-recheck]').click();
 const retry=page.locator('[data-owner502-scope-recovery]');await expect(retry).toBeEnabled();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'owner'}}));
 await retry.click();await expect(page.locator('[data-owner501-history-status]')).toContainText('WITHHELD');
 await expect(retry).toBeDisabled();
});

async function reviewerPage(page){
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  const account=(id,primary)=>({profile_id:id,account_name:id,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.__calls=[];window.__ledger=[];window.__ledgerFail=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'primary'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},
   rpc:async(name)=>{window.__calls.push(name);
    if(name==='ywi_platform_account_audit_490')return {error:null,data:[account('primary',true),account('legacy-a',false)]};
    if(name==='ywi_platform_legacy_evidence_list_493')return window.__ledgerFail?
      {error:{message:'Unavailable'},data:null}:{error:null,data:[...window.__ledger]};
    throw Error('Unexpected RPC: '+name);
   }};
 });
 await page.addScriptTag({content:reviewer});await page.locator('#platform490 > summary').click();
 await page.locator('#platform490Refresh').click();
 await page.locator('[data-platform496-intake="legacy-a"] > summary').click();
 return page.locator('[data-platform496-intake="legacy-a"]');
}

test('reviewer queue readiness rechecks ledger, removes matched tickets, prepares local copy-only packet',async({page})=>{
 const intake=await reviewerPage(page);
 const ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 const readiness=intake.locator('[data-platform502-readiness]');
 const packet=intake.locator('[data-platform502-readiness-packet]');
 await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await ticket.fill('QL-269-REVIEW-010');await reconcile.click();
 await expect(readiness).toBeEnabled();
 await page.evaluate(()=>window.__ledger.push({entry_id:2,profile_id:'legacy-a',
  evidence_reference:'QL-269-REVIEW-009',evidence_state:'UNVERIFIED_REFERENCE',
  recorded_at:'2026-10-31T12:00:00Z'}));
 await readiness.click();
 await expect(intake.locator('[data-platform502-readiness-status]')).toContainText('1 local observation(s) still missing');
 await expect(packet).toBeVisible();await expect(packet).toHaveValue(/QL-269-REVIEW-010/);
 await expect(packet).not.toHaveValue(/QL-269-REVIEW-009/);
 await expect(packet).toHaveValue(/Not sent, saved to server, approved/);
 await intake.locator('[data-platform501-priority-queue]').click();
 await expect(intake.locator('[data-platform501-queue-list]')).not.toContainText('QL-269-REVIEW-009');
 expect((await page.evaluate(()=>window.__calls)).every(x=>
  ['ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493'].includes(x))).toBe(true);
});

test('reviewer readiness withholds unavailable ledger and invalidated session',async({page})=>{
 const intake=await reviewerPage(page);
 const ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 await ticket.fill('QL-269-REVIEW-009');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 const readiness=intake.locator('[data-platform502-readiness]'),packet=intake.locator('[data-platform502-readiness-packet]');
 await page.evaluate(()=>window.__ledgerFail=true);await readiness.click();
 await expect(intake.locator('[data-platform502-readiness-status]')).toContainText('WITHHELD');
 await expect(packet).toBeHidden();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await readiness.click();await expect(intake.locator('[data-platform502-readiness-status]')).toContainText('WITHHELD');
 await expect(packet).toBeHidden();
});

test('management samples text and focus contrast only after distinct keyboard-reviewed cards',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{
  Element.prototype.scrollIntoView=function(){};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});
 });
 const nav=page.locator('#owner496Navigator'),search=nav.locator('input');
 const back=nav.locator('[data-owner498-return]'),accept=nav.locator('[data-owner498-accept]');
 const retest=nav.locator('[data-owner499-retest]'),multi=nav.locator('[data-owner501-multi-card-review]');
 const contrast=nav.locator('[data-owner502-contrast-review]'),evidence=nav.locator('[data-owner502-contrast-evidence]');
 await expect(contrast).toBeDisabled();
 await search.fill('Safety');await search.press('Enter');await back.click();await accept.click();
 await retest.click();await search.fill('receivables');await search.press('Enter');await back.click();await accept.click();
 await expect(multi).toBeEnabled();await expect(contrast).toBeDisabled();
 await multi.click();await expect(contrast).toBeEnabled();await contrast.click();
 await expect(evidence).toBeVisible();await expect(evidence).toContainText('SAMPLED NAVIGATION CONTRAST PASS');
 await expect(evidence).toContainText('Normal text threshold 4.5:1');
 await expect(evidence).toContainText('Not formal accessibility certification');
 await retest.click();await expect(contrast).toBeDisabled();await expect(evidence).toBeHidden();
 await expect(search).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
