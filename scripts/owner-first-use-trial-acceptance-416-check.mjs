import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if(scope==='owner_first_use_trial_acceptance')"),
 end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0&&end>start,'Owner 416 dedicated scope not implemented');
const block=backend.slice(start,end);
for(const word of [
 "roleRank(actorRole)<roleRank('admin')",
 "hasModuleAccess(supabase,actorProfile,'admin','manage')",
 "hasModuleAccess(supabase,actorProfile,'jobs','view')",
 "hasModuleAccess(supabase,actorProfile,'finance','view')",
 "safeListEvidence(supabase,'clients'",
 "safeListEvidence(supabase,'client_sites'",
 "safeListEvidence(supabase,'work_orders'",
 "safeListEvidence(supabase,'dispatch_schedule_items'",
 "safeListEvidence(supabase,'v_landscape_production_session_directory'",
 "safeListEvidence(supabase,'material_issues'",
 "safeListEvidence(supabase,'equipment_signouts'",
 "safeListEvidence(supabase,'v_quality_control_run_directory'",
 "safeListEvidence(supabase,'work_order_closeout_packages'",
 "safeListEvidence(supabase,'job_invoice_candidates'",
 "safeListEvidence(supabase,'ar_invoices'",
 "safeListEvidence(supabase,'seasonal_operations_cycles'",
 "safeListEvidence(supabase,'workability_observations'",
 "r.row_count>=r.limit","Date.parse(r.retrieved_at)>300000",
 "source_verified","unresolved_count","unresolved_gaps",
 "trial_acceptance:'operator_review_required'",
 "seasonSamples.size>=3","hasMatchingWorkability","const steps=[",
 "No server-side owner signoff was recorded.",
 "state:'withheld'","result.length>25"
])assert.ok(block.includes(word),'Owner evidence guard absent: '+word);
assert.doesNotMatch(block,/\.(insert|upsert|update|delete)\s*\(/);
assert.ok(backend.slice(0,start).includes("'owner_first_use_trial_acceptance'].includes(key)"),
 'Owner admin-manage module requirement missing');
const ui=read('js/owner-first-use-trial-acceptance-416.js');new Function(ui);
for(const word of ['owner416','owner_first_use_trial_acceptance',
 'Date.now()-t<=300000','data-owner416-state',
 'r.steps.length!==10','Copy unresolved-gap review','navigator.clipboard.writeText',
 "review_status:'owner_review_pending'",'NOT server-stored acceptance',
 'No first-use cohort exists','Source verified (operator acceptance pending)'])
 assert.ok(ui.includes(word),'Owner UI evidence guard missing: '+word);
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:owner-first-use-trial-acceptance-416'],
 'node scripts/owner-first-use-trial-acceptance-416-check.mjs');
assert.ok(pkg.scripts['test:browser:owner-first-use-trial-acceptance-416'].includes(
 'tests/browser/owner-first-use-trial-acceptance-416.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const word of ['npm run test:owner-first-use-trial-acceptance-416',
 'npm run test:browser:owner-first-use-trial-acceptance-416'])
 assert.ok(ci.includes(word),'Owner browser/source CI gate not wired: '+word);
assert.ok(read('index.html').includes('/js/owner-first-use-trial-acceptance-416.js'));
assert.ok(read('help.html').includes('id="owner-first-use-trial-416"'));
console.log('Build 416 owner permission, 10 canonical checks, gaps, no-write and acceptance gates PASS');
