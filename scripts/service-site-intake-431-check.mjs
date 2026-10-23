import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const js=read('js/service-site-intake-431.js');new Function(js);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(read('js/six-service-owner-trial-430.js'),sandbox);
vm.runInNewContext(js,sandbox);
const {keys,inspect,templates}=sandbox.window.YWI431;
assert.equal(keys.length,6);
assert.equal(new Set(keys).size,6);
assert.ok(keys.every(key=>templates[key].fields.length>=5));
assert.notDeepEqual([...templates.snow_removal.fields],[...templates.snow_plowing.fields]);
const at='2026-10-23T18:00:00.000Z',now=Date.parse(at);
const company={id:'c1',name:'Real company',owner_user_id:'owner'};
const services=keys.map(module_key=>({company_id:'c1',module_key,enabled:true}));
const customers=[{id:'u1',name:'Real customer',is_active:true}];
const history={company_id:'c1',client_id:'u1',legacy_unscoped_excluded:true,
 history_limit_per_type:80,properties:[{id:'p1',name:'Actual site',address:'Ontario'}],estimates:[],work_orders:[]};
const site={company_id:'c1',client_id:'u1',site_id:'p1',canonical_source:'client_sites_212',
 is_active:true,updated_at:at,property_reviewed_at:at,access_last_verified_at:at,
 approximate_serviceable_area:450,area_unit:'sq_m',access_notes:'Narrow gate',gate_fence_summary:'Key with foreman',
 parking_trailer_limits:'No overnight trucks',hazard_notes:null,utility_locate_notes:null,
 zones:[{id:'z1',zone_name:'Front lawn'}],safety_evidence_source:'NOT_QUERIED',safety_approval:'UNVERIFIED'};
const input={company,uid:'owner',services,customers,customerId:'u1',history,propertyId:'p1',site,retrievedAt:at};
const run=p=>inspect(p,now);
let r=run(input);
assert.equal(r.state,'owner_site_review_required');assert.equal(r.cards.length,6);
assert.equal(r.safety_status,'UNVERIFIED');assert.equal(r.approved,false);
assert.ok(r.cards.every(c=>!c.approved&&c.safety_status==='UNVERIFIED'));
assert.equal(r.cards.find(c=>c.key==='landscape').requirements.find(x=>x.field==='area').value,'450 sq_m');
assert.equal(r.cards.find(c=>c.key==='septic').requirements.find(x=>x.field==='utilities').state,'missing_source');
assert.equal(r.cards.find(c=>c.key==='snow_plowing').requirements.find(x=>x.field==='parking').state,'source_recorded');
for(const bad of [
 {...input,uid:'foreign'},
 {...input,company:{...company,owner_user_id:'foreign'}},
 {...input,site:{...site,company_id:'foreign'}},
 {...input,site:{...site,client_id:'foreign'}},
 {...input,site:{...site,site_id:'different'}},
 {...input,site:{...site,safety_approval:'APPROVED'}},
 {...input,site:{...site,updated_at:'bad'}},
 {...input,site:{...site,zones:[...site.zones,site.zones[0]]}},
 {...input,history:{...history,properties:[]}},
 {...input,history:{...history,legacy_unscoped_excluded:false}},
 {...input,retrievedAt:'2026-10-23T17:00:00.000Z'},
 {...input,site:null}
 ])assert.equal(run(bad).state,'withheld');
r=run({...input,services:services.map(s=>({...s,enabled:s.module_key!=='septic'}))});
assert.equal(r.cards.find(c=>c.key==='septic').state,'offering_disabled');
const sql=read('sql/service_site_intake_431.sql');
for(const token of ['ywi_422_assert_link','ywi_company_site_links_422','client_sites','client_site_zones',
 'security definer','limit 51','jsonb_array_length','grant execute','safety_approval','UNVERIFIED','NOT_QUERIED'])
 assert.ok(sql.includes(token),token);
assert.ok(!/\b(insert into|update public\.|delete from|drop table|alter table)\b/i.test(sql));
assert.ok(!/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(js));
for(const token of ['ywi_companies','ywi_company_service_modules','ywi_rpc_customer_history_422',
 'ywi_rpc_site_intake_431','auth.getUser','owner431Results','owner431Property','ywi:auth-changed'])
 assert.ok(js.includes(token),token);
assert.ok(read('index.html').includes('js/service-site-intake-431.js'));
assert.ok(read('help.html').includes('id="service-site-intake-431"'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('## Item 431'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 432'));
for(const script of ['test:service-site-intake-431','test:browser:service-site-intake-431']){
 assert.ok(JSON.parse(read('package.json')).scripts[script]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+script));
}
console.log('Item 431 verified original property, six templates, Safety HOLD, tenant isolation, no writes: PASS');
