import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const catalog=read('js/yw580-module-catalog.js');
const blueprints=read('js/yw580-workflow-blueprints.js');
const settings=read('js/yw580-specialty-settings.js');
const css=read('theme-modules-580.css');
const html=read('index.html');
const sql=read('sql/yw580_specialty_entitlements_STAGING_ONLY.sql');
const docs=JSON.parse(read('docs/integration/YW580_SERVICE_MODULES_AND_LINEAGE_11.json'));
const pkg=JSON.parse(read('package.json'));
for(const source of [catalog,blueprints,settings])new vm.Script(source);
const context={window:{},document:{readyState:'loading',addEventListener(){}},location:{hash:''}};
vm.runInNewContext(catalog,context);
vm.runInNewContext(blueprints,context);
const modules=Array.from(context.window.YW580Catalog.modules,x=>x.key);
assert.deepEqual(modules,['landscape','snow_removal','snow_plowing','septic','arboriculture','construction',
 'water_parks','ponds','skateparks']);
const specs=context.window.YW580Blueprints;
assert.deepEqual(Object.keys(specs).sort(),[...modules].sort());
for(const [key,details] of Object.entries(specs)){
 for(const field of ['summary','steps','quote','photos','resources','maintenance','finance','crossModule']){
  assert.ok(details[field]?.length>=1,key+' '+field);
 }
 assert.ok(details.photos.length>=2,key+' photo evidence stages');
}
const company='b2222222-2222-4222-8222-222222222222',now=Date.now();
const valid={company_id:company,captured_at:new Date(now).toISOString(),owner_guard:'ywi_422_assert_owner',
 synthetic:false,mutation_authorized:false,privacy_minimized:true,
 services:[{company_id:company,module_key:'ponds',enabled:true},{company_id:company,module_key:'skateparks',enabled:false}]};
const inspect=context.window.YW580Catalog.inspectSpecialty;
assert.equal(inspect(valid,company,now).state,'VERIFIED_NAVIGATION_ONLY');
assert.equal(inspect(valid,company,now).canWrite,false);
let failures=0;
const reject=(name,modify,foreign=company)=>{
 const p=structuredClone(valid);modify(p);
 assert.equal(inspect(p,foreign,now).state,'HOLD',name);failures++;
};
reject('foreign company',x=>x.company_id='c3333333-3333-4333-8333-333333333333');
reject('foreign service row',x=>x.services[0].company_id='c3333333-3333-4333-8333-333333333333');
reject('extra module',x=>x.services.push({...x.services[0]}));
reject('missing module',x=>x.services.pop());
reject('duplicate module',x=>x.services[1].module_key='ponds');
reject('invalid on/off',x=>x.services[0].enabled='true');
reject('synthetic',x=>x.synthetic=true);
reject('mutations',x=>x.mutation_authorized=true);
reject('privacy',x=>x.privacy_minimized=false);
reject('wrong guard',x=>x.owner_guard='sysop');
reject('stale read',x=>x.captured_at=new Date(now-300000).toISOString());
reject('future read',x=>x.captured_at=new Date(now+120000).toISOString());
assert.ok(failures>=12);
for(const part of ['id="yw579ModuleTier"','id="yw579TierHost"','id="mainNav"'])assert.ok(html.includes(part));
for(const part of ['/js/yw580-workflow-blueprints.js','/js/yw580-module-catalog.js',
 '/js/yw580-specialty-settings.js','/theme-modules-580.css'])assert.ok(html.includes(part),part);
for(const part of ['theme-modules-580.css','js/yw580-module-catalog.js'])assert.ok(read('scripts/build-vercel-site.mjs').includes(part));
for(const part of ['#yw580ServiceCatalog','[data-yw580-state="on"]','[data-yw580-state="off"]',
 '#yw579PlanningNav,#yw579ServiceNav{display:none!important}','url("/icons/yw579-angle-mesh.svg")',
 '@media(max-width:480px)','prefers-reduced-motion'])assert.ok(css.includes(part),part);
assert.ok(catalog.includes("sb.rpc('ywi_rpc_specialty_entitlements_580'"));
assert.ok(catalog.includes('owner()&&baseSnapshot.verified===true')||catalog.includes('baseSnapshot.verified!==true'));
assert.ok(catalog.includes('window.YW579Navigation?.choose?.(key)'));
assert.ok(catalog.includes("state.selected=key"));
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(catalog));
assert.ok(settings.includes("sb.rpc('ywi_rpc_specialty_update_580'"));
assert.ok(settings.includes('window.confirm('));
assert.ok(settings.includes('p_expected:item.enabled'));
assert.ok(settings.includes('new_work_authorized!==false'));
assert.ok(sql.includes('primary key(company_id,module_key)'));
assert.ok(sql.includes('enable row level security'));
assert.ok(sql.includes('p_expected boolean,p_enabled boolean'));
assert.ok(sql.includes('ywi_422_assert_owner'));
assert.ok(sql.includes('ywi_580_specialty_audit'));
assert.ok(sql.includes("values (new.id,'ponds',false),(new.id,'skateparks',false)"));
assert.ok(sql.includes('to authenticated;'));
assert.ok(!/grant\s+(insert|update|delete)[^;]*to\s+authenticated/i.test(sql));
assert.equal(docs.sourceStatus,'MIGRATION_NOT_APPLIED');
assert.equal(docs.modules.length,9);
assert.equal(docs.crossModuleEvents.mode,'CONTRACT_ONLY');
assert.equal(docs.financialExecutionEnabled,false);
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558'].includes('yw580-scope-check.mjs'));
assert.ok(pkg.scripts['test:browser:landscape-supervisor-resolution-558'].includes('yw580-tier2-catalog.spec.mjs'));
console.log('YW580 all nine Tier-2 service modules, original owner-grants, two default-OFF entitlement contracts, nine blueprints, responsive themes and 12 negative checks PASS');
