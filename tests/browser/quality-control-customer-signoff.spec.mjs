import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-quality-control-ui.js'),'utf8');
async function boot(page){
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{
   window.__qc345=[];
   const data={ok:true,
    quality_control_templates:[{id:'t1',template_name:'Winter Snow & Ice Completion',template_code:'winter_snow_ice_completion',service_context:'snow_clearing_removal',season_context:'winter',supervisor_qc_required:true,customer_signoff_mode:'recommended',is_active:true}],
    quality_control_template_items:[{id:'ti1',template_id:'t1',item_code:'access_cleared',item_prompt:'Contracted access is cleared.',evidence_requirement:'after',is_required:true,sort_order:10,is_active:true}],
    quality_control_runs:[{id:'r1',work_order_id:'w1',template_id:'t1',work_order_number:'WO-345',template_name:'Winter Snow & Ice Completion',run_status:'awaiting_supervisor_qc',review_status:'pending',service_context:'snow_clearing_removal',season_context:'winter',customer_safe_summary:'Snow and ice service completed.',ready_for_closeout:false,unresolved_deficiency_count:0,canonical_customer_signoff_status:'not_requested'}],
    quality_control_items:[{id:'ri1',qc_run_id:'r1',item_code:'access_cleared',item_prompt:'Contracted access is cleared.',evidence_requirement:'after',is_required:true,result_status:'pass',sort_order:10}],
    quality_control_evidence:[],
    quality_control_deficiencies:[],
    quality_control_work_orders:[{id:'w1',work_order_number:'WO-345',status:'in_progress',work_type:'snow clearing'}],
    quality_control_execution_proofs:[{id:'p1',work_order_id:'w1',proof_type:'completion',proof_status:'approved',customer_visible:true,title:'After service',customer_summary:'Cleared access',occurred_at:'2026-09-24T15:00:00Z'}],
    quality_control_sessions:[{id:'s1',work_order_id:'w1',session_date:'2026-09-24',session_status:'completed',completion_state:'complete'}],
    quality_control_closeouts:[]
   };
   window.YWIAPI={
    loadAdminDirectory:async(q)=>{window.__qc345.push({kind:'load',q});return structuredClone(data);},
    manageOperations:async(q)=>{window.__qc345.push({kind:'manage',q});return {ok:true,record:{id:q.qc_run_id||'r1',work_order_id:q.work_order_id||'w1',run_status:q.decision==='approve'?'approved':'crew_complete'},customer_signoff_mutated:false};}
   };
 });
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIQualityControlUI.mount({api:window.YWIAPI}));
}
test('Build 345 renders four-season QC and canonical signoff boundary',async({page})=>{
 await boot(page);
 const panel=page.locator('#qualityControl345');
 await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
 await expect(panel).toContainText('Customer signoff authority');
 await expect(panel).toContainText('winter snow clearing/removal');
 await expect(panel).toContainText('staff QC cannot sign for a customer');
 await expect(panel).toContainText('WO-345');
});
test('Build 345 crew completion sends checklist and customer-safe summary without signoff mutation',async({page})=>{
 await boot(page);
 await page.selectOption('#qc345WorkOrder','w1');
 await page.selectOption('#qc345Template','t1');
 await page.fill('#qc345CrewSummary','Snow clearing complete.');
 await page.fill('#qc345CustomerSummary','Snow and ice service completed.');
 await page.selectOption('[data-qc345-result="access_cleared"]','pass');
 await page.click('#qc345RunSave');
 const calls=await page.evaluate(()=>window.__qc345.filter(x=>x.kind==='manage').map(x=>x.q));
 const call=calls.find(x=>x.action==='quality_control_run_save');
 expect(call).toBeTruthy();
 expect(call.customer_safe_summary).toBe('Snow and ice service completed.');
 expect(calls.some(x=>x.action==='sign_closeout')).toBeFalsy();
});
test('Build 345 links canonical execution proof and records deficiency/rework',async({page})=>{
 await boot(page);
 await page.selectOption('#qc345EvidenceRun','r1');
 await page.selectOption('#qc345EvidenceProof','p1');
 await page.selectOption('#qc345EvidenceRole','after');
 await page.check('#qc345EvidenceCustomerSafe');
 await page.click('#qc345EvidenceSave');
 await page.selectOption('#qc345DefRun','r1');
 await page.fill('#qc345DefSummary','Small untreated ice patch at side entrance.');
 await page.selectOption('#qc345DefSeverity','minor');
 await page.click('#qc345DefSave');
 const calls=await page.evaluate(()=>window.__qc345.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='quality_control_evidence_link'&&x.execution_proof_id==='p1')).toBeTruthy();
 expect(calls.some(x=>x.action==='quality_control_deficiency_save')).toBeTruthy();
});
test('Build 345 supervisor approval remains separate from customer portal signoff',async({page})=>{
 await boot(page);
 await page.selectOption('#qc345ReviewRun','r1');
 await page.selectOption('#qc345ReviewDecision','approve');
 await page.fill('#qc345ReviewNote','QC complete.');
 await page.click('#qc345ReviewSave');
 const calls=await page.evaluate(()=>window.__qc345.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='quality_control_review'&&x.decision==='approve')).toBeTruthy();
 expect(calls.some(x=>['sign_closeout','customer_signoff','customer_closeout_signoff'].includes(x.action))).toBeFalsy();
});
