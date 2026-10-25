// Invented Yard Rosevear GL test-mode figures. No copied banking, payroll or real ledger activity.
import {company,companyId,foreignCompanyId,ownerId,companyAdminTest}
 from './pms-accounting-447.mjs';
export {company,companyId,foreignCompanyId,ownerId,companyAdminTest};
export const journalId='a4480000-0000-4448-8448-000000000001';
export const reverseId='a4480000-0000-4448-8448-000000000002';
export const period='2026-10-01';
export function gl({now=Date.now(),enabled=true,locked=false,reversed=false}={}){
 const originals=[{id:journalId,period_start:period,effective_on:'2026-10-10',
  source_reference:'SYNTH-SUPPLIER-448',narration:'Invented supplier accrual',
  reversal_of:null,review_status:'reviewed_for_simulation',test_mode:true,
  created_at:new Date(now-60000).toISOString(),lines:[
   {account:'5000',side:'debit',cents:12500},
   {account:'2000',side:'credit',cents:12500}]}];
 if(reversed)originals.push({id:reverseId,period_start:period,effective_on:'2026-10-11',
  source_reference:'SYNTH-REVERSAL-448',narration:'Reversal of invented supplier accrual',
  reversal_of:journalId,review_status:null,test_mode:true,
  created_at:new Date(now-30000).toISOString(),lines:[
   {account:'5000',side:'credit',cents:12500},
   {account:'2000',side:'debit',cents:12500}]});
 const journals=enabled?originals:[];
 const nets=new Map();let debit=0,credit=0;
 for(const j of journals)for(const l of j.lines){if(l.side==='debit')debit+=l.cents;else credit+=l.cents;
  nets.set(l.account,(nets.get(l.account)||0)+(l.side==='debit'?l.cents:-l.cents));}
 const accounts=[...nets].sort(([a],[b])=>a.localeCompare(b)).map(([account,net_debit_cents])=>({
  account,net_debit_cents,liability_debit_warning:['2000','2100','2200'].includes(account)&&net_debit_cents>0}));
 return {company_id:companyId,captured_at:new Date(now).toISOString(),
  owner_guard:'ywi_448_assert_gl_owner',enabled,test_mode:true,
  periods:enabled?[{period_start:period,locked}]:[],period_count:enabled?1:0,
  journals,journal_count:journals.length,accounts,total_debits_cents:debit,total_credits_cents:credit,
  posting_available:false,bank_access:false,tax_filing_available:false,real_balance_changed:false};
}
