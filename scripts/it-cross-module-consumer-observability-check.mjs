#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/170_it_cross_module_consumer_observability.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const ui=read('js/it-readiness-ui.js');
const moduleUi=read('js/module-access-ui.js');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const failures=[];
const check=(name,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures.push(name);};

check('schema170-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
check('schema170-private-consumer-health-view',migration.includes('create or replace view public.v_it_cross_module_consumer_health')&&migration.includes('with (security_invoker=true)')&&migration.includes('revoke all on table public.v_it_cross_module_consumer_health from public, anon, authenticated;'));
check('schema170-observes-source-intake-and-finance-queue',['public.app_cross_module_events','public.finance_job_completion_intake','public.job_completion_accounting_events'].every((value)=>migration.includes(value)));
check('schema170-unconsumed-and-failure-visibility',migration.includes("'finance_completion_unconsumed'")&&migration.includes("'finance_completion_failed_intake'")&&migration.includes("'finance_completion_review_queue'"));
check('schema170-stale-thresholds',migration.includes("interval '1 day'")&&migration.includes("interval '7 days'"));
check('schema170-assertions-private',migration.includes('ywi_it_cross_module_consumer_observability_assertions()')&&migration.includes('revoke all on function public.ywi_it_cross_module_consumer_observability_assertions() from public, anon, authenticated;'));
check('schema170-read-only-boundary',migration.includes('Schema 170 adds health views/assertions only')&&!/perform\s+public\.ywi_finance_consume_job_completed_events|update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(migration));
check('schema170-it-readiness-registered',migration.includes("'cross_module_consumer_observability','Architecture'")&&migration.includes("'Admin > I.T. Readiness'"));
check('schema170-no-fifth-module',!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration));
check('schema170-no-core-identity-duplication',!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema170-marker',migration.includes('170::int as expected_schema_version')&&migration.includes("'170_it_cross_module_consumer_observability'")&&migration.includes("'2026-09-02b'"));
check('schema170-endpoint-health-source',endpoint.includes('v_it_cross_module_consumer_health')&&endpoint.includes('ywi_it_cross_module_consumer_observability_assertions'));
check('schema170-ui-health-panel',ui.includes("panel('cross_module_consumer_health'")&&ui.includes('consumer_observability'));
check('schema170-it-assets-still-loaded',moduleUi.includes('/js/it-readiness-ui.js?v=')&&moduleUi.includes('/it-readiness.css?v='));
check('schema170-workflow-gate',workflow.includes('npm run test:consumer-observability'));

if(failures.length){
  console.error(`Schema 170 I.T. consumer observability gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 170 I.T. cross-module consumer observability source gate: PASS');
