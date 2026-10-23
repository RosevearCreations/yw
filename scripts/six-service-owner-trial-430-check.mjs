import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(path,'utf8');
const js=read('js/six-service-owner-trial-430.js');new Function(js);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,sandbox);
const {keys,inspect}=sandbox.window.YWI430;
assert.equal(keys.length,6);
const at='2026-10-23T17:30:00.000Z',now=Date.parse(at);
const company={id:'company-1',owner_user_id:'owner-1',name:'Yard Workers'};
const services=Array.from(keys,key=>({company_id:company.id,module_key:key,enabled:true}));
const customers=[{id:'customer-1',name:'True customer',is_active:true}];
const site={id:'property-1',name:'Real site'};
const history={company_id:company.id,client_id:customers[0].id,legacy_unscoped_excluded:true,
 history_limit_per_type:80,properties:[site],estimates:[],
 work_orders:Array.from(keys,(key,i)=>({id:'work-'+i,property_id:site.id,service:key,created_at:at}))};
const input={company,uid:'owner-1',services,customers,customerId:'customer-1',history,retrievedAt:at};
const inspectAt=p=>inspect(p,now);
let result=inspectAt(input);
assert.equal(result.state,'owner_review_required');
assert.equal(result.services.length,6);
assert.equal(result.source_coverage,'owner_company_registry_customer_history');
assert.ok(result.services.every(x=>x.state==='job_linked_review_pending'&&x.work_order_id&&!x.accepted));
assert.equal(result.accepted,false);
assert.equal(inspectAt({...input,history:null}).state,'withheld');
assert.equal(inspectAt({...input,uid:'foreign'}).state,'withheld');
assert.equal(inspectAt({...input,retrievedAt:'2026-10-23T17:00:00Z'}).state,'withheld');
assert.equal(inspectAt({...input,services:[...services.slice(0,5),services[0]]}).state,'withheld');
assert.equal(inspectAt({...input,services:services.map(x=>({...x,company_id:'foreign'}))}).state,'withheld');
assert.equal(inspectAt({...input,customers:[...customers,customers[0]]}).state,'withheld');
assert.equal(inspectAt({...input,customers:Array.from({length:100},(_,i)=>({id:'customer-'+i,name:'Customer',is_active:true}))}).state,'withheld');
assert.equal(inspectAt({...input,history:{...history,work_orders:[...history.work_orders,history.work_orders[0]]}}).state,'withheld');
assert.equal(inspectAt({...input,history:{...history,work_orders:Array.from({length:80},(_,i)=>({...history.work_orders[0],id:'work-'+i}))}}).state,'withheld');
assert.equal(inspectAt({...input,history:{...history,work_orders:[{...history.work_orders[0],property_id:'other'}]}}).state,'withheld');
assert.equal(inspectAt({...input,history:{...history,legacy_unscoped_excluded:false}}).state,'withheld');
result=inspectAt({...input,services:services.map(s=>({...s,enabled:s.module_key!=='septic'}))});
assert.equal(result.services.find(s=>s.key==='septic').state,'offering_disabled');
result=inspectAt({...input,customerId:null,history:null});
assert.ok(result.services.every(s=>s.state==='needs_customer'));
result=inspectAt({...input,history:{...history,properties:[],work_orders:[]}});
assert.ok(result.services.every(s=>s.state==='needs_property'));
result=inspectAt({...input,history:{...history,work_orders:[]}});
assert.ok(result.services.every(s=>s.state==='needs_work_order'));
assert.ok(!/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(js));
for(const key of ['ywi_companies','ywi_company_service_modules','ywi_rpc_company_customers_422','ywi_rpc_customer_history_422',
 'ywi:auth-changed','auth.getUser','history_limit_per_type','legacy_unscoped_excluded','owner430Results','owner430Refresh'])
 assert.ok(js.includes(key),key);
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const key of ['test:six-service-owner-trial-430','test:browser:six-service-owner-trial-430']){
 assert.ok(pkg.scripts[key]);assert.ok(ci.includes('npm run '+key));
}
assert.ok(read('index.html').includes('/js/six-service-owner-trial-430.js'));
assert.ok(read('help.html').includes('id="six-service-owner-trial-430"'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('Next queued: Item 431'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Next queued: Item 431'));
console.log('Item 430 owner six-service source coverage, tenant boundaries, read-only and missing-source holds: PASS');
