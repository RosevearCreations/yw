#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const review=read('docs/production_learning_review_362.json');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildCustomerCommunicationOutcomeFollowUpEffectiveness',
  "communication_outcomes:buildManagementMetricConfidence(sourceFreshness,['crm_interactions','crm_followups','notification_delivery','closeouts'])",
  'customer_communication_outcome_followup_effectiveness:customerCommunicationOutcomeFollowUpEffectiveness',
  'outbound_interactions','recorded_inbound_responses','outbound_outcomes_recorded',
  'followups_completed','followups_completed_on_time','followups_completed_late','followups_overdue',
  'repeated_unresolved_work_orders','notification_sent','notification_delivery_attention',
  "response_state:response?'recorded_inbound_response'",
  "timeliness=completed",
  "r.outbound_count>=2&&!r.response_at",
  "response_boundary:'A recorded customer response requires a later inbound CRM interaction linked to the same work order",
  "outcome_boundary:'CRM interaction outcome/status is reported separately from response evidence.",
  "delivery_boundary:'Notification status sent is provider delivery evidence only.",
  "recurrence_boundary:'Repeated unresolved outreach means at least two recorded outbound CRM interactions",
  "authority_boundary:'Read-only communication-outcome evidence."
],'Build 372 server');

const start=directory.indexOf('function buildCustomerCommunicationOutcomeFollowUpEffectiveness');
const end=directory.indexOf('function buildDataQualityDuplicateOrphanReconciliation',start);
const b372=directory.slice(start,end);
assert.ok(b372.length>6000,'Build 372 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b372),'Build 372 helper must remain read-only');
for(const forbidden of ['billing_email','contact_email','public_token','customer_score','auto_close_followup','provider_send']) assert.ok(!b372.includes(forbidden),'Build 372 must not expose or introduce '+forbidden);

must(ui,[
  'Customer communication outcome &amp; follow-up effectiveness','owner372CommunicationOutcomes','renderCommunicationOutcomes',
  "state.data?.customer_communication_outcome_followup_effectiveness","metricMeta('communication_outcomes')",
  'Outbound CRM','Recorded responses','Outcome recorded','Follow-ups completed','Completed on time','Open overdue',
  'Provider sent','Delivery attention','Repeated unresolved',
  'Recorded outreach outcome evidence','Follow-up completion &amp; timeliness','Completion follow-up outcomes',
  'Repeated outreach needing review','Protected provider delivery outcomes','Channel &amp; four-season context',
  'Outcome evidence only — no customer score:','renderCommunicationOutcomes();'
],'Build 372 UI');

must(review,['"item": 372','"title": "Customer Communication Outcome & Follow-Up Effectiveness"'],'Build 362 learning authority for 372');
assert.equal(pkg.scripts['test:customer-communication-outcome-followup-effectiveness'],'node scripts/customer-communication-outcome-followup-effectiveness-check.mjs');
assert.equal(pkg.scripts['test:browser:customer-communication-outcome-followup-effectiveness'],'playwright test --config=playwright.config.mjs tests/browser/customer-communication-outcome-followup-effectiveness.spec.mjs');
must(workflow,['npm run test:customer-communication-outcome-followup-effectiveness','npm run test:browser:customer-communication-outcome-followup-effectiveness'],'Build 372 CI');

must(help,[
  'Build 372 — Customer Communication Outcome &amp; Follow-Up Effectiveness','Recorded response is explicit',
  'Follow-up timeliness stays evidence-based','Provider sent is not customer engagement',
  'Repeated unresolved outreach is a review signal','No automatic customer contact'
],'Build 372 help');

must(roadmap,[
  '#### **372 — Customer Communication Outcome & Follow-Up Effectiveness** is implemented',
  'The next planned autonomous item is **373 — Data Quality Remediation Outcome & Recurrence Prevention**.'
],'Build 372 roadmap');

must(handbook,[
  '**372 — Customer Communication Outcome & Follow-Up Effectiveness** is implemented',
  '- **373 — Data Quality Remediation Outcome & Recurrence Prevention**',
  'After item 372, that item is 373 — Data Quality Remediation Outcome & Recurrence Prevention.'
],'Build 372 handoff');

console.log('Build 372 Customer Communication Outcome & Follow-Up Effectiveness source gate GREEN');
