// Synthetic IDs solely for unit/browser tests; not seeded into any real company.
import {fixture as independent,companyId,ownerId,foreignCompanyId,laterEvidenceId}
 from './pms-first-service-independent-457.mjs';
export {companyId,ownerId,foreignCompanyId,laterEvidenceId};
export const decisionId='a4570000-0000-4457-8457-000000000006';
export const followupId='a4580000-0000-4458-8458-000000000001';
export function fixture({now=Date.now(),empty=false,withFollowup=false,off=false}={}){
 const prior=independent({now,closed:!empty,empty,enabled:off?[]:undefined});
 const decision=prior.view.decisions[0];
 // Avoid timestamps that predate a legitimate independent reviewer decision.
 const followup={id:followupId,company_id:companyId,independent_decision_id:decisionId,
  disposition:'closure_review_acknowledged',followup_evidence_id:laterEvidenceId,
  source_reference:'OWNER-458-REASSESSMENT',notes:'Review only; no service approval',
  created_at:new Date(now-300).toISOString()};
 const ages=decision?[{id:decisionId,company_id:companyId,handoff_id:decision.handoff_id,
  decision:decision.decision,created_at:decision.created_at,age_days:0,older_than_seven_days:false,
  followup_count:withFollowup?1:0}]:[];
 const view={company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',independent_snapshot:prior.view,
  decision_aging:ages,followups:withFollowup?[followup]:[],followup_total:withFollowup?1:0,
  followup_sample_capped:false,field_accepted:false,service_authorized:false,
  independent_reapproval:false,release_green:false,outbound_actions:false,
  synthetic:false,mutation_authorized:false};
 return {prior,view,decision,followup};
}
