import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const reviewer=readFileSync('js/platform-account-audit-490.js','utf8');
const management=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerPage(page,uid='owner',company='owned-one'){
 await page.route('https://yw498.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.goto('https://yw498.test/');await page.addStyleTag({content:css});
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

test('recovered view stays pending until the owner-scoped server result matches exactly',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ownerPage(page);await recoverPreset(page);
 const receipt=page.locator('[data-owner498-verification]');
 await expect(receipt).toContainText('RECOVERED VIEW READY');
 await expect(receipt).toContainText('Service landscape · action enabled · since any UTC date');
 const before=await page.evaluate(()=>window.__queries.length);
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeEnabled();
 expect(await page.evaluate(()=>window.__queries.length)).toBe(before);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(receipt).toContainText('VERIFIED RECOVERED VIEW');
 await expect(receipt).toContainText('1 matching server event');
 expect(await page.evaluate(()=>window.__queries.at(-1))).toEqual({
  table:'ywi_company_service_module_audit',
  rules:[['company_id','owned-one'],['module_key','landscape'],['action','enabled']]});
 await page.locator('[data-owner496-preset="clear"]').click();
 await expect(receipt).toContainText('verification cleared');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('yw:')))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});

test('failed server recheck never marks a recovered view verified, and retry can succeed',async({page})=>{
 await ownerPage(page);await recoverPreset(page);
 await page.evaluate(()=>window.__auditFail=true);
 await page.locator('[data-owner495-preset="restore"]').click();
 const receipt=page.locator('[data-owner498-verification]');
 await expect(receipt).toContainText('WITHHELD: Recovered view not verified by the server');
 await expect(page.locator('[data-owner492-timeline] [role="status"]').last()).toContainText('WITHHELD');
 await page.evaluate(()=>window.__auditFail=false);
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(receipt).toContainText('VERIFIED RECOVERED VIEW');
 await ownerPage(page,'different-owner','different-company');
 await expect(page.locator('[data-owner497-preset="recover"]')).toBeDisabled();
 await expect(page.locator('[data-owner498-verification]')).not.toContainText('VERIFIED RECOVERED VIEW');
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
    if(name==='ywi_platform_legacy_evidence_record_493')throw Error('Unexpected record write');
    throw Error('Unexpected RPC: '+name);
   }};
 });
 await page.addScriptTag({content:reviewer});await page.locator('#platform490 > summary').click();
 await page.locator('#platform490Refresh').click();
 await page.locator('[data-platform496-intake="legacy-a"] > summary').click();
 return page.locator('[data-platform496-intake="legacy-a"]');
}

test('unresolved reviewer ticket creates a copy-only exception note; matched ticket clears it',async({page})=>{
 const intake=await reviewerPage(page),ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 const reconcile=intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'});
 const follow=intake.getByRole('button',{name:'Prepare reviewer exception follow-up'});
 const note=intake.locator('[data-platform498-note]');
 await expect(follow).toBeDisabled();await ticket.fill('QL-269-REVIEW-009');await reconcile.click();
 await expect(intake.locator('[role="status"]').first()).toContainText('NOT FOUND');
 await expect(follow).toBeEnabled();await follow.click();await expect(note).toBeVisible();
 await expect(note).toHaveJSProperty('readOnly',true);
 await expect(note).toHaveValue(/REFERENCE_NOT_FOUND/);
 await expect(note).toHaveValue(/QL-269 — UNDER REVIEW/);
 await expect(intake.locator('[role="status"]').last()).toContainText('Not sent, saved or approved');
 await ticket.fill('QL-269-REVIEW-001');await expect(follow).toBeDisabled();
 await expect(note).toBeHidden();await reconcile.click();
 await expect(intake.locator('[role="status"]').first()).toContainText('MATCHED 1 UNVERIFIED_REFERENCE');
 await expect(follow).toBeDisabled();
 expect((await page.evaluate(()=>window.__calls)).every(c=>[
  'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493'].includes(c.name))).toBe(true);
});

test('foreign restricted ledger and session changes fail closed for reviewer exception follow-up',async({page})=>{
 const intake=await reviewerPage(page),ticket=intake.getByRole('textbox',{name:'Independent reviewer external ticket reference'});
 await page.evaluate(()=>window.__ledger.push({entry_id:2,profile_id:'foreign',
  evidence_reference:'QL-269-FOREIGN-002',evidence_state:'UNVERIFIED_REFERENCE',
  recorded_at:'2026-10-31T12:00:00Z'}));
 await ticket.fill('QL-269-REVIEW-001');
 await intake.getByRole('button',{name:'Reconcile ticket against restricted ledger'}).click();
 await expect(intake.locator('[role="status"]').first()).toContainText('WITHHELD');
 const follow=intake.getByRole('button',{name:'Prepare reviewer exception follow-up'});
 await expect(follow).toBeEnabled();
 await page.evaluate(()=>window.YWI_AUTH.getState=()=>({isAuthenticated:false,user:{id:'primary'}}));
 await follow.click();
 await expect(intake.locator('[role="status"]').last()).toContainText('WITHHELD');
 await expect(intake.locator('[data-platform498-note]')).toBeHidden();
 await expect(follow).toBeDisabled();
});

test('owner navigation acceptance requires focus, keyboard return and explicit local confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.addScriptTag({content:management});
 await page.evaluate(()=>{window.__scroll=null;Element.prototype.scrollIntoView=function(opts){window.__scroll=opts;};
  window.YWIOwnerManagementCommandUI.mount({api:{loadAdminDirectory:async()=>({ok:false,error:'Fixture unavailable'})}});});
 const nav=page.locator('#owner496Navigator'),input=nav.locator('input');
 const back=nav.locator('[data-owner498-return]'),accept=nav.locator('[data-owner498-accept]');
 const state=nav.locator('[data-owner498-acceptance]');
 await expect(back).toBeDisabled();await expect(accept).toBeDisabled();
 await input.fill('Safety');await input.press('Enter');
 await expect(state).toContainText('FOCUS VERIFIED');
 expect(await page.evaluate(()=>document.activeElement?.querySelector?.('h4')?.textContent))
  .toContain('Safety, equipment');
 expect(await page.evaluate(()=>window.__scroll.behavior)).toBe('auto');
 await expect(back).toBeEnabled();await expect(accept).toBeDisabled();
 await back.click();await expect(input).toBeFocused();
 await expect(state).toContainText('RETURN VERIFIED');await expect(accept).toBeEnabled();
 await accept.click();await expect(state).toContainText('LOCAL NAVIGATION CHECK COMPLETE');
 await expect(state).toContainText('not formal owner acceptance');
 await input.fill('receivables');await expect(accept).toBeDisabled();
 await expect(state).toContainText('Navigation selection changed');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
});
