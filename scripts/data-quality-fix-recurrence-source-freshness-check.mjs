#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const start=directory.indexOf('function buildDataQualityFixRecurrenceSourceFreshness');
const end=directory.indexOf('// Build 378: retrospective calibration',start);
assert.ok(start>0&&end>start,'Build 387 source slice exists');
const helper=directory.slice(start,end);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(helper),'Build 387 cannot mutate canonical sources');
const ctx=vm.createContext({});
vm.runInContext(helper.replace('input:any','input'),ctx);
const run=input=>JSON.parse(JSON.stringify(vm.runInContext('buildDataQualityFixRecurrenceSourceFreshness',ctx)(input,Date.parse('2026-10-12T12:00:00Z'))));
const keys=['crm_customers','crm_properties','jobs','dispatch','recurring','crews','equipment','routes','workability','material_plans','management_decision_outcomes'];
const fresh=()=>Object.fromEntries(keys.map(k=>[k,{freshness_state:'current',coverage_state:'within_query_limit',row_count:3,query_limit:500,stale_after_hours:168}]));
const rec=(key,date,status='recurring')=>({source_module:'admin',source_type:'data_quality_signal',source_key:'admin:data_quality_signal:'+key,decision_at:date+'T12:00:00Z',outcome_status:status});
const journal=[
  ...Array.from({length:6},(_,i)=>rec('oct-'+i,'2026-10-'+String(i+5).padStart(2,'0'))),
  ...Array.from({length:6},(_,i)=>rec('aug-'+i,'2026-08-'+String(i+10).padStart(2,'0'))),
  rec('fix','2026-09-02','resolved'),rec('fix','2026-10-11','recurring')
];
const d={adminVisible:true,jobsVisible:true,journalQueryOk:true,journalComplete:true,sourceFreshness:fresh(),journal,
  recurrence:{source_queries_ok:true,coverage_complete:true,current_outcomes:[
    {source_key:'admin:data_quality_signal:fix',signal_type:'broken_canonical_reference',outcome_state:'recurring',suggested_action:'Review references'}
  ]}};
const good=run(d);
assert.equal(good.state,'current');
assert.equal(good.cohorts[0].distinct_source_keys,7);
assert.equal(good.cohorts[0].repeat_after_recorded_fix_keys,1);
assert.equal(good.cohorts[1].distinct_source_keys,7);
assert.equal(good.source_freshness.length,11);
assert.equal(good.current_priorities.length,1);
assert.equal(run({...d,adminVisible:false}).state,'permission_hidden');
assert.equal(run({...d,jobsVisible:false}).state,'permission_hidden');
assert.equal(run({...d,journalQueryOk:false}).state,'source_unavailable');
assert.equal(run({...d,journalComplete:false}).state,'partial_coverage');
assert.equal(run({...d,recurrence:{...d.recurrence,coverage_complete:false}}).state,'partial_coverage');
assert.equal(run({...d,sourceFreshness:{...fresh(),jobs:{...fresh().jobs,freshness_state:'stale'}}}).state,'freshness_withheld');
assert.equal(run({...d,sourceFreshness:{...fresh(),jobs:{...fresh().jobs,coverage_gap:true}}}).state,'freshness_withheld');
assert.equal(run({...d,journal:[...journal,{...rec('invalid','2026-10-06'),decision_at:null}]}).state,'undated_history');
const sparse=run({...d,journal:journal.slice(0,3)});
assert.equal(sparse.state,'insufficient_sample');
assert.equal(sparse.cohorts[0].recurrence_percent,null);
assert.equal(sparse.cohorts[1].recurrence_percent,null);
for(const marker of ['owner387DataQualityFreshness','renderDataQualityFixRecurrenceFreshness','Quality comparison withheld','Canonical source freshness','data_quality_fix_recurrence_source_freshness'])assert.ok(ui.includes(marker),'Missing operator UI '+marker);
assert.equal(pkg.scripts['test:data-quality-fix-recurrence-source-freshness'],'node scripts/data-quality-fix-recurrence-source-freshness-check.mjs');
assert.ok(workflow.includes('npm run test:data-quality-fix-recurrence-source-freshness'));
assert.ok(workflow.includes('npm run test:browser:data-quality-fix-recurrence-source-freshness'));
assert.ok(read('help.html').includes('Build 387 — Data-Quality Fix Recurrence &amp; Source Freshness'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Next: **388 — Offline Conflict Closure & Device-Safe Reliability Cohorts**'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('After item 387, the next is **388'));
console.log('Build 387 source, permissions, freshness and timed recurrence checks GREEN');
