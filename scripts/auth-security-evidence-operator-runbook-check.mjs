#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const capture=fs.readFileSync('.github/workflows/auth-security-evidence-capture.yml','utf8');
const record=fs.readFileSync('.github/workflows/auth-security-evidence-authorized-record.yml','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const canonical=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');

assert.ok(capture.includes('workflow_dispatch:'),'Capture workflow must remain manually dispatchable.');
assert.equal(/^\s*push:/m.test(capture),false,'Live Auth capture must not run on push.');
assert.equal(/^\s*schedule:/m.test(capture),false,'Live Auth capture must not be scheduled.');
assert.equal(capture.includes('SUPABASE_SERVICE_ROLE_KEY'),false,'Read-only capture must remain separated from service-role recording authority.');

assert.ok(record.includes('workflow_dispatch:'),'Authorized recording workflow must remain manually dispatchable.');
assert.equal(/^\s*push:/m.test(record),false,'Authorized Auth evidence recording must not run on push.');
assert.equal(/^\s*schedule:/m.test(record),false,'Authorized Auth evidence recording must not be scheduled.');
assert.ok(record.includes('capture_run_id:'),'Recording workflow must require the exact capture run ID.');
assert.ok(record.includes('capture_run_attempt:'),'Recording workflow must require the exact capture run attempt.');
assert.ok(record.includes('control_key:'),'Recording workflow must select one Auth control.');
assert.ok(record.includes('I_CONFIRM_AUTH_EVIDENCE_RECORD'),'Recording workflow must preserve explicit recording confirmation.');
assert.ok(record.includes('I_CONFIRM_OFFICIAL_SUPABASE_SOURCE'),'Recording workflow must preserve explicit official-source confirmation.');
assert.equal(record.includes('SUPABASE_AUTH_CONFIG_READ_TOKEN'),false,'Recording workflow must remain separated from the capture token.');
assert.equal(capture.includes('auth-security-evidence-authorized-record.yml'),false,'Capture must not automatically chain into recording.');

const requiredAuthority=[
  'YWI Auth security evidence capture',
  '.github/workflows/auth-security-evidence-capture.yml',
  'YWI Auth evidence authorized recording',
  '.github/workflows/auth-security-evidence-authorized-record.yml',
  'capture_run_id',
  'capture_run_attempt',
  'leaked_password_protection',
  'mfa_options',
  'I_CONFIRM_AUTH_EVIDENCE_RECORD',
  'I_CONFIRM_OFFICIAL_SUPABASE_SOURCE',
  'one control per dispatch',
  'I.T. Readiness',
];
for(const value of requiredAuthority)assert.ok(handbook.includes(value),`Handbook must retain Auth evidence operator guidance: ${value}`);
assert.equal(/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(handbook),false,'Handbook must remain current operating authority, not a historical build/run/SHA ledger.');

for(const value of [
  'YWI Auth security evidence capture',
  'YWI Auth evidence authorized recording',
  'capture_run_id',
  'capture_run_attempt',
  'leaked_password_protection',
  'mfa_options',
  'I_CONFIRM_AUTH_EVIDENCE_RECORD',
  'I_CONFIRM_OFFICIAL_SUPABASE_SOURCE',
  'one control per dispatch',
  'I.T. Readiness',
])assert.ok(help.includes(value),`Online Help must retain Auth evidence operator guidance: ${value}`);

assert.equal((help.match(/<h1\b/gi)||[]).length,1,'Online Help must retain exactly one H1.');
assert.ok(/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(help),'Online Help must remain noindex.');
assert.ok(help.includes('does not change Auth settings'),'Online Help must keep evidence recording separate from Auth mutation.');

assert.ok(canonical.includes('node scripts/auth-security-evidence-operator-runbook-check.mjs'),'Canonical source workflow must permanently enforce the Auth evidence operator runbook contract.');

console.log('Auth security evidence operator runbook convergence gate: PASS.');
