/** Build 541 — an original-main Actions audit-consistency checkpoint.
 * The CI runner cannot assert second-site owner custody or independently
 * authenticate its own issuer; both remain explicitly unverified. */
import { webcrypto } from 'node:crypto';
import '../js/owner-ci-slo-core-540.js';
import '../js/owner-ci-custody-core-541.js';

if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const core=globalThis.YWICiCustodyCore541;

export async function createCheckpoint(auditRaw,archiveRaw,receiptRaw){
  const verified=await core.verifyBundle({auditRaw,archiveRaw,receiptRaw});
  const audit=JSON.parse(auditRaw),base=verified.original;
  const checkedAt=String(audit.observedAt);
  if(!Number.isFinite(Date.parse(checkedAt)))throw Error('Missing original Actions audit observation time.');
  const checkpoint={schema:core.CHECKPOINT,state:'SECOND_COPY_READBACK_REQUIRED',
    originalActionsRunId:base.runId,originalMainSha:base.sha,
    originalAuditFileSha256:base.auditDigest,
    ownerArchiveFileSha256:base.archiveDigest,
    originalRetentionReceiptSha256:base.receiptDigest,
    archivePayloadSha256:base.payloadDigest,
    auditObservedAt:checkedAt,
    estimatedArtifactExpiryAt:new Date(Date.parse(checkedAt)+30*86400000).toISOString(),
    githubActionsArtifactRetentionDays:30,
    secondOwnerCopyReadbackVerified:false,independentArchiveCustodyVerified:false,
    independentSourceSignatureVerified:false,
    ownerRenewalApproved:false,customerCommunications:false,deviceActions:false,
    productionMutation:false,protectedGateWaiver:false,
    caution:'Time is an estimate from the audit observation. GitHub artifact metadata is authoritative for actual expiration. Keep separately verified owner copies; no external signer or custodian is automatically enrolled.'};
  await core.verifyBundle({auditRaw,archiveRaw,receiptRaw,
    checkpointRaw:JSON.stringify(checkpoint)});
  return checkpoint;
}
