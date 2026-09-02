#!/usr/bin/env node
/** Current repository-level hygiene and static sanity gate. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const results=[];
const add=(name,ok,details='')=>results.push({name,ok,details});
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
  const full=path.join(dir,entry.name);
  if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='playwright-report'||entry.name==='test-results') return [];
  return entry.isDirectory()?walk(full):[full];
});

const files=walk(root);
const rel=(file)=>path.relative(root,file).replaceAll('\\','/');
const activeMd=files.filter((file)=>file.endsWith('.md')).map(rel).sort();
const expectedMd=['README.md','docs/ACTIVE_PROJECT_HANDBOOK.md','docs/NEXT_STEPS_AND_SANITY_CHECK.md'];
add('active-markdown-exactly-three',JSON.stringify(activeMd)===JSON.stringify(expectedMd),`Active Markdown: ${activeMd.join(', ')||'none'}`);
add('no-archive-tree',!exists('archive'),'Git history is the archive; active archive/ must not return.');
add('no-retired-markdown-tree',!fs.readdirSync(root,{withFileTypes:true}).some((entry)=>entry.isDirectory()&&/^retired-markdown-/i.test(entry.name)),'Dated retired Markdown must not return to the active tree.');
add('no-test-write-artifacts',!files.some((file)=>/^test_write/i.test(path.basename(file))),'Temporary test_write artifacts are absent.');
add('no-backup-temp-artifacts',!files.some((file)=>/\.(?:tmp|bak|log)$/i.test(file)),'Temporary, backup and log artifacts are absent.');
add('no-generated-full-schema-snapshot',!exists('sql/000_full_schema_reference.sql'),'Numbered migrations are the schema source authority; stale generated full-schema snapshots stay out of the active tree.');
add('no-temporary-build179-patch-workflow',!exists('.github/workflows/build179-source-patch.yml'),'Temporary remote source patch workflow is absent.');
add('no-temporary-build180-patch-workflow',!exists('.github/workflows/build180-source-patch.yml'),'Temporary Build 180 source patch workflow is absent.');
add('no-temporary-build181-patch-workflow',!exists('.github/workflows/build181-source-patch.yml')&&!exists('.github/workflows/build181-source-patch-v2.yml'),'Temporary Build 181 source patch workflows are absent.');

const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
for(const [name,text] of [['README',readme],['Handbook',handbook],['Next steps',nextSteps]]){
  add(`${name.toLowerCase().replaceAll(' ','-')}-schema181`,text.includes('181')&&text.includes('I.T. Readiness'),`${name} records active Schema 181 source authority and retains the Admin/I.T. boundary.`);
}
add('docs-build179-complete',handbook.includes('Schema 179')&&handbook.includes('COMPLETE')&&nextSteps.includes('Build 179')&&nextSteps.includes('COMPLETE'),'Active authority records Build 179 permission/acceptance/release hardening as complete.');
add('docs-build180-complete',[readme,handbook,nextSteps].every((text)=>text.includes('Build 180')&&/mapping/i.test(text)&&/COMPLETE/i.test(text)),'Active authority records Build 180 accountant mapping readiness/review as complete.');
add('docs-build181-active',[readme,handbook,nextSteps].every((text)=>text.includes('Build 181')&&/aging|drift|reconciliation/i.test(text)&&/ACTIVE/i.test(text)),'Active authority records Build 181 mapping observability as the bounded source release.');
add('docs-build179-financial-release-closed',[readme,handbook,nextSteps].every((text)=>/execution release/i.test(text)&&/(off|closed|server-owned)/i.test(text)),'Build 179 does not release Finance accounting execution.');
add('docs-four-module-boundary',[readme,handbook,nextSteps].every((text)=>['Safety','Finance','Jobs','Admin'].every((key)=>text.includes(key))),'Active authority retains Safety, Finance, Jobs and Admin.');
add('docs-manual-production',[readme,handbook,nextSteps].every((text)=>/manual/i.test(text)&&/Production/i.test(text)),'Production promotion remains deliberate/manual.');
add('docs-accounting-mapping-human-gate',[readme,handbook,nextSteps].every((text)=>/accountant|bookkeeper/i.test(text)&&/(mapping|chart)/i.test(text)),'Account mapping approval remains an explicit human accounting decision.');
add('docs-synthetic-nonpersistent',[readme,handbook,nextSteps].every((text)=>/synthetic/i.test(text)&&/(non-persistent|browser-only|do not persist|does not persist)/i.test(text)),'Synthetic Finance acceptance is explicitly non-persistent/browser-only.');

const sqlDir=path.join(root,'sql');
const sqlNames=fs.readdirSync(sqlDir).filter((name)=>/^\d{3}_.+\.sql$/i.test(name));
const versions=new Set(sqlNames.map((name)=>Number(name.slice(0,3))).filter((n)=>n>0));
const missing=[];
for(let n=30;n<=181;n++) if(!versions.has(n)) missing.push(n);
add('migration-range-030-through-181',missing.length===0&&versions.has(181),missing.length?`Missing migration numbers: ${missing.join(', ')}`:'Every schema number 030–181 is represented.');
for(const [version,file] of [
  [174,'sql/174_finance_work_order_identity_contract_convergence.sql'],
  [175,'sql/175_finance_posting_safety_foundation.sql'],
  [176,'sql/176_finance_posting_preflight_accounting_mapping.sql'],
  [177,'sql/177_finance_posting_execution_recovery.sql'],
  [178,'sql/178_finance_operational_control_plane.sql'],
  [179,'sql/179_finance_permissions_acceptance_release_hardening.sql'],
  [180,'sql/180_finance_account_mapping_review_workflow.sql'],
  [181,'sql/181_finance_account_mapping_observability.sql'],
]) add(`schema${version}-migration-present`,exists(file),`Schema ${version} migration is present.`);

const schema173=read('sql/173_finance_schema_dependency_contract_guard.sql');
const schema174=read('sql/174_finance_work_order_identity_contract_convergence.sql');
const schema175=read('sql/175_finance_posting_safety_foundation.sql');
const schema176=read('sql/176_finance_posting_preflight_accounting_mapping.sql');
const schema177=read('sql/177_finance_posting_execution_recovery.sql');
const schema178=read('sql/178_finance_operational_control_plane.sql');
const schema179=read('sql/179_finance_permissions_acceptance_release_hardening.sql');
const schema180=read('sql/180_finance_account_mapping_review_workflow.sql');
const schema181=read('sql/181_finance_account_mapping_observability.sql');
add('schema173-history-preserved',schema173.includes("'completion_review_work_order'")&&schema173.includes("'bigint'"),'Schema 173 historical dependency assumption remains auditable.');
add('schema174-uuid-repair',schema174.includes("set expected_data_type='uuid'")&&schema174.includes("where contract_key='completion_review_work_order'"),'Schema 174 explicitly repairs the work-order identity contract to UUID.');
add('schema175-posting-approval-separate',schema175.includes('finance_job_completion_posting_approvals')&&schema175.includes('idempotency_key'),'Schema 175 retains separate posting approval/idempotency authority.');
add('schema176-read-only-preflight',schema176.includes('ywi_finance_job_completion_posting_preflight')&&schema176.includes('false as posting_execution_authorized')&&schema176.includes('false as provider_mutation_authorized'),'Schema 176 maps existing AR/GL authorities but keeps preflight non-executing.');
add('schema176-existing-accounting-authority',['job_invoice_postings','ar_invoices','job_journal_postings','gl_journal_batches','gl_journal_entries','accountant_export_mapping_rules','chart_of_accounts'].every((key)=>schema176.includes(key)),'Schema 176 reuses existing accounting and mapping authorities.');
add('schema177-execution-release-fail-closed',schema177.includes('finance_job_completion_posting_execution_controls')&&schema177.includes("'finance_job_completion_v1',false,false,177")&&schema177.includes('provider_mutation_enabled=false'),'Schema 177 execution/recovery machinery remains behind a disabled provider-safe release control.');
add('schema177-recovery-reversal',schema177.includes("execution_status='recovery_required'")&&schema177.includes('finance_job_completion_posting_reversals')&&schema177.includes('reversal_gl_batch_id'),'Schema 177 retains recovery quarantine and auditable reversal authority.');
add('schema178-operational-control-plane',['v_finance_job_completion_operational_lifecycle','v_finance_job_completion_reconciliation_issues','v_it_finance_completion_pipeline_status','ywi_finance_operational_control_plane_assertions'].every((key)=>schema178.includes(key)),'Schema 178 retains lifecycle, reconciliation and I.T. Finance pipeline observability.');
add('schema178-dynamic-dependency-preflight',schema178.includes('required_by_schema <= coalesce((select expected_schema_version from public.v_schema_drift_status limit 1),178)')&&!/where\s+required_by_schema\s*<=\s*173\b/i.test(schema178),'Admin dependency preflight follows the current schema marker.');
add('schema179-release-hardening',['finance_release_acceptance_scenarios','ywi_finance_release_hardening_assertions','v_it_finance_release_hardening_status'].every((key)=>schema179.includes(key)),'Schema 179 adds private permission/acceptance/release-hardening control-plane authority.');
add('schema179-permission-matrix',['hidden','view','create','approve','manage','admin_break_glass','server_control'].every((key)=>schema179.includes(`'${key}'`)),'Schema 179 covers the Finance permission ladder, Admin break-glass and server-control cases.');
add('schema179-no-execution-provider-enable',!/execution_enabled\s*=\s*true/i.test(schema179)&&!/provider_mutation_enabled\s*=\s*true/i.test(schema179),'Schema 179 does not enable accounting execution or provider mutation.');
add('schema179-no-jobs-writeback',!/update\s+public\.(?:jobs|work_orders)\b/i.test(schema179),'Schema 179 does not write canonical Jobs/work-order state.');
add('schema180-human-mapping-authority',['finance_account_mapping_review_audit','ywi_finance_review_account_mapping','v_it_finance_account_mapping_review_status'].every((key)=>schema180.includes(key)),'Schema 180 adds human mapping review/audit/readiness over canonical mappings.');
add('schema180-no-auto-approval',!/set\s+review_status\s*=\s*['"]approved['"]/i.test(schema180.slice(0,schema180.indexOf('create or replace function public.ywi_finance_review_account_mapping'))),'Schema 180 migration does not auto-approve live mappings.');
add('schema180-execution-provider-closed',!/execution_enabled\s*=\s*true/i.test(schema180)&&!/provider_mutation_enabled\s*=\s*true/i.test(schema180),'Schema 180 does not enable accounting execution or provider mutation.');
add('schema180-no-jobs-writeback',!/update\s+public\.(?:jobs|work_orders)\b/i.test(schema180),'Schema 180 does not write Jobs state.');
add('schema181-read-only-observability',['v_finance_account_mapping_observability','v_it_finance_account_mapping_observability_status','ywi_finance_account_mapping_observability_assertions'].every((key)=>schema181.includes(key))&&!/^\s*create\s+table\b/gmi.test(schema181),'Schema 181 adds derived observability without another mapping authority table.');
add('schema181-aging-drift-preflight',['HUMAN_REVIEW_PENDING_STALE','REVIEW_AUDIT_STATE_DRIFT','NO_GENERATED_PAIR_SAMPLE','STALE_PREFLIGHT_MAPPING_BLOCKER','MISSING_PREFLIGHT_MAPPING_BLOCKER'].every((key)=>schema181.includes(key)),'Schema 181 distinguishes human aging, technical drift and preflight reconciliation.');
add('schema181-no-mapping-auto-mutation',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.accountant_export_mapping_rules\b/i.test(schema181),'Schema 181 does not modify canonical mapping decisions.');
add('schema181-execution-provider-closed',!/execution_enabled\s*=\s*true/i.test(schema181)&&!/provider_mutation_enabled\s*=\s*true/i.test(schema181),'Schema 181 does not enable accounting execution or provider mutation.');
add('schema181-no-jobs-writeback',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.(?:jobs|work_orders)\b/i.test(schema181),'Schema 181 does not write Jobs state.');

const fixture=read('tests/fixtures/finance-release-hardening-fixtures.mjs');
const financeBrowser=read('tests/browser/finance-release-hardening.spec.mjs');
const mappingFixture=read('tests/fixtures/finance-account-mapping-review-fixtures.mjs');
const mappingBrowser=read('tests/browser/finance-account-mapping-review.spec.mjs');
add('schema179-synthetic-fixture-nonpersistent',fixture.includes('execution_release_enabled:false')&&fixture.includes('provider_mutation_authorized:false')&&!/fetch\(|supabase|payment_intent|paypal_order/i.test(fixture),'Build 179 synthetic Finance fixtures stay deterministic and non-persistent.');
add('schema179-rendered-permission-matrix',['hidden','view','create','approve','manage'].every((key)=>financeBrowser.includes(`'${key}'`))&&financeBrowser.includes('phone')&&financeBrowser.includes('desktop'),'Rendered Finance acceptance covers the full user permission ladder on phone and desktop.');
add('schema179-release-double-gate',financeBrowser.includes('server execution authorization and release truth')&&financeBrowser.includes('execute_posting'),'Rendered acceptance verifies execution needs both server authorization and server release truth.');
add('schema180-mapping-fixture-nonpersistent',mappingFixture.includes('migration_auto_approval:false')&&mappingFixture.includes('posting_execution_authorized:false')&&!/fetch\(|supabase|stripe|paypal/i.test(mappingFixture),'Build 180 mapping fixtures are deterministic and non-persistent.');
add('schema180-rendered-mapping-review',['hidden','view','create','approve','manage'].every((key)=>mappingBrowser.includes(`'${key}'`))&&mappingBrowser.includes('phone')&&mappingBrowser.includes('desktop'),'Rendered mapping acceptance covers Finance access levels on phone and desktop.');
add('schema181-mapping-observability-fixture',mappingFixture.includes('observability_readiness')&&mappingFixture.includes('technical_drift_count')&&mappingFixture.includes('preflight_reconciliation_issue_count'),'Build 181 fixture carries deterministic read-only observability evidence.');
add('schema181-rendered-observability',mappingBrowser.includes('Mapping observability')&&mappingBrowser.includes('HUMAN_REVIEW_PENDING_STALE')&&mappingBrowser.includes('NO_GENERATED_PAIR_SAMPLE'),'Rendered mapping acceptance covers human aging and neutral no-sample observability.');

const index=read('index.html');
add('homepage-one-h1',(index.match(/<h1\b/gi)||[]).length===1,`Homepage H1 count: ${(index.match(/<h1\b/gi)||[]).length}.`);
const config=read('supabase/config.toml');
add('protected-control-functions',/\[functions\.admin-it-control\]\s+verify_jwt = true/s.test(config)&&/\[functions\.core-data-read\]\s+verify_jwt = true/s.test(config)&&/\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config)&&/\[functions\.finance-job-completion-review\]\s+verify_jwt = true/s.test(config)&&/\[functions\.finance-job-completion-posting-approval\]\s+verify_jwt = true/s.test(config)&&/\[functions\.finance-account-mapping-review\]\s+verify_jwt = true/s.test(config),'Admin/I.T., Shared Core, operations, Finance completion, and Finance mapping functions explicitly retain JWT verification.');

const jsFiles=files.filter((file)=>/\.(?:js|mjs)$/i.test(file));
for(const file of jsFiles){
  const run=spawnSync(process.execPath,['--check',rel(file)],{cwd:root,encoding:'utf8'});
  add(`syntax:${rel(file)}`,run.status===0,run.status===0?'Syntax OK.':(run.stderr||run.stdout).trim());
}

const required=[
  '.github/workflows/staging-browser-integration.yml','package.json','package-lock.json','playwright.config.mjs',
  'scripts/module-permissions-check.mjs','scripts/admin-it-readiness-check.mjs','scripts/it-release-authority-check.mjs',
  'scripts/finance-schema-dependency-contract-check.mjs','scripts/finance-posting-safety-foundation-check.mjs','scripts/finance-posting-preflight-check.mjs',
  'scripts/finance-posting-execution-recovery-check.mjs','scripts/finance-operational-control-plane-check.mjs','scripts/finance-release-hardening-check.mjs','scripts/finance-account-mapping-review-check.mjs','scripts/finance-account-mapping-observability-check.mjs',
  'tests/fixtures/finance-release-hardening-fixtures.mjs','tests/browser/finance-release-hardening.spec.mjs',
  'tests/fixtures/finance-account-mapping-review-fixtures.mjs','tests/browser/finance-account-mapping-review.spec.mjs','js/finance-account-mapping-ui.js',
  'supabase/functions/admin-it-control/index.ts','supabase/functions/finance-job-completion-review/index.ts','supabase/functions/finance-job-completion-posting-approval/index.ts','supabase/functions/finance-account-mapping-review/index.ts',
  'supabase/functions/core-data-read/index.ts','supabase/functions/operations-manage/index.ts'
];
for(const file of required) add(`exists:${file}`,exists(file),'Required current release/control file is present.');

const passed=results.filter((item)=>item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`);
process.exit(results.some((item)=>!item.ok)?1:0);
