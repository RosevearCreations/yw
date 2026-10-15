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
console.log('Build 404 fail-closed cohort calculator acceptance: PASS');
