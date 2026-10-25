// Yard Rosevear is synthetic only. No live tenant, credential or contact is copied.
import {company,companyId,foreignCompanyId,ownerId,companyAdminTest,serviceKeys}
 from './cross-service-learning-442.mjs';
export {company,companyId,foreignCompanyId,ownerId,companyAdminTest,serviceKeys};
export const customerId='a4440000-0000-4444-8444-000000000001';
export const foreignCustomerId='a4440000-0000-4444-8444-000000000002';
export const propertyId='b4440000-0000-4444-8444-000000000001';
export const foreignPropertyId='b4440000-0000-4444-8444-000000000002';
export const companyCustomers=()=>[{id:customerId,name:'Sample Yard Rosevear Client',is_active:true}];
export function fixture({now=Date.now()}={}){
 const iso=n=>new Date(n).toISOString();
 const source=(k,i,status,site=propertyId)=>({id:`c4440000-0000-4444-8444-${String(i).padStart(12,'0')}`,
  service:k,property_id:site,number:`YR-TEST-${i}`,status,created_at:iso(now-i*3600000)});
 const entries=[
  {id:'d4440000-0000-4444-8444-000000000001',property_id:null,entry_kind:'contact',
   title:'Sample site point of contact',details:'Test only',source_reference:null,reported_status:'primary',
   channel:null,consent_scope:null,valid_from:null,valid_until:null,created_at:iso(now-5*60000)},
  {id:'d4440000-0000-4444-8444-000000000002',property_id:propertyId,entry_kind:'asset',
   title:'North garden gate',details:'Sample condition',source_reference:null,reported_status:'monitor',
   channel:null,consent_scope:null,valid_from:null,valid_until:null,created_at:iso(now-4*60000)},
  {id:'d4440000-0000-4444-8444-000000000003',property_id:propertyId,entry_kind:'contract',
   title:'Reported winter term',details:'Unverified term',source_reference:'private-agreement-01',
   reported_status:'reported_active',channel:null,consent_scope:null,valid_from:'2026-10-01',
   valid_until:'2027-03-31',created_at:iso(now-3*60000)},
  {id:'d4440000-0000-4444-8444-000000000004',property_id:propertyId,entry_kind:'photo',
   title:'Gate picture label',details:null,source_reference:'private-photo-label-01',
   reported_status:'reference_only',channel:null,consent_scope:null,valid_from:null,valid_until:null,
   created_at:iso(now-2*60000)},
  {id:'d4440000-0000-4444-8444-000000000005',property_id:null,entry_kind:'consent',
   title:'Sample permission evidence',details:'Synthetic only',source_reference:'private-consent-evidence-01',
   reported_status:'given',channel:'email',consent_scope:'service_updates',valid_from:null,
   valid_until:null,created_at:iso(now-60000)},
  {id:'d4440000-0000-4444-8444-000000000006',property_id:null,entry_kind:'consent',
   title:'Sample later withdrawal',details:'Synthetic only',source_reference:'private-consent-evidence-02',
   reported_status:'withdrawn',channel:'email',consent_scope:'service_updates',valid_from:null,
   valid_until:null,created_at:iso(now-30000)}
 ];
 const history={company_id:companyId,client_id:customerId,customer_name:'Sample Yard Rosevear Client',
  legacy_unscoped_excluded:true,history_limit_per_type:80,
  properties:[{id:propertyId,name:'Sample yard',address:'Example address — test only'}],
  estimates:[source('landscape',1,'draft'),source('snow_removal',2,'approved')],
  work_orders:[source('septic',3,'completed'),source('snow_plowing',4,'scheduled')]};
 return {company_id:companyId,client_id:customerId,captured_at:iso(now),
  owner_guard:'ywi_422_assert_owner',canonical_source:'422-original-crm',
  history,entries,entries_count:entries.length,max_entries:200,
  legacy_unscoped_excluded:true,privacy_minimized:false,
  photo_upload_available:false,contract_execution_verified:false,
  consent_authorizes_messaging:false,mutation_authorized:false};
}
