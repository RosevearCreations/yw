import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,foreignCompanyId,decisionId} from '../tests/fixtures/pms-independent-owner-followup-458.mjs';
const read=p=>readFileSync(p,'utf8');
const src=read('js/pms-independent-owner-followup-458.js');new Function(src);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(read('js/pms-first-service-independent-457.js'),ctx);
vm.runInNewContext(src,ctx);
const {inspect,dispositions}=ctx.window.YWI458;
const now=Date.now();
assert.equal(dispositions.length,4);
for(const setup of [{},{withFollowup:true},{empty:true},{off:true}]){
 const x=fixture({now,...setup});
 assert.equal(inspect(x.view,{companyId,userId:ownerId,now}).state,'source_verified',JSON.stringify(setup));
}
function mutate(fn){const x=fixture({now,withFollowup:true});fn(x);return inspect(x.view,{companyId,userId:ownerId,now}).state;}
for(const [name,fn] of [
 ['foreign tenant',x=>x.view.company_id=foreignCompanyId],
 ['foreign 457 original',x=>x.view.independent_snapshot.company_id=foreignCompanyId],
 ['false field approval',x=>x.view.field_accepted=true],
 ['false independent reapproval',x=>x.view.independent_reapproval=true],
 ['false release GREEN',x=>x.view.release_green=true],
 ['stale journal',x=>x.view.captured_at=new Date(now-360000).toISOString()],
 ['fake follow-up',x=>x.view.followups[0].company_id=foreignCompanyId],
 ['foreign independent decision',x=>x.view.followups[0].independent_decision_id=foreignCompanyId],
 ['mismatched resolution evidence',x=>x.view.followups[0].followup_evidence_id=foreignCompanyId],
 ['unjustified disposition',x=>x.view.followups[0].disposition='retest_evidence_ready'],
 ['replayed row',x=>{x.view.followups.push({...x.view.followups[0]});x.view.followup_total++}],
 ['fake age',x=>x.view.decision_aging[0].age_days=27],
 ['false seven-day marker',x=>x.view.decision_aging[0].older_than_seven_days=true],
 ['bad journal count',x=>x.view.decision_aging[0].followup_count=0],
 ['truncated journal',x=>{x.view.followup_total=61;x.view.followup_sample_capped=true}],
 ['false mutation authorization',x=>x.view.mutation_authorized=true],
 ['missing decision',x=>x.view.decision_aging[0].id=foreignCompanyId]
])assert.equal(mutate(fn),'withheld',name);
assert.equal(mutate(x=>x.view.decision_aging[0].id=decisionId),'source_verified');
const sql=read('sql/pms_independent_followup_458.sql');
for(const name of ['ywi_owner_independent_followups_458','ywi_rpc_owner_independent_followup_458',
 'ywi_rpc_append_owner_independent_followup_458','enable row level security',
 'revoke all on public.ywi_owner_independent_followups_458','ywi_422_assert_owner',
 'ywi_first_service_decisions_457','ywi_first_service_handoffs_457',
 'ywi_first_service_reviews_456','ywi_owner_first_use_entries_455',
 'ywi_company_site_links_422','ywi_new_work_gate_receipts_421',
 "('approve','manage')",'on conflict(company_id,request_id) do nothing',
 'security definer set search_path',"'independent_reapproval',false",
 "'field_accepted',false",'e.created_at>v_decision.created_at'])assert.ok(sql.includes(name),name);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_owner_independent_followups_458\s+to\s+authenticated/i.test(sql));
for(const name of ['pms458Form','pms458Release','ywi:auth-changed',
 'ywi:module-permissions-changed','ywi:company-service-offering-changed',
 'window.confirm','getRandomValues','owner_guard'])assert.ok(src.includes(name),name);
assert.ok(read('index.html').includes('js/pms-independent-owner-followup-458.js'));
assert.ok(read('help.html').includes('id="pms-independent-owner-followup-458"'));
assert.ok(read('style.css').includes('.pms458-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 458 implementation'));
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const name of ['test:pms-independent-owner-followup-458',
 'test:browser:pms-independent-owner-followup-458']){
 assert.ok(pkg.scripts[name]);assert.ok(ci.includes('npm run '+name));}
console.log('YW 458: original independent decisions, owner follow-up aging, immutable tenant-safe closure and withheld false approval: PASS');
