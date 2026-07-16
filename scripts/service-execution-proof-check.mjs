#!/usr/bin/env node
/** Schema 157 service-execution proof contract. Safe without credentials. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const root=process.cwd(); const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8'); const failures=[];
const expect=(text,needle,label)=>{ if(!text.includes(needle)) failures.push(label); };
const forbidBlock=(text,pattern,needle,label)=>{ const block=text.match(pattern); if(!block) failures.push(`${label} block missing`); else if(block[0].includes(needle)) failures.push(label); };
const sql=read('sql/157_service_execution_proof_cost_capture.sql');
const schema=read('sql/000_full_schema_reference.sql');
const ops=read('supabase/functions/operations-manage/index.ts');
const portal=read('supabase/functions/customer-portal/index.ts');
const cockpit=read('js/operations-cockpit.js');
const portalJs=read('js/customer-portal.js');
const css=read('style.css');
[
 ['work_order_execution_proofs','proof table'],['work_order_execution_proof_media','proof media table'],['v_work_order_execution_proof_queue','staff proof queue'],['v_work_order_execution_cost_dashboard','internal cost dashboard'],['v_customer_portal_execution_proofs','portal-safe proof view'],['ywi_rpc_submit_work_order_execution_proof','submit proof RPC'],['ywi_rpc_decide_work_order_execution_proof','decide proof RPC'],['Only a site leader or higher may capture service-execution proof.','site leader submit guard'],['Only a supervisor or higher may approve or reject service-execution proof.','supervisor decision guard'],['Customer-visible execution proof may attach only approved assets with a public delivery URL.','approved public image gate'],['Customer portal never receives internal cost fields.','customer cost privacy message'],['execution_proof_rpcs_not_public','policy assertion']
].forEach(([needle,label])=>expect(sql,needle,label));
expect(schema,'BEGIN MIGRATION: 157_service_execution_proof_cost_capture','canonical schema includes 157 migration');
expect(ops,"const SCHEMA = 157",'operations schema marker');
expect(ops,"execution_proofs: 'v_work_order_execution_proof_queue'",'operations proof queue view');
expect(ops,"execution_costs: 'v_work_order_execution_cost_dashboard'",'operations cost queue view');
expect(ops,"action === 'work_order_execution_proof_submit'",'operations submit action');
expect(ops,"ywi_rpc_decide_work_order_execution_proof",'operations decision RPC');
expect(portal,"const SCHEMA = 157",'portal schema marker');
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
if(failures.length){ console.error(`Service-execution proof contract failed (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Service-execution proof contract passed.');
