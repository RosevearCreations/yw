import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ACCESS_RANK, financeFixture, itReadinessFixture, INTAKES } from '../fixtures/finance-release-hardening-fixtures.mjs';

const financeSource=fs.readFileSync(path.join(process.cwd(),'js/finance-ui.js'),'utf8');
const itSource=fs.readFileSync(path.join(process.cwd(),'js/it-readiness-ui.js'),'utf8');
const cssSource=fs.readFileSync(path.join(process.cwd(),'style.css'),'utf8');
const levels=['hidden','view','create','approve','manage'];
const viewports=[{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:960}];

async function mountFinance(page,accessLevel,viewport){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  const fixture=financeFixture(accessLevel);
  await page.setContent('<!doctype html><html><head></head><body><main class="container"><section id="finance" class="card active"><div id="financeWorkspace"></div></section></main></body></html>');
  await page.addStyleTag({content:cssSource});
  await page.evaluate(({accessLevel,fixture,rank})=>{
    window.__financeCalls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:accessLevel==='manage'?'admin':'employee',profile:{id:'synthetic-profile'}})};
    window.YWISecurity={
      getModuleAccess:(moduleKey)=>moduleKey==='finance'?accessLevel:'hidden',
      canViewModule:(moduleKey,_role,minimum='view')=>moduleKey==='finance' && Number(rank[accessLevel]||0)>=Number(rank[minimum]||0)
    };
    window.YWIAPI={
      escHtml:(value)=>String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
      loadAdminDirectory:async()=>fixture.accounting,
      jsonFetch:async(slug,options={})=>{
        window.__financeCalls.push({slug,body:options.body||null});
        if(slug==='finance-job-completion-review'){
          if(options.body?.action==='list')return fixture.review;
          return {ok:true,action:options.body?.action||'unknown'};
        }
        if(slug==='finance-job-completion-posting-approval'){
          if(options.body?.action==='list')return fixture.posting;
          if(options.body?.action==='preflight')return {ok:true,action:'preflight',result:{preflight_status:'blocked'}};
          return {ok:true,action:options.body?.action||'unknown'};
        }
        return {ok:false,error:'unexpected synthetic endpoint'};
      }
    };
    window.prompt=()=> 'Synthetic acceptance reason';
    window.confirm=()=> true;
  },{accessLevel,fixture,rank:ACCESS_RANK});
  await page.addScriptTag({content:financeSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  if(accessLevel==='hidden') await expect(page.locator('#financeWorkspace')).toContainText('Finance module hidden');
  else await expect(page.locator('#financeWorkspace')).toContainText('Finance workspace');
  return fixture;
}

for(const viewport of viewports){
  for(const accessLevel of levels){
    test(`Finance ${accessLevel} permission surface on ${viewport.name}`,async({page})=>{
      await mountFinance(page,accessLevel,viewport);
      const host=page.locator('#financeWorkspace');
      if(accessLevel==='hidden'){
        expect(await page.evaluate(()=>window.__financeCalls.length)).toBe(0);
        await expect(host.locator('[data-finance-review]')).toHaveCount(0);
        await expect(host.locator('[data-finance-posting]')).toHaveCount(0);
        return;
      }

      await expect(host).toContainText('Completion → accounting lifecycle');
      await expect(host).toContainText('FINANCE_REVIEW_REQUIRED');
      await expect(host).toContainText('AR_ACCOUNT_MAPPING_NOT_APPROVED');
      await expect(host).toContainText('POSTING_RECOVERY_REQUIRED');
      await expect(host).toContainText('Provider/payment mutation remains OFF');
      await expect(host.locator('[data-finance-posting="execute_posting"]')).toHaveCount(0);
      await expect(host.locator('[data-finance-posting="reverse_posting"]')).toHaveCount(accessLevel==='manage'?1:0);
      const canApprove=ACCESS_RANK[accessLevel]>=ACCESS_RANK.approve;
      await expect(host.locator('[data-finance-review="approve"]')).toHaveCount(canApprove?1:0);
      await expect(host.locator('[data-finance-review="generate"]')).toHaveCount(canApprove?1:0);
      await expect(host.locator('[data-finance-posting="approve_posting"]')).toHaveCount(canApprove?1:0);
      if(canApprove) await expect(host.locator('[data-finance-posting="preflight"]')).toHaveCount(2);
      else await expect(host.locator('[data-finance-posting="preflight"]')).toHaveCount(0);

      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    });
  }
}

test('Finance approve action sends only bounded identifiers and reason',async({page})=>{
  await mountFinance(page,'approve',viewports[1]);
  await page.locator(`[data-finance-posting="approve_posting"][data-intake-id="${INTAKES.approval}"]`).click();
  await expect.poll(async()=>page.evaluate(()=>window.__financeCalls.filter((c)=>c.body?.action==='approve_posting').length)).toBe(1);
  const call=await page.evaluate(()=>window.__financeCalls.find((c)=>c.body?.action==='approve_posting'));
  expect(Object.keys(call.body).sort()).toEqual(['action','intake_id','reason']);
  for(const forbidden of ['subtotal','tax_total','total_amount','gl_account_id','execution_status','stripe','paypal','provider_mutation']) expect(call.body).not.toHaveProperty(forbidden);
});

test('Finance release requires both server execution authorization and release truth',async({page})=>{
  const fixture=financeFixture('approve');
  fixture.posting.queue=fixture.posting.queue.map((row)=>row.intake_id===INTAKES.blocked?{...row,execution_authorized:true}:row);
  await page.setViewportSize({width:1440,height:960});
  await page.setContent('<main class="container"><section id="finance" class="card active"><div id="financeWorkspace"></div></section></main>');
  await page.addStyleTag({content:cssSource});
  await page.evaluate(({fixture,rank})=>{
    const accessLevel='approve';
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'employee',profile:{id:'synthetic'}})};
    window.YWISecurity={getModuleAccess:()=>accessLevel,canViewModule:(_m,_r,min='view')=>rank[accessLevel]>=rank[min]};
    window.YWIAPI={loadAdminDirectory:async()=>fixture.accounting,jsonFetch:async(slug,o)=>slug==='finance-job-completion-review'?fixture.review:fixture.posting};
  },{fixture,rank:ACCESS_RANK});
  await page.addScriptTag({content:financeSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#financeWorkspace')).toContainText('posting execution release is OFF');
  await expect(page.locator('[data-finance-posting="execute_posting"]')).toHaveCount(0);
});

async function mountIt(page,role='admin'){
  await page.setViewportSize({width:1440,height:960});
  const fixture=itReadinessFixture();
  await page.setContent('<!doctype html><html><body><main class="container"><section id="admin" class="card"></section></main></body></html>');
  await page.addStyleTag({content:cssSource});
  await page.evaluate(({fixture,role})=>{
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role,profile:{id:'synthetic-admin'}})};
    window.YWIAPI={jsonFetch:async()=>fixture,runSmokeCheck:async()=>({ok:true,checks:[]})};
  },{fixture,role});
  await page.addScriptTag({content:itSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await page.evaluate(()=>document.getElementById('it')?.classList.add('active'));
  return fixture;
}

test('Admin I.T. renders Finance operational and Build 179 hardening evidence',async({page})=>{
  await mountIt(page,'admin');
  await page.locator('#itReadinessLoad').click();
  const host=page.locator('#itReadinessWorkspace');
  await expect(host).toContainText('Finance pipeline');
  await expect(host).toContainText('Finance reconciliation');
  await expect(host).toContainText('Finance release hardening');
  await expect(host).toContainText('finance_operational');
  await expect(host).toContainText('finance_release_hardening');
  await expect(host).toContainText('Admin break-glass access');
});

test('non-admin cannot render I.T. readiness control plane',async({page})=>{
  await mountIt(page,'employee');
  await expect(page.locator('#itReadinessWorkspace')).toContainText('Admin manage access is required');
});
