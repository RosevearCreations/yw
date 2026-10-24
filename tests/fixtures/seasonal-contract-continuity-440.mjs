export const companyId='11111111-1111-4111-8111-111111111111';
export const workOrderId='22222222-2222-4222-8222-222222222222';
export const clientId='33333333-3333-4333-8333-333333333333';
export const siteId='44444444-4444-4444-8444-444444444444';
export const routeId='55555555-5555-4555-8555-555555555555';
export const dispatchId='66666666-6666-4666-8666-666666666666';
export const agreementId='77777777-7777-4777-8777-777777777777';
export const stormId='88888888-8888-4888-8888-888888888888';
export const receiptId='99999999-9999-4999-8999-999999999999';
export const triggerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const eventId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export function fixture(service='snow_plowing'){
 const c={company_id:companyId,work_order_id:workOrderId,state:'review_only',complete:true,
  source_limit:80,mutation_authorized:false,automatic_renewal:false,
  automatic_dispatch:false,automatic_billing:false,service_enabled_now:true,
  agreement_scope:'owner_created_exact_customer_and_property_only',
  order:{id:workOrderId,service,number:'WO-EXAMPLE',client_id:clientId,
   client_site_id:siteId,status:'approved'},
  agreements:[{id:agreementId,agreement_code:'AGR-SNOW',service_name:'Seasonal snow',
   client_id:clientId,client_site_id:siteId,route_id:routeId,
   agreement_status:'active',start_date:'2026-10-01',end_date:'2027-04-30'}],
  visit_events:[{id:eventId,agreement_id:agreementId,original_service_date:'2026-10-02',event_type:'makeup'}],
  snow_triggers:[{id:triggerId,agreement_id:agreementId,event_date:'2026-10-02',trigger_met:true}],
  dispatch_routes:[{dispatch_id:dispatchId,route_id:routeId,client_site_id:siteId,schedule_status:'completed'}]};
 const field={company_id:companyId,work_order_id:workOrderId,complete:true,
  source_limit:80,state:'review_only',orders:[{id:workOrderId,number:'WO-EXAMPLE',status:'approved',service}],
  sources:[],receipts:[]};
 if(service==='landscape'){
  c.snow_triggers=[];field.review_only=true;
  field.receipts=[{id:receiptId,source_session_date:'2026-10-02',state:'recorded_unreviewed'}];
 }else{
  field.no_automatic_dispatch=true;field.no_double_billing=true;
  field.sources=[{dispatch_id:dispatchId,storm_event_id:stormId,activation_id:triggerId,
   activation_status:'active'}];
  field.receipts=[{id:receiptId,dispatch_id:dispatchId,storm_event_id:stormId,
   service_module_key:service,observed_on:'2026-10-02',evidence_state:'reported_unverified',
   source_gate:'independent_dispatch_safety_review_required'}];
 }
 return{c,field};
}
