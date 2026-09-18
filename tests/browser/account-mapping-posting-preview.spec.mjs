import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { ACCESS_RANK, mappingFixture, ACCOUNTS } from '../fixtures/finance-account-mapping-review-fixtures.mjs';

const source=fs.readFileSync(path.join(process.cwd(),'js/finance-account-mapping-ui.js'),'utf8');
const css=fs.readFileSync(path.join(process.cwd(),'style.css'),'utf8');

async function mount(page){
  const fixture=mappingFixture('manage');
  await page.setViewportSize({width:1440,height:1000});
  await page.setContent('<!doctype html><html><body><main class="container"><section id="finance" class="card active"><div id="financeWorkspace"></div></section></main></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(({fixture,rank})=>{
    window.__build314Calls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'admin',profile:{id:'synthetic-build314-profile'}})};
    window.YWISecurity={canViewModule:(moduleKey,_role,minimum='view')=>moduleKey==='finance'&&Number(rank.manage)>=Number(rank[minimum]||0)};
    window.YWIAPI={
      escHtml:(value)=>String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
      jsonFetch:async(slug,options={})=>{
        window.__build314Calls.push({slug,body:options.body||null});
        if(slug!=='finance-account-mapping-review') return {ok:false,error:'unexpected endpoint'};
        if(options.body?.action==='list') return fixture;
        if(options.body?.action==='review_mapping') return {ok:true,action:'review_mapping',result:{...options.body}};
        return {ok:false,error:'unexpected action'};
      }
    };
    window.prompt=()=> 'Build 314 human reclassification review';
    window.confirm=()=> true;
    window.alert=()=>{};
  },{fixture,rank:ACCESS_RANK});
  await page.addScriptTag({content:source});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await page.locator('#financeMappingLoad').click();
  await expect.poll(async()=>page.evaluate(()=>window.__build314Calls.filter((c)=>c.body?.action==='list').length)).toBe(1);
  return fixture;
}

test('Build 314 renders proposed posting entries, tax treatment and immutable decision evidence without execution controls',async({page})=>{
  await mount(page);
  const preview=page.locator('#financePostingPreviewWorkbench');
  await expect(preview).toContainText('Account Mapping & Posting Preview');
  await expect(preview).toContainText('YW-314-001');
  await expect(preview).toContainText('Accounts receivable');
  await expect(preview).toContainText('Service revenue');
  await expect(preview).toContainText('Sales tax payable');
  await expect(preview).toContainText('Sales tax payable $130.00');
  await expect(preview).toContainText('AR_ACCOUNT_MAPPING_NOT_APPROVED');
  await expect(preview).toContainText('read-only posting preview');
  await expect(preview).toContainText('Posting execution and provider/payment mutation remain OFF');

  const audit=page.locator('#financeMappingDecisionAudit');
  await expect(audit).toContainText('Preview-to-decision audit trail');
  await expect(audit).toContainText('service_revenue');
  await expect(audit).toContainText('Reclassified to the landscape service revenue account after review.');

  await expect(page.getByRole('button',{name:/execute posting/i})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/enable posting/i})).toHaveCount(0);
  expect(await page.evaluate(()=>window.__build314Calls.some((c)=>c.body?.action==='execute_posting'))).toBe(false);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('Build 314 reclassification is an explicit row-level human review decision only',async({page})=>{
  await mount(page);
  const key='accounts_receivable';
  await page.locator(`[data-mapping-account="${key}"]`).selectOption(ACCOUNTS[0].id);
  await page.locator(`[data-mapping-review="review"][data-mapping-key="${key}"]`).click();
  await expect.poll(async()=>page.evaluate(()=>window.__build314Calls.filter((c)=>c.body?.action==='review_mapping').length)).toBe(1);
  const call=await page.evaluate(()=>window.__build314Calls.find((c)=>c.body?.action==='review_mapping'));
  expect(call.body).toEqual({
    action:'review_mapping',
    mapping_key:key,
    account_id:ACCOUNTS[0].id,
    review_status:'review',
    reason:'Build 314 human reclassification review'
  });
  expect(call.body).not.toHaveProperty('posting_authorized');
  expect(call.body).not.toHaveProperty('execution_enabled');
  expect(call.body).not.toHaveProperty('provider_mutation');
});
