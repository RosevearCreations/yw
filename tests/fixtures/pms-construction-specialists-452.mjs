// Fictional Yard Rosevear only. No SQL inserts or real tenant/Auth data.
export const ownerId='84520000-0000-4452-8452-000000000001';
export const companyId='84520000-0000-4452-8452-000000000002';
export const foreignCompanyId='84520000-0000-4452-8452-000000000099';
export const customerId='84520000-0000-4452-8452-000000000003';
export const siteId='84520000-0000-4452-8452-000000000004';
export const orderConcreteId='84520000-0000-4452-8452-000000000005';
export const orderFibreId='84520000-0000-4452-8452-000000000006';
export const projectConcreteId='84520000-0000-4452-8452-000000000007';
export const projectFibreId='84520000-0000-4452-8452-000000000008';
export const company={id:companyId,name:'Yard Rosevear',owner_user_id:ownerId};
export function fixture({now=Date.now(),enabled=true}={}){
 const orders=[
  {id:orderConcreteId,company_id:companyId,client_id:customerId,site_id:siteId,
   number:'DEMO-452-CONCRETE',status:'planned',client_name:'Fictional Client',site_name:'Fictional Test Acre'},
  {id:orderFibreId,company_id:companyId,client_id:customerId,site_id:siteId,
   number:'DEMO-452-FIBRE',status:'planned',client_name:'Fictional Client',site_name:'Fictional Test Acre'}];
 const projects=[
  {id:projectConcreteId,company_id:companyId,work_order_id:orderConcreteId,client_id:customerId,site_id:siteId,
   client_name:'Fictional Client',site_name:'Fictional Test Acre',specialty:'concrete',scope_label:'South pad sample',
   scope_notes:'Mock 12m2 pad site plan only',permit_state:'required_unverified',permit_source:null,
   utility_locate_source:'demo-original-locate',site_hazard_source:'demo-safety-input',original_scope_source:'demo-jobs-plan'},
  {id:projectFibreId,company_id:companyId,work_order_id:orderFibreId,client_id:customerId,site_id:siteId,
   client_name:'Fictional Client',site_name:'Fictional Test Acre',specialty:'fibre_line',scope_label:'West fibre trench',
   scope_notes:'Mock cable route next to west property limit',permit_state:'source_provided',permit_source:'demo-permit-label',
   utility_locate_source:'demo-locate-source',site_hazard_source:'demo-traffic-safety',original_scope_source:'demo-jobs-plan'}];
 const evidence=[
  {id:'84520000-0000-4452-8452-000000000009',company_id:companyId,project_id:projectConcreteId,
   observed_on:'2026-10-20',activity:'formwork',reported_quantity:12,quantity_unit:'m2',field_state:'plan_only',
   permit_source:null,utility_locate_source:null,safety_source:null,inspection_source:null,
   evidence_reference:'demo-concrete-formwork-photo',notes:'Not approved'},
  {id:'84520000-0000-4452-8452-000000000010',company_id:companyId,project_id:projectFibreId,
   observed_on:'2026-10-20',activity:'utility_locate',reported_quantity:40,quantity_unit:'m',field_state:'operator_reported',
   permit_source:'demo-permit-label',utility_locate_source:'demo-original-utility-locate',
   safety_source:'demo-original-safety-ref',inspection_source:null,
   evidence_reference:'demo-fibre-locate-field-note',notes:'Source label only, no dig clearance'}];
 return{company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',new_work_guard:'ywi_421_assert_company_new_work',
  original_order_guard:'ywi_425_assert_construction_order',module_key:'construction',enabled,
  order_count:orders.length,project_count:projects.length,evidence_count:evidence.length,
  orders,projects,evidence,historical_read_retained:true,permit_verified:false,
  utility_clearance_verified:false,safety_cleared:false,inspection_approved:false,
  field_work_authorized:false,dispatch_authorized:false,finance_posted:false,mutation_authorized:false};
}
