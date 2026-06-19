import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const results = [];
let failed = false;
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const add = (name, ok, details = '') => { results.push({ name, ok:!!ok, details }); if (!ok) failed = true; };
const containsAll = (text, tokens) => tokens.every((token) => text.includes(token));

function findMarkdown(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    if (entry.name === 'archive' || entry.name === '.git') continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) findMarkdown(absolute, out);
    else if (entry.name.endsWith('.md')) out.push(path.relative(root, absolute).replaceAll('\\','/'));
  }
  return out;
}

const requiredFiles = [
  'README.md', 'docs/ACTIVE_PROJECT_HANDBOOK.md', 'docs/NEXT_STEPS_AND_SANITY_CHECK.md',
  'index.html', 'style.css', 'app.js', 'server-worker.js', 'manifest.json', 'robots.txt', 'sitemap.xml',
  'js/api.js', 'js/operations-cockpit.js', 'js/customer-portal.js', 'js/public-routes.js',
  'scripts/generate-public-routes.mjs', 'scripts/repo-smoke-check.mjs', 'scripts/operations-rpc-integration-test.mjs',
  'sql/150_end_to_end_operations_customer_portal_media_route_publication.sql',
  'sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql', 'sql/000_full_schema_reference.sql',
  'supabase/functions/operations-manage/index.ts', 'supabase/functions/upload-public-asset/index.ts',
  'supabase/functions/customer-portal/index.ts', 'supabase/functions/public-content/index.ts',
  'supabase/functions/stripe-webhook/index.ts', 'supabase/config.toml'
];
for (const file of requiredFiles) add(`file:${file}`, exists(file), exists(file) ? 'Present.' : 'Missing.');

const html = read('index.html');
const css = read('style.css');
const worker = read('server-worker.js');
const api = read('js/api.js');
const cockpit = read('js/operations-cockpit.js');
const migration150 = read('sql/150_end_to_end_operations_customer_portal_media_route_publication.sql');
const migration151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const schema = read('sql/000_full_schema_reference.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const portalFunction = read('supabase/functions/customer-portal/index.ts');
const portalScript = read('js/customer-portal.js');
const publicScript = read('js/public-routes.js');
const generator = read('scripts/generate-public-routes.mjs');
const publicFunction = read('supabase/functions/public-content/index.ts');
const stripeFunction = read('supabase/functions/stripe-webhook/index.ts');
const config = read('supabase/config.toml');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const next = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const rpcTest = read('scripts/operations-rpc-integration-test.mjs');

add('build-marker-current', html.includes('2026-06-18a') && worker.includes('ywi-shell-v2026-06-18a') && cockpit.includes("const BUILD = '2026-06-18a'"), 'Index, service worker, and cockpit should share build 2026-06-18a.');
add('single-homepage-h1', (html.match(/<h1\b/gi) || []).length === 1, `index.html contains ${(html.match(/<h1\b/gi) || []).length} H1 tag(s).`);
const ids = [...html.matchAll(/\bid=["']([^"']+)/g)].map((match) => match[1]);
add('unique-index-ids', ids.length === new Set(ids).size, `index.html has ${ids.length} IDs and ${new Set(ids).size} unique IDs.`);
add('css-braces-balanced', (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length, 'style.css braces should balance.');
add('responsive-schema151-css', containsAll(css, ['.oc-live-queue','.customer-portal-shell','.public-route-shell','@media(max-width:620px)','prefers-reduced-motion']), 'Queue/portal/public responsive CSS should exist.');
add('visual-placeholders-present', containsAll(html, ['graphic-placeholder-wall','section-graphic-placeholder','write-action-proof-visual']), 'Homepage and protected sections should retain explicit visual placeholders.');
add('new-scripts-loaded', containsAll(html, ['/js/customer-portal.js?v=2026-06-18a','/js/public-routes.js?v=2026-06-18a','/js/operations-cockpit.js?v=2026-06-18a']), 'Index should load current portal, public route, and cockpit scripts.');
add('new-scripts-cached', containsAll(worker, ["'/js/customer-portal.js'","'/js/public-routes.js'","'/js/operations-cockpit.js'"]), 'Service worker should cache current application scripts.');

const activeMarkdown = findMarkdown().sort();
add('markdown-consolidated', JSON.stringify(activeMarkdown) === JSON.stringify(['README.md','docs/ACTIVE_PROJECT_HANDBOOK.md','docs/NEXT_STEPS_AND_SANITY_CHECK.md']), `Active Markdown: ${activeMarkdown.join(', ')}`);
add('retired-markdown-archived', exists('archive/retired-markdown-2026-06-18a/root/CHANGELOG.md') && exists('archive/retired-markdown-2026-06-18a/docs/SCHEMA_149_OPERATIONS_COCKPIT_AND_WRITE_CONTROLS.md'), 'Superseded root and docs Markdown should be archived.');
add('temp-files-retired', !['test_write.txt','test_write2_OLD.txt','test_write3.txt','test_write_OLD.txt'].some(exists), 'Temporary write-test files should not remain active.');
add('primary-docs-current', containsAll(handbook, ['build 2026-06-18a','schema 151','customer portal','transactional PostgreSQL RPC']) && containsAll(next, ['Completed in this pass','Release blockers','Highest-value next work']), 'The two active handoff files should document current implementation and limits.');

add('schema150-foundation-retained', containsAll(migration150, ['150_end_to_end_operations_customer_portal_media_route_publication','150::int as expected_schema_version','customer_portal_events','public_sitemap_entries']), 'Schema 150 foundation should remain available.');
add('schema151-marker', containsAll(migration151, ['151_transactional_rpc_accounting_reconciliation_quote_tests','151::int as expected_schema_version','Apply migrations through schema 151']), 'Migration should register and expect schema 151.');
add('canonical-schema-includes-151', schema.includes(migration151.trim()), 'Canonical full schema should contain migration 151 verbatim.');
add('canonical-schema-complete-range', schema.includes('BEGIN MIGRATION: 030_') && schema.includes('BEGIN MIGRATION: 151_') && (schema.match(/BEGIN MIGRATION:/g) || []).length === 122, `Canonical schema contains ${(schema.match(/BEGIN MIGRATION:/g) || []).length} ordered migration blocks.`);
add('migration151-transaction-balanced', (migration151.match(/^begin;$/gmi) || []).length === (migration151.match(/^commit;$/gmi) || []).length && (migration151.match(/^begin;$/gmi) || []).length === 1, 'Migration 151 BEGIN/COMMIT markers should balance.');
add('schema151-rpc-functions', containsAll(migration151, ['ywi_rpc_post_payment_action','ywi_rpc_promote_bank_csv_import','ywi_rpc_apply_reconciliation_action','ywi_rpc_accept_quote_package','ywi_rpc_prepare_deposit_request','ywi_rpc_attach_deposit_checkout','ywi_rpc_record_portal_deposit_paid','ywi_rpc_mark_deposit_checkout_status']), 'Schema 151 should define all transactional RPCs.');
add('schema151-rpc-guards', containsAll(migration151, ['ywi_require_rpc_rank','ywi_assert_period_open','Journal entry is not balanced to the cent','Split allocations must equal the bank item amount exactly to the cent','revoke all on function public.ywi_rpc_post_payment_action','grant execute on function public.ywi_rpc_post_payment_action']), 'Schema 151 should include role, period, exact-cent, balanced-journal, and grant guards.');
add('schema151-permission-matrix', containsAll(migration151, ['operation_rpc_permission_tests','v_operation_rpc_permission_matrix','rpc_post_payment_action_admin_only','rpc_deposit_paid_webhook_guarded']), 'Schema 151 should ship permission-test definitions.');

add('operations-live-queues', containsAll(cockpit, ['oc_payment_queue','oc_bank_queue','oc_recon_queue','oc_equipment_queue','oc_asset_queue','oc_route_queue','oc_quote_queue','oc_portal_queue','data-oc-action']), 'Cockpit should render all live queue targets and row actions.');
add('operations-rpc-posting', containsAll(operations, ['ywi_rpc_post_payment_action','ywi_rpc_promote_bank_csv_import','ywi_rpc_apply_reconciliation_action','callRpc']), 'Operations function should delegate risky multi-row writes to RPCs.');
add('operations-equipment-resolution-recovery', containsAll(operations, ['resolveEquipment','equipment_service_tasks','equipment_cost_recovery_actions','financial_event_id','equipment_cost_recovery_decision']), 'Equipment flow should resolve codes and create service/recovery records.');
add('operations-quote-owner-alert-history', containsAll(operations, ['quote_owner_assign','quote_contact_request_events','quote_followup_alerts','createAdminNotification','sendEmailIfConfigured']), 'Quote flow should provide owner, history, in-app alert, and optional email delivery.');
add('operations-dispatch-job-cost', containsAll(operations, ['dispatch_schedule_items','job_cost_live_snapshots','dispatch_schedule','job_cost_refresh']), 'Dispatch and live job-cost actions should exist.');

add('browser-image-optimization', containsAll(cockpit, ['createImageBitmap','canvas.toBlob','thumbnailFile','uploadPublicAsset']), 'Browser should generate optimized display and thumbnail files.');
add('server-image-verification', containsAll(upload, ['imageDimensions','Submitted image dimensions do not match','SHA-256','public-assets','checksum_sha256']), 'Upload function should independently verify dimensions and checksum before registration.');
add('asset-approval-publication-gate', containsAll(operations, ['visual_asset_decision','publication_ready','Route publication is blocked until SEO fields and an approved visual are ready']), 'Approved visual should gate route publication.');

add('public-route-generator', containsAll(generator, ['PUBLIC_CONTENT_ENDPOINT','exactly one H1','application/ld+json','sitemap.xml','Unsafe route path']), 'Generator should consume approved content and create guarded HTML/sitemap output.');
add('public-route-reserved-url-guards', containsAll(operations, ['RESERVED_PUBLIC_ROUTE_ROOTS','safePublicPath','safeHttpUrl','canonical_ok']) && containsAll(generator, ['reservedRoots','routeRoot']) && containsAll(publicScript, ['reservedRoots','safeUrl','safeCta']), 'Route records, runtime rendering, and static generation should block reserved paths and unsafe URLs.');
add('public-route-function-approved-only', containsAll(publicFunction, ["eq('route_status','approved')","not('published_at','is',null)","eq('asset_status','approved')"]), 'Public content function should expose only approved/published routes and approved visuals.');
add('portal-accept-deposit-rpc', containsAll(portalFunction, ['accept_quote','create_deposit_checkout','ywi_rpc_accept_quote_package','ywi_rpc_prepare_deposit_request','ywi_rpc_attach_deposit_checkout','request_service']), 'Customer portal should delegate acceptance and deposit checkout to RPCs.');
add('stripe-webhook-rpc-paid-status', containsAll(stripeFunction, ['STRIPE_WEBHOOK_SECRET','crypto.subtle','checkout.session.completed','paymentSucceeded','validateSession','ywi_rpc_record_portal_deposit_paid','ywi_rpc_mark_deposit_checkout_status']), 'Stripe webhook should verify signatures and delegate paid/status updates to RPCs.');
add('function-jwt-settings', containsAll(config, ['[functions.customer-portal]','[functions.public-content]','[functions.stripe-webhook]','[functions.upload-public-asset]','[functions.operations-manage]']) && /\[functions\.customer-portal\]\s+verify_jwt = false/s.test(config) && /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config), 'Public/webhook functions and protected functions should have explicit JWT settings.');
add('api-wiring', containsAll(api, ['manageOperations','customerPortal','fetchPublicContent','uploadPublicAsset']), 'Central API client should expose endpoints.');
add('rpc-integration-script', containsAll(rpcTest, ['operations-rpc-integration-test','SUPABASE_URL','v_operation_rpc_permission_matrix','exact-cent']) || containsAll(rpcTest, ['SUPABASE_URL','v_operation_rpc_permission_matrix','exact-cent']), 'RPC integration/static test script should exist.');

const jsFiles = ['js/api.js','js/operations-cockpit.js','js/customer-portal.js','js/public-routes.js','scripts/generate-public-routes.mjs','scripts/operations-rpc-integration-test.mjs','app.js','server-worker.js'];
for (const file of jsFiles) {
  const run = spawnSync(process.execPath, ['--check', file], { cwd:root, encoding:'utf8' });
  add(`syntax:${file}`, run.status === 0, run.status === 0 ? 'Syntax OK.' : (run.stderr || run.stdout).trim());
}

let ts;
try {
  const require = createRequire(import.meta.url);
  try { ts = require('typescript'); }
  catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
} catch (error) {
  add('typescript-compiler-available', false, String(error));
}
if (ts) {
  const tsFiles = [
    'supabase/functions/operations-manage/index.ts','supabase/functions/upload-public-asset/index.ts',
    'supabase/functions/customer-portal/index.ts','supabase/functions/public-content/index.ts','supabase/functions/stripe-webhook/index.ts'
  ];
  for (const file of tsFiles) {
    const output = ts.transpileModule(read(file), { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true, fileName:file });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
}

const rpcStatic = spawnSync(process.execPath, ['scripts/operations-rpc-integration-test.mjs'], { cwd:root, encoding:'utf8' });
add('rpc-static-test-script-passes', rpcStatic.status === 0, rpcStatic.status === 0 ? 'Static RPC wiring checks passed.' : (rpcStatic.stderr || rpcStatic.stdout).trim());

const passed = results.filter((item) => item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(failed ? 1 : 0);
