import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/water-park-inspection-safety-426.js','utf8');
const ids={company:'9bdc74e7-136c-4fb2-8a5e-a99149c68f4c',order:'dca98055-9ae6-436e-a1d8-0a99c7612121',
 inspection:'54a1d07e-51bc-4cff-87f9-f2e8af9ff925',followup:'e66832c5-76d0-4eaa-8ea2-5e2ee4c0c275',
 safety:'9134dd11-6a53-4fd6-b38f-9ca2cb805ac2'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main id="admin"></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-426';window.__calls=[];window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  let inspected=Boolean(opts.preExisting),followed=Boolean(opts.preFollowup);
  const payload=order=>({company_id:ids.company,work_order_id:order,complete:!opts.partial,
   no_automatic_reopening:!opts.reopen,source_limit:80,state:order?'review_only':'choose_order',
   orders:[{id:ids.order,number:'WP-426',status:'draft'}],
   safety:order?[{id:ids.safety,plan_number:'SAFE-426',field_date:'2026-10-22',plan_status:'draft',
    supervisor_review_status:opts.reviewed?'approved':'pending',stop_work_required:!opts.reviewed}]:[],
   inspections:order&&inspected?[{id:ids.inspection,inspection_key:'wave_pool_1',area_label:'Wave Pool',
    inspection_kind:'routine',inspected_on:'2026-10-22',observed_issue:opts.clear?'none_reported':'closure_reported',
    source_reference:'Aquatic log WP-2026-10-22',observation_notes:'Measured field conditions and site barrier observations only.',
    observed_ph:7.5,observed_sanitizer_mg_l:1.2,observed_water_c:26,
    original_safety_plan_id:ids.safety,recorded_at:'2026-10-22T09:00:00Z',
    evidence_state:opts.stale?'source_changed_hold':'recorded_unverified',
    closure_gate:opts.reviewed&&opts.clear&&!opts.stale?'independent_safety_review_still_required':'hold'}]:[],
   followups:order&&followed?[{id:ids.followup,inspection_id:ids.inspection,receipt_key:'site_recheck_1',
    observed_on:'2026-10-22',action_reference:'Maintenance log WP-426-1',
    factual_notes:'Operator reports corrective maintenance action but no reopening decision.',
    reported_state:'operator_reports_addressed',evidence_state:opts.stale?'source_changed_hold':'recorded_unverified',
    reopening_gate:'hold_until_independent_safety_authority'}]:[]});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return {select(){return this},order(){return this},limit(){return Promise.resolve({error:null,
    data:table==='ywi_companies'?[{id:ids.company,name:'YW',owner_user_id:opts.foreign?'another-owner':owner}]:[]});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_aquatic_dashboard_426')return {data:payload(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_record_aquatic_inspection_426'){inspected=true;return{data:ids.inspection,error:null};}
    if(name==='ywi_rpc_append_aquatic_followup_426'){followed=true;return{data:ids.followup,error:null};}
    return{data:null,error:{message:'Unexpected RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner426 summary').click();await page.locator('#owner426Refresh').click();
}
test('owner records unverified aquatic observation and follow-up without reopening on mobile',async({page})=>{
 await setup(page);await page.locator('#owner426Order').selectOption(ids.order);
 await expect(page.locator('#owner426Results')).toContainText('No aquatic inspection reports yet');
 await page.locator('#owner426Key').fill('wave_pool_1');await page.locator('#owner426Area').fill('Wave Pool');
 await page.locator('#owner426Kind').selectOption('routine');await page.locator('#owner426Day').fill('2026-10-22');
 await page.locator('#owner426Issue').selectOption('closure_reported');await page.locator('#owner426Safety').selectOption(ids.safety);
 await page.locator('#owner426Ph').fill('7.5');await page.locator('#owner426Sanitizer').fill('1.2');
 await page.locator('#owner426Water').fill('26');await page.locator('#owner426Source').fill('Aquatic log WP-2026-10-22');
 await page.locator('#owner426Notes').fill('Measured field conditions and site barrier observations only.');
 page.once('dialog',d=>d.accept());await page.locator('#owner426Record').click();
 await expect(page.locator('[data-owner426-inspection]')).toContainText('UNVERIFIED');
 await expect(page.locator('[data-owner426-gate="hold"]')).toContainText('NO automated reopening');
 await page.locator('#owner426Inspection').selectOption(ids.inspection);
 await page.locator('#owner426FollowKey').fill('site_recheck_1');await page.locator('#owner426FollowDay').fill('2026-10-22');
 await page.locator('#owner426Reported').selectOption('operator_reports_addressed');
 await page.locator('#owner426Action').fill('Maintenance log WP-426-1');
 await page.locator('#owner426FollowNotes').fill('Operator reports corrective maintenance action but no reopening decision.');
 page.once('dialog',d=>d.accept());await page.locator('#owner426Follow').click();
 await expect(page.locator('[data-owner426-followup]')).toContainText('hold_until_independent_safety_authority');
 expect((await page.evaluate(()=>window.__calls)).filter(x=>x.name==='ywi_rpc_record_aquatic_inspection_426')).toEqual([{
  name:'ywi_rpc_record_aquatic_inspection_426',args:{p_company_id:ids.company,p_work_order_id:ids.order,
   p_key:'wave_pool_1',p_area:'Wave Pool',p_kind:'routine',p_inspected_on:'2026-10-22',p_issue:'closure_reported',
   p_source_reference:'Aquatic log WP-2026-10-22',p_notes:'Measured field conditions and site barrier observations only.',
   p_ph:7.5,p_sanitizer_mg_l:1.2,p_water_c:26,p_safety_plan_id:ids.safety}}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('operator reports addressed cannot clear a closure or stale original Safety plan',async({page})=>{
 await setup(page,{preExisting:true,preFollowup:true,stale:true});await page.locator('#owner426Order').selectOption(ids.order);
 await expect(page.locator('[data-owner426-inspection]')).toContainText('source_changed_hold');
 await expect(page.locator('[data-owner426-gate="hold"]')).toContainText('NO automated reopening');
 await expect(page.locator('[data-owner426-followup]')).toContainText('hold_until_independent_safety_authority');
});
test('even reviewed Safety source and no reported issue do not authorize reopening',async({page})=>{
 await setup(page,{preExisting:true,clear:true,reviewed:true});await page.locator('#owner426Order').selectOption(ids.order);
 await expect(page.locator('[data-owner426-gate="review_only"]')).toContainText('independent_safety_review_still_required');
 await expect(page.locator('[data-owner426-gate="review_only"]')).toContainText('NO automated reopening');
});
test('foreign ownership and incomplete dashboard payload fail closed',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner426Status')).toContainText('WITHHELD');
 await setup(page,{partial:true});await expect(page.locator('#owner426Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner426InspectionForm')).toBeHidden();
});
