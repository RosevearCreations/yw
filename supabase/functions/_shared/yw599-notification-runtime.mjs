import {digest,sendClaimedNotification} from './yw599-independent-recovery.mjs';
import {verifyEnrollment} from './yw599-approval-verification.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hold=()=>{throw new Error('YW599_RUNTIME_AUTHORITY_HOLD')};
// Adapter must authenticate the bearer against Auth, not decode untrusted JWT claims.
// All reads are server-side and scoped; no browser-supplied configuration or evidence.
export async function deliverOriginalAlert({actor,companyId,enrollmentId,alertId,confirmed,db,config,keys,fetcher=fetch,now=Date.now()}){
 if(confirmed!==true||![actor?.id,companyId,enrollmentId,alertId].every(x=>typeof x==='string'&&uuid.test(x))||actor.active!==true)hold();
 const e=await db.one('ywi_599_provider_enrollments',{id:enrollmentId,company_id:companyId});
 if(!e||e.owner_id!==actor.id)hold();
 const [approval,company,pilot,profiles,revoked,alert]=await Promise.all([
 db.one('ywi_599_provider_approvals',{enrollment_id:enrollmentId}),
 db.one('ywi_companies',{id:companyId}),
 db.one('ywi_591_tenant_pilots',{company_id:companyId,owner_user_id:e.owner_id,reviewer_user_id:e.reviewer_id,state:'APPROVED'}),
 db.profiles([e.owner_id,e.reviewer_id]),
 db.optional('ywi_599_provider_revocations',{enrollment_id:enrollmentId}),
 db.one('ywi_597_health_alerts',{id:alertId,company_id:companyId})
 ]);
 await verifyEnrollment({enrollment:e,approval,company,pilot,profiles,revoked,config,ownerKey:keys.owner,reviewerKey:keys.reviewer,now});
 if(!alert||alert.source!=='DB_CRON_15_MINUTE_EVIDENCE_WATCH'||!['NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD'].includes(alert.issue_code)||!(Date.parse(alert.detected_at)<=now&&Date.parse(alert.detected_at)>=now-86400000))hold();
 const watch=await db.one('ywi_597_health_enrollments',{id:alert.enrollment_id,company_id:companyId});
 if(!watch||watch.owner_user_id!==actor.id)hold();
 // This digest identifies the stored DB watchdog event, not independently measured receiver downtime.
 const sourceSha256=await digest({schema:'rosevear.yw.db-watch-alert.v1',companyId,alertId,enrollmentId:alert.enrollment_id,issueCode:alert.issue_code,detectedAt:new Date(alert.detected_at).toISOString(),periodStart:new Date(alert.period_start).toISOString(),observedSampleId:alert.observed_sample_id??null,source:alert.source});
 const claim=await db.rpc('ywi_599_claim_notification',{p_company:companyId,p_enrollment:enrollmentId,p_alert:alertId,p_source_sha:sourceSha256});
 if(claim?.state!=='ATOMIC_CLAIMED')return {state:claim?.state??'HOLD'};
 if(claim.companyId!==companyId||claim.enrollmentId!==enrollmentId||claim.alertId!==alertId||claim.sourceSha256!==sourceSha256)hold();
 const result=await sendClaimedNotification({claim:{...claim,claimedAt:new Date(claim.claimedAt).toISOString()},config,requestKey:keys.request,receiptKey:keys.receipt,fetcher,now:Date.now()});
 // A failed persistence leaves the original claim in flight, blocking retries.
 await db.insert('ywi_599_notification_results',{claim_id:claim.nonce,state:result.state,provider_receipt_id:result.receipt?.receiptId??null,request_digest:result.requestDigest,receipt_payload:result.receipt??null,receipt_signature:result.signature??null});
 return {state:result.state,claimId:claim.nonce};
}
