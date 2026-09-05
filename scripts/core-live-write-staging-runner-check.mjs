#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('sql/201_core_live_write_staging_runner_authority.sql');
const catalog = read('sql/187_staging_acceptance_scenario_catalog.sql');
const runner = read('scripts/operations-rpc-staging-e2e.mjs');
const quote = read('supabase/functions/quote-contact-submit/index.ts');
const config = read('supabase/config.toml');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const pkg = JSON.parse(read('package.json'));
const help = read('help.html');
const readme = read('README.md');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok) => checks.push([name, !!ok]);

const quoteRunnerCases = [
  'quote_invalid_payload_rejected',
  'quote_submission_creates_request',
  'quote_created_event_recorded',
  'quote_fixture_cleanup'
];

add('schema201-transaction-balanced', (migration.match(/^begin;$/gmi)||[]).length===1 && (migration.match(/^commit;$/gmi)||[]).length===1);
add('schema201-four-quote-runner-cases', quoteRunnerCases.every((key) => migration.includes(`'${key}'`)) && all(migration,[
  "verification_mode = 'runner'", "rail_key='quote_intake_live'", "'automation_owner','current_schema_staging_runner'"
]));
add('schema201-human-review-preserved', all(migration,[
  "'quote_human_acceptance_review'", "'manual','human',true", "'human_signoff_required',true"
]));
add('operations-write-remains-human', all(catalog,[
  "'operations_cockpit_write_form_roundtrip'", "'manual','human',true"
]) && !/operations_cockpit_write_form_roundtrip[\s\S]{0,300}verification_mode\s*=\s*'runner'/i.test(migration));
add('schema201-does-not-write-quote-business-rows', !/\b(?:insert\s+into|update|delete\s+from)\s+public\.quote_contact_(?:requests|request_events)\b/i.test(migration));
add('schema201-no-finance-provider-mutation', !/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:finance_job_completion_posting_execution_controls|payment_|stripe|paypal|ar_|ap_|gl_journal)/i.test(migration));
add('schema201-assertions-service-private', all(migration,[
  'ywi_core_live_write_staging_runner_assertions',
  'quote_runner_exact_four_cases','quote_human_review_preserved','operations_write_remains_human',
  'open_business_acceptance_unchanged','finance_provider_execution_off','scenario_catalog_service_private',
  'revoke all on function public.ywi_core_live_write_staging_runner_assertions() from public,anon,authenticated',
  'grant execute on function public.ywi_core_live_write_staging_runner_assertions() to service_role'
]));
add('schema201-exact-drift-marker', all(migration,[
  '201 as expected_schema_version', "=201 then 'current'", ">201 then 'ahead'",
  'grant select on table public.v_schema_drift_status to service_role'
]));
add('runner-production-and-schema-guard', all(runner,[
  "'jmqvkgiqlimdhcofwkxr'", 'YWI_STAGING_PROJECT_REF',
  'Refusing current-schema staging acceptance against the YardWeasels Production project ref.',
  'Dedicated staging database must exactly match repository Schema'
]));
add('runner-public-quote-contract', all(runner,[
  'YWI_STAGING_PUBLIC_KEY','publicFunctionCall','quote-contact-submit',
  "headers:{ apikey:publicKey, 'Content-Type':'application/json' }"
]));
add('runner-invalid-payload-proves-no-row', all(runner,[
  "liveCase('quote_invalid_payload_rejected'", 'privacy_consent:false',
  'Expected public quote HTTP 400 for missing consent', 'Invalid quote payload created a business row.'
]));
add('runner-valid-labelled-request', all(runner,[
  "liveCase('quote_submission_creates_request'", '@example.invalid',
  "page_path:'/staging-acceptance'", 'Expected one new public staging quote request',
  'Persisted quote row did not match the disposable staging label'
]));
add('runner-event-and-single-row-proof', all(runner,[
  "liveCase('quote_created_event_recorded'", 'event_type=eq.created',
  'Expected exactly one matching created event', 'Expected exactly one labelled staging quote row'
]));
add('runner-safe-cleanup-and-emergency-cleanup', all(runner,[
  'cleanupQuoteAcceptanceRequest',
  'Refusing quote cleanup because the exact row is not a labelled disposable staging fixture',
  "liveCase('quote_fixture_cleanup'", 'quoteAcceptance.cleaned!==true'
]));
add('runner-never-finalizes-or-signs-off', !runner.includes("rpc('ywi_rpc_finalize_staging_acceptance_run'") && !runner.includes("rpc('ywi_rpc_signoff_staging_acceptance_run'") && runner.includes('record every pending human catalog case'));
add('quote-public-function-source-contract', all(quote,[
  'privacy_consent','Spam protection blocked this submission.','duplicate_fingerprint',
  "request_source: 'public_website'",'quote_contact_request_events'
]));
add('quote-function-explicit-public-config', /\[functions\.quote-contact-submit\]\s*\nverify_jwt = false/.test(config));
add('workflow-quote-public-key-and-source-gate', all(workflow,[
  'YWI_STAGING_PUBLIC_KEY','secrets.YWI_STAGING_PUBLIC_KEY','npm run test:core-live-write-staging'
]));
add('package-source-gate', pkg.scripts?.['test:core-live-write-staging'] === 'node scripts/core-live-write-staging-runner-check.mjs');
add('help-current', all(help,['Quote/contact staging runner','uniquely labelled STAGING request','human review/signoff']));
add('durable-docs-current', [readme,handbook,nextSteps].every((text) => all(text,[
  'quote/contact','dedicated non-production','human review'
])));
add('active-docs-no-build-ledger', ![readme,handbook,nextSteps].some((text) => /Build\s+205|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length-failed.length}/${checks.length} core live-write staging runner checks passed.`);
if (failed.length) process.exit(1);
