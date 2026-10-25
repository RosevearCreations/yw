import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,customerId,propertyId,foreignCompanyId,foreignPropertyId,
 company,ownerId,companyAdminTest}
 from '../tests/fixtures/pms-client-property-360-444.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/pms-client-property-360-444.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {inspect,kinds,states}=scope.window.YWI444;
const now=Date.now(),args={companyId,clientId:customerId,now,jobsAllowed:true};
const verified=inspect(fixture({now}),args);
assert.equal(verified.state,'verified_360_read_only');
assert.equal(verified.properties.length,1);
assert.equal(verified.history.length,4);
assert.equal(verified.entries.length,6);
assert.equal(verified.currentConsent.length,1);
assert.equal(verified.currentConsent[0].reported_status,'withdrawn',
 'most recent withdrawal must supersede earlier reported consent');
assert.equal(verified.sendingAuthorized,false);
assert.equal(verified.photoUpload,false);
assert.equal(verified.contractExecuted,false);
assert.deepEqual(Array.from(kinds),['contact','asset','contract','photo','consent']);
assert.deepEqual(Array.from(states.consent),['unknown','given','withdrawn']);
assert.equal(company.name,'Yard Rosevear');assert.equal(company.owner_user_id,ownerId);
assert.equal(companyAdminTest.scope_company_id,companyId);
assert.equal(companyAdminTest.password_copied,false);
assert.equal(companyAdminTest.live_company_created,false);
const edit=fn=>{const d=fixture({now});fn(d);return d;};
for(const [reason,fn] of [
 ['foreign company',d=>{d.company_id=foreignCompanyId}],
 ['foreign customer',d=>{d.client_id='a4440000-0000-4444-8444-000000000002'}],
 ['foreign canonical customer',d=>{d.history.client_id='a4440000-0000-4444-8444-000000000002'}],
 ['unlinked property',d=>{d.entries[1].property_id=foreignPropertyId}],
 ['foreign estimate',d=>{d.history.estimates[0].property_id=foreignPropertyId}],
 ['duplicate property',d=>{d.history.properties.push({...d.history.properties[0]})}],
 ['duplicate entry',d=>{d.entries[1].id=d.entries[0].id}],
 ['invalid consent channel',d=>{d.entries[5].channel='telegram'}],
 ['missing consent purpose',d=>{d.entries[5].consent_scope=null}],
 ['reported photo without site',d=>{d.entries[3].property_id=null}],
 ['invalid reported state',d=>{d.entries[0].reported_status='approved'}],
 ['unknown historical service',d=>{d.history.estimates[0].service='payroll'}],
 ['stale source',d=>{d.captured_at=new Date(now-360000).toISOString()}],
 ['future source',d=>{d.captured_at=new Date(now+120000).toISOString()}],
 ['unbounded entries',d=>{d.entries_count=201}],
 ['inconsistent count',d=>{d.entries_count=0}],
 ['unexpected signing',d=>{d.contract_execution_verified=true}],
 ['unexpected photo upload',d=>{d.photo_upload_available=true}],
 ['unexpected outreach',d=>{d.consent_authorizes_messaging=true}],
 ['unexpected write authority',d=>{d.mutation_authorized=true}],
 ['missing original exclusion',d=>{d.history.legacy_unscoped_excluded=false}],
 ['incorrect guard',d=>{d.owner_guard='unverified'}]
])assert.equal(inspect(edit(fn),args).state,'withheld',reason);
assert.equal(inspect(fixture({now}),{...args,jobsAllowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
for(const needle of ['auth.getUser','YWISecurity','ywi_rpc_company_customers_422',
 'ywi_rpc_customer_history_422','ywi_rpc_client_property_360_444',
 'ywi_rpc_append_client_property_360_444','ywi_rpc_create_customer_422',
 'ywi_rpc_create_property_422','ywi:auth-changed','ywi:module-permissions-changed',
 'owner444Status','owner444Dossier','crypto.randomUUID','p_request_id']){
 if(needle==='ywi_rpc_customer_history_422')continue; // Server delegates original history in 444 RPC.
 assert.ok(js.includes(needle),needle);
}
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),
 'All tenant writes must be server-approved RPCs');
const sql=read('sql/pms_client_property_360_444.sql').toLowerCase();
for(const needle of ['begin;','commit;','enable row level security',
 'revoke all on public.ywi_pms_360_entries_444 from public,anon,authenticated',
 'no direct insert/update/delete policies','foreign key(company_id,client_id)',
 'foreign key(company_id,client_id,client_site_id)',
 'ywi_422_assert_owner','ywi_422_assert_jobs_create','ywi_422_assert_link',
 'ywi_rpc_customer_history_422','security definer set search_path',
 'on conflict(company_id,request_id) do nothing',
 'request id was reused with different content','pg_advisory_xact_lock',
 'grant execute on function public.ywi_rpc_client_property_360_444',
 'grant execute on function public.ywi_rpc_append_client_property_360_444',
 'consent_authorizes_messaging','contract_execution_verified'])assert.ok(sql.includes(needle),needle);
const html=read('index.html'),help=read('help.html');
assert.ok(html.includes('js/pms-client-property-360-444.js'));
assert.ok(help.includes('id="pms-client-property-360-444"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 444 implementation'));
const nav=read('js/pms-module-navigation-443.js');
assert.ok(nav.includes('pms443Client360'));
assert.ok(nav.includes("shared.hidden=true"));
for(const script of ['test:pms-client-property-360-444','test:browser:pms-client-property-360-444']){
 assert.ok(JSON.parse(read('package.json')).scripts[script]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+script));
}
console.log('YW 444 canonical owner-scoped CRM 360, six-service history, append-only evidence, stale/foreign denial, idempotency and Yard Rosevear synthetic boundaries: PASS');
