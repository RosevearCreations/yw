// Synthetic-only tenant. Yard Rosevear is not a real Supabase user/company.
export const companyId='a4410000-0000-4441-8441-000000000001';
export const foreignCompanyId='a4410000-0000-4441-8441-000000000002';
export const ownerId='synthetic-yard-rosevear-owner';
export const workOrderId='b4410000-0000-4441-8441-000000000001';
export const company=Object.freeze({id:companyId,name:'Yard Rosevear',owner_user_id:ownerId});
export const services=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
export function fixture(service='landscape',options={}){
 const now=options.now||new Date().toISOString();
 const modules=services.map(module_key=>({module_key,enabled:module_key===service}));
 const orders=[{id:workOrderId,number:'YR-441-01',service,status:'open'}];
 const base={company_id:companyId,complete:true,source_limit:60,captured_at:now,
  modules,orders,scoped_order_count:orders.length,privacy_minimized:true,
  tenant_guard:'owner_and_jobs_view_422',trial_accepted:false,
  release_green_verified:false,mutation_authorized:false};
 const directory={...base,work_order_id:null,state:'choose_order'};
 const detail={...base,work_order_id:workOrderId,state:'review_only',evidence_limit:80,
  source_last_at:now,order:{...orders[0],customer_present:true,
   property_present:true,verified_company_customer_property:true,service_enabled_now:true},
  coverage:{original_proofs:1,dispatch_records:1,qc_runs:1,specialist_receipts:1}};
 return {directory,detail};
}
