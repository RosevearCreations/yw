import assert from 'node:assert/strict';
import fs from 'node:fs';
const edge=fs.readFileSync('supabase/functions/upload-mobile-rework-photo/index.ts','utf8');
const cockpit=fs.readFileSync('js/operations-cockpit.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const sql=fs.readFileSync('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql','utf8');
for (const expected of [
  "body.action==='supervisor_review'", "hasModuleAccess(supabase,profile,'jobs','approve')",
  'rank(profile.role)<30', 'order.supervisor_profile_id!==profile.id',
  '.eq(\'work_order_id\',order.id)', "p.title==='Crew rework correction'",
  "asset.review_storage_bucket!==BUCKET", "asset.metadata?.closeout_id!==closeout.id",
  'createSignedUrl(asset.review_storage_path,300)', "'Cache-Control':'no-store'",
  'correction_proof:latestCorrection', "item.metadata?.source==='mobile_rework_resubmission'", 'staff_only:true'
]) assert.ok(edge.includes(expected),'Missing private supervisor photo guard: '+expected);
for (const expected of [
  'closeoutPhotoOpenId', "action:'supervisor_review'", 'closeoutSafePhotoUrl',
  'renderCloseoutPhotoReview(row)', 'Links expire after five minutes',
  'No decision was changed.', 'Only the server-controlled approved-proof and closeout rules authorize approval.',
  'No customer messages, approval or invoice actions are sent by viewing these images.'
]) assert.ok(cockpit.includes(expected),'Missing supervisor comparison UI: '+expected);
assert.ok(css.includes('.oc-closeout-photo-pair'));
assert.ok(sql.includes("if v_decision in ('approve','invoice_ready') and v_approved_proof_count = 0 then"));
assert.ok(sql.includes("if v_package.customer_signoff_required and v_package.customer_signoff_status <> 'signed' then"));
console.log('YW 548 private supervisor comparison, permission boundary, staff-only closure semantics GREEN');
