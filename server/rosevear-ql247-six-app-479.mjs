// Build 479: operator-safe six-app readiness reconciliation. No network or credentials.
export const applications = Object.freeze([
  ['ai-data-platform','RosevearCreations/ai-data-platform'],
  ['devilndove','RosevearCreations/devilndove-site'],
  ['rosiedazzlers','RosevearCreations/rosiedazzlers'],
  ['yw','RosevearCreations/yw'],
  ['icamp','RosevearCreations/iCamp'],
  ['rosevear-ai-hub','RosevearCreations/rosevear-ai-hub']
]);
export const evidenceFields = Object.freeze([
  'main_sha','ci_url','issued_tenant','independent_signer_pin','nonproduction_approval',
  'hmac_key_registry','health_receipt','capabilities_receipt','seven_denial_traces',
  'durable_audit','revocation_rollback','independent_reviewer','final_source_proof'
]);
const verified = x => x === 'VERIFIED';
export function reconcile(input) {
  if (!Array.isArray(input) || input.length !== applications.length) throw new Error('QL247_HOLD_APP_SET');
  const seen = new Set();
  const reports = input.map(row => {
    if (!row || typeof row !== 'object' || !applications.some(([id,repo]) => row.id === id && row.repo === repo)
        || seen.has(row.id)) throw new Error('QL247_HOLD_IDENTITY');
    seen.add(row.id);
    if (!row.evidence || typeof row.evidence !== 'object' || Array.isArray(row.evidence)
        || Object.keys(row.evidence).sort().join('|') !== [...evidenceFields].sort().join('|'))
      throw new Error('QL247_HOLD_SCHEMA');
    if (Object.values(row.evidence).some(v => !['VERIFIED','UNVERIFIED','NOT_PROVISIONED','PENDING','BLOCKED'].includes(v)))
      throw new Error('QL247_HOLD_EVIDENCE_VALUE');
    const missing = evidenceFields.filter(k => !verified(row.evidence[k]));
    return {id:row.id,repo:row.repo,missing,readiness:missing.length ? 'HOLD' : 'INDEPENDENT_REVIEW_REQUIRED'};
  });
  return {applications:reports,connection_state:'DISCONNECTED',pilot_authorized:false,
    write_commands_enabled:false,dispatch_enabled:false,
    result:'QL247_NONPRODUCTION_EVIDENCE_REVIEW_HOLD'};
}
export function pendingSnapshot() {
  return applications.map(([id,repo]) => ({id,repo,
    evidence:Object.fromEntries(evidenceFields.map(k => [k,'UNVERIFIED']))}));
}
