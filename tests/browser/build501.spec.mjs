import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page){
 await page.route('https://yw501.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw501.test/');await page.addStyleTag({content:css});
 await page.evaluate(keys=>{
  window.__queries=[];window.__auditFail=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'owner'}})};
  const records={ywi_companies:[{id:'owned-one',name:'Owner Test Company',owner_user_id:'owner'}],
   ywi_company_service_modules:keys.map(module_key=>({company_id:'owned-one',module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:12,company_id:'owned-one',module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
  window.__records=records;
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
   const rules=[];return {select(){return this},eq(k,v){rules.push([k,v]);return this},
    gte(k,v){rules.push([k,'gte:'+v]);return this},order(){return this},
    async limit(){window.__queries.push({table,rules});
     if(window.__auditFail&&table==='ywi_company_service_module_audit'&&rules.some(([k])=>k==='module_key'))
      return {error:{message:'Unavailable'},data:null};
     return {error:null,data:(records[table]||[]).filter(row=>rules.every(([k,v])=>
      v.startsWith('gte:')?row[k]>=v.slice(4):row[k]===v))};}};}};
 },keys);
 await page.addScriptTag({content:owner});await page.locator('#owner490Load').click();
 await page.locator('[data-owner492-timeline] > summary').click();
}
async function createComparison(page){
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
 await expect(page.locator('[data-owner499-receipt-review]')).toBeEnabled();
 await page.locator('[data-owner499-receipt-review]').click();
 await page.locator('[data-owner500-receipt-compare]').click();
}

test('receipt comparison history stays session-only and fresh scope recheck detects count movement',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);await createComparison(page);
 const history=page.locator('[data-owner501-history]'),scope=page.locator('[data-owner501-scope-recheck]');
 const list=page.locator('[data-owner501-history-list]'),status=page.locator('[data-owner501-history-status]');
 await expect(history).toBeEnabled();await expect(scope).toBeEnabled();
 await history.click();await expect(list).toBeVisible();
 await expect(list.locator('li')).toHaveCount(1);await expect(list).toContainText('COUNT INCREASE +1');
 await page.evaluate(()=>window.__records.ywi_company_service_module_audit.push({id:14,
  company_id:'owned-one',module_key:'landscape',action:'enabled',previous_enabled:false,
  next_enabled:true,recorded_at:'2026-10-31T13:00:00Z'}));
 const before=await page.evaluate(()=>window.__queries.length);
 await scope.click();await expect(status).toContainText('VERIFIED OWNER SCOPE RECHECK');
 await expect(status).toContainText('COUNT MOVED');
 expect(await page.evaluate(()=>window.__queries.length)).toBe(before+1);
 await history.click();await expect(list).toContainText('SCOPE RECHECK');
 await expect(list).toContainText('3 matching server event(s)');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!localStorage.getItem(k).includes('recorded_at')))).toBe(true);
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(history).toBeDisabled();await expect(scope).toBeDisabled();await expect(list).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('scope recheck withholds failed server reads and foreign owner session',async({page})=>{
 await ownerPage(page);await createComparison(page);
 const scope=page.locator('[data-owner501-scope-recheck]');
 await page.evaluate(()=>window.__auditFail=true);await scope.click();
 await expect(page.locator('[data-owner501-history-status]')).toContainText('WITHHELD');
 await page.evaluate(()=>{window.__auditFail=false;window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'owner'}});});
 await scope.click();await expect(page.locator('[data-owner501-history-status]')).toContainText('WITHHELD');
 await page.locator('[data-owner501-history]').click();
 await expect(page.locator('[data-owner501-history-list]')).toBeHidden();
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

test('reviewer queue sorts local priorities and clears references that appear in restricted ledger',async({page})=>{
 const intake=await reviewerPage(page),ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 const queue=intake.locator('[data-platform501-priority-queue]'),list=intake.locator('[data-platform501-queue-list]');
 await page.evaluate(()=>{window.__now=Date.now();Date.now=()=>window.__now;});
 await expect(queue).toBeDisabled();await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await page.evaluate(()=>window.__now+=26*3600000);
 await ticket.fill('QL-269-REVIEW-010');await reconcile.click();
 await expect(queue).toBeEnabled();await queue.click();
 await expect(list).toBeVisible();await expect(list.locator('li')).toHaveCount(2);
 await expect(list.locator('li').first()).toContainText('HIGH RECHECK');
 await expect(list.locator('li').first()).toContainText('QL-269-REVIEW-009');
 await expect(list.locator('li').last()).toContainText('ROUTINE RECHECK');
 await expect(intake.locator('[data-platform501-queue-status]')).toContainText('Device-clock estimates only');
 await page.evaluate(()=>window.__ledger.push({entry_id:2,profile_id:'legacy-a',
  evidence_reference:'QL-269-REVIEW-009',evidence_state:'UNVERIFIED_REFERENCE',recorded_at:'2026-10-31T12:00:00Z'}));
 await ticket.fill('QL-269-REVIEW-009');await reconcile.click();await queue.click();
 await expect(list.locator('li')).toHaveCount(1);
 await expect(list).not.toContainText('QL-269-REVIEW-009');
 expect((await page.evaluate(()=>window.__calls)).every(c=>[
  'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493'].includes(c.name))).toBe(true);
});

test('priority queue fails closed after reviewer authentication changes',async({page})=>{
 const intake=await reviewerPage(page);
 await intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'}).fill('QL-269-REVIEW-009');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await intake.locator('[data-platform501-priority-queue]').click();
 await expect(intake.locator('[data-platform501-queue-status]')).toContainText('WITHHELD');
 await expect(intake.locator('[data-platform501-priority-queue]')).toBeDisabled();
 await expect(intake.locator('[data-platform501-queue-list]')).toBeHidden();
});

test('distinct-card accessibility review requires two different confirmed keyboard destinations',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{window.__scroll=null;Element.prototype.scrollIntoView=function(opts){window.__scroll=opts;};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});});
 const nav=page.locator('#owner496Navigator'),input=nav.locator('input');
 const back=nav.locator('[data-owner498-return]'),accept=nav.locator('[data-owner498-accept]');
 const retest=nav.locator('[data-owner499-retest]');
 const multi=nav.locator('[data-owner501-multi-card-review]'),summary=nav.locator('[data-owner501-multi-card-evidence]');
 await expect(multi).toBeDisabled();
 await input.fill('Safety');await input.press('Enter');await back.click();await accept.click();
 await retest.click();await input.fill('Safety');await input.press('Enter');await back.click();await accept.click();
 await expect(nav.locator('[data-owner500-retest-summary]')).toBeEnabled();
 await expect(multi).toBeDisabled();await expect(summary).toBeHidden();
 await retest.click();await input.fill('receivables');await input.press('Enter');
 await expect(nav.locator('[data-owner498-acceptance]')).toContainText('FOCUS VERIFIED');
 await back.click();await accept.click();await expect(multi).toBeEnabled();
 await multi.click();await expect(summary).toBeVisible();
 await expect(summary).toContainText('MULTI-CARD ACCESSIBILITY REVIEW');
 await expect(summary).toContainText('2 distinct management cards');
 await expect(summary).toContainText('Safety, equipment');
 await expect(summary).toContainText('Profitability & receivables');
 await expect(summary).toContainText('no formal owner acceptance');
 await retest.click();await expect(multi).toBeDisabled();await expect(summary).toBeHidden();
 await expect(input).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
