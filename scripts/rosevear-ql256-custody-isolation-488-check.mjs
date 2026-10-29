import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,createHash,sign} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {assessNonproductionProject,custodyStatement,verifyPinnedCustodyReceipts,
  build488ObservedDisposition,YW_REPOSITORY,YW_SOURCE_A,YW_SOURCE_CI,YW_PRODUCTION_PROJECT}
 from '../server/rosevear-ql256-custody-isolation-488.mjs';

assert.equal(assessNonproductionProject(null).status,'CANDIDATE_MISSING');
assert.equal(assessNonproductionProject({projectRef:YW_PRODUCTION_PROJECT,tenantId:'x'}).status,
 'PRODUCTION_PROJECT_FORBIDDEN');
const npRef='abcdefghijklmnopqrst';
const candidate={projectRef:npRef,tenantId:'synthetic-nonproduction-company'};
assert.equal(assessNonproductionProject(candidate,[]).status,'SEPARATE_PROJECT_NOT_OBSERVED');
assert.equal(assessNonproductionProject(candidate,[{ref:npRef,status:'ACTIVE_HEALTHY'}])
 .tenant_isolation_verified,false);

// Synthetic keys here are ONLY security fixtures. They never become source
// proof, real custody identity, tenant evidence or owner authorization.
const custodian=generateKeyPairSync('ed25519'),witness=generateKeyPairSync('ed25519');
const fingerprint=key=>createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
const now=Date.UTC(2026,9,29,15);
const binding={repository:YW_REPOSITORY,sourceShaA:YW_SOURCE_A,sourceCiRunUrl:YW_SOURCE_CI,
 projectRef:npRef,tenantId:candidate.tenantId,
 signerSpkiSha256:'d'.repeat(64),nonce:randomBytes(32).toString('hex'),
 issuedAt:now-1000,expiresAt:now+120000};
const register={signerSpkiSha256:binding.signerSpkiSha256,
 custodian:{actorId:'synthetic-custodian',spkiSha256:fingerprint(custodian.publicKey)},
 witness:{actorId:'synthetic-witness',spkiSha256:fingerprint(witness.publicKey)}};
const receipt=(key,role,actorId,receiptId)=>({actorId,receiptId,
 publicKeyPem:key.publicKey.export({format:'pem',type:'spki'}),
 signature:sign(null,Buffer.from(custodyStatement(binding,role)),key.privateKey).toString('base64url')});
const packet={binding,
 custodian:receipt(custodian,'custodian','synthetic-custodian','TEST-CUSTODY-001'),
 witness:receipt(witness,'witness','synthetic-witness','TEST-WITNESS-001')};
const verified=verifyPinnedCustodyReceipts(packet,register,now);
assert.equal(verified.signature_checks,'PINNED_ED25519_SIGNATURES_MATCHED');
assert.equal(verified.human_identities_independently_authenticated,false);
assert.equal(verified.tenant_isolation_verified,false);
assert.equal(verified.connection_state,'DISCONNECTED');
assert.throws(()=>verifyPinnedCustodyReceipts(packet,register,now+400000),/FIVE_MINUTE_CHALLENGE/);
assert.throws(()=>verifyPinnedCustodyReceipts({...packet,binding:{...binding,tenantId:'tampered'}},register,now),/SIGNATURE_MISMATCH/);
assert.throws(()=>verifyPinnedCustodyReceipts(packet,{...register,custodian:{...register.custodian,spkiSha256:'f'.repeat(64)}},now),/PIN_MISMATCH/);
assert.throws(()=>verifyPinnedCustodyReceipts({...packet,witness:{...packet.witness,receiptId:packet.custodian.receiptId}},register,now),/SEPARATE_CUSTODY_REQUIRED/);
assert.throws(()=>verifyPinnedCustodyReceipts({...packet,binding:{...binding,projectRef:YW_PRODUCTION_PROJECT}},register,now),/NONPRODUCTION_SCOPE/);
const report=build488ObservedDisposition({projects:[{ref:YW_PRODUCTION_PROJECT,status:'ACTIVE_HEALTHY'}],companyMatches:[]});
assert.equal(report.separate_staging_project_verified,false);
assert.equal(report.yard_rosevear_in_production,false);
assert.equal(report.proof_http_status,404);
assert.equal(report.decision,'HOLD');
assert.equal(existsSync('docs/integration/ql246-source-proof.json'),false);
const operatorSource=readFileSync('scripts/rosevear-ql256-verify-private-custody-488.mjs','utf8');
assert.ok(operatorSource.includes('REQUIRES_PRIVATE_CUSTODY_PACKET_AND_SEPARATE_REGISTRY'));
assert.ok(operatorSource.includes('REPOSITORY_PATH_FORBIDDEN'));
const handoff=readFileSync('docs/integration/ql256-build488-REAL-STATUS.txt','utf8');
for(const v of ['SOURCE A','SIGNER_STATUS_UNKNOWN','NO VERIFIED NONPRODUCTION TENANT','HTTP 404','NOT_GIVEN'])
 assert.ok(handoff.includes(v),v);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(pkg.scripts['test:rosevear-ql256-custody-isolation-488']);
assert.ok(readFileSync('.github/workflows/staging-browser-integration.yml','utf8').includes('npm run test:rosevear-ql256-custody-isolation-488'));
console.log('Build 488 private custody cryptographic negative gates and tenant verification PASS (integration HOLD)');
