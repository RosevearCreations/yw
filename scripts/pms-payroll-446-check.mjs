import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {payroll,companyId,foreignCompanyId,employeeId,companyAdminTest}
 from '../tests/fixtures/pms-payroll-446.mjs';
const read=x=>readFileSync(x,'utf8');const js=read('js/pms-payroll-446.js');new Function(js);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,context);
const {inspect,statuses,dollars}=context.window.YWI446;const now=Date.now();
const args={companyId,now,allowed:true,employeeIds:new Set([employeeId])};
assert.equal(inspect(payroll({now}),args).state,'verified_payroll_readiness');
assert.equal(inspect(payroll({now}),args).canPay,false);
assert.equal(inspect(payroll({now,enabled:false,effective:false}),args).effective,false);
assert.deepEqual(Array.from(statuses),['draft','reviewed_for_planning','disputed']);
assert.equal(dollars(20400),'$204.00');
assert.equal(companyAdminTest.real_auth_account,false);
assert.equal(inspect(payroll({now}),{...args,allowed:false}).state,'withheld');
assert.equal(inspect(payroll({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
const altered=(fn)=>{const d=payroll({now});fn(d);return d;};
for(const [label,change] of [
 ['foreign HR employee',d=>{d.lines[0].employee_id='e4460000-0000-4446-8446-000000000009'}],
 ['duplicate id',d=>{d.lines.push(d.lines[0]);d.line_count++}],
 ['incorrect gross calculation',d=>{d.lines[0].gross_projection_cents=1}],
 ['unexpected tax execution',d=>{d.tax_filing_available=true}],
 ['unexpected payment',d=>{d.payroll_executed=true}],
 ['unexpected bank API',d=>{d.direct_deposit_available=true}],
 ['rate without effective access',d=>{d.effective=false}],
 ['too many lines',d=>{d.line_count=201}],
 ['future source',d=>{d.captured_at=new Date(now+100000).toISOString()}],
 ['stale source',d=>{d.captured_at=new Date(now-400000).toISOString()}],
 ['foreign company',d=>{d.company_id=foreignCompanyId}],
 ['invalid status',d=>{d.lines[0].reported_status='paid'}],
 ['unverified correction chain',d=>{d.lines[0].correction_of='a4460000-0000-4446-8446-000000000055'}]
])assert.equal(inspect(altered(change),args).state,'withheld',label);
for(const needle of ['auth.getUser','canViewModule','ywi_rpc_pms_payroll_snapshot_446',
 'ywi_rpc_pms_payroll_switch_446','ywi_rpc_pms_payroll_append_446',
 'ywi_rpc_pms_hr_snapshot_445','ywi:auth-changed','ywi:module-permissions-changed',
 'crypto?.randomUUID','p_correction_of','gross projection'])assert.ok(js.includes(needle),needle);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'All payroll writes require owner-gated RPCs');
const sql=read('sql/pms_payroll_readiness_446.sql').toLowerCase();
for(const needle of ['begin;','commit;','enable row level security','revoke all on public.ywi_pms_payroll_lines_446',
 'ywi_445_assert_hr_owner','module_key=\'finance\'','ywi_446_payroll_effective_enabled',
 'pg_advisory_xact_lock','correction_of','unique index','grant execute on function public.ywi_rpc_pms_payroll_append_446',
 'security definer set search_path'])assert.ok(sql.includes(needle),needle);
assert.ok(read('index.html').includes('/js/pms-payroll-446.js'));
assert.ok(read('help.html').includes('id="pms-payroll-readiness-446"'));
assert.ok(read('js/pms-module-navigation-443.js').includes('pms443Payroll'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 446 implementation'));
const pkg=JSON.parse(read('package.json'));
for(const command of ['test:pms-payroll-446','test:browser:pms-payroll-446']){
 assert.ok(pkg.scripts[command]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+command));}
console.log('YW 446 confidential source-scoped time, rates, corrections, owner Finance/manage gates, default OFF and synthetic payroll: PASS');
