import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('js/visit-completion-qc-evidence-399.js','utf8');
const html=fs.readFileSync('index.html','utf8');
for(const s of ['quality_control','quality_control_runs','quality_control_deficiencies','quality_control_evidence','quality_control_work_orders','quality_control_execution_proofs','quality_control_sessions','quality_control_closeouts','customer_signoff_required','customer_signoff_status','BLOCKED / UNAVAILABLE','Query limit reached','busy=true','b.disabled=true'])assert.ok(src.includes(s),'Missing '+s);
assert.ok(html.includes('visit-completion-qc-evidence-399.js?v=20261014b399'));
assert.ok(!/manageOperations|manageJobsEntity|\.update\(|\.insert\(|\.delete\(/.test(src),'Read-only review must not make writes');
console.log('Build 399 source contract passed');
