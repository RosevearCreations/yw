import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewComparableFirstJobs} from '../js/first-job-outcome-comparison-417.mjs';
const review=JSON.parse(fs.readFileSync('docs/production_learning_review_417.json','utf8'));
const roadmap=fs.readFileSync('docs/RENEWED_ROADMAP_418_429.md','utf8');
assert.equal(review.item,417);
assert.equal(review.observed_at_utc,'2026-10-20T03:27:31.390718Z');
assert.deepEqual(Object.values(review.sources),Array(7).fill(0));
assert.equal(review.comparison.status,'withheld');
assert.equal(review.comparison.roi,null);
assert.equal(review.released_builds_under_review.length,11);
assert.deepEqual(review.next_queue.map(x=>x.build),Array.from({length:12},(_,i)=>i+418));
for(const x of review.next_queue){
 assert.ok(roadmap.includes('### '+x.build+' — '+x.title));
 assert.ok(x.source.length>10&&x.acceptance.length>35&&x.boundary.length>20);
}
const now='2026-10-20T03:27:00Z';
const sample=(n,start,end)=>({authorized:true,query_ok:true,coverage:'complete',capped:false,
 retrieved_at:now,period_start:start,period_end:end,
 jobs:Array.from({length:n},(_,i)=>({first_job_id:'j'+i,customer_id:'c'+i,first_order_at:start,
 scheduled_at:start,started_at:start,qc_approved_at:start,invoiced_at:start}))});
const prev=sample(10,'2026-09-01T00:00:00Z','2026-09-15T00:00:00Z');
const curr=sample(10,'2026-09-16T00:00:00Z','2026-10-01T00:00:00Z');
const ok=reviewComparableFirstJobs({previous:prev,current:curr},now);
assert.equal(ok.status,'descriptive_only');assert.equal(ok.comparisons[0].previous_rate,1);
assert.equal(reviewComparableFirstJobs({previous:sample(9,prev.period_start,prev.period_end),current:curr},now).status,'withheld');
for(const [field,val] of [['authorized',false],['capped',true],['coverage','partial'],['retrieved_at','2026-10-19T00:00:00Z']]){
 assert.equal(reviewComparableFirstJobs({previous:{...prev,[field]:val},current:curr},now).status,'withheld');
}
const dup=structuredClone(prev);dup.jobs[1].customer_id=dup.jobs[0].customer_id;
assert.equal(reviewComparableFirstJobs({previous:dup,current:curr},now).status,'withheld');
const bad=structuredClone(curr);bad.jobs[0].started_at='2026-08-01T00:00:00Z';
assert.equal(reviewComparableFirstJobs({previous:prev,current:bad},now).status,'withheld');
const gap=structuredClone(curr);gap.jobs[0].qc_approved_at=null;gap.jobs[0].invoiced_at=null;
const res=reviewComparableFirstJobs({previous:prev,current:gap},now);
assert.equal(res.status,'descriptive_only');assert.equal(res.comparisons.at(-1).status,'withheld');
assert.equal(res.comparisons.at(-1).rate_difference,null);
assert.equal(reviewComparableFirstJobs({previous:prev,current:{...curr,period_start:'2026-09-10T00:00:00Z'}},now).status,'withheld');
console.log('Build 417 review, roadmap, withholding and comparison guard: PASS');
