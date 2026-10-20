// Build 417 — pure, read-only first-job comparison. Never fetches, persists or exposes identities.
const STAGES=Object.freeze(['scheduled_at','started_at','qc_approved_at','invoiced_at']);
const MIN=10,MAX_AGE=15*60*1000;
const time=v=>typeof v==='string'&&v?Date.parse(v):NaN;
function cohortCheck(c,now){
 if(!c||c.authorized!==true||c.query_ok!==true||c.coverage!=='complete'||c.capped!==false||!Array.isArray(c.jobs))
  return {ok:false,reason:'Missing permission, uncapped coverage or confirmed source read'};
 const read=time(c.retrieved_at),start=time(c.period_start),end=time(c.period_end);
 if(!Number.isFinite(read)||read>now||now-read>MAX_AGE||!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>now)
  return {ok:false,reason:'Invalid or stale read or comparison period'};
 if(c.jobs.length>10000)return {ok:false,reason:'Source exceeded review limit'};
 const ids=new Set(),customers=new Set(),counts=STAGES.map(()=>0);
 for(const j of c.jobs){
  if(!j||typeof j.first_job_id!=='string'||!j.first_job_id.trim()||typeof j.customer_id!=='string'||!j.customer_id.trim()||
   ids.has(j.first_job_id)||customers.has(j.customer_id))
   return {ok:false,reason:'Duplicate or missing original first-job/customer ID'};
  ids.add(j.first_job_id);customers.add(j.customer_id);
  let prior=time(j.first_order_at),gap=false;
  if(!Number.isFinite(prior)||prior<start||prior>=end)return {ok:false,reason:'Missing original first-order provenance'};
  for(let i=0;i<STAGES.length;i++){
   const v=j[STAGES[i]];
   if(v==null||v===''){gap=true;continue;}
   const next=time(v);
   if(gap||!Number.isFinite(next)||next<prior||next>now)
    return {ok:false,reason:'Stage chronology or provenance incomplete'};
   counts[i]++;prior=next;
  }
 }
 return {ok:true,count:c.jobs.length,conversions:STAGES.map((stage,i)=>{
  const denominator=i?counts[i-1]:c.jobs.length, numerator=counts[i];
  return {stage,numerator,denominator,status:denominator>=MIN?'measured':'withheld',rate:denominator>=MIN?numerator/denominator:null};
 })};
}
export function reviewComparableFirstJobs(input,referenceTime=new Date().toISOString()){
 const now=time(referenceTime);
 const fail=reason=>({status:'withheld',reason,minimum_per_period:MIN,previous:null,current:null,comparisons:null});
 if(!Number.isFinite(now))return fail('Invalid reference time');
 const p=cohortCheck(input?.previous,now),c=cohortCheck(input?.current,now);
 if(!p.ok||!c.ok)return fail(p.reason||c.reason);
 if(time(input.previous.period_end)>time(input.current.period_start))return fail('Comparison periods overlap');
 if(p.count<MIN||c.count<MIN)return fail('Minimum of ten genuine first jobs required per period');
 return {status:'descriptive_only',reason:'Observed counts and rates are not proof of improvement or causation',
  minimum_per_period:MIN,previous:p,current:c,
  comparisons:STAGES.map((stage,i)=>{const a=p.conversions[i],b=c.conversions[i];
   return {stage,status:a.rate===null||b.rate===null?'withheld':'descriptive_only',
    previous_rate:a.rate,current_rate:b.rate,rate_difference:a.rate===null||b.rate===null?null:b.rate-a.rate};
  })};
}
