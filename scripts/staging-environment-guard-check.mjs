#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/197_staging_environment_guard.sql');
const endpoint=read('supabase/functions/admin-staging-acceptance/index.ts');
const ui=read('js/staging-acceptance-ui.js');
const browser=read('tests/browser/staging-acceptance.spec.mjs');
const infrastructureBrowser=read('tests/browser/staging-infrastructure-readiness.spec.mjs');
const packageJson=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const helpLower=help.toLowerCase();
const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const runnerEntry=read('scripts/operations-rpc-staging-e2e.mjs');
const runner=read('scripts/operations-rpc-staging-e2e-core.mjs');
const runnerAuthorityPreflight=read('scripts/staging-runtime-authority-preflight.mjs');
const fixtures=read('scripts/staging-fixtures.mjs');
const all=(text,values)=>values.every((value)=>text.includes(value));
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});

add('schema197-authority-table',all(migration,[
  'it_runtime_environment_authorities',
  "'jmqvkgiqlimdhcofwkxr','production',false",
  'staging_acceptance_mutation_allowed'
]));
add('schema197-assertions',all(migration,[
  'ywi_staging_environment_guard_assertions',
  'production_project_registered_fail_closed',
  'open_business_acceptance_unchanged',
  'staging_rails_remain_human_gated',
  'finance_provider_execution_off'
]));
add('schema197-business-safety',all(migration,[
  "'business_rail_auto_close',false",
  "'staging_acceptance_execution',false",
  "'production_mutation',false",
  "'finance_mutation',false",
  "'payment_provider_mutation',false"
]));
add('schema197-marker',
  migration.includes('197::int as expected_schema_version') &&
  /values\s*\(\s*197\s*,\s*'197_staging_environment_guard'\s*,\s*'197_staging_environment_guard\.sql'/i.test(migration)
);

add('endpoint-production-hard-deny',all(endpoint,[
  "const KNOWN_PRODUCTION_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr'",
  'knownProduction',
  'Production project authority permanently denies staging-acceptance mutation.'
]));
add('endpoint-three-part-staging-enable',all(endpoint,[
  "runtimeEnvironment === 'staging'",
  'YWI_STAGING_PROJECT_REF',
  'YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED',
  'exactRefMatch',
  'mutationAllowed'
]));
add('endpoint-explicit-registry-allow-only',all(endpoint,[
  "registeredAuthority?.environment_class === 'staging'",
  'registeredAuthority?.staging_acceptance_mutation_allowed === true',
  'registered_authority_present:Boolean(registeredAuthority)',
  'Runtime environment authority is not registered for this project; explicit staging registration is required.',
  'Production and unregistered runtimes are always denied.'
]));
add('endpoint-runtime-registry-status-assertion',all(endpoint,[
  "assertion_key:'runtime_project_registered_explicit_staging_allow'",
  'registryExplicitlyAllows',
  'missing or unknown registration is denied.'
]));
add('endpoint-mutation-guard-before-actions',/if \(action === 'status'\)[\s\S]*assertStagingMutationAllowed\(environmentGuard\);[\s\S]*assertCurrentRuntimeSchema\(schemaAuthority\);[\s\S]*if \(action === 'record_case'\)/.test(endpoint));
add('endpoint-status-remains-readable',all(endpoint,[
  'environment_guard:environmentGuard',
  'staging_mutation_allowed:environmentGuard?.mutation_allowed === true && schemaAuthority.exact_schema_match === true',
  'known_production_runtime:environmentGuard?.known_production === true'
]));
add('endpoint-environment-assertions',all(endpoint,[
  "supabase.rpc('ywi_staging_environment_guard_assertions')",
  'environment_assertions:environmentRows'
]));

add('ui-lock-state',all(ui,[
  'Environment mutation guard:',
  'environmentGuard().mutation_allowed===true && schemaCurrent()',
  'Status/catalog reads remain available. Pass/Fail, Finalize, and Signoff controls stay hidden while locked.'
]));
add('ui-explicit-registry-readiness-row',all(ui,[
  'Runtime registry permission',
  'registered_authority_present===true',
  "registered_environment_class==='staging'",
  'registered_mutation_allowed===true',
  'missing or unknown registration is denied.'
]));
add('ui-controls-require-composed-guard',all(ui,[
  'const canRecord=writesAllowed',
  'const canFinalize=writesAllowed',
  'const canSign=writesAllowed',
  'function schemaCurrent(){return schemaAuthority().exact_schema_match===true;}'
]));
add('ui-failed-load-locks',all(ui,[
  "mutation_allowed:false",
  'exact_schema_match:false',
  'mutation remains locked.'
]));

add('browser-staging-enabled-proof',all(browser,[
  'Environment mutation guard: ENABLED',
  'Runtime schema authority: CURRENT',
  "expect(actions).toEqual(['status','record_case','finalize','signoff'])"
]));
add('browser-production-lock-proof',all(browser,[
  'phone Production runtime stays readable but hides all staging mutation controls',
  'Environment mutation guard: LOCKED',
  "expect(actions).toEqual(['status'])"
]));
add('browser-schema-mismatch-lock-proof',all(browser,[
  'staging environment with schema mismatch stays readable and hides all mutation controls',
  'Runtime schema authority: MISMATCH'
]));
add('browser-unregistered-runtime-lock-proof',all(infrastructureBrowser,[
  "test('unregistered staging project stays locked even when runtime label ref and flag are ready'",
  "registered_authority_present:false",
  'Runtime environment authority is not registered for this project; explicit staging registration is required.',
  "expect(actions).toEqual(['status'])"
]));

add('runner-entrypoint-embedded-authority-guard',all(runnerEntry,[
  "import { verifyRuntimeAuthority } from './staging-runtime-authority-preflight.mjs';",
  'const authority = await verifyRuntimeAuthority(process.env, fetch);',
  'STAGING RUNTIME AUTHORITY: LOCKED',
  "await import('./operations-rpc-staging-e2e-core.mjs');"
]) && runnerEntry.indexOf('await verifyRuntimeAuthority') < runnerEntry.indexOf("await import('./operations-rpc-staging-e2e-core.mjs')"));
add('runner-production-refusal-preserved',all(runner,[
  "'jmqvkgiqlimdhcofwkxr'",
  'actualProjectRef === productionRef',
  'Refusing current-schema staging acceptance against the YardWeasels Production project ref.'
]));
add('runner-exact-schema-boundary',all(runner,[
  'repoLatestSchema','expectedSchema !== repoLatestSchema','latestAppliedSchema !== repoLatestSchema',
  'Dedicated staging database must exactly match repository Schema'
]));
add('runner-runtime-authority-explicit-allow-only',all(runnerAuthorityPreflight,[
  'it_runtime_environment_authorities',
  "environmentClass!=='staging'",
  'staging_acceptance_mutation_allowed===true',
  'Runtime environment authority is not registered for this project; explicit staging registration is required.',
  "method:'GET'"
]));
add('runner-runtime-authority-before-live-runner',
  packageJson.includes('"test:staging": "node scripts/staging-runtime-authority-preflight.mjs && node scripts/operations-rpc-staging-e2e.mjs"')
);

add('fixture-script-explicit-runtime-authority',all(fixtures,[
  "import {\n  KNOWN_PRODUCTION_PROJECT_REF,\n  projectRefFromSupabaseUrl,\n  verifyRuntimeAuthority,",
  "YWI_RUN_STAGING_RPC_TESTS:'1'",
  'const authority = await verifyRuntimeAuthority(',
  "authority.environment_class !== 'staging'",
  'authority.staging_acceptance_mutation_allowed !== true',
  'Explicit staging runtime authority is required before fixture mutation.'
]));
add('fixture-script-authority-before-any-fixture-rpc',
  fixtures.indexOf('const authority = await verifyRuntimeAuthority') >= 0 &&
  fixtures.indexOf('const authority = await verifyRuntimeAuthority') < fixtures.indexOf("rpc('ywi_rpc_create_staging_fixture_set'") &&
  fixtures.indexOf('const authority = await verifyRuntimeAuthority') < fixtures.indexOf("rpc('ywi_rpc_cleanup_staging_fixture_set'")
);
add('fixture-script-exact-current-schema-boundary',all(fixtures,[
  "v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status",
  "schema.drift_status !== 'current'",
  'expectedSchema !== repoLatestSchema',
  'latestAppliedSchema !== repoLatestSchema',
  'Dedicated staging database must exactly match repository Schema',
  'STAGING SCHEMA AUTHORITY: CURRENT'
]));
add('fixture-script-schema-before-any-fixture-rpc',
  fixtures.indexOf("v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status") >= 0 &&
  fixtures.indexOf("v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status") < fixtures.indexOf("rpc('ywi_rpc_create_staging_fixture_set'") &&
  fixtures.indexOf("v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status") < fixtures.indexOf("rpc('ywi_rpc_cleanup_staging_fixture_set'")
);
add('fixture-script-production-refusal-preserved',all(fixtures,[
  'KNOWN_PRODUCTION_PROJECT_REF',
  'actualProjectRef === productionRef || actualProjectRef === KNOWN_PRODUCTION_PROJECT_REF',
  'Refusing staging fixture mutation against the YardWeasels Production project ref.'
]));

add('package-gate-wired',
  packageJson.includes('"test:staging-environment-guard": "node scripts/staging-environment-guard-check.mjs && node scripts/staging-runtime-authority-preflight-check.mjs"')
);
add('workflow-gate-wired',workflow.includes('npm run test:staging-environment-guard'));
add('help-current',
  helpLower.includes('staging mutation guard') &&
  help.includes('YWI_RUNTIME_ENVIRONMENT') &&
  help.includes('YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED') &&
  help.includes('Exact current-schema parity is a second independent lock.')
);
add('durable-docs-current',[readme,handbook,nextSteps].every((text)=>text.includes('staging acceptance mutation')));
add('active-docs-no-build-ledger',![readme,handbook,nextSteps].some((text)=>/Build\s+197|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} staging environment guard checks passed.`);
if(failed.length)process.exit(1);
