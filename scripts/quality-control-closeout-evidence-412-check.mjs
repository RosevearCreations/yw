import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if(scope==='first_job_quality_closeout_evidence')"),end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0&&end>start);const x=backend.slice(start,end);
for(const word of ["roleRank(actorRole)<roleRank('supervisor')",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'v_quality_control_run_directory'",
 "safeListEvidence(supabase,'work_order_closeout_packages'",
 "safeListEvidence(supabase,'work_order_execution_proofs'",
 "safeListEvidence(supabase,'work_order_closeout_gallery_items'",
 "safeListEvidence(supabase,'visual_asset_approval_items'",
 "r.row_count>=r.limit","internal_approval_ready","required_item_passed_count",
 "failed_item_count","unresolved_deficiency_count","qc.ready_for_closeout===true",
 "qc.review_status==='approved'","dated(qc.reviewed_at)","dated(c.approved_at)",
 "p.customer_visible===true","p.proof_status==='approved'",
 "asset.asset_status","asset.consent_status","asset.compression_status",
 "customer_signoff_required","evidence_state:state","state:'withheld'"])
 assert.ok(x.includes(word),'Missing QC security/authority '+word);
assert.doesNotMatch(x,/\.(insert|upsert|update|delete)\s*\(/);
assert.ok(backend.slice(0,start).includes("'first_job_quality_closeout_evidence'"));
const ui=read('js/quality-control-closeout-evidence-412.js');
new Function(ui);
for(const word of ['quality412','first_job_quality_closeout_evidence',
 'Date.now()-t<=300000','data-quality412-state','qc_closeout_proof_verified',
 'esc(r.customer_signoff_state','approved_customer_gallery_asset_count'])
 assert.ok(ui.includes(word),'Missing read-only QC UI '+word);
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:quality-control-closeout-evidence-412'],'node scripts/quality-control-closeout-evidence-412-check.mjs');
assert.ok(pkg.scripts['test:browser:quality-control-closeout-evidence-412'].includes('tests/browser/quality-control-closeout-evidence-412.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const word of ['npm run test:quality-control-closeout-evidence-412','npm run test:browser:quality-control-closeout-evidence-412'])assert.ok(ci.includes(word));
assert.ok(read('index.html').includes('js/quality-control-closeout-evidence-412.js'));
assert.ok(read('help.html').includes('id="quality-control-closeout-evidence-412"'));
console.log('Build 412 QC source, supervisor approval and customer-safe closeout gates PASS');
