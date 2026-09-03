import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const uiPath=path.resolve(here,'../../js/staging-acceptance-ui.js');

const basePayload={
  ok:true,build:'2026-09-02r',schema:186,
  summary:{rail_count:1,accepted_count:0,awaiting_human_count:1,failed_count:0,assertion_failures:0,business_rail_auto_close:false},
  security_assertions:[
    {assertion_key:'staging_human_signoff_fail_closed',assertion_status:'passed',assertion_detail:'Human approval remains required.'}
  ],
  staging_acceptance:[{
    rail_key:'operations_cockpit_live',rail_title:'Operations Cockpit staging acceptance',rail_status:'active',progress_percent:90,
    resolution_class:'staging_acceptance',requires_human:true,requires_external:false,
    resolution_note:'Keep open until Operations Cockpit staging acceptance is explicitly reviewed.',
    run_id:'11111111-1111-4111-8111-111111111111',run_key:'staging-b186-ops',suite_name:'build186_operations_cockpit_acceptance',
    run_status:'passed',source_sha:'d126ddfb403d31faba1d9826df3e0ad1e0d58fd7',source_workflow_run_id:33705924533,schema_version:186,
    fixture_set_id:null,fixture_status:null,fixture_label:null,human_signoff_required:true,human_signoff_status:'pending',
    result_count:5,passed_count:5,failed_count:0,blocking_failed_count:0,skipped_count:0,
    staging_acceptance_status:'awaiting_human_signoff',acceptance_complete:false
  }],
  recent_runs:[]
};

async function renderHarness(page,width,height){
  await page.setViewportSize({width,height});
  await page.setContent(`<!doctype html><html><body>
    <main id="itReadinessWorkspace"><div class="it-readiness-shell"><div class="it-readiness-grid"></div></div></main>
  </body></html>`);
  await page.evaluate((payload)=>{
    window.YWI_AUTH={getState:()=>({role:'admin',isAuthenticated:true})};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
      jsonFetch:async(name,options)=>{
        window.__stagingCalls=window.__stagingCalls || [];
        window.__stagingCalls.push({name,options});
        if(options?.body?.action==='signoff'){
          const accepted=structuredClone(payload);
          accepted.summary.accepted_count=1;
          accepted.summary.awaiting_human_count=0;
          accepted.staging_acceptance[0].human_signoff_status='approved';
          accepted.staging_acceptance[0].staging_acceptance_status='accepted';
          accepted.staging_acceptance[0].acceptance_complete=true;
          return {ok:true,build:'2026-09-02r',schema:186,signoff:{acceptance_status:'accepted',scorecard_auto_closed:false},status:accepted};
        }
        return structuredClone(payload);
      }
    };
  },basePayload);
  await page.addScriptTag({path:uiPath});
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:module-runtime-ready')));
}

test('phone I.T. panel keeps automated pass awaiting explicit human signoff',async({page})=>{
  await renderHarness(page,390,844);
  const panel=page.locator('#stagingAcceptancePanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Staging acceptance evidence');
  await expect(panel).toContainText('No automatic rail closure');
  await expect(panel).toContainText('Operations Cockpit staging acceptance');
  await expect(panel).toContainText('awaiting human signoff');
  await expect(panel.getByRole('button',{name:'Approve evidence'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Reject evidence'})).toBeVisible();
  const calls=await page.evaluate(()=>window.__stagingCalls || []);
  expect(calls[0].name).toBe('admin-staging-acceptance');
  expect(calls[0].options.body.action).toBe('status');
  expect(calls[0].options.requireAuth).toBe(true);
});

test('desktop explicit approval records signoff but never claims scorecard auto-close',async({page})=>{
  await renderHarness(page,1280,900);
  page.on('dialog',async(dialog)=>{
    if(dialog.type()==='confirm')await dialog.accept();
    else if(dialog.type()==='prompt')await dialog.accept('Reviewed in dedicated staging; evidence matches expected Cockpit roles and Stripe health.');
    else await dialog.dismiss();
  });
  const panel=page.locator('#stagingAcceptancePanel');
  await panel.getByRole('button',{name:'Approve evidence'}).click();
  await expect(panel).toContainText('accepted');
  await expect(panel.getByRole('button',{name:'Approve evidence'})).toHaveCount(0);
  const calls=await page.evaluate(()=>window.__stagingCalls || []);
  const signoff=calls.find((call)=>call.options?.body?.action==='signoff');
  expect(signoff).toBeTruthy();
  expect(signoff.name).toBe('admin-staging-acceptance');
  expect(signoff.options.body.run_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(signoff.options.body.decision).toBe('approved');
  expect(signoff.options.body.note).toContain('Reviewed in dedicated staging');
  await expect(panel).toContainText('Scorecard completion remains a separate deliberate release action');
});
