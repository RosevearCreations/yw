#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/197_staging_environment_guard.sql');
const endpoint=read('supabase/functions/admin-staging-acceptance/index.ts');
const ui=read('js/staging-acceptance-ui.js');
const browser=read('tests/browser/staging-acceptance.spec.mjs');
const packageJson=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const runner=read('scripts/operations-rpc-staging-e2e.mjs');
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
add('schema197-marker',migration.includes('197::int as expected_schema_version') && migration.includes("197,'197_staging_environment_guard'"));

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
add('endpoint-mutation-guard-before-actions',/if \(action === 'status'\)[\s\S]*assertStagingMutationAllowed\(environmentGuard\);[\s\S]*if \(action === 'record_case'\)/.test(endpoint));
add('endpoint-status-remains-readable',all(endpoint,[
  'environment_guard:environmentGuard',
  'staging_mutation_allowed:environmentGuard?.mutation_allowed === true',
  'known_production_runtime:environmentGuard?.known_production === true'
]));
add('endpoint-environment-assertions',all(endpoint,[
  "supabase.rpc('ywi_staging_environment_guard_assertions')",
  'environment_assertions:environmentRows'
]));

add('ui-lock-state',all(ui,[
  'Environment mutation guard:',
  'mutation_allowed===true',
  'Status/catalog reads remain available. Pass/Fail, Finalize, and Signoff controls stay hidden while locked.'
]));
add('ui-controls-require-guard',all(ui,[
  'const canRecord=writesAllowed',
  'const canFinalize=writesAllowed',
  'const canSign=writesAllowed'
]));
add('ui-failed-load-locks',all(ui,[
  "mutation_allowed:false",
  'mutation remains locked.'
]));

add('browser-staging-enabled-proof',all(browser,[
  'Environment mutation guard: ENABLED',
  "expect(actions).toEqual(['status','record_case','finalize','signoff'])"
]));
add('browser-production-lock-proof',all(browser,[
  'phone Production runtime stays readable but hides all staging mutation controls',
  'Environment mutation guard: LOCKED',
  "expect(actions).toEqual(['status'])"
]));

add('runner-production-refusal-preserved',all(runner,[
  "'jmqvkgiqlimdhcofwkxr'",
  'actualProjectRef === productionRef',
  'Refusing Schema 187 staging acceptance against the YardWeasels Production project ref.'
]));
add('package-gate-wired',packageJson.includes('"test:staging-environment-guard": "node scripts/staging-environment-guard-check.mjs"'));
add('workflow-gate-wired',workflow.includes('npm run test:staging-environment-guard'));
add('help-current',all(help,[
  'staging mutation guard',
  'YWI_RUNTIME_ENVIRONMENT',
  'YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED'
]));
add('durable-docs-current',[readme,handbook,nextSteps].every((text)=>text.includes('staging acceptance mutation')));
add('active-docs-no-build-ledger',![readme,handbook,nextSteps].some((text)=>/Build\s+197|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} staging environment guard checks passed.`);
if(failed.length)process.exit(1);
