#!/usr/bin/env node
/** Build 212: make release-readiness evidence review a mandatory, non-promoting release authority. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

// Exercise the existing Schema 154 source contract rather than replacing its audit history.
execFileSync(process.execPath, ['scripts/release-readiness-dashboard-check.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env },
  stdio: 'inherit'
});

const workflow = read('.github/workflows/staging-browser-integration.yml');
const legacy = read('scripts/release-readiness-dashboard-check.mjs');
const sql154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const cockpit = read('js/operations-cockpit.js');
const schemaVersions = fs.readdirSync('sql')
  .map((name) => Number(name.match(/^(\d+)_/)?.[1] || 0))
  .filter(Boolean);
const latestRepositorySchema = Math.max(...schemaVersions);

const captureBlock = operations.match(/if \(action === 'release_readiness_capture'\) \{([\s\S]*?)\n\s*if \(action ===/i)?.[1] || '';

add('historical-release-dashboard-contract-exercised', hasAll(legacy, [
  'dashboard-view', 'evidence-snapshot-table', 'evidence-only-confirmation',
  'protected-snapshot-rpc', 'cockpit-dashboard-ui', 'dashboard-mobile-css'
]), 'The existing Schema 154 audit contract remains the underlying source authority.');
add('snapshot-is-explicit-review-only', hasAll(sql154, [
  'REVIEW ONLY', 'No production release was performed', 'does not make or apply a production release'
]), 'Snapshot capture is explicitly evidence review, not a release action.');
add('snapshot-record-is-private-and-role-protected', hasAll(sql154, [
  'release_readiness_review_snapshots', 'ywi_rpc_capture_release_readiness_snapshot',
  'Only a job admin or higher', 'release_snapshot_rpc_not_public'
]), 'Release evidence remains private and job-admin protected.');
add('server-capture-delegates-only-to-snapshot-rpc', hasAll(captureBlock, [
  'requireRank(profile, 45, action)', "callRpc(supabase, 'ywi_rpc_capture_release_readiness_snapshot'"
]) && !/(public_route_publish|publishApprovedAsset|stripe|provider_mutation|execution_enabled|deploy)/i.test(captureBlock),
'Release-readiness capture cannot publish content, mutate providers, enable Finance execution, or deploy.');
add('cockpit-requires-explicit-review-phrase', hasAll(cockpit, [
  'oc_release_snapshot_form', 'placeholder="Type REVIEW ONLY"',
  '<option value="staging">Staging evidence</option>',
  '<option value="production_candidate">Production-candidate review</option>'
]), 'The operator must deliberately choose review scope and type the review-only confirmation.');
add('cockpit-labels-capture-as-evidence-only', hasAll(cockpit, [
  'Capture evidence snapshot',
  'This records evidence only. It cannot deploy code, publish routes, or change payment status.'
]), 'Rendered operator copy does not present snapshot capture as Production promotion.');
add('release-dashboard-remains-responsive', hasAll(read('style.css'), [
  '.operations-cockpit .oc-release-dashboard',
  '.operations-cockpit .oc-release-gates',
  '@media(max-width:620px){.operations-cockpit .oc-release-dashboard'
]), 'Release review remains usable on phone and computer layouts.');
add('current-schema-authority-remains-separate', latestRepositorySchema >= 201,
  `Repository schema history reaches ${latestRepositorySchema}; Schema 154 remains feature history rather than current release identity.`);
add('build212-source-gate-is-mandatory', workflow.includes('node scripts/release-readiness-evidence-enforcement-check.mjs'),
  'Build 212 source authority runs on every release PR.');
add('build212-browser-gate-is-mandatory', workflow.includes('tests/browser/release-readiness-evidence.spec.mjs'),
  'Build 212 rendered review-only acceptance runs on every release PR.');
add('three-surface-regression-remains-mandatory', hasAll(workflow, [
  'npm run test:three-surface', 'npm run test:browser:three-surface'
]), 'Mobile application, computer application and public website regression remain mandatory alongside Build 212.');
add('staging-proof-remains-manual-only', workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.run_staging == 'true'"),
  'Making release-readiness evidence mandatory does not enable live staging mutation.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Build 212 release-readiness evidence authority passed (${checks.length}/${checks.length}).`);
