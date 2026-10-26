// Fictional source projections for browser/source tests only. Never seed production.
import {fixture as prior,companyId,ownerId,reviewerId,foreignCompanyId}
 from './pms-independent-retest-459.mjs';
export {companyId,ownerId,reviewerId,foreignCompanyId};
export const independentId='a4600000-0000-4460-8460-000000000009';
export const triageId='a4600000-0000-4460-8460-000000000001';
export function fixture({now=Date.now(),viewer=ownerId,triaged=false,reviewed=false,
 off=false,empty=false,gap=false,matched=false}={}){
 const past=prior({now,viewer:viewer===independentId?reviewerId:viewer,compared:true,off});
 const t=offset=>new Date(now-offset).toISOString();
 const comparison=past.comparison;
 const current={comparison_id:comparison.id,company_id:companyId,assignment_id:past.assignment.id,
  comparison_outcome:matched?'comparison_matches':gap?'insufficient_evidence':'comparison_differs',
  comparison_at:t(9000),comparison_reference:'REAL-COMPARISON-SOURCE-459',
  comparing_reviewer_id:reviewerId,owner_user_id:ownerId,assignment_at:t(20000),
  followup_id:past.followup.id,original_decision_id:past.followup.independent_decision_id,
  original_evidence_id:past.followup.followup_evidence_id,followup_disposition:'retest_evidence_ready',
  original_decision:'returned_for_follow_up',review_outcome:'ready_for_independent_review',
  service_module_key:'landscape',target_table:'work_orders',target_id:past.followup.target_id,
  fresh_evidence_id:past.fresh.id,fresh_at:t(10000),fresh_checkpoint:'field_observation',fresh_disposition:'observed'};
 const triage={id:triageId,company_id:companyId,comparison_id:current.comparison_id,
  reassessor_user_id:independentId,triage_kind:gap?'request_fresh_evidence':'investigate_difference',
  source_reference:'OWNER-TRIAGE-460',notes:'Documentary only',created_at:t(4000)};
 const reassessment={id:'a4600000-0000-4460-8460-000000000002',company_id:companyId,
  triage_id:triageId,outcome:gap?'evidence_gap_confirmed':'difference_confirmed',
  source_reference:'THIRD-PARTY-REASSESSMENT',notes:'No closure',created_at:t(1000)};
 const cases=empty||matched?[]:[current],triages=triaged||reviewed?[triage]:[],reassessments=reviewed?[reassessment]:[];
 const inbox={captured_at:t(0),companies:empty?[]:[{id:companyId,name:'Yard Rosevear (synthetic)',
  is_owner:viewer===ownerId,is_reassessor:viewer===independentId}],
  total:empty?0:1,sample_capped:false,field_accepted:false,service_authorized:false,release_green:false};
 const view={company_id:companyId,captured_at:t(0),viewer_id:viewer,
  is_owner:viewer===ownerId,is_reassessor:viewer===independentId,
  services:past.view.services,cases,case_total:cases.length,case_sample_capped:false,
  triages,triage_total:triages.length,triage_sample_capped:false,
  reassessments,reassessment_total:reassessments.length,reassessment_sample_capped:false,
  independent_reapproval:false,field_accepted:false,service_authorized:false,
  release_green:false,outbound_actions:false,synthetic:false,mutation_authorized:false};
 return {inbox,view,current,triage,reassessment};
}
