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
      <table id="ad_accounting_close_control_table"><tbody>
        <tr><td>Period lock</td><td>Review required</td><td>Finance administrator</td></tr>
      </tbody></table>
      <table id="ad_orders_table"><tbody>
        <tr><td>O-1001</td><td>Client A</td><td>Open</td></tr>
      </tbody></table>
      <table id="ad_accounting_table"><tbody>
        <tr><td>AE-1</td><td>Order</td><td>Draft</td></tr>
        <tr><td>AE-2</td><td>Job</td><td>Review</td></tr>
      </tbody></table>
      <table id="ad_reconciliation_exception_resolution_table"><tbody>
        <tr><td>REC-9</td><td>Exception</td><td>Unmatched bank receipt</td></tr>
      </tbody></table>
      <table id="ad_reconciliation_match_workbench_table"><tbody></tbody></table>
      <table id="ad_accounting_exception_closure_table"><tbody></tbody></table>
      <table id="ad_payment_exception_decision_table"><tbody>
        <tr><td>PAY-2</td><td>Failed</td><td>Manual review required</td></tr>
      </tbody></table>
      <table id="ad_payment_adjustment_workflow_table"><tbody></tbody></table>
      <table id="ad_payment_application_ui_queue_table"><tbody></tbody></table>
      <table id="ad_payment_write_path_table"><tbody></tbody></table>
      <table id="ad_payment_posting_proof_table"><tbody>
        <tr><td>AR mapping</td><td>Review required</td><td>Account mapping not approved</td></tr>
      </tbody></table>
      <table id="ad_bank_csv_import_table"><tbody>
        <tr><td>Review</td><td>bank-sept.csv</td><td>12</td><td>1 duplicate</td></tr>
      </tbody></table>
      <table id="ad_reconciliation_import_validation_table"><tbody></tbody></table>
      <table id="ad_task_table"><tbody>
        <tr><td>P1</td><td>Review bank reconciliation exception</td><td>accounting</td></tr>
        <tr><td>P2</td><td>Account mapping review required</td><td>finance</td></tr>
        <tr><td>P3</td><td>Payroll remittance review required</td><td>finance</td></tr>
        <tr><td>P4</td><td>Accountant export package delivery pending</td><td>finance</td></tr>
        <tr><td>P5</td><td>Confirm route assignment</td><td>operations</td></tr>
      </tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    window.__route=null;
    document.getElementById('ad_accounting_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_accounting_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
    window.YWIRouter={showSection:(route)=>{window.__route=route;}};
  });
  await page.addScriptTag({content:financeSource});
}

test('Build 310 stays dormant outside Finance and Accounting',async({page})=>{
  await mountFinance(page);
  await expect(page.locator('#adminFinanceWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 310 renders fail-closed accounting acceptance before evidence is loaded',async({page})=>{
  await mountFinance(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Finance & Accounting';});
  const host=page.locator('#adminFinanceWorkspace');
  await expect(host).toBeVisible();
  await expect(host).toHaveAttribute('data-build','310');
  await expect(host).toContainText('What prevents accounting from being GREEN?');
  await expect(host).toContainText('does not enable posting, payments, provider mutation, mapping approval');
  await expect(host.locator('.admin-finance-blocker')).toHaveCount(8);
  await expect(host.locator('.admin-finance-status').first()).toContainText('OPEN TO LOAD');
  await expect(host.locator('[data-finance-blocker="mapping"]')).toContainText('Accountant / bookkeeper');
  await expect(host.locator('[data-finance-blocker="accountant-export"]')).toContainText('Accountant-export readiness');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 310 consolidates current Finance blockers with severity owner action and evidence',async({page})=>{
  await mountFinance(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Finance & Accounting';});
  await page.locator('#adminFinanceRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  const host=page.locator('#adminFinanceWorkspace');
  await expect(host.locator('.admin-finance-status').first()).toContainText('ACCOUNTING BLOCKED');
  await expect(host.locator('[data-finance-blocker="control-plane"]')).toContainText('READY');
  await expect(host.locator('[data-finance-blocker="reconciliation"]')).toContainText('BLOCKED');
  await expect(host.locator('[data-finance-blocker="payments"]')).toContainText('BLOCKED');
  await expect(host.locator('[data-finance-blocker="bank-import"]')).toContainText('ACTION');
  await expect(host.locator('[data-finance-blocker="period-close"]')).toContainText('ACTION');
  await expect(host.locator('[data-finance-blocker="remittance"]')).toContainText('ACTION');
  await expect(host.locator('[data-finance-blocker="accountant-export"]')).toContainText('ACTION');
  await expect(host).toContainText('Unknown evidence never produces GREEN');
  await expect(host).toContainText('Corrective action:');
  await expect(host).toContainText('Owner:');
});

test('Build 310 reuses existing Admin and Finance deep links without new write authority',async({page})=>{
  await mountFinance(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Finance & Accounting';});
  await page.locator('[data-admin-finance-key="orders"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Orders and Accounting Stub');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('accounting');

  await page.locator('[data-finance-blocker="mapping"] [data-admin-finance-route="finance"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__route)).toBe('finance');

  await page.locator('[data-finance-blocker="period-close"] [data-admin-finance-panel="Guided Close Center"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Guided Close Center');
});
