#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8'),s=read('supabase/functions/admin-directory/index.ts');
const i=s.indexOf('function buildFourSeasonCrewDayMixConstraintBacktesting'),j=s.indexOf('\nserve(async (req)',i);
assert.ok(i>0&&j>i,'Build 389 helper source exists');
const helper=s.slice(i,j);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(helper),'Build 389 must remain read only');
const fake={
  ontarioDateKey:v=>v instanceof Date ? v.toISOString().slice(0,10) : String(v||'').slice(0,10),
  addCalendarDays:(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),
  forecastSeason:r=>r.season_context||'four_season'
};
const sandbox=vm.createContext(fake);vm.runInContext(helper.replace('input:any','input'),sandbox);
const run=x=>JSON.parse(JSON.stringify(vm.runInContext('buildFourSeasonCrewDayMixConstraintBacktesting',sandbox)(x,'2026-10-12')));
const keys=['dispatch','recurring_visits','crews','equipment','workability','production','routes'];
const fresh=()=>Object.fromEntries(keys.map(k=>[k,{freshness_state:'current',coverage_state:'within_query_limit',row_count:3,query_limit:500}]));
const date=(x)=>new Date('2026-10-12T12:00:00Z').getTime()+x*86400000;
const iso=(ms)=>new Date(ms).toISOString().slice(0,10);
const rows=Array.from({length:12},(_,i)=>({work_order_id:'WO'+i,season_context:i%2?'fall':'spring_summer',
  scheduled_start:iso(date(-5-i*6))+'T12:00:00Z',crew_id:'c1',schedule_status:'scheduled'}));
const completed=rows.map((r,i)=>({work_order_id:r.work_order_id,session_status:'completed',session_date:iso(Date.parse(r.scheduled_start)+((i%3===0)?86400000:0))}));
const d={jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,sourceFreshness:fresh(),
  dispatch:[...rows,{work_order_id:'forward-summer',season_context:'spring_summer',scheduled_start:'2026-10-13T12:00:00Z',crew_id:'c1'},
    {work_order_id:'forward-fall',season_context:'fall',scheduled_start:'2026-10-13T12:00:00Z',crew_id:'c1'}],
  production:completed,
  capacityForecast:{days:[{date:'2026-10-13',total_planned_items:2,season_load:{spring_summer:1,fall:1},
    readiness_state:'attention',workability_blocked_count:0,unassigned_dispatch_count:0,equipment_attention_count:1}]}};
const ok=run(d);
assert.equal(ok.state,'current');
assert.equal(ok.summary.mixed_assigned_crew_days,1);
assert.equal(ok.summary.days_with_multiple_season_loads,1);
assert.equal(ok.summary.days_with_readiness_constraints,1);
assert.equal(ok.summary.unambiguous_completion_pairs_90_days,12);
assert.equal(ok.backtest_cohorts[0].matched_completed_pairs,5);
assert.equal(ok.backtest_cohorts[1].matched_completed_pairs,7);
assert.equal(ok.seasons.find(x=>x.season_context==='spring_summer').mixed_crew_days_for_season,1);
assert.ok(!JSON.stringify(ok).includes('WO0')&&!JSON.stringify(ok).includes('c1'),'Must not expose work order/crew identity');
assert.equal(run({...d,jobsVisible:false}).state,'permission_hidden');
assert.equal(run({...d,sourceQueriesOk:false}).state,'source_unavailable');
assert.equal(run({...d,coverageComplete:false}).state,'partial_coverage');
assert.equal(run({...d,sourceFreshness:{...fresh(),dispatch:{...fresh().dispatch,freshness_state:'stale'}}}).state,'freshness_withheld');
assert.equal(run({...d,sourceFreshness:{...fresh(),production:{...fresh().production,coverage_gap:true}}}).state,'freshness_withheld');
const ambiguous=run({...d,dispatch:[...d.dispatch,rows[0]]});
assert.equal(ambiguous.summary.ambiguous_work_orders_excluded,1);
assert.equal(ambiguous.summary.unambiguous_completion_pairs_90_days,11);
const sparse=run({...d,production:completed.slice(0,2)});
assert.equal(sparse.state,'insufficient_historical_pairs');
assert.equal(sparse.backtest_cohorts[1].on_day_alignment_percent,null);
const nothing=run({...d,dispatch:[],production:[],capacityForecast:{days:[]}});
assert.equal(nothing.state,'no_current_plan');
for(const k of ['owner389CrewDayBacktest','renderFourSeasonCrewDayMixBacktest','Four-season crew-day mix constraint','Recorded-plan completion backtesting']){
  assert.ok(read('js/admin-owner-management-command-ui.js').includes(k),'UI missing '+k);
}
assert.ok(read('help.html').includes('Build 389 — Four-Season Crew-Day Mix Constraint'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Next: **390 — Production Learning & Autonomous Roadmap Renewal III**'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('After item 389, the next is **390'));
const pkg=JSON.parse(read('package.json'));assert.equal(pkg.scripts['test:four-season-crew-day-mix-backtesting'],'node scripts/four-season-crew-day-mix-backtesting-check.mjs');
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:four-season-crew-day-mix-backtesting')&&flow.includes('npm run test:browser:four-season-crew-day-mix-backtesting'));
new Function(read('js/admin-owner-management-command-ui.js'));
console.log('Build 389 season crew-day, retrospective pair, permission and evidence safety checks GREEN');
