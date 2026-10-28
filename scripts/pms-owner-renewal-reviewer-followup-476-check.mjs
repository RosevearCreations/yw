import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from '../tests/fixtures/pms-owner-renewal-reviewer-followup-476.mjs';
const read=p=>readFileSync(p,'utf8');
const sources=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js',
 'js/pms-owner-renewal-reviewer-followup-476.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of sources){new Function(read(file));vm.runInNewContext(read(file),ctx);}
const inspect=ctx.window.YWI476.inspect;
assert.deepEqual(Array.from(ctx.window.YWI476.dispositions),
 ['record_documentary_recheck','request_owner_source_refresh','retain_independent_hold']);
for(const opts of [{renewalDays:0},{renewalDays:7},{renewalDays:8},{renewalDays:14},{renewalDays:15},
 {renewalDays:35,followedUp:true},{renewalDays:40,reviewer:true,followedUp:true},
 {noOwnerRenewal:true},{noFinding:true},{noRequest:true},{holdOnly:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 const d=inspect(f.view,{companyId,userId:actor});
 assert.equal(d.state,'source_verified',JSON.stringify({opts,reason:d.reason}));
 assert.equal(d.ownerRenewalEvidenceAging.length,f.view.owner_renewal_requests.length);}
for(const [name,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['unsafe release',f=>f.view.outbound_actions=true],
 ['wrong owner renewal age',f=>f.view.owner_renewal_evidence_aging[0].age_days=777],
 ['wrong owner renewal band',f=>f.view.owner_renewal_evidence_aging[0].band='current'],
 ['missing age',f=>f.view.owner_renewal_evidence_aging=[]],
 ['false clock',f=>f.view.reviewer_renewal_as_of=new Date(Date.now()+90000).toISOString()],
 ['wrong count',f=>f.view.reviewer_followup_receipt_total=19],
 ['truncated review receipts',f=>f.view.reviewer_followup_receipt_sample_capped=true],
 ['foreign reviewer',f=>f.view.reviewer_followup_receipts[0].reviewer_user_id=reviewerId],
 ['owner as reviewer',f=>f.view.reviewer_followup_receipts[0].reviewer_user_id=ownerId],
 ['foreign receipt company',f=>f.view.reviewer_followup_receipts[0].company_id=foreignCompanyId],
 ['foreign owner request',f=>f.view.reviewer_followup_receipts[0].owner_request_id=reviewerId],
 ['recycled 475 source',f=>f.view.reviewer_followup_receipts[0].source_reference=f.ownerRequest.source_reference],
 ['recycled 474 source',f=>f.view.reviewer_followup_receipts[0].source_reference=f.continuity.source_reference],
 ['recycled original handoff',f=>f.view.reviewer_followup_receipts[0].source_reference=f.handoff.source_reference],
 ['forbidden disposition',f=>f.view.reviewer_followup_receipts[0].disposition='release_green'],
 ['receipt predates owner evidence',f=>f.view.reviewer_followup_receipts[0].created_at=new Date(Date.parse(f.ownerRequest.created_at)-100).toISOString()],
 ['owner did not request reviewer action',f=>f.view.owner_renewal_requests[0].decision='retain_followup_hold'],
 ['broken original case',f=>f.view.handoff_source.cases=[]]
]){const f=fixture({followedUp:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:alternativeId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:alternativeId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_owner_renewal_reviewer_receipt_476.sql');
for(const term of ['ywi_renewal_reviewer_receipts_476','enable row level security',
 'revoke all on public.ywi_renewal_reviewer_receipts_476','ywi_rpc_reviewer_renewal_receipt_476',
 'ywi_rpc_reviewer_renewal_workspace_476','ywi_rpc_owner_renewal_workspace_475','ywi_465_assert_proposal',
 'pg_advisory_xact_lock','for update','service_enabled','overdue',
 "'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_renewal_reviewer_receipts_476\s+to\s+authenticated/i.test(sql));
const js=read(sources[10]);
for(const term of ['pms476ReviewerForm','pms476Hold','YWI475?.inspect',
 'ywi_rpc_reviewer_renewal_workspace_476','ywi_rpc_reviewer_renewal_receipt_476','window.confirm',
 'ywi:auth-changed'])assert.ok(js.includes(term),term);
assert.ok(read('index.html').includes('js/pms-owner-renewal-reviewer-followup-476.js'));
assert.ok(read('help.html').includes('id="pms-owner-renewal-reviewer-followup-476"'));
assert.ok(read('style.css').includes('.pms476-controls'));
const scripts=JSON.parse(read('package.json')).scripts,ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-owner-renewal-reviewer-followup-476','test:browser:pms-owner-renewal-reviewer-followup-476']){
 assert.ok(scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 476: owner renewal aging, original independent reviewer follow-up and HOLD: PASS');
