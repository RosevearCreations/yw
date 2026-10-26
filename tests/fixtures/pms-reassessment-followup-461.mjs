// Fictional, in-memory projections for source/browser regression tests only; never seed production.
import {fixture as base,companyId,ownerId,independentId,foreignCompanyId}
 from './pms-retest-discrepancy-460.mjs';
export {companyId,ownerId,independentId,foreignCompanyId};
export const reassessmentId='a4600000-0000-4460-8460-000000000002';
export function fixture({now=Date.now(),aged=false,requested=false,off=false,empty=false}={}){
 const t=offset=>new Date(now-offset).toISOString(),age=aged?10:2;
 const earlier=base({now,reviewed:true,off,empty});const r=earlier.reassessment;
 const finding={reassessment_id:reassessmentId,company_id:companyId,triage_id:r.triage_id,
  reassessor_user_id:independentId,reassessment_outcome:r.outcome,
  reassessment_reference:r.source_reference,reassessed_at:t(age*86400000),
  comparison_id:earlier.current.comparison_id,owner_user_id:ownerId,
  triage_kind:earlier.triage.triage_kind,triaged_at:t((age+1)*86400000),
  comparison_outcome:earlier.current.comparison_outcome,compared_at:t((age+2)*86400000),
  service_module_key:'landscape',target_table:'work_orders',target_id:earlier.current.target_id,
  age_days:age};
 const request={id:'a4610000-0000-4461-8461-000000000001',company_id:companyId,
  reassessment_id:reassessmentId,owner_user_id:ownerId,request_kind:'request_source_clarification',
  source_reference:'OWNER-REAL-SOURCE-REQUEST',notes:null,created_at:t(1000)};
 const reassessments=empty?[]:[finding],requests=requested&&!empty?[request]:[];
 const inbox={captured_at:t(0),viewer_id:ownerId,
  companies:empty?[]:[{id:companyId,name:'Yard Rosevear (test fixture only)'}],
  total:empty?0:1,sample_capped:false,field_accepted:false,service_authorized:false,
  release_green:false,outbound_actions:false};
 const view={company_id:companyId,viewer_id:ownerId,is_owner:true,captured_at:t(0),
  services:earlier.view.services,reassessments,reassessment_total:reassessments.length,
  reassessment_sample_capped:false,requests,request_total:requests.length,request_sample_capped:false,
  aging_attention_days:7,field_accepted:false,service_authorized:false,
  independent_reapproval:false,release_green:false,outbound_actions:false,mutation_authorized:false,synthetic:false};
 return {inbox,view,finding,request};
}
