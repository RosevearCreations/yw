import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const server=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const hand=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const html=read('index.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const must=(s,a,label)=>a.forEach(x=>assert.ok(s.includes(x),label+': '+x));
const start=server.indexOf('function buildRecurringRetentionCohortRenewalLag(');
const end=server.indexOf('function buildRecurringRenewalConversionChurnOutcomes(',start);
assert.ok(start>=0&&end>start,'standalone bounded recurring cohort computation');
const block=server.slice(start,end);
assert.ok(!/\.(insert|upsert|delete|update)\s*\(/.test(block),'no source mutation');
must(server,['recurring_retention_cohort_lag:buildManagementMetricConfidence',
  'recurring_retention_cohort_renewal_lag:recurringRetentionCohortRenewalLag',
  'coverageComplete:[recurringRead,crmRenewalsRead,crmInteractionsRead,seasonalRolloverRead].every',
  'outcomes:recurringRenewalConversionChurnOutcomes'],'server wiring');
must(ui,['id="owner380Cohorts"','function renderRecurringRetentionCohortRenewalLag',
  'renderRecurringRetentionCohortRenewalLag();','data-owner380-cohort','data-owner380-season',
  '/help.html#recurring-retention-cohort-renewal-lag'],'UI');
must(help,['id="recurring-retention-cohort-renewal-lag"','five or more explicit decisions','signed calendar days'],'Help');
must(roadmap,['#### **380 — Recurring Retention Cohort & Renewal Lag** is implemented',
  'The next planned autonomous item is **381 — Estimate Margin Drift & Change-Order Follow-through**'],'roadmap');
must(hand,['**380 — Recurring Retention Cohort & Renewal Lag** (implemented)',
  'After item 380, the next is 381'],'handbook');
must(html,['admin-owner-management-command-ui.js?v=2026-10-11b380'],'cache');
assert.equal(pkg.scripts['test:recurring-retention-cohort-renewal-lag'],'node scripts/recurring-retention-cohort-renewal-lag-check.mjs');
assert.equal(pkg.scripts['test:browser:recurring-retention-cohort-renewal-lag'],'playwright test --config=playwright.config.mjs tests/browser/recurring-retention-cohort-renewal-lag.spec.mjs');
must(workflow,['npm run test:recurring-retention-cohort-renewal-lag','npm run test:browser:recurring-retention-cohort-renewal-lag'],'CI');
const js=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const calculate=vm.runInNewContext(js+';buildRecurringRetentionCohortRenewalLag;',{
  ontarioDateKey:()=> '2026-10-11',addCalendarDays:(day,n)=>{
    const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
  }
});
const rows=[
  {agreement_id:'A1',end_date:'2026-09-30',outcome_state:'renewed',outcome_date:'2026-09-29',season_context:'fall'},
  {agreement_id:'A2',end_date:'2026-09-30',outcome_state:'renewed',outcome_date:'2026-09-30',season_context:'fall'},
  {agreement_id:'A3',end_date:'2026-09-30',outcome_state:'renewed',outcome_date:'2026-10-01',season_context:'fall'},
  {agreement_id:'A4',end_date:'2026-09-30',outcome_state:'renewed',outcome_date:'2026-10-02',season_context:'fall'},
  {agreement_id:'A5',end_date:'2026-09-30',outcome_state:'declined',outcome_date:'2026-09-28',season_context:'fall'},
  {agreement_id:'A6',end_date:'2026-09-30',outcome_state:'declined',outcome_date:null,season_context:'fall'},
  {agreement_id:'H1',end_date:'2026-09-30',outcome_state:'held',outcome_date:'2026-09-29',season_context:'fall'},
  {agreement_id:'U1',end_date:'2026-09-30',outcome_state:'unresolved',season_context:'winter'},
  {agreement_id:'F1',end_date:'2026-11-02',outcome_state:'renewed',outcome_date:'2026-10-01',season_context:'winter'},
  {agreement_id:'O1',end_date:null,outcome_state:'renewed',outcome_date:'2026-10-01',season_context:'spring_summer'}
];
const options={now:'2026-10-11',outcomes:{summary:{loaded_agreements:rows.length},outcomes:rows},
  jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,confidence:{state:'current'}};
const good=calculate(options);
assert.equal(good.state,'current');
assert.equal(good.summary.eligible_agreements,8);
assert.equal(good.summary.explicit_decision_count,6);
assert.equal(good.summary.renewed_count,4);
assert.equal(good.summary.held_count,1);
assert.equal(good.summary.unresolved_count,1);
assert.equal(good.summary.observed_retention_percent,66.7);
assert.equal(good.summary.valid_dated_decisions,5);
assert.equal(good.summary.average_signed_renewal_lag_days,0);
assert.equal(good.summary.median_signed_renewal_lag_days,0);
assert.equal(good.summary.missing_or_unusable_decision_lags,1);
assert.equal(good.summary.excluded_from_end_date_window,2);
assert.equal(good.cohorts[0].expiry_cohort,'2026-Q3');
assert.equal(good.seasons.find(x=>x.season_context==='winter').explicit_decision_count,0);
for(const [prop,value,state] of [['jobsVisible',false,'permission_hidden'],
  ['sourceQueriesOk',false,'source_unavailable'],['coverageComplete',false,'partial_coverage']]){
  assert.equal(calculate({...options,[prop]:value}).state,state);
}
assert.equal(calculate({...options,confidence:{state:'stale'}}).state,'evidence_unreliable');
assert.equal(calculate({...options,outcomes:{summary:{loaded_agreements:11},outcomes:rows}}).state,'partial_coverage');
const sparse=calculate({...options,outcomes:{summary:{loaded_agreements:3},outcomes:rows.slice(0,3)}});
assert.equal(sparse.summary.observed_retention_percent,null);
assert.equal(sparse.summary.average_signed_renewal_lag_days,null);
const noRows=calculate({...options,outcomes:{summary:{loaded_agreements:0},outcomes:[]}});
assert.equal(noRows.state,'insufficient_evidence');
assert.equal(noRows.summary.eligible_agreements,0);
const duplicated=calculate({...options,outcomes:{summary:{loaded_agreements:11},outcomes:[...rows,rows[0]]}});
assert.equal(duplicated.summary.eligible_agreements,8);
console.log('Build 380 explicit-decision cohort and signed lag deterministic tests: PASS');
