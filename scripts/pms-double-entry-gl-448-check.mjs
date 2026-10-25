import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gl,companyId,foreignCompanyId,journalId,period,companyAdminTest}
 from '../tests/fixtures/pms-double-entry-gl-448.mjs';
const read=p=>readFileSync(p,'utf8'),js=read('js/pms-double-entry-gl-448.js');new Function(js);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,ctx);
const {inspect,accounts}=ctx.window.YWI448,now=Date.now(),auth={companyId,allowed:true,now};
assert.equal(inspect(gl({now}),auth).state,'verified_test_gl');
assert.equal(inspect(gl({now}),auth).totalDebits,12500);
assert.equal(inspect(gl({now}),auth).canPost,false);
assert.equal(inspect(gl({now,locked:true}),auth).periods[0].locked,true);
assert.equal(inspect(gl({now,enabled:false}),auth).enabled,false);
assert.equal(inspect(gl({now,reversed:true}),auth).totalDebits,25000);
assert.equal(inspect(gl({now,reversed:true}),auth).accounts[0].net_debit_cents,0);
assert.ok(accounts['2000'].includes('liability'));
assert.equal(companyAdminTest.password_copied,false);
const altered=fn=>{const s=gl({now});fn(s);return s;};
for(const [reason,mutation] of [
 ['cross company',s=>s.company_id=foreignCompanyId],
 ['stale',s=>s.captured_at=new Date(now-400000).toISOString()],
 ['real posting',s=>s.posting_available=true],
 ['bank access',s=>s.bank_access=true],
 ['tax filing',s=>s.tax_filing_available=true],
 ['original accounts changed',s=>s.real_balance_changed=true],
 ['fake test mode',s=>s.test_mode=false],
 ['unbalanced line',s=>s.journals[0].lines[0].cents=12000],
 ['unknown account',s=>s.journals[0].lines[0].account='9999'],
 ['bad liability control',s=>s.accounts[0].liability_debit_warning=true],
 ['inflated source total',s=>s.total_debits_cents=25000],
 ['duplicate journals',s=>s.journals.push({...s.journals[0]})],
 ['period mismatch',s=>s.journals[0].effective_on='2026-11-15'],
 ['foreign period',s=>s.periods[0].period_start='2026-11-01'],
 ['OFF but private data leaks',s=>s.enabled=false],
 ['bad status',s=>s.journals[0].review_status='posted']
])assert.equal(inspect(altered(mutation),auth).state,'withheld',reason);
assert.equal(inspect(gl({now}),{...auth,companyId:foreignCompanyId}).state,'withheld');
assert.equal(inspect(gl({now}),{...auth,allowed:false}).state,'withheld');
const illegal=gl({now,reversed:true});illegal.journals[1].lines[0].side='debit';
assert.equal(inspect(illegal,auth).state,'withheld','reversal must exactly invert');
const sql=read('sql/pms_double_entry_gl_448.sql').toLowerCase();
for(const needle of ['create constraint trigger','deferrable initially deferred',
 'enable row level security','revoke all on public.ywi_pms_gl_lines_448',
 'ywi_447_assert_accounting_scope','pg_advisory_xact_lock',
 'where reversal_of is not null','source_reference','test_mode=true','period locked',
 'reconciliation_saved','bank_verified','posting_available',
 'grant execute on function public.ywi_rpc_pms_gl_append_448',
 'ywi_rpc_pms_gl_review_448','ywi_rpc_pms_gl_reconcile_448'])assert.ok(sql.includes(needle),needle);
assert.ok(!/\.\s*(insert|update|upsert|delete)\s*\(/.test(js),'no direct browser table mutations');
for(const needle of ['auth.getUser','ywi_rpc_pms_gl_snapshot_448','ywi_rpc_pms_gl_toggle_448',
 'ywi_rpc_pms_gl_lock_448','ywi_rpc_pms_gl_append_448','ywi_rpc_pms_gl_review_448',
 'ywi_rpc_pms_gl_reconcile_448','ywi:auth-changed','ywi:module-permissions-changed'])
 assert.ok(js.includes(needle),needle);
assert.ok(read('index.html').includes('/js/pms-double-entry-gl-448.js'));
assert.ok(read('help.html').includes('id="pms-double-entry-gl-448"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 448 implementation'));
const scripts=JSON.parse(read('package.json')).scripts,workflow=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-double-entry-gl-448','test:browser:pms-double-entry-gl-448']){
 assert.ok(scripts[name],name);assert.ok(workflow.includes('npm run '+name),name);}
console.log('YW 448 simulated double-entry balance, immutable journal lines, periods, liability controls, reversals, reconciliation preview and tenant denial: PASS');
