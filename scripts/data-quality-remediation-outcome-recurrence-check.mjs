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
const index=read('index.html');
const publicRoutes=read('js/public-routes.js');
const portal=read('js/customer-portal.js');
const adminSecurity=read('js/admin-account-security-ui.js');
const notification=read('supabase/functions/customer-notification-dispatch/index.ts');
const readme=read('README.md');
const browser=read('tests/browser/data-quality-remediation-outcome-recurrence.spec.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildDataQualityRemediationOutcomeRecurrence',
  "source_type:'data_quality_signal'",
  "source_key:'admin:data_quality_signal:'+sourceId",
  "safeListEvidence(supabase,'v_management_decision_outcome_journal'",
  "data_quality_remediation_outcomes:buildManagementMetricConfidence",
  'data_quality_remediation_outcome_recurrence:dataQualityRemediationOutcomeRecurrence',
  'still_open_tracked','still_open_untracked','recurring_current','confirmed_resolved',
  "['resolved','improved'].includes(norm(r?.outcome_status))",
  "current_signal_after_recorded_resolution",
  "coverageComplete:dataQualityOutcomeReads.every((r)=>r.query_ok!==false&&Number(r.row_count||0)<Number(r.limit||1))",
  "source_key_boundary:'Each Build 360 signal uses a stable admin:data_quality_signal source key",
  "resolution_boundary:'A journal row is shown as confirmed resolved by absence only when every source required by the data-quality scan",
  "recurrence_boundary:'A currently detected signal is recurring when the same source key",
  "prevention_boundary:'Recurrence-prevention guidance is advisory root-cause review only.",
  "journal_boundary:'The existing private Management Decision Outcome Journal",
  "authority_boundary:'Read-only remediation outcome evidence."
],'Build 373 server');

const start=directory.indexOf('function buildDataQualityRemediationOutcomeRecurrence');
const end=directory.indexOf('function buildWorkabilityScheduleRecoveryOutcomes',start);
const b373=directory.slice(start,end);
assert.ok(b373.length>6500,'Build 373 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b373),'Build 373 helper must remain read-only');
for(const forbidden of ['merge_customer','delete_customer','delete_property','rewrite_foreign_key','clear_lockout','reassign_equipment','reassign_crew']){
  assert.ok(!b373.includes(forbidden),'Build 373 must not introduce destructive source mutation '+forbidden);
}

must(ui,[
  'Data quality remediation outcome &amp; recurrence prevention','owner373DataQualityOutcomes','renderDataQualityRemediationOutcomes',
  "state.data?.data_quality_remediation_outcome_recurrence","metricMeta('data_quality_remediation_outcomes')",
  'Current signals','Open · tracked','Open · untracked','Recurring','Confirmed resolved','Journal rows',
  'Current remediation outcomes','Confirmed resolved history','Recurring defects &amp; prevention review',
  'Signal-type outcome coverage','Source-key, resolution, recurrence &amp; authority boundaries',
  'Resolution by absence withheld:','Outcome tracking only — no auto-fix:','renderDataQualityRemediationOutcomes();'
],'Build 373 UI');

must(review,['"item": 373','"title": "Data Quality Remediation Outcome & Recurrence Prevention"'],'Build 362 learning authority for 373');
assert.equal(pkg.scripts['test:data-quality-remediation-outcome-recurrence'],'node scripts/data-quality-remediation-outcome-recurrence-check.mjs');
assert.equal(pkg.scripts['test:browser:data-quality-remediation-outcome-recurrence'],'playwright test --config=playwright.config.mjs tests/browser/data-quality-remediation-outcome-recurrence.spec.mjs');
must(workflow,['npm run test:data-quality-remediation-outcome-recurrence','npm run test:browser:data-quality-remediation-outcome-recurrence'],'Build 373 CI');

must(help,[
  'Build 373 — Data Quality Remediation Outcome &amp; Recurrence Prevention',
  'Stable source-key history','Resolution by absence fails closed','Recurring after remediation',
  'Prevention is advisory','No destructive reconciliation authority'
],'Build 373 help');

must(roadmap,[
  '#### **373 — Data Quality Remediation Outcome & Recurrence Prevention** is implemented',
  'The next planned autonomous item is **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes**.'
],'Build 373 roadmap');
must(handbook,[
  '**373 — Data Quality Remediation Outcome & Recurrence Prevention** is implemented',
  '- **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes**',
  'After item 373, that item is 374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes.'
],'Build 373 handoff');

for(const [label,source] of [
  ['index',index],['public routes',publicRoutes],['customer portal',portal],['help',help],
  ['admin security',adminSecurity],['notification dispatch',notification],['README',readme]
]){
  assert.ok(source.includes('Yard Workers'),label+' must use Yard Workers display brand');
  assert.ok(!source.includes('Yard Weasels'),label+' must not retain old Yard Weasels display brand');
}
assert.ok(index.includes('https://yardweasels.ca/'),'Brand rename must preserve the current canonical domain.');
assert.ok(browser.includes('admin:data_quality_signal:'),'Build 373 browser acceptance must render stable source-key identity.');

console.log('Build 373 Data Quality Remediation Outcome & Recurrence Prevention + Yard Workers branding source gate GREEN');
