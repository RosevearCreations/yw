import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),b=read('supabase/functions/admin-directory/index.ts');
const i=b.indexOf("if (scope === 'production_start_return_visit_proof')");
const j=b.indexOf("if (scope === 'activity_timeline')",i);
assert.ok(i>0&&j>i);
const s=b.slice(i,j);
for(const x of ["roleRank(actorRole)<roleRank('supervisor')","hasModuleAccess",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'","safeListEvidence(supabase,'estimates'",
 "safeListEvidence(supabase,'work_orders'","safeListEvidence(supabase,'v_crew_dispatch_schedule'",
 "safeListEvidence(supabase,'v_landscape_production_session_directory'",
 "safeListEvidence(supabase,'job_session_production_quantities'",
 "r.row_count>=r.limit","workflowById.size!==estimatesById.size",
 "String(s.client_id||'')!==String(o.client_id||'')",
 "String(s.dispatch_schedule_item_id||'')===String(firstDispatch.id)",
 "production_recorded_by_profile_id","started_at_without_field_receipt",
 "return_visit_required","unfinished_work_notes","return_visit_pending_no_session_receipt",
 "dated_return_visit_receipt_recorded","return_started_no_field_receipt",
 "actual_quantity","is_active","if(records.length>150)return withheld","no_started_session",
 "state:'withheld'"])
 assert.ok((s+b.slice(0,i)).includes(x),'Missing source/guard '+x);
assert.doesNotMatch(s,/\.(insert|upsert|update|delete)\s*\(/);
const ui=read('js/production-start-return-visit-proof-410.js');
new Function(ui);
for(const x of ['production410','production410Recheck','production_start_return_visit_proof',
 'data-production410-state','dated_return_visit_receipt_recorded','explicit_partial_evidence_recorded',
 'Date.now()-at<=300000','esc(r.first_started_at)'])assert.ok(ui.includes(x),'Missing UI '+x);
const p=JSON.parse(read('package.json'));
assert.equal(p.scripts['test:production-start-return-visit-proof-410'],'node scripts/production-start-return-visit-proof-410-check.mjs');
assert.ok(p.scripts['test:browser:production-start-return-visit-proof-410'].includes('tests/browser/production-start-return-visit-proof-410.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const x of ['npm run test:production-start-return-visit-proof-410','npm run test:browser:production-start-return-visit-proof-410'])assert.ok(ci.includes(x));
assert.ok(read('index.html').includes('js/production-start-return-visit-proof-410.js'));
assert.ok(read('help.html').includes('id="production-start-return-visit-410"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 410 — Production Start and Return-Visit Proof'));
assert.ok(read('docs/MULTI_SERVICE_INTEGRATION_ARCHITECTURE.md').includes('Septic and vacuum services'));
console.log('Build 410 read-only source, fresh bounded authorization, linkage, UX and CI contracts PASS');