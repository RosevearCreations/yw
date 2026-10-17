import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if (scope === 'first_dispatch_schedule_receipt')");
const end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0&&end>start);
const scope=backend.slice(start,end);
for(const word of [
 "roleRank(actorRole) < roleRank('supervisor')","hasModuleAccess",
 "safeListEvidence(supabase,'v_crew_dispatch_schedule'",
 "safeListEvidence(supabase,'v_weather_workability_queue'",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'estimates'","safeListEvidence(supabase,'work_orders'",
 "r.row_count>=r.limit","workflowById.size!==estimateById.size",
 "String(d.client_id||'')!==String(order.client_id||'')",
 "String(observation.work_order_id)!==String(schedule.work_order_id||'')",
 "cancelled","superseded","first_work_order_number","scheduled_start",
 "first_dispatch_id","conflict_count","crew_not_assigned",
 "unresolved_workability_exception","not_observed",
 "approval_evidence_missing","state:'withheld'",
 "Multiple noncancelled dispatches share the first scheduled start time."
]) assert.ok((scope+backend.slice(0,start)).includes(word),'Missing 409 source guard: '+word);
assert.doesNotMatch(scope,/\.(insert|upsert|update|delete)\s*\(/,'No writes in first-dispatch receipt');
const frontend=read('js/first-dispatch-schedule-receipt-409.js');
new Function(frontend);
for(const t of ['firstDispatch409','dispatch409Recheck','first_dispatch_schedule_receipt',
 'data-dispatch409-state','resource_exception_codes','workability_exception_state',
 'Date.now()-n<=300000','esc(r.schedule_status']) assert.ok(frontend.includes(t),'Missing UI '+t);
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
assert.equal(pkg.scripts['test:first-dispatch-schedule-receipt-409'],'node scripts/first-dispatch-schedule-receipt-409-check.mjs');
assert.ok(pkg.scripts['test:browser:first-dispatch-schedule-receipt-409'].includes('tests/browser/first-dispatch-schedule-receipt-409.spec.mjs'));
for(const t of ['npm run test:first-dispatch-schedule-receipt-409','npm run test:browser:first-dispatch-schedule-receipt-409'])assert.ok(ci.includes(t));
assert.ok(read('index.html').includes('/js/first-dispatch-schedule-receipt-409.js'));
assert.ok(read('help.html').includes('id="first-dispatch-schedule-receipt-409"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 409 — First-Dispatch Schedule Receipt'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('**409 — First-Dispatch Schedule Receipt**'));
console.log('Build 409 permission, dated dispatch, resource/workability boundaries, no-write, release wiring PASS');