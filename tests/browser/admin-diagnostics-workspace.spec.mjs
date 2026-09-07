import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const diagnosticsSource=fs.readFileSync(path.join(process.cwd(),'js/admin-diagnostics-workspace.js'),'utf8');

async function mountDiagnostics(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main><section id="admin" class="card">
      <div id="ad_hub_breadcrumb">Admin / <strong>Admin Home</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_health_age_badge" data-status="warning">Not loaded</span>
      <button id="ad_health_refresh_panel" type="button">Retry Health</button>
      <div id="ad_health_summary">2 health signals need operator review.</div>
      <table id="ad_health_table"><tbody>
        <tr><td>warning</td><td>runtime</td><td>API latency</td><td>Review</td></tr>
        <tr><td>error</td><td>integration</td><td>Webhook retry</td><td>Review</td></tr>
      </tbody></table>
      <div id="ad_smoke_summary">3 smoke checks loaded.</div>
      <table id="ad_smoke_table"><tbody>
        <tr><td>Shell</td><td>pass</td><td>OK</td></tr>
        <tr><td>Runtime config</td><td>pass</td><td>OK</td></tr>
        <tr><td>Bootstrap</td><td>review</td><td>Needs operator review</td></tr>
      </tbody></table>
      <div id="ad_conflict_summary">1 queued conflict.</div>
      <table id="ad_conflicts_table"><tbody>
        <tr><td>Now</td><td>sync</td><td>pending</td><td>payload</td><td>version conflict</td></tr>
      </tbody></table>
      <table id="ad_notifications_table"><tbody>
        <tr><td>1</td><td>email</td><td>Approval needed</td><td>pending review</td></tr>
        <tr><td>2</td><td>email</td><td>Delivery retry</td><td>failed</td></tr>
        <tr><td>3</td><td>email</td><td>Delivered</td><td>sent</td></tr>
      </tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    document.getElementById('ad_health_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_health_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
  });
  await page.addScriptTag({content:diagnosticsSource});
}

test('Build 237 stays dormant outside Diagnostics and Integrations',async({page})=>{
  await mountDiagnostics(page);
  await expect(page.locator('#adminDiagnosticsWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 237 renders bounded diagnostics state only after workspace selection',async({page})=>{
  await mountDiagnostics(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Diagnostics & Integrations';});
  await expect(page.locator('#adminDiagnosticsWorkspace')).toBeVisible();
  await expect(page.locator('#adminDiagnosticsWorkspace')).toHaveAttribute('data-build','237');
  await expect(page.locator('#adminDiagnosticsWorkspace')).toContainText('does not run integrations, deliver notifications, mutate providers');
  await expect(page.locator('.admin-diagnostics-metric')).toHaveCount(4);
  await expect(page.locator('.admin-diagnostics-metric').nth(0)).toContainText('2');
  await expect(page.locator('.admin-diagnostics-metric').nth(1)).toContainText('3');
  await expect(page.locator('.admin-diagnostics-metric').nth(2)).toContainText('1');
  await expect(page.locator('.admin-diagnostics-metric').nth(3)).toContainText('2');
  await expect(page.locator('.admin-diagnostics-grid .admin-diagnostics-card')).toHaveCount(4);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 237 reuses existing diagnostics drill-in and health refresh controls',async({page})=>{
  await mountDiagnostics(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Diagnostics & Integrations';});
  await expect(page.locator('#adminDiagnosticsWorkspace')).toBeVisible();

  await page.locator('[data-admin-diagnostics-key="conflicts"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Conflict Review');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('messaging');

  await page.locator('#adminDiagnosticsRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.admin-diagnostics-status')).toContainText('CURRENT');
});
