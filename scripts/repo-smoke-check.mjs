#!/usr/bin/env node
/** Repository-level static sanity check for build 2026-07-05a / schema 155. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const all = (text, values) => values.every((value) => text.includes(value));
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok, details });
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const schema = read('sql/000_full_schema_reference.sql');
const migration151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const migration153 = read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const migration154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const migration155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const accountant = read('supabase/functions/accountant-export/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customerPortal = read('js/customer-portal.js');
const index = read('index.html');
const css = read('style.css');
const config = read('supabase/config.toml');
const routeGenerator = read('scripts/generate-public-routes.mjs');

// Documentation and archive integrity.
const ignoredDocRoots = [`${path.sep}archive${path.sep}`, `${path.sep}node_modules${path.sep}`, `${path.sep}.git${path.sep}`];
const activeMd = walk(root)
  .filter((file) => file.endsWith('.md') && !ignoredDocRoots.some((segment) => file.includes(segment)))
  .map((file) => path.relative(root, file).replaceAll('\\', '/'))
  .sort();
add('active-markdown-exactly-three', JSON.stringify(activeMd) === JSON.stringify(['README.md', 'docs/ACTIVE_PROJECT_HANDBOOK.md', 'docs/NEXT_STEPS_AND_SANITY_CHECK.md']), `Active Markdown: ${activeMd.join(', ') || 'none'}`);
add('retired-markdown-archive-present', exists('archive/retired-markdown-2026-07-05a') && walk(path.join(root, 'archive/retired-markdown-2026-07-05a')).filter((file) => file.endsWith('.md')).length >= 80, 'Historical Markdown is preserved in the dated archive.');
add('temp-write-files-retired', !walk(root).filter((file) => !file.includes(`${path.sep}archive${path.sep}`) && /test_write/i.test(path.basename(file))).length, 'No temporary write files remain active.');
add('active-readme-schema155', all(read('README.md'), ['2026-07-05a', 'schema 155', 'live job updates']), 'README identifies the current release and live-update scope.');
add('handoff-docs-current', all(read('docs/ACTIVE_PROJECT_HANDBOOK.md').toLowerCase(), ['schema 155', 'customer-visible updates']) && all(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').toLowerCase(), ['schema 155', 'role and visibility acceptance test']), 'Active handoff explains current controls and testing.');

// Schema/reference integrity.
const migrationBlocks = (schema.match(/BEGIN MIGRATION:/g) || []).length;
add('canonical-schema-through-155', schema.includes('BEGIN MIGRATION: 030_') && schema.includes('BEGIN MIGRATION: 155_') && migrationBlocks === 126, `Canonical schema has ${migrationBlocks} migration blocks.`);
add('canonical-schema-includes-schema155-verbatim', schema.includes(migration155.trim()), 'Full schema contains the current migration.');
for (const [number, text] of [[151, migration151], [153, migration153], [154, migration154], [155, migration155]]) {
  add(`schema${number}-transaction-balanced`, (text.match(/^begin;$/gmi) || []).length === 1 && (text.match(/^commit;$/gmi) || []).length === 1, `Schema ${number} has one BEGIN and one COMMIT marker.`);
}
add('schema155-live-update-objects', all(migration155, ['work_order_live_updates', 'work_order_live_update_media', 'v_customer_portal_live_updates', 'v_work_order_live_update_queue']), 'Live-update records and constrained views are defined.');
add('schema155-live-update-privacy', all(migration155, ['enable row level security', 'Customer-visible updates may attach only approved assets with a public delivery URL.', 'revoke all on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue from anon, authenticated', 'grant select on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue to service_role']), 'Browser roles are denied direct reads while token/JWT functions use service role.');
add('schema155-live-update-roles', all(migration155, ['Only a site leader or higher may record a live work update.', 'Customer-visible updates require supervisor or higher.', 'Only a supervisor or higher may retract a live work update.']), 'Role enforcement remains in the database RPCs.');
add('schema155-schema-view-safe', migration155.includes('create or replace view public.v_schema_drift_status') && !migration155.includes('drop view if exists public.v_schema_drift_status'), 'Schema status view preserves dashboard dependencies.');
add('schema154-release-dashboard-retained', all(migration154, ['v_release_readiness_dashboard', 'ywi_rpc_capture_release_readiness_snapshot', 'REVIEW ONLY']), 'Release evidence dashboard remains available.');

// Function and UI wiring.
add('operations-schema155-wiring', all(operations, ["const BUILD = '2026-07-05a'", 'const SCHEMA = 155', 'work_order_live_update_create', 'work_order_live_update_retract', 'ywi_rpc_create_work_order_live_update', 'v_work_order_live_update_queue']), 'Operations function wires protected queue/actions to live-update RPCs.');
add('operations-request-body-once', (operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g) || []).length === 1, 'Operations request payload is consumed once.');
add('portal-schema155-filtered-updates', all(portal, ["const BUILD = '2026-07-05a'", 'const SCHEMA = 155', 'portalLiveUpdates', 'v_customer_portal_live_updates', 'live_updates: liveUpdates']), 'Customer portal reads only the constrained portal-safe update view.');
add('portal-timeline-private-copy', all(customerPortal, ['liveUpdateTimeline', 'Staff-only notes, private review images, and internal costing are never shown here.', 'customer-portal-update-placeholder']), 'Customer timeline has a safe empty state and explicit privacy copy.');
add('cockpit-live-update-ui', all(cockpit, ['Live job updates: staff-only or customer-visible', 'oc_live_update_form', 'renderLiveUpdateQueue', 'work_order_live_update_retract', 'Only approved public images are available here.']), 'Cockpit provides role-aware live-update creation and retraction.');
add('cockpit-release-dashboard-retained', all(cockpit, ['oc_release_dashboard', 'renderReleaseDashboard', 'oc_release_snapshot_form', 'Capture evidence snapshot']), 'Existing evidence dashboard remains wired.');
add('upload-private-review-asset', all(upload, ["const BUCKET = 'review-assets'", "const BUILD = '2026-07-05a'", 'const SCHEMA = 155', 'review_only:true', 'imageDimensions', 'checksum_sha256']), 'Upload handler verifies and stores review media privately.');
add('webhook-marker-current', all(webhook, ["const BUILD='2026-07-05a'", 'const SCHEMA=155', 'validateSession', 'ywi_rpc_record_portal_deposit_paid', 'ywi_refresh_stripe_webhook_alerts']), 'Webhook retains verified payment and alert logic.');
add('accountant-marker-current', all(accountant, ["const BUILD = '2026-07-05a'", 'const SCHEMA = 155', 'ywi_rpc_capture_accountant_close_snapshot', 'createSignedUrl']), 'Accountant export retains private close/mapping handling.');
add('jwt-config-protected-functions', /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config) && /\[functions\.upload-public-asset\]\s+verify_jwt = true/s.test(config) && /\[functions\.accountant-export\]\s+verify_jwt = true/s.test(config), 'Protected functions retain JWT verification.');

// SEO/CSS/cache guardrails.
const h1Count = (index.match(/<h1\b/gi) || []).length;
add('homepage-one-h1', h1Count === 1, `Homepage H1 count: ${h1Count}.`);
const ids = [...index.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
add('homepage-no-duplicate-ids', duplicateIds.length === 0, duplicateIds.length ? `Duplicates: ${[...new Set(duplicateIds)].join(', ')}` : 'No duplicate IDs.');
add('build-cache-marker-current', all(index, ['2026-07-05a', 'operations-cockpit.js?v=2026-07-05a']) && read('server-worker.js').includes('ywi-shell-v2026-07-05a'), 'HTML and service-worker cache marker are current.');
add('route-generator-cache-marker-current', routeGenerator.includes("const build = '2026-07-05a';"), 'Generated public pages reference the current static build marker.');
add('visual-input-mime-match', cockpit.includes('accept="image/jpeg,image/png,image/webp"') && !migration153.includes('image/avif'), 'UI/storage MIME promise matches server verification.');
add('cockpit-dark-contrast-remediation', all(css, ['--oc-text: #f8fbff', '--oc-surface: #0c172b', '.operations-cockpit .oc-badge-approved', '.operations-cockpit .oc-permission.is-allowed', '.operations-cockpit .oc-permission.is-restricted', '.operations-cockpit .operations-status[data-status="error"]', '@media (forced-colors: active)']), 'Cockpit dark-surface tokens and state contrast overrides remain present.');
add('live-update-responsive-css', all(css, ['.customer-portal-updates', '.customer-portal-update-placeholder', '.operations-cockpit .oc-live-update-card', '@media(max-width:620px)']), 'Live updates include portal and Cockpit responsive fallbacks.');

// Supporting scripts and syntax.
for (const file of [
  'scripts/staging-fixtures.mjs', 'scripts/security-policy-assertions.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'tests/browser/operations-portal.spec.mjs',
  'playwright.config.mjs', 'package-lock.json', '.github/workflows/staging-browser-integration.yml', '.gitignore', 'package.json'
]) add(`exists:${file}`, exists(file), 'Required support file is present.');

const jsFiles = [
  'js/api.js', 'js/operations-cockpit.js', 'js/customer-portal.js', 'js/public-routes.js',
  'scripts/generate-public-routes.mjs', 'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs',
  'scripts/staging-fixtures.mjs', 'scripts/operations-rpc-staging-e2e.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/repo-smoke-check.mjs',
  'playwright.config.mjs', 'app.js', 'server-worker.js'
];
for (const file of jsFiles) {
  const run = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  add(`syntax:${file}`, run.status === 0, run.status === 0 ? 'Syntax OK.' : (run.stderr || run.stdout).trim());
}

let ts;
try {
  const require = createRequire(import.meta.url);
  try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
} catch (error) {
  add('typescript-compiler-available', false, String(error));
}
if (ts) {
  for (const file of [
    'supabase/functions/operations-manage/index.ts', 'supabase/functions/upload-public-asset/index.ts',
    'supabase/functions/customer-portal/index.ts', 'supabase/functions/public-content/index.ts',
    'supabase/functions/stripe-webhook/index.ts', 'supabase/functions/accountant-export/index.ts'
  ]) {
    const output = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true, fileName: file });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
}

for (const script of [
  'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs',
  'scripts/operations-cockpit-contrast-check.mjs', 'scripts/release-readiness-dashboard-check.mjs',
  'scripts/live-work-updates-check.mjs', 'scripts/operations-rpc-staging-e2e.mjs'
]) {
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  add(`static:${path.basename(script)}`, run.status === 0, run.status === 0 ? 'Static checks passed.' : (run.stderr || run.stdout).trim());
}

const passed = results.filter((item) => item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(results.some((item) => !item.ok) ? 1 : 0);
