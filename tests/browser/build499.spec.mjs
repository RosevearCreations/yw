import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page,uid='owner',company='owned-one'){
 await page.route('https://yw499.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw499.test/');await page.addStyleTag({content:css});
 await page.evaluate(({uid,company,keys})=>{
  window.__queries=[];window.__auditFail=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:uid}})};
  const records={ywi_companies:[{id:company,name:'Owner Test Company',owner_user_id:uid}],
   ywi_company_service_modules:keys.map(module_key=>({company_id:company,module_key,enabled:module_key==='landscape'})),
   ywi_company_service_module_audit:[{id:12,company_id:company,module_key:'landscape',action:'enabled',
    previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}]};
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
 await ownerPage(page);
 await page.locator('[data-owner497-preset="recover"]').click();
}

test('receipt review requires verified recovered server query and never saves audit rows',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);await recoverPreset(page);
 const receipt=page.locator('[data-owner499-receipt-review]');
 const status=page.locator('[data-owner499-receipt-status]');
 const details=page.locator('[data-owner499-receipt-details]');
 await expect(receipt).toBeDisabled();await expect(details).toBeHidden();
 const before=await page.evaluate(()=>window.__queries.length);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner498-verification]')).toContainText('VERIFIED RECOVERED VIEW');
 await expect(status).toContainText('VERIFIED RECEIPT READY');await expect(receipt).toBeEnabled();
 const after=await page.evaluate(()=>window.__queries.length);
 expect(after).toBe(before+1);
 await receipt.click();await expect(details).toBeVisible();
 await expect(details).toContainText('VERIFIED RECEIPT REVIEW');
 await expect(details).toContainText('1 returned matching event(s)');
 await expect(status).toContainText('SESSION RECEIPT REVIEWED');
 expect(await page.evaluate(()=>window.__queries.length)).toBe(after);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:'))
  .every(k=>!localStorage.getItem(k).includes('recorded_at')))).toBe(true);
 await page.locator('[data-owner492-timeline] button').filter({hasText:'Filter audit'}).click();
 await expect(receipt).toBeDisabled();await expect(details).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('receipt review remains withheld after failed read and across owner changes',async({page})=>{
 await ownerPage(page);await recoverPreset(page);
 await page.evaluate(()=>window.__auditFail=true);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner498-verification]')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner499-receipt-review]')).toBeDisabled();
 await page.evaluate(()=>window.__auditFail=false);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('[data-owner499-receipt-review]')).toBeEnabled();
 await ownerPage(page,'different-owner','different-company');
 await expect(page.locator('[data-owner499-receipt-review]')).toBeDisabled();
 await expect(page.locator('[data-owner499-receipt-details]')).toBeHidden();
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

test('reviewer exception aging is device-observed, refreshable, and resets on matched reference',async({page})=>{
 const intake=await reviewerPage(page);
 const ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 const refresh=intake.locator('[data-platform499-refresh-age]');
 const age=intake.locator('[data-platform499-age]');
 await page.evaluate(()=>{window.__now=Date.now();Date.now=()=>window.__now;});
 await expect(refresh).toBeDisabled();await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await expect(refresh).toBeEnabled();await expect(age).toContainText('JUST OBSERVED · 0');
 await page.evaluate(()=>window.__now+=26*3600000);await refresh.click();
 await expect(age).toContainText('RECHECK PRIORITY · 26 elapsed device hour(s)');
 await expect(age).toContainText('not external reviewer evidence');
 await reconcile.click();await expect(age).toContainText('RECHECK PRIORITY · 26');
 await intake.getByRole('button',{name:'Prepare reviewer exception follow-up'}).click();
 const note=intake.locator('[data-platform498-note]');
 await expect(note).toHaveJSProperty('readOnly',true);
 await expect(note).toHaveValue(/First device-observed \(not external proof\)/);
 await expect(note).toHaveValue(/RECHECK PRIORITY/);
 await expect(note).toHaveValue(/QL-269 — UNDER REVIEW/);
 await ticket.fill('QL-269-REVIEW-001');await expect(refresh).toBeDisabled();
 await reconcile.click();await expect(age).toContainText('prior local exception age cleared');
 await expect(refresh).toBeDisabled();await expect(note).toBeHidden();
 expect((await page.evaluate(()=>window.__calls)).every(c=>[
  'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493'].includes(c.name))).toBe(true);
});

test('reviewer age refresh fails closed when authentication changes',async({page})=>{
 const intake=await reviewerPage(page);
 await intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'}).fill('QL-269-REVIEW-009');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 const refresh=intake.locator('[data-platform499-refresh-age]');await expect(refresh).toBeEnabled();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await refresh.click();await expect(intake.locator('[data-platform499-age]')).toContainText('WITHHELD');
 await expect(refresh).toBeDisabled();await expect(intake.locator('[data-platform498-note]')).toBeHidden();
});

test('management retest requires a second focus-return-accept cycle with keyboard accessibility',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{window.__scroll=null;Element.prototype.scrollIntoView=function(opts){window.__scroll=opts;};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});});
 const nav=page.locator('#owner496Navigator'),input=nav.locator('input');
 const back=nav.locator('[data-owner498-return]'),accept=nav.locator('[data-owner498-accept]');
 const retest=nav.locator('[data-owner499-retest]'),state=nav.locator('[data-owner498-acceptance]');
 await expect(retest).toBeDisabled();await input.fill('Safety');await input.press('Enter');
 await expect(state).toContainText('FOCUS VERIFIED');
 expect(await page.evaluate(()=>window.__scroll.behavior)).toBe('auto');
 await back.click();await expect(input).toBeFocused();await accept.click();
 await expect(state).toContainText('LOCAL NAVIGATION CHECK COMPLETE');
 await expect(state).toContainText('attempt 1');await expect(retest).toBeEnabled();
 await retest.click();await expect(input).toBeFocused();
 await expect(accept).toBeDisabled();await expect(retest).toBeDisabled();
 await expect(state).toContainText('ACCESSIBILITY RETEST READY · attempt 2');
 await input.fill('Safety');await input.press('Enter');await expect(state).toContainText('FOCUS VERIFIED');
 await back.click();await expect(input).toBeFocused();await accept.click();
 await expect(state).toContainText('LOCAL NAVIGATION CHECK COMPLETE');
 await expect(state).toContainText('attempt 2');await expect(state).toContainText('not formal owner acceptance');
 await input.press('Escape');await expect(accept).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
