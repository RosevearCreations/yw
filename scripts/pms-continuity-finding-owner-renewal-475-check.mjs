import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from '../tests/fixtures/pms-continuity-finding-owner-renewal-475.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of sources){new Function(read(file));vm.runInNewContext(read(file),ctx);}
const inspect=ctx.window.YWI475.inspect;
assert.deepEqual(Array.from(ctx.window.YWI475.decisions),
 ['submit_renewed_documentary_source','request_independent_continuity_recheck','retain_followup_hold']);
for(const opts of [{findingDays:0},{findingDays:7},{findingDays:8},{findingDays:14},{findingDays:15},
 {findingDays:35,renewed:true},{findingDays:40,reviewer:true,renewed:true},
 {noFinding:true},{noClarification:true},{noRequest:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 const d=inspect(f.view,{companyId,userId:actor});
 assert.equal(d.state,'source_verified',JSON.stringify({opts,reason:d.reason}));
 assert.equal(d.continuityFindingAging.length,f.view.continuity_reviews.length);
}
for(const [name,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['unsafe field release',f=>f.view.service_authorized=true],
 ['wrong finding age',f=>f.view.continuity_finding_aging[0].age_days=999],
 ['wrong finding band',f=>f.view.continuity_finding_aging[0].band='current'],
 ['missing age',f=>f.view.continuity_finding_aging=[]],
 ['bad clock',f=>f.view.owner_renewal_as_of=new Date(Date.now()+120000).toISOString()],
 ['wrong total',f=>f.view.owner_renewal_request_total=9],
 ['truncated request list',f=>f.view.owner_renewal_request_sample_capped=true],
 ['cross-company response',f=>f.view.owner_renewal_requests[0].company_id=foreignCompanyId],
 ['different owner',f=>f.view.owner_renewal_requests[0].owner_user_id=reviewerId],
 ['reviewer signs owner response',f=>f.view.owner_renewal_requests[0].owner_user_id=alternativeId],
 ['foreign finding reference',f=>f.view.owner_renewal_requests[0].continuity_review_id=reviewerId],
 ['duplicate 474 source',f=>f.view.owner_renewal_requests[0].source_reference=f.continuity.source_reference],
 ['duplicate old 473 owner source',f=>f.view.owner_renewal_requests[0].source_reference=f.clarification.source_reference],
 ['duplicate handoff source',f=>f.view.owner_renewal_requests[0].source_reference=f.handoff.source_reference],
 ['forbidden owner release',f=>f.view.owner_renewal_requests[0].decision='release_green'],
 ['response predates finding',f=>f.view.owner_renewal_requests[0].created_at=new Date(Date.parse(f.continuity.created_at)-10).toISOString()],
 ['no reviewer renewal request',f=>f.view.continuity_reviews[0].disposition='retain_independent_hold'],
 ['broken evidence chain',f=>f.view.handoff_source.cases=[]]
]){const f=fixture({renewed:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_independent_continuity_owner_renewal_475.sql');
for(const term of ['ywi_continuity_owner_requests_475','enable row level security',
 'revoke all on public.ywi_continuity_owner_requests_475','ywi_rpc_owner_continuity_request_475',
 'ywi_rpc_owner_renewal_workspace_475','ywi_rpc_continuity_workspace_474','ywi_465_assert_proposal',
 'ywi_422_assert_owner','pg_advisory_xact_lock','for update','service_enabled','overdue',
 "'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_continuity_owner_requests_475\s+to\s+authenticated/i.test(sql));
const js=read(sources[9]);
for(const term of ['pms475OwnerForm','pms475Hold','YWI474?.inspect',
 'ywi_rpc_owner_renewal_workspace_475','ywi_rpc_owner_continuity_request_475','window.confirm',
 'ywi:auth-changed'])assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('js/pms-continuity-finding-owner-renewal-475.js'));
assert.ok(read('help.html').includes('id="pms-continuity-finding-owner-renewal-475"'));
assert.ok(read('style.css').includes('.pms475-controls'));
const scripts=JSON.parse(read('package.json')).scripts,ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-continuity-finding-owner-renewal-475','test:browser:pms-continuity-finding-owner-renewal-475']){
 assert.ok(scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 475: independent continuity findings, owner-only renewal and HOLD: PASS');
