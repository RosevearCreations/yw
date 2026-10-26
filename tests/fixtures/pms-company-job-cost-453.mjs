// Fictional Yard Rosevear groups only; never seed Production/Auth/Finance.
export const ownerId='84530000-0000-4453-8453-000000000001';
export const companyId='84530000-0000-4453-8453-000000000002';
export const company2Id='84530000-0000-4453-8453-000000000003';
export const foreignCompanyId='84530000-0000-4453-8453-000000000099';
export const orderId='84530000-0000-4453-8453-000000000004';
export const otherOrderId='84530000-0000-4453-8453-000000000005';
export const revenueId='84530000-0000-4453-8453-000000000006';
export const costId='84530000-0000-4453-8453-000000000007';
export const people=[{id:companyId,name:'Yard Rosevear',owner_user_id:ownerId},
 {id:company2Id,name:'Demo East Operations',owner_user_id:ownerId}];
export function fixture({company=companyId,now=Date.now(),empty=false}={}){
 const order=company===companyId?orderId:otherOrderId;
 const orders=[{id:order,company_id:company,
  client_id:'84530000-0000-4453-8453-000000000008',
  site_id:'84530000-0000-4453-8453-000000000009',number:'DEMO-JOB',service:'landscape',status:'planned'}];
 const lines=empty?[]:[
  {id:revenueId,company_id:company,work_order_id:order,category:'revenue_plan',amount_cents:40000,
   source_reference:'fictional-quote-1',report_status:'for_review',correction_of:null,
   notes:null,recorded_at:new Date(now).toISOString()},
  {id:costId,company_id:company,work_order_id:order,category:'workforce_burden',amount_cents:12500,
   source_reference:'fictional-burden-aggregate',report_status:'for_review',correction_of:null,
   notes:null,recorded_at:new Date(now).toISOString()}];
 return{company_id:company,captured_at:new Date(now).toISOString(),owner_guard:'ywi_453_assert_cost_scope',
  accounting_fields:['costs','reports'],orders,order_count:orders.length,lines,line_count:lines.length,
  report:{currency:'CAD',revenue_cents:empty?0:40000,cost_cents:empty?0:12500,
   difference_cents:empty?0:27500,included_count:lines.length},
  source_kind:'operator_plan_only',original_438_costs_not_duplicated:true,
  wages_exposed:false,individual_rates_exposed:false,payroll_executed:false,
  ledger_posted:false,verified_profit:false,invoice_created:false,cross_company_grant:false,
  mutation_authorized:false};
}
