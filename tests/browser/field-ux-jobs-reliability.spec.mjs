import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const todayJs = fs.readFileSync('js/mobile-today.js', 'utf8');

async function mount(page, { width = 390, height = 844, online = true, conflicts = 0 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head></head><body>
    <section id="today"><div id="mobileTodayStatus"></div><div id="mobileTodayGrid"></div><div id="mobileInstallCard"></div></section>
    <section id="jobs"><div class="section-heading"><div><h2>Jobs</h2></div></div><div class="admin-panel-block"><h3>Saved Jobs</h3><div class="table-scroll"><table id="job_list_table"><thead><tr><th>Code</th><th>Name</th><th>Client</th><th>Transaction</th><th>Invoice</th><th>Date</th><th>Duration</th><th>Repeats</th><th>Status</th><th>Financial</th><th>Action</th></tr></thead><tbody>
      <tr data-job-row><td>JOB-100</td><td>North Site</td><td>Acme</td><td>TX-1</td><td>INV-1</td><td>2026-09-04</td><td>4</td><td>No</td><td>planned</td><td>$500</td><td>Open</td></tr>
      <tr data-job-row><td>JOB-200</td><td>South Site</td><td>Beta</td><td>TX-2</td><td>INV-2</td><td>2026-09-05</td><td>8</td><td>No</td><td>in_progress</td><td>$900</td><td>Open</td></tr>
    </tbody></table></div></div></section>
  </body></html>`);
  await page.addScriptTag({ content: `
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>${online ? 'true' : 'false'}});
    window.YWI_AUTH={getState:()=>({role:'admin'})};
    window.YWISecurity={normalizeRole:r=>r,getRoleLabel:()=> 'Admin',canViewSection:()=>true};
    window.YWIRouter={showSection:(name)=>document.body.dataset.route=name};
    window.YWIOutbox={
      getItems:()=>${online ? '[{formType:"incident"}]' : '[{formType:"inspection"}]'},
      getActionItems:()=>[],
      getActionSummary:()=>({total:${conflicts ? 2 : 1},pending:${conflicts ? 1 : 1},conflicts:${conflicts},items:[]})
    };
    window.YWIMobileFormAssist={countDrafts:()=>1,draftSummaries:()=>[{route:'#incident'}]};
  `});
  await page.addScriptTag({ content: todayJs });
  await page.evaluate(() => window.YWIMobileToday.render());
}

test('phone Today exposes queued work and explicit conflict review without auto overwrite', async ({ page }) => {
  await mount(page, { width: 390, height: 844, conflicts: 1 });
  await expect(page.locator('#fieldSyncHealth')).toHaveAttribute('data-sync-state', 'conflict');
  await expect(page.getByText('Review conflict before retrying.')).toBeVisible();
  await expect(page.getByText('Queued forms').locator('..').getByText('1')).toBeVisible();
  await expect(page.getByText('Conflicts').locator('..').getByText('1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review conflicts' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Jobs' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('offline Today clearly distinguishes retained local work from server confirmation', async ({ page }) => {
  await mount(page, { width: 430, height: 932, online: false });
  await expect(page.locator('#fieldSyncHealth')).toHaveAttribute('data-sync-state', 'offline');
  await expect(page.getByText('Offline — local work retained')).toBeVisible();
  await expect(page.getByText(/Sign-in, uploads and live reads may remain unavailable/)).toBeVisible();
});

test('desktop Jobs workbench filters presentation only and keeps full navigation-sized controls', async ({ page }) => {
  await mount(page, { width: 1366, height: 768 });
  const workbench = page.locator('#jobsDesktopWorkbench');
  await expect(workbench).toBeVisible();
  await expect(page.locator('#jobs')).toHaveAttribute('data-desktop-workbench-ready', '1');
  await page.locator('.job-workbench-search').fill('Beta');
  await expect(page.locator('#job_list_table tbody tr:not([hidden])')).toHaveCount(1);
  await expect(page.getByText('1 of 2 jobs shown')).toBeVisible();
  await page.locator('.job-workbench-search').fill('');
  await page.locator('.job-workbench-status').selectOption('planned');
  await expect(page.locator('#job_list_table tbody tr:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#job_list_table tbody tr:not([hidden])')).toContainText('JOB-100');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#job_list_table tbody tr:not([hidden])')).toHaveCount(2);
  const buttonHeight = await page.getByRole('button', { name: 'Clear filters' }).evaluate(el => el.getBoundingClientRect().height);
  expect(buttonHeight).toBeGreaterThanOrEqual(44);
});

test('desktop Jobs sync banner tells operators filtering never changes job records', async ({ page }) => {
  await mount(page, { width: 1440, height: 960 });
  await expect(page.locator('#jobsSyncHealth')).toBeVisible();
  await expect(page.getByText(/filtering never changes job records/i)).toBeVisible();
});
