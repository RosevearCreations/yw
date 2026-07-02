#!/usr/bin/env node
/** Static contract for schema 154's evidence-only release readiness dashboard. */
import fs from 'node:fs';
const read=(file)=>fs.readFileSync(file,'utf8');
const sql=read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const cockpit=read('js/operations-cockpit.js');
const css=read('style.css');
const all=(text, values)=>values.every((value)=>text.includes(value));
const checks=[
  ['schema-status-view-replaced-safely',sql.includes('create or replace view public.v_schema_drift_status') && !sql.includes('drop view if exists public.v_schema_drift_status')],
  ['dashboard-view',all(sql,['v_release_readiness_dashboard','staging_evidence_status','public_content_status','dashboard_message'])],
  ['evidence-snapshot-table',all(sql,['release_readiness_review_snapshots','dashboard_snapshot',"review_scope in ('staging','production_candidate')"])],
  ['evidence-only-confirmation',all(sql,['REVIEW ONLY','No production release was performed','does not make or apply a production release'])],
  ['protected-snapshot-rpc',all(sql,['ywi_rpc_capture_release_readiness_snapshot','Only a job admin or higher','grant execute on function public.ywi_rpc_capture_release_readiness_snapshot'])],
  ['policy-rules-cover-snapshot',all(sql,['release_snapshot_rpc_not_public','release_readiness_review_snapshots'])],
  ['capability-snapshot',sql.includes("('release_readiness_snapshot','Capture release evidence snapshot','job_admin',45)")],
  ['operations-queue-loads-dashboard',all(operations,['v_release_readiness_dashboard','release_dashboard: releaseRows?.[0] || {}','release_readiness_capture'])],
  ['operations-reads-request-once',(operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g)||[]).length===1],
  ['cockpit-dashboard-ui',all(cockpit,['oc_release_dashboard','renderReleaseDashboard','oc_release_snapshot_form','release-readiness-capture','Capture evidence snapshot'])],
  ['dashboard-mobile-css',all(css,['.operations-cockpit .oc-release-dashboard','.operations-cockpit .oc-release-gates','@media(max-width:620px){.operations-cockpit .oc-release-dashboard'])]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);
if(checks.some(([,ok])=>!ok))process.exit(1);
console.log('PASS  Schema 154 release dashboard remains evidence-only, role-protected, and responsive.');
