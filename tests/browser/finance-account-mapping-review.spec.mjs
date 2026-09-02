import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ACCESS_RANK, mappingFixture, ACCOUNTS } from '../fixtures/finance-account-mapping-review-fixtures.mjs';

const source=fs.readFileSync(path.join(process.cwd(),'js/finance-account-mapping-ui.js'),'utf8');
const css=fs.readFileSync(path.join(process.cwd(),'style.css'),'utf8');
const viewports=[{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:960}];
const levels=['hidden','view','create','approve','manage'];

async function mount(page,accessLevel,viewport=viewports[1]){
  const fixture=mappingFixture(accessLevel);
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.setContent('<!doctype html><html><head></head><body><main class="container"><section id="finance" class="card active"><div id="financeWorkspace"></div></section></main></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(({fixture,accessLevel,rank})=>{
    window.__mappingCalls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:accessLevel==='manage'?'admin':'employee',profile:{id:'synthetic-mapping-profile'}})};
    window.YWISecurity={
      canViewModule:(moduleKey,_role,minimum='view')=>moduleKey==='finance'&&Number(rank[accessLevel]||0)>=Number(rank[minimum]||0)
    };
    window.YWIAPI={
      escHtml:(value)=>String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
      jsonFetch:async(slug,options={})=>{
        window.__mappingCalls.push({slug,body:options.body||null});
        if(slug!=='finance-account-mapping-review') return {ok:false,error:'unexpected synthetic endpoint'};
        if(options.body?.action==='list') return fixture;
        if(options.body?.action==='review_mapping') return {ok:true,action:'review_mapping',result:{mapping_key:options.body.mapping_key,account_id:options.body.account_id,review_status:options.body.review_status}};
        return {ok:false,error:'unexpected synthetic action'};
      }
    };
    window.prompt=()=> 'Synthetic accountant review reason';
    window.confirm=()=> true;
    window.alert=()=>{};
  },{fixture,accessLevel,rank:ACCESS_RANK});
  await page.addScriptTag({content:source});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  if(accessLevel==='hidden'){
    await expect(page.locator('#financeMappingWorkspace')).toHaveCount(1);
    await expect(page.locator('#financeMappingWorkspace')).toBeEmpty();
  }else{
    await expect(page.locator('#financeMappingWorkspace')).toContainText('Accountant mapping review');
  }
  return fixture;
}

for(const viewport of viewports){
  for(const accessLevel of levels){
    test(`mapping review ${accessLevel} surface on ${viewport.name}`,async({page})=>{
      await mount(page,accessLevel,viewport);
      const host=page.locator('#financeMappingWorkspace');
      if(accessLevel==='hidden'){
        expect(await page.evaluate(()=>window.__mappingCalls.length)).toBe(0);
        return;
      }
      await expect(host).toContainText('Human accountant/bookkeeper mapping review is still required');
      await expect(host).toContainText('posting execution is OFF');
      await expect(host).toContainText('provider/payment mutation is OFF');
      await expect(host).toContainText('Accounts receivable');
      await expect(host).toContainText('Service revenue');
      await expect(host).toContainText('Sales tax payable');
      const manage=ACCESS_RANK[accessLevel]>=ACCESS_RANK.manage;
      await expect(host.locator('[data-mapping-account]')).toHaveCount(manage?3:0);
      await expect(host.locator('[data-mapping-review="approved"]')).toHaveCount(manage?3:0);
      await expect(host.locator('[data-mapping-review="rejected"]')).toHaveCount(manage?3:0);
      await expect(host.locator('[data-mapping-review="review"]')).toHaveCount(manage?3:0);
      if(!manage) await expect(host).toContainText('Finance manage required for mapping decisions');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    });
  }
}

test('manage approval sends only bounded human mapping fields',async({page})=>{
  await mount(page,'manage');
  const key='accounts_receivable';
  await page.locator(`[data-mapping-account="${key}"]`).selectOption(ACCOUNTS[0].id);
  await page.locator(`[data-mapping-review="approved"][data-mapping-key="${key}"]`).click();
  await expect.poll(async()=>page.evaluate(()=>window.__mappingCalls.filter((call)=>call.body?.action==='review_mapping').length)).toBe(1);
  const call=await page.evaluate(()=>window.__mappingCalls.find((entry)=>entry.body?.action==='review_mapping'));
  expect(Object.keys(call.body).sort()).toEqual(['account_id','action','mapping_key','reason','review_status']);
  expect(call.body).toEqual({action:'review_mapping',mapping_key:key,account_id:ACCOUNTS[0].id,review_status:'approved',reason:'Synthetic accountant review reason'});
  for(const forbidden of ['execution_enabled','execution_release_enabled','provider_mutation','job_id','work_order_id','subtotal','tax_total','total_amount','stripe','paypal','payment_status']) expect(call.body).not.toHaveProperty(forbidden);
});

test('approve-level user cannot create a mapping mutation in the real client',async({page})=>{
  await mount(page,'approve');
  await expect(page.locator('[data-mapping-review]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__mappingCalls.filter((call)=>call.body?.action==='review_mapping').length)).toBe(0);
});
