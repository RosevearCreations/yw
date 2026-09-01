#!/usr/bin/env node
/** Repository-level static sanity check for build 2026-09-01b / schema 160. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const hasAll = (text, values) => values.every((value) => text.includes(value));
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok, details });
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const schema = read('sql/000_full_schema_reference.sql');
const migrations = {
  151: read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql'),
  153: read('sql/153_release_fixture_policy_mapping_seo_alerts.sql'),
  154: read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql'),
  155: read('sql/155_live_job_updates_customer_timeline_and_visibility.sql'),
  156: read('sql/156_customer_notification_consent_outbox_delivery.sql'),
  157: read('sql/157_service_execution_proof_cost_capture.sql'),
  158: read('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql'),
  159: read('sql/159_module_boundaries_permission_gated_navigation.sql'),
  160: read('sql/160_it_readiness_admin_access_integrity.sql')
};
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const dispatcher = read('supabase/functions/customer-notification-dispatch/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const accountant = read('supabase/functions/accountant-export/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customerPortal = read('js/customer-portal.js');
const index = read('index.html');
const css = read('style.css');
const itCss = read('it-readiness.css');
const config = read('supabase/config.toml');
const routeGenerator = read('scripts/generate-public-routes.mjs');
const readme = read('README.md');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

// Documentation hygiene.
const ignored = [`${path.sep}archive${path.sep}`, `${path.sep}retired-markdown-2026-08-05a${path.sep}`, `${path.sep}node_modules${path.sep}`, `${path.sep}.git${path.sep}`];
const activeMd = walk(root).filter((file) => file.endsWith('.md') && !ignored.some((segment) => file.includes(segment))).map((file) => path.relative(root, file).replaceAll('\\', '/')).sort();
add('active-markdown-exactly-three', JSON.stringify(activeMd) === JSON.stringify(['README.md', 'docs/ACTIVE_PROJECT_HANDBOOK.md', 'docs/NEXT_STEPS_AND_SANITY_CHECK.md']), `Active Markdown: ${activeMd.join(', ') || 'none'}`);
add('retired-markdown-archive-present', exists('retired-markdown-2026-08-05a') && walk(path.join(root, 'retired-markdown-2026-08-05a')).filter((file) => file.endsWith('.md')).length >= 80, 'Historical Markdown is preserved in dated archive.');
add('temp-write-files-retired', !walk(root).some((file) => !file.includes(`${path.sep}archive${path.sep}`) && /test_write/i.test(path.basename(file))), 'No temporary write files remain active.');
add('active-readme-current', hasAll(readme, ['2026-09-01b', 'schema `160`', 'Safety / OHSA', 'Finance', 'Jobs', 'Admin', 'I.T. Readiness']), 'README identifies schema 160 Admin/I.T. readiness release.');
add('handoff-docs-current', hasAll(handbook, ['Schema target:', '`160`', 'Admin access invariant', 'I.T. Readiness']) && hasAll(nextSteps, ['Schema:', '`160`', 'Admin Module Permissions acceptance', 'Safety-only regression test']), 'Active handoff explains current Schema 160 controls and acceptance tests.');

// Schema/reference integrity.
const migrationBlocks = (schema.match(/BEGIN MIGRATION:/g) || []).length;
add('canonical-schema-through-160', schema.includes('BEGIN MIGRATION: 030_') && schema.includes('BEGIN MIGRATION: 160_it_readiness_admin_access_integrity') && migrationBlocks === 131, `Canonical schema has ${migrationBlocks} migration blocks.`);
add('canonical-schema-includes-schema159-verbatim', schema.includes(migrations[159].trim()), 'Full schema contains schema 159 migration verbatim.');
add('canonical-schema-includes-schema160-verbatim', schema.includes(migrations[160].trim()), 'Full schema contains schema 160 migration verbatim.');
for (const [number, text] of Object.entries(migrations)) {
  add(`schema${number}-transaction-balanced`, (text.match(/^begin;$/gmi) || []).length === 1 && (text.match(/^commit;$/gmi) || []).length === 1, `Schema ${number} has one BEGIN and one COMMIT marker.`);
}
add('schema155-live-update-privacy', hasAll(migrations[155], ['enable row level security', 'Customer-visible updates may attach only approved assets with a public delivery URL.', 'v_customer_portal_live_updates']), 'Live updates remain token/JWT-service-only.');
add('schema156-notification-safety', hasAll(migrations[156], ['customer_notification_preferences', 'customer_notification_outbox', 'customer_opted_out', 'live_update_not_customer_visible', 'manual_review', 'v_customer_notification_delivery_queue']), 'Consent, outbox, opt-out/retraction, and manual-review safety exist.');
add('schema157-execution-proof-privacy', hasAll(migrations[157], ['work_order_execution_proofs', 'v_work_order_execution_cost_dashboard', 'v_customer_portal_execution_proofs', 'Customer portal never receives internal cost fields.', 'execution_proof_rpcs_not_public']), 'Execution proof and internal costing remain private.');
add('schema158-closeout-objects', hasAll(migrations[158], ['work_order_closeout_packages', 'work_order_closeout_gallery_items', 'work_order_customer_closeout_signoffs', 'work_order_review_requests', 'work_order_maintenance_followups', 'v_customer_portal_closeout_packages']), 'Closeout/signoff/review/follow-up objects exist.');
add('schema158-closeout-rpcs-private', hasAll(migrations[158], ['ywi_rpc_submit_work_order_closeout_package', 'ywi_rpc_decide_work_order_closeout_package', 'ywi_rpc_customer_sign_work_order_closeout', 'closeout_tables_not_public', 'closeout_rpcs_not_public']), 'Closeout RPCs are service-role/private and policy-asserted.');
const closeoutPortalView = migrations[158].slice(migrations[158].indexOf('create view public.v_customer_portal_closeout_packages'), migrations[158].indexOf('revoke all on public.v_work_order_closeout_queue'));
add('schema158-portal-cost-privacy', !/(total_actual_cost|margin_amount|staff_closeout_notes|labour_cost_total|material_cost_total)/.test(closeoutPortalView), 'Portal closeout view excludes internal cost/staff fields.');
add('schema159-module-boundaries', hasAll(migrations[159], ['app_modules','app_module_routes','app_role_module_permissions','app_profile_module_permissions','ywi_get_my_module_permissions','ywi_module_security_assertions']), 'Schema 159 module registry and permission RPCs exist.');
add('schema159-admin-break-glass', migrations[159].includes("if v_role='admin' then return 'manage'; end if;"), 'Admin cannot be module-locked out.');
add('schema160-it-readiness', hasAll(migrations[160], ['it_readiness_check_registry','v_admin_module_access_integrity','ywi_admin_set_profile_module_permissions','ywi_it_readiness_security_assertions']), 'Schema 160 I.T. readiness and Admin access-integrity authorities exist.');
add('schema160-admin-override-guard', hasAll(migrations[160], ['trg_prevent_admin_module_override','Admin module access is break-glass manage and cannot be overridden.']), 'Admin module overrides are blocked at the database boundary.');

// Functions/UI wiring. Existing domain functions intentionally retain their schema 159 markers because Schema 160 adds a dedicated Admin control endpoint without changing their business contracts.
add('operations-schema159-wiring', hasAll(operations, ["const BUILD = '2026-09-01a'", 'const SCHEMA = 159', "job_updates: 'v_work_order_live_update_queue'", "customer_notifications: 'v_customer_notification_delivery_queue'", "execution_proofs: 'v_work_order_execution_proof_queue'", "closeouts: 'v_work_order_closeout_queue'", "action === 'work_order_closeout_submit'", 'ywi_rpc_submit_work_order_closeout_package', "action === 'work_order_closeout_decision'", 'ywi_rpc_decide_work_order_closeout_package']), 'Operations function wires live update, notification, execution proof, and closeout queues/actions.');
add('operations-request-body-once', (operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g) || []).length === 1, 'Operations request payload is consumed once.');
add('portal-schema159-wiring', hasAll(portal, ["const BUILD = '2026-09-01a'", 'const SCHEMA = 159', 'portalLiveUpdates', 'portalNotificationPreference', 'portalExecutionProofs', 'portalCloseoutPackages', "action === 'sign_closeout'", 'ywi_rpc_customer_sign_work_order_closeout']), 'Customer portal returns safe updates/proofs/closeouts and signs through RPC.');
add('dispatcher-protected', hasAll(dispatcher, ["const BUILD = '2026-09-01a'", 'const SCHEMA = 159', 'YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED', 'YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN', "'Idempotency-Key'", "p_result_status:'manual_review'"]), 'Dispatcher requires run token and safe provider uncertainty handling.');
add('upload-private-review-asset', hasAll(upload, ["const BUCKET = 'review-assets'", "const BUILD = '2026-09-01a'", 'const SCHEMA = 159', 'review_only:true', 'imageDimensions', 'checksum_sha256']), 'Upload handler verifies and stores review media privately.');
add('webhook-marker-current', hasAll(webhook, ["const BUILD='2026-09-01a'", 'const SCHEMA=159', 'validateSession', 'ywi_rpc_record_portal_deposit_paid', 'ywi_refresh_stripe_webhook_alerts']), 'Webhook retains verified payment and alert logic.');
add('accountant-marker-current', hasAll(accountant, ["const BUILD = '2026-09-01a'", 'const SCHEMA = 159', 'ywi_rpc_capture_accountant_close_snapshot', 'createSignedUrl']), 'Accountant export retains private close/mapping handling.');
add('jwt-config-protected-functions', /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config) && /\[functions\.upload-public-asset\]\s+verify_jwt = true/s.test(config) && /\[functions\.accountant-export\]\s+verify_jwt = true/s.test(config) && /\[functions\.admin-it-control\]\s+verify_jwt = true/s.test(config), 'Protected functions retain JWT verification.');
add('dispatcher-config-explicit', /\[functions\.customer-notification-dispatch\]\s+verify_jwt = false/s.test(config), 'Dispatcher has explicit no-JWT config and performs its own run-token check.');
add('cockpit-current-ui', hasAll(cockpit, ['renderLiveUpdateQueue', 'renderExecutionProofQueue', 'renderCloseoutQueue', 'oc_closeout_form', 'data-oc-closeout-before-assets', 'closeout-approve', 'closeout-invoice', 'Email addresses, portal tokens, staff notes, and private media are never shown in this queue.']), 'Cockpit includes live, notification, proof, and closeout surfaces.');
add('customer-portal-current-ui', hasAll(customerPortal, ['executionProofTimeline', 'closeoutPackagePanel', 'customerPortalNotificationPreferenceForm', 'Approve completed work', 'Internal labour, material, equipment, margin, staff notes, and private review images are never shown in this customer portal.']), 'Portal shows customer-safe proof, closeout, signoff, and preference UI.');
add('admin-it-readiness-ui', hasAll(read('js/it-readiness-ui.js'), ['I.T. Readiness','admin-it-control','runSmokeCheck','itReadinessWorkspace']) && hasAll(read('js/module-access-ui.js'), ['admin-it-control','Admin break-glass']), 'Admin Module Permissions and I.T. Readiness use the dedicated protected control path.');

// SEO/CSS/cache guardrails.
const h1Count = (index.match(/<h1\b/gi) || []).length;
add('homepage-one-h1', h1Count === 1, `Homepage H1 count: ${h1Count}.`);
const ids = [...index.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
add('homepage-no-duplicate-ids', duplicateIds.length === 0, duplicateIds.length ? `Duplicates: ${[...new Set(duplicateIds)].join(', ')}` : 'No duplicate IDs.');
const mainStart = index.indexOf('<main class="container">');
const mainEnd = index.indexOf('</main>');
const supportStart = index.indexOf('<aside class="app-supporting-panels"');
add('route-cards-before-support-panels', mainStart > 0 && mainEnd > mainStart && supportStart > mainEnd, `main=${mainStart}, mainEnd=${mainEnd}, support=${supportStart}`);
add('router-scrolls-to-active-card', read('js/router.js').includes('function scrollToActiveSection') && read('js/router.js').includes('section.scrollIntoView') && css.includes('scroll-margin-top'), 'Top-menu navigation targets the active card below the sticky header.');
add('build-cache-marker-current', hasAll(index, ['2026-09-01b', 'operations-cockpit.js?v=2026-09-01b']) && read('server-worker.js').includes('ywi-shell-v2026-09-01b'), 'HTML and service-worker cache marker are current.');
add('route-generator-cache-marker-current', routeGenerator.includes("const build = '2026-09-01b';"), 'Generated public pages reference current static build marker.');
add('visual-input-mime-match', cockpit.includes('accept="image/jpeg,image/png,image/webp"') && !migrations[153].includes('image/avif'), 'UI/storage MIME promise matches server verification.');
add('cockpit-dark-contrast-remediation', hasAll(css, ['--oc-text: #f8fbff', '--oc-surface: #0c172b', '.operations-cockpit .oc-badge-approved', '.operations-cockpit .oc-permission.is-allowed', '.operations-cockpit .oc-permission.is-restricted', '@media (forced-colors: active)']), 'Cockpit dark-surface tokens and contrast overrides remain present.');
add('closeout-responsive-css', hasAll(css, ['.operations-cockpit .oc-closeout-card', '.customer-portal-closeout', '.customer-portal-closeout-gallery', '.customer-portal-closeout-form', '@media(max-width:620px)']), 'Closeout and portal surfaces include responsive CSS.');
add('it-readiness-responsive-css', hasAll(itCss, ['.it-readiness-hero','@media(max-width:900px)','@media(max-width:560px)','@media(forced-colors:active)']), 'I.T. Readiness has desktop, mobile, and forced-colors safeguards.');

// Support files.
for (const file of [
  'scripts/staging-fixtures.mjs', 'scripts/security-policy-assertions.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'scripts/service-execution-proof-check.mjs', 'scripts/supervisor-closeout-check.mjs', 'scripts/navigation-route-priority-check.mjs', 'scripts/module-permissions-check.mjs',
  'scripts/admin-it-readiness-check.mjs', 'js/it-readiness-ui.js', 'it-readiness.css', 'supabase/functions/admin-it-control/index.ts',
  'tests/browser/operations-portal.spec.mjs', 'playwright.config.mjs', 'package-lock.json', '.github/workflows/staging-browser-integration.yml', '.gitignore', 'package.json'
]) add(`exists:${file}`, exists(file), 'Required support file is present.');

const jsFiles = [
  'js/api.js', 'js/security.js', 'js/module-nav.js', 'js/module-access-ui.js', 'js/it-readiness-ui.js', 'js/operations-cockpit.js', 'js/customer-portal.js', 'js/public-routes.js',
  'scripts/generate-public-routes.mjs', 'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs',
  'scripts/staging-fixtures.mjs', 'scripts/operations-rpc-staging-e2e.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'scripts/service-execution-proof-check.mjs', 'scripts/supervisor-closeout-check.mjs', 'scripts/navigation-route-priority-check.mjs',
  'scripts/module-permissions-check.mjs', 'scripts/admin-it-readiness-check.mjs', 'scripts/repo-smoke-check.mjs', 'playwright.config.mjs', 'app.js', 'server-worker.js'
];
for (const file of jsFiles) {
  const run = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  add(`syntax:${file}`, run.status === 0, run.status === 0 ? 'Syntax OK.' : (run.stderr || run.stdout).trim());
}

let ts;
try {
  const require = createRequire(import.meta.url);
  ts = require('typescript');
} catch (error) { add('typescript-compiler-available', false, String(error)); }
if (ts) {
  for (const file of [
    'supabase/functions/operations-manage/index.ts', 'supabase/functions/upload-public-asset/index.ts',
    'supabase/functions/customer-portal/index.ts', 'supabase/functions/public-content/index.ts',
    'supabase/functions/stripe-webhook/index.ts', 'supabase/functions/accountant-export/index.ts',
    'supabase/functions/customer-notification-dispatch/index.ts', 'supabase/functions/admin-it-control/index.ts',
    'supabase/functions/_shared/module-permissions.ts', 'supabase/functions/admin-directory/index.ts', 'supabase/functions/admin-selectors/index.ts',
    'supabase/functions/admin-manage/index.ts', 'supabase/functions/jobs-directory/index.ts', 'supabase/functions/jobs-manage/index.ts',
    'supabase/functions/resend-email/index.ts', 'supabase/functions/review-list/index.ts', 'supabase/functions/review-submission/index.ts',
    'supabase/functions/submission-detail/index.ts', 'supabase/functions/upload-image/index.ts', 'supabase/functions/upload-hse-packet-proof/index.ts'
  ]) {
    const output = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true, fileName: file });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
}

for (const script of [
  'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'scripts/service-execution-proof-check.mjs', 'scripts/supervisor-closeout-check.mjs', 'scripts/navigation-route-priority-check.mjs',
  'scripts/module-permissions-check.mjs', 'scripts/admin-it-readiness-check.mjs', 'scripts/operations-rpc-staging-e2e.mjs'
]) {
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  add(`static:${path.basename(script)}`, run.status === 0, run.status === 0 ? 'Static checks passed.' : (run.stderr || run.stdout).trim());
}

const passed = results.filter((item) => item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(results.some((item) => !item.ok) ? 1 : 0);
