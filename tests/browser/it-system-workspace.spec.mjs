import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workspaceSource=fs.readFileSync(path.join(process.cwd(),'js/it-system-workspace.js'),'utf8');

async function mountIT(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <main class="container">
      <section id="it" class="card">
        <div id="itReadinessWorkspace">
          <section id="releaseDeploymentCockpit"><h3>Current release path</h3></section>
          <section><h3>Schema drift</h3></section>
          <section><h3>Edge Function readiness</h3></section>
          <section><h3>Admin break-glass access</h3></section>
          <section id="runtimePanel"><h3>Runtime and error health</h3><span id="runtimeMarker">initial</span></section>
          <button id="itReadinessRefresh" type="button">Refresh readiness</button>
        </div>
      </section>
    </main>
  </body></html>`);
  await page.evaluate(()=>{
    window.__refreshes=0;
    window.__scrolled=null;
    window.__snapshot={
      interactive_mode:'bounded_runtime',
      source_errors:[],
      summary:{
        overall_status:'red',
        schema_current:true,
        latest_applied_schema_version:174,
        expected_schema_version:174,
        source_gate_status:'green',
        repository_enforcement_status:'red',
        branch_protection_reported:false,
        source_sha:'abcdef1234567890',
        workflow_run_id:354,
        admin_access_integrity_blockers:0,
        readiness_blockers:0,
        assertion_blockers:0,
        scorecard_unclassified_open_count:0,
        current_todo_count:0,
        open_rail_acceptance_count:0,
        scorecard_human_pending_count:0,
        scorecard_external_pending_count:0
      }
    };
    Element.prototype.scrollIntoView=function(){ window.__scrolled=this.id || this.querySelector?.('h3')?.textContent || this.textContent || null; };
    window.YWIITReadiness={getSnapshot:()=>window.__snapshot};
    document.getElementById('itReadinessRefresh').addEventListener('click',()=>{
      window.__refreshes+=1;
      window.__snapshot.summary.overall_status='green';
      window.__snapshot.summary.repository_enforcement_status='green';
      window.__snapshot.summary.branch_protection_reported=true;
      document.getElementById('runtimeMarker').textContent='refreshed';
    });
  });
  await page.addScriptTag({content:workspaceSource});
}

test('Build 240 renders bounded I.T. overview with actionable repository remediation',async({page})=>{
  await mountIT(page);
  await expect(page.locator('#itSystemWorkspace')).toBeVisible();
  await expect(page.locator('#itSystemWorkspace')).toHaveAttribute('data-build','240');
  await expect(page.locator('#itSystemWorkspace')).toContainText('does not deploy, change repository protection, mutate database schema, change authentication/roles, run browser smoke');
  await expect(page.locator('.it-system-status')).toContainText('BLOCKED');
  await expect(page.locator('.it-system-metric')).toHaveCount(4);
  await expect(page.locator('.it-system-metric').nth(0)).toContainText('green');
  await expect(page.locator('.it-system-metric').nth(1)).toContainText('red');
  await expect(page.locator('.it-system-metric').nth(2)).toContainText('174 / 174');
  await expect(page.locator('.it-system-metric').nth(3)).toContainText('0');
  await expect(page.locator('.it-system-context')).toContainText('abcdef123456');
  await expect(page.locator('.it-system-context')).toContainText('workflow 354');
  await expect(page.locator('.it-system-grid .it-system-card')).toHaveCount(4);

  const remediation=page.locator('#repositoryEnforcementRemediation');
  await expect(remediation).toBeVisible();
  await expect(remediation).toContainText('Repository enforcement requires manual GitHub action');
  await expect(remediation).toContainText('Settings → Branches');
  await expect(remediation).toContainText('classic branch protection rule targeting main');
  await expect(remediation).toContainText('Require a pull request before merging');
  await expect(remediation).toContainText('force pushes and branch deletion disabled');
  await expect(remediation).toContainText('protected=true');
  await expect(remediation).toContainText('cannot enable branch protection');
  await expect(remediation.locator('li')).toHaveCount(5);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 240 follows I.T. route visibility without creating a second data load',async({page})=>{
  await mountIT(page);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'admin'}})));
  await expect(page.locator('#itSystemWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);

  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'it'}})));
  await expect(page.locator('#itSystemWorkspace')).toBeVisible();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 240 reuses existing I.T. refresh and removes remediation only when repository authority becomes green',async({page})=>{
  await mountIT(page);

  await page.locator('[data-it-system-key="runtime"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__scrolled)).toBe('runtimePanel');

  await expect(page.locator('#repositoryEnforcementRemediation')).toBeVisible();
  await page.locator('#itSystemRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.it-system-status')).toContainText('CURRENT');
  await expect(page.locator('#repositoryEnforcementRemediation')).toHaveCount(0);
});
