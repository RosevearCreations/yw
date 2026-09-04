#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const endpoint=read('supabase/functions/admin-staging-acceptance/index.ts');
const ui=read('js/staging-acceptance-ui.js');
const browser=read('tests/browser/staging-acceptance.spec.mjs');
const runner=read('scripts/operations-rpc-staging-e2e.mjs');
const help=read('help.html');
const packageJson=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const all=(text,values)=>values.every((value)=>text.includes(value));
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});

add('endpoint-no-stale-hardcoded-schema',!endpoint.includes('const SCHEMA = 197;')&&endpoint.includes('const MINIMUM_SCHEMA = 197;'));
add('endpoint-reads-schema-authority',all(endpoint,[
  'runtimeSchemaAuthority','v_schema_drift_status','expected_schema_version','latest_applied_schema_version','exact_schema_match'
]));
add('endpoint-exact-schema-definition',all(endpoint,[
  "driftStatus === 'current'",'latestSchema === expectedSchema','expectedSchema >= MINIMUM_SCHEMA'
]));
add('endpoint-mutation-double-lock',all(endpoint,[
  'assertStagingMutationAllowed(environmentGuard);','const schemaAuthority = await runtimeSchemaAuthority(supabase);','assertCurrentRuntimeSchema(schemaAuthority);'
]));
add('endpoint-status-exposes-schema-authority',all(endpoint,[
  'schema:schemaAuthority.expected_schema_version','schema_authority:schemaAuthority','schema_assertions:schemaRows','schema_current:schemaAuthority.exact_schema_match'
]));
add('endpoint-error-does-not-pretend-current-schema',endpoint.includes('minimum_schema:MINIMUM_SCHEMA')&&!/catch[\s\S]{0,500}schema:SCHEMA/.test(endpoint));

add('ui-requires-environment-and-schema',all(ui,[
  'function schemaCurrent(){return schemaAuthority().exact_schema_match===true;}',
  'environmentGuard().mutation_allowed===true && schemaCurrent()'
]));
add('ui-renders-exact-schema-authority',all(ui,[
  'Runtime schema authority:','Expected Schema','live Schema','source v_schema_drift_status','human staging mutation is locked'
]));
add('ui-load-failure-locks-schema',all(ui,[
  'schema_authority:{exact_schema_match:false','Runtime schema authority could not be loaded.'
]));

add('browser-derives-repository-schema',all(browser,[
  "fs.readdirSync(path.resolve(repoRoot,'sql'))",'const CURRENT_SCHEMA=Math.max','schema_version:CURRENT_SCHEMA'
]));
add('browser-current-schema-visible',all(browser,[
  'Runtime schema authority: CURRENT','Expected Schema ${CURRENT_SCHEMA}','live Schema ${CURRENT_SCHEMA}'
]));
add('browser-schema-mismatch-lock-proof',all(browser,[
  'staging environment with schema mismatch stays readable and hides all mutation controls','Runtime schema authority: MISMATCH','human staging mutation is locked'
]));
add('browser-no-stale-build187-runtime-labels',!browser.includes("run_key:'staging-b187-ops'")&&!browser.includes("suite_name:'build187_operations_cockpit_live_acceptance'"));

add('runner-already-current-schema-exact',all(runner,[
  'Current-schema staging acceptance runner','repoLatestSchema','latestSchema !== repoLatestSchema','Refusing current-schema staging acceptance against the YardWeasels Production project ref.'
]));
add('help-exact-schema-second-lock',all(help,[
  'Exact schema is a second independent lock.','v_schema_drift_status','expected repository schema and latest applied staging schema','match exactly'
]));
add('help-preserves-historical-catalog-distinction',help.includes('historical Schema 187 scenario catalog remains valid history'));
add('package-gate-wired',packageJson.includes('"test:staging-runtime-schema": "node scripts/staging-runtime-schema-authority-check.mjs"'));
add('workflow-gate-wired',workflow.includes('npm run test:staging-runtime-schema'));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} staging runtime schema authority checks passed.`);
if(failed.length)process.exit(1);
