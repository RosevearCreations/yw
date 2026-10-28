import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from '../tests/fixtures/pms-owner-clarification-continuity-474.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of sources){new Function(read(file));vm.runInNewContext(read(file),ctx);}
const inspect=ctx.window.YWI474.inspect;
assert.deepEqual(Array.from(ctx.window.YWI474.dispositions),
 ['document_continuity_recheck','request_refreshed_owner_evidence','retain_independent_hold']);
for(const opts of [{clarificationDays:0},{clarificationDays:7},{clarificationDays:8},
 {clarificationDays:14},{clarificationDays:15},{clarificationDays:35,reviewed:true},
 {clarificationDays:40,reviewer:true,reviewed:true},{noClarification:true},{noRequest:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 const d=inspect(f.view,{companyId,userId:actor});
 assert.equal(d.state,'source_verified',JSON.stringify({opts,reason:d.reason}));
 assert.equal(d.clarificationAging.length,f.view.owner_clarifications.length);}
for(const [name,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['unsafe field authority',f=>f.view.field_accepted=true],
 ['wrong clarification age',f=>f.view.clarification_aging[0].age_days=900],
 ['wrong clarification band',f=>f.view.clarification_aging[0].band='current'],
 ['missing age',f=>f.view.clarification_aging=[]],
 ['future captured clock',f=>f.view.continuity_review_as_of=new Date(Date.now()+90000).toISOString()],
 ['wrong count',f=>f.view.continuity_review_total=20],
 ['truncated review sample',f=>f.view.continuity_review_sample_capped=true],
 ['foreign reviewer',f=>f.view.continuity_reviews[0].reviewer_user_id=reviewerId],
 ['owner impersonates reviewer',f=>f.view.continuity_reviews[0].reviewer_user_id=ownerId],
 ['foreign review company',f=>f.view.continuity_reviews[0].company_id=foreignCompanyId],
 ['foreign clarification',f=>f.view.continuity_reviews[0].owner_clarification_id=reviewerId],
 ['reused owner source',f=>f.view.continuity_reviews[0].source_reference=f.clarification.source_reference],
 ['reused 472 source',f=>f.view.continuity_reviews[0].source_reference=f.review.source_reference],
 ['reused prior handoff',f=>f.view.continuity_reviews[0].source_reference=f.handoff.source_reference],
 ['invalid disposition',f=>f.view.continuity_reviews[0].disposition='release_green'],
 ['review predates clarification',f=>f.view.continuity_reviews[0].created_at=new Date(Date.parse(f.clarification.created_at)-100).toISOString()],
 ['no owner response',f=>f.view.owner_clarifications=[]],
 ['broken ancestral proposal',f=>f.view.handoff_source.cases=[]],
]){const f=fixture({reviewed:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:alternativeId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:alternativeId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_owner_clarification_continuity_review_474.sql');
for(const term of ['ywi_clarification_continuity_reviews_474','enable row level security',
 'revoke all on public.ywi_clarification_continuity_reviews_474','ywi_rpc_continuity_review_474',
 'ywi_rpc_continuity_workspace_474','ywi_rpc_clarification_workspace_473','ywi_465_assert_proposal',
 'pg_advisory_xact_lock','for update','service_enabled','overdue',
 "'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_clarification_continuity_reviews_474\s+to\s+authenticated/i.test(sql));
const js=read(sources[8]);
for(const term of ['pms474ReviewerForm','pms474Hold','YWI473?.inspect',
 'ywi_rpc_continuity_workspace_474','ywi_rpc_continuity_review_474','window.confirm',
 'ywi:auth-changed'])assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('js/pms-owner-clarification-continuity-474.js'));
assert.ok(read('help.html').includes('id="pms-owner-clarification-continuity-474"'));
assert.ok(read('style.css').includes('.pms474-controls'));
const scripts=JSON.parse(read('package.json')).scripts,ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-owner-clarification-continuity-474','test:browser:pms-owner-clarification-continuity-474']){
 assert.ok(scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 474: owner clarification aging and independent documentary continuity HOLD: PASS');
