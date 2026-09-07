import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workspaceSource=fs.readFileSync(path.join(process.cwd(),'js/workspace-organization.js'),'utf8');

async function mount(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <section id="today" class="card active">
      <div id="mobileTodayGrid">
        <article data-today-card="jobs"><a data-mobile-today-link="jobs" href="#jobs">Jobs</a></article>
        <article data-today-card="toolbox"><a data-mobile-today-link="toolbox" href="#toolbox">Toolbox</a></article>
        <article data-today-card="admin"><a data-mobile-today-link="admin" href="#admin">Admin</a></article>
      </div>
    </section>
    <section id="finance" class="card">
      <div id="financeWorkspace">
        <div class="module-workspace-heading"><h2>Finance workspace</h2></div>
        <div class="finance-stat-grid"><article>Overview</article></div>
        <div class="finance-lists">
          <section class="finance-list-card"><h3>Completed jobs — Finance review</h3></section>
          <section class="finance-list-card"><h3>Completion → accounting lifecycle</h3></section>
          <section class="finance-list-card"><h3>Accounting close</h3></section>
          <section class="finance-list-card"><h3>Reconciliation exceptions</h3></section>
          <section class="finance-list-card"><h3>Tax filing review</h3></section>
          <section class="finance-list-card"><h3>Payroll remittance review</h3></section>
        </div>
        <button id="financeRefresh" type="button">Refresh Finance</button>
      </div>
      <div id="financeMappingWorkspace"><section class="finance-list-card"><h3>Accountant mapping review</h3><button id="financeMappingLoad">Load accountant mapping readiness</button></section></div>
    </section>
    <section id="it" class="card"><div id="itReadinessWorkspace">
      <div class="it-readiness-hero"></div>
      <div class="it-readiness-grid">
        <section class="it-readiness-panel"><h3>Application release authority</h3><span class="it-readiness-status passed">ready</span></section>
        <section class="it-readiness-panel"><h3>Schema drift</h3><span class="it-readiness-status passed">current</span></section>
        <section class="it-readiness-panel"><h3>Finance pipeline</h3><span class="it-readiness-status warning">pending</span></section>
        <section class="it-readiness-panel"><h3>Admin break-glass access</h3><span class="it-readiness-status error">blocked</span></section>
        <section class="it-readiness-panel"><h3>Public SEO release checks</h3><span class="it-readiness-status passed">ready</span></section>
      </div>
    </div></section>
  </body></html>`);
  await page.evaluate(()=>{
    history.replaceState({},'', '#today');
    window.__realFinanceCalls=[];
    window.YWIAPI={jsonFetch:async(path)=>{window.__realFinanceCalls.push(path);return {ok:true,real:true,path};}};
    window.YWI_AUTH={getState:()=>({role:'admin',isAuthenticated:true})};
    window.YWIRouter={showSection:(route)=>{window.__lastRoute=route;}};
    window.YWIMobileToday={syncSnapshot:()=>({online:true,forms:0,drafts:0,actions:0,conflicts:0})};
  });
  await page.addScriptTag({content:workspaceSource});
  await expect.poll(()=>page.evaluate(()=>window.YWIWorkspaceOrganization?.getState?.().financeApiPatched)).toBe(true);
}

test('Finance defers review and posting authorities until their workspace is selected',async({page})=>{
  await mount(page);
  const initial=await page.evaluate(async()=>({
    review:await window.YWIAPI.jsonFetch('finance-job-completion-review',{method:'POST'}),
    posting:await window.YWIAPI.jsonFetch('finance-job-completion-posting-approval',{method:'POST'}),
    calls:window.__realFinanceCalls.slice()
  }));
  expect(initial.review.deferred).toBe(true);
  expect(initial.posting.deferred).toBe(true);
  expect(initial.calls).toEqual([]);

  await page.evaluate(()=>window.YWIWorkspaceOrganization.selectFinanceWorkspace('review'));
  const review=await page.evaluate(()=>window.YWIAPI.jsonFetch('finance-job-completion-review',{method:'POST'}));
  expect(review.real).toBe(true);
  expect(await page.evaluate(()=>window.__realFinanceCalls)).toContain('finance-job-completion-review');

  await page.evaluate(()=>window.YWIWorkspaceOrganization.selectFinanceWorkspace('posting'));
  const posting=await page.evaluate(()=>window.YWIAPI.jsonFetch('finance-job-completion-posting-approval',{method:'POST'}));
  expect(posting.real).toBe(true);
  expect(await page.evaluate(()=>window.__realFinanceCalls)).toContain('finance-job-completion-posting-approval');
});

test('Finance renders a six-choice direction hub and hides deep panels on Overview',async({page})=>{
  await mount(page);
  await page.evaluate(()=>{location.hash='#finance';window.YWIWorkspaceOrganization.decorateFinance();});
  await expect(page.locator('.finance-workspace-choice')).toHaveCount(6);
  await expect(page.locator('.finance-workspace-choice[aria-pressed="true"]')).toContainText('Finance Overview');
  await expect(page.locator('#financeWorkspace .finance-list-card:not([hidden])')).toHaveCount(0);
  await page.getByRole('button',{name:/Reconciliation/}).click();
  await expect(page.locator('#financeWorkspace .finance-list-card:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#financeWorkspace .finance-list-card:not([hidden]) h3')).toHaveText('Reconciliation exceptions');
});

test('Today presents one next-action direction and grouped field choices without server reads',async({page})=>{
  await mount(page);
  await page.evaluate(()=>{location.hash='#today';window.YWIWorkspaceOrganization.decorateToday();});
  await expect(page.locator('#todayDirection')).toContainText('What needs attention now');
  await expect(page.locator('#todayDirection')).toContainText('Choose today’s next field action');
  await expect(page.locator('.today-group-heading')).toHaveCount(3);
  expect(await page.evaluate(()=>window.__realFinanceCalls)).toEqual([]);
});

test('I.T. Readiness collapses the long wall into five operator domains while preserving panels',async({page})=>{
  await mount(page);
  await page.evaluate(()=>{location.hash='#it';window.YWIWorkspaceOrganization.decorateIT();});
  await expect(page.locator('.it-readiness-domain')).toHaveCount(5);
  await expect(page.locator('.it-readiness-domain-nav .it-domain-jump')).toHaveCount(5);
  await expect(page.locator('.it-readiness-domain .it-readiness-panel')).toHaveCount(5);
  await expect(page.locator('#itDomain-security')).toHaveAttribute('open','');
});
