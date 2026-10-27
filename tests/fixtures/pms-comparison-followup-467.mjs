// Isolated fictional documentary evidence. Never seed into any database.
import {fixture as prior,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-independent-handoff-465.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const comparisonId='a4660000-0000-4466-8466-000000000001';
export const outcomeId='a4660000-0000-4466-8466-000000000002';
export function fixture({now=Date.now(),reviewer=false,compared=false,outcomeRecorded=false,followed=false,off=false,
 alignment='material_gap',disposition='exception_remains_open'}={}){
 const viewer=reviewer?alternativeId:ownerId;
 const p=prior({now,handed:true,responded:true,viewer,off});
 const t=ms=>new Date(now-ms).toISOString();
 const baseline={proposal_id:p.proposal.proposal_id,original_outcome_id:p.proposal.outcome_id,
  original_source_reference:'ORIGINAL-463-OUTCOME-SOURCE',original_at:new Date(Date.parse(p.proposal.discrepancy_at)-1000).toISOString()};
 const c={id:comparisonId,company_id:companyId,handoff_id:p.handoff.id,receipt_id:p.receipt.id,reviewer_user_id:alternativeId,
  original_source_reference:baseline.original_source_reference,compared_source_reference:'INDEPENDENT-466-NEW-SOURCE',
  alignment,created_at:t(1)};
 const o={id:outcomeId,company_id:companyId,comparison_id:comparisonId,reviewer_user_id:alternativeId,
  disposition,source_reference:'INDEPENDENT-466-OUTCOME-SOURCE',created_at:t(0)};
 const f={id:'a4670000-0000-4467-8467-000000000001',company_id:companyId,outcome_id:outcomeId,
  owner_user_id:ownerId,decision:'retain_exception_hold',source_reference:'OWNER-467-HOLD-REFERENCE',created_at:t(0)};
 const comparisons=compared?[c]:[],outcomes=outcomeRecorded?[o]:[],followups=followed?[f]:[];
 return {...p,comparison:c,outcome:o,followup:f,baseline,view:{company_id:companyId,viewer_id:viewer,captured_at:t(0),
  handoff_source:p.view,original_baselines:[baseline],comparisons,comparison_total:comparisons.length,
  comparison_sample_capped:false,outcomes,outcome_total:outcomes.length,outcome_sample_capped:false,
  followups,followup_total:followups.length,followup_sample_capped:false,
  field_accepted:false,service_authorized:false,independent_reapproval:false,reassignment_executed:false,
  release_green:false,outbound_actions:false,mutation_authorized:false,synthetic:false}};
}
