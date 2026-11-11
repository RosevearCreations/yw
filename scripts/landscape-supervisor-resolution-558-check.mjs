import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {sourcePayload,signSourcePayload,verifySourcePacket} from '../server/master363-yw-source-converge-558.mjs';
import {BUILD364_SCHEMA,build364Payload,canonicalBuild364Payload,signBuild364Receipt,
 verifyBuild364Receipt} from '../server/master363-yw-build364-receipt.mjs';
const read=path=>fs.readFileSync(path,'utf8');
const sql=read('sql/landscape_supervisor_resolution_558.sql');
const ui=read('js/landscape-supervisor-resolution-558.js');
const pkg=JSON.parse(read('package.json'));
const must=(s,keys,tag)=>keys.forEach(k=>assert.ok(s.includes(k),`${tag}: missing ${k}`));
must(sql,['ywi_landscape_resolution_events_558','enable row level security',
 'revoke all on public.ywi_landscape_resolution_events_558',
 'perform public.ywi_422_assert_owner(p_company_id)',
 'perform public.ywi_422_assert_jobs_create()',
 'ywi_rpc_landscape_resolution_558','ywi_rpc_landscape_audit_timeline_558',
 'pg_advisory_xact_lock','p_expected_case_version','p_expected_dispatch_signature',
 'ywi_landscape_dispatch_signature_557','ywi_landscape_supervisor_acknowledgements_557',
 'ywi_landscape_customer_confirmations_556','ywi_landscape_replacement_proof_556',
 'ywi_rpc_landscape_recovery_review_557',
 "v_review->>'status'<>'ACKNOWLEDGED_REVIEW_ONLY'",
 'idempotency key reused with different action','reconfirmation_requested',
 'escalation_reviewed',"'dispatch_authorized',false",
 "'customer_confirmed',false", "'master_shell_connection_proven',false"],'SQL');
for(const original of ['work_orders','jobs','dispatch_schedule_items','crew_members',
 'ywi_landscape_recovery_cases_556','ywi_landscape_customer_confirmations_556',
 'ywi_landscape_supervisor_acknowledgements_557'])
 assert.ok(!new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${original}\\b`,'i').test(sql),
  `YW558 cannot mutate original ${original}`);
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_resolution_events_558\s+to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon\b/i.test(sql));
must(ui,['owner558Company','owner558Case','owner558Refresh','owner558Timeline',
 'owner558Customer','owner558Record','owner558Attest',
 "sb.rpc('ywi_rpc_landscape_audit_timeline_558'",
 "sb.rpc('ywi_rpc_landscape_resolution_558'",
 'current.data?.user?.id!==auth.user.id','owner_user_id!==id',
 'company_scope_only!==true','dispatch_authorized!==false',
 'customer_confirmation_authorized!==false','document.addEventListener(\'ywi:auth-changed\'',
 'HOLD'],'UI');
assert.ok(!/\.from\(['"](?:dispatch_schedule_items|ywi_landscape_resolution_events_558)['"]\)\s*\.(?:insert|update|delete|upsert)/i.test(ui));
must(read('index.html'),['landscape-supervisor-resolution-558.js'],'Index');
must(read('.github/workflows/staging-browser-integration.yml'),[
 'npm run test:landscape-supervisor-resolution-558',
 'npm run test:browser:landscape-supervisor-resolution-558'],'CI');
const release=read('scripts/release-job-separation-check.mjs');
must(release,['221 browser suites','111 direct lane calls',
 "lanes.includes('npm run test:browser:landscape-supervisor-resolution-558')"],'Release');
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558']&&
 pkg.scripts['test:browser:landscape-supervisor-resolution-558']);
// Offline, synthetic Ed25519 source receipt contract. This is NOT enrollment.
const keys=generateKeyPairSync('ed25519');
const passphrase='synthetic test passphrase for Ed25519';
const pem=keys.privateKey.export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase});
const pin=createHash('sha256').update(keys.publicKey.export({type:'spki',format:'der'})).digest('hex');
const sourceRevision='a'.repeat(40),manifestSha256='b'.repeat(64),now=1790000000000;
const payload=sourcePayload({sourceRevision,manifestSha256,nonce:'c'.repeat(64),now});
const packet=signSourcePayload({payload,encryptedPrivateKeyPem:pem,passphrase,expectedPublicPin:pin});
assert.equal(verifySourcePacket(packet,{trustedPublicPin:pin,sourceRevision,manifestSha256,now}).connection,'HOLD');
for(const tamper of [
 {payload:{...payload,sourceRevision:'d'.repeat(40)}},
 {payload:{...payload,ownerAccepted:true}},
 {signature:'a'.repeat(86)},
 {sourcePublicSpkiSha256:'e'.repeat(64)}
])assert.throws(()=>verifySourcePacket({...packet,...tamper},{trustedPublicPin:pin,sourceRevision,manifestSha256,now}),/MASTER363_YW_HOLD_/);
assert.throws(()=>verifySourcePacket(packet,{trustedPublicPin:pin,sourceRevision,manifestSha256,now:now+120000}),/MASTER363_YW_HOLD_RECEIPT_FRESHNESS/);
assert.throws(()=>signSourcePayload({payload,encryptedPrivateKeyPem:pem,passphrase,
 expectedPublicPin:'f'.repeat(64)}),/MASTER363_YW_HOLD_SOURCE_PIN_MISMATCH/);
// Controller Build364 exact schema/JSON ordering/standard base64. Synthetic test keys
// explicitly prove only codec compatibility; they are never enrolled on a live host.
const health={state:'HEALTHY',revision:sourceRevision,
 observedAt:new Date(now-30000).toISOString(),sourceRuntime:'yw-test-fixture-runtime-only'};
const b364Payload=build364Payload({sourceRevision,keyId:'synthetic-test-key-123',
 health,nonce:'c'.repeat(64),now});
assert.equal(b364Payload.schema,BUILD364_SCHEMA);
assert.equal(canonicalBuild364Payload(b364Payload),JSON.stringify({
 schema:BUILD364_SCHEMA,receiptVersion:1,handoffToken:'MASTER363-YW-SOURCE-CONVERGE',
 sourceId:'yw',sourceAppId:'yard-workers',repository:'RosevearCreations/yw',
 sourceRevision,manifestRevision:sourceRevision,keyId:'synthetic-test-key-123',
 issuedAt:new Date(now).toISOString(),nonce:'c'.repeat(64),health}));
const b364Receipt=signBuild364Receipt({payload:b364Payload,encryptedPrivateKeyPem:pem,
 passphrase,expectedPublicPin:pin});
const publicKeyPem=keys.publicKey.export({type:'spki',format:'pem'});
assert.equal(verifyBuild364Receipt(b364Receipt,{trustedKeyId:'synthetic-test-key-123',
 trustedPublicKeyPem:publicKeyPem,sourceRevision,now}).connection,'HOLD');
for(const changed of [{sourceRevision:'f'.repeat(40)},
 {manifestRevision:'f'.repeat(40)},
 {health:{...health,sourceRuntime:'altered-runtime'}},
 {signatureBase64:'A'.repeat(86)+'=='}]){
 assert.throws(()=>verifyBuild364Receipt({...b364Receipt,...changed},
  {trustedKeyId:'synthetic-test-key-123',trustedPublicKeyPem:publicKeyPem,sourceRevision,now}),
 /MASTER363_YW_HOLD_/);
}
assert.throws(()=>verifyBuild364Receipt(b364Receipt,{trustedKeyId:'wrong-key',
 trustedPublicKeyPem:publicKeyPem,sourceRevision,now}),/MASTER363_YW_HOLD_INDEPENDENT_SIGNER_ENROLLMENT/);
assert.throws(()=>verifyBuild364Receipt(b364Receipt,{trustedKeyId:'synthetic-test-key-123',
 trustedPublicKeyPem:publicKeyPem,sourceRevision,now:now+16*60*1000}),
 /MASTER363_YW_HOLD_RECEIPT_FRESHNESS/);
assert.throws(()=>build364Payload({sourceRevision,keyId:'synthetic-test-key-123',
 health:{...health,state:'UNKNOWN'},nonce:'c'.repeat(64),now}),
 /MASTER363_YW_HOLD_REAL_HEALTH_OBSERVATION_REQUIRED/);
assert.throws(()=>build364Payload({sourceRevision,keyId:'synthetic-test-key-123',
 health:{...health,sourceRuntime:'mock-service'},nonce:'c'.repeat(64),now}),
 /MASTER363_YW_HOLD_RUNTIME_IDENTITY_REQUIRED/);
const manifest=JSON.parse(read('public/.well-known/rosevear-integration-manifest.json'));
assert.equal(manifest.source_id,'yw');assert.equal(manifest.tenant_boundary,'platform_shell');
assert.equal(manifest.source_revision_binding.production,'build_time_vercel_git_commit_sha');
const build=read('scripts/build-vercel-site.mjs');
must(build,['VERCEL_GIT_COMMIT_SHA','VERCEL_GIT_COMMIT_REF','isProductionMain',
 'releaseSha','HOLD_UNVERIFIED_SOURCE_REVISION','source_revision_state'],'Vercel build');
assert.equal(manifest.signature.state,'AWAITING_INDEPENDENT_SOURCE_SIGNER');
assert.equal(manifest.connection_state,'DISCONNECTED / HOLD');
assert.ok(pkg.scripts['test:master363-yw-source-converge-558']);
console.log('YW558 owner resolution, source-bound customer reconfirmation, timeline, Build364 receipt compatibility and tenant isolation PASS');
