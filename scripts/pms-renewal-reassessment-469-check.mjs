import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-renewal-reassessment-469.mjs';
const read=p=>readFileSync(p,'utf8');
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const p of scripts){const src=read(p);new Function(src);vm.runInNewContext(src,ctx);}
const {inspect,decisions}=ctx.window.YWI469;
assert.deepEqual(Array.from(decisions),['request_updated_evidence','retain_owner_hold','document_reassessment_path']);
for(const options of [{renewalDays:0},{renewalDays:7},{renewalDays:8},{renewalDays:14},
 {renewalDays:15},{renewalDays:35,reassessed:true},{renewalDays:30,reviewer:true,reassessed:true}]){
 const f=fixture(options),actor=options.reviewer?alternativeId:ownerId;
 assert.equal(inspect(f.view,{companyId,userId:actor}).state,'source_verified',JSON.stringify(options));
}
for(const [label,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['false operational authority',f=>f.view.release_green=true],
 ['missing aging',f=>f.view.renewal_aging=[]],
 ['tampered age',f=>f.view.renewal_aging[0].age_days=444],
 ['tampered band',f=>f.view.renewal_aging[0].band='current'],
 ['altered server clock',f=>f.view.renewal_as_of=new Date(Date.now()+500000).toISOString()],
 ['foreign renewal',f=>f.view.renewal_aging[0].renewal_id=foreignCompanyId],
 ['truncated sample',f=>f.view.reassessment_sample_capped=true],
 ['false owner',f=>f.view.reassessments[0].owner_user_id=alternativeId],
 ['recycled reviewer source',f=>f.view.reassessments[0].source_reference=f.renewal.source_reference],
 ['false owner decision',f=>f.view.reassessments[0].decision='accept_job'],
 ['reassessment predates reviewer',f=>f.view.reassessments[0].created_at=new Date(Date.parse(f.renewal.created_at)-1000).toISOString()],
 ['wrong reassessment count',f=>f.view.reassessment_total=0],
 ['missing comparison',f=>f.view.comparisons=[]]
]){const f=fixture({reassessed:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',label);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_renewal_aging_owner_reassessment_469.sql');
for(const term of ['ywi_renewal_reassessments_469','enable row level security',
 'revoke all on public.ywi_renewal_reassessments_469','ywi_rpc_owner_reassess_469',
 'ywi_rpc_reassessment_workspace_469','ywi_rpc_renewal_workspace_468',
 'ywi_465_assert_proposal','service_enabled','pg_advisory_xact_lock','for update',
 'age_days','overdue',"'field_accepted',false","'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_renewal_reassessments_469\s+to\s+authenticated/i.test(sql));
const src=read(scripts[3]);for(const term of ['pms469OwnerForm','pms469Hold',
 'ywi_rpc_reassessment_workspace_469','ywi_rpc_owner_reassess_469',
 'YWI468?.inspect','window.confirm','ywi:auth-changed'])assert.ok(src.includes(term),term);
assert.ok(read('index.html').includes('js/pms-renewal-reassessment-469.js'));
assert.ok(read('help.html').includes('id="pms-renewal-reassessment-469"'));
assert.ok(read('style.css').includes('.pms469-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-renewal-reassessment-469','test:browser:pms-renewal-reassessment-469']){
 assert.ok(pkg.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 469: owner reassessment, 468 independent renewal aging, private immutable HOLD: PASS');
