import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const financeSource=fs.readFileSync(path.join(process.cwd(),'js/admin-finance-workspace.js'),'utf8');

async function mount(page,{blocked=false}={}){
  await page.route('https://close316.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><head></head><body>
      <div id="ad_hub_breadcrumb"><strong>Finance &amp; Accounting</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_accounting_age_badge" data-status="ok">Accounting data current</span>
      <button id="ad_accounting_refresh_panel" type="button">Refresh Accounting</button>
      <div id="ad_close_center_summary">${blocked?'1 material close blocker requires review.':'Required close evidence is loaded.'}</div>
      <div id="oc_recon_exception_queue">${blocked?'<article class="oc-recon-exception-card" data-finance-blocker="true" data-close-blocker="true">Critical provider settlement exception · evidence missing · BLOCKS Finance readiness / month-end close</article>':''}</div>
      <table id="ad_close_wizard_detail_table"><tbody>
        <tr><td>Bank reconciliation</td><td>Completed</td><td>Finance</td></tr>
        <tr><td>Tax & payroll</td><td>Completed</td><td>Finance</td></tr>
        <tr><td>Journal review</td><td>Completed</td><td>Finance</td></tr>
        <tr><td>Accountant package</td><td>Confirmed</td><td>Finance</td></tr>
      </tbody></table>
      <table id="ad_accounting_close_control_table"><tbody><tr><td>Period lock</td><td>Closed evidence ready</td><td>Finance administrator</td></tr></tbody></table>
      <table id="ad_accounting_table"><tbody><tr><td>Finance hardening</td><td>Passed</td><td>Provider mutation OFF</td></tr></tbody></table>
      <table id="ad_payment_posting_proof_table"><tbody></tbody></table>
      <table id="ad_payment_exception_decision_table"><tbody></tbody></table>
      <table id="ad_payment_adjustment_workflow_table"><tbody></tbody></table>
      <table id="ad_payment_application_ui_queue_table"><tbody></tbody></table>
      <table id="ad_payment_write_path_table"><tbody></tbody></table>
      <table id="ad_bank_csv_import_table"><tbody></tbody></table>
      <table id="ad_reconciliation_import_validation_table"><tbody></tbody></table>
      <table id="ad_reconciliation_exception_resolution_table"><tbody></tbody></table>
      <table id="ad_reconciliation_match_workbench_table"><tbody></tbody></table>
      <table id="ad_accounting_exception_closure_table"><tbody></tbody></table>
      <table id="ad_orders_table"><tbody></tbody></table>
      <table id="ad_task_table"><tbody></tbody></table>
    </body></html>`});
  });
  await page.goto('https://close316.test/');
  await page.evaluate(()=>{
    window.YWIRouter={showSection:()=>{}};
    window.YWIAdminHub={open:()=>{}};
  });
  await page.addScriptTag({content:financeSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#adminMonthEndCloseCockpit')).toBeVisible();
}

test('Build 316 renders a guided close cockpit when required evidence is clear',async({page})=>{
  await mount(page);
  const cockpit=page.locator('#adminMonthEndCloseCockpit');
  await expect(cockpit).toContainText('Month-End Close Cockpit');
  await expect(cockpit).toContainText('READY FOR SERVER PREVIEW');
  await expect(cockpit).toContainText('Bank reconciliation');
  await expect(cockpit).toContainText('Payment exceptions / A/R-A/P application issues');
  await expect(cockpit).toContainText('Account mappings');
  await expect(cockpit).toContainText('Journal review & posting locks');
  await expect(cockpit).toContainText('Tax & payroll remittances');
  await expect(cockpit).toContainText('Accountant export readiness');
  await expect(cockpit).toContainText('Posting into locked periods remains rejected');
});

test('Build 316 surfaces material provider settlement evidence as a hard-lock blocker',async({page})=>{
  await mount(page,{blocked:true});
  const cockpit=page.locator('#adminMonthEndCloseCockpit');
  await expect(cockpit).toContainText('HARD LOCK BLOCKED');
  await expect(cockpit.locator('[data-close-gate="provider-settlement"]')).toContainText('Critical provider settlement exception');
  await expect(cockpit.locator('[data-close-gate="reconciliation"]')).toContainText('BLOCKED');
  await expect(cockpit).toContainText('Reopening requires Finance approval plus a recorded reason');
});
