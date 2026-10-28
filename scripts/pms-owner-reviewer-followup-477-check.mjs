import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId}
 from '../tests/fixtures/pms-owner-reviewer-followup-477.mjs';
const read=p=>readFileSync(p,'utf8');
const files=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js',
 'js/pms-owner-renewal-reviewer-followup-476.js','js/pms-owner-reviewer-followup-477.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of files)vm.runInNewContext(read(file),ctx);
const inspect=ctx.window.YWI477.inspect;
for(const [days,ownerResponse] of [[0,false],[7,false],[8,false],[14,false],[15,false],[35,true]]){
 const f=fixture({days,ownerResponse});
 const d=inspect(f.view,{companyId,userId:ownerId});
 assert.equal(d.state,'source_verified',JSON.stringify({days,ownerResponse,reason:d.reason}));
 assert.equal(d.reviewerReceiptAging[0].band,days>=15?'overdue':days>=8?'aging':'current');}
for(const [name,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['unsafe approval',f=>f.view.release_green=true],
 ['wrong age',f=>f.view.reviewer_receipt_aging[0].age_days=999],
 ['missing age',f=>f.view.reviewer_receipt_aging=[]],
 ['future time',f=>f.view.owner_reviewer_as_of=new Date(Date.now()+999999).toISOString()],
 ['false response total',f=>f.view.owner_reviewer_response_total=18],
 ['capped',f=>f.view.owner_reviewer_response_sample_capped=true],
 ['foreign owner',f=>f.view.owner_reviewer_responses[0].owner_user_id=reviewerId],
 ['recycled 476 evidence',f=>f.view.owner_reviewer_responses[0].source_reference=f.reviewerReceipt.source_reference],
 ['wrong receipt',f=>f.view.owner_reviewer_responses[0].reviewer_receipt_id=alternativeId],
 ['reviewer not asking',f=>f.view.reviewer_followup_receipts[0].disposition='retain_independent_hold']
]){const f=fixture({ownerResponse:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
const sql=read('sql/pms_owner_reviewer_followup_477.sql');
for(const term of ['enable row level security','revoke all on public.ywi_owner_reviewer_responses_477',
 'ywi_rpc_owner_reviewer_workspace_477','ywi_rpc_owner_reviewer_response_477','request_owner_source_refresh',
 'pg_advisory_xact_lock','for update',"'release_green',false","'outbound_actions',false"])assert.ok(sql.includes(term),term);
const html=read('index.html'),pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
assert.ok(html.includes('js/pms-owner-reviewer-followup-477.js'));
for(const k of ['test:pms-owner-reviewer-followup-477','test:browser:pms-owner-reviewer-followup-477']){
 assert.ok(pkg.scripts[k]);assert.ok(ci.includes('npm run '+k));}
const doc=read('docs/YW_BUILD_477_QL245_EVIDENCE_RETURN.md');
for(const word of ['UNVERIFIED','NOT PROVISIONED','DISCONNECTED / HOLD','NOT GIVEN','seven'])assert.ok(doc.includes(word),word);
console.log('YW 477 source, receipt aging, original owner response and QL-245 truthful HOLD: PASS');