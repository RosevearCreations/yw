#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';

const read=(file)=>fs.readFileSync(file,'utf8');
const ops=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const sql151=read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build312-confidence-ranked-matching',
  all(ops,['reconciliationConfidence','confidence_band','rank:index+1','matching_rule','amount_coverage_percent']),
  'Suggestions expose deterministic rank, confidence band, amount coverage and rule text.');
add('build312-core-source-types',
  all(ops,["type:'customer_payment'","type:'vendor_payment'","type:'customer_invoice'","type:'vendor_bill'","type:'customer_deposit'","type:'bank_transfer'"]),
  'Invoices, customer/vendor payments, vendor bills, deposits and transfer counterparts are considered.');
add('build312-one-to-many-bounded',
  all(ops,['buildOneToManySuggestions','slice(0, 10)','slice(0,6)',"match_mode:'one_to_many'"]),
  'One bank row can receive bounded multi-target candidates.');
add('build312-many-to-one-review-only',
  all(ops,['buildManyToOneSuggestions',"match_mode:'many_to_one'","actionable:false",'current transactional RPC does not auto-aggregate bank rows']),
  'Many bank rows to one source record remain review-only under the current RPC.');
add('build312-partial-fails-closed',
  all(ops,['partial,','requires_human_confirmation: true',"suggestion.partial","Partial candidate requires operator review; no automatic application."]),
  'Partial candidates are visibly classified and require human review.');
add('build312-human-confirmation-ui',
  all(ui,['Smart Reconciliation Workbench','reconciliationSuggestions','selectedReconSuggestion','requires_human_confirmation:true','Human confirmation is still required']),
  'The operator UI preserves human confirmation for ranked suggestions.');
add('build312-review-only-ui-guard',
  all(ui,["selectedReconSuggestion.actionable === false",'review-only','cannot be auto-applied']),
  'Review-only candidates are blocked from match/split submission.');
add('build312-exact-split-preparation',
  all(ui,["item.match_mode === 'one_to_many'","byId('oc_recon_action').value = 'split'","allocated_amount:target.allocated_amount",'Review every allocation']),
  'Exact one-to-many suggestions prepare a split for explicit operator review.');
add('build312-reuses-existing-write-boundary',
  boundaries.includes("reconciliation_suggest: contract('reconciliation_suggest', 'finance', 'view', 'read', 'reconciliation')")
    && boundaries.includes("reconciliation_action: contract('reconciliation_action', 'finance', 'approve', 'write', 'reconciliation', 'finance.reconciliation.changed')")
    && !boundaries.includes('smart_reconciliation_action:'),
  'Build 312 reuses existing Finance reconciliation authority.');
add('build312-transactional-rpc-retained',
  ops.includes('ywi_rpc_apply_reconciliation_action')
    && sql151.includes('Split allocations must equal the bank item amount exactly to the cent.')
    && sql151.includes("if action_type not in ('match','split','undo','signoff','reject')"),
  'Existing exact-cent transactional reconciliation RPC remains authoritative.');
add('build312-no-provider-or-posting-enable',
  !/(PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true|FINANCE_POSTING_EXECUTION_ENABLED\s*=\s*true|provider_mutation\s*[:=]\s*true)/i.test(ui+ops),
  'Build 312 does not enable provider mutation or Finance posting.');
add('build312-help-updated',
  all(help,['Smart Reconciliation Workbench','one-to-many','many-to-one','human confirmation']),
  'Help documents ranked matching and human-confirmation boundaries.');
add('build312-source-command-wired',
  pkg.scripts?.['test:smart-reconciliation-workbench']==='node scripts/smart-reconciliation-workbench-check.mjs');
add('build312-browser-command-wired',
  pkg.scripts?.['test:browser:smart-reconciliation-workbench']==='playwright test --config=playwright.config.mjs tests/browser/smart-reconciliation-workbench.spec.mjs');
add('build312-workflow-source-gate-wired',workflow.includes('npm run test:smart-reconciliation-workbench'));
add('build312-workflow-browser-gate-wired',workflow.includes('npm run test:browser:smart-reconciliation-workbench'));

try { new Function(ui); add('build312-ui-javascript-syntax',true); }
catch(error){ add('build312-ui-javascript-syntax',false,String(error)); }

try {
  const require=createRequire(import.meta.url);
  const ts=require('typescript');
  const output=ts.transpileModule(ops,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:'supabase/functions/operations-manage/index.ts'});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  add('build312-operations-typescript-syntax',errors.length===0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
} catch(error) { add('build312-typescript-compiler-available',false,String(error)); }

for(const check of checks) console.log((check.ok?'PASS':'FAIL')+'  '+check.name+(check.detail?' — '+check.detail:''));
const failed=checks.filter((check)=>!check.ok);
console.log('\nBuild 312 Smart Reconciliation Workbench gate: '+(checks.length-failed.length)+'/'+checks.length+' passed.');
if(failed.length) process.exit(1);
