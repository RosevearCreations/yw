import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if (scope === 'estimate_first_work_order_trace')");
const end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0&&end>start,'Canonical 408 scope not found');
const scope=backend.slice(start,end);
for(const t of [
 "roleRank(actorRole) < roleRank('supervisor')","hasModuleAccess",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'estimates'",
 "safeListEvidence(supabase,'work_orders'",
 "r.row_count>=r.limit","workflowIds.size!==byEstimate.size",
 "String(o.client_id||'')!==String(e.client_id||'')",
 "quote_accepted_at","approved_by_profile_id","approved_at",
 "customer_acceptance_not_verified","internal_approval_not_verified",
 "first_work_order_recorded","hold_for_review","state:'withheld'",
 "Ambiguous first work-order chronology","no automatic customer acceptance"
]) assert.ok((scope+backend.slice(0,start)).includes(t),'Missing 408 canonical guard '+t);
assert.doesNotMatch(scope,/\.(insert|upsert|update|delete)\s*\(/,'408 must never write');
const ui=read('js/estimate-first-work-order-trace-408.js');
for(const t of ['estimate408','estimate408Recheck','estimate_first_work_order_trace','data-estimate408-state','customer_acceptance_state','internal_approval_state','first_work_order_state','Date.now()-at<=300000','escapeHtml'])assert.ok(ui.includes(t),'Missing UI or read guard '+t);
new Function(ui);
const index=read('index.html');
const help=read('help.html');
const docs=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
assert.ok(index.includes('js/estimate-first-work-order-trace-408.js'));
assert.ok(help.includes('id="estimate-first-work-order-trace-408"'));
assert.ok(docs.includes('#### 408 — Estimate Acceptance to First Work Order Trace'));
assert.ok(handbook.includes('**408 — Estimate Acceptance to First Work Order Trace**'));
assert.equal(pkg.scripts['test:estimate-first-work-order-trace-408'],'node scripts/estimate-first-work-order-trace-408-check.mjs');
assert.ok(pkg.scripts['test:browser:estimate-first-work-order-trace-408'].includes('tests/browser/estimate-first-work-order-trace-408.spec.mjs'));
assert.ok(ci.includes('npm run test:estimate-first-work-order-trace-408'));
assert.ok(ci.includes('npm run test:browser:estimate-first-work-order-trace-408'));
console.log('Item 408 identity, date, complete source, permission, no-write contract: PASS');