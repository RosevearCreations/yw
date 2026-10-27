// Fictional, isolated Build 464 sources. No actual company or reviewer evidence is seeded.
import {fixture as prior,companyId,ownerId,reviewerId,foreignCompanyId,assignmentId} from './pms-independent-recheck-463.mjs';
export {companyId,ownerId,reviewerId,foreignCompanyId};
export const alternativeId='a4640000-0000-4464-8464-000000000004';
export const outcomeId='a4630000-0000-4463-8463-000000000002';
export function fixture({now=Date.now(),reviewed=false,decision='retain_hold',off=false}={}){
 const t=delta=>new Date(now-delta).toISOString(),p=prior({now,assigned:true,reviewed:true,off});
 const c=p.case;
 const discrepancy={outcome_id:outcomeId,company_id:companyId,disposition:'evidence_incomplete',
  source_reference:'RECHECK-MISSING-FIELD-PROOF',created_at:t(25),assignment_id:assignmentId,
  evidence_outcome_id:c.evidence_outcome_id,owner_user_id:ownerId,old_reviewer_id:reviewerId,
  assignment_at:t(50),reassessor_user_id:c.reassessor_user_id,comparing_reviewer_id:c.comparing_reviewer_id,
  service_module_key:c.service_module_key,target_table:c.target_table,target_id:c.target_id,service_enabled:!off};
 const review={id:'a4640000-0000-4464-8464-000000000001',company_id:companyId,recheck_outcome_id:outcomeId,
  owner_user_id:ownerId,decision,proposed_reviewer_user_id:decision==='propose_reassignment'?alternativeId:null,
  source_reference:'OWNER-RECHECK-DISCREPANCY-SOURCE',created_at:t(10)};
 const view={company_id:companyId,viewer_id:ownerId,captured_at:t(0),is_owner:true,services:p.view.services,
  cases:[discrepancy],case_total:1,case_sample_capped:false,reviews:reviewed?[review]:[],review_total:reviewed?1:0,review_sample_capped:false,
  field_accepted:false,service_authorized:false,independent_reapproval:false,reassignment_executed:false,
  release_green:false,outbound_actions:false,mutation_authorized:false,synthetic:false};
 return {inbox:p.inbox,view,discrepancy,review};
}
