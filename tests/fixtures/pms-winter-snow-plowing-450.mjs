// Entirely invented Yard Rosevear scenario. Never create these people, companies or records in Supabase.
export const companyId='a4500000-0000-4450-8450-000000000001';
export const foreignCompanyId='a4500000-0000-4450-8450-000000000099';
export const ownerId='b4500000-0000-4450-8450-000000000001';
export const customerId='c4500000-0000-4450-8450-000000000001';
export const propertyId='d4500000-0000-4450-8450-000000000001';
export const removalId='e4500000-0000-4450-8450-000000000001';
export const plowId='e4500000-0000-4450-8450-000000000002';
export const snowReviewId='f4500000-0000-4450-8450-000000000001';
export const plowReviewId='f4500000-0000-4450-8450-000000000002';
export const company={id:companyId,name:'Yard Rosevear'};
export const customers=()=>[{id:customerId,name:'Sample winter homeowner',is_active:true}];
export const propertyHistory=()=>({company_id:companyId,client_id:customerId,legacy_unscoped_excluded:true,
 properties:[{id:propertyId,name:'Fictional Oxford rural property'}]});
export function fixture({now=Date.now(),snowEnabled=true,plowEnabled=true}={}){
 const plan=(id,service)=>({id,company_id:companyId,client_id:customerId,site_id:propertyId,
  service_key:service,billing_mode:'per_storm',client_name:'Sample winter homeowner',
  site_name:'Fictional Oxford rural property',starts_on:'2026-10-01',ends_on:'2027-04-30',
  trigger_cm:5,trigger_kind:'accumulation',deicing_policy:'optional',estimated_charge_cents:7500,
  route_reference:'TEST-ROUTE-1',site_restrictions:'Never plow past unverified buried utilities',
  source_reference:'synthetic winter planning authorization'});
 const storm=(id,agreementId,service)=>({id,company_id:companyId,agreement_id:agreementId,
  service_key:service,storm_reference:'TEST-STORM-1',observed_on:'2026-11-10',reported_cm:6.5,
  hazard:'mixed',route_review:'activation_requested',weather_source:'synthetic weather log',
  safety_source:'synthetic safety review',fleet_source:service==='snow_plowing'?'synthetic truck check':null,
  source_reference:'synthetic storm check',notes:'No real route activated'});
 const pass=(id,reviewId,agreementId,service)=>({id,company_id:companyId,
  service_key:service,agreement_id:agreementId,storm_review_id:reviewId,
  reported_on:'2026-11-10',surface:service==='snow_removal'?'walkway':'driveway',reported_passes:2,
  outcome:'reported_complete',deicer_name:'salt',deicer_quantity:2.5,deicer_unit:'kg',
  qc_status:'followup_required',qc_note:'Recheck icy entrance',source_reference:'synthetic pass report',
  private_photo_label:'fictional-pass-photo',field_notes:'Demo only'});
 const result={company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',new_work_guard:'ywi_421_assert_company_new_work',
  services:[{module_key:'snow_removal',enabled:snowEnabled},{module_key:'snow_plowing',enabled:plowEnabled}],
  agreements:[plan(removalId,'snow_removal'),plan(plowId,'snow_plowing')],
  storms:[storm(snowReviewId,removalId,'snow_removal'),storm(plowReviewId,plowId,'snow_plowing')],
  passes:[pass('94500000-0000-4450-8450-000000000001',snowReviewId,removalId,'snow_removal'),
   pass('94500000-0000-4450-8450-000000000002',plowReviewId,plowId,'snow_plowing')],
  historical_read_retained:true,activation_authorized:false,safety_verified:false,fleet_verified:false,
  weather_verified:false,dispatch_authorized:false,invoice_posted:false,mutation_authorized:false};
 result.agreement_count=result.agreements.length;result.storm_count=result.storms.length;
 result.pass_count=result.passes.length;return result;
}
