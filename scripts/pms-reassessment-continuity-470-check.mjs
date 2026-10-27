import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-reassessment-continuity-470.mjs';
const read=p=>readFileSync(p,'utf8');
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js','js/pms-reassessment-continuity-470.js'];
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const p of scripts){const code=read(p);new Function(code);vm.runInNewContext(code,ctx);}
const {inspect,findings}=ctx.window.YWI470;
assert.deepEqual(Array.from(findings),['continuity_hold_confirmed','request_source_clarification','recommend_owner_followup']);
for(const opts of [{reassessmentDays:0},{reassessmentDays:7},{reassessmentDays:8},{reassessmentDays:14},
 {reassessmentDays:15},{reassessmentDays:35,confirmed:true},{reassessmentDays:40,reviewer:true,confirmed:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 assert.equal(inspect(f.view,{companyId,userId:actor}).state,'source_verified',JSON.stringify(opts));}
for(const [label,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['false operational approval',f=>f.view.field_accepted=true],
 ['missing reassessment age',f=>f.view.reassessment_aging=[]],
 ['tampered age',f=>f.view.reassessment_aging[0].age_days=999],
 ['wrong age band',f=>f.view.reassessment_aging[0].band='current'],
 ['wrong server clock',f=>f.view.continuity_as_of=new Date(Date.now()+300000).toISOString()],
 ['foreign age row',f=>f.view.reassessment_aging[0].reassessment_id=foreignCompanyId],
 ['truncated confirmations',f=>f.view.confirmation_sample_capped=true],
 ['wrong reviewer',f=>f.view.confirmations[0].reviewer_user_id=reviewerId],
 ['owner impersonates reviewer',f=>f.view.confirmations[0].reviewer_user_id=ownerId],
 ['recycled owner source',f=>f.view.confirmations[0].source_reference=f.reassessment.source_reference],
 ['recycled reviewer source',f=>f.view.confirmations[0].source_reference=f.renewal.source_reference],
 ['invalid finding',f=>f.view.confirmations[0].finding='release_jobs'],
 ['confirmation before reassessment',f=>f.view.confirmations[0].created_at=new Date(Date.parse(f.reassessment.created_at)-1000).toISOString()],
 ['incorrect total',f=>f.view.confirmation_total=0],
 ['missing original comparison',f=>f.view.comparisons=[]]
]){const f=fixture({confirmed:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',label);}
assert.equal(inspect(fixture({off:true}).view,{companyId,userId:ownerId}).state,'withheld');
assert.equal(inspect(fixture().view,{companyId,userId:reviewerId}).state,'withheld');
const sql=read('sql/pms_owner_reassessment_continuity_470.sql');
for(const term of ['ywi_continuity_confirmations_470','enable row level security',
 'revoke all on public.ywi_continuity_confirmations_470','ywi_rpc_reviewer_confirm_470','ywi_rpc_continuity_workspace_470',
 'ywi_rpc_reassessment_workspace_469','ywi_465_assert_proposal','service_enabled',
 'pg_advisory_xact_lock','for update','age_days','overdue',"'field_accepted',false","'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_continuity_confirmations_470\s+to\s+authenticated/i.test(sql));
const src=read(scripts[4]);for(const term of ['pms470ReviewerForm','pms470Hold',
 'ywi_rpc_continuity_workspace_470','ywi_rpc_reviewer_confirm_470','YWI469?.inspect',
 'window.confirm','ywi:auth-changed'])assert.ok(src.includes(term),term);
assert.ok(read('index.html').includes('js/pms-reassessment-continuity-470.js'));
assert.ok(read('help.html').includes('id="pms-reassessment-continuity-470"'));
assert.ok(read('style.css').includes('.pms470-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-reassessment-continuity-470','test:browser:pms-reassessment-continuity-470']){
 assert.ok(pkg.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 470: independent reviewer continuity, immutable owner evidence aging, operational HOLD: PASS');
