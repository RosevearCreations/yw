import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,foreignCompanyId,serviceKeys} from '../tests/fixtures/pms-modular-acceptance-454.mjs';
const read=p=>readFileSync(p,'utf8');
const src=read('js/pms-modular-acceptance-454.js');new Function(src);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,context);
const {inspect,rosterOwned,keys}=context.window.YWI454;
assert.deepEqual([...keys],[...serviceKeys]);
const now=Date.now(),args={companyId,now,jobsAllowed:true};
const success=inspect(fixture({now}),args);
assert.equal(success.state,'verified_read_only');
assert.deepEqual([...success.enabled],['landscape','snow_removal','septic']);
assert.deepEqual([...success.disabled],['construction','water_parks','snow_plowing','arboriculture']);
assert.equal(success.receiptSample,1);assert.equal(success.historicalRead,true);
assert.equal(success.newWorkAuthorized,false);assert.equal(success.liveForeignTenantDenialTested,false);
assert.equal(success.releaseGreen,false);
assert.equal(inspect(fixture({now,enabled:[]}),args).enabled.length,0);
assert.equal(inspect(fixture({now,enabled:serviceKeys}),args).enabled.length,7);
assert.equal(rosterOwned([{id:companyId,name:'Yard Rosevear',owner_user_id:ownerId}],ownerId),true);
assert.equal(rosterOwned([{id:companyId,name:'Foreign',owner_user_id:foreignCompanyId}],ownerId),false);
const altered=fn=>{const value=fixture({now});fn(value);return value;};
for(const [name,change] of [
 ['foreign root',x=>x.company_id=foreignCompanyId],
 ['foreign menu',x=>x.menu.company_id=foreignCompanyId],
 ['foreign switch',x=>x.registry[0].company_id=foreignCompanyId],
 ['switch mismatch',x=>x.registry[0].enabled=false],
 ['missing seventh module',x=>x.menu.services.pop()],
 ['duplicate module',x=>x.registry[1].module_key=x.registry[0].module_key],
 ['foreign audit',x=>x.audit[0].company_id=foreignCompanyId],
 ['contradictory latest audit',x=>x.audit[0].next_enabled=false],
 ['foreign work receipt',x=>x.receipts[0].company_id=foreignCompanyId],
 ['duplicate receipt',x=>x.receipts.push({...x.receipts[0]})],
 ['bad receipt target',x=>x.receipts[0].target_id='not-a-uuid'],
 ['stale server',x=>x.menu.captured_at=new Date(now-360000).toISOString()],
 ['future clock',x=>x.menu.captured_at=new Date(now+130000).toISOString()],
 ['wrong owner guard',x=>x.menu.owner_guard='none'],
 ['missing history',x=>x.menu.historical_audit_retained=false],
 ['unverified synthetic source',x=>x.menu.synthetic=true],
 ['audit over cap',x=>x.audit=Array.from({length:27},(_,i)=>({...x.audit[0],id:100+i}))],
 ['work receipt over cap',x=>x.receipts=Array.from({length:81},(_,i)=>({...x.receipts[0],target_id:
  'a4540000-0000-4454-8454-'+String(i+100).padStart(12,'0')}))]
])assert.equal(inspect(altered(change),args).state,'withheld',name);
assert.equal(inspect(fixture({now}),{...args,jobsAllowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
for(const needle of ['auth.getUser','YWISecurity','ywi_rpc_pms_navigation_443','ywi_new_work_gate_receipts_421',
 'ywi_company_service_modules','ywi_company_service_module_audit','ywi:company-service-offering-changed',
 'ywi:auth-changed','pms454Company','pms454Release','releaseGreen:false'])assert.ok(src.includes(needle),needle);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(src),'Acceptance is read-only');
assert.ok(read('js/company-service-registry-420.js').includes("new CustomEvent('ywi:company-service-offering-changed'"));
assert.ok(read('js/pms-module-navigation-443.js').includes("'ywi:company-service-offering-changed'"));
assert.ok(read('js/new-work-company-gate-421.js').includes("'arboriculture'"));
const sql=read('sql/pms_septic_arboriculture_451.sql');
for(const name of ['v_count<>7','arboriculture','ywi_421_assert_company_new_work','ywi_rpc_pms_navigation_443',
 'ywi_422_assert_owner'])assert.ok(sql.includes(name),name);
const reg=read('sql/company_service_offering_registry_420.sql');
for(const name of ['enable row level security','owner_user_id = (select auth.uid())',
 'ywi_company_audit_owner_read_420','ywi_company_modules_owner_toggle_420'])assert.ok(reg.includes(name),name);
const gate=read('sql/company_new_work_entitlement_421.sql');
assert.ok(gate.includes('before insert or update on public.work_orders'));
assert.ok(gate.includes('before insert or update on public.estimates'));
assert.ok(read('index.html').includes('js/pms-modular-acceptance-454.js'));
assert.ok(read('help.html').includes('id="pms-modular-production-acceptance-454"'));
assert.ok(read('style.css').includes('.pms454-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 454 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-modular-acceptance-454','test:browser:pms-modular-acceptance-454']){
 assert.ok(pkg.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 454: seven-module parity, OFF, foreign tenant denial, historical sampling, 390px acceptance and no false Production GREEN: PASS');
