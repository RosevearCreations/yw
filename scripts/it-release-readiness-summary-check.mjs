#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('js/it-release-resolution-cockpit.js');
const worker = read('server-worker.js');
const readinessBrowser = read('tests/browser/it-release-readiness-summary.spec.mjs');
const pkg = JSON.parse(read('package.json'));
const marker = 'Build 250 Release Readiness Summary';
const start = source.indexOf(marker);
const build250 = start >= 0 ? source.slice(start) : '';
const results = [];
const add = (name, ok, detail='') => results.push({ name, ok:!!ok, detail });
const all = (text, values) => values.every((value)=>text.includes(value));

add('build250-layer-present', start >= 0 && all(build250,[
  'const BUILD = 250',
  "const SUMMARY_ID = 'releaseReadinessSummary'",
  'window.YWIITReleaseReadinessSummary'
]), 'Build 250 is a bounded presentation layer inside the already-lazy Build 249 I.T. helper.');

add('build250-preserves-existing-authorities', all(build250,[
  'Build 246 remains required-gate policy authority',
  'Build 248 remains exact-SHA evidence authority',
  'Build 249 remains gate-resolution guidance authority',
  'YWIITReleaseResolutionCockpit?.guidanceFor'
]), 'Build 250 summarizes existing policy/evidence/guidance instead of creating a parallel release authority.');

add('build250-bounded-readiness-inputs', all(build250,[
  'window.YWIITReadiness?.getSnapshot?.()',
  'release_policy_primary_class',
  'release_policy_risk_level',
  'release_evidence_checklist_items',
  'branch_protection_reported',
  'repository_enforcement_status',
  'schema_current',
  'open_rail_acceptance_count',
  'current_todo_count'
]), 'The summary consumes only the existing bounded I.T. readiness snapshot plus Build 249 guidance.');

const actionStart = build250.indexOf('function nextSafeAction');
const actionEnd = build250.indexOf('function buildModel');
const actionBody = actionStart >= 0 && actionEnd > actionStart ? build250.slice(actionStart, actionEnd) : '';
const repoPos = actionBody.indexOf('branch_protection_reported !== true');
const schemaPos = actionBody.indexOf('schema_current !== true');
const driftPos = actionBody.indexOf("divergence === 'production_only_drift'");
const policyPos = actionBody.indexOf('!summary.release_policy_available');
const evidencePos = actionBody.indexOf('!summary.release_evidence_checklist_available');
const unresolvedPos = actionBody.indexOf("/missing|stale/.test(evidenceStatus)");
add('build250-fail-closed-priority-order', repoPos >= 0 && schemaPos > repoPos && driftPos > schemaPos && policyPos > driftPos && evidencePos > policyPos && unresolvedPos > evidencePos,
  'Safe-next-action priority is repository enforcement → schema truth → lineage → classification → exact-SHA evidence.');

add('build250-repository-remediation-remains-external', all(actionBody,[
  'Settings → Branches',
  'main branch protection rule',
  'require pull requests and canonical status checks',
  'keep force pushes and deletion disabled',
  'fresh exact-main workflow'
]), 'Unprotected main remains an explicit external GitHub correction, never an automatic mutation.');

add('build250-schema-remediation-preserves-order', all(actionBody,[
  'Development/staging in canonical migration order',
  'Never patch Production ad hoc'
]), 'Schema drift is corrected before dependent release work and never by request-time/Production shortcuts.');

add('build250-reuses-build249-unresolved-guidance', all(build250,[
  'firstUnresolvedEvidence',
  'resolutionForUnresolved',
  'YWIITReleaseResolutionCockpit?.guidanceFor',
  'unresolved.gate',
  'unresolved.action'
]), 'Missing/stale gate correction reuses Build 249 guidance rather than duplicating the gate catalog.');

add('build250-normal-promotion-only-after-proof', all(actionBody,[
  'All Build 246-selected gates have fresh exact-SHA evidence',
  'normal dev → main promotion PR',
  'this summary cannot authorize or perform the promotion'
]), 'Fresh evidence can recommend the normal promotion path but cannot grant Production authority.');

add('build250-operational-followthrough', all(actionBody,[
  'Close the next operational acceptance rail',
  'Resolve the next current Admin To-Do item',
  'Continue the approved roadmap from Development'
]), 'When source is current, the summary advances to operational acceptance/To-Do/roadmap work instead of inventing another release task.');

add('build250-presentation-only-no-direct-authority', !/(fetch\s*\(|window\.supabase|YWIAPI|jsonFetch|manageAdminEntity|\.click\s*\(|\.submit\s*\()/i.test(build250),
  'Build 250 adds no browser API/database/GitHub write, action execution, refresh click or provider authority.');

add('build250-observer-is-source-bounded', all(build250,[
  "document.getElementById('itReadinessWorkspace')",
  'observer.observe(source',
  "document.addEventListener('ywi:route-shown'"
]) && !build250.includes("observer.observe(document.getElementById('itSystemWorkspace')") && !build250.includes("observer.observe(document.getElementById('releaseReadinessSummary')"),
  'Build 250 observes only the established readiness source sibling, never its own rendered summary.');

add('build250-advisory-copy-fail-closed', all(build250,[
  'Advisory summary only',
  'does not execute gates, mutate evidence, change repository settings, apply migrations, enable Finance/provider actions, or authorize Production',
  'Unavailable evidence remains unresolved'
]), 'Rendered copy explicitly preserves fail-closed release authority.');

add('build296-readiness-browser-derives-latest-two-repository-schemas', all(readinessBrowser,[
  "fs.readdirSync(path.join(process.cwd(),'sql'))",
  'const schemaVersions = [...new Set(',
  '.sort((a,b)=>a-b)',
  'const CURRENT_SCHEMA = schemaVersions.at(-1)',
  'const PREVIOUS_SCHEMA = schemaVersions.at(-2)',
  'latest_applied_schema_version:CURRENT_SCHEMA',
  'expected_schema_version:CURRENT_SCHEMA',
  '`${CURRENT_SCHEMA} / ${CURRENT_SCHEMA} current`',
  '`${PREVIOUS_SCHEMA} / ${CURRENT_SCHEMA} review`'
]) && !readinessBrowser.includes('const PREVIOUS_SCHEMA = CURRENT_SCHEMA - 1'),
  'Release-readiness browser evidence derives both the current and actual prior migration from repository schema authority without assuming contiguous migration numbers.');

add('build299-readiness-browser-supports-variable-width-migration-filenames', all(readinessBrowser,[
  'function migrationVersionFromFilename(name)',
  "const match = String(name || '').match(",
  'return match ? Number(match[1]) : NaN;',
  '.map(migrationVersionFromFilename)',
  "migrationVersionFromFilename('999_example.sql')",
  "migrationVersionFromFilename('1000_example.sql')",
  "migrationVersionFromFilename('12034_example.sql')",
  'toBe(1000)',
  'toBe(12034)'
]) && !readinessBrowser.includes('/^\\d{3}_.+\\.sql$/i') && !readinessBrowser.includes('slice(0,3)'),
  'Release-readiness browser evidence accepts variable-width numbered SQL migrations, explicitly covers Schema 1000+, and rejects the previous three-digit parser.');

add('build296-readiness-browser-has-no-numeric-current-schema-fixture',
  !/expected_schema_version\s*:\s*\d+/.test(readinessBrowser) &&
  !/latest_applied_schema_version\s*:\s*\d+/.test(readinessBrowser) &&
  !/\b207\s*\/\s*207\s+current\b/.test(readinessBrowser),
  'A new schema migration cannot leave the current-schema release-readiness fixture silently pinned to an older literal.');

add('build250-no-core-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-release-resolution-cockpit\.js/),
  'The combined Build 249/250 I.T. helper remains outside the Core service-worker precache.');

add('build250-source-gate-registered', String(pkg.scripts?.['test:runtime'] || '').includes('it-release-readiness-summary-check.mjs'),
  'The Build 250 source contract is part of canonical runtime checks.');
add('build250-browser-acceptance-registered', String(pkg.scripts?.['test:browser:modules'] || '').includes('it-release-readiness-summary.spec.mjs'),
  'Rendered Build 250 acceptance is part of the canonical module-browser suite.');

const failed = results.filter((row)=>!row.ok);
for (const row of results) console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}${row.detail ? ` - ${row.detail}` : ''}`);
if (failed.length) {
  console.error(`\nBuild 250 release-readiness summary gate failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`\nBuild 250 release-readiness summary gate passed: ${results.length}/${results.length}`);
