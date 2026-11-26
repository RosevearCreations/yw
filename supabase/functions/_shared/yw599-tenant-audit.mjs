import {digest,verify,verifyCutoverReadback} from './yw599-independent-recovery.mjs';
import {verifyEnrollment} from './yw599-approval-verification.mjs';
import {verifyOriginalDrill} from './yw599-original-cutover-chain.mjs';
const stamp=x=>new Date(x).toISOString();
const hold=()=>{throw Error('YW599_AUDIT_EVIDENCE_HOLD')};
export async function verifyTenantRecovery({db,company,pilot,cutoverId,claimId,reviewerId,config,keys,now=Date.now(),verifyDrill=verifyOriginalDrill}){
 if(company.owner_user_id!==pilot.owner_user_id||pilot.reviewer_user_id!==reviewerId||reviewerId===company.owner_user_id||config.companyId!==company.id)hold();
 const c=await db.one('ywi_599_final_cutover_receipts',{id:cutoverId,company_id:company.id});
 const n=await db.one('ywi_599_notification_claims',{id:claimId,company_id:company.id});
 const r=await db.one('ywi_599_notification_results',{claim_id:n.id});
 const e=await db.one('ywi_599_provider_enrollments',{id:n.enrollment_id,company_id:company.id});
 const a=await db.one('ywi_599_provider_approvals',{enrollment_id:e.id});
 const revoked=await db.optional('ywi_599_provider_revocations',{enrollment_id:e.id});
 const profiles=await db.profiles([e.owner_id,e.reviewer_id]);
 await verifyEnrollment({enrollment:e,approval:a,company,pilot,profiles,revoked,config,ownerKey:keys.owner,reviewerKey:keys.reviewer,now});
 if(c.owner_id!==company.owner_user_id||c.reviewer_id!==reviewerId||r.state!=='VERIFIED_DELIVERY'||!r.receipt_payload||!r.receipt_signature||r.provider_receipt_id!==r.receipt_payload.receiptId||![c.verified_at,r.recorded_at].every(t=>Date.parse(t)<=now&&Date.parse(t)>=now-86400000))hold();
 const chain=await verifyDrill({companyId:company.id,ownerId:c.owner_id,reviewerId:c.reviewer_id,actorId:c.auditor_id,drillId:c.rollback_drill_id,confirmed:true});
 const ch=c.challenge;
 if(!ch||ch.companyId!==company.id||ch.executionId!==chain.executionId||ch.rollbackDrillId!==chain.rollbackDrillId||ch.oldContractId!==chain.oldContractId||ch.nextContractId!==chain.nextContractId||ch.nonce!==c.challenge_nonce||c.execution_id!==chain.executionId||c.source_receipt_ref!==chain.sourceReceiptId||c.remote_receipt_id!==c.response_payload?.receiptId)hold();
 await verifyCutoverReadback({challenge:ch,response:{...c.response_payload,oldSignature:c.old_signature,nextSignature:c.next_signature},oldKey:keys.masterOld,nextKey:keys.masterNext,now:Date.parse(c.verified_at)});
 const alert=await db.one('ywi_597_health_alerts',{id:n.alert_id,company_id:company.id});
 const watch=await db.one('ywi_597_health_enrollments',{id:alert.enrollment_id,company_id:company.id});
 if(watch.owner_user_id!==company.owner_user_id||alert.source!=='DB_CRON_15_MINUTE_EVIDENCE_WATCH'||!['NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD'].includes(alert.issue_code))hold();
 const source=await digest({schema:'rosevear.yw.db-watch-alert.v1',companyId:company.id,alertId:alert.id,enrollmentId:alert.enrollment_id,issueCode:alert.issue_code,detectedAt:stamp(alert.detected_at),periodStart:stamp(alert.period_start),observedSampleId:alert.observed_sample_id??null,source:alert.source});
 const request={schema:'rosevear.yw.outage-notification.v1',providerId:e.provider_id,companyId:company.id,alertId:alert.id,enrollmentId:e.id,nonce:n.id,recipientRef:e.recipient_ref,issueCode:alert.issue_code,sourceSha256:source,idempotencyKey:company.id+':'+alert.id+':'+e.id,noCustomerData:true};
 const rd=await digest(request),p=r.receipt_payload;
 if(source!==n.source_sha256||r.request_digest!==rd||p.requestDigest!==rd||p.schema!=='rosevear.yw.outage-notification-receipt.v1'||p.providerId!==request.providerId||p.companyId!==company.id||p.alertId!==alert.id||p.enrollmentId!==e.id||p.nonce!==n.id||p.recipientRef!==e.recipient_ref||p.sourceSha256!==source||p.status!=='DELIVERED'||!(Date.parse(p.observedAt)>=Date.parse(n.claimed_at)&&Date.parse(p.observedAt)<=Date.parse(r.recorded_at)+30000)||!await verify(keys.receipt,'YW599-PROVIDER-RECEIPT',p,r.receipt_signature))hold();
 return {companyId:company.id,ownerId:company.owner_user_id,reviewerId,sourceReceiptId:chain.sourceReceiptId,providerReceiptId:r.provider_receipt_id,cutoverReceiptId:c.remote_receipt_id,rollbackReceiptId:chain.rollbackDrillId,sourceVerified:true,providerReceiptVerified:true,cutoverReadbackVerified:true,rollbackWitnessVerified:true,independentReviewerVerified:true,verifiedAt:new Date(now).toISOString()};
}
