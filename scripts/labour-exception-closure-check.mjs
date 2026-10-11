import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ui=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const a=ui.indexOf('    function buildLabourExceptionClosureReadiness('),b=ui.indexOf('    function renderLabourExceptionClosureReadiness(',a);
assert.ok(a>=0&&b>a,'bounded read-only computation');
const fn=vm.runInNewContext(ui.slice(a,b)+';buildLabourExceptionClosureReadiness;');
const rows=[{job_id:'a',service_date:'2026-10-01',crew_id:'c',capture_complete:true,time_entry_count:1},
{job_id:'b',service_date:'2026-10-01',crew_id:'c',time_entry_count:0,open_review_count:1,pending_correction_count:1},
{job_id:'b',service_date:'2026-10-01',crew_id:'c',time_entry_count:0,open_review_count:1,pending_correction_count:1}];
const result=fn({work_unit_evidence:rows});
assert.equal(result.loaded,2);assert.equal(result.ready,1);assert.equal(result.missing,1);
assert.equal(result.open_review,1);assert.equal(result.pending_correction,1);assert.equal(result.candidates.length,1);
assert.ok(ui.includes('renderLabourExceptionClosureReadiness(w,meta)'));
assert.ok(fs.readFileSync('help.html','utf8').includes('id="labour-capture-exception-closure-shift-readiness"'));
assert.ok(!/\.(insert|upsert|delete|update)\s*\(/.test(ui.slice(a,ui.indexOf('    function renderLabourCapturePayrollExceptions(',b))));
console.log('Build 383 historical work-unit evidence PASS');
