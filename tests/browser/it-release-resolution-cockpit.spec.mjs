import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workspaceSource = fs.readFileSync(path.join(process.cwd(),'js/it-system-workspace.js'),'utf8');
const resolutionSource = fs.readFileSync(path.join(process.cwd(),'js/it-release-resolution-cockpit.js'),'utf8');
const schemaFiles = fs.readdirSync(path.join(process.cwd(),'sql')).filter((name)=>/^\d{3}_.+\.sql$/i.test(name));
const CURRENT_SCHEMA = Math.max(...schemaFiles.map((name)=>Number(name.slice(0,3))).filter(Number.isFinite));

async function mountIT(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <main class="container"><section id="it" class="card">
      <div id="itReadinessWorkspace">
        <section id="releaseDeploymentCockpit"><h3>Current release path</h3></section>
        <section><h3>Schema drift</h3></section>
        <section><h3>Admin break-glass access</h3></section>
        <section id="runtimePanel"><h3>Runtime and error health</h3><span id="runtimeMarker">initial</span></section>
        <button id="itReadinessRefresh" type="button">Refresh readiness</button>
      </div>
    </section></main>
  </body></html>`);

  await page.evaluate((CURRENT_SCHEMA)=>{
    window.__refreshes = 0;
    window.__snapshot = {
      interactive_mode:'bounded_runtime',
      source_errors:[],
      summary:{
        overall_status:'red',
        schema_current:true,
        latest_applied_schema_version:CURRENT_SCHEMA,
        expected_schema_version:CURRENT_SCHEMA,
        source_gate_status:'green',
        repository_enforcement_status:'red',
        branch_protection_reported:false,
        source_sha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        workflow_run_id:387,
        github_divergence_evidence_available:true,
        github_compare_status:'ahead',
        release_divergence_status:'development_changes_pending',
        development_sha:'1111111111111111111111111111111111111111',
        production_sha:'2222222222222222222222222222222222222222',
        development_tree_sha:'3333333333333333333333333333333333333333',
        production_tree_sha:'4444444444444444444444444444444444444444',
        development_commits_pending:1,
        production_only_commits:0,
        release_divergence_error:null,
        release_policy_available:true,
        release_policy_status:'classified',
        release_policy_source_authority:'build_246_release_change_policy',
        release_policy_runtime_mode:'read_only_advisory_mirror',
        release_policy_primary_class:'schema_changing',
        release_policy_classes:['schema_changing','finance_sensitive','deployment_sensitive'],
        release_policy_risk_level:'critical',
        release_policy_evidence_profile:'schema_migration_and_dependent_runtime',
        release_policy_manual_review_required:true,
        release_policy_required_gates:['test:promotion-shape','test:staging-runtime-schema','test:finance-posting-preflight','test:browser:performance-budgets'],
        release_policy_changed_file_count:2,
        release_policy_changed_files:['sql/249_example.sql','js/example.js'],
        release_policy_changed_migrations:['249'],
        release_policy_comparison_files_truncated:false,
        release_policy_error:null,
        release_evidence_checklist_available:true,
        release_evidence_checklist_status:'missing',
        release_evidence_checklist_candidate_sha:'1111111111111111111111111111111111111111',
        release_evidence_checklist_workflow_run_id:9100,
        release_evidence_checklist_workflow_run_number:388,
        release_evidence_checklist_workflow_run_attempt:1,
        release_evidence_checklist_workflow_status:'completed',
        release_evidence_checklist_workflow_conclusion:'failure',
        release_evidence_checklist_workflow_completed_at:'2026-09-07T17:00:00Z',
        release_evidence_checklist_age_hours:0.5,
        release_evidence_checklist_fresh_hours:24,
        release_evidence_checklist_counts:{proven:1,missing:2,stale:1,not_applicable:0},
        release_evidence_checklist_items:[
          {gate:'test:promotion-shape',status:'proven',detail:'Gate step completed successfully on the exact current Development SHA within the evidence freshness window.'},
          {gate:'test:staging-runtime-schema',status:'missing',detail:'Required workflow step is failure; success on the exact candidate SHA is required.'},
          {gate:'test:finance-posting-preflight',status:'missing',detail:'Required gate step is not present in the selected canonical workflow evidence.'},
          {gate:'test:browser:performance-budgets',status:'stale',detail:'Gate step succeeded on the exact candidate SHA, but workflow evidence is older than 24 hours.'}
        ],
        release_evidence_checklist_error:null,
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
    window.YWIITReadiness = { getSnapshot:()=>window.__snapshot };
    document.getElementById('itReadinessRefresh').addEventListener('click',()=>{ window.__refreshes += 1; });
  }, CURRENT_SCHEMA);

  await page.addScriptTag({content:workspaceSource});
  await page.addScriptTag({content:resolutionSource});
}

function gateRow(page, gate) {
  return page.locator('.it-system-evidence-list li').filter({hasText:gate});
}

test('Build 249 explains why each selected gate exists and gives status-aware safe corrective actions', async ({page})=>{
  await mountIT(page);

  await expect(page.locator('#itSystemWorkspace')).toBeVisible();
  await expect(page.locator('#itSystemWorkspace')).toHaveAttribute('data-build','248');
  expect(await page.evaluate(()=>window.YWIITReleaseResolutionCockpit?.build)).toBe(249);

  const checklist = page.locator('#releaseEvidenceChecklistCockpit');
  await expect(checklist.locator('.it-system-evidence-list li')).toHaveCount(4);
  await expect(checklist.locator('.it-system-gate-guidance')).toHaveCount(4);
  await expect(page.locator('#releaseResolutionSummary')).toContainText('3 required gates need operator action');
  await expect(page.locator('#releaseResolutionSummary')).toContainText('Guidance never changes evidence state or release authority');

  const proven = gateRow(page,'test:promotion-shape');
  await expect(proven).toContainText('Why required:');
  await expect(proven).toContainText('Development-to-main lineage');
  await expect(proven).toContainText('No corrective action is required');
  await expect(proven).toContainText('rerun only if the candidate SHA changes or the evidence passes the freshness window');

  const schema = gateRow(page,'test:staging-runtime-schema');
  await expect(schema).toContainText('Safe corrective action:');
  await expect(schema).toContainText('Development/staging in canonical migration order');
  await expect(schema).toContainText('Never patch Production ad hoc');

  const finance = gateRow(page,'test:finance-posting-preflight');
  await expect(finance).toContainText('Restore the canonical workflow step for test:finance-posting-preflight');
  await expect(finance).toContainText('do not remove the Build 246 requirement');
  await expect(finance).toContainText('do not enable posting, bypass approvals, or activate a provider');

  const stale = gateRow(page,'test:browser:performance-budgets');
  await expect(stale).toContainText('Re-run the canonical Development workflow on the unchanged candidate SHA');
  await expect(stale).toContainText('Any budget increase requires explicit review');

  const unknown = await page.evaluate(()=>window.YWIITReleaseResolutionCockpit.guidanceFor('test:future-policy-gate','missing'));
  expect(unknown.why).toContain('no gate-specific explanatory entry');
  expect(unknown.action).toContain('Treat the gate as unresolved');
  expect(unknown.action).toContain('Never infer safety from missing guidance');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 249 reapplies guidance after the established readiness source causes Build 248 to rerender', async ({page})=>{
  await mountIT(page);
  await expect(page.locator('.it-system-gate-guidance')).toHaveCount(4);

  await page.evaluate(()=>{
    const summary = window.__snapshot.summary;
    summary.release_evidence_checklist_status='proven';
    summary.release_evidence_checklist_workflow_conclusion='success';
    summary.release_evidence_checklist_counts={proven:4,missing:0,stale:0,not_applicable:0};
    summary.release_evidence_checklist_items = summary.release_evidence_checklist_items.map((item)=>({
      ...item,
      status:'proven',
      detail:'Gate step completed successfully on the exact current Development SHA within the evidence freshness window.'
    }));
    document.getElementById('runtimeMarker').textContent='updated';
  });

  await expect(page.locator('.it-system-gate-guidance')).toHaveCount(4);
  await expect(page.locator('#releaseResolutionSummary')).toContainText('no listed gate needs corrective action');
  await expect(page.locator('[data-evidence-status="proven"]')).toHaveCount(4);
  await expect(gateRow(page,'test:finance-posting-preflight')).toContainText('No corrective action is required');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 249 adds no guidance rows when Build 248 says the candidate checklist is not applicable', async ({page})=>{
  await mountIT(page);

  await page.evaluate(()=>{
    const summary = window.__snapshot.summary;
    summary.release_divergence_status='content_current';
    summary.development_tree_sha='7777777777777777777777777777777777777777';
    summary.production_tree_sha='7777777777777777777777777777777777777777';
    summary.development_commits_pending=0;
    summary.release_policy_available=false;
    summary.release_policy_required_gates=[];
    summary.release_evidence_checklist_status='not_applicable';
    summary.release_evidence_checklist_items=[];
    summary.release_evidence_checklist_counts={proven:0,missing:0,stale:0,not_applicable:0};
    document.getElementById('runtimeMarker').textContent='current';
  });

  await expect(page.locator('#releaseEvidenceChecklistCockpit')).toContainText('NOT APPLICABLE');
  await expect(page.locator('.it-system-gate-guidance')).toHaveCount(0);
  await expect(page.locator('#releaseResolutionSummary')).toHaveCount(0);
});
