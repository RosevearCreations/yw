#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { GATE_PROFILES } from './release-change-policy.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const resolution = read('js/it-release-resolution-cockpit.js');
const config = read('js/app-config.js');
const worker = read('server-worker.js');
const pkg = JSON.parse(read('package.json'));
const results = [];
const add = (name, ok, detail='') => results.push({ name, ok:!!ok, detail });
const all = (text, values) => values.every((value)=>text.includes(value));

const build246Gates = [...new Set(Object.values(GATE_PROFILES).flat())].sort();

add('build249-chained-on-demand-loader', all(config,[
  'Build 249',
  'loadITReleaseResolutionCockpit',
  '/js/it-release-resolution-cockpit.js?v=2026-09-07a',
  'data-ywi-it-release-resolution-cockpit',
  'script.onload = loadITReleaseResolutionCockpit'
]), 'Build 249 loads only after the existing focused I.T. workspace on the I.T. route.');

add('build249-build246-remains-policy-authority', all(resolution,[
  'Build 246 remains the only release-classification / required-gate policy authority',
  'These keys do NOT decide which gates are required; Build 246 does that',
  'releaseEvidenceChecklistCockpit'
]), 'The guidance catalog explains selected gates but never selects them.');

add('build249-guidance-covers-build246-gate-catalog', build246Gates.every((gate)=>resolution.includes(`'${gate}':`)), `All ${build246Gates.length} Build 246 gate scripts have explicit operator guidance.`);

add('build249-status-aware-resolution', all(resolution,[
  "state === 'proven'",
  "state === 'stale'",
  "state === 'not_applicable'",
  'No corrective action is required',
  'Re-run the canonical Development workflow on the unchanged candidate SHA',
  'freshness window',
  'Treat the gate as unresolved'
]), 'Proven, stale, not-applicable and missing/unknown states produce different safe actions.');

add('build249-missing-workflow-step-fails-closed', all(resolution,[
  "missingDetail.includes('not present')",
  'Restore the canonical workflow step for ${gate}',
  'do not remove the Build 246 requirement',
  'Never infer safety from missing guidance'
]), 'A missing canonical step cannot be resolved by deleting the requirement or inferring safety.');

add('build249-repository-remediation-is-explicit', all(resolution,[
  'RosevearCreations/yw → Settings → Branches',
  'main branch protection rule requiring PRs and canonical status checks',
  'keep force pushes/deletion disabled',
  'rerun the exact-main proof',
  'Do not bypass enforcement'
]), 'Repository guidance points to the external GitHub control instead of claiming an automatic fix.');

add('build249-schema-guidance-preserves-migration-order', all(resolution,[
  'Apply/fix the required schema in Development/staging in canonical migration order',
  'Never patch Production ad hoc',
  'Converge the required schema in Development/staging first',
  'Do not add request-time schema repair'
]), 'Schema guidance keeps migration ordering and Production isolation explicit.');

add('build249-auth-guidance-does-not-weaken-security', all(resolution,[
  'without weakening roles, permissions, account controls, or break-glass requirements',
  'do not weaken Auth policy',
  'without weakening validation, authorization, or role requirements'
]), 'Auth/security remediation cannot relax the security boundary to make a gate pass.');

add('build249-finance-provider-guidance-does-not-enable-risk', all(resolution,[
  'do not enable posting, bypass approvals, or activate a provider',
  'do not enable providers or relax posting safeguards',
  'do not enable posting or a payment provider just to satisfy the test'
]), 'Finance/provider guidance preserves posting and provider safety boundaries.');

add('build249-browser-and-performance-guidance-preserves-tests', all(resolution,[
  'do not skip the test or narrow coverage to manufacture GREEN',
  'do not raise the budget merely to turn the gate GREEN',
  'Budget changes require explicit review'
]), 'Rendered/performance failures must be fixed rather than hidden by weaker tests or budgets.');

add('build249-presentation-only-no-direct-data-authority', !/(YWIAPI|window\.supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(resolution), 'Build 249 has no browser API, Supabase client, GitHub fetch or write authority.');

add('build249-only-reads-existing-checklist-dom', all(resolution,[
  "document.getElementById('releaseEvidenceChecklistCockpit')",
  ".it-system-evidence-list li[data-evidence-status]",
  "row.querySelector('code')",
  "row.getAttribute('data-evidence-status')"
]), 'Build 249 derives guidance from the already-rendered Build 248 checklist only.');

add('build249-observer-bounded-to-existing-source', all(resolution,[
  "document.getElementById('itReadinessWorkspace')",
  'observer.observe(source',
  "document.addEventListener('ywi:route-shown'"
]) && !resolution.includes("observer.observe(document.getElementById('itSystemWorkspace')") && !resolution.includes("observer.observe(document.getElementById('releaseEvidenceChecklistCockpit')"), 'Build 249 observes the established readiness source, never its own rendered guidance subtree.');

add('build249-guidance-never-mutates-evidence-or-authority', all(resolution,[
  'Guidance never changes evidence state or release authority',
  'Fresh exact-SHA evidence and repository authority remain separate requirements',
  'it does not call APIs, mutate GitHub/Supabase',
  'or authorize Production'
]), 'Guidance is explanatory only and cannot change canonical evidence state.');

add('build249-no-core-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-release-resolution-cockpit\.js/), 'Build 249 stays outside the Core service-worker precache.');

add('build249-source-gate-registered', String(pkg.scripts?.['test:runtime'] || '').includes('it-release-resolution-cockpit-check.mjs'), 'The Build 249 source contract is part of canonical runtime checks.');
add('build249-browser-acceptance-registered', String(pkg.scripts?.['test:browser:modules'] || '').includes('it-release-resolution-cockpit.spec.mjs'), 'Rendered Build 249 acceptance is part of the canonical module browser suite.');

const failed = results.filter((row)=>!row.ok);
for (const row of results) console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}${row.detail ? ` - ${row.detail}` : ''}`);
if (failed.length) {
  console.error(`\nBuild 249 release-resolution cockpit gate failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`\nBuild 249 release-resolution cockpit gate passed: ${results.length}/${results.length}`);
