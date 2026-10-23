import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewCrossServiceFirstJobs429,SERVICE_KEYS_429} from '../js/cross-service-first-job-review-429.mjs';

const report=JSON.parse(fs.readFileSync('docs/production_learning_review_429.json','utf8'));
const roadmap=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const owner=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

assert.equal(report.item,429);
assert.equal(report.observed_at_utc,'2026-10-23T16:00:22.549425Z');
assert.equal(Object.keys(report.inspected_sources).length,17);
assert.deepEqual(Object.values(report.inspected_sources),Array(17).fill(0));
assert.deepEqual(report.six_service_trial.map(s=>s.service),SERVICE_KEYS_429);
assert.equal(report.comparison.status,'withheld');
assert.equal(report.comparison.roi,null);
assert.deepEqual(report.released_builds_under_review,Array.from({length:11},(_,i)=>i+418));
assert.deepEqual(report.new_bounded_queue.map(x=>x.build),Array.from({length:13},(_,i)=>i+430));
for(const q of report.new_bounded_queue){
  assert.ok(['P0','P1','P2'].includes(q.priority));
  assert.ok(q.acceptance.length>65&&q.source.length>25&&q.boundary.length>25);
  assert.ok(roadmap.includes('#### '+q.build+' — '+q.title));
}
assert.ok(roadmap.includes('#### 430 — Six-Service Owner Trial Intake & Source-Coverage Runbook'));
assert.ok(handbook.includes('Item 429 — Production Learning & Cross-Service Trial Review VI'));
assert.ok(help.includes('id="production-learning-cross-service-429"'));
assert.ok(owner.includes('data-build="429"'));
assert.ok(owner.includes('/help.html#production-learning-cross-service-429'));
assert.ok(workflow.includes('npm run test:cross-service-production-learning-429'));
assert.ok(workflow.includes('npm run test:browser:cross-service-production-learning-429'));
assert.ok(pkg.scripts['test:cross-service-production-learning-429']);

const now='2026-10-23T15:59:00Z';
const previousStart='2026-09-01T00:00:00Z',previousEnd='2026-09-16T00:00:00Z';
const currentStart='2026-09-16T00:00:00Z',currentEnd='2026-10-01T00:00:00Z';
function window(period,each=10){
  const start=period==='previous'?previousStart:currentStart,end=period==='previous'?previousEnd:currentEnd;
  return {company_id:'company-1',authorized:true,query_ok:true,coverage:'complete',capped:false,
    retrieved_at:now,period_start:start,period_end:end,services_covered:[...SERVICE_KEYS_429],
    jobs:SERVICE_KEYS_429.flatMap(service=>Array.from({length:each},(_,i)=>{
      const id=`${period}-${service}-${i}`;
      return {service,company_id:'company-1',first_job_id:id,original_work_order_id:id,
        customer_id:`customer-${id}`,property_id:`property-${id}`,
        first_order_at:start,scheduled_at:start,started_at:start,
        qc_approved_at:start,invoiced_at:start,
        company_work_order_verified:true,original_customer_property_verified:true,service_entitlement_verified:true};
    }))};
}
const p=window('previous'),c=window('current');
let result=reviewCrossServiceFirstJobs429({previous:p,current:c},now);
assert.equal(result.status,'descriptive_only');
assert.equal(result.services.length,6);
assert.ok(result.services.every(s=>s.status==='descriptive_only'));
assert.equal(result.services[0].stage_comparisons[0].rate_difference,0);
assert.equal(result.combined_roi,null);assert.equal(result.employee_ranking,null);
assert.equal(result.causal_improvement,null);
const assertWithheld=(modified)=>assert.equal(reviewCrossServiceFirstJobs429(modified,now).status,'withheld');
for(const [field,value] of [['authorized',false],['query_ok',false],['coverage','partial'],['capped',true],
  ['retrieved_at','2026-10-23T15:00:00Z'],['company_id','company-2']]){
  assertWithheld({previous:{...p,[field]:value},current:c});
}
assertWithheld({previous:{...p,services_covered:['landscape']},current:c});
assertWithheld({previous:{...p,period_end:currentStart.replace('16','17')},current:c});
const foreign=structuredClone(c);foreign.jobs[0].company_id='wrong-company';
assertWithheld({previous:p,current:foreign});
const duplicate=structuredClone(c);duplicate.jobs[1].first_job_id=duplicate.jobs[0].first_job_id;
assertWithheld({previous:p,current:duplicate});
const badSource=structuredClone(c);badSource.jobs[1].original_customer_property_verified=false;
assertWithheld({previous:p,current:badSource});
const overlap=structuredClone(c);overlap.jobs[0].first_job_id=p.jobs[0].first_job_id;
assertWithheld({previous:p,current:overlap});
const replay=structuredClone(c);replay.jobs[0].customer_id=p.jobs[0].customer_id;
assertWithheld({previous:p,current:replay});
const scant=structuredClone(c);scant.jobs=scant.jobs.filter(j=>j.service!=='septic').concat(scant.jobs.filter(j=>j.service==='septic').slice(0,9));
result=reviewCrossServiceFirstJobs429({previous:p,current:scant},now);
assert.equal(result.status,'partial_descriptive_only');
assert.equal(result.services.find(s=>s.service==='septic').status,'withheld');
assert.equal(result.services.find(s=>s.service==='landscape').status,'descriptive_only');
const noRows={...c,jobs:[]};
result=reviewCrossServiceFirstJobs429({previous:{...p,jobs:[]},current:noRows},now);
assert.equal(result.status,'withheld');
assert.ok(result.services.every(s=>s.previous_first_jobs===0&&s.current_first_jobs===0));
const misdated=structuredClone(c);misdated.jobs[0].started_at='2026-08-01T00:00:00Z';
result=reviewCrossServiceFirstJobs429({previous:p,current:misdated},now);
assert.equal(result.services.find(s=>s.service==='landscape').status,'withheld');
console.log('Build 429 source report, 13-release roadmap, six-service comparability and withholding: PASS');
