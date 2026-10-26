import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,independentId,foreignCompanyId}
 from '../tests/fixtures/pms-retest-discrepancy-460.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-retest-discrepancy-460.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,kinds,outcomes,modules}=ctx.window.YWI460,now=Date.now();
assert.equal(modules.length,7);assert.equal(kinds.length,3);assert.equal(outcomes.length,3);
for(const opts of [{},{triaged:true},{reviewed:true},{gap:true},{off:true},{empty:true},{matched:true},{triaged:true,viewer:independentId},{reviewed:true,viewer:independentId}]){
 const f=fixture({now,...opts}),uid=opts.viewer||ownerId;
 assert.equal(inspectInbox(f.inbox,{userId:uid}).state,'source_verified',JSON.stringify(opts));
 assert.equal(inspect(f.view,{companyId,userId:uid}).state,'source_verified',JSON.stringify(opts));}
function mutate(fn){const f=fixture({now,reviewed:true});fn(f);return inspect(f.view,{companyId,userId:ownerId}).state;}
for(const [name,fn] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['foreign case',f=>f.view.cases[0].company_id=foreignCompanyId],
 ['original decision not returned',f=>f.view.cases[0].original_decision='exception_verified_closed'],
 ['fake field authority',f=>f.view.service_authorized=true],
 ['fake release green',f=>f.view.release_green=true],
 ['fake independent reapproval',f=>f.view.independent_reapproval=true],
 ['stale source',f=>f.view.captured_at=new Date(now-360000).toISOString()],
 ['truncated sample',f=>{f.view.case_total=61;f.view.case_sample_capped=true;}],
 ['invalid service',f=>f.view.services.pop()],
 ['off scope source',f=>f.view.cases[0].service_module_key='alien'],
 ['matching comparison',f=>f.view.cases[0].comparison_outcome='comparison_matches'],
 ['missing observation',f=>f.view.cases[0].fresh_checkpoint='office_note'],
 ['same original field evidence',f=>f.view.cases[0].original_evidence_id=f.view.cases[0].fresh_evidence_id],
 ['foreign triage',f=>f.view.triages[0].company_id=foreignCompanyId],
 ['same reviewer',f=>f.view.triages[0].reassessor_user_id=f.view.cases[0].comparing_reviewer_id],
 ['owner self reassessment',f=>f.view.triages[0].reassessor_user_id=ownerId],
 ['triage precedes comparison',f=>f.view.triages[0].created_at=f.view.cases[0].comparison_at],
 ['comparison before fresh evidence',f=>f.view.cases[0].comparison_at=f.view.cases[0].assignment_at],
 ['invalid reassessment outcome',f=>f.view.reassessments[0].outcome='approved'],
 ['review precedes triage',f=>f.view.reassessments[0].created_at=f.view.triages[0].created_at],
 ['false mutation authority',f=>f.view.mutation_authorized=true]
])assert.equal(mutate(fn),'withheld',name);
const sql=read('sql/pms_retest_discrepancy_triage_460.sql');
for(const s of ['ywi_retest_triages_460','ywi_retest_reassessments_460',
 'ywi_460_assert_comparison_source','ywi_rpc_discrepancy_inbox_460',
 'ywi_rpc_discrepancy_queue_460','ywi_rpc_triage_retest_discrepancy_460',
 'ywi_rpc_reassess_retest_discrepancy_460',
 'enable row level security','revoke all on public.ywi_retest_triages_460',
 'revoke all on public.ywi_retest_reassessments_460',
 'ywi_422_assert_owner','ywi_retest_comparisons_459','ywi_first_service_decisions_457',
 'ywi_owner_first_use_entries_455','ywi_company_site_links_422',
 'ywi_new_work_gate_receipts_421',"('approve','manage')",
 'v.fresh_at<=v.assignment_at','p_reassessor_user_id in (v_owner,v_comparer)',
 'on conflict(company_id,request_id) do nothing',"'service_authorized',false", "'release_green',false"])
 assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_retest_(triages|reassessments)_460\s+to\s+authenticated/i.test(sql));
for(const id of ['pms460OwnerForm','pms460ReviewerForm','pms460Release','ywi:auth-changed',
 'ywi:module-permissions-changed','ywi:company-service-offering-changed','window.confirm','getRandomValues'])
 assert.ok(src.includes(id),id);
assert.ok(read('index.html').includes('js/pms-retest-discrepancy-460.js'));
assert.ok(read('help.html').includes('id="pms-retest-discrepancy-460"'));
assert.ok(read('style.css').includes('.pms460-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 460 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-retest-discrepancy-460','test:browser:pms-retest-discrepancy-460']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 460: third-reviewer discrepancy triage, source chain, permission and HOLD: PASS');
