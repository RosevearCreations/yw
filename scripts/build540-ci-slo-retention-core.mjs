/** Build 540 — owner-portable read-only CI evidence custody.
 * This SHA-256 checksum is an integrity check, never a source signature or
 * independently verified authority. Historical GitHub artifacts expire.
 */
import { createHash } from 'node:crypto';
import '../js/owner-ci-slo-core-540.js';

const core = globalThis.YWICiSloCore540;
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function createEvidenceArchive(report, rawReport = `${JSON.stringify(report)}\n`) {
  const record = core.fromAudit(report);
  const payload = { schema: core.ARCHIVE, records: core.mergeRecords([], [record]) };
  const archive = {
    ...payload,
    generatedAt: report.observedAt,
    integrity: { algorithm: 'SHA-256', payloadDigest: sha256(JSON.stringify(payload)) },
    authority: 'OWNER_PORTABLE_COPY_NOT_INDEPENDENT_SOURCE_SIGNATURE',
  };
  const receipt = {
    schema: 'ywi.build540.ci-slo-retention-receipt.v1',
    originalActionsRunId: record.runId,
    originalMainSha: record.sha,
    originalAuditFileSha256: sha256(rawReport),
    ownerArchiveFileSha256: sha256(`${JSON.stringify(archive, null, 2)}\n`),
    archivePayloadSha256: archive.integrity.payloadDigest,
    artifactRetentionDays: 30,
    longTermOwnerExportRequired: true,
    independentArchiveCustodyVerified: false,
    independentSourceSignatureVerified: false,
    productionMutation: false,
    protectedGateWaiver: false,
  };
  return { archive, receipt };
}
