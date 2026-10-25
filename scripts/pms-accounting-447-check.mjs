import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {accounting,companyId,foreignCompanyId,allAccess,companyAdminTest}
 from '../tests/fixtures/pms-accounting-447.mjs';
const read=x=>readFileSync(x,'utf8');const js=read('js/pms-accounting-447.js');new Function(js);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,context);
const {inspect,scopes,categories}=context.window.YWI447;const now=Date.now(),args={companyId,now,allowed:true};
assert.equal(inspect(accounting({now}),args).state,'verified_accounting_review_only');
assert.equal(inspect(accounting({now}),args).canPost,false);
assert.equal(inspect(accounting({now,enabled:false}),args).enabled,false);
assert.deepEqual(Array.from(scopes),['receivables','payables','costs','reports','payroll_reference']);
assert.equal(categories.tax_note,'reports');assert.equal(companyAdminTest.password_copied,false);
const limited=accounting({now,access:{...allAccess,payables:false,costs:false}});
assert.equal(limited.drafts.some(x=>x.category==='payable'||x.category==='job_cost'),false);
assert.equal(inspect(limited,args).state,'verified_accounting_review_only');
assert.equal(inspect(accounting({now}),{...args,allowed:false}).state,'withheld');
assert.equal(inspect(accounting({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
const altered=fn=>{const d=accounting({now});fn(d);return d};
for(const [label,change] of [
 ['bank turned on',d=>{d.access.bank=true}],
 ['payment executed',d=>{d.payment_executed=true}],
 ['tax filed',d=>{d.tax_filing_available=true}],
 ['invoice created',d=>{d.invoices_created=true}],
 ['duplicate draft',d=>{d.drafts[1].id=d.drafts[0].id}],
 ['permission revoked without redaction',d=>{d.access.costs=false}],
 ['cross-property pair',d=>{d.drafts[2].site_id=null}],
 ['foreign company',d=>{d.company_id=foreignCompanyId}],
 ['unposted status faked paid',d=>{d.drafts[0].reported_status='paid'}],
 ['foreign currency',d=>{d.drafts[0].currency='USD'}],
 ['invalid amount',d=>{d.drafts[0].amount_cents=-1}],
 ['stale source',d=>{d.captured_at=new Date(now-360001).toISOString()}],
 ['source count mismatch',d=>{d.draft_count=10}],
 ['OFF with retained active scope',d=>{d.enabled=false}]
])assert.equal(inspect(altered(change),args).state,'withheld',label);
for(const needle of ['auth.getUser','ywi_rpc_pms_accounting_snapshot_447',
 'ywi_rpc_pms_accounting_config_447','ywi_rpc_pms_accounting_append_447',
 'ywi_rpc_company_customers_422','ywi_rpc_customer_history_422',
 'crypto?.randomUUID','ywi:auth-changed','ywi:module-permissions-changed'])assert.ok(js.includes(needle),needle);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'Accounting writes require gated RPCs');
const sql=read('sql/pms_accounting_access_447.sql').toLowerCase();
for(const needle of ['begin;','commit;','enable row level security','revoke all on public.ywi_pms_accounting_drafts_447',
 'ywi_446_assert_payroll_owner','ywi_446_payroll_effective_enabled',
 'allow_payroll_reference','ywi_422_assert_link','pg_advisory_xact_lock',
 'security definer set search_path','ledger_posted','payment_executed',
 'grant execute on function public.ywi_rpc_pms_accounting_append_447'])assert.ok(sql.includes(needle),needle);
assert.ok(read('index.html').includes('/js/pms-accounting-447.js'));
assert.ok(read('help.html').includes('id="pms-accounting-access-447"'));
assert.ok(read('js/pms-module-navigation-443.js').includes('pms443Accounting'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 447 implementation'));
const pkg=JSON.parse(read('package.json'));
for(const command of ['test:pms-accounting-447','test:browser:pms-accounting-447']){
 assert.ok(pkg.scripts[command]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+command));}
console.log('YW 447 company Accounting OFF default, independent A/R/AP/Costs/Reports/Payroll gates, unposted drafts, no bank and original company owner checks: PASS');
