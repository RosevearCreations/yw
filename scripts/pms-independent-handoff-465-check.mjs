import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,reviewerId,alternativeId,foreignCompanyId} from '../tests/fixtures/pms-independent-handoff-465.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-independent-handoff-465.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,responses,modules}=ctx.window.YWI465;
assert.deepEqual(Array.from(responses),['acknowledged_for_review','declined_handoff']);assert.equal(modules.length,7);
for(const opts of [{},{handed:true},{handed:true,responded:true},{handed:true,viewer:alternativeId},
 {handed:true,responded:true,viewer:alternativeId},{off:true}]){
 const f=fixture(opts);assert.equal(inspectInbox(f.inbox,{userId:opts.viewer||ownerId}).state,'source_verified',JSON.stringify(opts));
 assert.equal(inspect(f.view,{companyId,userId:opts.viewer||ownerId}).state,'source_verified',JSON.stringify(opts));
}
for(const [name,change] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['owner mismatch',f=>f.view.cases[0].owner_user_id=reviewerId],
 ['self proposed',f=>f.view.cases[0].proposed_reviewer_user_id=ownerId],
 ['original reviewer reused',f=>f.view.cases[0].proposed_reviewer_user_id=reviewerId],
 ['old reassessor reused',f=>f.view.cases[0].proposed_reviewer_user_id=f.view.cases[0].reassessor_user_id],
 ['false reassignment',f=>f.view.reassignment_executed=true],
 ['wrong discrepancy',f=>f.view.cases[0].disposition='source_corresponds'],
 ['stale capture',f=>f.view.captured_at=new Date(Date.now()-400000).toISOString()],
 ['truncated data',f=>{f.view.handoff_total=61;f.view.handoff_sample_capped=true;}],
 ['wrong handoff reviewer',f=>f.view.handoffs[0].reviewer_user_id=reviewerId],
 ['wrong receipt handoff',f=>f.view.receipts[0].handoff_id=foreignCompanyId],
 ['unapproved response',f=>f.view.receipts[0].response='approved'],
 ['retroactive receipt',f=>f.view.receipts[0].created_at=new Date(Date.parse(f.view.handoffs[0].created_at)-2000).toISOString()],
 ['missing service',f=>f.view.services.pop()]
]){const f=fixture({handed:true,responded:true});change(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
class Stub{constructor(){this.dataset={};this.children=[];}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}setAttribute(){}addEventListener(){}}
const admin=new Stub(),mount={window:{},document:{readyState:'complete',createElement:()=>new Stub(),getElementById:id=>id==='admin'?admin:null,addEventListener(){}}};
vm.runInNewContext(src,mount);assert.equal(admin.children.length,1,'465 panel mounts');
const sql=read('sql/pms_independent_handoff_465.sql');
for(const s of ['ywi_reassignment_handoffs_465','ywi_reassignment_receipts_465','enable row level security',
 'revoke all on public.ywi_reassignment_handoffs_465','revoke all on public.ywi_reassignment_receipts_465',
 'ywi_465_assert_proposal','ywi_rpc_handoff_inbox_465','ywi_rpc_handoff_workspace_465','ywi_rpc_verify_handoff_465',
 'ywi_rpc_ack_handoff_465','ywi_422_assert_owner','ywi_463_assert_source','ywi_recheck_discrepancy_reviews_464',
 'p.proposed_reviewer_user_id',"'reassignment_executed',false","'outbound_actions',false",'for update'])assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_reassignment_(handoffs|receipts)_465\s+to\s+authenticated/i.test(sql));
for(const s of ['getRandomValues','pms465OwnerForm','pms465ReviewerForm','pms465Hold','window.confirm',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-independent-handoff-465.js'));
assert.ok(read('help.html').includes('id="pms-independent-handoff-465"'));
assert.ok(read('style.css').includes('.pms465-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const s of ['test:pms-independent-handoff-465','test:browser:pms-independent-handoff-465']){assert.ok(pkg.scripts[s]);assert.ok(ci.includes('npm run '+s));}
console.log('YW 465: distinct owner and reviewer handoff, private receipts and safe HOLD: PASS');
