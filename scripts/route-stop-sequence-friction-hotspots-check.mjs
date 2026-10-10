import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const server=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const hand=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const html=read('index.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const must=(s,a,label)=>a.forEach(x=>assert.ok(s.includes(x),label+': '+x));
const start=server.indexOf('function buildRouteStopSequenceFrictionHotspots(');
const end=server.indexOf('function buildRoutePlanActualStopSequenceLearning(',start);
assert.ok(start>=0&&end>start,'standalone seasonal hotspot function');
const block=server.slice(start,end);
assert.ok(!/\.(insert|upsert|delete|update)\s*\(/.test(block),'no source mutation');
must(server,['route_stop_friction_hotspots:buildManagementMetricConfidence',
  'route_stop_sequence_friction_hotspots:routeStopSequenceFrictionHotspots',
  'coverageComplete:[dispatchRead,productionRead,timekeepingDetailRead,routesRead,workabilityRead].every'],
  'server wiring');
must(ui,['id="owner379Hotspots"','function renderRouteStopSequenceFrictionHotspots',
  'renderRouteStopSequenceFrictionHotspots();','data-owner379-season','data-owner379-state',
  '/help.html#route-stop-sequence-friction-hotspots'],'panel');
must(help,['id="route-stop-sequence-friction-hotspots"','five eligible route-days','partial, tied or missing start'],'Help');
must(roadmap,['#### **379 — Route Stop-Sequence Friction Hotspots by Season** is implemented',
  'The next planned autonomous item is **380 — Recurring Retention Cohort & Renewal Lag**'],'roadmap');
must(hand,['**379 — Route Stop-Sequence Friction Hotspots by Season** (implemented)',
  'After item 379, the next is 380'],'handbook');
must(html,['admin-owner-management-command-ui.js?v=2026-10-10b379'],'cache key');
assert.equal(pkg.scripts['test:route-stop-sequence-friction-hotspots'],'node scripts/route-stop-sequence-friction-hotspots-check.mjs');
assert.equal(pkg.scripts['test:browser:route-stop-sequence-friction-hotspots'],'playwright test --config=playwright.config.mjs tests/browser/route-stop-sequence-friction-hotspots.spec.mjs');
must(workflow,['npm run test:route-stop-sequence-friction-hotspots','npm run test:browser:route-stop-sequence-friction-hotspots'],'CI');
const js=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const calculate=vm.runInNewContext(js+';buildRouteStopSequenceFrictionHotspots;');
const dates=['2026-09-01','2026-09-03','2026-09-05','2026-09-07','2026-09-09'];
const rows=dates.flatMap((date,index)=>[1,2].map(pos=>({
  route_id:'ROUTE-1',route_name:'East Route',dispatch_id:date+'-'+pos,service_date:date,season_context:'fall',
  route_order:pos,actual_start_at:date+'T'+(pos===1?'15:':'14:')+'00:00Z',
  production_session_count:1,planned_service_minutes:60,actual_service_minutes:pos===1?75:55,
  service_duration_variance_minutes:pos===1?15:-5,delay_minutes:pos===2?10:0,
  return_visit_required:index===0&&pos===2,workability_effect_count:index===1&&pos===2?1:0
})));
const options={routeEvidence:{item_evidence:rows},jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,confidence:{state:'current'}};
const good=calculate(options);
assert.equal(good.state,'current');
assert.equal(good.summary.observed_route_days,5);
assert.equal(good.summary.complete_sequence_route_days,5);
assert.equal(good.summary.hotspot_route_season_groups,1);
const hot=good.hotspots[0];
assert.equal(hot.season_context,'fall');
assert.equal(hot.route_days,5);
assert.equal(hot.repeated_type_count,3);
const type=k=>hot.friction_types.find(x=>x.type===k);
assert.equal(type('sequence_deviation').affected_route_days,5);
assert.equal(type('sequence_deviation').affected_percent,100);
assert.equal(type('duration_overrun').affected_percent,100);
assert.equal(type('recorded_delay').affected_percent,100);
assert.equal(type('return_visit').affected_route_days,1);
assert.equal(type('return_visit').repeated,false);
assert.equal(good.seasons.find(s=>s.season_context==='winter').route_days,0);
assert.equal(calculate({...options,jobsVisible:false}).state,'permission_hidden');
assert.equal(calculate({...options,sourceQueriesOk:false}).state,'source_unavailable');
assert.equal(calculate({...options,coverageComplete:false}).state,'partial_coverage');
assert.equal(calculate({...options,confidence:{state:'stale'}}).state,'evidence_unreliable');
const missing=rows.map((r,i)=>i===1?{...r,actual_start_at:null}:r);
const few=calculate({...options,routeEvidence:{item_evidence:missing.slice(0,4)}});
assert.equal(few.summary.observed_route_days,2);
assert.equal(few.summary.complete_sequence_route_days,1);
assert.equal(few.summary.sequence_incomplete_route_days,1);
assert.equal(few.hotspots[0]?.friction_types.find(t=>t.type==='sequence_deviation')?.affected_percent??null,null);
const duplicated=calculate({...options,routeEvidence:{item_evidence:[...rows,rows[0]]}});
assert.equal(duplicated.summary.observed_route_days,5);
const none=calculate({...options,routeEvidence:{item_evidence:[]}});
assert.equal(none.state,'insufficient_evidence');
assert.equal(none.hotspots.length,0);
console.log('Build 379 fail-closed route/season hotspot deterministic tests: PASS');
