// Build 488: verify real cryptographic custody evidence without inventing identity,
// source proof, tenant isolation, or permission to connect.
import {createHash, createPublicKey, verify} from 'node:crypto';

export const YW_REPOSITORY = 'RosevearCreations/yw';
export const YW_SOURCE_A = '2c7b07037beb1b0ac239eb1b994cb6a87fd1923e';
export const YW_SOURCE_CI = 'https://github.com/RosevearCreations/yw/actions/runs/40884395920';
export const YW_PRODUCTION_PROJECT = 'jmqvkgiqlimdhcofwkxr';
const HEX_64 = /^[a-f0-9]{64}$/;
const REF = /^[a-z0-9]{20}$/;
const RECEIPT = /^[a-zA-Z0-9._:-]{8,128}$/;
const fail = (condition, reason) => {if (!condition) throw Error('QL256_488_HOLD_' + reason);};

function publicKeyFingerprint(publicKeyPem) {
  fail(typeof publicKeyPem === 'string' && publicKeyPem.length < 10000, 'PUBLIC_KEY');
  let key;
  try {key = createPublicKey(publicKeyPem);} catch {throw Error('QL256_488_HOLD_PUBLIC_KEY');}
  fail(key.asymmetricKeyType === 'ed25519', 'ED25519_REQUIRED');
  return {key, fingerprint: createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex')};
}

// This statement is signed independently by the custodian and the witness.
// The registered pins MUST be delivered through a separately authenticated
// out-of-band channel, never from the same public GitHub document as the claim.
export function custodyStatement(binding, role) {
  return JSON.stringify({
    domain: 'rosevear.integration.ql256.custody.v1', role,
    repository: binding.repository, sourceShaA: binding.sourceShaA,
    sourceCiRunUrl: binding.sourceCiRunUrl,
    projectRef: binding.projectRef, tenantId: binding.tenantId,
    signerSpkiSha256: binding.signerSpkiSha256,
    nonce: binding.nonce, issuedAt: binding.issuedAt,
    expiresAt: binding.expiresAt
  });
}

export function assessNonproductionProject(candidate, observedProjects=[]) {
  if (!candidate || !REF.test(candidate.projectRef || '') ||
      typeof candidate.tenantId !== 'string' || !candidate.tenantId.trim())
    return {status:'CANDIDATE_MISSING',tenant_isolation_verified:false};
  if (candidate.projectRef === YW_PRODUCTION_PROJECT)
    return {status:'PRODUCTION_PROJECT_FORBIDDEN',tenant_isolation_verified:false};
  if (!Array.isArray(observedProjects) || !observedProjects.some(p =>
    p && p.ref === candidate.projectRef && p.status === 'ACTIVE_HEALTHY'))
    return {status:'SEPARATE_PROJECT_NOT_OBSERVED',tenant_isolation_verified:false};
  return {status:'SEPARATE_PROJECT_CANDIDATE_OBSERVED_PRIVATE_TENANT_REVIEW_REQUIRED',
    tenant_isolation_verified:false};
}

function verifyRole(role, roleEvidence, registry, binding) {
  fail(roleEvidence && registry && typeof registry.actorId === 'string' &&
    roleEvidence.actorId === registry.actorId, role.toUpperCase() + '_ACTOR');
  fail(RECEIPT.test(roleEvidence.receiptId || ''), role.toUpperCase() + '_RECEIPT');
  fail(HEX_64.test(registry.spkiSha256 || ''), role.toUpperCase() + '_PIN');
  const {key,fingerprint} = publicKeyFingerprint(roleEvidence.publicKeyPem);
  fail(fingerprint === registry.spkiSha256, role.toUpperCase() + '_PIN_MISMATCH');
  const raw = roleEvidence.signature;
  fail(typeof raw === 'string' && /^[A-Za-z0-9_-]+$/.test(raw), role.toUpperCase() + '_SIGNATURE');
  const signature = Buffer.from(raw, 'base64url');
  fail(signature.length === 64 && signature.toString('base64url') === raw,
    role.toUpperCase() + '_SIGNATURE_ENCODING');
  fail(verify(null, Buffer.from(custodyStatement(binding,role)), key, signature),
    role.toUpperCase() + '_SIGNATURE_MISMATCH');
  return {actorId:registry.actorId,receiptId:roleEvidence.receiptId,
    publicSpkiSha256:fingerprint};
}

export function verifyPinnedCustodyReceipts(evidence, trustedRegistry, now=Date.now()) {
  // A successful result verifies *cryptographic consistency*, not real-world
  // ownership of the private registry or actual independent human identity.
  const b=evidence?.binding;
  fail(b && b.repository===YW_REPOSITORY && b.sourceShaA===YW_SOURCE_A &&
    b.sourceCiRunUrl===YW_SOURCE_CI,'SOURCE_A');
  fail(REF.test(b.projectRef || '') && b.projectRef!==YW_PRODUCTION_PROJECT &&
    typeof b.tenantId==='string' && b.tenantId.trim().length>0,'NONPRODUCTION_SCOPE');
  fail(HEX_64.test(b.signerSpkiSha256 || '') && /^[a-f0-9]{64}$/.test(b.nonce || ''),
    'SIGNER_PIN_OR_NONCE');
  fail(Number.isSafeInteger(b.issuedAt) && Number.isSafeInteger(b.expiresAt) &&
    b.expiresAt>b.issuedAt && b.expiresAt-b.issuedAt<=300000 &&
    Number.isSafeInteger(now) && b.issuedAt<=now && now<b.expiresAt,
    'FIVE_MINUTE_CHALLENGE');
  fail(trustedRegistry && trustedRegistry.signerSpkiSha256===b.signerSpkiSha256,
    'SIGNER_NOT_IN_PRIVATE_REGISTRY');
  const custodian=verifyRole('custodian',evidence.custodian,trustedRegistry.custodian,b);
  const witness=verifyRole('witness',evidence.witness,trustedRegistry.witness,b);
  fail(custodian.actorId!==witness.actorId &&
    custodian.publicSpkiSha256!==witness.publicSpkiSha256 &&
    custodian.receiptId!==witness.receiptId,'SEPARATE_CUSTODY_REQUIRED');
  return {signature_checks:'PINNED_ED25519_SIGNATURES_MATCHED',
    private_registry_origin_independently_authenticated:false,
    human_identities_independently_authenticated:false,
    tenant_isolation_verified:false,proof_B_published:false,
    owner_test_decision:'NOT_GIVEN',connection_state:'DISCONNECTED',
    decision:'PRIVATE_ORIGIN_AND_TENANT_VERIFICATION_REQUIRED'};
}

export function build488ObservedDisposition({projects=[],companyMatches=[],proofHttpStatus=404}={}) {
  const candidate=assessNonproductionProject(null,projects);
  return {
    application:'Yard Workers',source_sha_A:YW_SOURCE_A,source_ci_run_url:YW_SOURCE_CI,
    production_project_ref:YW_PRODUCTION_PROJECT,
    separate_staging_project_verified:false,
    yard_rosevear_in_production:companyMatches.length>0,
    private_custodian_receipt:'NOT_AVAILABLE',private_witness_receipt:'NOT_AVAILABLE',
    signer_status:'SIGNER_STATUS_UNKNOWN',proof_http_status:proofHttpStatus,
    proof_commit_B:'NOT_AVAILABLE',owner_test_decision:'NOT_GIVEN',
    actual_gateway_test:'NOT_RUN',tenant:candidate.status,
    connection_state:'DISCONNECTED',decision:'HOLD'
  };
}
