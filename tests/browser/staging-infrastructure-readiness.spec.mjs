import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../..');
const uiPath=path.resolve(repoRoot,'js/staging-acceptance-ui.js');
const runId='22222222-2222-4222-8222-222222222222';

const currentSchemaAuthority={
  expected_schema_version:201,latest_applied_schema_version:201,drift_status:'current',exact_schema_match:true,
  minimum_schema:197,message:'Runtime schema is current.',checked_at:'2026-09-04T20:00:00Z'
};

function payloadFor(environmentGuard){
  return {
    ok:false,build:'build214-proof',schema:201,minimum_schema:197,
    schema_authority:structuredClone(currentSchemaAuthority),
    environment_guard:structuredClone(environmentGuard),
    summary:{
      rail_count:1,scenario_count:1,accepted_count:0,awaiting_human_count:0,pending_evidence_count:1,human_action_count:1,
      failed_count:0,assertion_failures:1,schema_current:true,business_rail_auto_close:false,staging_mutation_allowed:false,
      known_production_runtime:environmentGuard.known_production===true
    },
    security_assertions:[],catalog_assertions:[],schema_assertions:[{assertion_key:'staging_runtime_schema_current',assertion_status:'passed',assertion_detail:'Runtime schema is current.'}],
    environment_assertions:[{assertion_key:'staging_environment_runtime',assertion_status:'failed',assertion_detail:environmentGuard.reason}],
    staging_acceptance:[{
      rail_key:'operations_cockpit_live',rail_title:'Operations cockpit write forms',rail_status:'active',progress_percent:94,
      resolution_class:'staging_acceptance',requires_human:true,requires_external:false,
      resolution_note:'Source-ready candidate; dedicated non-production staging evidence is still required.',
      run_id:runId,run_key:'build214-environment-proof',suite_name:'staging_infrastructure_readiness',run_status:'started',
      source_sha:'4be781d794625b7df6be2eaa4e050b0a27e84c80',source_workflow_run_id:33914183726,schema_version:201,
      human_signoff_required:true,human_signoff_status:'pending',staging_acceptance_status:'collecting_evidence',acceptance_complete:false
    }],
    scenario_plan:[{
      rail_key:'operations_cockpit_live',rail_title:'Operations cockpit write forms',rail_status:'active',progress_percent:94,
      resolution_class:'staging_acceptance',requires_human:true,requires_external:false,
      case_key:'operations_cockpit_write_form_roundtrip',case_title:'Cockpit write-form round trip',
      case_description:'Human staging evidence remains required even when the source scenario is ready.',evidence_kind:'manual',verification_mode:'human',
      is_blocking:true,expected_outcome:'Exercise the write form only in dedicated non-production staging.',prerequisites:[{kind:'environment',key:'dedicated non-production staging'}],
      case_sort_order:10,run_id:runId,run_key:'build214-environment-proof',suite_name:'staging_infrastructure_readiness',run_status:'started',
      source_sha:'4be781d794625b7df6be2eaa4e050b0a27e84c80',source_workflow_run_id:33914183726,schema_version:201,
      human_signoff_required:true,human_signoff_status:'pending',case_status:'pending',observed_outcome:null,evidence_status:'pending_evidence',
      prerequisite_truth:'requires_human_staging_evidence',human_action_required:true
    }],
    recent_runs:[]
  };
}

async function renderHarness(page,payload,width=1280,height=900){
  await page.setViewportSize({width,height});
  await page.setContent('<!doctype html><html><body><main id="itReadinessWorkspace"><div class="it-readiness-shell"><div class="it-readiness-grid"></div></div></main></body></html>');
  await page.evaluate((incoming)=>{
    window.__stagingPayload=structuredClone(incoming);window.__stagingCalls=[];
    window.YWI_AUTH={getState:()=>({role:'admin',isAuthenticated:true})};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
      jsonFetch:async(name,options)=>{
        window.__stagingCalls.push({name,options});
        return structuredClone(window.__stagingPayload);
      }
    };
  },payload);
  await page.addScriptTag({path:uiPath});
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:module-runtime-ready')));
}

async function expectNoMutationControls(panel){
  await expect(panel.getByRole('button',{name:'Pass evidence'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Fail evidence'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Finalize evidence run'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Approve evidence'})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Reject evidence'})).toHaveCount(0);
}

test('source-ready rail stays non-runnable when staging runtime is unconfigured',async({page})=>{
  const guard={
    runtime_environment:'unconfigured',actual_project_ref:'nonproduction-but-unconfigured',expected_staging_project_ref:null,
    configured_production_project_ref:'jmqvkgiqlimdhcofwkxr',registered_environment_class:null,registered_mutation_allowed:null,
    explicit_staging:false,exact_project_ref_match:false,mutation_flag_enabled:false,known_production:false,mutation_allowed:false,
    reason:'YWI_RUNTIME_ENVIRONMENT must be exactly staging for acceptance mutation.'
  };
  await renderHarness(page,payloadFor(guard),390,844);
  const panel=page.locator('#stagingAcceptancePanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Environment mutation guard: LOCKED');
  await expect(panel).toContainText('Runtime unconfigured');
  await expect(panel).toContainText('expected staging project not configured');
  await expect(panel).toContainText('Cockpit write-form round trip');
  await expect(panel).toContainText('Status/catalog reads remain available');
  await expect(panel).toContainText('Runtime schema authority: CURRENT');
  await expectNoMutationControls(panel);
  const actions=(await page.evaluate(()=>window.__stagingCalls || [])).map((call)=>call.options?.body?.action);
  expect(actions).toEqual(['status']);
});

test('staging label with a mismatched project ref remains locked',async({page})=>{
  const guard={
    runtime_environment:'staging',actual_project_ref:'staging-project-a',expected_staging_project_ref:'staging-project-b',
    configured_production_project_ref:'jmqvkgiqlimdhcofwkxr',registered_environment_class:null,registered_mutation_allowed:null,
    explicit_staging:true,exact_project_ref_match:false,mutation_flag_enabled:true,known_production:false,mutation_allowed:false,
    reason:'The runtime project ref does not match YWI_STAGING_PROJECT_REF.'
  };
  await renderHarness(page,payloadFor(guard));
  const panel=page.locator('#stagingAcceptancePanel');
  await expect(panel).toContainText('Environment mutation guard: LOCKED');
  await expect(panel).toContainText('current project staging-project-a');
  await expect(panel).toContainText('expected staging project staging-project-b');
  await expect(panel).toContainText('The runtime project ref does not match YWI_STAGING_PROJECT_REF.');
  await expectNoMutationControls(panel);
  const actions=(await page.evaluate(()=>window.__stagingCalls || [])).map((call)=>call.options?.body?.action);
  expect(actions).toEqual(['status']);
});
