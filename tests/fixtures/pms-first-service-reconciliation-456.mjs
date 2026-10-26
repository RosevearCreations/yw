// Fictional owner/company/Jobs IDs. Never write these fixtures to Production.
import {fixture as prior,company,companyId,ownerId,foreignCompanyId,serviceKeys}
 from './pms-owner-first-use-455.mjs';
export {company,companyId,ownerId,foreignCompanyId,serviceKeys};
export const fieldEvidenceId='a4560000-0000-4456-8456-000000000032';
export const reviewId='a4560000-0000-4456-8456-000000000033';
export function fixture({now=Date.now(),enabled=['landscape','snow_removal','septic'],noReceipt=false,noEvidence=false}={}){
 const prev=prior({now,enabled});
 const receipts=noReceipt?[]:[...prev.receipts];
 const entries=noEvidence?[]:[{id:fieldEvidenceId,company_id:companyId,
  checkpoint:'field_observation',module_key:null,observed_enabled:null,source_reference:'FIELD-REPORT-REFERENCE',
  disposition:'observed',created_at:new Date(now-20000).toISOString()}];
 return {...prev,review:{company_id:companyId,owner_guard:'ywi_422_assert_owner',
  captured_at:new Date(now).toISOString(),services:prev.menu.services,
  receipts,receipt_total:receipts.length,receipt_sample_capped:false,
  owner_entries:entries,owner_entry_total:entries.length,owner_entry_sample_capped:false,
  reviews:noReceipt||noEvidence?[]:[{id:reviewId,company_id:companyId,service_module_key:'landscape',target_table:'work_orders',
   target_id:'a4540000-0000-4454-8454-000000000011',evidence_id:fieldEvidenceId,
   review_outcome:'needs_follow_up',source_reference:'REVIEW-REF-1',notes:'Pending independent review',
   switch_enabled_at_review:enabled.includes('landscape'),canonical_site_verified:true,
   recorded_at:new Date(now-10000).toISOString()}],review_total:noReceipt||noEvidence?0:1,review_sample_capped:false,
  independent_approval_granted:false,real_field_accepted:false,release_green:false,
  outbound_actions:false,synthetic:false,mutation_authorized:false}};
}
