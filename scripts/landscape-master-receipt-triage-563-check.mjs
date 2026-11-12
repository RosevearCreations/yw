import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {canonicalMasterObservation,verifyMasterObservation} from
 '../supabase/functions/landscape-master-receipt-563/verification.mjs';

const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_master_receipt_triage_563.sql');
const edge=read('supabase/functions/landscape-master-receipt-563/index.ts');
const ui=read('js/landscape-master-receipt-triage-563.js');
const pkg=JSON.parse(read('package.json'));
const must=(s,a,label)=>a.forEach(x=>assert.ok(s.includes(x),'YW563 '+label+' missing '+x));
new vm.Script(ui,{filename:'landscape-master-receipt-triage-563.js'});
must(sql,[
 'ywi_landscape_master_signer_pins_563',
 'ywi_landscape_master_observations_563',
 'ywi_landscape_followup_decisions_563',
 'enable row level security',
 "current_user<>'service_role'",
 'ywi_rpc_landscape_master_observation_admit_563',
 'ywi_rpc_landscape_master_receipt_review_563',
 'ywi_rpc_landscape_followup_decide_563',
 'ywi_rpc_landscape_master_receipt_summary_563',
 'source_decision=\\'approve_for_master_review\\'',
 'p_master_claimed_sha256<>v_source.canonical_sha256',
 "'MATCHED_RECEIPT_CLAIM'",
 "'HASH_MISMATCH'",
 "'MASTER_DISCREPANCY'",
 'unique(issuer,replay_nonce)',
 'unique(issuer,master_receipt_ref)',
 '563 conflicting Master signed nonce replay',
 "v_ack.verified_at>=now()-interval '24 hours'",
 'v_source->>\\'source_pilot_ready\\'=\\'true\\'',
 'p_owner_attested is distinct from true',
 '563 source closure requires fresh matching independent Master claim',
 '563 independently recorded discrepancy required',
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'source_role','platform_shell'",
 "'tenant_boundary','platform_shell'",
], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*ywi_landscape_master_signer_pins_563[^;]*to\s+(?:authenticated|service_role)/i.test(sql));
for(const name of ['ywi_landscape_master_observations_563','ywi_landscape_followup_decisions_563']){
 assert.ok(!new RegExp('grant\\s+(insert|update|delete)[^;]*on\\s+public\\.'+name+'\\s+to\\s+authenticated','i').test(sql),
  'YW563 browser cannot mutate '+name);
}
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_provider_verified_561','ywi_landscape_provider_pilot_decisions_562']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+original+'\\b','i').test(sql),
  'Original source mutation forbidden '+original);
}
must(edge,[
 'YW563_MASTER_RECEIVER_TOKEN','SUPABASE_SERVICE_ROLE_KEY',
 'verifyMasterObservation','ywi_landscape_master_signer_pins_563',
 "sb.rpc('ywi_rpc_landscape_master_observation_admit_563'",
 'master_owner_accepted:false','customer_delivery_verified:false'
], 'Protected Edge');
assert.ok(!edge.includes('Access-Control-Allow-Origin'));
must(read('supabase/config.toml'),[
 '[functions.landscape-master-receipt-563]','verify_jwt = false'], 'Gateway');
must(read('supabase/functions/landscape-master-receipt-563/config.toml'),[
 'verify_jwt = false'],'Receiver');
must(ui,[
 'owner563Company','owner563Case','owner563Receipt',
 'ywi_landscape_provider_verified_561',
 "sb.rpc('ywi_rpc_landscape_master_receipt_review_563'",
 "sb.rpc('ywi_rpc_landscape_followup_decide_563'",
 'master_owner_acceptance===false',
 'source_followup_closure_ready===true',
 'MATCHED_RECEIPT_CLAIM',
 'escalate_receipt_discrepancy',
 "document.addEventListener('ywi:auth-changed'"
], 'Owner UI');
assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!ui.includes('ywi_rpc_landscape_master_observation_admit_563'));
must(read('index.html'),['landscape-master-receipt-triage-563.js'],'Index');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-master-receipt-triage-563-check.mjs'],'Retained source');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-master-receipt-triage-563.spec.mjs'],'Retained browser');

const now=Date.UTC(2026,10,12,8,0);
const payload={
 schema:'rosevear.yw.master-receipt-observation.v1',
 issuer:'ai-data-platform',audience:'yw-landscape-master-observer-563',
 source_id:'yw',source_role:'platform_shell',tenant_boundary:'company',
 key_id:'master-ack-receipt-563',
 company_id:'22222222-2222-4222-8222-222222222222',
 request_id:'33333333-3333-4333-8333-333333333333',case_version:5,
 provider_verified_receipt_id:'44444444-4444-4444-8444-444444444444',
 source_pilot_decision_id:'55555555-5555-4555-8555-555555555555',
 controller_revision:'a'.repeat(40),master_receipt_ref:'controller-ref-111',
 master_claimed_sha256:'b'.repeat(64),observed_state:'acknowledged',
 issued_at:new Date(now).toISOString(),nonce:'66666666-6666-4666-8666-666666666666'
};
const key=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const pub=new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
const b64=a=>btoa(String.fromCharCode(...a));
const signature=b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key.privateKey,
 new TextEncoder().encode(canonicalMasterObservation(payload,now)))));
const verified=await verifyMasterObservation(payload,signature,b64(pub),now);
assert.match(verified.canonical_sha256,/^[0-9a-f]{64}$/);
assert.match(verified.signature_sha256,/^[0-9a-f]{64}$/);
await assert.rejects(verifyMasterObservation({...payload,observed_state:'rejected'},signature,b64(pub),now),/signature invalid/);
assert.throws(()=>canonicalMasterObservation({...payload,tenant_boundary:'platform_shell'},now),/identity or source/);
assert.throws(()=>canonicalMasterObservation({...payload,company_id:'other'},now),/identity or source/);
assert.throws(()=>canonicalMasterObservation({...payload,extra:'bad'},now),/schema mismatch/);
assert.throws(()=>canonicalMasterObservation(payload,now+900_000),/stale/);
const impostor=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
await assert.rejects(verifyMasterObservation(payload,signature,
 b64(new Uint8Array(await crypto.subtle.exportKey('raw',impostor.publicKey))),now),/signature invalid/);
console.log('YW563 independent Ed25519, protected Master hash discrepancy, source-only owner closure and HOLD PASS');
