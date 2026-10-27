import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-owner-renewal-recheck-472.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const src of sources){new Function(read(src));vm.runInNewContext(read(src),ctx);}
const inspect=ctx.window.YWI472.inspect;
assert.deepEqual(Array.from(ctx.window.YWI472.dispositions),[
 'confirm_recheck_intake','request_owner_source_clarification','retain_independent_hold']);
for(const opts of [{ownerDays:0},{ownerDays:7},{ownerDays:8},{ownerDays:14},{ownerDays:15},
 {ownerDays:35,reviewed:true},{ownerDays:40,reviewer:true,reviewed:true},{noRequest:true}]){
 const f=fixture(opts),who=opts.reviewer?alternativeId:ownerId;
 assert.equal(inspect(f.view,{companyId,userId:who}).state,'source_verified',JSON.stringify(opts));}
for(const [name,change] of [
 ['cross tenant',f=>f.view.company_id=foreignCompanyId],
 ['field approval',f=>f.view.field_accepted=true],
 ['false age',f=>f.view.recheck_aging[0].age_days=900],
 ['false band',f=>f.view.recheck_aging[0].band='current'],
 ['missing age',f=>f.view.recheck_aging=[]],
 ['false clock',f=>f.view.recheck_as_of=new Date(Date.now()+50000).toISOString()],
 ['bad total',f=>f.view.assignment_review_total=999],
 ['capped sample',f=>f.view.assignment_review_sample_capped=true],
 ['owner acting as reviewer',f=>f.view.assignment_reviews[0].reviewer_user_id=ownerId],
 ['foreign reviewer',f=>f.view.assignment_reviews[0].reviewer_user_id=reviewerId],
 ['wrong company review',f=>f.view.assignment_reviews[0].company_id=foreignCompanyId],
 ['recycled owner reference',f=>f.view.assignment_reviews[0].source_reference=f.ownerRenewal.source_reference],
 ['recycled continuity reference',f=>f.view.assignment_reviews[0].source_reference=f.confirmation.source_reference],
 ['invalid decision',f=>f.view.assignment_reviews[0].disposition='release_green'],
 ['review before owner request',f=>f.view.assignment_reviews[0].created_at=new Date(Date.parse(f.ownerRenewal.created_at)-100).toISOString()],
 ['broken chain',f=>f.view.comparisons=[]],
 ['nonrequested owner decision',f=>f.view.owner_renewals[0].decision='retain_exception_hold'],
]){const f=fixture({reviewed:true});change(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_owner_renewal_independent_recheck_472.sql');
for(const term of ['ywi_independent_recheck_reviews_472','enable row level security',
 'revoke all on public.ywi_independent_recheck_reviews_472','ywi_rpc_reviewer_recheck_472',
 'ywi_rpc_recheck_workspace_472','ywi_rpc_exception_workspace_471','ywi_465_assert_proposal',
 'pg_advisory_xact_lock','for update','service_enabled','overdue',"'release_green',false", "'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_independent_recheck_reviews_472\s+to\s+authenticated/i.test(sql));
const js=read(sources[6]);
for(const term of ['pms472ReviewerForm','pms472Hold','YWI471?.inspect',
 'ywi_rpc_recheck_workspace_472','ywi_rpc_reviewer_recheck_472','window.confirm','ywi:auth-changed'])
 assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('js/pms-owner-renewal-recheck-472.js'));
assert.ok(read('help.html').includes('id="pms-owner-renewal-recheck-472"'));
assert.ok(read('style.css').includes('.pms472-controls'));
const p=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-owner-renewal-recheck-472','test:browser:pms-owner-renewal-recheck-472']){
 assert.ok(p.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 472: owner request aging, separate reviewer intake and operational HOLD: PASS');
