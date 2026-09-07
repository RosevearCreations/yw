import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const financeSource=fs.readFileSync(path.join(process.cwd(),'js/admin-finance-workspace.js'),'utf8');

async function mountFinance(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main><section id="admin" class="card">
      <div id="ad_hub_breadcrumb">Admin / <strong>Admin Home</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_accounting_age_badge" data-status="warning">Not loaded</span>
      <button id="ad_accounting_refresh_panel" type="button">Retry Accounting</button>
      <div id="ad_close_center_summary">2 close blockers require review before period close.</div>
      <table id="ad_close_wizard_detail_table"><tbody>
        <tr><td>Bank reconciliation</td><td>Review</td><td>Finance</td></tr>
        <tr><td>Sales tax</td><td>Open</td><td>Finance</td></tr>
      </tbody></table>
      <table id="ad_orders_table"><tbody>
        <tr><td>O-1001</td><td>Client A</td><td>Open</td></tr>
      </tbody></table>
      <table id="ad_accounting_table"><tbody>
        <tr><td>AE-1</td><td>Order</td><td>Draft</td></tr>
        <tr><td>AE-2</td><td>Job</td><td>Review</td></tr>
      </tbody></table>
      <table id="ad_task_table"><tbody>
        <tr><td>P1</td><td>Review bank reconciliation exception</td><td>accounting</td></tr>
        <tr><td>P2</td><td>Confirm route assignment</td><td>operations</td></tr>
      </tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    document.getElementById('ad_accounting_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_accounting_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
  });
  await page.addScriptTag({content:financeSource});
}

test('Build 236 stays dormant outside Finance and Accounting',async({page})=>{
  await mountFinance(page);
  await expect(page.locator('#adminFinanceWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 236 renders bounded finance state only after workspace selection',async({page})=>{
  await mountFinance(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Finance & Accounting';});
  await expect(page.locator('#adminFinanceWorkspace')).toBeVisible();
  await expect(page.locator('#adminFinanceWorkspace')).toHaveAttribute('data-build','236');
  await expect(page.locator('#adminFinanceWorkspace')).toContainText('does not enable posting, payments, provider mutation');
  await expect(page.locator('.admin-finance-metric')).toHaveCount(4);
  await expect(page.locator('.admin-finance-metric').nth(0)).toContainText('2');
  await expect(page.locator('.admin-finance-metric').nth(1)).toContainText('1');
  await expect(page.locator('.admin-finance-metric').nth(2)).toContainText('2');
  await expect(page.locator('.admin-finance-metric').nth(3)).toContainText('1');
  await expect(page.locator('.admin-finance-grid .admin-finance-card')).toHaveCount(4);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 236 reuses existing accounting drill-in and refresh controls',async({page})=>{
  await mountFinance(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Finance & Accounting';});
  await expect(page.locator('#adminFinanceWorkspace')).toBeVisible();

  await page.locator('[data-admin-finance-key="orders"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Orders and Accounting Stub');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('accounting');

  await page.locator('#adminFinanceRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.admin-finance-status')).toContainText('CURRENT');
});
