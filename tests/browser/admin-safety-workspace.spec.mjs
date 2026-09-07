import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const safetySource=fs.readFileSync(path.join(process.cwd(),'js/admin-safety-workspace.js'),'utf8');

async function mountSafety(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main><section id="admin" class="card">
      <div id="ad_hub_breadcrumb">Admin / <strong>Admin Home</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_evidence_age_badge" data-status="warning">Not loaded</span>
      <button id="ad_evidence_refresh_panel" type="button">Refresh Evidence</button>
      <div id="ad_evidence_summary">2 evidence items require review.</div>
      <table id="ad_evidence_manager_table"><tbody>
        <tr><td>Review</td><td>Photo A</td><td>HSE</td><td>Supervisor</td><td>Now</td><td>Open</td></tr>
        <tr><td>Ready</td><td>Packet B</td><td>Toolbox</td><td>HSE</td><td>Now</td><td>Open</td></tr>
      </tbody></table>
      <table id="ad_evidence_action_queue_table"><tbody><tr><td>Open</td><td>Corrective follow-up</td></tr></tbody></table>
      <table id="ad_attendance_evidence_table"><tbody><tr><td>Now</td><td>Employee</td><td>Job</td><td>Clock-in</td><td>OK</td><td>Review</td><td>Open</td></tr></tbody></table>
      <table id="ad_hse_evidence_table"><tbody><tr><td>Now</td><td>Packet</td><td>Work start</td><td>Photo</td><td>Proof</td><td>Review</td><td>Open</td></tr></tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    document.getElementById('ad_evidence_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_evidence_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
  });
  await page.addScriptTag({content:safetySource});
}

test('Build 235 stays dormant outside Safety and Evidence',async({page})=>{
  await mountSafety(page);
  await expect(page.locator('#adminSafetyWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 235 renders bounded evidence status after safety workspace selection',async({page})=>{
  await mountSafety(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Safety & Evidence';});
  await expect(page.locator('#adminSafetyWorkspace')).toBeVisible();
  await expect(page.locator('#adminSafetyWorkspace')).toHaveAttribute('data-build','235');
  await expect(page.locator('#adminSafetyWorkspace')).toContainText('Start with bounded safety/evidence status');
  await expect(page.locator('.admin-safety-metric')).toHaveCount(4);
  await expect(page.locator('.admin-safety-grid .admin-safety-card')).toHaveCount(4);
  await expect(page.locator('#adminSafetyWorkspace')).toContainText('2 evidence items require review.');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 235 reuses existing safety drill-in and refresh controls',async({page})=>{
  await mountSafety(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Safety & Evidence';});
  await expect(page.locator('#adminSafetyWorkspace')).toBeVisible();

  await page.locator('[data-admin-safety-key="ohsa"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Ontario OHSA / Workplace Safety Hub');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('safety');

  await page.locator('#adminSafetyRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.admin-safety-status')).toContainText('CURRENT');
});
