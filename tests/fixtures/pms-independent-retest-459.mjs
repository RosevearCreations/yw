// Fictional source rows only for tests; never seed into a Production tenant.
import {fixture as prior,companyId,ownerId,foreignCompanyId,laterEvidenceId}
 from './pms-independent-owner-followup-458.mjs';
import {reviewerId} from './pms-first-service-independent-457.mjs';
export {companyId,ownerId,foreignCompanyId,laterEvidenceId,reviewerId};
export const followupId='a4580000-0000-4458-8458-000000000001';
export const assignmentId='a4590000-0000-4459-8459-000000000001';
export const freshEvidenceId='a4590000-0000-4459-8459-000000000002';
export function fixture({now=Date.now(),viewer=ownerId,unassigned=false,compared=false,off=false,empty=false}={}){
 const p=prior({now,off});const t=offset=>new Date(now-offset).toISOString();
 const followup={id:followupId,company_id:companyId,
  independent_decision_id:p.view.independent_snapshot.decisions[0].id,
  followup_evidence_id:laterEvidenceId,source_reference:'OWNER-REAL-RETEST-458',
  created_at:t(30000),decision:'returned_for_follow_up',decision_at:t(60000),
  service_module_key:'landscape',target_table:'work_orders',target_id:'a4540000-0000-4454-8454-000000000011'};
 const assignment={id:assignmentId,company_id:companyId,owner_followup_id:followupId,
  reviewer_user_id:reviewerId,source_reference:'ASSIGNED-RETEST-459',
  notes:'Source only',created_at:t(20000)};
 const fresh={id:freshEvidenceId,company_id:companyId,created_at:t(10000),
  source_reference:'NEW-OBSERVED-SOURCE-455',checkpoint:'field_observation',disposition:'observed'};
 const comparison={id:'a4590000-0000-4459-8459-000000000003',company_id:companyId,
  assignment_id:assignmentId,fresh_evidence_id:freshEvidenceId,outcome:'comparison_differs',
  source_reference:'INDEPENDENT-RETEST-COMPARE',notes:'Only a comparison',created_at:t(1000)};
 const assignments=unassigned||empty?[]:[assignment];
 const comparisons=compared&&!unassigned&&!empty?[comparison]:[];
 const evidence=assignments.length?[fresh]:[];
 const followups=empty?[]:[followup];
 const inbox={captured_at:t(0),companies:empty?[]:[{id:companyId,
  name:'Yard Rosevear (synthetic)',is_owner:viewer===ownerId,is_assigned_reviewer:viewer===reviewerId}],
  total:empty?0:1,sample_capped:false,outbound_actions:false,release_green:false};
 const view={company_id:companyId,captured_at:t(0),viewer_id:viewer,
  is_owner:viewer===ownerId,is_assigned_reviewer:viewer===reviewerId,
  services:p.prior.view.services,followups,followup_total:followups.length,
  followup_sample_capped:false,assignments,assignment_total:assignments.length,
  assignment_sample_capped:false,comparisons,comparison_total:comparisons.length,
  comparison_sample_capped:false,fresh_evidence:evidence,fresh_evidence_total:evidence.length,
  fresh_evidence_sample_capped:false,independent_reapproval:false,field_accepted:false,
  service_authorized:false,release_green:false,outbound_actions:false,synthetic:false,
  mutation_authorized:false};
 return {inbox,view,followup,assignment,fresh,comparison};
}
