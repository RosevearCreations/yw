// Synthetic Yard Rosevear staff and pickup evidence — never Production data.
import {company,companyId,foreignCompanyId,ownerId,companyAdminTest} from './cross-service-learning-442.mjs';
import {customerId,propertyId} from './pms-client-property-360-444.mjs';
export {company,companyId,foreignCompanyId,ownerId,companyAdminTest,customerId,propertyId};
export const employeeId='e4450000-0000-4445-8445-000000000001';
export const stickerId='a4450000-0000-4445-8445-000000000001';
export const contractId='b4450000-0000-4445-8445-000000000001';
export const pickupId='c4450000-0000-4445-8445-000000000001';
export function hr({now=Date.now()}={}){
 const people=[{id:employeeId,display_name:'Sample Crew Member A',job_title:'Field Specialist',
  employment_status:'active',start_date:'2026-10-10',created_at:new Date(now-86400000).toISOString()}];
 const entries=[{id:'d4450000-0000-4445-8445-000000000001',employee_id:employeeId,
  entry_kind:'certification',title:'Sample safety orientation',notes:'Synthetic record',
  source_reference:'SAMPLE-TRAIN-01',reported_status:'completed',effective_from:'2026-10-11',
  effective_until:'2027-10-11',created_at:new Date(now-60000).toISOString()}];
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_445_assert_hr_owner',people,entries,people_count:people.length,
  entries_count:entries.length,wages_included:false,payroll_authorized:false,
  identity_cloned:false,documents_uploaded:false,automatic_record_purge:false,
  mutation_authorized:false};
}
export function garbage({now=Date.now(),enabled=false}={}){
 const stickers=[{id:stickerId,client_id:customerId,site_id:propertyId,serial:'YR-0001',
  reported_receipt_ref:'TEST-REC-01',status:'issued',issued_at:new Date(now-60000).toISOString(),redeemed_at:null}];
 const contracts=[{id:contractId,client_id:customerId,site_id:propertyId,
  agreement_ref:'YR-CONTRACT-01',pickup_interval_days:7,reported_status:'reported_active',
  created_at:new Date(now-60000).toISOString()}];
 const pickups=[{id:pickupId,client_id:customerId,site_id:propertyId,service_basis:'contract',
  sticker_id:null,contract_id:contractId,planned_date:'2026-10-31',reported_status:'scheduled',
  field_notes:null,created_at:new Date(now-30000).toISOString(),completed_at:null}];
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_445_assert_hr_owner',enabled,stickers,contracts,pickups,
  sticker_count:stickers.length,contract_count:contracts.length,pickup_count:pickups.length,
  source_caps:{stickers:100,contracts:100,pickups:200},financial_receipt_verified:false,
  auto_billing:false,municipal_authorization:false,route_dispatched:false,mutation_authorized:false};
}
