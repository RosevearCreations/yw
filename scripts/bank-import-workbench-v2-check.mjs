#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';

const read=(file)=>fs.readFileSync(file,'utf8');
const addon=read('js/bank-import-workbench-v2.js');
const ops=read('supabase/functions/operations-manage/index.ts');
const runtime=read('js/module-runtime.js');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build311-device-saved-bank-account-mapping',all(addon,['ywi_bank_import_column_templates_v2','templateScope()','Save bank/account template','oc_bank311_map_date','oc_bank311_map_description','oc_bank311_map_amount','oc_bank311_map_debit','oc_bank311_map_credit','oc_bank311_map_reference']),'Reusable bank/account mapping is explicit and local-device scoped.');
add('build311-source-file-traceability',all(addon,['SHA-256','source_file_sha256','source_file_bytes','source_file_last_modified','__source_row'])&&all(ops,['source_file_sha256','source_file_bytes','source_file_last_modified','column_mapping']),'Source fingerprint, size, last-modified evidence, mapping and original row context are retained with the staged preview.');
add('build311-row-review-controls',all(addon,['approve-row','reject-row','correct-row','undo-row','Row review before promotion'])&&all(ops,["reviewOperation === 'row_decision'","['approve','reject','correct','undo']"]),'Unpromoted rows support explicit approve/reject/correct/undo.');
add('build311-bulk-review-bounded',all(addon,['const MAX_BULK = 100','Approve selected','Reject selected'])&&all(ops,['Bulk bank review is limited to 100 explicitly selected rows.','slice(0, 101)']),'Bulk review is selected-row only and hard capped at 100.');
add('build311-finance-approve-review-guard',ops.includes("hasModuleAccess(supabase, profile, 'finance', 'approve')")&&ops.includes('Finance approve access is required to review bank-import rows.'),'Review mutations require Finance approve access in addition to the existing endpoint/rank boundary.');
add('build311-discard-retains-history-and-blocks-promotion',all(ops,["reviewOperation === 'discard_import'","preview_status: 'discarded'","Import discarded before promotion:","promotionGuard.preview_status === 'discarded'"])&&all(addon,['Discard before promotion','discard_import']),'Discard rejects unpromoted rows, retains preview evidence, and promotion fails closed.');
add('build311-import-history-and-rejected-explanations',all(addon,['Import history &amp; source traceability','rejection_reason','duplicate flag(s)'])&&all(ops,['bank_preview_rows','validation_summary','metadata','duplicate_key,rejection_reason']),'History and row-level rejection/duplicate evidence come from bounded server queues.');
add('build311-no-silent-posting',all(addon,['Promotion is not posting','Nothing was posted','No ledger posting was performed.'])&&!/(payment_action_decision|posting_execution\s*[:=]\s*true|provider_mutation\s*[:=]\s*true|PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true)/i.test(addon),'The new UI contains no ledger-post or provider-enable authority.');
add('build311-reuses-transactional-promotion',ops.includes("ywi_rpc_promote_bank_csv_import")&&ops.includes("action === 'bank_csv_confirm_import'"),'Promotion still uses the existing transactional RPC.');
add('build311-no-new-boundary-action-drift',!/(bank_csv_row_review|bank_csv_bulk_review|bank_csv_discard_preview)\s*:/.test(read('supabase/functions/_shared/module-write-boundaries.ts'))&&ops.includes("action === 'bank_csv_preview'"),'Build 311 reuses the registered bank preview boundary instead of inventing an unregistered write action.');
add('build311-admin-lazy-runtime',runtime.includes("'/js/operations-cockpit.js',\n        '/js/bank-import-workbench-v2.js',\n        '/js/module-access-ui.js'"),'Bank workbench loads only with the permission-driven Admin bundle.');
add('build311-help-updated',all(help,['Bank Import Workbench v2','SHA-256 source fingerprint','at most 100 rows','Promotion is not posting']),'Online Help documents mapping, source proof, bounded review and non-posting semantics.');
add('build311-source-command-wired',pkg.scripts?.['test:bank-import-workbench-v2']==='node scripts/bank-import-workbench-v2-check.mjs');
add('build311-workflow-source-gate-wired',workflow.includes('npm run test:bank-import-workbench-v2'));
add('build311-browser-command-wired',pkg.scripts?.['test:browser:bank-import-workbench-v2']==='playwright test --config=playwright.config.mjs tests/browser/bank-import-workbench-v2.spec.mjs');
add('build311-workflow-browser-gate-wired',workflow.includes('npm run test:browser:bank-import-workbench-v2'));

try { new Function(addon); add('build311-addon-javascript-syntax',true); }
catch(error){ add('build311-addon-javascript-syntax',false,String(error)); }

try {
  const require=createRequire(import.meta.url);
  const ts=require('typescript');
  const output=ts.transpileModule(ops,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:'supabase/functions/operations-manage/index.ts'});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  add('build311-operations-typescript-syntax',errors.length===0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
} catch(error) { add('build311-typescript-compiler-available',false,String(error)); }

for(const check of checks) console.log((check.ok?'PASS':'FAIL')+'  '+check.name+(check.detail?' — '+check.detail:''));
const failed=checks.filter((check)=>!check.ok);
console.log('\nBuild 311 Bank Import Workbench v2 gate: '+(checks.length-failed.length)+'/'+checks.length+' passed.');
if(failed.length) process.exit(1);
