import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../tests/fixtures/pms-followup-renewal-468.mjs';
const read=p=>readFileSync(p,'utf8');
const prior=read('js/pms-independent-handoff-465.js'),compare=read('js/pms-comparison-followup-467.js'),src=read('js/pms-followup-renewal-468.js');
new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const code of [prior,compare,src])vm.runInNewContext(code,ctx);
const {inspect,decisions}=ctx.window.YWI468;
assert.deepEqual(Array.from(decisions),['refreshed_reference_needs_owner_review','evidence_still_insufficient','independent_escalation_recommended']);
for(const opts of [{},{days:7},{days:8},{days:14},{days:15},{days:40},{reviewer:true,days:15},
 {reviewer:true,days:40,renewed:true},{renewed:true},{off:true}]){
 const f=fixture(opts),actor=opts.reviewer?alternativeId:ownerId;
 if(opts.off)assert.equal(inspect(f.view,{companyId,userId:actor}).state,'withheld');
 else assert.equal(inspect(f.view,{companyId,userId:actor}).state,'source_verified',JSON.stringify(opts));
}
for(const [label,mutate] of [
 ['foreign company',f=>f.view.company_id=foreignCompanyId],
 ['false field authorization',f=>f.view.field_accepted=true],
 ['false release green',f=>f.view.release_green=true],
 ['false independent approval',f=>f.view.independent_reapproval=true],
 ['missing age sample',f=>f.view.aging=[]],
 ['tampered age',f=>f.view.aging[0].age_days=0],
 ['tampered band',f=>f.view.aging[0].band='current'],
 ['tampered as-of',f=>f.view.aging_as_of=new Date(Date.now()+360000).toISOString()],
 ['foreign age follow-up',f=>f.view.aging[0].followup_id=foreignCompanyId],
 ['duplicate age',f=>f.view.aging.push({...f.view.aging[0]})],
 ['wrong reviewer',f=>f.view.renewals[0].reviewer_user_id=reviewerId],
 ['owner impersonates reviewer',f=>f.view.renewals[0].reviewer_user_id=ownerId],
 ['foreign renewal',f=>f.view.renewals[0].company_id=foreignCompanyId],
 ['recycled owner reference',f=>f.view.renewals[0].source_reference=f.followup.source_reference],
 ['recycled comparison reference',f=>f.view.renewals[0].source_reference=f.comparison.compared_source_reference],
 ['renewal before owner evidence',f=>f.view.renewals[0].created_at=new Date(Date.parse(f.followup.created_at)-5000).toISOString()],
 ['truncated renewals',f=>f.view.renewal_total=61],
 ['false reviewer disposition',f=>f.view.renewals[0].decision='release_approved'],
 ['missing original comparison',f=>f.view.comparisons=[]]
]){const f=fixture({days:15,renewed:true});mutate(f);
 assert.equal(inspect(f.view,{companyId,userId:ownerId}).state,'withheld',label);}
const sql=read('sql/pms_followup_aging_renewal_468.sql');
for(const term of ['ywi_followup_renewals_468','enable row level security','revoke all on public.ywi_followup_renewals_468',
 'ywi_rpc_review_followup_468','ywi_rpc_renewal_workspace_468','ywi_rpc_comparison_workspace_467',
 'ywi_465_assert_proposal','is_reviewer','service_enabled','pg_advisory_xact_lock','for update',
 'age_days','overdue',"'field_accepted',false","'release_green',false","'outbound_actions',false"])
 assert.ok(sql.includes(term),term);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_followup_renewals_468\s+to\s+authenticated/i.test(sql));
assert.ok(!sql.includes('create table if not exists public.ywi_comparison_followups_467'));
for(const term of ['pms468ReviewerForm','pms468Hold','ywi_rpc_renewal_workspace_468',
 'ywi_rpc_review_followup_468','window.confirm','YWI467?.inspect','ywi:auth-changed'])assert.ok(src.includes(term),term);
assert.ok(read('index.html').includes('js/pms-followup-renewal-468.js'));
assert.ok(read('help.html').includes('id="pms-followup-renewal-468"'));
assert.ok(read('style.css').includes('.pms468-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-followup-renewal-468','test:browser:pms-followup-renewal-468']){
 assert.ok(pkg.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 468: sourced server-clock aging, separate reviewer renewal, private immutable HOLD: PASS');
