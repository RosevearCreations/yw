import assert from 'node:assert/strict';
import {canonical} from '../supabase/functions/_shared/yw599-independent-recovery.mjs';
import {assessEvidence} from '../supabase/functions/_shared/yw601-predictive-assurance.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),now=Date.parse('2026-11-27T15:00:00Z'),iso=t=>new Date(t).toISOString();
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const hmac=async (key,msg)=>hex(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(msg)));
const keys={old:'fixture-only-old-key-0000000000000000',next:'fixture-only-next-key-000000000000000',local:'fixture-only-local-key-00000000000000'};
const enrollment={id:id(1),company_id:id(2),owner_user_id:id(3),started_at:iso(now-86400000),expires_at:iso(now+86400000),sample_period_minutes:15,passive_monitor_only:true};
const contractIds={old:id(4),next:id(5)};
async function row(n,age){
 const s={id:id(100+n),company_id:enrollment.company_id,enrollment_id:enrollment.id,source_actor_id:enrollment.owner_user_id,challenge_nonce:id(200+n),verified_at:iso(now-age*60000),receiver_state:'SIGNED_OLD_AND_NEXT_MATCH',actual_key_changed:false};
 const common=[enrollment.id,enrollment.company_id,s.challenge_nonce,contractIds.old,contractIds.next,'YW592-ACK'].join('|');
 s.receiver_response_sha256=await sha(canonical({schema:'rosevear.yw.receiver-health-probe-ack.v1',companyId:enrollment.company_id,enrollmentId:enrollment.id,requestNonce:s.challenge_nonce,priorContractId:contractIds.old,candidateContractId:contractIds.next,acceptedAckSchema:'YW592-ACK',noKeyChange:true}));
 const msg=canonical({schema:'rosevear.yw.signed-master-health-sample.v1',companyId:enrollment.company_id,enrollmentId:enrollment.id,ownerId:enrollment.owner_user_id,nonce:s.challenge_nonce,observedAt:s.verified_at,remoteResponseSha256:s.receiver_response_sha256,state:s.receiver_state,actualSecretChanged:false,noAutomaticKeyAction:true});
 s.local_event_sha256=await sha(msg);s.local_event_hmac=await hmac(keys.local,msg);s.prior_hmac=await hmac(keys.old,'YW597-HEALTH-OLD|'+common);s.next_hmac=await hmac(keys.next,'YW597-HEALTH-NEXT|'+common);return s;
}
const assess=(rows,other={})=>assessEvidence({enrollment,rows,contractIds,keys,now,...other});
assert.equal((await assess([])).state,'UNKNOWN_NO_SIGNED_SAMPLES');
assert.equal((await assess([], {enrollment:null})).state,'UNKNOWN_NO_ACTIVE_WATCH');
assert.equal((await assess([await row(1,2)])).state,'UNKNOWN_INSUFFICIENT_HISTORY');
assert.equal((await assess([await row(1,20)])).state,'RISK_FRESHNESS_DEGRADING');
assert.equal((await assess([await row(1,30)])).state,'STALE_SIGNED_EVIDENCE');
const recent=await Promise.all([50,35,20,5].map((age,i)=>row(i,age)));
assert.equal((await assess(recent)).state,'RECENT_SIGNED_OBSERVATIONS');
const trend=await Promise.all([62,52,32,2].map((age,i)=>row(i,age)));
assert.equal((await assess(trend)).state,'RISK_WIDENING_OBSERVATION_GAPS');
for(const patch of [{company_id:id(999)},{prior_hmac:'f'.repeat(64)},{next_hmac:'f'.repeat(64)},{local_event_hmac:'f'.repeat(64)},{verified_at:iso(now+60000)},{actual_key_changed:true}]){
 assert.equal((await assess([{...recent[0],...patch}])).state,'UNKNOWN_EVIDENCE_VERIFICATION_FAILED');
}
assert.equal((await assess([recent[0],recent[0]])).state,'UNKNOWN_EVIDENCE_VERIFICATION_FAILED');
assert.equal((await assess(Array(97).fill(recent[0]))).state,'UNKNOWN_UNBOUNDED_INPUT');
for(const r of [await assess(recent),await assess(trend),await assess([])]){assert.equal(r.outageConfirmed,false);assert.equal(r.recoveryConfirmed,false);assert.equal(r.automaticRecoveryPerformed,false);assert.equal(r.automaticNotificationSent,false);}
console.log('YW601 synthetic signature, time, tenant, replay, sample limit and risk classification tests passed; no live evidence or recovery claim.');
