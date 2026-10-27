import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-continuity-exception-471.mjs';
const read=p=>readFileSync(p,'utf8');
const files=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js'];
const context={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of files){new Function(read(file));vm.runInNewContext(read(file),context);}
const inspect=context.window.YWI471.inspect;
assert.deepEqual(Array.from(context.window.YWI471.exceptionFindings),['request_source_clarification','recommend_owner_followup']);
for(const opts of [{exceptionDays:0},{exceptionDays:7},{exceptionDays:8},{exceptionDays:14},
 {exceptionDays:15},{exceptionDays:35,renewed:true},{exceptionDays:40,reviewer:true,renewed:true},
 {exceptionDays:5,holdOnly:true}]){
 const f=fixture(opts),id=opts.reviewer?alternativeId:ownerId;
 assert.equal(inspect(f.view,{companyId,userId:id}).state,'source_verified',JSON.stringify(opts));
}
for(const [label,change] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['false Jobs acceptance',f=>f.view.field_accepted=true],
 ['age missing',f=>f.view.exception_aging=[]],
 ['age forged',f=>f.view.exception_aging[0].age_days=900],
 ['band forged',f=>f.view.exception_aging[0].band='current'],
 ['clock drift',f=>f.view.exception_as_of=new Date(Date.now()+300000).toISOString()],
 ['wrong assessment',f=>f.view.exception_aging[0].reassessment_id=foreignCompanyId],
 ['incorrect exception total',f=>f.view.exception_total=0],
 ['false cap',f=>f.view.owner_renewal_sample_capped=true],
 ['false renewal total',f=>f.view.owner_renewal_total=9],
 ['recycled source',f=>f.view.owner_renewals[0].source_reference=f.confirmation.source_reference],
 ['owner impersonation',f=>f.view.owner_renewals[0].owner_user_id=alternativeId],
 ['reviewer as owner',f=>f.view.owner_renewals[0].owner_user_id=f.confirmation.reviewer_user_id],
 ['foreign renewal',f=>f.view.owner_renewals[0].company_id=foreignCompanyId],
 ['invalid owner decision',f=>f.view.owner_renewals[0].decision='release_green'],
 ['renewal before reviewer exception',f=>f.view.owner_renewals[0].created_at=new Date(Date.parse(f.confirmation.created_at)-5000).toISOString()],
 ['broken original comparison',f=>f.view.comparisons=[]],
 ['renewal for HOLD-only reviewer finding',f=>{f.view.confirmations[0].finding='continuity_hold_confirmed';}],
]){const f=fixture({renewed:true});change(f);assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',label);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_independent_continuity_owner_renewal_471.sql');
for(const token of ['ywi_continuity_owner_renewals_471','enable row level security',
 'revoke all on public.ywi_continuity_owner_renewals_471','ywi_rpc_owner_followup_471',
 'ywi_rpc_exception_workspace_471','ywi_rpc_continuity_workspace_470',
 'ywi_422_assert_owner','ywi_465_assert_proposal','pg_advisory_xact_lock',
 'for update','service_enabled','age_days','overdue',"'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(token),token);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_continuity_owner_renewals_471\s+to\s+authenticated/i.test(sql));
const source=read(files[5]);
for(const term of ['pms471OwnerForm','pms471Hold','ywi_rpc_exception_workspace_471',
 'ywi_rpc_owner_followup_471','YWI470?.inspect','window.confirm','ywi:auth-changed'])assert.ok(source.includes(term),term);
assert.ok(read('index.html').includes('js/pms-continuity-exception-owner-471.js'));
assert.ok(read('help.html').includes('id="pms-continuity-exception-471"'));
assert.ok(read('style.css').includes('.pms471-controls'));
const packageJson=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-continuity-exception-471','test:browser:pms-continuity-exception-471',
 'test:integration-contract-471']){assert.ok(packageJson.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 471: independent exception aging, owner-only immutable renewal, operational HOLD: PASS');
