#!/usr/bin/env node
/** Schema 180 Finance accountant mapping readiness/review source gate. */
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const results=[];
const add=(name,ok,details='')=>results.push({name,ok:!!ok,details});
const hasAll=(text,values)=>values.every((value)=>text.includes(value));

const sqlPath='sql/180_finance_account_mapping_review_workflow.sql';
add('schema180-migration-present',exists(sqlPath));
const sql=read(sqlPath);
const endpoint=read('supabase/functions/finance-account-mapping-review/index.ts');
const ui=read('js/finance-account-mapping-ui.js');
const runtime=read('js/module-runtime.js');
const config=read('supabase/config.toml');
const itSource=read('supabase/functions/admin-it-control/index.ts');
const itUi=read('js/it-readiness-ui.js');

add('schema180-transaction-balanced',(sql.match(/^begin;$/gmi)||[]).length===1&&(sql.match(/^commit;$/gmi)||[]).length===1);
add('schema180-audit-authority',hasAll(sql,['finance_account_mapping_review_audit','trg_finance_account_mapping_review_audit_immutable','Finance account mapping review audit is immutable.']));
add('schema180-three-canonical-mappings',['accounts_receivable','service_revenue','sales_tax_payable'].every((key)=>sql.includes(`'${key}'`)));
add('schema180-canonical-table-reused',hasAll(sql,['accountant_export_mapping_rules','chart_of_accounts','ywi_finance_review_account_mapping'])&&!/create table if not exists public\.finance_account_mapping_rules\b/i.test(sql),'Build 180 reuses the canonical mapping table.');
add('schema180-manage-db-defense',sql.includes("ywi_effective_module_access(p_actor_profile_id,'finance')")&&sql.includes("ywi_module_access_rank('manage')"));
add('schema180-active-account-validation',hasAll(sql,["select is_active into v_account_active from public.chart_of_accounts","Selected chart account must exist and be active.","Approved mapping requires an active chart account."]));
add('schema180-review-status-bounded',sql.includes("v_new_status not in ('review','approved','rejected')"));
add('schema180-service-role-only-rpc',hasAll(sql,['revoke all on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) from public,anon,authenticated;','grant execute on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) to service_role;']));
add('schema180-private-audit',hasAll(sql,['alter table public.finance_account_mapping_review_audit enable row level security;','revoke all on table public.finance_account_mapping_review_audit from public,anon,authenticated;']));

const rpcStart=sql.indexOf('create or replace function public.ywi_finance_review_account_mapping');
const migrationPrefix=rpcStart>=0?sql.slice(0,rpcStart):sql;
add('schema180-no-migration-time-mapping-mutation',!/update\s+public\.accountant_export_mapping_rules\b/i.test(migrationPrefix)&&!/insert\s+into\s+public\.accountant_export_mapping_rules\b/i.test(migrationPrefix),'Migration does not alter live mapping selections/review states before the human RPC exists.');
add('schema180-no-auto-approval',!/set\s+review_status\s*=\s*['"]approved['"]/i.test(migrationPrefix)&&sql.includes('mapping_auto_approval":false'));
add('schema180-execution-provider-closed',!/execution_enabled\s*=\s*true/i.test(sql)&&!/provider_mutation_enabled\s*=\s*true/i.test(sql)&&sql.includes('posting_execution_release_enabled":false'));
add('schema180-no-jobs-writeback',!/update\s+public\.(?:jobs|work_orders)\b/i.test(sql));
add('schema180-readiness-and-assertions',hasAll(sql,['v_it_finance_account_mapping_review_status','ywi_finance_account_mapping_review_assertions','finance_account_mapping_review']));
add('schema180-dependency-contracts',hasAll(sql,['finance_mapping_rule_account_id','finance_mapping_rule_review_status','finance_mapping_chart_account_active']));
add('schema180-version-marker',hasAll(sql,["180,'180_finance_account_mapping_review_workflow'",'select 180::int as expected_schema_version']));

add('schema180-endpoint-jwt',/\[functions\.finance-account-mapping-review\]\s+verify_jwt = true/s.test(config));
add('schema180-endpoint-view-list',hasAll(endpoint,['hasModuleAccess(supabase, actorProfile, "finance", "view")','action === "list"','v_finance_account_mapping_review_directory','v_it_finance_account_mapping_review_status']));
add('schema180-endpoint-manage-write',hasAll(endpoint,['hasModuleAccess(supabase, actorProfile, "finance", "manage")','action !== "review_mapping"','Finance manage access is required for accountant mapping review.']));
add('schema180-endpoint-bounded-fields',hasAll(endpoint,['mapping_key','account_id','review_status','reason','SERVER_OWNED_MAPPING_FIELDS'])&&['execution_enabled','provider_mutation','job_id','work_order_id','subtotal','tax_total','total_amount','stripe','paypal'].every((key)=>endpoint.includes(`"${key}"`)));
add('schema180-endpoint-no-release-provider-jobs',endpoint.includes('posting_execution_authorized: false')&&endpoint.includes('provider_mutation: false')&&endpoint.includes('jobs_writeback: false'));

add('schema180-finance-runtime-addon',runtime.includes("scripts: Object.freeze(['/js/finance-ui.js','/js/finance-account-mapping-ui.js'])")&&runtime.includes("const BUILD = '2026-09-02l'"));
add('schema180-ui-view-and-manage',hasAll(ui,["canViewModule?.('finance'","canManage()","data-mapping-review","Finance manage required for mapping decisions"]));
add('schema180-ui-human-confirmation',ui.includes("window.confirm('Approve this exact chart-account mapping?")&&ui.includes('reason.trim().length<5'));
add('schema180-ui-bounded-payload',ui.includes("{action:'review_mapping',mapping_key:mappingKey,account_id:accountId||null,review_status:reviewStatus,reason:reason.trim()}")&&!/execution_enabled\s*:/i.test(ui)&&!/provider_mutation\s*:/i.test(ui));
add(
  'schema180-ui-no-auto-selection',
  !/selectedIndex\s*=/.test(ui)
    && !/\.value\s*=\s*[^;\n]*(?:accounts\[|payload\??\.?accounts)/i.test(ui)
    && !/review_status\s*:\s*['"]approved['"]/i.test(ui),
  'Browser never programmatically selects an account or hard-codes an approved mutation.'
);

add('schema180-it-readiness-source',itSource.includes('finance_account_mapping_review')&&itSource.includes('v_it_finance_account_mapping_review_status'));
add('schema180-it-assertion-source',itSource.includes('ywi_finance_account_mapping_review_assertions'));
add('schema180-it-ui-panel',itUi.includes("panel('finance_account_mapping_review'")&&itUi.includes('finance_account_mapping_review'));

const failures=results.filter((item)=>!item.ok);
console.log(`\nSchema 180 Finance mapping review source gate: ${results.length-failures.length}/${results.length} passed\n`);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`);
if(failures.length) process.exit(1);
