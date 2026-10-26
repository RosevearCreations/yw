import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,foreignCompanyId} from '../tests/fixtures/pms-reassessment-followup-461.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-reassessment-followup-461.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,kinds,modules}=ctx.window.YWI461,now=Date.now();
assert.equal(modules.length,7);assert.equal(kinds.length,3);
for(const opts of [{},{aged:true},{requested:true},{off:true},{empty:true}]){
 const f=fixture({now,...opts});assert.equal(inspectInbox(f.inbox,{userId:ownerId}).state,'source_verified',JSON.stringify(opts));
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'source_verified',JSON.stringify(opts));}
const fail=(name,fn)=>{const f=fixture({now,requested:true});fn(f);assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);};
for(const [name,mutation] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['foreign reassessment',f=>f.view.reassessments[0].company_id=foreignCompanyId],
 ['foreign owner',f=>f.view.reassessments[0].owner_user_id=foreignCompanyId],
 ['self reassessment',f=>f.view.reassessments[0].reassessor_user_id=ownerId],
 ['false release',f=>f.view.release_green=true],
 ['false service authorization',f=>f.view.service_authorized=true],
 ['false outbound',f=>f.view.outbound_actions=true],
 ['false reapproval',f=>f.view.independent_reapproval=true],
 ['stale read',f=>f.view.captured_at=new Date(now-400000).toISOString()],
 ['truncated rows',f=>{f.view.reassessment_total=61;f.view.reassessment_sample_capped=true;}],
 ['tampered age',f=>f.view.reassessments[0].age_days=100],
 ['unmatched outcome',f=>f.view.reassessments[0].comparison_outcome='comparison_matches'],
 ['invalid finding',f=>f.view.reassessments[0].reassessment_outcome='closed'],
 ['reversed triage timeline',f=>f.view.reassessments[0].triaged_at=f.view.reassessments[0].compared_at],
 ['foreign journal owner',f=>f.view.requests[0].owner_user_id=foreignCompanyId],
 ['unlinked journal',f=>f.view.requests[0].reassessment_id=foreignCompanyId],
 ['missing toggle',f=>f.view.services.pop()]
])fail(name,mutation);
const sql=read('sql/pms_reassessment_followup_461.sql');
for(const s of ['ywi_reassessment_evidence_requests_461','enable row level security',
 'revoke all on public.ywi_reassessment_evidence_requests_461','ywi_rpc_reassessment_owner_inbox_461',
 'ywi_rpc_reassessment_followups_461','ywi_rpc_request_reassessment_evidence_461',
 'ywi_422_assert_owner','ywi_460_assert_comparison_source','ywi_retest_reassessments_460',
 'ywi_retest_triages_460','ywi_retest_comparisons_459','ywi_owner_independent_followups_458',
 'ywi_first_service_decisions_457','ywi_first_service_reviews_456',
 "('approve','manage')",'on conflict(company_id,request_id) do nothing',
 "'outbound_actions',false","'release_green',false"])
 assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_reassessment_evidence_requests_461\s+to\s+authenticated/i.test(sql));
for(const s of ['pms461Form','pms461Hold','getRandomValues','window.confirm',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
 assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-reassessment-followup-461.js'));
assert.ok(read('help.html').includes('id="pms-reassessment-followup-461"'));
assert.ok(read('style.css').includes('.pms461-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 461 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-reassessment-followup-461','test:browser:pms-reassessment-followup-461']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 461: independent finding age, documentary owner request, source lineage and HOLD: PASS');
