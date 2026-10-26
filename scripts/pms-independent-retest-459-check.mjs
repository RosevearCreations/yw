import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId}
 from '../tests/fixtures/pms-independent-retest-459.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-independent-retest-459.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,outcomes,modules}=ctx.window.YWI459,now=Date.now();
assert.equal(modules.length,7);assert.equal(outcomes.length,3);
for(const options of [{},{viewer:reviewerId},{unassigned:true},{compared:true},{off:true},{empty:true}]){
 const f=fixture({now,...options}),uid=options.viewer||ownerId;
 assert.equal(inspectInbox(f.inbox,{userId:uid,now}).state,'source_verified',JSON.stringify(options));
 assert.equal(inspect(f.view,{companyId,userId:uid,now}).state,'source_verified',JSON.stringify(options));}
function mutate(fn){const f=fixture({now,compared:true});fn(f);return inspect(f.view,{companyId,userId:ownerId,now}).state;}
for(const [name,fn] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['foreign source followup',f=>f.view.followups[0].company_id=foreignCompanyId],
 ['false approval',f=>f.view.field_accepted=true],
 ['false service authority',f=>f.view.service_authorized=true],
 ['false production GREEN',f=>f.view.release_green=true],
 ['stale snapshot',f=>f.view.captured_at=new Date(now-360000).toISOString()],
 ['missing module',f=>f.view.services.pop()],
 ['duplicate service',f=>f.view.services[0].module_key=f.view.services[1].module_key],
 ['foreign assignment',f=>f.view.assignments[0].company_id=foreignCompanyId],
 ['assignment before followup',f=>f.view.assignments[0].created_at=f.view.followups[0].decision_at],
 ['foreign evidence',f=>f.view.fresh_evidence[0].company_id=foreignCompanyId],
 ['evidence before assignment',f=>f.view.fresh_evidence[0].created_at=f.view.followups[0].created_at],
 ['comparison same original field source',f=>f.view.comparisons[0].fresh_evidence_id=f.view.followups[0].followup_evidence_id],
 ['invalid outcome',f=>f.view.comparisons[0].outcome='approved'],
 ['duplicate comparison',f=>{f.view.comparisons.push({...f.view.comparisons[0]});f.view.comparison_total++}],
 ['truncated sample',f=>{f.view.assignment_total=61;f.view.assignment_sample_capped=true}],
 ['fake mutation authorization',f=>f.view.mutation_authorized=true]
])assert.equal(mutate(fn),'withheld',name);
const sql=read('sql/pms_independent_retest_comparison_459.sql');
for(const s of ['ywi_retest_assignments_459','ywi_retest_comparisons_459',
 'ywi_rpc_retest_inbox_459','ywi_rpc_independent_retest_459',
 'ywi_rpc_assign_retest_459','ywi_rpc_record_retest_comparison_459',
 'enable row level security','revoke all on public.ywi_retest_assignments_459',
 'revoke all on public.ywi_retest_comparisons_459','ywi_422_assert_owner',
 'ywi_owner_independent_followups_458','ywi_first_service_decisions_457',
 'ywi_owner_first_use_entries_455','ywi_company_site_links_422',
 'ywi_new_work_gate_receipts_421',"('approve','manage')",
 'e.created_at>v_assignment.created_at','on conflict(company_id,request_id) do nothing',
 "'independent_reapproval',false","'field_accepted',false"])
 assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_retest_(assignments|comparisons)_459\s+to\s+authenticated/i.test(sql));
for(const id of ['pms459OwnerForm','pms459ReviewerForm','pms459Release',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed',
 'window.confirm','getRandomValues'])assert.ok(src.includes(id),id);
assert.ok(read('index.html').includes('js/pms-independent-retest-459.js'));
assert.ok(read('help.html').includes('id="pms-independent-retest-459"'));
assert.ok(read('style.css').includes('.pms459-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 459 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-independent-retest-459','test:browser:pms-independent-retest-459']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 459: independent retest source lineage, separate reviewer and fresh observation comparison: PASS');
