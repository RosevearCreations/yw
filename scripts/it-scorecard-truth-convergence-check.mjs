#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/184_it_scorecard_truth_convergence.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const ui=read('js/it-readiness-ui.js');
const browser=read('tests/browser/it-scorecard-truth.spec.mjs');
const packageJson=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const repo=read('scripts/repo-smoke-check.mjs');
const docs=[read('README.md'),read('docs/ACTIVE_PROJECT_HANDBOOK.md'),read('docs/NEXT_STEPS_AND_SANITY_CHECK.md')];

const results=[];
const add=(name,ok,details='')=>results.push({name,ok:!!ok,details});
const hasAll=(text,values)=>values.every((value)=>text.includes(value));

add('schema184-migration-present',fs.existsSync('sql/184_it_scorecard_truth_convergence.sql'));
add('schema184-transaction-balanced',(migration.match(/\bbegin;/gi)||[]).length===1&&(migration.match(/\bcommit;/gi)||[]).length===1);
add('schema184-private-resolution-contracts',hasAll(migration,[
  'it_scorecard_rail_resolution_contracts','enable row level security',
  'revoke all on table public.it_scorecard_rail_resolution_contracts from public,anon,authenticated;',
  'grant select on table public.it_scorecard_rail_resolution_contracts to service_role;'
]));
add('schema184-private-immutable-evidence',hasAll(migration,[
  'it_scorecard_rail_completion_evidence','trg_guard_it_scorecard_completion_evidence_immutable',
  'I.T. scorecard completion evidence is immutable','revoke all on table public.it_scorecard_rail_completion_evidence from public,anon,authenticated;'
]));
add('schema184-private-truth-views',hasAll(migration,[
  'v_it_scorecard_progress_truth','v_it_scorecard_progress_truth_status','with (security_invoker=true)',
  'revoke all on table public.v_it_scorecard_progress_truth from public,anon,authenticated;',
  'revoke all on table public.v_it_scorecard_progress_truth_status from public,anon,authenticated;'
]));

const autoCloseRows=[...migration.matchAll(/\('([^']+)'\s*,\s*'verified_complete'\s*,\s*false\s*,\s*false\s*,\s*true\s*,/g)].map((m)=>m[1]).sort();
add('schema184-auto-close-exactly-three',JSON.stringify(autoCloseRows)===JSON.stringify(['schema159_module_permissions','schema160_it_readiness','schema164_cross_module_boundaries']),`Auto-close rails: ${autoCloseRows.join(', ')}`);
add('schema184-human-external-auto-close-prohibited',migration.includes('check (not auto_close_allowed or (requires_human is false and requires_external is false))'));
add('schema184-only-three-rails-updated-complete',hasAll(migration,[
  "where r.rail_key in ('schema159_module_permissions','schema160_it_readiness','schema164_cross_module_boundaries')",
  "rail_status='complete'","progress_percent=100"
])&&!/where\s+r\.rail_key\s+not\s+in/i.test(migration));
add('schema184-current-proof-fail-closed',hasAll(migration,[
  'ywi_module_security_assertions','ywi_module_acceptance_security_assertions','ywi_it_readiness_security_assertions',
  'ywi_module_write_boundary_security_assertions','ywi_cross_module_boundary_security_assertions',
  'ywi_cross_module_event_wiring_assertions','v_admin_module_access_integrity',
  'Schema 159 historical rail cannot close','Schema 160 historical rail cannot close','Schema 164 historical rail cannot close'
]));
add('schema184-classifies-real-open-work',hasAll(migration,[
  "'operations_cockpit_live','staging_acceptance'","'quote_intake_live','staging_acceptance'",
  "'payment_actions_live','accounting_acceptance'","'bank_csv_preview_live','accounting_acceptance'",
  "'equipment_scan_custody_live','feature_followup'","'route_asset_approval_live','content_approval'",
  "'customer_portal_live','provider_acceptance'","'live_job_updates','staging_acceptance'",
  "'customer_live_update_notifications','staging_acceptance'","'service_execution_proof_costing','staging_acceptance'",
  "'supervisor_closeout_signoff_invoice_followup','staging_acceptance'","'approved_route_generation','content_approval'"
]));
add('schema184-assertions-present',hasAll(migration,[
  'ywi_it_scorecard_truth_assertions','it_scorecard_truth_open_rails_classified',
  'it_scorecard_truth_historical_rails_evidence_closed','it_scorecard_truth_auto_close_bounded',
  'it_scorecard_truth_evidence_immutable','it_scorecard_truth_execution_provider_off'
]));
add('schema184-marker-registry-dependencies',hasAll(migration,[
  '184::int as expected_schema_version',"184,'184_it_scorecard_truth_convergence'",
  "'it_scorecard_truth_convergence'","'it_scorecard_truth_rail_status'",
  "'it_scorecard_truth_progress_percent'","'it_scorecard_truth_metadata'"
]));
add('schema184-no-business-accounting-jobs-mutation',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:jobs|work_orders|clients|client_sites|ar_invoices|gl_journal_batches|gl_journal_entries|job_invoice_postings|job_journal_postings|accountant_export_mapping_rules|chart_of_accounts|payment_action_requests|bank_csv_import_previews|quote_contact_requests)\b/i.test(migration));
add('schema184-no-mapping-approval',!/set\s+review_status\s*=\s*['"]approved['"]/i.test(migration)&&!/ywi_finance_review_account_mapping\s*\(/i.test(migration));
add('schema184-execution-provider-off',!/execution_enabled\s*=\s*true/i.test(migration)&&!/provider_mutation_enabled\s*=\s*true/i.test(migration));
add('schema184-no-production-promotion',!/production_promotion['"]?\s*[:=]\s*true/i.test(migration));

add('endpoint-scorecard-truth-source',hasAll(endpoint,[
  'v_it_scorecard_progress_truth','v_it_scorecard_progress_truth_status','ywi_it_scorecard_truth_assertions',
  'scorecard_truth_status','scorecard_unclassified_open_count','scorecard_human_pending_count','scorecard_external_pending_count'
]));
add('endpoint-admin-only-authority',hasAll(endpoint,['normalizedRole(actorProfile.role) !== "admin"','Admin role is required for I.T. controls.']));
add('endpoint-no-scorecard-mutation-action',!/(?:complete|close|resolve)_scorecard/i.test(endpoint)&&!endpoint.includes('ywi_set_scorecard')&&!endpoint.includes('.from("admin_scorecard_progress_rails")'));
add('endpoint-no-new-business-write',!/(?:from|rpc)\(["'](?:jobs|work_orders|ar_invoices|gl_journal_batches|payment_action_requests)["']/i.test(endpoint));

add('ui-scorecard-truth-rendered',hasAll(ui,[
  "panel('scorecard_truth_status'","panel('scorecard_truth'",'scorecard_truth_status',
  'scorecard_unclassified_open_count','scorecard_human_pending_count','scorecard_external_pending_count',
  'requires_human','requires_external','resolution_class'
]));
add('ui-admin-only',ui.includes("if(!isAdmin())")&&ui.includes('Admin manage access is required for I.T. Readiness.'));
add('ui-no-scorecard-completion-control',!/(?:complete|close|resolve)\s+(?:rail|scorecard)/i.test(ui)&&!ui.includes("action:'complete"));
add('browser-scorecard-truth-rendered',hasAll(browser,[
  "provider_acceptance_pending","content_approval_pending","feature_followup_pending",
  "human · external · provider acceptance","getByRole('button',{name:/complete/i}).count()",
  "non-admin cannot render the I.T. scorecard truth workspace"
]));
add('browser-nonpersistent',!/(?:fetch\(|supabase|payment_intent|paypal_order|execute_sql|insert\s+into)/i.test(browser));

add('package-source-gate',packageJson.scripts?.['test:it-scorecard-truth']==='node scripts/it-scorecard-truth-convergence-check.mjs');
add('package-browser-gate',packageJson.scripts?.['test:browser:it']==='playwright test --config=playwright.config.mjs tests/browser/it-scorecard-truth.spec.mjs');
add('workflow-source-gate',workflow.includes('npm run test:it-scorecard-truth'));
add('workflow-browser-gate',workflow.includes('npm run test:browser:it'));
add('repo-smoke-compatible',hasAll(repo,['active-markdown-exactly-three','docs-four-module-boundary','docs-manual-production','schema183-migration-present']));
add('docs-schema184-active',docs.every((text)=>text.includes('Schema 184')&&text.includes('Build 184')&&/(ACTIVE|source review)/i.test(text)));
add('docs-build183-clean-authority',docs.every((text)=>text.includes('2f4e4fa25299dd285718c2bb78cc40fc05c55ebf')&&text.includes('33697274220')));
add('docs-human-external-boundary',docs.every((text)=>/human/i.test(text)&&/(provider|external)/i.test(text)&&/(not auto|does not auto|remain open)/i.test(text)));
add('docs-production-manual',docs.every((text)=>/Production/i.test(text)&&/manual/i.test(text)));

const passed=results.filter((item)=>item.ok).length;
console.log(`\nSchema 184 I.T. scorecard truth source gate: ${passed}/${results.length} passed\n`);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`);
process.exit(results.some((item)=>!item.ok)?1:0);
