#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildCustomerCommunicationReadinessQueue','v_crm_followup_queue','v_crm_customer_directory',
  'v_customer_notification_delivery_queue','v_work_order_closeout_queue',
  "communication_readiness:buildManagementMetricConfidence",
  'customer_communication_readiness_queue:customerCommunicationReadinessQueue',
  "dedupe_key:'schedule:'","signal_type:'weather_workability_change'","signal_type:changed?'eta_change':'reschedule_notice'",
  "signal_type:'completion_followup'","signal_type:'recurring_service_notice'","signal_type:'overdue_customer_followup'",
  "signal_type:'invoice_reminder_candidate'",
  "completion_boundary:'A completion follow-up is suppressed when an outbound CRM interaction linked to the same work order",
  "context_boundary:'Message context is assembled from source references",
  "delivery_boundary:'Existing notification outbox state is review evidence only",
  "authority_boundary:'Read-only readiness and queue-quality evidence"
],'Build 359 server');

const b359=directory.slice(directory.indexOf('function buildCustomerCommunicationReadinessQueue'),directory.indexOf('function buildDataQualityDuplicateOrphanReconciliation'));
assert.ok(b359.length>2500,'Build 359 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b359),'Build 359 helper must remain read-only');
assert.ok(!b359.includes('billing_email')&&!b359.includes('contact_email')&&!b359.includes('public_token'),'Build 359 helper must not return customer email/portal-token fields.');
must(b359,[
  "Workability and dispatch schedule-change evidence collapse to one work-order communication candidate",
  "Customer email addresses, phone numbers and portal tokens are not returned",
  "no message is sent and no customer preference is inferred",
  "cannot send reminders, collect payment or mutate A/R",
  "does not send email/text, publish live updates, reschedule work"
],'Build 359 boundaries');

must(ui,[
  'Build 350–360','Customer communication readiness &amp; queue quality','owner359Communications','renderCommunicationReadiness',
  'Ready for review','Weather / workability','Reschedule / ETA','Completion follow-up','Recurring notices','Overdue follow-up',
  'Invoice reminders','Merged multi-source','Communication readiness queue','Protected delivery attention','Review only — no send:',
  'Build 360 data-quality duplicate/orphan reconciliation evidence refreshed'
],'Build 359 UI');

assert.equal(pkg.scripts['test:customer-communication-readiness-queue-quality'],'node scripts/customer-communication-readiness-queue-quality-check.mjs');
assert.equal(pkg.scripts['test:browser:customer-communication-readiness-queue-quality'],'playwright test --config=playwright.config.mjs tests/browser/customer-communication-readiness-queue-quality.spec.mjs');
must(workflow,['npm run test:customer-communication-readiness-queue-quality','npm run test:browser:customer-communication-readiness-queue-quality'],'Build 359 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 359 asset');
must(help,['Build 359 — Customer Communication Readiness &amp; Queue Quality','Weather, reschedule and ETA context','Completion follow-up suppression','Recurring-service notice readiness','Overdue CRM and invoice reminder candidates','No automatic sending'],'Build 359 help');
must(roadmap,['#### **359 — Customer Communication Readiness & Queue Quality** is implemented','The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.'],'Build 359 roadmap');
must(handbook,['**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented','After item 363, that item is 364 — Workability-to-Schedule Recovery Outcomes.'],'Build 359 handoff');
console.log('Build 359 Customer Communication Readiness & Queue Quality source gate GREEN');
