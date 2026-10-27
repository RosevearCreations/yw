import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-comparison-followup-467.mjs';
const read=p=>readFileSync(p,'utf8');
const source465=read('js/pms-independent-handoff-465.js'),src=read('js/pms-comparison-followup-467.js');
new Function(src);const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(source465,ctx);vm.runInNewContext(src,ctx);
const {inspect,alignments,dispositions,decisions}=ctx.window.YWI467;
assert.deepEqual(Array.from(alignments),['matches_recorded_chain','material_gap','additional_evidence_required']);
assert.deepEqual(Array.from(dispositions),['exception_remains_open','request_source_clarification','ready_for_owner_reassessment']);
assert.deepEqual(Array.from(decisions),['request_further_evidence','retain_exception_hold','documentary_closeout']);
for(const opts of [{},{reviewer:true},{compared:true},{reviewer:true,compared:true},
 {compared:true,outcomeRecorded:true,followed:true},{reviewer:true,compared:true,outcomeRecorded:true,followed:true},
 {compared:true,outcomeRecorded:true,alignment:'matches_recorded_chain',disposition:'ready_for_owner_reassessment'}, {off:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 assert.equal(inspect(f.view,{companyId,userId:actor}).state,'source_verified',JSON.stringify(opts));}
for(const [label,change] of [
 ['foreign tenant',f=>f.view.company_id=foreignCompanyId],
 ['false field approval',f=>f.view.field_accepted=true],
 ['false release',f=>f.view.release_green=true],
 ['truncated comparisons',f=>f.view.comparison_total=61],
 ['foreign reviewer',f=>f.view.comparisons[0].reviewer_user_id=reviewerId],
 ['wrong receipt',f=>f.view.comparisons[0].receipt_id=foreignCompanyId],
 ['unauthorised result',f=>f.view.comparisons[0].alignment='service_approved'],
 ['changed original source',f=>f.view.comparisons[0].original_source_reference='TAMPERED-SOURCE'],
 ['retroactive comparison',f=>f.view.comparisons[0].created_at=new Date(Date.parse(f.receipt.created_at)-1000).toISOString()],
 ['late future capture',f=>f.view.captured_at=new Date(Date.now()-360000).toISOString()],
 ['disabled service',f=>f.view.handoff_source.services[0].enabled=false],
 ['wrong reviewer outcome',f=>f.view.outcomes[0].comparison_id=foreignCompanyId],
 ['wrong follow-up outcome',f=>f.view.followups[0].outcome_id=foreignCompanyId],
 ['foreign follow-up owner',f=>f.view.followups[0].owner_user_id=reviewerId],
 ['false exception closeout',f=>f.view.followups[0].decision='field_approved'],
 ['ready-for-owner reassessment incorrectly followed',f=>{f.view.comparisons[0].alignment='matches_recorded_chain';f.view.outcomes[0].disposition='ready_for_owner_reassessment';}],
 ['retroactive follow-up',f=>f.view.followups[0].created_at=new Date(Date.parse(f.outcome.created_at)-2000).toISOString()]
]){const f=fixture({compared:true,outcomeRecorded:true,followed:true});change(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',label);}
class Stub{constructor(){this.dataset={};this.children=[];}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}setAttribute(){}addEventListener(){}}
const mount={window:{},document:{readyState:'complete',createElement:()=>new Stub(),getElementById:id=>id==='admin'?new Stub():null,addEventListener(){}}};
vm.runInNewContext(src,mount);
const sql=read('sql/pms_independent_comparison_466_467.sql');
for(const s of ['ywi_reassigned_comparisons_466','ywi_reassigned_outcomes_466','ywi_comparison_followups_467','enable row level security',
 'revoke all on public.ywi_comparison_followups_467',
 'ywi_rpc_comparison_workspace_466','ywi_465_assert_proposal','ywi_422_assert_owner',
 'ywi_rpc_followup_comparison_467','ywi_rpc_comparison_workspace_467','for update',
 "'field_accepted',false","'reassignment_executed',false","'outbound_actions',false"])
 assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_comparison_followups_467\s+to\s+authenticated/i.test(sql));
assert.ok(!sql.includes('create table if not exists public.ywi_reassigned_comparisons_466'));
for(const s of ['pms467ReviewerForm','pms467OutcomeForm','pms467OwnerForm','pms467Hold','window.confirm',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed','YWI465?.inspect'])
 assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-comparison-followup-467.js'));
assert.ok(read('help.html').includes('id="pms-comparison-followup-467"'));
assert.ok(read('style.css').includes('.pms467-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const s of ['test:pms-comparison-followup-467','test:browser:pms-comparison-followup-467']){
 assert.ok(pkg.scripts[s]);assert.ok(ci.includes('npm run '+s));}
console.log('YW 466–467: independent comparison, sourced owner HOLD and immutable private journals: PASS');
