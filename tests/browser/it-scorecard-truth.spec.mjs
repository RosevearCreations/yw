import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const uiSource=fs.readFileSync(path.join(process.cwd(),'js/it-readiness-ui.js'),'utf8');
const viewports=[{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:960}];

function payload(){
  const empty={rows:[],error:null,summary:{status:'passed',total:0,blocking:0,warning:0,error:null}};
  return {
    ok:true,
    scope:'it_readiness',
    summary:{
      overall_status:'amber',schema_current:true,expected_schema_version:184,latest_applied_schema_version:184,
      release_authority_status:'green',source_gate_status:'green',repository_enforcement_status:'amber',
      source_sha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',workflow_run_id:12345,
      production_promotion_mode:'manual_human_promotion_required',scorecard_truth_status:'green',
      scorecard_open_count:4,scorecard_unclassified_open_count:0,scorecard_human_pending_count:2,
      scorecard_external_pending_count:1,active_admin_count:3,admin_access_integrity_blockers:0,
      readiness_blockers:0,assertion_blockers:0,
    },
    security_assertions:{
      module:[],it:[],release_authority:[],consumer_observability:[],finance_operational:[],
      finance_release_hardening:[],finance_account_mapping_review:[],finance_account_mapping_observability:[],
      finance_account_mapping_decision_support:[],errors:[],
      scorecard_truth:[{assertion_key:'it_scorecard_truth_open_rails_classified',assertion_status:'passed',details:'Every open scorecard rail has an explicit current resolution class.'}],
    },
    sections:{
      release_authority:{...empty,rows:[{release_authority_status:'green',release_message:'Application release authority is green.'}],summary:{status:'passed',total:1,blocking:0,warning:0,error:null}},
      release_source_evidence:{...empty},
      scorecard_truth_status:{...empty,rows:[{scorecard_truth_status:'green',open_count:4,unclassified_open_count:0,truth_message:'Scorecard truth is structurally converged.'}],summary:{status:'passed',total:1,blocking:0,warning:0,error:null}},
      scorecard_truth:{...empty,rows:[
        {rail_key:'schema159_module_permissions',rail_title:'Module boundaries and per-profile access',rail_status:'complete',resolution_class:'verified_complete',requires_human:false,requires_external:false,resolution_status:'verified_complete',truth_status:'green',truth_message:'Historical rail is complete with immutable current-proof evidence.'},
        {rail_key:'customer_portal_live',rail_title:'Customer portal, acceptance, deposit, dispatch, and job cost',rail_status:'active',resolution_class:'provider_acceptance',requires_human:true,requires_external:true,resolution_status:'provider_acceptance_pending',truth_status:'amber',truth_message:'Keep open for Stripe test-mode hosted checkout/webhook/customer-status acceptance.'},
        {rail_key:'route_asset_approval_live',rail_title:'Route and visual asset approval before publishing',rail_status:'active',resolution_class:'content_approval',requires_human:true,requires_external:false,resolution_status:'content_approval_pending',truth_status:'amber',truth_message:'Keep open for human route/visual approval before public publishing.'},
        {rail_key:'equipment_scan_custody_live',rail_title:'Equipment scan and custody timeline',rail_status:'active',resolution_class:'feature_followup',requires_human:false,requires_external:false,resolution_status:'feature_followup_pending',truth_status:'amber',truth_message:'Barcode/QR camera scanning remains a real feature follow-up.'},
      ],summary:{status:'warning',total:4,blocking:0,warning:3,error:null}},
      admin_access_integrity:{...empty,rows:[{role:'admin',profile_label:'Admin User',all_modules_manage:true,safety_access:'manage',finance_access:'manage',jobs_access:'manage',admin_access:'manage'}],summary:{status:'passed',total:1,blocking:0,warning:0,error:null}},
      cross_module_consumer_health:{...empty},finance_operational:{...empty},finance_reconciliation:{...empty},
      finance_release_hardening:{...empty},finance_account_mapping_review:{...empty},finance_account_mapping_decision_support:{...empty},
      finance_account_mapping_observability:{...empty},schema_drift:{...empty},schema_preflight:{...empty},deployment_checklist:{...empty},
      function_readiness:{...empty},production_readiness:{...empty},deployment_gate:{...empty},backup_restore:{...empty},runtime_health:{...empty},admin_tasks:{...empty},public_seo:{...empty},
    },
  };
}

async function mount(page){
  const calls=[];
  await page.setContent('<!doctype html><html><body><main class="container"><section id="admin"></section></main></body></html>');
  await page.exposeFunction('recordItCall',(body)=>calls.push(body));
  await page.evaluate((p)=>{
    window.YWI_AUTH={getState:()=>({role:'admin',isAuthenticated:true,profile:{id:'admin-profile'}})};
    window.YWIAPI={
      escHtml:(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),
      jsonFetch:async(_name,opts)=>{await window.recordItCall(opts?.body||{});return window.__itPayload;},
      runSmokeCheck:async()=>({ok:true,checks:[{scope:'browser',ok:true,message:'ok'}]}),
    };
    window.__itPayload=p;
  },payload());
  await page.addScriptTag({content:uiSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await page.evaluate(()=>window.YWIITReadiness.load(true));
  await expect(page.locator('#itReadinessWorkspace')).toContainText('I.T. Readiness');
  return calls;
}

for(const viewport of viewports){
  test(`scorecard truth separates verified closure from real pending work on ${viewport.name}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    const calls=await mount(page);
    const workspace=page.locator('#itReadinessWorkspace');
    await expect(workspace).toContainText('Readiness-work classification integrity');
    await expect(workspace).toContainText('Verified closures and classified pending rails');
    await expect(workspace).toContainText('Module boundaries and per-profile access');
    await expect(workspace).toContainText('verified complete');
    await expect(workspace).toContainText('Customer portal, acceptance, deposit, dispatch, and job cost');
    await expect(workspace).toContainText('provider acceptance');
    await expect(workspace).toContainText('human · external · provider acceptance');
    await expect(workspace).toContainText('Route and visual asset approval before publishing');
    await expect(workspace).toContainText('content approval');
    await expect(workspace).toContainText('Equipment scan and custody timeline');
    await expect(workspace).toContainText('feature followup');
    await expect(workspace).toContainText('0');
    expect(calls).toEqual([{action:'it_readiness'}]);
    expect(await workspace.getByRole('button',{name:/complete/i}).count()).toBe(0);
  });
}

test('non-admin cannot render the I.T. scorecard truth workspace',async({page})=>{
  await page.setContent('<!doctype html><html><body><main class="container"><section id="admin"></section></main></body></html>');
  await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({role:'employee',isAuthenticated:true})};window.YWIAPI={escHtml:(v)=>String(v??'')};});
  await page.addScriptTag({content:uiSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#itReadinessWorkspace')).toContainText('Admin manage access is required');
});
