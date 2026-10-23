// Build 429 — pure, read-only cross-service cohort review.
// Callers must supply fresh, permission-checked original-source snapshots; this module
// never queries a database, sends a message, changes an entitlement or writes a job.
import {reviewComparableFirstJobs} from './first-job-outcome-comparison-417.mjs';

export const SERVICE_KEYS_429=Object.freeze([
  'landscape','construction','water_parks','snow_removal','snow_plowing','septic'
]);
const MIN_PER_PERIOD=10;
const validId=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const validDate=v=>typeof v==='string'&&v.length>0&&Number.isFinite(Date.parse(v));
const withheld=reason=>({status:'withheld',reason,minimum_first_jobs_per_period:MIN_PER_PERIOD,
  services:SERVICE_KEYS_429.map(service=>({service,status:'withheld',reason,previous_first_jobs:null,current_first_jobs:null,stage_comparisons:null})),
  combined_roi:null,employee_ranking:null,causal_improvement:null});

function checkWindow(w,now){
  if(!w||w.authorized!==true||w.query_ok!==true||w.coverage!=='complete'||w.capped!==false)
    return 'Source permissions, query integrity, coverage or cap status unverified';
  if(!validId(w.company_id)||!validDate(w.retrieved_at)||!validDate(w.period_start)||!validDate(w.period_end))
    return 'Company identity or dated source provenance unavailable';
  const retrieved=Date.parse(w.retrieved_at),start=Date.parse(w.period_start),end=Date.parse(w.period_end);
  if(retrieved>now||now-retrieved>15*60*1000||end>now||start>=end)return 'Stale or invalid dated source window';
  if(!Array.isArray(w.jobs)||w.jobs.length>10000)return 'Unknown, failed or oversized source read';
  if(!Array.isArray(w.services_covered)||w.services_covered.length!==SERVICE_KEYS_429.length||
    new Set(w.services_covered).size!==SERVICE_KEYS_429.length||
    !SERVICE_KEYS_429.every(s=>w.services_covered.includes(s)))return 'Not all six services have explicit complete source coverage';
  const seen=new Set();
  for(const j of w.jobs){
    if(!j||!SERVICE_KEYS_429.includes(j.service)||!validId(j.company_id)||j.company_id!==w.company_id||
      !validId(j.first_job_id)||!validId(j.customer_id)||!validId(j.property_id)||
      !validId(j.original_work_order_id)||j.first_job_id!==j.original_work_order_id||
      !validDate(j.first_order_at)||j.company_work_order_verified!==true||
      j.original_customer_property_verified!==true||j.service_entitlement_verified!==true)
      return 'Missing, foreign or unverified original company, service, customer, property or job provenance';
    const key=j.first_job_id;
    if(seen.has(key))return 'Duplicate first job within a service';
    seen.add(key);
  }
  return null;
}

export function reviewCrossServiceFirstJobs429(input,at=new Date().toISOString()){
  const now=Date.parse(at);
  if(!Number.isFinite(now))return withheld('Invalid review time');
  const a=input?.previous,b=input?.current;
  const aReason=checkWindow(a,now),bReason=checkWindow(b,now);
  if(aReason||bReason)return withheld(aReason||bReason);
  if(a.company_id!==b.company_id)return withheld('Cross-company comparisons are forbidden');
  if(Date.parse(a.period_end)>Date.parse(b.period_start))return withheld('Comparison windows overlap');
  const previousKeys=new Set(a.jobs.map(j=>j.first_job_id));
  if(b.jobs.some(j=>previousKeys.has(j.first_job_id)))
    return withheld('A canonical first job occurs in both periods');
  const previousCustomers=new Set(a.jobs.map(j=>j.service+'\0'+j.customer_id));
  if(b.jobs.some(j=>previousCustomers.has(j.service+'\0'+j.customer_id)))
    return withheld('The same customer was classified as a first-use customer in the same service twice');
  const services=SERVICE_KEYS_429.map(service=>{
    const previous=a.jobs.filter(j=>j.service===service),current=b.jobs.filter(j=>j.service===service);
    if(previous.length<MIN_PER_PERIOD||current.length<MIN_PER_PERIOD)
      return {service,status:'withheld',reason:'Fewer than ten genuine first jobs per period for this service',
        previous_first_jobs:previous.length,current_first_jobs:current.length,stage_comparisons:null};
    const pick=(window,jobs)=>({authorized:window.authorized,query_ok:window.query_ok,coverage:window.coverage,
      capped:window.capped,retrieved_at:window.retrieved_at,period_start:window.period_start,
      period_end:window.period_end,jobs});
    const compared=reviewComparableFirstJobs({previous:pick(a,previous),current:pick(b,current)},at);
    return {service,status:compared.status,reason:compared.reason,
      previous_first_jobs:previous.length,current_first_jobs:current.length,
      stage_comparisons:compared.status==='descriptive_only'?compared.comparisons:null};
  });
  const measurable=services.filter(s=>s.status==='descriptive_only').length;
  return {status:measurable===SERVICE_KEYS_429.length?'descriptive_only':measurable?'partial_descriptive_only':'withheld',
    reason:measurable?`${measurable} of six service cohorts meet the source and sample gates; observations are not causal`:
      'No comparable source-supported ten-first-job service cohorts',
    company_id:a.company_id,minimum_first_jobs_per_period:MIN_PER_PERIOD,
    previous_window:{start:a.period_start,end:a.period_end},current_window:{start:b.period_start,end:b.period_end},
    services,combined_roi:null,employee_ranking:null,causal_improvement:null};
}
