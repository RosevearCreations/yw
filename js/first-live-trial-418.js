/* Item 418: bounded, client-side interpretation of pre-authorized owner 416 source receipts.
   This module reads no customer system and never records an owner acceptance. */
(function(root){'use strict';
const codes=Array.from({length:10},(_,i)=>String(i+406));
const date=v=>typeof v==='string'&&v?Date.parse(v):NaN;
const failure=reason=>({state:'withheld',reason,records:[],unresolved_gaps:[],retrieved_at:null});
function inspect(response,now=Date.now()){
 const d=response?.acceptance_416, t=date(d?.retrieved_at);
 if(response?.ok!==true||response?.scope!=='owner_first_use_trial_acceptance'||
    !d||d.complete!==true||!Number.isFinite(t)||t>now||now-t>300000)
  return failure('Owner authorization, complete current source or freshness missing');
 if(!Array.isArray(d.records)||!Array.isArray(d.unresolved_gaps)||
    !Number.isSafeInteger(d.record_count)||!Number.isSafeInteger(d.unresolved_count)||
    d.record_count!==d.records.length||d.unresolved_count!==d.unresolved_gaps.length||
    d.records.length>25||d.unresolved_gaps.length>250)
  return failure('Incomplete or capped owner evidence totals');
 if(d.state==='no_record'){
  if(d.records.length||d.unresolved_gaps.length)return failure('Conflicting empty source');
  return {state:'no_record',reason:'No actual first customer, property or first job recorded in owner sources',records:[],unresolved_gaps:[],retrieved_at:d.retrieved_at};
 }
 if(d.state!=='recorded'||!d.records.length)return failure('Owner source withheld or unknown status');
 const clients=new Set(),jobs=new Set(),normalized=[],expectedGaps=new Set();
 for(const r of d.records){
  const customer=String(r?.customer_id||''),job=String(r?.first_work_order_id||'');
  if(!customer||clients.has(customer)||!Array.isArray(r?.steps)||r.steps.length!==10||
      r.trial_acceptance!=='operator_review_required'||!Number.isSafeInteger(r.unresolved_count))
   return failure('Duplicate customer, missing identity or invalid first-job record');
  clients.add(customer);
  if(job){if(jobs.has(job))return failure('Duplicated original first job');jobs.add(job);}
  if(r.steps.some((s,i)=>String(s?.handoff)!==codes[i]||
       !['source_verified','unresolved'].includes(s?.state)||typeof s?.label!=='string'))
   return failure('Incomplete, reordered or unverified canonical handoffs');
  const missing=r.steps.filter(s=>s.state==='unresolved');
  if(r.unresolved_count!==missing.length)return failure('Contradictory unresolved evidence count');
  for(const s of missing)expectedGaps.add(customer+'|'+job+'|'+s.handoff);
  const customerVerified=r.steps[0].state==='source_verified';
  const propertyVerified=r.steps[1].state==='source_verified';
  const jobVerified=r.steps[2].state==='source_verified';
  const orderTime=date(r.first_order_created_at);
  if(jobVerified&&(!job||!propertyVerified||!customerVerified||
    !String(r.property_id||'')||!Number.isFinite(orderTime)||orderTime>t+300000||orderTime>Date.now()+300000))
   return failure('First work-order identity/date cannot be corroborated');
  if(propertyVerified&&(!customerVerified||!String(r.property_id||'')))
   return failure('Property owner evidence is inconsistent');
  const allVerified=missing.length===0&&customerVerified&&propertyVerified&&jobVerified;
  normalized.push({customer_id:customer,property_id:String(r.property_id||'')||null,
   first_work_order_id:job||null,work_order_number:String(r.work_order_number||'')||null,
   first_order_created_at:r.first_order_created_at||null,steps:r.steps.map(s=>({
    handoff:s.handoff,label:s.label,state:s.state,reason:s.state==='unresolved'?String(s.reason||'Evidence missing'):null
   })),unresolved_count:missing.length,coverage:allVerified?'fully_source_verified':
    customerVerified&&propertyVerified&&jobVerified?'first_job_linked_with_gaps':'first_job_not_yet_proven',
   owner_review:'not_recorded',manual_acceptance_eligible:allVerified});
 }
 if(expectedGaps.size!==d.unresolved_gaps.length)return failure('Unresolved gap receipt does not reconcile');
 const seen=new Set();
 for(const g of d.unresolved_gaps){
  const key=String(g?.customer_id||'')+'|'+String(g?.first_work_order_id||'')+'|'+String(g?.handoff||'');
  if(!expectedGaps.has(key)||seen.has(key)||!String(g?.reason||''))
   return failure('Gap provenance missing or mismatched');
  seen.add(key);
 }
 return {state:'recorded',reason:null,retrieved_at:d.retrieved_at,records:normalized,
  unresolved_gaps:d.unresolved_gaps.map(g=>({customer_id:String(g.customer_id),
   first_work_order_id:g.first_work_order_id||null,handoff:String(g.handoff),reason:String(g.reason)}))};
}
root.YWI418=Object.freeze({inspect});
})(typeof window!=='undefined'?window:globalThis);
