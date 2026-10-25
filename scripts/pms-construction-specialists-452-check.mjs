import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import vm from'node:vm';
import{fixture,companyId,foreignCompanyId,projectConcreteId,projectFibreId}from'../tests/fixtures/pms-construction-specialists-452.mjs';
const read=p=>readFileSync(p,'utf8');
const code=read('js/pms-construction-specialists-452.js');new Function(code);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(code,scope);
const{inspect,specialties,activities,permitStates,fieldStates}=scope.window.YWI452;
const now=Date.now(),ctx={companyId,now,jobsAllowed:true};
assert.deepEqual([...specialties],['light_construction','concrete','fibre_line','excavation','land_clearance','ditch_digging']);
assert.equal(activities.concrete.includes('pour'),true);assert.equal(activities.fibre_line.includes('pour'),false);
assert.equal(permitStates.includes('approved'),false);assert.equal(fieldStates.includes('approved'),false);
const data=inspect(fixture({now}),ctx);assert.equal(data.state,'verified_construction');
assert.equal(data.orders.length,2);assert.equal(data.projects.length,2);assert.equal(data.evidence.length,2);
assert.equal(data.canPermit,false);assert.equal(data.canLocate,false);assert.equal(data.canDispatch,false);
assert.equal(data.canInvoice,false);assert.equal(data.canApprove,false);
assert.equal(inspect(fixture({now,enabled:false}),ctx).state,'verified_construction');
for(const[label,change]of[
 ['foreign root',x=>x.company_id=foreignCompanyId],
 ['foreign project',x=>x.projects[0].company_id=foreignCompanyId],
 ['foreign order',x=>x.orders[0].company_id=foreignCompanyId],
 ['foreign field',x=>x.evidence[0].company_id=foreignCompanyId],
 ['cross-company project',x=>x.projects[0].work_order_id=projectFibreId],
 ['wrong original site',x=>x.projects[0].site_id=foreignCompanyId],
 ['foreign child',x=>x.evidence[0].project_id=foreignCompanyId],
 ['duplicate id',x=>x.evidence[1].id=x.evidence[0].id],
 ['invalid activity',x=>x.evidence[0].activity='cable_route'],
 ['unlocated fibre claim',x=>x.evidence[1].utility_locate_source=null],
 ['unreviewed safety',x=>x.evidence[1].safety_source=null],
 ['false permit approval',x=>x.permit_verified=true],
 ['false excavation clearance',x=>x.utility_clearance_verified=true],
 ['false dispatch',x=>x.dispatch_authorized=true],
 ['false finance posting',x=>x.finance_posted=true],
 ['wrong count',x=>x.evidence_count=35],
 ['stale evidence',x=>x.captured_at=new Date(now-360000).toISOString()],
 ['future timestamp',x=>x.captured_at=new Date(now+125000).toISOString()],
 ['missing scope',x=>x.projects[0].original_scope_source='']
]){const d=fixture({now});change(d);assert.equal(inspect(d,ctx).state,'withheld',label);}
assert.equal(inspect(fixture({now}),{...ctx,companyId:foreignCompanyId}).state,'withheld');
assert.equal(inspect(fixture({now}),{...ctx,jobsAllowed:false}).state,'withheld');
for(const s of ['owner452Construction','pms452Tab',
 'ywi_rpc_pms_construction_snapshot_452','ywi_rpc_pms_construction_project_452',
 'ywi_rpc_pms_construction_evidence_452','auth.getUser','YWISecurity',
 'ywi:auth-changed','ywi:module-permissions-changed','pms-construction-452'])
 assert.ok(code.includes(s),s);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(code),'No direct browser writes');
const sql=read('sql/pms_construction_specialists_452.sql').toLowerCase();
for(const s of ['begin;','commit;','enable row level security',
 'ywi_pms_construction_projects_452','ywi_pms_construction_evidence_452',
 'revoke all on public.ywi_pms_construction_projects_452',
 'revoke all on public.ywi_pms_construction_evidence_452',
 'ywi_425_assert_construction_order','ywi_421_assert_company_new_work',
 'ywi_422_assert_owner','w.client_site_id=p_site_id',
 'foreign key(company_id,client_id,site_id)','foreign key(company_id,project_id)',
 'pg_advisory_xact_lock','on conflict(company_id,request_id) do nothing',
 'operator_reported','v_utility is null','changed project replay','changed field evidence replay',
 'grant execute on function public.ywi_rpc_pms_construction_snapshot_452'])
 assert.ok(sql.includes(s),s);
assert.ok(!sql.includes(projectConcreteId),'No synthetic project in live migration');
assert.ok(read('index.html').includes('/js/pms-construction-specialists-452.js'));
assert.ok(read('help.html').includes('id="pms-construction-452"'));
assert.ok(read('style.css').includes('.pms452-grid'));
assert.ok(read('js/pms-module-navigation-443.js').includes("target:'owner452Construction'"));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 452 implementation'));
for(const s of ['test:pms-construction-specialists-452','test:browser:pms-construction-specialists-452']){
 assert.ok(JSON.parse(read('package.json')).scripts[s]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+s));}
console.log('YW Build 452 company-scoped Construction/Concrete/Fibre/Excavation source and HOLD checks: PASS');
