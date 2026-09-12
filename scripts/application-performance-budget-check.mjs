import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const serviceWorker = read('server-worker.js');
const runtime = read('js/module-runtime.js');
const runtimeEndpoint = read('supabase/functions/admin-it-readiness-runtime/index.ts');
const itUi = read('js/it-readiness-ui.js');
const today = read('js/mobile-today.js');
const organizer = read('js/workspace-organization.js');
const financeMapping = read('js/finance-account-mapping-ui.js');
const performanceBrowser = read('tests/browser/application-performance-budget.spec.mjs');
const help = read('help.html');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/staging-browser-integration.yml');

const limits = Object.freeze({
  shellAssets: 30,
  shellJs: 21,
  moduleScripts: Object.freeze({ safety: 10, finance: 3, jobs: 4, admin: 8 }),
  itRuntimeReads: 10,
  mobileRefreshMinMs: 30000,
});

const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

function quotedPaths(source) {
  return [...source.matchAll(/['"](\/[^'"]+)['"]/g)].map((match) => match[1]);
}

const shellBody = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\n\];/)?.[1] || '';
const shellAssets = quotedPaths(shellBody);
const shellJs = shellAssets.filter((path) => /\.js(?:\?|$)/.test(path));

function moduleScripts(key) {
  const match = runtime.match(new RegExp(`${key}: Object\\.freeze\\(\\{[\\s\\S]*?scripts: Object\\.freeze\\((\\[[\\s\\S]*?\\])\\)`, 'm'));
  return match ? quotedPaths(match[1]).filter((path) => path.endsWith('.js')) : [];
}

const manifests = Object.fromEntries(Object.keys(limits.moduleScripts).map((key) => [key, moduleScripts(key)]));
const businessScripts = new Set(Object.values(manifests).flat());
const itReadBlock = runtimeEndpoint.match(/const sources = await Promise\.all\(\[([\s\S]*?)\n\s*\]\);/)?.[1] || '';
const itReadCount = (itReadBlock.match(/listRows\(/g) || []).length;
const todayIntervals = [...today.matchAll(/setInterval\([^,]+,\s*(\d+)\s*\)/g)].map((match) => Number(match[1]));

add('core-shell-asset-budget', shellAssets.length <= limits.shellAssets, `${shellAssets.length}/${limits.shellAssets} assets`);
add('core-shell-js-budget', shellJs.length <= limits.shellJs, `${shellJs.length}/${limits.shellJs} JavaScript assets`);
add('business-modules-not-precached', [...businessScripts].every((script) => !shellAssets.includes(script)), 'Business module JavaScript must remain permission-driven.');
for (const [key, max] of Object.entries(limits.moduleScripts)) {
  add(`${key}-module-script-budget`, manifests[key].length > 0 && manifests[key].length <= max, `${manifests[key].length}/${max} scripts`);
}
add('it-runtime-read-budget', itReadCount > 0 && itReadCount <= limits.itRuntimeReads, `${itReadCount}/${limits.itRuntimeReads} bounded source reads`);
add('it-deep-graphs-stay-deferred', /deep_verification_deferred:\s*true/.test(runtimeEndpoint) && /deferredKeys = \[[\s\S]*finance_release_hardening[\s\S]*production_readiness/.test(runtimeEndpoint));
add('today-render-has-no-api-read', !/YWIAPI\?\.|jsonFetch\s*\(/.test(today), 'Today orientation must remain local-state driven.');
add('today-background-refresh-budget', todayIntervals.length > 0 && todayIntervals.every((ms) => ms >= limits.mobileRefreshMinMs), `${todayIntervals.join(',') || 'none'} ms`);
add('finance-review-remains-selected-workspace-only', /finance-job-completion-review/.test(organizer) && /state\.financeWorkspace !== 'review'/.test(organizer));
add('finance-posting-remains-selected-workspace-only', /finance-job-completion-posting-approval/.test(organizer) && /state\.financeWorkspace !== 'posting'/.test(organizer));
add('finance-mapping-remains-on-demand', /Load accountant mapping readiness/.test(financeMapping) && /if\(!state\.payload\)/.test(financeMapping));
add('release-cockpit-present', /Release & deployment cockpit/.test(itUi) && /Next safe release action/.test(itUi) && /Production promotion/.test(itUi));
add('release-cockpit-read-only', /This cockpit never deploys or promotes/.test(itUi) && !/data-release-(?:deploy|promote)/i.test(itUi));
add('budget-contract-exported-in-ui', /const PERFORMANCE_BUDGETS = Object\.freeze/.test(itUi) && /coreShellAssets:\s*30/.test(itUi) && /coreShellJs:\s*21/.test(itUi) && /itRuntimeReads:\s*10/.test(itUi));
add('no-finance-provider-enablement', !/(FINANCE_POSTING_EXECUTION_ENABLED\s*=\s*true|PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true|provider_mutation_allowed\s*=\s*true)/i.test(itUi + organizer));
add('performance-browser-schema-fixture-derives-current-repository-schema',
  /function migrationVersionFromFilename\(name\)/.test(performanceBrowser) &&
  /\.map\(migrationVersionFromFilename\)/.test(performanceBrowser) &&
  /const CURRENT_SCHEMA = schemaVersions\.at\(-1\)/.test(performanceBrowser) &&
  /expected_schema_version:\s*CURRENT_SCHEMA/.test(performanceBrowser) &&
  /latest_applied_schema_version:\s*CURRENT_SCHEMA/.test(performanceBrowser),
  'Rendered performance fixtures must derive current schema from repository migration filenames instead of a historical literal.');
add('performance-browser-schema-fixture-supports-variable-width-migrations',
  performanceBrowser.includes("migrationVersionFromFilename('999_example.sql')") &&
  performanceBrowser.includes("migrationVersionFromFilename('1000_example.sql')") &&
  performanceBrowser.includes("migrationVersionFromFilename('12034_example.sql')") &&
  performanceBrowser.includes('toBe(1000)') &&
  performanceBrowser.includes('toBe(12034)') &&
  !performanceBrowser.includes('/^\\d{3}_.+\\.sql$/i') &&
  !performanceBrowser.includes('slice(0,3)'),
  'Performance browser evidence accepts variable-width numbered SQL migrations, explicitly covers Schema 1000+, and rejects the retired three-digit parser.');
add('performance-browser-schema-drift-fixture-uses-actual-prior-migration',
  /const PREVIOUS_SCHEMA = schemaVersions\.at\(-2\)/.test(performanceBrowser) &&
  /latest_applied_schema_version:\s*PREVIOUS_SCHEMA/.test(performanceBrowser) &&
  !/const PREVIOUS_SCHEMA = CURRENT_SCHEMA - 1/.test(performanceBrowser),
  'Schema-drift acceptance must use the actual second-latest repository migration rather than assuming contiguous schema numbering.');
add('performance-browser-schema-fixture-fails-closed-without-two-schema-versions',
  /!Number\.isInteger\(CURRENT_SCHEMA\)/.test(performanceBrowser) &&
  /!Number\.isInteger\(PREVIOUS_SCHEMA\)/.test(performanceBrowser) &&
  /PREVIOUS_SCHEMA >= CURRENT_SCHEMA/.test(performanceBrowser) &&
  /Could not derive the latest two repository schemas for performance browser fixtures\./.test(performanceBrowser),
  'Performance fixtures fail closed if current and previous repository schema authority cannot both be derived.');
add('performance-browser-schema-fixture-has-no-numeric-schema-literal',
  !/expected_schema_version\s*:\s*\d+/.test(performanceBrowser) &&
  !/latest_applied_schema_version\s*:\s*\d+/.test(performanceBrowser),
  'Current-schema browser fixtures must not silently become stale after a migration.');
add('help-documents-release-cockpit', /Release &amp; Deployment Cockpit/.test(help) && /performance budget/i.test(help));
add('source-command-wired', pkg.scripts?.['test:performance-budgets'] === 'node scripts/application-performance-budget-check.mjs');
add('browser-command-wired', pkg.scripts?.['test:browser:performance-budgets'] === 'playwright test --config=playwright.config.mjs tests/browser/application-performance-budget.spec.mjs');
add('workflow-source-gate-wired', /npm run test:performance-budgets/.test(workflow));
add('workflow-browser-gate-wired', /npm run test:browser:performance-budgets/.test(workflow));

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
const failed = checks.filter((check) => !check.ok);
console.log(`\nBuild 232 application performance/release cockpit gate: ${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) process.exit(1);
