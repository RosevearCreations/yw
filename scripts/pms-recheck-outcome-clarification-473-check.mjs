import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-recheck-outcome-clarification-473.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of sources){new Function(read(file));vm.runInNewContext(read(file),ctx);}
const inspect=ctx.window.YWI473.inspect;
assert.deepEqual(Array.from(ctx.window.YWI473.decisions),
 ['submit_clarification_evidence','ask_for_independent_recheck','retain_followup_hold']);
for(const opts of [{reviewDays:0},{reviewDays:7},{reviewDays:8},{reviewDays:14},{reviewDays:15},
 {reviewDays:35,responded:true},{reviewDays:40,reviewer:true,responded:true},
 {noRequest:true,reviewDays:14},{noClarification:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 const result=inspect(f.view,{companyId,userId:actor});assert.equal(result.state,'source_verified',JSON.stringify({opts,reason:result.reason}));}
for(const [name,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['field approved',f=>f.view.field_accepted=true],
 ['false age',f=>f.view.outcome_aging[0].age_days=999],
 ['false band',f=>f.view.outcome_aging[0].band='current'],
 ['age missing',f=>f.view.outcome_aging=[]],
 ['false captured time',f=>f.view.outcome_as_of=new Date(Date.now()+90000).toISOString()],
 ['false total',f=>f.view.clarification_total=50],
 ['sample truncated',f=>f.view.clarification_sample_capped=true],
 ['foreign owner',f=>f.view.owner_clarifications[0].owner_user_id=reviewerId],
 ['reviewer impersonates owner',f=>f.view.owner_clarifications[0].owner_user_id=alternativeId],
 ['foreign clarification company',f=>f.view.owner_clarifications[0].company_id=foreignCompanyId],
 ['wrong review reference',f=>f.view.owner_clarifications[0].assignment_review_id=reviewerId],
 ['recycled 472 source',f=>f.view.owner_clarifications[0].source_reference=f.review.source_reference],
 ['recycled 471 source',f=>f.view.owner_clarifications[0].source_reference=f.ownerRenewal.source_reference],
 ['recycled handoff source',f=>f.view.owner_clarifications[0].source_reference=f.handoff.source_reference],
 ['unsafe decision',f=>f.view.owner_clarifications[0].decision='release_green'],
 ['owner before review',f=>f.view.owner_clarifications[0].created_at=new Date(Date.parse(f.review.created_at)-100).toISOString()],
 ['review no clarification request',f=>f.view.assignment_reviews[0].disposition='retain_independent_hold'],
 ['broken chain',f=>f.view.comparisons=[]],
]){const f=fixture({responded:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_independent_recheck_owner_clarification_473.sql');
for(const term of ['ywi_recheck_owner_clarifications_473','enable row level security',
 'revoke all on public.ywi_recheck_owner_clarifications_473','ywi_rpc_owner_clarification_473',
 'ywi_rpc_clarification_workspace_473','ywi_rpc_recheck_workspace_472','ywi_465_assert_proposal',
 'ywi_422_assert_owner','pg_advisory_xact_lock','for update','service_enabled','overdue',
 "'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_recheck_owner_clarifications_473\s+to\s+authenticated/i.test(sql));
const js=read(sources[7]);
for(const term of ['pms473OwnerForm','pms473Hold','YWI472?.inspect',
 'ywi_rpc_clarification_workspace_473','ywi_rpc_owner_clarification_473','window.confirm',
 'ywi:auth-changed'])assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('js/pms-review-outcome-owner-clarification-473.js'));
assert.ok(read('help.html').includes('id="pms-recheck-outcome-clarification-473"'));
assert.ok(read('style.css').includes('.pms473-controls'));
const scripts=JSON.parse(read('package.json')).scripts,ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-recheck-outcome-clarification-473','test:browser:pms-recheck-outcome-clarification-473']){
 assert.ok(scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 473: independent review outcome aging, distinct owner clarification and operational HOLD: PASS');
