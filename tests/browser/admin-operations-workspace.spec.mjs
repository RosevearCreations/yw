import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const operationsSource=fs.readFileSync(path.join(process.cwd(),'js/admin-operations-workspace.js'),'utf8');

async function mountOperations(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main><section id="admin" class="card">
      <div id="ad_hub_breadcrumb">Admin / <strong>Admin Home</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_jobs_age_badge" data-status="warning">Not loaded</span>
      <button id="ad_jobs_refresh_panel" type="button">Refresh Jobs</button>
      <div id="ad_ops_dashboard_cards">
        <div class="admin-stat-card"><span>Active Crews</span><strong>2</strong></div>
        <div class="admin-stat-card"><span>Active Staff</span><strong>5</strong></div>
        <div class="admin-stat-card"><span>Delayed Jobs</span><strong>1</strong></div>
      </div>
      <div id="ad_site_activity_summary">Last 24 hours: 4 events, 2 jobs.</div>
      <table id="ad_task_table"><tbody>
        <tr><td>P1</td><td>Review delayed job</td><td>operations</td></tr>
        <tr><td>P2</td><td>Confirm route assignment</td><td>operations</td></tr>
      </tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    document.getElementById('ad_jobs_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_jobs_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
  });
  await page.addScriptTag({content:operationsSource});
}

test('Build 234 stays dormant outside Business and Operations',async({page})=>{
  await mountOperations(page);
  await expect(page.locator('#adminOperationsWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 234 renders a bounded operations overview only after workspace selection',async({page})=>{
  await mountOperations(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Business & Operations';});
  await expect(page.locator('#adminOperationsWorkspace')).toBeVisible();
  await expect(page.locator('#adminOperationsWorkspace')).toHaveAttribute('data-build','234');
  await expect(page.locator('#adminOperationsWorkspace')).toContainText('Start with bounded operating status');
  await expect(page.locator('.admin-ops-metric')).toHaveCount(3);
  await expect(page.locator('.admin-ops-task')).toHaveCount(2);
  await expect(page.locator('.admin-ops-grid .admin-ops-card')).toHaveCount(4);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 234 reuses existing Admin drill-in and refresh controls',async({page})=>{
  await mountOperations(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Business & Operations';});
  await expect(page.locator('#adminOperationsWorkspace')).toBeVisible();

  await page.locator('[data-admin-ops-key="catalog"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Dropdown and Catalog Manager');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('operations');

  await page.locator('#adminOperationsRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.admin-ops-status')).toContainText('CURRENT');
});
