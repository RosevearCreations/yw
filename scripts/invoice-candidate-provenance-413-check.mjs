import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if(scope==='first_job_invoice_candidate_provenance')"),end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0&&end>start);const s=backend.slice(start,end);
for(const word of ["roleRank(actorRole)<roleRank('supervisor')",
 "hasModuleAccess(supabase,actorProfile,'jobs','view')",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'work_order_closeout_packages'",
 "safeListEvidence(supabase,'v_quality_control_run_directory'",
 "safeListEvidence(supabase,'job_invoice_candidates'",
 "r.row_count>=r.limit","internal_approval_ready","required_item_passed_count",
 "qc.ready_for_closeout===true","qc.review_status==='approved'",
 "close.invoice_readiness_status==='ready'","close.customer_signoff_required",
 "c.completion_review_id","candidate_draft_pending_review","candidate_ready_unposted",
 "candidate_provenance_missing","candidate_posted_requires_invoice_reconciliation",
 "String(c.client_id)!==String(order.client_id)","state:'withheld'"])
 assert.ok(s.includes(word),'Missing Finance candidate provenance guard '+word);
assert.doesNotMatch(s,/\.(insert|upsert|update|delete)\s*\(/);
assert.ok(backend.slice(0,start).includes("'first_job_invoice_candidate_provenance'"));
const ui=read('js/invoice-candidate-provenance-413.js');new Function(ui);
for(const word of ['candidate413','first_job_invoice_candidate_provenance',
 'Date.now()-t<=300000','data-candidate413-state','candidate_draft_pending_review',
 'esc(r.invoice_candidate_number'])assert.ok(ui.includes(word),'Missing Finance candidate UI '+word);
const p=JSON.parse(read('package.json'));
assert.equal(p.scripts['test:invoice-candidate-provenance-413'],'node scripts/invoice-candidate-provenance-413-check.mjs');
assert.ok(p.scripts['test:browser:invoice-candidate-provenance-413'].includes('tests/browser/invoice-candidate-provenance-413.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const word of ['npm run test:invoice-candidate-provenance-413','npm run test:browser:invoice-candidate-provenance-413'])
 assert.ok(ci.includes(word));
assert.ok(read('index.html').includes('js/invoice-candidate-provenance-413.js'));
assert.ok(read('help.html').includes('id="invoice-candidate-provenance-413"'));
console.log('Build 413 canonical QC/Finance candidate identities, approval and no-write contracts PASS');
