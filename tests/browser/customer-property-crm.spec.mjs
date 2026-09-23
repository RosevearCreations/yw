import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-customer-property-crm-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(()=>{
    window.__crm340Calls=[];
    const payload={
      ok:true,
      crm_customers:[{client_id:'c1',client_name:'Ontario Four Season Customer',crm_lifecycle_stage:'customer',is_active:true,spring_summer_coverage:true,fall_coverage:true,winter_coverage:true,crm_preferred_contact_method:'email',crm_preferred_contact_window:'Afternoons'}],
      crm_properties:[{id:'s1',client_id:'c1',site_name:'Home Property',service_address:'10 Example Rd',access_notes:'Use side gate',pet_notes:'Dog',recurring_property_instructions:'Text before arrival',spring_summer_coverage:true,fall_coverage:true,winter_coverage:true}],
      crm_leads:[{id:'l1',full_name:'New Lead',service_type:'Snow removal',request_status:'new',converted_client_id:null}],
      crm_service_plans:[{agreement_id:'a1',client_id:'c1',client_site_id:'s1',service_name:'Winter snow clearing',season_context:'winter',agreement_status:'active'},{agreement_id:'a2',client_id:'c1',client_site_id:'s1',service_name:'Weekly mowing',season_context:'spring_summer',agreement_status:'active'}],
      crm_service_history:[{record_id:'w1',record_type:'work_order',client_id:'c1',client_site_id:'s1',reference_code:'WO-1',service_type:'Fall cleanup',season_context:'fall',status:'completed'}],
      crm_interactions:[{id:'i1',client_id:'c1',interaction_type:'communication',season_context:'winter',summary:'Confirmed driveway snow instructions.'}],
      crm_followups:[],crm_opportunities:[],
      crm_renewals:[{agreement_id:'a2',client_id:'c1',service_name:'Weekly mowing',season_context:'spring_summer',renewal_status:'due_90_days'}],
      crm_cross_service_candidates:[{client_id:'c1',client_site_id:'s1',target_service_type:'Snow clearing / snow removal',season_context:'winter',candidate_reason:'Advisory candidate',action_boundary:'advisory_only'}],
      crm_profiles:[]
    };
    window.YWIAPI={
      loadAdminDirectory:async(req)=>{window.__crm340Calls.push({kind:'load',req:structuredClone(req)});return structuredClone(payload);},
      manageOperations:async(req)=>{window.__crm340Calls.push({kind:'manage',req:structuredClone(req)});return {ok:true,record:{id:'x1',...req}};}
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWICustomerPropertyCRMUI.mount({api:window.YWIAPI}));
}

test('Build 340 renders unified four-season CRM',async({page})=>{
  await boot(page);
  const panel=page.locator('#customerPropertyCrm340');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
  await expect(panel.locator('[data-build="340"]')).toBeVisible();
  await expect(panel).toContainText('Four-season Ontario operating model');
  await expect(panel).toContainText('winter snow clearing/removal');
  await expect(panel).toContainText('Ontario Four Season Customer');
  await expect(panel).toContainText('Home Property');
  await expect(panel).toContainText('Use side gate');
  await expect(panel).toContainText('Winter snow clearing');
  await expect(panel).toContainText('Fall cleanup');
});

test('Build 340 records complaint and follow-up evidence',async({page})=>{
  await boot(page);
  await page.selectOption('#crm340InteractionType','complaint');
  await page.selectOption('#crm340Season','winter');
  await page.fill('#crm340Service','Snow clearing');
  await page.fill('#crm340InteractionSummary','Driveway edge missed on prior visit.');
  await page.click('#crm340AddInteraction');
  await expect.poll(async()=>page.evaluate(()=>window.__crm340Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(1);
  await page.fill('#crm340FollowupDue','2026-12-01T12:00');
  await page.selectOption('#crm340FollowupType','complaint');
  await page.fill('#crm340FollowupSummary','Supervisor customer follow-up.');
  await page.click('#crm340AddFollowup');
  await expect.poll(async()=>page.evaluate(()=>window.__crm340Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(2);
  const calls=await page.evaluate(()=>window.__crm340Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.action==='crm_interaction_save'&&x.interaction_type==='complaint'&&x.complaint_status==='open'&&x.season_context==='winter')).toBeTruthy();
  expect(calls.some((x)=>x.action==='crm_followup_save'&&x.followup_type==='complaint'&&x.client_id==='c1')).toBeTruthy();
});

test('Build 340 cross-service candidate stays advisory until explicit record',async({page})=>{
  await boot(page);
  await expect(page.locator('#crm340Candidates')).toContainText('Snow clearing / snow removal');
  await page.click('[data-crm-candidate="s1"]');
  await expect.poll(async()=>page.evaluate(()=>window.__crm340Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(1);
  const calls=await page.evaluate(()=>window.__crm340Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.action==='crm_opportunity_save'&&x.opportunity_type==='cross_service'&&x.opportunity_status==='identified')).toBeTruthy();
  expect(calls.some((x)=>/estimate|invoice|payment|bill/i.test(x.action||''))).toBeFalsy();
});
