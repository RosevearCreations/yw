// Fictional Build 465 owner/reviewer chain. Never seed this data into production.
import {fixture as prior,companyId,ownerId,reviewerId,alternativeId,foreignCompanyId} from './pms-recheck-discrepancy-464.mjs';
export {companyId,ownerId,reviewerId,alternativeId,foreignCompanyId};
export const proposalId='a4640000-0000-4464-8464-000000000001';
export const handoffId='a4650000-0000-4465-8465-000000000001';
export function fixture({now=Date.now(),handed=false,responded=false,viewer=ownerId,off=false}={}){
 const t=delta=>new Date(now-delta).toISOString(),p=prior({now,reviewed:true,decision:'propose_reassignment',off}),c=p.discrepancy;
 const proposal={proposal_id:proposalId,company_id:companyId,owner_user_id:ownerId,
  proposed_reviewer_user_id:alternativeId,proposal_reference:p.review.source_reference,proposed_at:p.review.created_at,
  outcome_id:c.outcome_id,disposition:c.disposition,discrepancy_at:c.created_at,evidence_outcome_id:c.evidence_outcome_id,
  old_reviewer_id:reviewerId,reassessor_user_id:c.reassessor_user_id,comparing_reviewer_id:c.comparing_reviewer_id,
  service_module_key:c.service_module_key,target_table:c.target_table,target_id:c.target_id,service_enabled:!off};
 const handoff={id:handoffId,company_id:companyId,proposal_id:proposalId,owner_user_id:ownerId,
  reviewer_user_id:alternativeId,source_reference:'OWNER-REASSIGNMENT-HANDOFF-REFERENCE',created_at:t(5)};
 const receipt={id:'a4650000-0000-4465-8465-000000000002',company_id:companyId,handoff_id:handoffId,
  reviewer_user_id:alternativeId,response:'acknowledged_for_review',source_reference:'INDEPENDENT-REVIEWER-ACK-REFERENCE',created_at:t(2)};
 const owner=viewer===ownerId;
 const visible=owner||handed;
 const inbox={viewer_id:viewer,captured_at:t(0),companies:visible?[{id:companyId,name:'Yard Rosevear (test only)',is_owner:owner,is_reviewer:!owner}]:[],
  total:visible?1:0,sample_capped:false,field_accepted:false,release_green:false,outbound_actions:false};
 const cases=visible?[proposal]:[],handoffs=handed?[handoff]:[],receipts=responded?[receipt]:[];
 const view={company_id:companyId,viewer_id:viewer,captured_at:t(0),is_owner:owner,is_reviewer:!owner,
  services:p.view.services,cases,case_total:cases.length,case_sample_capped:false,
  handoffs,handoff_total:handoffs.length,handoff_sample_capped:false,
  receipts,receipt_total:receipts.length,receipt_sample_capped:false,
  field_accepted:false,service_authorized:false,independent_reapproval:false,reassignment_executed:false,
  release_green:false,outbound_actions:false,mutation_authorized:false,synthetic:false};
 return {inbox,view,proposal,handoff,receipt};
}
