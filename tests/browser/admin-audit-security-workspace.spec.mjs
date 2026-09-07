import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const auditSource=fs.readFileSync(path.join(process.cwd(),'js/admin-audit-security-workspace.js'),'utf8');

async function mountAudit(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main><section id="admin" class="card">
      <div id="ad_hub_breadcrumb">Admin / <strong>Admin Home</strong></div>
      <div id="ad_hub_workspace_heading"></div>
      <span id="ad_health_age_badge" data-status="warning">Not loaded</span>
      <button id="ad_health_refresh_panel" type="button">Retry Health</button>
      <table id="ad_schema_preflight_table"><tbody>
        <tr><td>Database</td><td>schema</td><td>Ready</td><td>None</td><td>Low</td></tr>
      </tbody></table>
      <table id="ad_readiness_table"><tbody>
        <tr><td>Security</td><td>Role enforcement</td><td>Ready</td><td>None</td></tr>
        <tr id="readinessReview"><td>Release</td><td>Repository protection</td><td>Review</td><td>Enable protection</td></tr>
      </tbody></table>
      <table id="ad_permissions_table"><tbody>
        <tr><td>admin</td><td>manage</td><td>allowed</td></tr>
        <tr><td>job_admin</td><td>view</td><td>allowed</td></tr>
      </tbody></table>
      <table id="ad_action_permission_table"><tbody>
        <tr><td>admin</td><td>release review</td><td>allowed</td></tr>
      </tbody></table>
      <table id="ad_deployment_gate_table"><tbody>
        <tr><td>Source gate</td><td>Ready</td><td>Current</td></tr>
      </tbody></table>
      <table id="ad_backup_rehearsal_table"><tbody>
        <tr><td>Complete</td><td>Restore rehearsal</td><td>Admin</td><td>Passed</td><td>None</td></tr>
      </tbody></table>
      <table id="ad_audit_log_table"><tbody>
        <tr><td>Now</td><td>Admin</td><td>Updated</td><td>Profile</td><td>Role review</td></tr>
        <tr><td>Earlier</td><td>Admin</td><td>Reviewed</td><td>Release</td><td>Gate evidence</td></tr>
      </tbody></table>
    </section></main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__open=null;
    window.__scrolled=null;
    Element.prototype.scrollIntoView=function(){ window.__scrolled=this.id || null; };
    document.getElementById('ad_health_refresh_panel').addEventListener('click',()=>{
      window.__refreshes+=1;
      const badge=document.getElementById('ad_health_age_badge');
      badge.dataset.status='ok';
      badge.textContent='Current';
      document.querySelector('#readinessReview td:nth-child(3)').textContent='Ready';
      document.querySelector('#readinessReview td:nth-child(4)').textContent='None';
    });
    window.YWIAdminHub={open:(section,options)=>{window.__open={section,options};}};
  });
  await page.addScriptTag({content:auditSource});
}

test('Build 238 stays dormant outside Audit and Security',async({page})=>{
  await mountAudit(page);
  await expect(page.locator('#adminAuditSecurityWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 238 renders bounded audit and security state only after workspace selection',async({page})=>{
  await mountAudit(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Audit & Security';});
  await expect(page.locator('#adminAuditSecurityWorkspace')).toBeVisible();
  await expect(page.locator('#adminAuditSecurityWorkspace')).toHaveAttribute('data-build','238');
  await expect(page.locator('#adminAuditSecurityWorkspace')).toContainText('does not change permissions, security settings, deployment state, backup/restore state');
  await expect(page.locator('.admin-audit-status')).toContainText('NEEDS REVIEW');
  await expect(page.locator('.admin-audit-metric')).toHaveCount(4);
  await expect(page.locator('.admin-audit-metric').nth(0)).toContainText('2');
  await expect(page.locator('.admin-audit-metric').nth(1)).toContainText('2');
  await expect(page.locator('.admin-audit-metric').nth(2)).toContainText('1');
  await expect(page.locator('.admin-audit-metric').nth(3)).toContainText('2');
  await expect(page.locator('.admin-audit-context')).toContainText('1 loaded item currently indicate review');
  await expect(page.locator('.admin-audit-context')).toContainText('1 rehearsal record currently loaded');
  await expect(page.locator('.admin-audit-grid .admin-audit-card')).toHaveCount(4);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 238 reuses existing readiness drill-in and refresh controls',async({page})=>{
  await mountAudit(page);
  await page.evaluate(()=>{document.querySelector('#ad_hub_breadcrumb strong').textContent='Audit & Security';});
  await expect(page.locator('#adminAuditSecurityWorkspace')).toBeVisible();

  await page.locator('[data-admin-audit-key="audit"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__open?.options?.panelTitle)).toBe('Production Readiness and Permissions');
  expect(await page.evaluate(()=>window.__open?.section)).toBe('readiness');
  await expect.poll(async()=>page.evaluate(()=>window.__scrolled)).toBe('ad_audit_log_table');

  await page.locator('#adminAuditSecurityRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.admin-audit-status')).toContainText('CURRENT');
});
