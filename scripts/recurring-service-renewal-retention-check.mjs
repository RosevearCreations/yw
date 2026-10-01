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
const must=(source,needles,label)=>needles.forEach(n=>assert.ok(source.includes(n),label+': missing '+n));

must(directory,[
  'function buildRecurringRenewalRetentionWorkbench',
  "recurring_service_visit_events","v_crm_renewal_queue","v_crm_interaction_timeline",
  "v_service_agreement_profitability_summary","v_seasonal_operations_rollover_directory",
  "recurring_retention:buildManagementMetricConfidence",
  'recurring_renewal_retention_workbench:recurringRenewalRetentionWorkbench',
  'renewal_candidate','retention_attention','price_review_candidate','repeated_service_friction',
  'unresolved_service_issue_count','seasonal_rollover_review_count',
  "margin_boundary:'Price-review candidates use only negative recorded agreement profit",
  "communication_boundary:'Renewal/contact suggestions are preparation context only.",
  "pricing_boundary:'Pricing review is advisory only.",
  "authority_boundary:'Recurring agreements, CRM interactions, seasonal rollover and Finance profitability remain their existing authorities"
],'Build 355 server');

must(ui,[
  'Build 350–360','Recurring service renewal &amp; retention workbench','owner355Retention','renderRecurringRetention',
  'Renewal candidates','Retention attention','Repeated service friction','Unresolved service issues','Customer holds','Price-review candidates',
  'Review only:','Renewal &amp; retention attention queue','Decision boundaries',
  'Build 360 data-quality duplicate/orphan reconciliation evidence refreshed'
],'Build 355 UI');

assert.ok(!directory.includes('auto_renew'));
assert.ok(!directory.includes('auto_price'));
assert.ok(!directory.includes('auto_message'));
assert.equal(pkg.scripts['test:recurring-service-renewal-retention'],'node scripts/recurring-service-renewal-retention-check.mjs');
assert.equal(pkg.scripts['test:browser:recurring-service-renewal-retention'],'playwright test --config=playwright.config.mjs tests/browser/recurring-service-renewal-retention.spec.mjs');
must(workflow,['npm run test:recurring-service-renewal-retention','npm run test:browser:recurring-service-renewal-retention'],'Build 355 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 355 asset version');
must(help,['Build 355 — Recurring Service Renewal &amp; Retention Workbench','Renewal windows and seasonal rollover','Service friction and unresolved issues','Price review without automatic pricing','No automatic renewal or messaging'],'Build 355 help');
must(roadmap,['#### **355 — Recurring Service Renewal & Retention Workbench** is implemented','#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.'],'Build 355 roadmap');
must(handbook,['**355 — Recurring Service Renewal & Retention Workbench** is implemented','**356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented'],'Build 355 handoff');

console.log('Build 355 Recurring Service Renewal & Retention Workbench source gate GREEN');
