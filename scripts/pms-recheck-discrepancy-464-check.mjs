import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,reviewerId,alternativeId,foreignCompanyId} from '../tests/fixtures/pms-recheck-discrepancy-464.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-recheck-discrepancy-464.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,decisions}=ctx.window.YWI464;
assert.deepEqual(Array.from(decisions),['request_clarification','retain_hold','propose_reassignment']);
for(const opts of [{},{reviewed:true},{reviewed:true,decision:'propose_reassignment'},{off:true}])
 assert.equal(inspect(fixture(opts).view,{companyId,userId:ownerId}).state,'source_verified',JSON.stringify(opts));
for(const [name,change] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['foreign owner',f=>f.view.cases[0].owner_user_id=reviewerId],
 ['self review',f=>f.view.cases[0].old_reviewer_id=ownerId],
 ['old assessor',f=>f.view.cases[0].old_reviewer_id=f.view.cases[0].reassessor_user_id],
 ['corresponding non-discrepancy',f=>f.view.cases[0].disposition='source_corresponds'],
 ['false reassignment',f=>f.view.reassignment_executed=true],
 ['false release',f=>f.view.release_green=true],
 ['stale source',f=>f.view.captured_at=new Date(Date.now()-400000).toISOString()],
 ['truncated sample',f=>{f.view.case_total=61;f.view.case_sample_capped=true;}],
 ['missing service',f=>f.view.services.pop()],
 ['foreign review',f=>f.view.reviews[0].recheck_outcome_id=foreignCompanyId],
 ['proposed original reviewer',f=>f.view.reviews[0].proposed_reviewer_user_id=reviewerId],
 ['proposed owner',f=>f.view.reviews[0].proposed_reviewer_user_id=ownerId],
 ['early review',f=>f.view.reviews[0].created_at=new Date(Date.parse(f.view.cases[0].created_at)-3000).toISOString()],
 ['wrong review decision',f=>f.view.reviews[0].decision='approve']
]){const f=fixture({reviewed:true,decision:'propose_reassignment'});change(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
assert.notEqual(alternativeId,reviewerId);
class Stub{constructor(){this.dataset={};this.children=[];}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}setAttribute(){}addEventListener(){}}
const host=new Stub(),mount={window:{},document:{readyState:'complete',createElement:()=>new Stub(),getElementById:id=>id==='admin'?host:null,addEventListener(){}}};
vm.runInNewContext(src,mount);assert.equal(host.children.length,1,'464 panel mounts');
const sql=read('sql/pms_recheck_discrepancy_464.sql');
for(const s of ['ywi_recheck_discrepancy_reviews_464','enable row level security','revoke all on public.ywi_recheck_discrepancy_reviews_464',
 'ywi_rpc_discrepancy_workspace_464','ywi_rpc_review_discrepancy_464','ywi_422_assert_owner','ywi_463_assert_source',
 'ywi_recheck_outcomes_463',"'propose_reassignment'","'release_green',false","'reassignment_executed',false",
 'v_case.old_reviewer_id','p_proposed_reviewer_user_id','operation_id=p_operation_id'])assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_recheck_discrepancy_reviews_464\s+to\s+authenticated/i.test(sql));
for(const s of ['getRandomValues','pms464OwnerForm','pms464Hold','window.confirm','ywi:auth-changed',
 'ywi:module-permissions-changed','ywi:company-service-offering-changed'])assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-recheck-discrepancy-464.js'));
assert.ok(read('help.html').includes('id="pms-recheck-discrepancy-464"'));
assert.ok(read('style.css').includes('.pms464-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const s of ['test:pms-recheck-discrepancy-464','test:browser:pms-recheck-discrepancy-464']){assert.ok(pkg.scripts[s]);assert.ok(ci.includes('npm run '+s));}
console.log('YW 464: independently sourced discrepancy, owner HOLD, proposed reviewer only: PASS');
