import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
 CUSTOMER_SERVICES_585,PLANNING_SPECIALTIES_585,inspectCustomerScope585,
 inspectCustomerRequest585,inspectIndependentPilot585
} from './yw585-customer-contract.mjs';
const read=f=>readFileSync(f,'utf8'),uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const company=uuid(2),client=uuid(3),actor=uuid(4),outside=uuid(5),now=Date.parse('2026-11-19T20:00:00Z'),revision='a'.repeat(40);
let negative=0;
const refuse=(name,result)=>{assert.equal(result.state,'HOLD',name);negative++;};
const source=read('public/customer-585.js'),html=read('public/customer.html'),css=read('public/customer-585.css');
new vm.Script(source,{filename:'customer-585.js'});
const window={addEventListener(){}};
vm.runInNewContext(source,{
 window,document:{readyState:'loading',addEventListener(){},getElementById(){return null}},
 navigator:{},location:{}
});
const planner=window.YW585Planning;
assert.ok(planner?.inspectScope&&planner?.buildSheet);
assert.equal(Object.keys(planner.services).length,9);
const plan={service:'landscape',property:'residential',when:'flexible',frequency:'one-time',
 notes:'Trim tall trees and prepare a maintenance schedule.'};
const goodPlan=planner.inspectScope(plan);
assert.equal(goodPlan.state,'BROWSER_ONLY_NOT_BOOKED');
assert.equal(goodPlan.transmitted,false);
assert.equal(goodPlan.booked,false);
assert.equal(goodPlan.accountCreated,false);
const sheet=planner.buildSheet(goodPlan);
assert.ok(sheet.includes('NOT SUBMITTED')&&sheet.includes('No landscaping company has received'));
assert.ok(!sheet.includes('mailto:')&&!sheet.includes('https://'));
for(const [name,change] of [
 ['no service',{service:''}],
 ['forged service',{service:'financial_transfer'}],
 ['cross-scope property',{property:'company-foreign'}],
 ['invalid timing',{when:'booked'}],
 ['invalid pattern',{frequency:'invoice'}],
 ['oversize notes',{notes:'x'.repeat(601)}],
 ['null notes',{notes:null}],
 ['control character',{notes:'bad\u0001control'}]
])refuse(name,planner.inspectScope({...plan,...change}));
const specialty=planner.inspectScope({...plan,service:'ponds'});
assert.equal(specialty.plan.conceptualOnly,true);
assert.ok(planner.buildSheet(specialty).includes('planning-only'));
assert.equal(CUSTOMER_SERVICES_585.length,7);
assert.equal(PLANNING_SPECIALTIES_585.length,2);
for(const key of [...CUSTOMER_SERVICES_585,...PLANNING_SPECIALTIES_585])
 assert.ok(Object.keys(planner.services).includes(key),'missing service '+key);
for(const req of ['yw585-scope-form','yw585-service','yw585-property',
 'yw585-when','yw585-frequency','yw585-notes','yw585-summary','yw585-copy','yw585-print'])
 assert.ok(html.includes('id="'+req+'"'),'missing accessible planning element '+req);
assert.match(html,/name="robots" content="noindex,nofollow,noarchive"/);
assert.ok(html.includes('href="/customer-585.css?v=20261119b585"'));
assert.ok(html.includes('src="/customer-585.js?v=20261119b585"'));
assert.ok(html.includes('not yet enrolled'));
assert.ok(html.includes('not a quote')||html.includes('not a booking'));
assert.ok(css.includes('@media(max-width:620px)')&&css.includes('@media print'));
assert.ok(css.includes('focus-visible'));
assert.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|\.from\s*\(|\.rpc\s*\(/.test(source));
assert.ok(!/<form[^>]*(action=|method=["']post)/i.test(html));
assert.ok(!/<script[^>]+src="https?:/i.test(html));
assert.ok(!/type=["']file["']/.test(html));
assert.ok(read('index.html').includes('href="/customer.html"'));
assert.ok(read('scripts/build-vercel-site.mjs').includes("const publicDirectory = join(root, 'public')"));
const goodScope={
 scope:'original_customer_company_only',company_id:company,client_id:client,
 company_name:'Owner-linked Landscape Business',service_count_enabled:0,
 captured_at:new Date(now).toISOString(),
 can_view_work_orders:false,can_view_photos:false,can_submit_booking:false,
 can_charge_account:false,can_change_company_settings:false,
 public_site_published:false,owner_or_sysop_authority:false};
const scopeOptions={companyId:company,clientId:client,now};
const scoped=inspectCustomerScope585(goodScope,scopeOptions);
assert.equal(scoped.state,'SOURCE_SCOPE_PACKET_CONSISTENT_ONLY');
assert.equal(scoped.accountActivated,false);
for(const [name,change,opts] of [
 ['wrong company',{company_id:outside},{}],
 ['foreign client',{client_id:outside},{}],
 ['booking authorized',{can_submit_booking:true},{}],
 ['photos disclosed',{can_view_photos:true},{}],
 ['billing enabled',{can_charge_account:true},{}],
 ['owner impersonation',{owner_or_sysop_authority:true},{}],
 ['published state',{public_site_published:true},{}],
 ['unsupported count',{service_count_enabled:9},{}],
 ['untrusted role',{scope:'owner_company_only'},{}],
 ['stale receipt',{captured_at:'2026-11-18T20:00:00Z'},{}],
 ['wrong expected company',{}, {companyId:outside}],
 ['missing company name',{company_name:''},{}]
])refuse(name,inspectCustomerScope585({...goodScope,...change},{...scopeOptions,...opts}));
const member={company_id:company,client_id:client,customer_user_id:actor,membership_state:'active'};
const draft={company_id:company,client_id:client,customer_user_id:actor,
 lifecycle_state:'private_draft',service_module_key:'landscape',
 request_kind:'quote_planning',short_summary:'Plan weekly service',
 details:'Interested in a normal maintenance assessment.'};
const reqOpts={request:draft,original:member,expectedCompanyId:company,
 expectedClientId:client,expectedActorId:actor};
const reviewed=inspectCustomerRequest585(reqOpts);
assert.equal(reviewed.state,'SOURCE_CUSTOMER_DRAFT_PACKET_ONLY');
assert.equal(reviewed.canCreateJobs,false);
for(const [name,data] of [
 ['revoked member',{original:{...member,membership_state:'revoked'}}],
 ['other customer',{expectedActorId:outside}],
 ['foreign company',{request:{...draft,company_id:outside}}],
 ['foreign original client',{original:{...member,client_id:outside}}],
 ['cross tenant customer',{request:{...draft,customer_user_id:outside}}],
 ['forged service',{request:{...draft,service_module_key:'skateparks'}}],
 ['nonprivate state',{request:{...draft,lifecycle_state:'submitted'}}],
 ['improper action',{request:{...draft,request_kind:'charge_account'}}],
 ['short title',{request:{...draft,short_summary:'x'}}],
 ['large note',{request:{...draft,details:'x'.repeat(801)}}]
])refuse(name,inspectCustomerRequest585({...reqOpts,...data}));
const pilot={environment:'staging',project_ref:'separate-staging-yw',
 source_revision:revision,production_unmodified:true,original_422_links_proven:true,
 customer_revocation_denied:true,cross_company_denied:true,
 anonymous_enrollment_denied:true,foreign_job_photo_denied:true,
 private_object_rehash_proven:true,retention_legal_hold_verified:true,
 backup_restore_verified:true,service_off_denied:true,
 independent_owner_and_dba_review:true,paid_branch_created:false,
 recorded_at:new Date(now).toISOString()};
const pilotArgs={trustedProductionRef:'original-production-yw',
 trustedStagingRef:'separate-staging-yw',sourceSha:revision,now,zeroSpend:true};
const packet=inspectIndependentPilot585(pilot,pilotArgs);
assert.equal(packet.state,'UNATTESTED_PILOT_PACKET_REQUIRES_INDEPENDENT_LIVE_PROOF');
assert.equal(packet.photoPilotAccepted,false);
for(const [name,changes,arg] of [
 ['production cannot be staging',{project_ref:'original-production-yw'},{}],
 ['not staging',{environment:'production'},{}],
 ['foreign linked job',{original_422_links_proven:false},{}],
 ['customer revocation not denied',{customer_revocation_denied:false},{}],
 ['anonymous enrollment allowed',{anonymous_enrollment_denied:false},{}],
 ['foreign storage not blocked',{foreign_job_photo_denied:false},{}],
 ['byte hash absent',{private_object_rehash_proven:false},{}],
 ['retention hold absent',{retention_legal_hold_verified:false},{}],
 ['restore absent',{backup_restore_verified:false},{}],
 ['not jointly witnessed',{independent_owner_and_dba_review:false},{}],
 ['source SHA not pinned',{source_revision:'b'.repeat(40)},{}],
 ['stale pilot',{recorded_at:'2026-11-18T12:00:00Z'},{}],
 ['unapproved paid staging',{paid_branch_created:true},{}],
 ['identical staging and production',{}, {trustedStagingRef:'original-production-yw'}]
])refuse(name,inspectIndependentPilot585({...pilot,...changes},{...pilotArgs,...arg}));
const sql=read('sql/yw585_original_customer_portal_STAGING_ONLY.sql');
for(const term of ['ywi_585_customer_memberships','ywi_585_customer_request_drafts',
 'ywi_585_customer_portal_scope','ywi_company_client_links_422',
 'public.ywi_company_service_modules','public.clients','auth.users',
 'membership_state','enable row level security','with check','security definer',
 'search_path','anonymous','revoke all','service_module_key'])
 assert.ok(sql.toLowerCase().includes(term.toLowerCase()),'missing tenant isolation contract: '+term);
assert.ok(!/grant\s+(all|insert|update|delete)\b[^;]*on\s+public\.ywi_585_customer_memberships\s+to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+(all|select|insert|update|delete)[^;]*to\s+anon\b/i.test(sql));
assert.ok(!/grant\s+(update|delete)\b[^;]*on\s+public\.ywi_585_customer_request_drafts/i.test(sql));
assert.ok(!/\binsert\s+into\s+public\.(work_orders|estimates|invoices|payments)\b/i.test(sql));
assert.ok(!/getPublicUrl|public_bucket\s*=\s*true/i.test(sql));
console.log('YW585 PASS: real public customer planning foundation, seven original+two concept service keys, 44 reject gates, original customer RLS-bound staging membership and zero-cost pilot HOLD');
