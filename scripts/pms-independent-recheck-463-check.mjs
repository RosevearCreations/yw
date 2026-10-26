import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-independent-recheck-463.mjs';
const read=p=>readFileSync(p,'utf8'),src=read('js/pms-independent-recheck-463.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,ctx);
const {inspect,inspectInbox,dispositions,modules}=ctx.window.YWI463;
assert.equal(modules.length,7);assert.equal(dispositions.length,3);
for(const o of [{},{assigned:true},{assigned:true,reviewed:true},{assigned:true,viewer:reviewerId},
 {assigned:true,reviewed:true,viewer:reviewerId},{off:true}]){
 const f=fixture(o);const viewer=o.viewer||ownerId;
 assert.equal(inspectInbox(f.inbox,{userId:viewer}).state,'source_verified',JSON.stringify(o));
 assert.equal(inspect(f.view,{companyId,userId:viewer}).state,'source_verified',JSON.stringify(o));
}
for(const [name,change] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['foreign owner',f=>f.view.cases[0].owner_user_id=foreignCompanyId],
 ['self-assigned reviewer',f=>f.view.assignments[0].reviewer_user_id=ownerId],
 ['same old reassessor',f=>f.view.assignments[0].reviewer_user_id=f.view.cases[0].reassessor_user_id],
 ['same comparing reviewer',f=>f.view.assignments[0].reviewer_user_id=f.view.cases[0].comparing_reviewer_id],
 ['false release',f=>f.view.release_green=true],['false service approval',f=>f.view.service_authorized=true],
 ['wrong received outcome',f=>f.view.cases[0].outcome='clarification_pending'],
 ['stale read',f=>f.view.captured_at=new Date(Date.now()-400000).toISOString()],
 ['truncated source',f=>{f.view.case_total=61;f.view.case_sample_capped=true;}],
 ['foreign outcome',f=>f.view.rechecks[0].assignment_id=foreignCompanyId],
 ['reversed reviewer timeline',f=>f.view.rechecks[0].created_at=new Date(Date.parse(f.view.assignments[0].created_at)-2000).toISOString()],
 ['missing service',f=>f.view.services.pop()]
]){const f=fixture({assigned:true,reviewed:true});change(f);assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',name);}
class ElementStub{constructor(){this.dataset={};this.children=[];}append(...a){this.children.push(...a);}replaceChildren(...a){this.children=a;}setAttribute(){}addEventListener(){}}
const admin=new ElementStub(),mount={window:{},document:{readyState:'complete',createElement:()=>new ElementStub(),getElementById:id=>id==='admin'?admin:null,addEventListener(){}}};
vm.runInNewContext(src,mount);assert.equal(admin.children.length,1,'463 panel mounts in strict mode');
const sql=read('sql/pms_independent_recheck_463.sql');
for(const s of ['ywi_recheck_assignments_463','ywi_recheck_outcomes_463','enable row level security',
 'revoke all on public.ywi_recheck_assignments_463','revoke all on public.ywi_recheck_outcomes_463',
 'ywi_rpc_recheck_inbox_463','ywi_rpc_recheck_workspace_463','ywi_rpc_assign_recheck_463','ywi_rpc_record_recheck_463',
 'ywi_422_assert_owner','ywi_460_assert_comparison_source','ywi_evidence_outcomes_462',
 'on conflict(company_id,operation_id) do nothing',"'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_recheck_(assignments|outcomes)_463\s+to\s+authenticated/i.test(sql));
for(const s of ['getRandomValues','pms463OwnerForm','pms463ReviewerForm','pms463Hold','window.confirm',
 'ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-independent-recheck-463.js'));
assert.ok(read('help.html').includes('id="pms-independent-recheck-463"'));
assert.ok(read('style.css').includes('.pms463-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const s of ['test:pms-independent-recheck-463','test:browser:pms-independent-recheck-463']){assert.ok(pkg.scripts[s]);assert.ok(ci.includes('npm run '+s));}
console.log('YW 463: independent assignment/source lineage, reviewer outcome and HOLD: PASS');
