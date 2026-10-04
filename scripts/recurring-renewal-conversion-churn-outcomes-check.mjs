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
  'function buildRecurringRenewalConversionChurnOutcomes',
  "recurring_outcomes:buildManagementMetricConfidence(sourceFreshness,['recurring','crm_renewals','crm_interactions','seasonal_rollover'])",
  'recurring_renewal_conversion_churn_outcomes:recurringRenewalConversionChurnOutcomes',
  "outcomeState='renewed'","outcomeState='declined'","outcomeState='held'","outcomeState='expired'",
  "outcomeState='unresolved'",
  'recorded_renewal_conversion_rate_percent','recorded_churn_outcome_count',
  'reason_evidence','unresolved_service_issue_count','outcome_groups',
  "classification_boundary:'Renewed and declined require explicit CRM/seasonal renewal-decision evidence",
  "conversion_boundary:'Recorded renewal conversion rate is renewed divided by explicit renewed plus declined decisions only.",
  "churn_boundary:'Recorded churn outcomes are explicit declined plus expired outcomes only.",
  "finance_boundary:'Profit and margin are shown only when Finance evidence is visible and recorded.",
  "authority_boundary:'Read-only outcome learning only."
],'Build 366 server');

must(ui,[
  'Recurring renewal conversion &amp; churn outcomes','owner366Outcomes','renderRecurringOutcomes',
  "state.data?.recurring_renewal_conversion_churn_outcomes","metricMeta('recurring_outcomes')",
  'Renewed','Declined','Held','Expired','Unresolved','Recorded conversion',
  'Recorded renewal and churn outcomes','Outcome mix','Classification and authority boundaries',
  'Recorded outcomes only:','renderRecurringOutcomes();'
],'Build 366 UI');

must(review,[
  '"item": 366',
  '"title": "Recurring Renewal Conversion & Churn Outcomes"'
],'Build 362 learning authority for 366');

assert.equal(pkg.scripts['test:recurring-renewal-conversion-churn-outcomes'],'node scripts/recurring-renewal-conversion-churn-outcomes-check.mjs');
assert.equal(pkg.scripts['test:browser:recurring-renewal-conversion-churn-outcomes'],'playwright test --config=playwright.config.mjs tests/browser/recurring-renewal-conversion-churn-outcomes.spec.mjs');
must(workflow,['npm run test:recurring-renewal-conversion-churn-outcomes','npm run test:browser:recurring-renewal-conversion-churn-outcomes'],'Build 366 CI');

must(help,[
  'Build 366 — Recurring Renewal Conversion &amp; Churn Outcomes',
  'Explicit renewal evidence drives conversion','Churn remains evidence-bounded',
  'Finance is permission-scoped','No automatic customer or agreement action'
],'Build 366 help');

must(roadmap,[
  '#### **366 — Recurring Renewal Conversion & Churn Outcomes** is implemented',
  'The next planned autonomous item is **367 — Estimate Accuracy & Change-Order Margin Calibration**.'
],'Build 366 roadmap');

must(handbook,[
  '**366 — Recurring Renewal Conversion & Churn Outcomes** is implemented',
  '- **367 — Estimate Accuracy & Change-Order Margin Calibration**',
  'After item 366, that item is 367 — Estimate Accuracy & Change-Order Margin Calibration.'
],'Build 366 handoff');

assert.ok(!directory.includes('auto_renew_agreement'));
assert.ok(!directory.includes('auto_cancel_agreement'));
assert.ok(!directory.includes('auto_contact_customer'));
console.log('Build 366 Recurring Renewal Conversion & Churn Outcomes source gate GREEN');
