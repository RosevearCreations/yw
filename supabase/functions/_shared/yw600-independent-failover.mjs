// YW600 server-only failover authorization. No network I/O before a durable claim.
// Exhaust the YW599 bounded primary lane first so that neither lane can race
// another primary retry. Every prior non-delivery must be independently verified.
import {digest,verify,sendClaimedNotification} from './yw599-independent-recovery.mjs';
import {verifyEnrollment} from './yw599-approval-verification.mjs';
const hold=code=>{throw Error('YW600_'+code+'_HOLD')};
const must=(ok,code)=>{if(!ok)hold(code)};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const ts=x=>Date.parse(x);
const host=c=>new URL(c.url).hostname.toLowerCase();
const separate=(a,b)=>a!==b&&!a.endsWith('.'+b)&&!b.endsWith('.'+a);
const iso=x=>new Date(x).toISOString();
export async function verifyPrimaryNonDelivery({companyId,alert,primary,attempts,receiptKey,now=Date.now()}){
 must(uuid(companyId)&&uuid(alert?.id)&&alert.company_id===companyId&&primary.company_id===companyId&&uuid(primary.id),'TENANT');
 must(alert.source==='DB_CRON_15_MINUTE_EVIDENCE_WATCH'&&['NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD'].includes(alert.issue_code)&&ts(alert.detected_at)<=now&&ts(alert.detected_at)>=now-86400000,'SOURCE');
 const sourceSha=await digest({schema:'rosevear.yw.db-watch-alert.v1',companyId,alertId:alert.id,enrollmentId:alert.enrollment_id,issueCode:alert.issue_code,detectedAt:iso(alert.detected_at),periodStart:iso(alert.period_start),observedSampleId:alert.observed_sample_id??null,source:alert.source});
 must(Array.isArray(attempts)&&attempts.length===3,'PRIMARY_NOT_EXHAUSTED');
 const nonces=new Set(),receipts=new Set(),evidence=[];
 for(let i=0;i<3;i++){
  const {claim:c,result:r}=attempts[i]??{};
  must(c&&r&&uuid(c.id)&&!nonces.has(c.id)&&c.company_id===companyId&&c.enrollment_id===primary.id&&c.alert_id===alert.id&&c.attempt===i+1&&c.source_sha256===sourceSha&&ts(c.claimed_at)>=ts(alert.detected_at)&&ts(c.claimed_at)<=now,'PRIMARY_CLAIM');
  if(i)must(ts(c.claimed_at)-ts(attempts[i-1].claim.claimed_at)>=[60000,300000][i-1],'PRIMARY_BACKOFF');
  must(r.claim_id===c.id&&r.state==='DEFINITIVE_FAILURE'&&r.receipt_payload&&typeof r.provider_receipt_id==='string'&&!receipts.has(r.provider_receipt_id),'PRIMARY_NOT_DEFINITIVE');
  const p=r.receipt_payload;
  const body={schema:'rosevear.yw.outage-notification.v1',providerId:primary.provider_id,companyId,alertId:alert.id,enrollmentId:primary.id,nonce:c.id,recipientRef:primary.recipient_ref,issueCode:alert.issue_code,sourceSha256:sourceSha,idempotencyKey:companyId+':'+alert.id+':'+primary.id,noCustomerData:true};
  const d=await digest(body);
  must(p.schema==='rosevear.yw.outage-notification-receipt.v1'&&p.status==='NOT_DELIVERED'&&p.providerId===body.providerId&&p.companyId===companyId&&p.alertId===alert.id&&p.enrollmentId===primary.id&&p.nonce===c.id&&p.recipientRef===body.recipientRef&&p.sourceSha256===sourceSha&&p.requestDigest===d&&r.request_digest===d&&p.receiptId===r.provider_receipt_id&&ts(p.observedAt)>=ts(c.claimed_at)&&ts(p.observedAt)<=now&&ts(r.recorded_at)>=ts(p.observedAt)&&ts(r.recorded_at)<=now,'PRIMARY_RECEIPT_BINDING');
  must(await verify(receiptKey,'YW599-PROVIDER-RECEIPT',p,r.receipt_signature),'PRIMARY_RECEIPT_SIGNATURE');
  nonces.add(c.id);receipts.add(p.receiptId);evidence.push({claimId:c.id,receiptId:p.receiptId,requestDigest:d,signature:r.receipt_signature});
 }
 return {sourceSha256:sourceSha,primaryClaimIds:[...nonces],evidenceSha256:await digest(evidence)};
}
export async function executeFailover({actor,companyId,alertId,primaryId,secondaryId,confirmed,enabled,db,primaryConfig,secondaryConfig,keys,fetcher=fetch,now=Date.now()}){
 if(enabled!==true)return {state:'FAILOVER_DISABLED_HOLD'};
 must(confirmed===true&&actor?.active===true&&[actor.id,companyId,alertId,primaryId,secondaryId].every(uuid)&&primaryId!==secondaryId,'AUTHORITY');
 const [primary,secondary,alert,company]=await Promise.all([db.one('ywi_599_provider_enrollments',{id:primaryId,company_id:companyId}),db.one('ywi_599_provider_enrollments',{id:secondaryId,company_id:companyId}),db.one('ywi_597_health_alerts',{id:alertId,company_id:companyId}),db.one('ywi_companies',{id:companyId})]);
 must(primary.owner_id===actor.id&&secondary.owner_id===actor.id&&primary.reviewer_id===secondary.reviewer_id&&primary.provider_id!==secondary.provider_id&&company.owner_user_id===actor.id,'DISTINCT_ENROLLMENT');
 must(primaryConfig.companyId===companyId&&secondaryConfig.companyId===companyId&&primaryConfig.providerId===primary.provider_id&&secondaryConfig.providerId===secondary.provider_id&&primaryConfig.recipientRef===primary.recipient_ref&&secondaryConfig.recipientRef===secondary.recipient_ref&&await digest(primaryConfig)===primary.config_sha256&&await digest(secondaryConfig)===secondary.config_sha256&&separate(host(primaryConfig),host(secondaryConfig))&&primaryConfig.masterHost===secondaryConfig.masterHost&&separate(host(secondaryConfig),secondaryConfig.masterHost),'INDEPENDENT_CONFIG');
 must(new Set([keys.owner,keys.reviewer,keys.primaryReceipt,keys.secondaryRequest,keys.secondaryReceipt]).size===5,'KEY_SEPARATION');
 const [approval,pilot,profiles,revoked,watch,attempts]=await Promise.all([db.one('ywi_599_provider_approvals',{enrollment_id:secondaryId}),db.one('ywi_591_tenant_pilots',{company_id:companyId,owner_user_id:actor.id,reviewer_user_id:secondary.reviewer_id,state:'APPROVED'}),db.profiles([secondary.owner_id,secondary.reviewer_id]),db.optional('ywi_599_provider_revocations',{enrollment_id:secondaryId}),db.one('ywi_597_health_enrollments',{id:alert.enrollment_id,company_id:companyId}),db.primaryAttempts(companyId,alertId,primaryId)]);
 must(watch.owner_user_id===actor.id,'SOURCE_OWNER');
 await verifyEnrollment({enrollment:secondary,approval,company,pilot,profiles,revoked,config:secondaryConfig,ownerKey:keys.owner,reviewerKey:keys.reviewer,now});
 const proof=await verifyPrimaryNonDelivery({companyId,alert,primary,attempts,receiptKey:keys.primaryReceipt,now});
 const claim=await db.rpc('ywi_600_claim_failover',{p_company:companyId,p_alert:alertId,p_primary:primaryId,p_secondary:secondaryId,p_source_sha:proof.sourceSha256,p_primary_claim_ids:proof.primaryClaimIds,p_evidence_sha:proof.evidenceSha256});
 if(claim?.state!=='ATOMIC_CLAIMED')return {state:claim?.state??'FAILOVER_HOLD'};
 must(claim.companyId===companyId&&claim.alertId===alertId&&claim.enrollmentId===secondaryId&&claim.providerId===secondary.provider_id&&claim.recipientRef===secondary.recipient_ref&&claim.sourceSha256===proof.sourceSha256&&claim.attempt===1,'CLAIM_BINDING');
 const result=await sendClaimedNotification({claim:{...claim,claimedAt:iso(claim.claimedAt)},config:secondaryConfig,requestKey:keys.secondaryRequest,receiptKey:keys.secondaryReceipt,fetcher,now:Date.now()});
 await db.insert('ywi_600_failover_results',{claim_id:claim.nonce,state:result.state,provider_receipt_id:result.receipt?.receiptId??null,request_digest:result.requestDigest,receipt_payload:result.receipt??null,receipt_signature:result.signature??null});
 return {state:result.state,claimId:claim.nonce,automaticRecoveryPerformed:false};
}
