import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=x=>fs.readFileSync(x,'utf8');
const sql=read('sql/company_customer_property_continuity_422.sql');
const js=read('js/cross-service-continuity-422.js');
new Function(js);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,sandbox);
const validate=sandbox.window.YWI422.validateHistory;
const company='tenant-1',client='client-1';
const safe={company_id:company,client_id:client,legacy_unscoped_excluded:true,
 history_limit_per_type:80,properties:[{id:'site-1',name:'West field'}],
 estimates:[{id:'est-1',service:'landscape',property_id:'site-1'}],
 work_orders:[{id:'wo-1',service:'snow_removal',property_id:'site-1'}]};
assert.equal(validate(company,client,safe),safe);
assert.throws(()=>validate('foreign',client,safe),/Incomplete|cross-company/);
assert.throws(()=>validate(company,client,{...safe,legacy_unscoped_excluded:false}),/Incomplete/);
assert.throws(()=>validate(company,client,{...safe,work_orders:[{...safe.work_orders[0],property_id:'unlinked'}]}),/Incomplete/);
assert.throws(()=>validate(company,client,{...safe,estimates:[{...safe.estimates[0],service:'unknown'}]}),/Incomplete/);
for(const term of [
 'public.ywi_company_client_links_422','public.ywi_company_site_links_422',
 'references public.clients(id) on delete restrict','references public.client_sites(id) on delete restrict',
 'primary key (company_id,client_id)','ywi_422_owner_client_read','ywi_422_owner_site_read',
 'enable row level security','created_by uuid not null',
 'public.ywi_rpc_create_customer_422','public.ywi_rpc_create_property_422',
 'public.ywi_rpc_attach_draft_customer_422','public.ywi_rpc_customer_history_422',
 'public.ywi_rpc_company_customers_422','public.ywi_422_assert_jobs_create',
 'public.ywi_422_assert_link','public.ywi_421_assert_company_new_work',
 'public.ywi_421_before_new_work','s.enabled is true','v_level not in',
 'old.status <> \'draft\'','old.client_id is not null','new.status <> \'draft\'',
 'source estimate company/service/customer/site mismatch',
 'cs.client_id=l.client_id','l.company_id=p_company_id',
 'c.owner_user_id=v_actor','where e.company_id=p_company_id',
 'where w.company_id=p_company_id','limit 80','legacy_unscoped_excluded'
])assert.ok(sql.includes(term),term);
assert.ok(!/create table(?: if not exists)? public\.(clients|client_sites)\b/i.test(sql));
assert.ok(!/grant (insert|update|delete|all) on public\.ywi_company_(client|site)_links_422 to authenticated/i.test(sql));
assert.ok(!/truncate\s+|delete from public\.(clients|client_sites)/i.test(sql));
assert.ok(!/update public\.(clients|client_sites) set .*company_id/i.test(sql));
for(const term of ['owner422','owner422Refresh','owner422Customer','owner422Property',
 'ywi_rpc_create_customer_422','ywi_rpc_create_property_422',
 'ywi_rpc_attach_draft_customer_422','ywi_rpc_customer_history_422',
 'ywi:auth-changed','window.confirm'])assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('/js/cross-service-continuity-422.js'));
assert.ok(read('help.html').includes('id="cross-service-continuity-422"'));
for(const f of ['docs/NEXT_STEPS_AND_SANITY_CHECK.md','docs/ACTIVE_PROJECT_HANDBOOK.md'])
 assert.ok(read(f).includes('Item 422'),f);
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const key of ['test:cross-service-continuity-422','test:browser:cross-service-continuity-422']){
 assert.ok(pkg.scripts[key]);assert.ok(ci.includes('npm run '+key));
}
console.log('Item 422: canonical CRM tenant links, strict one-time assignment, historical privacy and browser contracts PASS');
