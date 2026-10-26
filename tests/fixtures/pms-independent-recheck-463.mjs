// Fictional data only. No live field evidence or reviewer is seeded.
import {fixture as prior,companyId,ownerId,independentId,foreignCompanyId}
 from './pms-reassessment-followup-461.mjs';
export {companyId,ownerId,independentId,foreignCompanyId};
export const reviewerId='a4630000-0000-4463-8463-000000000003';
export const outcomeId='a4620000-0000-4462-8462-000000000001';
export const assignmentId='a4630000-0000-4463-8463-000000000001';
export function fixture({now=Date.now(),assigned=false,reviewed=false,viewer=ownerId,off=false}={}){
 const t=offset=>new Date(now-offset).toISOString(),p=prior({now,requested:true,off});
 const r=p.finding,c={evidence_outcome_id:outcomeId,company_id:companyId,owner_user_id:ownerId,
  outcome:'evidence_received',evidence_reference:'SOURCE-LINKED-RECEIVED-EVIDENCE',outcome_at:t(100),
  request_id:p.request.id,reassessment_id:r.reassessment_id,request_at:p.request.created_at,
  reassessor_user_id:independentId,reassessed_at:r.reassessed_at,comparison_id:r.comparison_id,
  comparing_reviewer_id:'a4590000-0000-4459-8459-000000000003',service_module_key:'landscape',
  target_table:'work_orders',target_id:r.target_id};
 const assignment={id:assignmentId,company_id:companyId,evidence_outcome_id:outcomeId,owner_user_id:ownerId,
  reviewer_user_id:reviewerId,source_reference:'OWNER-INDEPENDENT-REVIEWER-ASSIGNMENT',created_at:t(50)};
 const recheck={id:'a4630000-0000-4463-8463-000000000002',company_id:companyId,assignment_id:assignmentId,
  reviewer_user_id:reviewerId,disposition:'source_corresponds',source_reference:'REVIEWER-OBSERVED-SOURCE-REFERENCE',created_at:t(25)};
 const viewerOwner=viewer===ownerId;
 const inbox={viewer_id:viewer,captured_at:t(0),companies:[{id:companyId,name:'Yard Rosevear (test only)',is_owner:viewerOwner,is_reviewer:!viewerOwner}],
  total:1,sample_capped:false,field_accepted:false,release_green:false,outbound_actions:false};
 const cases=viewerOwner||assigned?[c]:[],assignments=assigned?[assignment]:[],rechecks=reviewed?[recheck]:[];
 const view={company_id:companyId,viewer_id:viewer,captured_at:t(0),is_owner:viewerOwner,is_reviewer:!viewerOwner,
  services:p.view.services,cases,case_total:cases.length,case_sample_capped:false,
  assignments,assignment_total:assignments.length,assignment_sample_capped:false,
  rechecks,recheck_total:rechecks.length,recheck_sample_capped:false,
  field_accepted:false,service_authorized:false,independent_reapproval:false,release_green:false,
  outbound_actions:false,mutation_authorized:false,synthetic:false};
 return {inbox,view,case:c,assignment,recheck};
}
