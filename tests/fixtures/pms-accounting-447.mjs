// Fictional Yard Rosevear Accounting review journal — neither invoices nor ledger postings.
import {company,companyId,foreignCompanyId,ownerId,companyAdminTest}
 from './pms-payroll-446.mjs';
import {customerId,propertyId} from './pms-hr-garbage-445.mjs';
export {company,companyId,foreignCompanyId,ownerId,companyAdminTest,customerId,propertyId};
export const allAccess={receivables:true,payables:true,costs:true,reports:true,payroll_reference:true,bank:false};
export function accounting({now=Date.now(),enabled=true,access=allAccess}={}){
 const types=['receivable','payable','job_cost','ledger_note','tax_note'];
 const map={receivable:'receivables',payable:'payables',job_cost:'costs',ledger_note:'reports',tax_note:'reports'};
 const available=enabled?{...access,bank:false}:{receivables:false,payables:false,costs:false,
  reports:false,payroll_reference:false,bank:false};
 const drafts=types.filter(x=>available[map[x]]).map((x,i)=>({
  id:`a4470000-0000-4447-8447-${String(i+1).padStart(12,'0')}`,
  category:x,title:'Sample '+x+' source',description:'Testing only',
  source_reference:'SYNTH-LEDGER-'+(i+1),source_type:'manual_review',
  amount_cents:(i+1)*12500,currency:'CAD',reported_status:'for_review',
  client_id:x==='job_cost'?customerId:null,site_id:x==='job_cost'?propertyId:null,
  created_at:new Date(now-(i+1)*60000).toISOString()}));
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_447_assert_accounting_owner',enabled,access:available,drafts,
  draft_count:drafts.length,ledger_posted:false,payment_executed:false,
  invoices_created:false,tax_filing_available:false,mutation_authorized:false};
}
