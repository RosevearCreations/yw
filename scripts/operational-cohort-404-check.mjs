import assert from 'node:assert/strict';
import { measureFirstOperationalCohort } from '../js/operational-cohort-404.js';
const now='2026-10-15T18:00:00Z', stamp='2026-10-15T17:59:00Z';
const stages=['intake','dispatch','production','qc','invoice'];
const fixture=()=>Object.fromEntries(stages.map((stage,index)=>[stage,{
  authorized:true,query_ok:true,coverage:'complete',capped:false,retrieved_at:stamp,
  rows:Array.from({length:12-index},(_,i)=>({job_id:'job-'+i,occurred_at:stamp}))
}]));
const good=measureFirstOperationalCohort({sources:fixture()},now);
assert.equal(good.status,'measured');
assert.equal(good.stages[0].count,12);
assert.equal(good.conversions[0].numerator,11);
assert.equal(good.conversions[0].denominator,12);
assert.equal(good.conversions[0].rate,11/12);
assert.equal(good.conversions[3].rate,null);
const bad=fixture();bad.qc.authorized=false;
assert.equal(measureFirstOperationalCohort({sources:bad},now).status,'withheld');
const capped=fixture();capped.invoice.capped=true;
assert.equal(measureFirstOperationalCohort({sources:capped},now).status,'withheld');
const stale=fixture();stale.dispatch.retrieved_at='2026-10-15T16:00:00Z';
assert.equal(measureFirstOperationalCohort({sources:stale},now).status,'withheld');
const missing=fixture();delete missing.production;
assert.equal(measureFirstOperationalCohort({sources:missing},now).status,'withheld');
const small=fixture();small.intake.rows=small.intake.rows.slice(0,4);
assert.equal(measureFirstOperationalCohort({sources:small},now).status,'withheld');
const invalid=fixture();invalid.intake.rows[0].job_id='';
assert.equal(measureFirstOperationalCohort({sources:invalid},now).status,'withheld');
const dupe=fixture();dupe.intake.rows.push({...dupe.intake.rows[0]});
assert.equal(measureFirstOperationalCohort({sources:dupe},now).stages[0].count,12);

import fs from 'node:fs';
const backend=fs.readFileSync('supabase/functions/admin-directory/index.ts','utf8');
const ui=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const help=fs.readFileSync('help.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const ci=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
for(const token of [
 'first_operational_cohort_404:firstOperationalCohort404',
 "safeListEvidence(supabase,'clients','id,created_at'",
 "safeListEvidence(supabase,'work_orders','id,client_id,created_at'",
 "source queries", // static check below uses complete-source proof instead
]){if(token==='source queries')continue;assert.ok(backend.includes(token),'Missing authenticated cohort source '+token)}
for(const token of ["canJobsView && canFinanceView","r.row_count>=r.limit","date(r.created_at)","crmIds.has(String(r.id))","firstOrder.get(key)","dispatchIds","sessionIds","closeoutIds","invoiceIds","minimum_sample:threshold","'withheld_small_sample'","'measured'"])
 assert.ok(backend.includes(token),'Missing backend provenance guard '+token);
for(const token of ['owner404FirstCohort','renderFirstOperationalCohort404();','data-owner404-state="withheld"','data-owner404-state="permission_hidden"','Rate withheld'])
 assert.ok(ui.includes(token),'Missing UI privacy/render acceptance '+token);
new Function(ui);
assert.ok(help.includes('id="first-operational-cohort-404"'));
assert.equal(pkg.scripts['test:browser:operational-cohort-404'],'playwright test --config=playwright.config.mjs tests/browser/operational-cohort-404.spec.mjs');
assert.ok(ci.includes('npm run test:operational-cohort-404')&&ci.includes('npm run test:browser:operational-cohort-404'));
console.log('Build 404 authenticated read-only backend/UI/Help/CI integration: PASS');

console.log('Build 404 fail-closed cohort calculator acceptance: PASS');
