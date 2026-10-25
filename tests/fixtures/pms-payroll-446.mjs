// Synthetic company-level payroll only; nothing copied from real user credentials or wages.
import {company,companyId,foreignCompanyId,ownerId,companyAdminTest,employeeId}
 from './pms-hr-garbage-445.mjs';
export {company,companyId,foreignCompanyId,ownerId,companyAdminTest,employeeId};
export const lineId='a4460000-0000-4446-8446-000000000001';
export function payroll({now=Date.now(),enabled=true,effective=enabled}={}){
 const lines=effective?[{id:lineId,employee_id:employeeId,pay_period_start:'2026-10-01',
  pay_period_end:'2026-10-14',reported_minutes:480,rate_cents:2550,
  reported_deductions_cents:1050,planned_benefits_cents:1200,planned_vacation_cents:300,
  gross_projection_cents:20400,time_approval_source_ref:'SYNTH-TIME-APPROVAL-001',
  reported_status:'reviewed_for_planning',correction_of:null,notes:'Example only',
  created_at:new Date(now-60000).toISOString()}]:[];
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_446_assert_payroll_owner',enabled,effective,lines,
  line_count:lines.length,rates_exposed:effective,payroll_executed:false,
  direct_deposit_available:false,tax_filing_available:false,mutation_authorized:false};
}
