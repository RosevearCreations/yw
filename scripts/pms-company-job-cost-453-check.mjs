import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import vm from'node:vm';
import{fixture,companyId,company2Id,foreignCompanyId,orderId,costId,revenueId}from'../tests/fixtures/pms-company-job-cost-453.mjs';
const read=p=>readFileSync(p,'utf8'),code=read('js/pms-company-job-cost-453.js');new Function(code);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(code,context);
const{inspect,compare,projection,categories}=context.window.YWI453;
const now=Date.now(),ctx={companyId,now,allowed:true};
assert.equal(categories.length,6);
const first=inspect(fixture({now}),ctx);assert.equal(first.state,'verified_planning_only');
assert.equal(first.report.revenue_cents,40000);assert.equal(first.report.cost_cents,12500);
assert.equal(first.report.difference_cents,27500);assert.equal(first.wagesVisible,false);
const second=inspect(fixture({now,company:company2Id}),{...ctx,companyId:company2Id});
assert.equal(compare([first,second]).difference_cents,55000);
assert.equal(compare([first,first]),null,'same company cannot be counted twice');
assert.equal(compare([first,{state:'withheld'}]),null,'partial portfolio not consolidated');
const revised=fixture({now});revised.lines.push({...revised.lines[1],
 id:'84530000-0000-4453-8453-000000000011',amount_cents:14500,correction_of:costId});
revised.line_count=3;revised.report.cost_cents=14500;revised.report.difference_cents=25500;
revised.report.included_count=2;
assert.equal(inspect(revised,ctx).state,'verified_planning_only','leaf replaces previous entry');
assert.equal(projection(revised.lines).included_count,2);
for(const[label,mutate]of[
 ['foreign root',x=>x.company_id=foreignCompanyId],
 ['foreign order',x=>x.orders[0].company_id=foreignCompanyId],
 ['foreign line',x=>x.lines[0].company_id=foreignCompanyId],
 ['foreign work order',x=>x.lines[0].work_order_id=foreignCompanyId],
 ['duplicate line',x=>x.lines[1].id=revenueId],
 ['wrong amount',x=>x.lines[1].amount_cents=-1],
 ['different server total',x=>x.report.cost_cents=0],
 ['falsely counted draft',x=>x.lines[1].report_status='draft'],
 ['wage disclosure',x=>x.wages_exposed=true],
 ['individual rate disclosure',x=>x.individual_rates_exposed=true],
 ['cross-company grant',x=>x.cross_company_grant=true],
 ['false posting',x=>x.ledger_posted=true],
 ['false profit verification',x=>x.verified_profit=true],
 ['old evidence',x=>x.captured_at=new Date(now-360000).toISOString()],
 ['future snapshot',x=>x.captured_at=new Date(now+125000).toISOString()],
 ['missing accounting scope',x=>x.accounting_fields=['costs']],
 ['missing source',x=>x.lines[0].source_reference='']
]){const x=fixture({now});mutate(x);assert.equal(inspect(x,ctx).state,'withheld',label);}
assert.equal(inspect(fixture({now}),{...ctx,allowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...ctx,companyId:foreignCompanyId}).state,'withheld');
const sql=read('sql/pms_company_job_cost_453.sql').toLowerCase();
for(const s of ['begin;','commit;','enable row level security',
 'revoke all on public.ywi_pms_job_cost_lines_453','ywi_453_assert_cost_scope',
 "ywi_447_assert_accounting_scope(p_company_id,'costs')",
 "ywi_447_assert_accounting_scope(p_company_id,'reports')",
 'ywi_company_site_links_422','w.company_id=p_company_id',
 'pg_advisory_xact_lock','changed request replay denied','ywi_453_no_rewrite',
 'one_successor','successor.correction_of=l.id','original_438_costs_not_duplicated',
 "'wages_exposed',false","'verified_profit',false",
 'grant execute on function public.ywi_rpc_pms_job_cost_snapshot_453',
 'grant execute on function public.ywi_rpc_pms_job_cost_append_453'])assert.ok(sql.includes(s),s);
assert.ok(!sql.includes(orderId.toLowerCase()),'no synthetic job in live schema');
for(const s of ['auth.getUser','YWISecurity','ywi:auth-changed',
 'ywi:module-permissions-changed','pms453Portfolio','pms453Correction',
 'ywi_rpc_pms_job_cost_snapshot_453','ywi_rpc_pms_job_cost_append_453'])
 assert.ok(code.includes(s),s);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(code),'No direct browser mutations');
assert.ok(read('index.html').includes('pms-company-job-cost-453.js'));
assert.ok(read('help.html').includes('id="pms-company-job-cost-453"'));
assert.ok(read('style.css').includes('#owner453JobCost'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 453 implementation'));
for(const s of ['test:pms-company-job-cost-453','test:browser:pms-company-job-cost-453']){
 assert.ok(JSON.parse(read('package.json')).scripts[s]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+s));}
console.log('YW Build 453 financial isolation, correction, report parity and release wiring: PASS');
