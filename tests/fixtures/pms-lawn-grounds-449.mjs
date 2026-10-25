// All data fictional. No live company, customer or property is copied or seeded.
import {company,companyId,foreignCompanyId,ownerId,customerId,propertyId,foreignPropertyId}
 from './pms-client-property-360-444.mjs';
export {company,companyId,foreignCompanyId,ownerId,customerId,propertyId,foreignPropertyId};
export const planId='a4490000-0000-4444-8444-000000000001';
export const zoneId='b4490000-0000-4444-8444-000000000001';
export const secondZoneId='b4490000-0000-4444-8444-000000000002';
export const visitId='c4490000-0000-4444-8444-000000000001';
export const visit2Id='c4490000-0000-4444-8444-000000000002';
export const customers=()=>[{id:customerId,name:'Fictional Lawn Customer',is_active:true}];
export const propertyHistory=()=>({company_id:companyId,client_id:customerId,
 legacy_unscoped_excluded:true,properties:[{id:propertyId,name:'Sample Lawn Lot',address:'Fictional test address'}]});
export function fixture({now=Date.now(),enabled=true}={}){
 const created=new Date(now-60000).toISOString();
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_422_assert_owner',new_work_guard:'ywi_421_assert_company_new_work',
  module_key:'landscape',enabled,historical_read_retained:true,
  dispatch_authorized:false,invoice_posted:false,qc_verified_independently:false,
  mutation_authorized:false,
  plans:[{id:planId,company_id:companyId,client_id:customerId,site_id:propertyId,
    client_name:'Fictional Lawn Customer',site_name:'Sample Lawn Lot',service_kind:'mowing',
    recurrence:'weekly',interval_days:null,anchor_date:'2026-10-21',season_end_date:'2026-11-30',
    estimated_minutes:75,quoted_cents:4900,route_reference:'L-TEST-04',
    source_reference:'fictional-plan-source-01',notes:'No real schedule',created_at:created}],
  zones:[{id:zoneId,company_id:companyId,plan_id:planId,zone_name:'Front turf',area:600,
    area_unit:'sq_ft',surface:'turf',task_note:'Gate code withheld',source_reference:'measure-01',created_at:created},
   {id:secondZoneId,company_id:companyId,plan_id:planId,zone_name:'Rear garden',area:100,
    area_unit:'sq_m',surface:'garden_bed',task_note:null,source_reference:'measure-02',created_at:created}],
  visits:[{id:visitId,company_id:companyId,plan_id:planId,zone_id:zoneId,
    service_date:'2026-10-21',reported_status:'completed',route_reference:'L-TEST-04',
    crew_minutes:80,travel_minutes:20,material_name:'mulch',material_quantity:3,
    material_unit:'bags',estimated_visit_cents:4900,qc_status:'pass_reported',qc_note:null,
    photo_reference:'synthetic-photo-label-1',source_reference:'synthetic-field-01',field_note:'Test only',recorded_at:created},
   {id:visit2Id,company_id:companyId,plan_id:planId,zone_id:secondZoneId,
    service_date:'2026-10-23',reported_status:'qc_followup',route_reference:'L-TEST-04',
    crew_minutes:20,travel_minutes:0,material_name:null,material_quantity:null,
    material_unit:null,estimated_visit_cents:0,qc_status:'followup_required',qc_note:'Recheck edging',
    photo_reference:null,source_reference:'synthetic-field-02',field_note:null,recorded_at:created}],
  plan_count:1,zone_count:2,visit_count:2};
}
