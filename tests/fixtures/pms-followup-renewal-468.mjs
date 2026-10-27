// Fictitious documentary-only follow-up examples. Do not seed live Supabase.
import {fixture as previous,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from './pms-comparison-followup-467.mjs';
export {companyId,ownerId,alternativeId,reviewerId,foreignCompanyId};
export const renewalId='a4680000-0000-4468-8468-000000000001';
export function fixture({now=Date.now(),days=0,reviewer=false,renewed=false,off=false}={}){
 const originalTime=now-days*86400000-5000;
 const f=previous({now:originalTime,reviewer,compared:true,outcomeRecorded:true,followed:true,off});
 const asOf=new Date(now).toISOString();
 // Keep the original chain immutable, but recapture both bounded server views at verification time.
 f.inbox.captured_at=asOf;f.view.captured_at=asOf;f.view.handoff_source.captured_at=asOf;
 const renewal={id:renewalId,company_id:companyId,followup_id:f.followup.id,
  reviewer_user_id:alternativeId,decision:'evidence_still_insufficient',source_reference:'INDEPENDENT-468-NEW-EVIDENCE',
  created_at:new Date(now-1000).toISOString()};
 const ageDays=Math.floor((now-Date.parse(f.followup.created_at))/86400000);
 const aging=[{followup_id:f.followup.id,outcome_id:f.outcome.id,age_days:ageDays,
  band:ageDays>=15?'overdue':ageDays>=8?'aging':'current'}];
 const renewals=renewed?[renewal]:[];
 return {...f,renewal,view:{...f.view,aging_as_of:asOf,aging,renewals,renewal_total:renewals.length,
  renewal_sample_capped:false}};
}
