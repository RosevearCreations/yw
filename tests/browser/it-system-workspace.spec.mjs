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
        latest_applied_schema_version:244,
        expected_schema_version:244,
        source_gate_status:'green',
        repository_enforcement_status:'red',
        branch_protection_reported:false,
        source_sha:'abcdef1234567890abcdef1234567890abcdef12',
        workflow_run_id:373,
        github_divergence_evidence_available:true,
        github_compare_status:'diverged',
        release_divergence_status:'development_changes_pending',
        development_sha:'1111111111111111111111111111111111111111',
        production_sha:'2222222222222222222222222222222222222222',
        development_tree_sha:'3333333333333333333333333333333333333333',
        production_tree_sha:'4444444444444444444444444444444444444444',
        development_commits_pending:2,
        production_only_commits:1,
        release_divergence_error:null,
        release_policy_available:true,
        release_policy_status:'classified',
        release_policy_source_authority:'build_246_release_change_policy',
        release_policy_runtime_mode:'read_only_advisory_mirror',
        release_policy_primary_class:'schema_changing',
        release_policy_classes:['schema_changing'],
        release_policy_risk_level:'critical',
        release_policy_evidence_profile:'schema_migration_and_dependent_runtime',
        release_policy_manual_review_required:true,
        release_policy_required_gates:['test:promotion-shape','test:repository-protection-preflight','test:staging-acceptance','test:staging-runtime-schema','test:current-schema-staging-runbook','test:finance-schema-dependencies'],
        release_policy_changed_file_count:2,
        release_policy_changed_files:['sql/208_example.sql','js/admin.js'],
        release_policy_changed_migrations:['208'],
        release_policy_comparison_files_truncated:false,
        release_policy_error:null,
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
      const summary=window.__snapshot.summary;
      summary.overall_status='green';
      summary.repository_enforcement_status='green';
      summary.branch_protection_reported=true;
      summary.release_divergence_status='content_current';
      summary.development_sha='5555555555555555555555555555555555555555';
      summary.production_sha='6666666666666666666666666666666666666666';
      summary.development_tree_sha='7777777777777777777777777777777777777777';
      summary.production_tree_sha='7777777777777777777777777777777777777777';
      summary.development_commits_pending=0;
      summary.production_only_commits=1;
      summary.github_compare_status='behind';
      summary.release_policy_available=false;
      summary.release_policy_status='no_pending_candidate';
      summary.release_policy_primary_class=null;
      summary.release_policy_classes=[];
      summary.release_policy_risk_level=null;
      summary.release_policy_evidence_profile=null;
      summary.release_policy_manual_review_required=false;
      summary.release_policy_required_gates=[];
      summary.release_policy_changed_file_count=0;
      summary.release_policy_changed_files=[];
      summary.release_policy_changed_migrations=[];
      summary.release_policy_error=null;
      document.getElementById('runtimeMarker').textContent='refreshed';
    });
  });
  await page.addScriptTag({content:workspaceSource});
}

test('Build 247 renders divergence plus Build 246 release class, risk, evidence profile and mandatory gates without expanding authority',async({page})=>{
  await mountIT(page);
  await expect(page.locator('#itSystemWorkspace')).toBeVisible();
  await expect(page.locator('#itSystemWorkspace')).toHaveAttribute('data-build','247');
  await expect(page.locator('#itSystemWorkspace')).toContainText('does not deploy, change repository protection, mutate database schema, change authentication/roles, run browser smoke, authorize Production');
  await expect(page.locator('.it-system-status').first()).toContainText('BLOCKED');
  await expect(page.locator('.it-system-metric')).toHaveCount(4);
  await expect(page.locator('.it-system-metric').nth(0)).toContainText('green');
  await expect(page.locator('.it-system-metric').nth(1)).toContainText('red');
  await expect(page.locator('.it-system-metric').nth(2)).toContainText('244 / 244');
  await expect(page.locator('.it-system-context')).toContainText('abcdef123456');
  await expect(page.locator('.it-system-context')).toContainText('workflow 373');

  const divergence=page.locator('#releaseDivergenceCockpit');
  await expect(divergence).toBeVisible();
  await expect(divergence).toContainText('2 DEV COMMITS PENDING');
  await expect(divergence).toContainText('111111111111');
  await expect(divergence).toContainText('222222222222');
  await expect(divergence).toContainText('tree 333333333333');
  await expect(divergence).toContainText('tree 444444444444');
  await expect(divergence).toContainText('diverged · +2 dev / +1 main-only');
  await expect(divergence).toContainText('CURRENT 244 / 244');
  await expect(divergence).toContainText('Build 244 release-candidate manifest contract');
  await expect(divergence).toContainText('Repository enforcement is not GREEN');
  await expect(divergence).toContainText('Enable and verify main branch protection');
  await expect(divergence).toContainText('descriptive evidence only');

  const policy=page.locator('#releaseClassificationCockpit');
  await expect(policy).toBeVisible();
  await expect(policy).toContainText('CRITICAL RISK');
  await expect(policy).toContainText('Detected class');
  await expect(policy).toContainText('schema changing');
  await expect(policy).toContainText('Evidence profile');
  await expect(policy).toContainText('schema migration and dependent runtime');
  await expect(policy).toContainText('2 files');
  await expect(policy).toContainText('Migration: 208');
  await expect(policy).toContainText('Mandatory gates before promotion');
  await expect(policy).toContainText('test:staging-runtime-schema');
  await expect(policy).toContainText('test:finance-schema-dependencies');
  await expect(policy).toContainText('build_246_release_change_policy');
  await expect(policy).toContainText('read only advisory mirror');
  await expect(policy).toContainText('cannot run or mark gates passed');
  await expect(policy.locator('.it-system-policy-gates li')).toHaveCount(6);

  const remediation=page.locator('#repositoryEnforcementRemediation');
  await expect(remediation).toBeVisible();
  await expect(remediation).toContainText('Settings → Branches');
  await expect(remediation).toContainText('protected=true');
  await expect(remediation.locator('li')).toHaveCount(5);
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 247 follows I.T. route visibility without creating a second browser data load',async({page})=>{
  await mountIT(page);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'admin'}})));
  await expect(page.locator('#itSystemWorkspace')).toBeHidden();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);

  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'it'}})));
  await expect(page.locator('#itSystemWorkspace')).toBeVisible();
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 247 reuses readiness refresh and removes candidate classification when dev/main content is current',async({page})=>{
  await mountIT(page);

  await page.locator('[data-it-system-key="runtime"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__scrolled)).toBe('runtimePanel');

  await expect(page.locator('#repositoryEnforcementRemediation')).toBeVisible();
  await page.locator('#itSystemRefresh').click();
  await expect.poll(async()=>page.evaluate(()=>window.__refreshes)).toBe(1);
  await expect(page.locator('.it-system-status').first()).toContainText('CURRENT');
  await expect(page.locator('#repositoryEnforcementRemediation')).toHaveCount(0);
  const divergence=page.locator('#releaseDivergenceCockpit');
  await expect(divergence).toContainText('IN SYNC BY CONTENT');
  await expect(divergence).toContainText('tree 777777777777');
  await expect(divergence).toContainText('No source-content promotion hold');
  await expect(divergence).toContainText('No source-content promotion is pending');
  const policy=page.locator('#releaseClassificationCockpit');
  await expect(policy).toContainText('NO PENDING CANDIDATE');
  await expect(policy).toContainText('there is no candidate diff to classify');
  await expect(policy.locator('.it-system-policy-gates')).toHaveCount(0);
});

test('Build 247 treats unavailable GitHub comparison and policy evidence as unknown rather than synchronized or safe',async({page})=>{
  await mountIT(page);
  await page.evaluate(()=>{
    const summary=window.__snapshot.summary;
    summary.repository_enforcement_status='green';
    summary.branch_protection_reported=true;
    summary.github_divergence_evidence_available=false;
    summary.release_divergence_status='evidence_unavailable';
    summary.release_divergence_error='GitHub compare returned HTTP 403.';
    summary.release_policy_available=false;
    summary.release_policy_status='evidence_unavailable';
    summary.release_policy_error='Live GitHub comparison is unavailable; release classification is unavailable by design.';
    window.YWIITSystemWorkspace.render();
  });
  const divergence=page.locator('#releaseDivergenceCockpit');
  await expect(divergence).toContainText('GITHUB EVIDENCE UNAVAILABLE');
  await expect(divergence).toContainText('GitHub compare returned HTTP 403.');
  await expect(divergence).toContainText('do not infer synchronization');
  await expect(divergence).toContainText('Refresh existing I.T. Readiness');
  const policy=page.locator('#releaseClassificationCockpit');
  await expect(policy).toContainText('CLASSIFICATION UNAVAILABLE');
  await expect(policy).toContainText('release classification is unavailable by design');
  await expect(policy).toContainText('never implies a source-only or safe release');
});

test('Build 247 holds a pending Development candidate when changed-file classification evidence is incomplete',async({page})=>{
  await mountIT(page);
  await page.evaluate(()=>{
    const summary=window.__snapshot.summary;
    summary.repository_enforcement_status='green';
    summary.branch_protection_reported=true;
    summary.release_policy_available=false;
    summary.release_policy_status='changed_file_evidence_unavailable';
    summary.release_policy_error='Development commits are pending but GitHub returned no changed-file evidence; release classification cannot infer a safe class.';
    window.YWIITSystemWorkspace.render();
  });
  const divergence=page.locator('#releaseDivergenceCockpit');
  await expect(divergence).toContainText('classification evidence is incomplete; do not promote');
  await expect(divergence).toContainText('Restore complete changed-file evidence before any Production promotion');
  const policy=page.locator('#releaseClassificationCockpit');
  await expect(policy).toContainText('CLASSIFICATION UNAVAILABLE');
  await expect(policy).toContainText('cannot infer a safe class');
});
