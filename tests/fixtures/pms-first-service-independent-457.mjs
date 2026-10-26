// Fictional, isolated trial personas. Never insert these IDs in any real database.
import {fixture as prior,companyId,ownerId,foreignCompanyId,reviewId,fieldEvidenceId}
 from './pms-first-service-reconciliation-456.mjs';
export {companyId,ownerId,foreignCompanyId,fieldEvidenceId,reviewId};
export const reviewerId='a4570000-0000-4457-8457-000000000002';
export const readyId='a4570000-0000-4457-8457-000000000003';
export const handoffId='a4570000-0000-4457-8457-000000000004';
export const laterEvidenceId='a4570000-0000-4457-8457-000000000005';
export const targetId='a4540000-0000-4454-8454-000000000011';
export const serviceKey='landscape';
export function fixture({now=Date.now(),viewer=ownerId,empty=false,closed=false,enabled=['landscape','septic','snow_removal']}={}){
 const prev=prior({now,enabled,noReceipt:empty,noEvidence:empty});
 const ready={id:readyId,company_id:companyId,service_module_key:serviceKey,
  target_table:'work_orders',target_id:targetId,evidence_id:fieldEvidenceId,
  review_outcome:'ready_for_independent_review',source_reference:'READY-456-SOURCE',notes:'Owner handoff',
  switch_enabled_at_review:enabled.includes(serviceKey),canonical_site_verified:true,
  recorded_at:new Date(now-20000).toISOString()};
 const handoff={id:handoffId,company_id:companyId,owner_review_id:readyId,
  reviewer_user_id:reviewerId,source_reference:'OWNER-HANDOFF-457',notes:'Independent follow-up',
  created_at:new Date(now-10000).toISOString(),service_module_key:serviceKey,
  target_table:'work_orders',target_id:targetId,owner_recommendation:'ready_for_independent_review'};
 const evidence={id:laterEvidenceId,company_id:companyId,created_at:new Date(now-5000).toISOString(),
  checkpoint:'field_observation',disposition:'observed',source_reference:'NEW-REAL-SOURCE-REVIEW'};
 const decision={id:'a4570000-0000-4457-8457-000000000006',company_id:companyId,
  handoff_id:handoffId,decision:'exception_verified_closed',exception_review_id:reviewId,
  resolution_evidence_id:laterEvidenceId,source_reference:'INDEPENDENT-REVIEW-EVIDENCE',
  notes:'Review exception, not field authorization',created_at:new Date(now-1000).toISOString()};
 const inbox={captured_at:new Date(now).toISOString(),total:empty?0:1,
  sample_capped:false,outbound_actions:false,release_green:false,
  companies:empty?[]:[{id:companyId,name:'Yard Rosevear (test only)',is_owner:viewer===ownerId,
   is_assigned_reviewer:viewer===reviewerId}]};
 return {prev,ready,inbox,view:{company_id:companyId,captured_at:new Date(now).toISOString(),
  viewer_id:viewer,is_owner:viewer===ownerId,is_assigned_reviewer:viewer===reviewerId,
  services:prev.menu.services,handoffs:empty?[]:[handoff],
  handoff_total:empty?0:1,handoff_sample_capped:false,
  decisions:closed?[decision]:[],decision_total:closed?1:0,decision_sample_capped:false,
  exceptions:empty?[]:[{id:reviewId,company_id:companyId,service_module_key:serviceKey,
   target_table:'work_orders',target_id:targetId,review_outcome:'needs_follow_up',
   recorded_at:new Date(now-40000).toISOString()}],exception_total:empty?0:1,
  exception_sample_capped:false,resolution_evidence:empty?[]:[evidence],
  evidence_total:empty?0:1,evidence_sample_capped:false,
  independent_service_approval:false,field_accepted:false,release_green:false,
  outbound_actions:false,synthetic:false,mutation_authorized:false}};
}
