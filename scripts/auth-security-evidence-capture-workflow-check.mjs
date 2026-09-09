#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/auth-security-evidence-capture.yml','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const canonical=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');

assert.ok(workflow.includes('workflow_dispatch:'),'Manual capture workflow must expose workflow_dispatch.');
assert.ok(workflow.includes('pull_request:'),'PR contract validation must run without live capture.');
assert.equal(/^\s*push:/m.test(workflow),false,'Auth evidence workflow must not run on push.');
assert.equal(/^\s*schedule:/m.test(workflow),false,'Auth evidence workflow must not run on a schedule.');
assert.ok(workflow.includes('permissions:\n  contents: read'),'Workflow token permissions must remain read-only.');

const contractStart=workflow.indexOf('  contract-check:');
const captureStart=workflow.indexOf('  capture-auth-evidence:');
assert.ok(contractStart>=0 && captureStart>contractStart,'Contract and capture jobs must both exist.');
const contractBlock=workflow.slice(contractStart,captureStart);
const captureBlock=workflow.slice(captureStart);

assert.ok(contractBlock.includes("if: ${{ github.event_name == 'pull_request' }}"),'Contract job must be PR-only.');
assert.ok(contractBlock.includes('node scripts/auth-security-evidence-capture-workflow-check.mjs'),'Contract job must execute this deterministic regression.');
assert.equal(contractBlock.includes('secrets.'),false,'PR contract job must not receive repository secrets.');
assert.equal(contractBlock.includes('auth:evidence:capture-prepare'),false,'PR contract job must not perform live capture.');

assert.ok(captureBlock.includes("if: ${{ github.event_name == 'workflow_dispatch' && inputs.confirm_read_only_capture == 'true' }}"),'Live capture job must require explicit manual confirmation.');
assert.ok(captureBlock.includes('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_AUTH_CONFIG_READ_TOKEN }}'),'Capture must map only the dedicated Auth-config read token.');
assert.ok(captureBlock.includes('YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE: ${{ secrets.YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE }}'),'Encrypted artifact passphrase must come from a secret.');
assert.ok(captureBlock.includes('YWI_AUTH_EVIDENCE_WORKFLOW_REPOSITORY: ${{ github.repository }}'),'Capture must bind evidence to the exact repository supplied by GitHub.');
assert.ok(captureBlock.includes('YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ID: ${{ github.run_id }}'),'Capture must bind evidence to the exact manual workflow run ID.');
assert.ok(captureBlock.includes('YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ATTEMPT: ${{ github.run_attempt }}'),'Capture must bind evidence to the exact workflow run attempt.');
assert.ok(captureBlock.includes('YWI_AUTH_EVIDENCE_WORKFLOW_SHA: ${{ github.sha }}'),'Capture must bind evidence to the exact checked-out commit SHA.');
assert.ok(captureBlock.includes('npm run auth:evidence:capture-prepare >/dev/null'),'Live capture must reuse the existing read-only capture-and-prepare authority without printing security state to logs.');
assert.ok(captureBlock.includes('grep -R -F -- "$SUPABASE_ACCESS_TOKEN"'),'Prepared output must be checked for accidental token persistence.');
assert.ok(captureBlock.includes('openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt'),'Prepared evidence must be encrypted before upload.');
assert.ok(captureBlock.includes('rm -rf "$YWI_AUTH_EVIDENCE_PREP_OUTPUT_DIR"'),'Runner-side plaintext prepared evidence must be removed before upload.');
assert.ok(captureBlock.includes('path: auth-security-evidence-prepared.tgz.enc'),'Artifact upload must contain only the encrypted package.');
assert.ok(captureBlock.indexOf('openssl enc -aes-256-cbc') < captureBlock.indexOf('actions/upload-artifact@v4'),'Encryption must happen before artifact upload.');

for(const forbidden of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'auth:evidence:record',
  'ywi_record_auth_security_evidence',
  'method: PATCH',
  "method:'PATCH'",
  'supabase db',
  'psql ',
  'derived_states:',
]){
  assert.equal(captureBlock.includes(forbidden),false,`Live capture workflow must not contain mutation authority or publish captured security state: ${forbidden}`);
}

for(const forbiddenCanonical of [
  'SUPABASE_AUTH_CONFIG_READ_TOKEN',
  'YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE',
  'YWI_AUTH_EVIDENCE_WORKFLOW_REPOSITORY',
  'YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ID',
  'YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ATTEMPT',
  'YWI_AUTH_EVIDENCE_WORKFLOW_SHA',
  'npm run auth:evidence:capture-prepare',
]){
  assert.equal(canonical.includes(forbiddenCanonical),false,`Canonical source workflow must not receive or execute manual Auth capture provenance: ${forbiddenCanonical}`);
}

for(const required of [
  '## Auth security evidence sanity check',
  'Supabase Management API',
  'auth:evidence:intake',
  'auth:evidence:record',
  'source authenticity',
  'service-role',
]){
  assert.ok(nextSteps.includes(required),`Existing active sanity authority must retain ${required}.`);
}
assert.ok(nextSteps.includes('does not change the external Auth setting'),'Existing active sanity authority must keep recording separate from Auth mutation.');
assert.ok(nextSteps.includes('application source work must not change the Auth setting or auto-close its Current Admin To-Do item'),'Existing active sanity authority must preserve fail-closed external follow-up truth.');
assert.equal(/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(nextSteps),false,'Active sanity authority must not become a build/run/SHA ledger.');

console.log('Auth security evidence manual capture workflow contract gate: PASS.');
