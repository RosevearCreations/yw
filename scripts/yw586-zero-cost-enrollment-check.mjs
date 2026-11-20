import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const company=uuid(2),client=uuid(3),actor=uuid(4),owner=uuid(5),outside=uuid(6);
const now='2026-11-19T23:00:00Z',t=Date.parse(now);
let rejects=0;
const reject=(name,r)=>{assert.equal(r.state,'HOLD',name);rejects++;};

const authCode=read('public/customer-account-586.js');
new vm.Script(authCode);
const w={addEventListener(){}};
const doc={readyState:'loading',addEventListener(){}};
vm.runInNewContext(authCode,{window:w,document:doc});
const account=w.YW586CustomerAccount;
assert.ok(account.inspectMemberships&&account.inspectScope);
const member={company_id:company,client_id:client,customer_user_id:actor,membership_state:'active'};
const m=account.inspectMemberships([member],actor);
assert.equal(m.state,'SOURCE_MEMBERSHIPS_ONLY');
assert.equal(m.companies.length,1);
assert.equal(m.customerEnrolled,false);
for(const [name,data,who] of [
 ['foreign actor',[member],outside],
 ['foreign listed actor',[{...member,customer_user_id:outside}],actor],
 ['pending', [{...member,membership_state:'pending'}],actor],
 ['revoked', [{...member,membership_state:'revoked'}],actor],
 ['duplicate same company',[member,member],actor],
 ['malformed company',[{...member,company_id:'fake'}],actor],
 ['malformed original client',[{...member,client_id:'fake'}],actor],
 ['no link',[],actor],
 ['too many',Array.from({length:21},(_,i)=>({...member,company_id:uuid(100+i)})),actor]
])reject(name,account.inspectMemberships(data,who));
const scope={scope:'original_customer_company_only',company_id:company,client_id:client,
 company_name:'Verified Landscaping Company',service_count_enabled:0,captured_at:now,
 can_view_work_orders:false,can_view_photos:false,can_submit_booking:false,
 can_charge_account:false,can_change_company_settings:false,
 public_site_published:false,owner_or_sysop_authority:false};
const opts={companyId:company,clientId:client};
const valid=account.inspectScope(scope,opts,t);
assert.equal(valid.state,'VERIFIED_SCOPE_READ_ONLY');
for(const [name,change,link,time] of [
 ['foreign company',{company_id:outside},opts,t],
 ['foreign client',{client_id:outside},opts,t],
 ['customer private job',{can_view_work_orders:true},opts,t],
 ['customer private photo',{can_view_photos:true},opts,t],
 ['customer booking',{can_submit_booking:true},opts,t],
 ['customer payment',{can_charge_account:true},opts,t],
 ['owner escalation',{owner_or_sysop_authority:true},opts,t],
 ['published falsely',{public_site_published:true},opts,t],
 ['invalid service count',{service_count_enabled:9},opts,t],
 ['stale reply',{captured_at:'2026-11-18T23:00:00Z'},opts,t],
 ['future reply',{captured_at:'2026-11-20T02:00:00Z'},opts,t],
 ['wrong expected company',{}, {companyId:outside,clientId:client},t]
])reject(name,account.inspectScope({...scope,...change},link,time));
const siteSource=read('js/yw586-website-publication-preview.js');
new vm.Script(siteSource);
const ww={addEventListener(){}};
const dd={readyState:'loading',addEventListener(){},querySelectorAll(){return []}};
vm.runInNewContext(siteSource,{window:ww,document:dd,location:{hash:''}});
const site=ww.YW586SiteReview;
assert.ok(site.inspectDraft&&site.inspectReview);
const row={company_id:company,site_slug:'verified-landscaping',display_name:'Verified Landscaping',
 headline:'Professional care for every season',
 public_description:'Local landscape and snow service drafts privately reviewed by the business owner.',
 theme_name:'forest',updated_at:now,publication_state:'draft'};
const ctx={companyId:company,actorId:owner,ownerId:owner,privateRecordsVerified:true};
const ownerDraft=site.inspectDraft(row,ctx);
assert.equal(ownerDraft.state,'OWNER_PRIVATE_DRAFT_PREVIEW');
assert.equal(ownerDraft.published,false);
for(const [name,patch,options] of [
 ['foreign company',{company_id:outside},{}],
 ['foreign actor',{}, {actorId:outside}],
 ['not original owner',{}, {ownerId:outside}],
 ['unverified private data',{}, {privateRecordsVerified:false}],
 ['published source',{publication_state:'published'},{}],
 ['unsafe slug',{site_slug:'bad<script>'},{}],
 ['oversized copy',{public_description:'x'.repeat(1201)},{}],
 ['invalid theme',{theme_name:'arbitrary'},{}],
 ['invalid headline',{headline:'hi'},{}],
 ['invalid time',{updated_at:'yesterday'},{}]
])reject(name,site.inspectDraft({...row,...patch},{...ctx,...options}));
const hash='a'.repeat(64);
const local=site.inspectReview({draft:ownerDraft,items:[true,true,true,true],hash});
assert.equal(local.state,'LOCAL_REVIEW_NOT_APPROVAL');
assert.equal(local.reviewApproved,false);
assert.equal(local.published,false);
for(const [name,change] of [
 ['incomplete checklist',{items:[true,true,false,true]}],
 ['missing witness item',{items:[true,true,true]}],
 ['wrong digest',{hash:'bad'}],
 ['unverified owner',{draft:{state:'HOLD'}}]
])reject(name,site.inspectReview({draft:ownerDraft,items:[true,true,true,true],hash,...change}));

const accountHtml=read('public/customer-account.html');
for(const s of ['id="yw586-login-form"','id="yw586-email"','type="password"',
 'id="yw586-logout"','id="yw586-company-list"','noindex,nofollow',
 'customer-account-586.js','Original customer approval required'])assert.ok(accountHtml.includes(s),s);
assert.ok(!accountHtml.includes('signUp')&&!accountHtml.includes('name="signup"'));
for(const s of ['auth.signInWithPassword','sb.auth.getUser','ywi_585_customer_memberships',
  'ywi_585_customer_portal_scope','persistSession:false','autoRefreshToken:false',
  'customer_user_id','membership_state','state.epoch','pagehide'])assert.ok(authCode.includes(s),s);
assert.ok(!/\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.storage\s*\.from\s*\(|getPublicUrl\s*\(|signUp\s*\(/.test(authCode));
assert.ok(!/\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.storage\s*\.from\s*\(/.test(siteSource));
assert.ok(siteSource.includes('crypto.subtle.digest'));
const sql=read('sql/yw586_enrollment_publication_reviews_STAGING_ONLY.sql');
for(const s of ['ywi_585_customer_memberships','ywi_584_company_site_drafts',
 'original_link_evidence_digest','approved_for_staging_only','independent_reviewer_id',
 'owner_reviewer_id <> independent_reviewer_id','row level security',
 'production_publication_authorized=false','append-only',
 'before update or delete'])assert.ok(sql.toLowerCase().includes(s.toLowerCase()),s);
assert.ok(!/grant\s+(all|insert|update|delete)\b[^;]*to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+.+to\s+anon/i.test(sql));
const fixture=read('sql/yw586_zero_cost_synthetic_rls_rehearsal.sql');
assert.ok(fixture.includes('begin;')&&fixture.includes('rollback;'));
assert.ok(fixture.includes('create policy original_job_link'));
assert.ok(fixture.includes('create policy consented_private_photo'));
assert.ok(fixture.includes('create policy customer_private_draft_insert'));
assert.ok(fixture.includes("state='revoked'"));
assert.ok(!/supabase\.co|service_role|postgres:\/\/|https?:\/\//i.test(fixture));
assert.ok(read('scripts/build-vercel-site.mjs').includes("'theme-publication-586.css'"));
assert.ok(read('index.html').includes('yw586-website-publication-preview.js'));
assert.ok(read('public/customer.html').includes('href="/customer-account.html"'));
console.log('YW586 SOURCE PASS: original CRM/customer identity, 2-person site publication, no public signup/payments/jobs/photos, '+rejects+' negative contract tests, reversible local RLS fixture');
