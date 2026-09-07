#!/usr/bin/env node
/** Schema 157 + Build 253 service-execution proof contract. Safe without credentials. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(); const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8'); const failures=[];
const expect=(text,needle,label)=>{ if(!text.includes(needle)) failures.push(label); };
const forbidBlock=(text,pattern,needle,label)=>{ const block=text.match(pattern); if(!block) failures.push(`${label} block missing`); else if(block[0].includes(needle)) failures.push(label); };
const sql=read('sql/157_service_execution_proof_cost_capture.sql');
const ops=read('supabase/functions/operations-manage/index.ts');
const portal=read('supabase/functions/customer-portal/index.ts');
const cockpit=read('js/operations-cockpit.js');
const guard=read('js/execution-proof-runtime-guard.js');
const passwordSecurity=read('js/password-security.js');
const browser=read('tests/browser/job-lifecycle.spec.mjs');
const portalJs=read('js/customer-portal.js');
const css=read('style.css');
[
 ['work_order_execution_proofs','proof table'],['work_order_execution_proof_media','proof media table'],['v_work_order_execution_proof_queue','staff proof queue'],['v_work_order_execution_cost_dashboard','internal cost dashboard'],['v_customer_portal_execution_proofs','portal-safe proof view'],['ywi_rpc_submit_work_order_execution_proof','submit proof RPC'],['ywi_rpc_decide_work_order_execution_proof','decide proof RPC'],['Only a site leader or higher may capture service-execution proof.','site leader submit guard'],['Only a supervisor or higher may approve or reject service-execution proof.','supervisor decision guard'],['Customer-visible execution proof may attach only approved assets with a public delivery URL.','approved public image gate'],['Customer portal never receives internal cost fields.','customer cost privacy message'],['Customer-visible execution proof requires a customer-safe summary.','server customer-summary guard'],['execution_proof_rpcs_not_public','policy assertion']
].forEach(([needle,label])=>expect(sql,needle,label));
expect(ops,"const SCHEMA = 159",'operations schema marker');
expect(ops,"execution_proofs: 'v_work_order_execution_proof_queue'",'operations proof queue view');
expect(ops,"execution_costs: 'v_work_order_execution_cost_dashboard'",'operations cost queue view');
expect(ops,"action === 'work_order_execution_proof_submit'",'operations submit action');
expect(ops,"ywi_rpc_decide_work_order_execution_proof",'operations decision RPC');
expect(portal,"const SCHEMA = 159",'portal schema marker');
expect(portal,'portalExecutionProofs','portal proof reader');
expect(portal,'execution_proofs: executionProofs','portal public package proof field');
expect(cockpit,'oc_execution_proof_form','cockpit proof form');
expect(cockpit,'renderExecutionProofQueue','cockpit proof queue renderer');
expect(cockpit,"'execution-proof-approve':'work_order_execution_proof_decision'",'proof action capability');
expect(portalJs,'executionProofTimeline','portal proof timeline');
expect(portalJs,'Labour, material, equipment, and margin data stay internal.','portal cost privacy copy');
expect(css,'.oc-execution-proof-card','cockpit proof CSS');
expect(css,'.customer-portal-proofs','portal proof CSS');
forbidBlock(sql,/create or replace view public\.v_customer_portal_execution_proofs[\s\S]*?group by/, 'total_cost', 'portal proof view exposes total_cost');
forbidBlock(sql,/create or replace view public\.v_customer_portal_execution_proofs[\s\S]*?group by/, 'labour_cost_total', 'portal proof view exposes labour cost');
forbidBlock(sql,/create or replace view public\.v_customer_portal_execution_proofs[\s\S]*?group by/, 'staff_notes', 'portal proof view exposes staff notes');

// Build 253 browser preflight is a UX guard only; server/RPC rules above remain authoritative.
[
 ['Customer-visible execution proof requires a customer-safe summary.','browser customer-summary guard'],
 ['Execution proof costs must be zero or positive numbers.','browser nonnegative-cost guard'],
 ['Number.isFinite(value)','browser finite-number guard'],
 ["document.addEventListener('submit', blockInvalidSubmit, true)",'capture-phase preflight'],
 ['event.stopImmediatePropagation()','invalid submission blocked before Cockpit send'],
 ['YWIExecutionProofRuntimeGuard','guard operator surface']
].forEach(([needle,label])=>expect(guard,needle,label));
for(const forbidden of ["admin-staging-acceptance","action:'record_case'","action:'finalize'","action:'signoff'","work_order_execution_proof_submit"]){
  if(guard.includes(forbidden)) failures.push(`browser guard must not mutate backend/staging: ${forbidden}`);
}
expect(passwordSecurity,"const EXECUTION_PROOF_RUNTIME_GUARD_SCRIPT = '/js/execution-proof-runtime-guard.js'",'Admin bootstrap guard path');
expect(passwordSecurity,'loadExecutionProofRuntimeGuard();','Admin bootstrap loads execution-proof guard');
expect(passwordSecurity,'Server-side execution-proof validation remains authoritative.','loader preserves server authority');

// Build 253 rendered acceptance must execute the real Cockpit runtime rather than only static fixture markup.
[
 ["fs.readFileSync('js/operations-cockpit.js', 'utf8')",'browser loads actual Cockpit source'],
 ["fs.readFileSync('js/execution-proof-runtime-guard.js', 'utf8')",'browser loads actual guard source'],
 ['mountActualExecutionProofCockpit','actual runtime fixture'],
 ["row.action === 'work_order_execution_proof_submit'",'runtime submit capture'],
 ["row.action === 'work_order_execution_proof_decision'",'runtime supervisor decision capture'],
 ['labour_minutes:90','representative labour proof'],
 ['material_cost_total:35.25','representative material proof'],
 ['equipment_cost_total:18','representative equipment proof'],
 ['Customer-visible execution proof requires a customer-safe summary.','rendered summary rejection'],
 ['Execution proof costs must be zero or positive numbers.','rendered cost rejection'],
 ['Internal staging-only cost context.','rendered staff-only cost context']
].forEach(([needle,label])=>expect(browser,needle,label));
if(browser.includes('admin-staging-acceptance')) failures.push('Build 253 browser proof must not record staging acceptance evidence.');

if(failures.length){ console.error(`Service-execution proof contract failed (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Service-execution proof contract passed.');
