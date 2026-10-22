import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/construction-phase-permit-control-425.js','utf8');
const ids={company:'9bdc74e7-136c-4fb2-8a5e-a99149c68f4c',order:'dca98055-9ae6-436e-a1d8-0a99c7612121',
 phase:'54a1d07e-51bc-4cff-87f9-f2e8af9ff925',permit:'e66832c5-76d0-4eaa-8ea2-5e2ee4c0c275',
 line:'73aec629-90fb-4d47-aa4b-919d8271103e',safety:'9134dd11-6a53-4fd6-b38f-9ca2cb805ac2',
 change:'6dd7fd55-eb9d-43d0-b8f7-2b73a64698b2'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main id="admin"></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-425';window.__calls=[];window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  let created=Boolean(opts.preExisting),recorded=Boolean(opts.preRecorded);
  const phase=()=>({id:ids.phase,phase_code:'foundation',phase_label:'Foundation',sequence_number:1,
   scope_notes:'Check excavation and site layout against original drawings.',recorded_at:'2026-10-22T09:00:00Z'});
  const payload=order=>({company_id:ids.company,work_order_id:order,complete:!opts.partial,
   no_auto_approval:true,source_limit:80,state:order?'review_only':'choose_order',
   orders:[{id:ids.order,number:'WO-425',status:'draft'}],phases:order&&created?[phase()]:[],
   permits:order&&recorded?[{id:ids.permit,phase_id:ids.phase,permit_kind:'building',permit_reference:'CITY-425',
    reported_status:'reported_issued',source_document_reference:'Filed paper receipt 123',
    field_notes:'Reported building permit reference; no external authority verified.',observed_on:'2026-10-22',
    recorded_at:'2026-10-22T11:00:00Z',original_safety_plan_id:ids.safety,original_change_order_id:ids.change,
    evidence_state:opts.stale?'source_changed_hold':'recorded_unverified',financial_gate:opts.reviewed?'source_verified_only':'hold',
    safety_gate:opts.reviewed?'source_reviewed_only':'hold'}]:[],
   safety:order?[{id:ids.safety,plan_number:'SAFE-425',supervisor_review_status:opts.reviewed?'approved':'pending',stop_work_required:!opts.reviewed}]:[],
   changes:order?[{id:ids.change,change_order_number:'CO-425',status:opts.reviewed?'approved':'requested',budget_applied:!!opts.reviewed}]:[],
   lines:order?[{id:ids.line,description:'Earthworks excavation'}]:[],
   release:order?(opts.reviewed?{release_status:'approved',threshold_status:'pass',signoff_present:true}:null):null});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return {select(){return this},order(){return this},limit(){return Promise.resolve({error:null,
    data:table==='ywi_companies'?[{id:ids.company,name:'YW',owner_user_id:opts.foreign?'foreign-owner':owner}]:[]});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_construction_dashboard_425')return{data:payload(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_create_construction_phase_425'){created=true;return{data:ids.phase,error:null};}
    if(name==='ywi_rpc_record_construction_permit_425'){recorded=true;return{data:ids.permit,error:null};}
    return{data:null,error:{message:'Unknown RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner425 summary').click();await page.locator('#owner425Refresh').click();
}
test('owner records a phase and unverified permit linked to original Safety and change sources on phone',async({page})=>{
 await setup(page);await page.locator('#owner425Order').selectOption(ids.order);
 await expect(page.locator('#owner425Results')).toContainText('NOT RECORDED · HOLD');
 await page.locator('#owner425Code').fill('foundation');await page.locator('#owner425Label').fill('Foundation');
 await page.locator('#owner425Sequence').fill('1');
 await page.locator('#owner425Scope').fill('Check excavation and site layout against original drawings.');
 await page.locator('#owner425Line').selectOption(ids.line);
 page.once('dialog',d=>d.accept());await page.locator('#owner425Create').click();
 await expect(page.locator('[data-owner425-phase]')).toContainText('Foundation');
 await expect(page.locator('#owner425Status')).toContainText('recorded for review only');
 await page.locator('#owner425Kind').selectOption('building');
 await page.locator('#owner425Reported').selectOption('reported_issued');
 await page.locator('#owner425Reference').fill('CITY-425');
 await page.locator('#owner425Observed').fill('2026-10-22');
 await page.locator('#owner425Safety').selectOption(ids.safety);
 await page.locator('#owner425Change').selectOption(ids.change);
 await page.locator('#owner425Document').fill('Filed paper receipt 123');
 await page.locator('#owner425Notes').fill('Reported building permit reference; no external authority verified.');
 page.once('dialog',d=>d.accept());await page.locator('#owner425Record').click();
 await expect(page.locator('[data-owner425-permit]')).toContainText('UNVERIFIED');
 await expect(page.locator('[data-owner425-permit]')).toContainText('recorded_unverified');
 await expect(page.locator('[data-owner425-gate="hold"]')).toContainText('Finance: hold · Safety: hold');
 await expect(page.locator('#owner425Status')).toContainText('No certification, change approval or posting');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.filter(x=>x.name==='ywi_rpc_create_construction_phase_425')).toEqual([{name:'ywi_rpc_create_construction_phase_425',args:{p_company_id:ids.company,p_work_order_id:ids.order,p_phase_code:'foundation',p_phase_label:'Foundation',p_sequence_number:1,p_scope_notes:'Check excavation and site layout against original drawings.',p_work_order_line_id:ids.line}}]);
 expect(calls.filter(x=>x.name==='ywi_rpc_record_construction_permit_425')).toEqual([{name:'ywi_rpc_record_construction_permit_425',args:{p_company_id:ids.company,p_work_order_id:ids.order,p_phase_id:ids.phase,p_kind:'building',p_reference:'CITY-425',p_reported_status:'reported_issued',p_document_reference:'Filed paper receipt 123',p_field_notes:'Reported building permit reference; no external authority verified.',p_observed_on:'2026-10-22',p_safety_plan_id:ids.safety,p_change_order_id:ids.change}}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('changed original sources force HOLD, even when reported permit says issued',async({page})=>{
 await setup(page,{preExisting:true,preRecorded:true,stale:true});await page.locator('#owner425Order').selectOption(ids.order);
 await expect(page.locator('[data-owner425-permit]')).toContainText('source_changed_hold');
 await expect(page.locator('[data-owner425-gate="hold"]')).toContainText('No certification or release');
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_construction_permit_425'))).toHaveLength(0);
});
test('even approved source gates cannot certify reported permit status',async({page})=>{
 await setup(page,{preExisting:true,preRecorded:true,reviewed:true});await page.locator('#owner425Order').selectOption(ids.order);
 await expect(page.locator('[data-owner425-permit]')).toContainText('operator-reported ONLY');
 await expect(page.locator('[data-owner425-gate="review_only"]')).toContainText('No certification or release');
});
test('foreign company ownership and partial server evidence withheld',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner425Status')).toContainText('WITHHELD');
 await setup(page,{partial:true});await expect(page.locator('#owner425Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner425PermitForm')).toBeHidden();
});
