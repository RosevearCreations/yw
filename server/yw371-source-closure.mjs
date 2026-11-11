// YW371 — source-side reconciliation helper for AI Data Platform Build 370/371.
// This module never reads private signing keys, never self-enrolls trust, and never
// turns repository/deployment GREEN into CONNECTED or owner acceptance.

export const YW371_SCHEMA =
  'rosevear.yw.master370.source-closure-reconciliation.v1';
export const YW371_SOURCE_ID = 'yw';
export const YW371_SOURCE_APP_ID = 'yard-workers';
export const YW371_REPOSITORY = 'RosevearCreations/yw';
export const YW371_SOURCE_ROLE = 'platform_shell';
export const YW371_TENANT_BOUNDARY = 'platform_shell';
export const YW371_CONTROLLER_MAIN =
  '6b3e68672894a4f90ef68fe26ec00bd8adc02aa1';
export const YW371_AI_HUB_MAIN =
  '0a94c72ee4a1ded1babeac68deeb981ad33835ef';
export const YW371_COMMS_MAIN =
  '6cd77dc4f5eb5f6c7a97d3155532a51e8e4c81f6';

const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^(?:sha256:)?[a-f0-9]{64}$/;
const KEY_ID = /^[A-Za-z0-9._:-]{3,160}$/;

const safeString = (value, max = 500) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

export function evaluateYw371SourceClosure(input = {}) {
  const now = Number.isFinite(input.now) ? input.now : Date.now();
  const productionRevision = String(input.productionRevision || '');
  const deployedManifestRevision = String(input.deployedManifestRevision || '');
  const sourceRole = String(input.sourceRole || '');
  const tenantBoundary = String(input.tenantBoundary || '');
  const signer = input.signer && typeof input.signer === 'object' ? input.signer : {};
  const receipt = input.receipt && typeof input.receipt === 'object' ? input.receipt : {};
  const replay = input.replay && typeof input.replay === 'object' ? input.replay : {};
  const masters = input.masters && typeof input.masters === 'object' ? input.masters : {};

  const identityBlockers = [];
  if (!COMMIT.test(productionRevision)) identityBlockers.push('INVALID_PRODUCTION_REVISION');
  if (deployedManifestRevision !== productionRevision)
    identityBlockers.push('DEPLOYED_MANIFEST_REVISION_MISMATCH');
  if (sourceRole !== YW371_SOURCE_ROLE)
    identityBlockers.push('SOURCE_ROLE_NOT_PLATFORM_SHELL');
  if (tenantBoundary !== YW371_TENANT_BOUNDARY)
    identityBlockers.push('TENANT_BOUNDARY_NOT_PLATFORM_SHELL');

  const signerBlockers = [];
  if (!KEY_ID.test(String(signer.keyId || '')))
    signerBlockers.push('SOURCE_SIGNER_KEY_ID_MISSING');
  if (!SHA256.test(String(signer.spkiSha256 || '')))
    signerBlockers.push('SOURCE_SIGNER_SPKI_PIN_MISSING');
  if (signer.controllerEnrollment !== 'ENROLLED')
    signerBlockers.push('CONTROLLER_SIGNER_ENROLLMENT_NOT_VERIFIED');
  if (signer.custodyVerified !== true)
    signerBlockers.push('INDEPENDENT_CUSTODY_NOT_VERIFIED');
  if (signer.witnessVerified !== true)
    signerBlockers.push('INDEPENDENT_WITNESS_NOT_VERIFIED');
  if (!safeString(signer.custodyEvidenceUri))
    signerBlockers.push('CUSTODY_EVIDENCE_URI_MISSING');
  if (!safeString(signer.witnessEvidenceUri))
    signerBlockers.push('WITNESS_EVIDENCE_URI_MISSING');

  const receiptBlockers = [];
  const observedAt = Date.parse(String(receipt.observedAt || ''));
  if (receipt.schema !== 'rosevear.ai-data-platform.source-convergence-receipt.v1')
    receiptBlockers.push('RECEIPT_SCHEMA_MISMATCH');
  if (receipt.sourceId !== YW371_SOURCE_ID)
    receiptBlockers.push('RECEIPT_SOURCE_MISMATCH');
  if (receipt.sourceRevision !== productionRevision ||
      receipt.manifestRevision !== productionRevision)
    receiptBlockers.push('RECEIPT_REVISION_MISMATCH');
  if (receipt.keyId !== signer.keyId)
    receiptBlockers.push('RECEIPT_SIGNER_MISMATCH');
  if (receipt.healthState !== 'HEALTHY')
    receiptBlockers.push('HEALTH_NOT_HEALTHY');
  if (!Number.isFinite(observedAt) || now - observedAt < -5_000 || now - observedAt > 15 * 60_000)
    receiptBlockers.push('HEALTH_OBSERVATION_NOT_CURRENT');
  if (receipt.controllerAdmission !== 'ADMITTED')
    receiptBlockers.push('CONTROLLER_RECEIPT_NOT_ADMITTED');

  const replayBlockers = [];
  if (replay.state !== 'COMMITTED')
    replayBlockers.push('DURABLE_REPLAY_NOT_COMMITTED');
  if (!safeString(replay.evidenceUri))
    replayBlockers.push('DURABLE_REPLAY_EVIDENCE_URI_MISSING');
  if (!SHA256.test(String(replay.digest || '')))
    replayBlockers.push('DURABLE_REPLAY_DIGEST_MISSING');

  const masterBlockers = [];
  if (masters.aiDataMain !== YW371_CONTROLLER_MAIN)
    masterBlockers.push('AI_DATA_CONTROLLER_REVISION_MISMATCH');
  if (masters.aiHubMain !== YW371_AI_HUB_MAIN)
    masterBlockers.push('AI_HUB_REVISION_MISMATCH');
  if (masters.commsMain !== YW371_COMMS_MAIN)
    masterBlockers.push('COMMS_REVISION_MISMATCH');
  if (masters.aiHubRuntime !== 'VERIFIED')
    masterBlockers.push('AI_HUB_RUNTIME_HOLD');
  if (masters.commsRuntime !== 'VERIFIED')
    masterBlockers.push('COMMS_RUNTIME_HOLD');
  if (masters.ownerDecision !== 'ACCEPTED')
    masterBlockers.push('THREE_MASTER_OWNER_DECISION_HOLD');

  const blockers = [
    ...identityBlockers,
    ...signerBlockers,
    ...receiptBlockers,
    ...replayBlockers,
    ...masterBlockers
  ];

  return {
    schema: YW371_SCHEMA,
    sourceId: YW371_SOURCE_ID,
    sourceAppId: YW371_SOURCE_APP_ID,
    repository: YW371_REPOSITORY,
    sourceRole: YW371_SOURCE_ROLE,
    tenantBoundary: YW371_TENANT_BOUNDARY,
    productionRevision,
    identityState: identityBlockers.length === 0 ? 'VERIFIED_EXACT' : 'HOLD',
    signerState: signerBlockers.length === 0 ? 'VERIFIED_CORRELATED' : 'HOLD',
    receiptState: receiptBlockers.length === 0 ? 'VERIFIED_CURRENT' : 'HOLD',
    replayState: replayBlockers.length === 0 ? 'VERIFIED' : 'HOLD',
    threeMasterRuntimeState: masterBlockers.length === 0 ? 'OPEN' : 'HOLD',
    sourceClosureState:
      identityBlockers.length === 0 &&
      signerBlockers.length === 0 &&
      receiptBlockers.length === 0 &&
      replayBlockers.length === 0
        ? 'READY_FOR_CONTROLLER_RECHECK'
        : 'HOLD',
    connection: 'HOLD',
    ownerAccepted: false,
    blockers
  };
}
