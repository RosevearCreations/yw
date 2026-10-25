import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,company,companyId,foreignCompanyId,ownerId,companyAdminTest,serviceKeys}
 from '../tests/fixtures/cross-service-learning-442.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/cross-service-learning-442.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {inspect,keys,labels}=scope.window.YWI442;
assert.deepEqual([...keys].sort(),[...serviceKeys].sort());
assert.equal(Object.keys(labels).length,6);
assert.equal(company.name,'Yard Rosevear');
assert.equal(company.owner_user_id,ownerId);
assert.equal(companyAdminTest.role,'company_admin');
assert.equal(companyAdminTest.scope_company_id,companyId);
assert.equal(companyAdminTest.real_auth_account,false);
assert.equal(companyAdminTest.password_copied,false);
assert.equal(companyAdminTest.grant.cross_company,false);
assert.equal(companyAdminTest.grant.payroll_bank_data,false);
assert.equal(companyAdminTest.grant.global_users,false);
const now=Date.now(),options={companyId,now};
const check=(r,state)=>{
 assert.equal(r.state,state,r.reason);
 for(const key of ['comparison_accepted','mutation_authorized','first_job_completion_authorized',
  'invoice_authorized','payroll_authorized'])assert.equal(r[key],false,key);
 for(const key of ['roi','employee_ranking','causal_improvement'])assert.equal(r[key],null,key);
 return r;
};
let result=check(inspect(fixture({now}),options),'partial_descriptive_source_presence_only');
assert.equal(result.services.length,6);
assert.ok(result.services.every(s=>s.state==='descriptive_source_presence_only'));
assert.ok(result.services.every(s=>s.previous.first_jobs===12&&s.current.first_jobs===12));
assert.ok(result.reason.includes('no proven business improvement'));
const zero=fixture({count:0,now});
result=check(inspect(zero,options),'hold');
assert.ok(result.services.every(s=>s.previous.first_jobs===0&&s.current.first_jobs===0));
check(inspect(fixture({count:9,now}),options),'hold');
check(inspect(fixture({count:12,enabled:false,now}),options),'hold');
const payload=modifier=>{const d=fixture({now});modifier(d);return d;};
function withhold(name,fn){const r=check(inspect(payload(fn),options),'withheld');assert.ok(r.reason,name);}
withhold('foreign tenant',d=>d.company_id=foreignCompanyId);
withhold('mutations must be disallowed',d=>d.mutation_authorized=true);
withhold('synthetic cannot pose as live source',d=>d.synthetic=true);
withhold('missing source',d=>d.source_coverage='partial');
withhold('cap',d=>d.total_company_jobs=2001);
withhold('wrong cap',d=>d.max_original_jobs=60);
withhold('missing service',d=>d.services.pop());
withhold('duplicate service',d=>d.services[5].service=d.services[0].service);
withhold('stale read',d=>d.captured_at=new Date(now-10*60000).toISOString());
withhold('future read',d=>d.captured_at=new Date(now+2*60000).toISOString());
withhold('wrong periods',d=>d.periods.current.start=d.periods.previous.start);
withhold('over-count stage',d=>d.services[0].previous.invoice_present=999);
withhold('impossible first count',d=>d.total_company_jobs=1);
const gaps=payload(d=>{d.services[0].previous.verified_customer_site=11;d.services[0].previous.unlinked_original_jobs=1;});
result=check(inspect(gaps,options),'partial_descriptive_source_presence_only');
assert.equal(result.services.find(s=>s.key==='landscape').state,'hold');
assert.equal(result.services.find(s=>s.key==='septic').state,'descriptive_source_presence_only');
const report=JSON.parse(read('docs/production_learning_review_442.json'));
assert.equal(report.item,442);
assert.equal(report.observed_at_utc,'2026-10-25T00:28:58.879321Z');
assert.equal(Object.keys(report.inspected_source_counts).length,16);
assert.ok(Object.values(report.inspected_source_counts).every(v=>v===0));
assert.deepEqual(report.six_service_review.map(x=>x.key),serviceKeys);
assert.ok(report.six_service_review.every(x=>x.status==='withheld'));
assert.equal(report.decision.roi,null);
assert.equal(report.decision.first_job_completion_rate,null);
assert.equal(report.decision.operational_owner_trial_accepted,false);
assert.equal(report.synthetic_company_admin_fixture.copies_global_credentials,false);
assert.equal(report.synthetic_company_admin_fixture.cross_tenant_access,false);
assert.deepEqual(report.bounded_next_build_priorities.map(x=>x.build).sort((a,b)=>a-b),
 Array.from({length:12},(_,i)=>443+i));
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'442 reviewer must never write');
for(const source of ['auth.getUser','ywi:auth-changed','ywi_rpc_cross_service_learning_442',
 'role','status','help.html#cross-service-learning-442'])assert.ok(js.includes(source),source);
const sql=read('sql/cross_service_learning_442.sql');
for(const required of ['ywi_422_assert_owner','v_company_jobs>2000',
 'row_number() over(partition by w.client_id order by w.created_at,w.id)',
 'public.ywi_company_client_links_422','public.ywi_company_site_links_422',
 'public.job_sessions','public.ar_invoices','public.ywi_landscape_field_receipts_424',
 'public.ywi_construction_permit_notes_425','public.ywi_aquatic_inspections_426',
 'public.ywi_snow_service_receipts_427','public.ywi_septic_disposal_receipts_428',
 'revoke all on function public.ywi_rpc_cross_service_learning_442',
 'to authenticated'])assert.ok(sql.includes(required),required);
assert.ok(read('index.html').includes('js/cross-service-learning-442.js'));
assert.ok(read('help.html').includes('id="cross-service-learning-442"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 442 — Production Learning'));
for(const script of ['test:cross-service-learning-442','test:browser:cross-service-learning-442']){
 assert.ok(JSON.parse(read('package.json')).scripts[script]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+script));
}
console.log('YW 442 dated real Production zero-source review, six-service cohorts, synthetic Yard Rosevear company-admin isolation: PASS');
