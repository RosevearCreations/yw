#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const live = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const proof = read('sql/157_service_execution_proof_cost_capture.sql');
const closeout = read('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql');
const ops = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customer = read('js/customer-portal.js');
const css = read('style.css');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const pkg = JSON.parse(read('package.json'));
const help = read('help.html');
const readme = read('README.md');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok) => checks.push([name, !!ok]);

const schemaFiles = fs.readdirSync('sql').filter((name) => /^\d{3}_.+\.sql$/i.test(name));
const schemaVersions = schemaFiles.map((name) => Number(name.slice(0, 3))).filter(Number.isFinite);
const repoLatestSchema = Math.max(...schemaVersions);
const currentSchemaFile = schemaFiles.find((name) => Number(name.slice(0, 3)) === repoLatestSchema) || '';
const currentSchema = currentSchemaFile ? read(`sql/${currentSchemaFile}`) : '';
const markerPattern = new RegExp(`\\b${repoLatestSchema}(?:::int)?\\s+as\\s+expected_schema_version\\b`, 'i');

add('historical-live-update-authority', all(live,[
  'work_order_live_updates','work_order_live_update_media','v_customer_portal_live_updates',
  'ywi_rpc_create_work_order_live_update','ywi_rpc_retract_work_order_live_update',
  'Customer-visible updates require supervisor or higher.'
]));
add('historical-execution-proof-authority', all(proof,[
  'work_order_execution_proofs','v_work_order_execution_proof_queue','v_work_order_execution_cost_dashboard',
  'v_customer_portal_execution_proofs','ywi_rpc_submit_work_order_execution_proof',
  'ywi_rpc_decide_work_order_execution_proof','Customer portal never receives internal cost fields.'
]));
add('historical-closeout-authority', all(closeout,[
  'work_order_closeout_packages','work_order_customer_closeout_signoffs','work_order_review_requests',
  'work_order_maintenance_followups','v_customer_portal_closeout_packages',
  'ywi_rpc_submit_work_order_closeout_package','ywi_rpc_decide_work_order_closeout_package',
  'ywi_rpc_customer_sign_work_order_closeout','Customer signoff is required before invoice readiness.'
]));
add('operations-runtime-wires-entire-lifecycle', all(ops,[
  "action === 'work_order_live_update_create'","action === 'work_order_live_update_retract'",
  "action === 'work_order_execution_proof_submit'","action === 'work_order_execution_proof_decision'",
  "action === 'work_order_closeout_submit'","action === 'work_order_closeout_decision'",
  "live_updates: 'v_work_order_live_update_queue'","execution_proofs: 'v_work_order_execution_proof_queue'",
  "execution_costs: 'v_work_order_execution_cost_dashboard'","closeouts: 'v_work_order_closeout_queue'"
]));
add('customer-runtime-wires-safe-lifecycle', all(portal,[
  'v_customer_portal_live_updates','v_customer_portal_execution_proofs','v_customer_portal_closeout_packages',
  'live_updates: liveUpdates','execution_proofs: executionProofs','closeouts,',
  "action === 'sign_closeout'",'ywi_rpc_customer_sign_work_order_closeout'
]));
add('staff-ui-wires-lifecycle', all(cockpit,[
  'renderLiveUpdateQueue','oc_live_update_form','job-update-retract',
  'renderExecutionProofQueue','oc_execution_proof_form','execution-proof-approve',
  'renderCloseoutQueue','oc_closeout_form','closeout-approve','closeout-invoice'
]));
add('customer-ui-wires-lifecycle-and-privacy', all(customer,[
  'liveUpdateTimeline','executionProofTimeline','closeoutPackagePanel','Approve completed work',
  'Staff-only notes, private review images, and internal costing are never shown here.',
  'Labour, material, equipment, and margin data stay internal.',
  'Internal labour, material, equipment, margin, staff notes, and private review images are never shown in this customer portal.'
]));
add('responsive-lifecycle-css', all(css,[
  '.operations-cockpit .oc-live-update-card','.oc-execution-proof-card','.operations-cockpit .oc-closeout-card',
  '.customer-portal-updates','.customer-portal-proofs','.customer-portal-closeout','@media(max-width:620px)'
]));
add('current-schema-authority-separate-from-feature-history', Number.isInteger(repoLatestSchema) && repoLatestSchema >= 201 && markerPattern.test(currentSchema));
add('lifecycle-source-tests-present',
  pkg.scripts?.['test:live-updates'] === 'node scripts/live-work-updates-check.mjs' &&
  pkg.scripts?.['test:execution-proof'] === 'node scripts/service-execution-proof-check.mjs' &&
  pkg.scripts?.['test:closeout'] === 'node scripts/supervisor-closeout-check.mjs' &&
  pkg.scripts?.['test:job-lifecycle'] === 'node scripts/job-lifecycle-enforcement-check.mjs');
add('lifecycle-browser-test-present', pkg.scripts?.['test:browser:job-lifecycle'] === 'playwright test --config=playwright.config.mjs tests/browser/job-lifecycle.spec.mjs');
add('workflow-runs-lifecycle-before-browser', all(workflow,[
  'npm run test:live-updates','npm run test:execution-proof','npm run test:closeout','npm run test:job-lifecycle',
  'npm run test:browser:job-lifecycle'
]));
add('durable-help-lifecycle-guidance', all(help,[
  'Job lifecycle','Live update','Execution proof','Closeout','customer-safe','internal costs'
]));
add('active-docs-lifecycle-contract', [readme,handbook,nextSteps].every((text) => all(text,[
  'live update','execution proof','closeout'
])));
add('active-docs-no-build-ledger', ![readme,handbook,nextSteps].some((text) => /Build\s+206|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));
add('no-finance-provider-enablement', ![live,proof,closeout].some((text) => /execution_enabled\s*=\s*true|provider_mutation_enabled\s*=\s*true/i.test(text)));

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} job lifecycle enforcement checks passed. Repository schema ${repoLatestSchema}.`);
if (failed.length) process.exit(1);
