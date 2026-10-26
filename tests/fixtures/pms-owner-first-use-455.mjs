// Synthetic IDs only: NEVER a real owner or Production evidence.
import {fixture as acceptance,company,companyId,ownerId,foreignCompanyId,serviceKeys}
 from './pms-modular-acceptance-454.mjs';
export {company,companyId,ownerId,foreignCompanyId,serviceKeys};
export const evidenceId='a4550000-0000-4455-8455-000000000021';
export function fixture({now=Date.now(),enabled=['landscape','snow_removal','septic'],withEvidence=true}={}){
 const source=acceptance({now,enabled});
 return {...source,journal:{company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',services:source.menu.services,
  client_links:1,property_links:1,jobs_receipts:1,
  evidence_total:withEvidence?1:0,evidence_sample_capped:false,
  entries:withEvidence?[{id:evidenceId,checkpoint:'module_rechecked',module_key:'landscape',
   observed_enabled:enabled.includes('landscape'),source_reference:'OWNER-SWITCH-1',notes:'Reported status only',
   disposition:'observed',created_at:new Date(now-15000).toISOString()}]:[],
  owner_field_accepted:false,release_green:false,outbound_actions:false,
  synthetic:false,mutation_authorized:false}};
}
