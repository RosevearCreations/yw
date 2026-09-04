import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const uiPath=path.resolve(here,'../../js/staging-acceptance-ui.js');
const runId='11111111-1111-4111-8111-111111111111';
const sourceSha='02734b2168511b4faa54bf5f7fdea92b1d8f5b3d';

const baseRail={
  rail_key:'operations_cockpit_live',rail_title:'Operations cockpit write forms',rail_status:'active',progress_percent:94,
  resolution_class:'staging_acceptance',requires_human:true,requires_external:false,
  resolution_note:'Keep open until the Cockpit staging acceptance requested by the rail is actually exercised.',
  run_id:runId,run_key:'staging-b187-ops',suite_name:'build187_operations_cockpit_live_acceptance',
  run_status:'started',source_sha:sourceSha,source_workflow_run_id:33711102071,schema_version:197,
  fixture_set_id:null,fixture_status:null,fixture_label:null,human_signoff_required:true,human_signoff_status:'pending',
  result_count:6,passed_count:5,failed_count:0,blocking_failed_count:0,skipped_count:0,
  staging_acceptance_status:'collecting_evidence',acceptance_complete:false
};
const scenario=(case_key,case_title,verification_mode,evidence_status,human_action_required=false)=>({
  rail_key:'operations_cockpit_live',rail_title:baseRail.rail_title,rail_status:'active',progress_percent:94,
  resolution_class:'staging_acceptance',requires_human:true,requires_external:false,
  case_key,case_title,case_description:`Evidence for ${case_title}.`,evidence_kind:verification_mode==='human'?'manual':'automated',
  verification_mode,is_blocking:true,expected_outcome:`Expected ${case_title}.`,prerequisites:[{kind:'fixture',key:'STAGING only'}],case_sort_order:10,
  run_id:runId,run_key:baseRail.run_key,suite_name:baseRail.suite_name,run_status:'started',source_sha:sourceSha,source_workflow_run_id:33711102071,schema_version:197,
  human_signoff_required:true,human_signoff_status:'pending',case_status:evidence_status==='passed'?'passed':'pending',observed_outcome:evidence_status==='passed'?'passed':null,
  evidence_status,prerequisite_truth:evidence_status==='passed'?'satisfied_by_evidence':'requires_human_staging_evidence',human_action_required
});

const stagingGuard={
  runtime_environment:'staging',actual_project_ref:'stagingprojectref',expected_staging_project_ref:'stagingprojectref',
  configured_production_project_ref:'jmqvkgiqlimdhcofwkxr',registered_environment_class:null,registered_mutation_allowed:null,
  explicit_staging:true,exact_project_ref_match:true,mutation_flag_enabled:true,known_production:false,mutation_allowed:true,
  reason:'Dedicated staging mutation is explicitly enabled.'
};
const productionGuard={
  runtime_environment:'production',actual_project_ref:'jmqvkgiqlimdhcofwkxr',expected_staging_project_ref:null,
  configured_production_project_ref:'jmqvkgiqlimdhcofwkxr',registered_environment_class:'production',registered_mutation_allowed:false,
  explicit_staging:false,exact_project_ref_match:false,mutation_flag_enabled:false,known_production:true,mutation_allowed:false,
  reason:'Production project authority permanently denies staging-acceptance mutation.'
};

const basePayload={
  ok:true,build:'2026-09-04a',schema:197,environment_guard:structuredClone(stagingGuard),
  summary:{rail_count:1,scenario_count:6,accepted_count:0,awaiting_human_count:0,pending_evidence_count:1,human_action_count:1,failed_count:0,assertion_failures:0,business_rail_auto_close:false,staging_mutation_allowed:true,known_production_runtime:false},
  security_assertions:[{assertion_key:'staging_human_signoff_fail_closed',assertion_status:'passed',assertion_detail:'Human approval remains required.'}],
  catalog_assertions:[{assertion_key:'catalog_each_rail_has_human_blocking_case',assertion_status:'passed',assertion_detail:'Human evidence remains blocking.'}],
  environment_assertions:[{assertion_key:'production_project_registered_fail_closed',assertion_status:'passed',assertion_detail:'Production mutation is denied.'}],
  staging_acceptance:[structuredClone(baseRail)],
  scenario_plan:[
    scenario('schema_current','Schema is current','runner','passed'),
    scenario('staging_security_assertions','Staging security assertions pass','runner','passed'),
    scenario('target_rail_visible','Target rail remains human-gated','runner','passed'),
    scenario('operations_cockpit_admin_allowed','Authorized Cockpit load','runner','passed'),
    scenario('operations_cockpit_worker_denied','Lower-rank Cockpit denial','runner','passed'),
    scenario('operations_cockpit_write_form_roundtrip','Cockpit write-form round trip','human','pending_evidence',true),
  ],
  recent_runs:[]
};

async function renderHarness(page,width,height,payload=basePayload){
  await page.setViewportSize({width,height});
  await page.setContent('<!doctype html><html><body><main id="itReadinessWorkspace"><div class="it-readiness-shell"><div class="it-readiness-grid"></div></div></main></body></html>');
  await page.evaluate((incoming)=>{
    window.__stagingPayload=structuredClone(incoming);window.__stagingCalls=[];
    window.YWI_AUTH={getState:()=>({role:'admin',isAuthenticated:true})};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
      jsonFetch:async(name,options)=>{
        window.__stagingCalls.push({name,options});
        const action=options?.body?.action;
        if(action==='record_case'){
          const next=structuredClone(window.__stagingPayload);
          const row=next.scenario_plan.find((item)=>item.case_key===options.body.case_key);
          row.case_status=options.body.decision;row.evidence_status=options.body.decision;row.human_action_required=false;row.observed_outcome=options.body.note;
          next.summary.pending_evidence_count=0;next.summary.human_action_count=0;next.staging_acceptance[0].passed_count=6;
          window.__stagingPayload=next;return {ok:true,build:'2026-09-04a',schema:197,case_result:{case_status:options.body.decision},status:structuredClone(next)};
        }
        if(action==='finalize'){
          const next=structuredClone(window.__stagingPayload);next.staging_acceptance[0].run_status='passed';next.staging_acceptance[0].staging_acceptance_status='awaiting_human_signoff';next.summary.awaiting_human_count=1;next.scenario_plan.forEach((row)=>row.run_status='passed');window.__stagingPayload=next;
          return {ok:true,build:'2026-09-04a',schema:197,finalize:{run_status:'passed',acceptance_status:'awaiting_human_signoff',scorecard_auto_closed:false},status:structuredClone(next)};
        }
        if(action==='signoff'){
          const next=structuredClone(window.__stagingPayload);next.staging_acceptance[0].human_signoff_status='approved';next.staging_acceptance[0].staging_acceptance_status='accepted';next.staging_acceptance[0].acceptance_complete=true;next.summary.accepted_count=1;next.summary.awaiting_human_count=0;window.__stagingPayload=next;
          return {ok:true,build:'2026-09-04a',schema:197,signoff:{acceptance_status:'accepted',scorecard_auto_closed:false},status:structuredClone(next)};
        }
        return structuredClone(window.__stagingPayload);
      }
    };
  },payload);
  await page.addScriptTag({path:uiPath});
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:module-runtime-ready')));
}

test('phone staging runtime exposes catalog prerequisites and explicit human evidence controls',async({page})=>{
  await renderHarness(page,390,844);
  const panel=page.locator('#stagingAcceptancePanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Environment mutation guard: ENABLED');
  await expect(panel).toContainText('6 catalog case(s)');
  await expect(panel).toContainText('Cockpit write-form round trip');
  await expect(panel).toContainText('Prerequisite truth');
  await expect(panel.getByRole('button',{name:'Pass evidence'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Fail evidence'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Finalize evidence run'})).toHaveCount(0);
  const calls=await page.evaluate(()=>window.__stagingCalls || []);
  expect(calls[0].name).toBe('admin-staging-acceptance');expect(calls[0].options.body.action).toBe('status');expect(calls[0].options.requireAuth).toBe(true);
});

test('desktop staging runtime requires human case then finalize then signoff without scorecard auto-close',async({page})=>{
  await renderHarness(page,1280,900);
  page.on('dialog',async(dialog)=>{
    if(dialog.type()==='confirm')await dialog.accept();
    else if(dialog.type()==='prompt')await dialog.accept('Observed in dedicated staging; expected boundary and cleanup verified.');
    else await dialog.dismiss();
  });
  const panel=page.locator('#stagingAcceptancePanel');
  await panel.getByRole('button',{name:'Pass evidence'}).click();
  await expect(panel.getByRole('button',{name:'Finalize evidence run'})).toBeVisible();
  await panel.getByRole('button',{name:'Finalize evidence run'}).click();
  await expect(panel).toContainText('awaiting human signoff');
  await expect(panel.getByRole('button',{name:'Approve evidence'})).toBeVisible();
  await panel.getByRole('button',{name:'Approve evidence'}).click();
  await expect(panel).toContainText('accepted');
  const calls=await page.evaluate(()=>window.__stagingCalls || []);
  const actions=calls.map((call)=>call.options?.body?.action);
  expect(actions).toEqual(['status','record_case','finalize','signoff']);
  const record=calls.find((call)=>call.options?.body?.action==='record_case');
  expect(record.options.body.case_key).toBe('operations_cockpit_write_form_roundtrip');
  expect(record.options.body.decision).toBe('passed');
  const signoff=calls.find((call)=>call.options?.body?.action==='signoff');
  expect(signoff.options.body.run_id).toBe(runId);expect(signoff.options.body.decision).toBe('approved');
  await expect(panel).toContainText('Scorecard completion remains a separate deliberate release action');
});

test('phone Production runtime stays readable but hides all staging mutation controls',async({page})=>{
  const locked=structuredClone(basePayload);
  locked.environment_guard=structuredClone(productionGuard);
  locked.summary.staging_mutation_allowed=false;locked.summary.known_production_runtime=true;
  await renderHarness(page,390,844,locked);
  const panel=page.locator('#stagingAcceptancePanel');
  await expect(panel).toContainText('Environment mutation guard: LOCKED');
  await expect(panel).toContainText('Production project authority permanently denies staging-acceptance mutation.');
  await expect(panel).toContainText('Status/catalog reads remain available');
  await expect(panel.getByRole('button',{name:'Pass evidence'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Fail evidence'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Finalize evidence run'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Approve evidence'})).toHaveCount(0);
  const actions=(await page.evaluate(()=>window.__stagingCalls || [])).map((call)=>call.options?.body?.action);
  expect(actions).toEqual(['status']);
});
