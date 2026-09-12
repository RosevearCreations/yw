import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workspaceSource = fs.readFileSync(path.join(process.cwd(),'js/it-system-workspace.js'),'utf8');
const resolutionSource = fs.readFileSync(path.join(process.cwd(),'js/it-release-resolution-cockpit.js'),'utf8');
function migrationVersionFromFilename(name) {
  const match = String(name || '').match(/^(\d+)_.*\.sql$/i);
  return match ? Number(match[1]) : NaN;
}
const schemaVersions = [...new Set(fs.readdirSync(path.join(process.cwd(),'sql'))
  .map(migrationVersionFromFilename)
  .filter(Number.isInteger))]
  .sort((a,b)=>a-b);
const CURRENT_SCHEMA = schemaVersions.at(-1);
const PREVIOUS_SCHEMA = schemaVersions.at(-2);
if (!Number.isInteger(CURRENT_SCHEMA) || !Number.isInteger(PREVIOUS_SCHEMA) || PREVIOUS_SCHEMA >= CURRENT_SCHEMA) {
  throw new Error('Could not derive the latest two repository schemas for release-readiness browser fixtures.');
}

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

  await page.evaluate((data)=>{
    window.__refreshes = 0;
    window.__snapshot = data;
    window.YWIITReadiness = { getSnapshot:()=>window.__snapshot };
    document.getElementById('itReadinessRefresh').addEventListener('click',()=>{ window.__refreshes += 1; });
  }, {
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
      workflow_run_id:391,
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
      release_policy_changed_files:['sql/250_example.sql','js/example.js'],
      release_policy_changed_migrations:['250'],
      release_policy_comparison_files_truncated:false,
      release_policy_error:null,
      release_evidence_checklist_available:true,
      release_evidence_checklist_status:'missing',
      release_evidence_checklist_candidate_sha:'1111111111111111111111111111111111111111',
      release_evidence_checklist_workflow_run_id:9200,
      release_evidence_checklist_workflow_run_number:392,
      release_evidence_checklist_workflow_run_attempt:1,
      release_evidence_checklist_workflow_status:'completed',
      release_evidence_checklist_workflow_conclusion:'failure',
      release_evidence_checklist_workflow_completed_at:'2026-09-07T19:00:00Z',
      release_evidence_checklist_age_hours:0.25,
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
      open_rail_acceptance_count:3,
      open_rail_technical_pending_count:1,
      scorecard_human_pending_count:0,
      scorecard_external_pending_count:0
    }
  });

  await page.addScriptTag({content:workspaceSource});
  await page.addScriptTag({content:resolutionSource});
}

async function triggerSourceRerender(page, marker) {
  await page.evaluate((value)=>{ document.getElementById('runtimeMarker').textContent = value; },marker);
}

test('Build 299 release-readiness migration parser supports variable-width schema filenames', async ()=>{
  expect(migrationVersionFromFilename('999_example.sql')).toBe(999);
  expect(migrationVersionFromFilename('1000_example.sql')).toBe(1000);
  expect(migrationVersionFromFilename('12034_example.sql')).toBe(12034);
  expect(Number.isNaN(migrationVersionFromFilename('schema_1000_example.sql'))).toBe(true);
});

test('Build 250 consolidates release posture and keeps repository enforcement first and fail-closed', async ({page})=>{
  await mountIT(page);

  const summary = page.locator('#releaseReadinessSummary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('data-build','250');
  expect(await page.evaluate(()=>window.YWIITReleaseReadinessSummary?.build)).toBe(250);
  await expect(summary).toContainText('One release posture, one safe next action');
  await expect(summary.locator('.it-system-status')).toHaveText('BLOCKED');
  await expect(summary).toContainText('schema changing · CRITICAL risk');
  await expect(summary).toContainText('1 / 4 proven · 2 missing · 1 stale');
  await expect(summary).toContainText('candidate 111111111111');
  await expect(summary).toContainText('canonical run 392');
  await expect(summary).toContainText('UNPROTECTED');
  await expect(summary).toContainText(`${CURRENT_SCHEMA} / ${CURRENT_SCHEMA} current`);
  await expect(summary).toContainText('3 open acceptance rails · 1 technical pending');
  await expect(summary).toContainText('Settings → Branches');
  await expect(summary).toContainText('main branch protection rule');
  await expect(summary).toContainText('fresh exact-main workflow');
  await expect(summary).toContainText('Advisory summary only');
  await expect(summary).toContainText('does not execute gates, mutate evidence, change repository settings, apply migrations, enable Finance/provider actions, or authorize Production');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 250 advances through schema, exact-SHA gate correction, normal promotion, acceptance and roadmap actions without gaining authority', async ({page})=>{
  await mountIT(page);
  const summary = page.locator('#releaseReadinessSummary');

  await page.evaluate((previousSchema)=>{
    window.__snapshot.summary.repository_enforcement_status='green';
    window.__snapshot.summary.branch_protection_reported=true;
    window.__snapshot.summary.schema_current=false;
    window.__snapshot.summary.latest_applied_schema_version=previousSchema;
  }, PREVIOUS_SCHEMA);
  await triggerSourceRerender(page,'schema-review');
  await expect(summary.locator('.it-system-status')).toHaveText('BLOCKED');
  await expect(summary).toContainText(`${PREVIOUS_SCHEMA} / ${CURRENT_SCHEMA} review`);
  await expect(summary).toContainText('Development/staging in canonical migration order');
  await expect(summary).toContainText('Never patch Production ad hoc');

  await page.evaluate((currentSchema)=>{
    const s=window.__snapshot.summary;
    s.schema_current=true;
    s.latest_applied_schema_version=currentSchema;
    s.release_evidence_checklist_status='missing';
    s.release_evidence_checklist_counts={proven:3,missing:1,stale:0,not_applicable:0};
    s.release_evidence_checklist_items=[
      {gate:'test:promotion-shape',status:'proven',detail:'Gate step completed successfully.'},
      {gate:'test:staging-runtime-schema',status:'proven',detail:'Gate step completed successfully.'},
      {gate:'test:finance-posting-preflight',status:'missing',detail:'Required gate step is not present in the selected canonical workflow evidence.'},
      {gate:'test:browser:performance-budgets',status:'proven',detail:'Gate step completed successfully.'}
    ];
  }, CURRENT_SCHEMA);
  await triggerSourceRerender(page,'gate-missing');
  await expect(summary.locator('.it-system-status')).toHaveText('BLOCKED');
  await expect(summary).toContainText('test:finance-posting-preflight: Restore the canonical workflow step for test:finance-posting-preflight');
  await expect(summary).toContainText('do not remove the Build 246 requirement');
  await expect(summary).toContainText('do not enable posting, bypass approvals, or activate a provider');

  await page.evaluate(()=>{
    const s=window.__snapshot.summary;
    s.release_evidence_checklist_status='proven';
    s.release_evidence_checklist_workflow_conclusion='success';
    s.release_evidence_checklist_counts={proven:4,missing:0,stale:0,not_applicable:0};
    s.release_evidence_checklist_items=s.release_evidence_checklist_items.map((item)=>({...item,status:'proven',detail:'Gate step completed successfully on the exact current Development SHA within the evidence freshness window.'}));
  });
  await triggerSourceRerender(page,'candidate-proven');
  await expect(summary.locator('.it-system-status')).toHaveText('PROMOTION PATH READY');
  await expect(summary).toContainText('4 / 4 proven · 0 missing · 0 stale');
  await expect(summary).toContainText('normal dev → main promotion PR');
  await expect(summary).toContainText('this summary cannot authorize or perform the promotion');

  await page.evaluate(()=>{
    const s=window.__snapshot.summary;
    s.release_divergence_status='content_current';
    s.github_compare_status='identical';
    s.development_commits_pending=0;
    s.development_tree_sha='7777777777777777777777777777777777777777';
    s.production_tree_sha='7777777777777777777777777777777777777777';
    s.release_policy_available=false;
    s.release_policy_required_gates=[];
    s.release_evidence_checklist_available=true;
    s.release_evidence_checklist_status='not_applicable';
    s.release_evidence_checklist_items=[];
    s.release_evidence_checklist_counts={proven:0,missing:0,stale:0,not_applicable:0};
    s.open_rail_acceptance_count=2;
    s.open_rail_technical_pending_count=0;
  });
  await triggerSourceRerender(page,'acceptance-open');
  await expect(summary.locator('.it-system-status')).toHaveText('OPERATIONAL FOLLOW-UP');
  await expect(summary).toContainText('No pending candidate');
  await expect(summary).toContainText('Exact-SHA gate evidenceNot applicable');
  await expect(summary).toContainText('Close the next operational acceptance rail');
  await expect(summary).toContainText('(2 open)');
  await expect(summary).toContainText('Do not auto-close business evidence from this summary');

  await page.evaluate(()=>{
    const s=window.__snapshot.summary;
    s.open_rail_acceptance_count=0;
    s.current_todo_count=0;
  });
  await triggerSourceRerender(page,'all-current');
  await expect(summary.locator('.it-system-status')).toHaveText('CURRENT');
  await expect(summary).toContainText('0 open acceptance rails · 0 technical pending');
  await expect(summary).toContainText('Continue the approved roadmap from Development');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});

test('Build 250 fails open-to-review when the bounded readiness snapshot is unavailable', async ({page})=>{
  await mountIT(page);
  await page.evaluate(()=>{ window.YWIITReadiness = { getSnapshot:()=>null }; });
  await triggerSourceRerender(page,'snapshot-unavailable');

  const summary = page.locator('#releaseReadinessSummary');
  await expect(summary.locator('.it-system-status')).toHaveText('LOAD READINESS');
  await expect(summary).toContainText('Refresh the established I.T. Readiness source before making a release decision');
  await expect(summary).toContainText('Unavailable evidence remains unresolved');
  expect(await page.evaluate(()=>window.__refreshes)).toBe(0);
});
