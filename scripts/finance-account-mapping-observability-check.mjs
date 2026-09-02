#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const hasAll=(text,values)=>values.every((value)=>text.includes(value));

const migrationPath='sql/181_finance_account_mapping_observability.sql';
add('schema181-migration-present',exists(migrationPath));
const sql=read(migrationPath);
const endpoint=read('supabase/functions/finance-account-mapping-review/index.ts');
const adminEndpoint=read('supabase/functions/admin-it-control/index.ts');
const ui=read('js/finance-account-mapping-ui.js');
const itUi=read('js/it-readiness-ui.js');
const fixture=read('tests/fixtures/finance-account-mapping-review-fixtures.mjs');
const browser=read('tests/browser/finance-account-mapping-review.spec.mjs');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const config=read('supabase/config.toml');
const adminCheck=read('scripts/admin-it-readiness-check.mjs');
const repo=read('scripts/repo-smoke-check.mjs');
const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

add('schema181-transaction-balanced',(sql.match(/^begin;$/gmi)||[]).length===1&&(sql.match(/^commit;$/gmi)||[]).length===1);
add('schema181-read-only-no-table',!/^\s*create\s+table\b/gmi.test(sql),'Build 181 adds derived observability only.');
add('schema181-observability-views',hasAll(sql,['v_finance_account_mapping_observability','v_it_finance_account_mapping_observability_status','with (security_invoker=true)']));
add('schema181-private-service-surfaces',hasAll(sql,[
  'revoke all on table public.v_finance_account_mapping_observability from public,anon,authenticated;',
  'grant select on table public.v_finance_account_mapping_observability to service_role;',
  'revoke all on table public.v_it_finance_account_mapping_observability_status from public,anon,authenticated;',
  'grant select on table public.v_it_finance_account_mapping_observability_status to service_role;'
]));
add('schema181-human-aging-bands',hasAll(sql,['HUMAN_REVIEW_PENDING_STALE','HUMAN_REVIEW_PENDING_AGING','HUMAN_REVIEW_PENDING_RECENT','review_age_days>=30','review_age_days>=7']));
add('schema181-drift-classification',hasAll(sql,['ACCOUNT_SELECTION_REQUIRED','ACCOUNT_INACTIVE','REVIEW_AUDIT_STATE_DRIFT','APPROVED_WITHOUT_REVIEW_TIMESTAMP','ACCOUNT_METADATA_CHANGED_AFTER_REVIEW','technical_drift']));
add('schema181-preflight-reconciliation',hasAll(sql,['AR_ACCOUNT_MAPPING_NOT_APPROVED','REVENUE_ACCOUNT_MAPPING_NOT_APPROVED','TAX_ACCOUNT_MAPPING_NOT_APPROVED','NO_GENERATED_PAIR_SAMPLE','STALE_PREFLIGHT_MAPPING_BLOCKER','MISSING_PREFLIGHT_MAPPING_BLOCKER','ALIGNED']));
add('schema181-tax-sample-conditional',sql.includes("mapping_key='sales_tax_payable'")&&sql.includes('tax_total>0'),'Sales-tax mapping observability only requires live preflight samples when tax is non-zero.');
add('schema181-assertions',hasAll(sql,['ywi_finance_account_mapping_observability_assertions','finance_mapping_observability_no_technical_drift','finance_mapping_observability_preflight_reconciled','finance_mapping_observability_prior_schema180_green']));
add('schema181-prior-schema180-chain',sql.includes('ywi_finance_account_mapping_review_assertions()'));
add('schema181-no-canonical-mapping-write',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.accountant_export_mapping_rules\b/i.test(sql));
add('schema181-no-chart-write',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.chart_of_accounts\b/i.test(sql));
add('schema181-no-review-audit-write',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.finance_account_mapping_review_audit\b/i.test(sql));
add('schema181-no-jobs-writeback',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.(?:jobs|work_orders)\b/i.test(sql));
add('schema181-no-accounting-posting-write',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.(?:ar_invoices|job_invoice_postings|job_journal_postings|gl_journal_batches|gl_journal_entries|payments)\b/i.test(sql));
add('schema181-execution-provider-closed',!/execution_enabled\s*=\s*true/i.test(sql)&&!/provider_mutation_enabled\s*=\s*true/i.test(sql));
add('schema181-dependency-contracts',hasAll(sql,['finance_mapping_observability_mapping_updated_at','finance_mapping_observability_account_updated_at','finance_mapping_observability_audit_reviewed_at','required_by_schema']));
add('schema181-it-registry',sql.includes("'finance_account_mapping_observability','Finance','Finance mapping aging, drift and preflight reconciliation'"));
add('schema181-scorecard-rail',hasAll(sql,['schema181_finance_account_mapping_observability','read_only_observability','mapping_auto_approval']));
add('schema181-ledger',hasAll(sql,["181,'181_finance_account_mapping_observability'","'181_finance_account_mapping_observability.sql'","'2026-09-02m'"]));

add('endpoint-list-observability',hasAll(endpoint,['v_finance_account_mapping_observability','v_it_finance_account_mapping_observability_status','observability','observability_readiness']));
add('endpoint-existing-mutation-only',endpoint.includes('action !== "review_mapping"')&&!endpoint.includes('observe_mapping')&&!endpoint.includes('approve_observability'));
add('endpoint-boundary-still-closed',hasAll(endpoint,['migration_auto_approval: false','posting_execution_authorized: false','provider_mutation: false','jobs_writeback: false']));
add('endpoint-jwt-protected',/\[functions\.finance-account-mapping-review\]\s+verify_jwt\s*=\s*true/s.test(config));

add('finance-ui-observability',hasAll(ui,['Mapping observability','technical drift','preflight','review_age_code','drift_code','preflight_reconciliation_code']));
add('finance-ui-human-controls-preserved',hasAll(ui,['data-mapping-review="approved"','data-mapping-review="rejected"','data-mapping-review="review"']));
add('finance-ui-no-auto-decision',!/\.click\(\)|selectedIndex\s*=|review_status\s*:\s*['"]approved['"]/i.test(ui),'Client does not programmatically approve/select a mapping.');

add('admin-it-observability-source',hasAll(adminEndpoint,['finance_account_mapping_observability','v_it_finance_account_mapping_observability_status','ywi_finance_account_mapping_observability_assertions']));
add('admin-it-ui-observability',hasAll(itUi,['finance_account_mapping_observability','mapping_observability_status','Mapping observability']));
add('admin-it-source-gate-observability',hasAll(adminCheck,['v_it_finance_account_mapping_observability_status','ywi_finance_account_mapping_observability_assertions','finance_account_mapping_observability']));

add('fixture-observability-nonpersistent',hasAll(fixture,['observability:','observability_readiness:','technical_drift_count','preflight_reconciliation_issue_count'])&&!/fetch\(|supabase|stripe|paypal/i.test(fixture));
add('browser-observability-rendered',hasAll(browser,['Mapping observability','HUMAN_REVIEW_PENDING_STALE','NO_GENERATED_PAIR_SAMPLE','technical drift','preflight'])&&browser.includes('phone')&&browser.includes('desktop'));
add('browser-full-finance-access-ladder',['hidden','view','create','approve','manage'].every((level)=>browser.includes(`'${level}'`)));

add('package-source-gate',pkg.includes('"test:finance-account-mapping-observability"'));
add('workflow-source-gate',workflow.includes('npm run test:finance-account-mapping-observability'));
add('repo-smoke-schema181',repo.includes('schema181')&&repo.includes('finance-account-mapping-observability-check.mjs'));
add('docs-schema181-active',[readme,handbook,nextSteps].every((text)=>text.includes('Build 181')&&text.includes('ACTIVE')&&/aging|drift|reconciliation/i.test(text)));
add('docs-human-mapping-boundary',[readme,handbook,nextSteps].every((text)=>/human/i.test(text)&&/mapping/i.test(text)&&/execution/i.test(text)&&/OFF/i.test(text)));
add('docs-production-manual',[readme,handbook,nextSteps].every((text)=>/Production/i.test(text)&&/manual/i.test(text)));

const passed=checks.filter((item)=>item.ok).length;
console.log(`Finance account-mapping observability check: ${passed}/${checks.length} passed\n`);
for(const item of checks) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?` — ${item.detail}`:''}`);
if(passed!==checks.length)process.exit(1);
