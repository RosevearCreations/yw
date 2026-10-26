import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-first-service-independent-457.mjs';
const read=p=>readFileSync(p,'utf8');
const src=read('js/pms-first-service-independent-457.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,decisions,modules}=ctx.window.YWI457;
const now=Date.now(),o=fixture({now}),r=fixture({now,viewer:reviewerId});
assert.equal(modules.length,7);assert.equal(decisions.length,3);
assert.equal(inspectInbox(o.inbox,{userId:ownerId,now}).state,'source_verified');
assert.equal(inspectInbox(r.inbox,{userId:reviewerId,now}).state,'source_verified');
assert.equal(inspect(o.view,{companyId,userId:ownerId,now}).state,'source_verified');
assert.equal(inspect(r.view,{companyId,userId:reviewerId,now}).state,'source_verified');
assert.equal(inspect(fixture({now,closed:true}).view,{companyId,userId:ownerId,now}).state,'source_verified');
assert.equal(inspect(fixture({now,empty:true}).view,{companyId,userId:ownerId,now}).state,'source_verified');
function mutate(f){const x=fixture({now});f(x);return inspect(x.view,{companyId,userId:ownerId,now}).state;}
for(const [name,fn] of [
 ['foreign company',x=>x.view.company_id=foreignCompanyId],
 ['different viewer',x=>x.view.viewer_id=reviewerId],
 ['false approval',x=>x.view.independent_service_approval=true],
 ['fake field accepted',x=>x.view.field_accepted=true],
 ['fake release green',x=>x.view.release_green=true],
 ['stale',x=>x.view.captured_at=new Date(now-360000).toISOString()],
 ['missing module',x=>x.view.services.pop()],
 ['duplicate module',x=>x.view.services[0].module_key=x.view.services[1].module_key],
 ['foreign handoff',x=>x.view.handoffs[0].company_id=foreignCompanyId],
 ['wrong readiness',x=>x.view.handoffs[0].owner_recommendation='approved'],
 ['duplicate handoff',x=>{x.view.handoffs.push({...x.view.handoffs[0]});x.view.handoff_total++}],
 ['foreign exception',x=>x.view.exceptions[0].company_id=foreignCompanyId],
 ['foreign evidence',x=>x.view.resolution_evidence[0].company_id=foreignCompanyId],
 ['truncated sample',x=>{x.view.handoff_sample_capped=true;x.view.handoff_total=61}],
 ['anonymous fake mutation',x=>x.view.mutation_authorized=true]
])assert.equal(mutate(fn),'withheld',name);
const foreign=fixture({now,viewer:reviewerId});foreign.view.handoffs[0].reviewer_user_id=foreignCompanyId;
assert.equal(inspect(foreign.view,{companyId,userId:reviewerId,now}).state,'withheld');
for(const name of ['ywi_rpc_reviewer_inbox_457','ywi_rpc_first_service_independent_457',
 'ywi_rpc_assign_independent_457','ywi_rpc_record_independent_457'])assert.ok(src.includes(name),name);
const sql=read('sql/pms_first_service_independent_review_457.sql');
for(const fragment of ['enable row level security','revoke all on public.ywi_first_service_handoffs_457',
 'revoke all on public.ywi_first_service_decisions_457','reviewer_user_id<>owner_user_id',
 'ywi_422_assert_owner','app_profile_module_permissions',"('approve','manage')",
 'ywi_new_work_gate_receipts_421','ywi_company_site_links_422','p_exception_review_id',
 'e.created_at>v_handoff.created_at','r.recorded_at<v_ready.recorded_at',
 'on conflict(company_id,request_id) do nothing','security definer set search_path',
 "'independent_service_approval',false", "'field_accepted',false"])
 assert.ok(sql.includes(fragment),fragment);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_first_service_(handoffs|decisions)_457\s+to\s+authenticated/i.test(sql));
for(const expected of ['pms457OwnerForm','pms457ReviewerForm','pms457Release',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed',
 'window.confirm','getRandomValues'])assert.ok(src.includes(expected),expected);
assert.ok(read('index.html').includes('js/pms-first-service-independent-457.js'));
assert.ok(read('help.html').includes('id="pms-first-service-independent-457"'));
assert.ok(read('style.css').includes('.pms457-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 457 implementation'));
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-first-service-independent-457','test:browser:pms-first-service-independent-457']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 457: tenant assignment, immutable independent exception decision, exact source and denied false acceptance: PASS');
