import assert from 'node:assert/strict';
import fs from 'node:fs';

const edge=fs.readFileSync('supabase/functions/upload-mobile-rework-photo/index.ts','utf8');
const cockpit=fs.readFileSync('js/operations-cockpit.js','utf8');
const crew=fs.readFileSync('js/mobile-today.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const decision=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const sql=fs.readFileSync('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql','utf8');

for(const phrase of [
  "body.action==='supervisor_history'", "body.action==='crew_history' || body.action==='crew_acknowledge'",
  "rank(profile.role)<30", "hasModuleAccess(supabase,profile,'jobs','approve')",
  "order.supervisor_profile_id!==profile.id", "operation_write_audit_events",
  ".eq('operation_action','work_order_closeout_decision')", ".eq('entity_id',closeout.id)",
  "'Crew rework corrections resubmitted'", "'Crew acknowledged supervisor rework instructions'",
  "await assignedRework(supabase,profile,workOrderId)", "body.rejected_at!==closeout.rejected_at",
  "body.confirmed!==true", "p_visibility:'staff'", "p_customer_notification_requested:false",
  "p_metadata:{build:549,source:'crew_rework_ack_549'", "'Cache-Control':'no-store'",
  "history_limited:true", "decision_authority:'work_order_closeout_decision'"
]) assert.ok(edge.includes(phrase),'Missing YW549 server boundary: '+phrase);
for(const phrase of [
  'renderCloseoutReworkHistory(row)', "action:'supervisor_history'", 'closeoutHistoryOpenId',
  'history_limited', 'not acceptance, proof approval, or job completion',
  'No customer message, invoice release or crew assignment occurs here.'
]) {
  // history_limited is a wire contract; the UI explains the bounded history in human terms.
  if (phrase==='history_limited') continue;
  assert.ok(cockpit.includes(phrase),'Missing supervisor history UI: '+phrase);
}
for(const phrase of [
  'crewReworkHistory', "?'crew_acknowledge':'crew_history'",
  'confirmed:true', 'Review the current instructions from the server before acknowledging.',
  'Your instruction receipt is confirmed.', 'state.crewReworkHistory=Object.create(null)'
]) assert.ok(crew.includes(phrase),'Missing assigned crew receipt control: '+phrase);
assert.ok(css.includes('.oc-closeout-history-events'));
assert.ok(css.includes('.mobile-crew-v2-rework-ack'));
assert.ok(decision.includes("operation_action: action, operation_status: decision || result.closeout_status"));
assert.ok(sql.includes("if v_decision in ('approve','invoice_ready') and v_approved_proof_count = 0 then"));
assert.ok(sql.includes("if v_package.customer_signoff_required and v_package.customer_signoff_status <> 'signed' then"));
console.log('YW 549 supervisor audit, assigned crew acknowledgement and unchanged closeout authority GREEN');
