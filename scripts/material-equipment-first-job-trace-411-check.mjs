import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const t=read('supabase/functions/admin-directory/index.ts'),i=t.indexOf("if (scope === 'material_equipment_first_job_trace')"),j=t.indexOf("if (scope === 'activity_timeline')",i);
assert.ok(i>0&&j>i);const s=t.slice(i,j);
for(const word of ["roleRank(actorRole)<roleRank('supervisor')",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'work_order_lines'",
 "safeListEvidence(supabase,'material_issues'",
 "safeListEvidence(supabase,'material_issue_lines'",
 "safeListEvidence(supabase,'equipment_signouts'",
 "safeListEvidence(supabase,'equipment_items'",
 "safeListEvidence(supabase,'v_landscape_production_session_directory'",
 "r.row_count>=r.limit","quote_package_id","internal_approval_ready",
 "work_order_line_id","String(l.unit_id||'')!==String(p.unit_id||'')",
 "job_session_id","production_recorded_by_profile_id","equipment_master_id",
 "is_locked_out","safety_lockout_hold","field_linked_receipts_recorded",
 "unmatched_or_capped_detail","trace_411","state:'withheld'"])
 assert.ok(s.includes(word),'Missing source guard '+word);
assert.doesNotMatch(s,/\.(insert|upsert|update|delete)\s*\(/);
assert.ok(t.slice(0,i).includes("'material_equipment_first_job_trace'].includes(key)"));
const ui=read('js/material-equipment-first-job-trace-411.js');new Function(ui);
for(const word of ['materialEquipment411','material_equipment_first_job_trace',
 'Date.now()-t<=300000','data-material411-state','current_lockout','esc(l.planned_quantity)'])
 assert.ok(ui.includes(word),'Missing UI guard '+word);
const p=JSON.parse(read('package.json'));
assert.equal(p.scripts['test:material-equipment-first-job-trace-411'],'node scripts/material-equipment-first-job-trace-411-check.mjs');
assert.ok(p.scripts['test:browser:material-equipment-first-job-trace-411'].includes('tests/browser/material-equipment-first-job-trace-411.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const word of ['npm run test:material-equipment-first-job-trace-411','npm run test:browser:material-equipment-first-job-trace-411'])
 assert.ok(ci.includes(word));
assert.ok(read('index.html').includes('js/material-equipment-first-job-trace-411.js'));
assert.ok(read('help.html').includes('id="material-equipment-first-job-411"'));
console.log('Build 411 first-job materials/equipment source, safety, UI and CI contract PASS');
