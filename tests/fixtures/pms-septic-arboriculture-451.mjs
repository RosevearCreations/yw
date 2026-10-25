// Fictional Yard Rosevear evidence. NEVER upload into Supabase or real Auth.
export const ownerId='84510000-0000-4451-8451-000000000001';
export const companyId='84510000-0000-4451-8451-000000000002';
export const foreignCompanyId='84510000-0000-4451-8451-000000000099';
export const customerId='84510000-0000-4451-8451-000000000003';
export const propertyId='84510000-0000-4451-8451-000000000004';
export const septicProfileId='84510000-0000-4451-8451-000000000005';
export const septicManifestId='84510000-0000-4451-8451-000000000006';
export const treeId='84510000-0000-4451-8451-000000000007';
export const arborReviewId='84510000-0000-4451-8451-000000000008';
export const originalReceiptId='84510000-0000-4451-8451-000000000009';
export const company={id:companyId,name:'Yard Rosevear',owner_user_id:ownerId};
export const customers=()=>[{id:customerId,name:'Fictional Demo Client',is_active:true}];
export const propertyHistory=()=>({company_id:companyId,client_id:customerId,legacy_unscoped_excluded:true,
 properties:[{id:propertyId,name:'Fictional Demo Property'}]});
export function fixture({now=Date.now(),septicEnabled=true,arborEnabled=true}={}){
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',new_work_guard:'ywi_421_assert_company_new_work',
  services:[{module_key:'septic',enabled:septicEnabled},{module_key:'arboriculture',enabled:arborEnabled}],
  septic_site_count:1,septic_manifest_count:1,arbor_tree_count:1,arbor_review_count:1,
  historical_read_retained:true,regulatory_compliance_verified:false,permit_authorized:false,
  crew_certified:false,safety_cleared:false,dispatch_authorized:false,disposal_certified:false,
  invoice_posted:false,mutation_authorized:false,
  septic_sites:[{id:septicProfileId,company_id:companyId,client_id:customerId,site_id:propertyId,
   client_name:'Fictional Demo Client',site_name:'Fictional Demo Property',tank_kind:'holding',capacity_l:5200,
   access_hazard:'Access via west gate; confined-space entry prohibited',permit_source:'owner-permit-label',
   site_safety_source:'septic-safety-ref',source_reference:'septic-site-source'}],
  septic_manifests:[{id:septicManifestId,company_id:companyId,profile_id:septicProfileId,
   service_on:'2026-10-01',waste_stream:'holding_tank',reported_volume_l:2200,
   measurement_source:'gauge-log',facility_label:'Demo Transfer Station',manifest_reference:'ticket-451-demo',
   original_receipt_428:originalReceiptId,disposal_review:'source_linked',source_reference:'source-septic-manifest',notes:null}],
  arbor_trees:[{id:treeId,company_id:companyId,client_id:customerId,site_id:propertyId,
   client_name:'Fictional Demo Client',site_name:'Fictional Demo Property',tree_label:'West Maple 01',
   species_label:'Silver maple',approximate_height_m:17.5,risk_zone:'utility',
   risk_notes:'Branches near service line; utility clearance HOLD',permit_state:'required_unverified',
   permit_source:'permit-inquiry-451',source_reference:'tree-source-451'}],
  arbor_reviews:[{id:arborReviewId,company_id:companyId,tree_id:treeId,reviewed_on:'2026-10-02',
   risk_level:'high',planned_method:'pruning',equipment_source:'bucket-truck-inspection-label',
   crew_credential_source:'arborist-card-source-label',safety_source:'safety-review-ref',
   permit_source:'permit-inquiry-451',review_state:'hold',evidence_reference:'tree-risk-note-451',notes:null}]};
}
