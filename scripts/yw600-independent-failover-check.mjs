import assert from 'node:assert/strict';
import {digest,sign} from '../supabase/functions/_shared/yw599-independent-recovery.mjs';
import {verifyPrimaryNonDelivery,executeFailover} from '../supabase/functions/_shared/yw600-independent-failover.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now=Date.parse('2026-11-26T12:30:00Z'),iso=t=>new Date(t).toISOString(),key='isolated-fixture-primary-receipt-key-000';
const companyId=id(1),primary={id:id(2),company_id:companyId,provider_id:'fixture-primary',recipient_ref:'fixture-recipient'};
const alert={id:id(3),company_id:companyId,enrollment_id:id(4),source:'DB_CRON_15_MINUTE_EVIDENCE_WATCH',issue_code:'NO_SIGNED_MASTER_ACK_30M',detected_at:iso(now-600000),period_start:iso(now-2400000),observed_sample_id:null};
const sourceSha256=await digest({schema:'rosevear.yw.db-watch-alert.v1',companyId,alertId:alert.id,enrollmentId:alert.enrollment_id,issueCode:alert.issue_code,detectedAt:alert.detected_at,periodStart:alert.period_start,observedSampleId:null,source:alert.source});
const attempts=[];
for(let i=0;i<3;i++){
 const claim={id:id(10+i),company_id:companyId,enrollment_id:primary.id,alert_id:alert.id,attempt:i+1,source_sha256:sourceSha256,claimed_at:iso(now-[540000,480000,120000][i])};
 const body={schema:'rosevear.yw.outage-notification.v1',providerId:primary.provider_id,companyId,alertId:alert.id,enrollmentId:primary.id,nonce:claim.id,recipientRef:primary.recipient_ref,issueCode:alert.issue_code,sourceSha256,idempotencyKey:companyId+':'+alert.id+':'+primary.id,noCustomerData:true};
 const requestDigest=await digest(body);
 const payload={schema:'rosevear.yw.outage-notification-receipt.v1',providerId:primary.provider_id,companyId,alertId:alert.id,enrollmentId:primary.id,nonce:claim.id,recipientRef:primary.recipient_ref,sourceSha256,requestDigest,receiptId:'fixture-nondelivery-'+i,status:'NOT_DELIVERED',observedAt:claim.claimed_at};
 attempts.push({claim,result:{claim_id:claim.id,state:'DEFINITIVE_FAILURE',provider_receipt_id:payload.receiptId,request_digest:requestDigest,receipt_payload:payload,receipt_signature:await sign(key,'YW599-PROVIDER-RECEIPT',payload),recorded_at:claim.claimed_at}});
}
const args={companyId,alert,primary,attempts,receiptKey:key,now};
assert.equal((await verifyPrimaryNonDelivery(args)).primaryClaimIds.length,3);
await assert.rejects(verifyPrimaryNonDelivery({...args,attempts:attempts.slice(0,2)}),/PRIMARY_NOT_EXHAUSTED/);
for(const state of ['UNKNOWN','VERIFIED_DELIVERY','IN_FLIGHT']){
 const bad=structuredClone(attempts);bad[1].result.state=state;
 await assert.rejects(verifyPrimaryNonDelivery({...args,attempts:bad}),/PRIMARY_NOT_DEFINITIVE/);
}
for(const [field,value] of [['companyId',id(99)],['nonce',id(98)],['recipientRef','wrong-recipient'],['status','DELIVERED'],['requestDigest','a'.repeat(64)]]){
 const bad=structuredClone(attempts);bad[0].result.receipt_payload[field]=value;
 await assert.rejects(verifyPrimaryNonDelivery({...args,attempts:bad}),/PRIMARY_RECEIPT_BINDING/);
}
const bad=structuredClone(attempts);bad[2].result.receipt_signature='f'.repeat(64);
await assert.rejects(verifyPrimaryNonDelivery({...args,attempts:bad}),/PRIMARY_RECEIPT_SIGNATURE/);
assert.deepEqual(await executeFailover({enabled:false}),{state:'FAILOVER_DISABLED_HOLD'});
console.log('YW600 isolated signed-receipt, unknown delivery, exhaustion, cross-tenant binding and disabled gate tests passed. No live evidence.');
