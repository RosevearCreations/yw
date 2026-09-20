#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';

const read=(file)=>fs.readFileSync(file,'utf8');
const ops=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const sql124=read('sql/124_accounting_cost_payment_reconciliation_remittance_equipment_depth.sql');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build313-existing-schema-supports-adjustments',
  all(sql124,['application_type','credit_amount','discount_amount','writeoff_amount','overpayment_amount','review_status','application_payload']),
  'Existing schema already supports Build 313 application categories and review evidence.');
add('build313-no-schema-migration-added',
  !fs.readdirSync('sql').some((name)=>/^313[_-]/.test(name)),
  'Build 313 itself remains source-only; later roadmap builds may legitimately advance the schema.');
add('build313-preview-reuses-existing-authority',
  !boundaries.includes('payment_application_preview:')
    && boundaries.includes("payment_action_request: contract('payment_action_request', 'finance', 'create', 'write', 'payments', 'finance.payment_action.requested')")
    && all(ops,["body.preview_only === true","preview_only:true","posting_enabled:false"]),
  'Preview is a non-mutating mode of the existing payment request authority, so the Schema 164 action registry does not drift.');
add('build313-supported-application-types',
  all(ops,["'receipt'","'unapplied_cash'","'deposit'","'credit'","'discount'","'writeoff'","'overpayment'"]),
  'Receipt, unapplied cash, deposit, credit, discount, write-off and overpayment flows are explicit.');
add('build313-validates-balances-and-identity',
  all(ops,['customer_identity','invoice_balance','available_balance','customer_identity_match','amount <= invoiceBalance','amount <= availableAmount']),
  'Server validation checks invoice balance, source availability and customer identity.');
add('build313-validates-date-period-and-proof',
  all(ops,['application_date','sourceDateOk',"assertPeriodOpen(supabase, applicationDate, 'ar')","push('proof'"]),
  'Server validation checks date sequencing, open A/R period and evidence reference.');
add('build313-authoritative-source-directories',
  all(ops,["from('ar_invoices')","from('ar_payments')","from('customer_deposit_requests')","ar_invoices: arInvoices","ar_payments: arPayments","customer_deposits: customerDeposits"]),
  'Operator selectors are hydrated from authoritative A/R sources.');
add('build313-request-idempotency-and-audit',
  all(ops,["idempotencyKey(req, body, 'payment')","upsert(row, { onConflict: 'action_key'","operation_action: action","payment_application: application"]),
  'Validated applications preserve idempotency and audit payload evidence.');
add('build313-posting-hard-blocked',
  ops.includes('Ledger posting is disabled for Build 313')
    && ui.includes('ledger posting remains OFF')
    && !ui.includes("button('Post to ledger','payment-post'"),
  'Build 313 approval is review-only and exposes no ledger-post UI action.');
add('build313-ui-server-preview-required',
  all(ui,['Payment Application &amp; A/R Completion','preview_only:true','paymentApplicationPreview','Preview and pass all A/R application checks before submitting.','oc_ar_application_submit']),
  'A/R operator submission requires a passing server preview.');
add('build313-ui-authoritative-selectors',
  all(ui,['data-oc-ar-invoice-select','data-oc-ar-payment-select','data-oc-ar-deposit-select','hydrateArApplicationSelects']),
  'Invoice, receipt/unapplied cash and paid deposit sources are explicit selectors.');
add('build313-existing-write-boundary-retained',
  boundaries.includes("payment_action_request: contract('payment_action_request', 'finance', 'create', 'write', 'payments', 'finance.payment_action.requested')")
  && boundaries.includes("payment_action_decision: contract('payment_action_decision', 'finance', 'approve', 'write', 'payments', 'finance.payment_action.decided')"),
  'Existing request/approval authorities remain unchanged.');
add('build313-help-updated',
  all(help,['Payment Application &amp; A/R Completion','unapplied cash','write-offs','ledger posting remains OFF']),
  'Help documents the Build 313 workflow and fail-closed posting boundary.');
add('build313-source-command-wired',
  pkg.scripts?.['test:payment-application-ar-completion']==='node scripts/payment-application-ar-completion-check.mjs');
add('build313-browser-command-wired',
  pkg.scripts?.['test:browser:payment-application-ar-completion']==='playwright test --config=playwright.config.mjs tests/browser/payment-application-ar-completion.spec.mjs');
add('build313-workflow-source-gate-wired',workflow.includes('npm run test:payment-application-ar-completion'));
add('build313-workflow-browser-gate-wired',workflow.includes('npm run test:browser:payment-application-ar-completion'));
add('build313-no-provider-enablement',
  !/(PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true|FINANCE_POSTING_EXECUTION_ENABLED\s*=\s*true|provider_mutation\s*[:=]\s*true)/i.test(ui+ops),
  'No provider or Finance posting feature flag is enabled.');

try { new Function(ui); add('build313-ui-javascript-syntax',true); }
catch(error){ add('build313-ui-javascript-syntax',false,String(error)); }

try {
  const require=createRequire(import.meta.url);
  const ts=require('typescript');
  const output=ts.transpileModule(ops,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:'supabase/functions/operations-manage/index.ts'});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  add('build313-operations-typescript-syntax',errors.length===0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
} catch(error) { add('build313-typescript-compiler-available',false,String(error)); }

for(const check of checks) console.log((check.ok?'PASS':'FAIL')+'  '+check.name+(check.detail?' — '+check.detail:''));
const failed=checks.filter((check)=>!check.ok);
console.log('\nBuild 313 Payment Application & A/R Completion gate: '+(checks.length-failed.length)+'/'+checks.length+' passed.');
if(failed.length) process.exit(1);
