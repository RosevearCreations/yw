import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalReceipt, verifyReceipt} from '../supabase/functions/landscape-provider-verify-561/verification.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_provider_validation_561.sql');
const edge=read('supabase/functions/landscape-provider-verify-561/index.ts');
const ui=read('js/landscape-provider-validation-561.js');
const pkg=JSON.parse(read('package.json'));
const must=(s,parts,label)=>parts.forEach(p=>assert.ok(s.includes(p),`YW561 ${label} missing ${p}`));
must(sql,[
 'ywi_landscape_provider_signer_pins_561','ywi_landscape_provider_verified_561',
 'ywi_rpc_landscape_provider_verify_561',"current_user<>'service_role'",
 'public.ywi_landscape_followup_provider_reports_560','public.ywi_landscape_closure_evidence_559',
 "action='customer_followup_requested'",'hashtextextended',
 'unique(issuer,replay_nonce)','561 conflicting nonce replay rejected',
 'ywi_rpc_landscape_reopen_review_561','ywi_landscape_supervisor_acknowledgements_557',
 'v_ack.recorded_at>=v_link.recorded_at','public.ywi_rpc_landscape_closure_review_559',
 'ywi_rpc_landscape_supervision_decide_561','perform public.ywi_422_assert_owner(p_company_id)',
 'ywi_landscape_reopen_links_560','ywi_landscape_reopen_supervision_561',
 'ywi_rpc_landscape_master_summary_561',"'source_role','platform_shell'",
 "'tenant_boundary','platform_shell'", "'master_delivery_accepted',false",
 "'customer_delivery_independently_verified',false",'enable row level security'
],'SQL');
const pinPart=sql.slice(sql.indexOf('create table if not exists public.ywi_landscape_provider_signer_pins_561'),
 sql.indexOf('-- Ed25519 is independently verified'));
assert.ok(!/grant\s+(?:insert|update|delete)\b[^;]*\bto\s+(?:anon|authenticated|service_role)\b/i.test(pinPart),
 'Only separate DB custodian can enroll/rotate source pins');
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_customer_confirmations_556','ywi_landscape_supervisor_acknowledgements_557']){
 assert.ok(!new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${original}\\b`,'i').test(sql),
  `YW561 must not write original ${original}`);
}
must(edge,[
 'YW561_RECEIVER_TOKEN','SUPABASE_SERVICE_ROLE_KEY','verifyReceipt',
 'canonicalReceipt','verify_jwt','ywi_landscape_provider_signer_pins_561',
 "sb.rpc('ywi_rpc_landscape_provider_verify_561'",'provider_signature_verified: true',
 'master_delivery_accepted: false','customer_delivery_independently_verified: false'
].filter(x=>x!=='verify_jwt'),'Receiver');
must(read('supabase/functions/landscape-provider-verify-561/config.toml'),['verify_jwt = false'],'Gateway config');
assert.ok(!edge.includes('Access-Control-Allow-Origin'),'Provider receiver is not a browser API');
must(ui,['owner561ProviderHistory','owner561Supervisor','owner561Master',
 "sb.rpc('ywi_rpc_landscape_reopen_review_561'",
 "sb.rpc('ywi_rpc_landscape_supervision_decide_561'",
 'customer_delivery_independently_verified!==false','master_delivery_accepted!==false',
 "document.addEventListener('ywi:auth-changed'",'READY_OWNER_REVIEW'], 'Owner UI');
assert.ok(!ui.includes('ywi_rpc_landscape_provider_verify_561'),
 'No browser writes to privileged receiver');
must(read('index.html'),['landscape-provider-validation-561.js'],'Index');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-provider-validation-561-check.mjs'],'Existing source lane');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-provider-validation-561.spec.mjs'],'Existing browser lane');

// Real Ed25519 test: generated disposable test-only key is never enrolled.
const key=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const publicBytes=new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const now=Date.UTC(2026,10,11,18,0);
const payload={
 schema:'rosevear.yw.provider-delivery-receipt.v1',issuer:'rosevear-comms-hub',
 audience:'yw-landscape-provider-receiver-561',source_id:'yw',tenant_boundary:'company',
 key_id:'comms-receipt-561',company_id:'22222222-2222-4222-8222-222222222222',
 request_id:'33333333-3333-4333-8333-333333333333',case_version:3,
 followup_intent_id:'44444444-4444-4444-8444-444444444444',
 provider_report_id:'55555555-5555-4555-8555-555555555555',
 provider_message_ref:'comms-opaque-ref-111',provider_receipt_sha256:'a'.repeat(64),
 provider_reported_state:'delivered',provider_reported_at:new Date(now-60_000).toISOString(),
 issued_at:new Date(now).toISOString(),nonce:'66666666-6666-4666-8666-666666666666'
};
const signature=b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key.privateKey,
 new TextEncoder().encode(canonicalReceipt(payload,now)))));
const valid=await verifyReceipt(payload,signature,b64(publicBytes),now);
assert.match(valid.public_key_sha256,/^[0-9a-f]{64}$/);
assert.match(valid.canonical_sha256,/^[0-9a-f]{64}$/);
assert.match(valid.signature_sha256,/^[0-9a-f]{64}$/);
await assert.rejects(verifyReceipt({...payload,provider_reported_state:'failed'},signature,b64(publicBytes),now),
 /signature invalid/);
assert.throws(()=>canonicalReceipt({...payload,company_id:'other'},now),/identity or source/);
assert.throws(()=>canonicalReceipt({...payload,tenant_boundary:'platform_shell'},now),/identity or source/);
assert.throws(()=>canonicalReceipt({...payload,provider_report_id:payload.request_id,unknown:'x'},now),
 /schema mismatch/);
assert.throws(()=>canonicalReceipt(payload,now+900_000),/timestamp/);
const impostor=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
await assert.rejects(verifyReceipt(payload,signature,b64(new Uint8Array(
 await crypto.subtle.exportKey('raw',impostor.publicKey))),now),/signature invalid/);
assert.ok(!/PRIVATE_KEY|BEGIN PRIVATE KEY/.test(sql+edge+ui));
console.log('YW561 Ed25519 authentic/tamper/stale/foreign, protected replay, owner and platform-shell HOLD PASS');
