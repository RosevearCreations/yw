// Synthetic company-level ADMIN role COPY only — no copied real credentials,
// Supabase identity, service-role token or database records.
export const companyId='a4420000-0000-4442-8442-000000000001';
export const foreignCompanyId='a4420000-0000-4442-8442-000000000002';
export const ownerId='d4420000-0000-4442-8442-000000000001';
export const company=Object.freeze({id:companyId,name:'Yard Rosevear',owner_user_id:ownerId});
export const companyAdminTest=Object.freeze({
 id:'e4420000-0000-4442-8442-000000000001',display_name:'Yard Rosevear — Company Admin (test)',
 role:'company_admin',scope_company_id:companyId,simulates_admin_navigation:true,
 grant:Object.freeze({jobs:'view',safety:'view',finance_summary:'view',company_management:'manage',
  payroll_bank_data:false,real_payment_approval:false,global_users:false,cross_company:false}),
 real_auth_account:false,password_copied:false,live_company_created:false
});
export const serviceKeys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
export function fixture({count=12,enabled=true,now=Date.now()}={}){
 const utcMidnight=Math.floor(now/86400000)*86400000;
 const iso=n=>new Date(n).toISOString();
 const zero={first_jobs:count,verified_customer_site:count,unlinked_original_jobs:0,
  dispatch_present:count,production_present:count,execution_proof_present:count,
  qc_present:count,invoice_present:count,specialist_receipt_present:count};
 return {company_id:companyId,owner_guard:'ywi_422_assert_owner',
  captured_at:iso(now),privacy_minimized:true,synthetic:false,
  source_coverage:'complete',capped:false,max_original_jobs:2000,
  total_company_jobs:count*12,minimum_per_service_period:10,
  periods:{previous:{start:iso(utcMidnight-28*86400000),end:iso(utcMidnight-14*86400000)},
   current:{start:iso(utcMidnight-14*86400000),end:iso(utcMidnight)}},
  services:serviceKeys.map(service=>({service,enabled,
   previous:{...zero},current:{...zero}})),
  comparison_accepted:false,roi:null,employee_ranking:null,causal_improvement:null,
  mutation_authorized:false};
}
