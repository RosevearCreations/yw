// Synthetic data only. These are shapes from the already-audited 437/438 reads,
// not claims about real Yard Workers customers, invoices or posted balances.
export const companyId='company-439',workOrderId='work-439';
const at='2026-10-24T09:00:00Z',signed='2026-10-24T09:02:00Z';
export const services=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
export function fixtures(service='landscape'){
 const orders=[{id:workOrderId,number:'WO-439',status:'completed',service}];
 const q={company_id:companyId,work_order_id:workOrderId,orders,complete:true,source_limit:80,
  state:'review_only',approval_or_signature_write:false,customer_message_sent:false,site_reopened:false,
  qc:{id:'qc',work_order_id:workOrderId,run_status:'approved',review_status:'approved',
   reviewed_by_profile_id:'supervisor',reviewed_at:at},
  items:[{id:'item',qc_run_id:'qc',is_required:true,result_status:'pass',completed_at:at,
   evidence_requirement:'after'}],
  deficiencies:[],rework:[],
  evidence:[{id:'link',qc_run_id:'qc',qc_item_id:'item',execution_proof_id:'proof',
   evidence_role:'after',proof_work_order_id:workOrderId,proof_status:'approved',
   customer_safe:true,customer_visible:true}],
  closeout:{id:'closeout',work_order_id:workOrderId,closeout_status:'invoice_ready',
   approved_by_profile_id:'supervisor',approved_at:at,customer_signoff_required:true,
   customer_signoff_status:'signed',signed_off_at:signed,customer_change_requested:false,
   invoice_readiness_status:'ready'},
  signoffs:[{id:'portal-sign',closeout_package_id:'closeout',signoff_status:'signed',created_at:signed}]};
 const f={company_id:companyId,work_order_id:workOrderId,orders,complete:true,source_limit:120,
  state:'review_only',finance_mutation:false,job_mutation:false,payroll_mutation:false,
  order:{id:workOrderId,estimate_id:'est',legacy_job_id:7,subtotal:220,tax_total:28,
   total_amount:248,approval_status:'approved',estimate_baseline_cost_total:90,
   estimate_baseline_charge_total:200},
  estimate:{id:'est',company_id:companyId,service_module_key:service,subtotal:200,
   total_amount:226,total_cost:90,approval_status:'approved',approved_at:at},
  estimate_lines:[{id:'estline',estimate_id:'est',line_total:200,cost_total:90}],
  order_lines:[{id:'orderline',work_order_id:workOrderId,line_total:220,cost_total:90}],
  proofs:[{id:'proof',work_order_id:workOrderId,proof_type:'completion',proof_status:'approved',
   approved_at:at,approved_by_profile_id:'supervisor',labour_minutes:60,labour_cost_total:40,
   material_cost_total:20,equipment_cost_total:20,other_cost_total:20,total_cost:100}],
  crew_hours:[{id:'hours',work_order_id:workOrderId,job_id:7,hours_worked:2,
   regular_hours:2,overtime_hours:0}],
  material_issues:[{id:'issue',work_order_id:workOrderId,issue_status:'issued',issue_total:20}],
  material_lines:[{id:'line',issue_id:'issue',issue_work_order_id:workOrderId,
   work_order_line_id:'orderline',usage_type:'job_use',quantity:2,unit_cost:10,line_total:20}],
  equipment:[{id:9,work_order_id:workOrderId,job_id:7,checked_out_at:at}],
  allocations:[{id:'mat',company_id:companyId,work_order_id:workOrderId,
   material_issue_line_id:'line',equipment_signout_id:null,source_fresh:true},
   {id:'equip',company_id:companyId,work_order_id:workOrderId,
    material_issue_line_id:null,equipment_signout_id:9,source_fresh:true}],
  invoice_candidates:[{id:'candidate',work_order_id:workOrderId,estimate_id:'est',
   candidate_status:'posted',subtotal:230,tax_total:30,total_amount:260}],
  invoice_postings:[{id:'posting',invoice_candidate_id:'candidate',
   candidate_work_order_id:workOrderId,ar_invoice_id:'invoice',posting_status:'posted',posted_at:at}],
  ar_invoices:[{id:'invoice',work_order_id:workOrderId,invoice_status:'issued',
   subtotal:230,tax_total:30,total_amount:260,amount_paid:0,balance_due:260}]};
 return {q,f};
}
export function directories(q,f){return [
  {...q,work_order_id:null,state:'choose_order'},
  {...f,work_order_id:null,state:'choose_order'}];}
