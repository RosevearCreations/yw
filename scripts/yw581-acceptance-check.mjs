import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const ui=read('js/yw581-staging-acceptance.js');
new vm.Script(ui);
const env={window:{},document:{readyState:'loading',addEventListener(){}},location:{hash:''}};
vm.runInNewContext(ui,env);
const {inspect,keys}=env.window.YW581Acceptance;
const actual=Array.from(keys);
assert.deepEqual(actual,['landscape','snow_removal','snow_plowing','septic',
 'arboriculture','construction','water_parks','ponds','skateparks']);
const company='a1111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-17T20:00:00.000Z');
const valid={company_id:company,captured_at:new Date(now).toISOString(),
 owner_guard:'ywi_422_assert_owner',source:'YW581_STAGING_ONLY',synthetic:false,
 mutation_authorized:false,production_activation_authorized:false,
 financial_activation_authorized:false,customer_messaging_authorized:false,
 digest_independently_verified:false,photo_records:7,
 services:actual.map((key,i)=>({key,enabled:i===0,registry_present:true,
  staging_accepted:i<3,new_work_authorized:false}))};
const checked=inspect(valid,company,now);
assert.equal(checked.state,'OWNER_STAGING_REVIEW_ONLY');
assert.equal(checked.rows.length,9);
assert.equal(checked.accepted,3);
assert.equal(checked.rows.filter(r=>r.readyForEvidence).length,1);
for(const key of ['productionActivation','canActivate','canCreateJob','canApproveFinance','canSend'])
 assert.equal(checked[key],false);
let rejected=0;
function deny(name,fn,companyId=company){
 const candidate=structuredClone(valid);fn(candidate);
 const answer=inspect(candidate,companyId,now);
 assert.equal(answer.state,'HOLD',name);rejected++;
}
deny('wrong tenant',x=>x.company_id='b2222222-2222-4222-8222-222222222222');
deny('foreign context',x=>{},'b2222222-2222-4222-8222-222222222222');
deny('forged owner proof',x=>x.owner_guard='sysop');
deny('wrong original source',x=>x.source='client');
deny('synthetic snapshot',x=>x.synthetic=true);
deny('mutation asserted',x=>x.mutation_authorized=true);
deny('production enabled',x=>x.production_activation_authorized=true);
deny('financial enabled',x=>x.financial_activation_authorized=true);
deny('messaging enabled',x=>x.customer_messaging_authorized=true);
deny('false file hash witness',x=>x.digest_independently_verified=true);
deny('missing service',x=>x.services.pop());
deny('duplicate service',x=>x.services[8].key='ponds');
deny('unexpected service',x=>x.services[3].key='forex');
deny('string entitlement',x=>x.services[0].enabled='true');
deny('inconsistent registry',x=>x.services[0].registry_present='yes');
deny('inconsistent acceptance',x=>x.services[0].staging_accepted=null);
deny('job command escalation',x=>x.services[0].new_work_authorized=true);
deny('stale proof',x=>x.captured_at=new Date(now-300000).toISOString());
deny('future proof',x=>x.captured_at=new Date(now+120000).toISOString());
deny('invalid photo count',x=>x.photo_records=-1);
assert.ok(rejected>=20);
const sql=read('sql/yw581_staging_acceptance_private_photo_STAGING_ONLY.sql');
const html=read('index.html');
const build=read('scripts/build-vercel-site.mjs');
const parts=[
 'public.ywi_581_service_acceptance','environment text not null default \'staging\'',
 'ywi_581_distinct_reviewers','isolation_test_digest','ywi_581_bounded_acceptance',
 'enable row level security','public.ywi_company_client_links_422(company_id,client_id)',
 'public.ywi_company_site_links_422(company_id,client_id,client_site_id)',
 'public.work_orders','ywi_422_assert_link','ywi_422_assert_jobs_create',
 "private_object_key text not null unique","hash_server_verified boolean not null default false",
 'on conflict(company_id,request_id) do nothing','storage.buckets','storage.objects',
 "b.public=false","ywi_581_may_upload(name)","with check(bucket_id=",
 "'job_documentation'","consent_recorded boolean not null",
 'p_consent is distinct from true','retained_until',
 'ywi_rpc_staging_acceptance_581','production_activation_authorized',
 'sp.enabled is true','svc.enabled is true',
 "'new_work_authorized',false","'digest_independently_verified',false"
];
for(const item of parts)assert.ok(sql.includes(item),'Missing staging protection: '+item);
assert.ok(!/grant\s+(insert|update|delete)[^;]*to\s+authenticated/i.test(sql),
 'Raw authenticated tenant table writes must never be granted');
assert.ok(!/create policy[^\n]+for (update|delete)/i.test(sql),
 'No unrestricted media edits or deletes');
assert.ok(html.includes('/js/yw581-staging-acceptance.js?v=20261117b581'));
assert.ok(build.includes("const directories = ['js', 'icons']"));
assert.ok(ui.includes("sb.storage.from('ywi-private-job-photos-581')"));
assert.ok(ui.includes("sb.rpc('ywi_rpc_record_photo_581'"));
assert.ok(ui.includes("sb.rpc('ywi_rpc_staging_acceptance_581'"));
assert.ok(ui.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(ui.includes('upsert:false'));
assert.ok(!/\.getPublicUrl\s*\(/.test(ui));
assert.ok(!/\.remove\s*\(/.test(ui));
assert.ok(!/\.signOut\s*\(/.test(ui));
assert.ok(!/\.from\([^)]+\)\.(insert|update|delete|upsert)\s*\(/.test(ui));
console.log('YW581 source staging validation PASS: nine modules, original CRM/job links, private storage, consent, read-only flags, '+rejected+' denial cases');
