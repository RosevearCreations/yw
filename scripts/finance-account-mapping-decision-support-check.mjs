#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const sql=read('sql/183_finance_account_mapping_decision_support.sql');
const endpoint=read('supabase/functions/finance-account-mapping-review/index.ts');
const ui=read('js/finance-account-mapping-ui.js');
const fixture=read('tests/fixtures/finance-account-mapping-review-fixtures.mjs');
const browser=read('tests/browser/finance-account-mapping-review.spec.mjs');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const repo=read('scripts/repo-smoke-check.mjs');
const docs=[read('README.md'),read('docs/ACTIVE_PROJECT_HANDBOOK.md'),read('docs/NEXT_STEPS_AND_SANITY_CHECK.md')];

const results=[];
const add=(name,ok,details='')=>results.push({name,ok,details});
const hasAll=(text,needles)=>needles.every((needle)=>text.includes(needle));
const plain=(text)=>text.replaceAll('*','');

add('schema183-migration-present',fs.existsSync('sql/183_finance_account_mapping_decision_support.sql'));
add('schema183-transaction-balanced',(sql.match(/\bbegin;/gi)||[]).length===1&&(sql.match(/\bcommit;/gi)||[]).length===1);
add('schema183-decision-support-private',hasAll(sql,[
  'v_finance_account_mapping_decision_support','v_it_finance_account_mapping_decision_support_status','with (security_invoker=true)',
  'revoke all on table public.v_finance_account_mapping_decision_support from public,anon,authenticated;',
  'grant select on table public.v_finance_account_mapping_decision_support to service_role;'
]));
add('schema183-three-expected-types',hasAll(sql,["when 'accounts_receivable' then 'asset'","when 'service_revenue' then 'revenue'","when 'sales_tax_payable' then 'liability'"]));
add('schema183-ranking-without-auto-selection',hasAll(sql,['CURRENT_SELECTION','SOURCE_IDENTITY_MATCH','TYPE_COMPATIBLE','TYPE_MISMATCH','decision_rank'])&&!/set\s+account_id\s*=\s*['"][0-9a-f-]+['"]/i.test(sql));
add('schema183-approval-guard',hasAll(sql,["v_new_status='approved'",'v_account_type is distinct from v_expected_account_type','not structurally compatible']));
add('schema183-review-reject-remain-human',hasAll(sql,["v_new_status not in ('review','approved','rejected')",'Finance manage access is required for accountant mapping review.','review_reason']));
add('schema183-assertions',hasAll(sql,['ywi_finance_account_mapping_decision_support_assertions','finance_mapping_decision_support_current_selection_compatible','finance_mapping_decision_support_db_approval_guard']));
add('schema183-no-auto-approval',!/set\s+review_status\s*=\s*['"]approved['"]/i.test(sql));
add('schema183-execution-provider-off',!/execution_enabled\s*=\s*true/i.test(sql)&&!/provider_mutation_enabled\s*=\s*true/i.test(sql));
add('schema183-no-jobs-writeback',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.(?:jobs|work_orders)\b/i.test(sql));
add('schema183-no-posting-write',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:ar_invoices|gl_journal_batches|gl_journal_entries|job_invoice_postings|job_journal_postings)\b/i.test(sql));
add('schema183-marker',hasAll(sql,['183::int as expected_schema_version',"183,'183_finance_account_mapping_decision_support'","'schema',183"]));
add('endpoint-decision-support-list',hasAll(endpoint,['v_finance_account_mapping_decision_support','v_it_finance_account_mapping_decision_support_status','decision_support','decision_support_readiness']));
add('endpoint-manage-only-candidates',endpoint.includes('if (canManage)')&&endpoint.includes('decisionSupportResult'));
add('endpoint-boundary-preserved',hasAll(endpoint,['human_accounting_decision_required: true','posting_execution_authorized: false','provider_mutation: false','jobs_writeback: false','structural_account_type_guard_on_approval: true']));
add('ui-decision-support-rendered',hasAll(ui,['Mapping decision support','expected_account_type','approval_eligible','compatibility_code']));
add('ui-client-approval-guard',hasAll(ui,['Selected account is not structurally compatible','approval_eligible !== false']));
add('ui-no-auto-selection',!/\.value\s*=\s*[^=]/.test(ui)&&!ui.includes('selectedIndex ='));
add('fixture-decision-support',hasAll(fixture,['DECISION_SUPPORT','decision_support_readiness','mapping_decision_support_status']));
add('browser-decision-support',hasAll(browser,['Mapping decision support','TYPE_MISMATCH','structurally compatible']));
add('package-source-gate',pkg.scripts?.['test:finance-account-mapping-decision-support']==='node scripts/finance-account-mapping-decision-support-check.mjs');
add('workflow-source-gate',workflow.includes('npm run test:finance-account-mapping-decision-support'));

const passed=results.filter((r)=>r.ok).length;
console.log(`\nSchema 183 Finance mapping decision-support source gate: ${passed}/${results.length} passed\n`);
for(const result of results) console.log(`${result.ok?'PASS':'FAIL'}  ${result.name}${result.details?` — ${result.details}`:''}`);
process.exit(results.some((r)=>!r.ok)?1:0);
