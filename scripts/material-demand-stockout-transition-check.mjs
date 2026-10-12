import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=(p)=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const a=backend.indexOf('function buildMaterialDemandStockoutSeasonTransition(');
const b=backend.indexOf('\nfunction buildMaterialUsageVarianceReorderCalibration(',a);
assert.ok(a>=0&&b>a,'bounded standalone source');
const block=backend.slice(a,b);
assert.ok(!/\.(insert|upsert|update|delete)\s*\(/.test(block),'no stock or purchase mutation');
const dateShift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const compute=vm.runInNewContext(ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';buildMaterialDemandStockoutSeasonTransition;',{
  ontarioDateKey:value=>String(value||'').slice(0,10),addCalendarDays:dateShift,Date,Map,Set
});
const lines=[{id:'L1',material_id:'M1'}];
const catalog=[{id:'M1',unit_code:'kg',stock_on_hand:3,inventory_tracked:true}];
const rows=[{material_id:'M1',seasonal_bucket:'winter',inventory_tracked:true,stock_on_hand:3,readiness_state:'shortage_within_14_days',unit_mismatch_event_count:0}];
const stockReadiness={source_queries_ok:true,summary:{active_material_count:1},stock_readiness:rows};
const actualUse=[...Array.from({length:5},()=>({material_estimate_line_id:'L1',recorded_at:'2026-10-01T14:00:00Z',actual_unit:'kg'})),
  ...Array.from({length:5},()=>({material_estimate_line_id:'L1',recorded_at:'2026-08-20T14:00:00Z',actual_unit:'kg'})),
  {material_estimate_line_id:'L1',recorded_at:null,actual_unit:'kg'},
  {material_estimate_line_id:'MISSING',recorded_at:'2026-10-03',actual_unit:'kg'}];
const base={today:'2026-10-12',jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,materialPlans:lines,
  materials:catalog,actualUse,stockReadiness};
const result=compute(base);
assert.equal(result.state,'current');
assert.equal(result.periods.recent.actual_events,5);
assert.equal(result.periods.prior.actual_events,5);
assert.equal(result.periods.recent.distinct_materials,1);
assert.equal(result.demand_event_delta,0);
assert.equal(result.unknown_dates,1);
assert.equal(result.unlinked_actual_events,1);
assert.equal(result.current_season,'fall');
assert.equal(result.next_season,'winter');
assert.equal(result.current_snapshot.zero_or_negative_stock_materials,0);
assert.equal(result.current_snapshot.forecast_shortage_materials,1);
assert.equal(result.current_snapshot.upcoming_transition_attention,1);
assert.equal(result.historical_stockout_trend,'unavailable_no_historical_stock_snapshots');
assert.equal(compute({...base,sourceQueriesOk:false}).state,'source_unavailable');
assert.equal(compute({...base,coverageComplete:false}).state,'partial_coverage');
assert.equal(compute({...base,jobsVisible:false}).state,'permission_hidden');
assert.equal(compute({...base,stockReadiness:{...stockReadiness,summary:{active_material_count:2}}}).state,'partial_stock_snapshot');
assert.equal(compute({...base,actualUse:actualUse.slice(1)}).demand_event_delta,null);
const unknown=compute({...base,materials:[{...catalog[0],stock_on_hand:null}]});
assert.equal(unknown.current_snapshot.zero_or_negative_stock_materials,0);
assert.equal(unknown.current_snapshot.forecast_shortage_materials,0);
assert.equal(unknown.current_snapshot.unknown_stock_materials,1);
assert.ok(backend.includes('material_demand_stockout_season_transition:materialDemandStockoutSeasonTransition'));
assert.ok(backend.includes('material_demand_stockout_transition:buildManagementMetricConfidence'));
assert.ok(ui.includes('id="owner385DemandStockout"'));
assert.ok(ui.includes('renderMaterialDemandStockoutTransition()'));
assert.ok(read('help.html').includes('id="material-demand-stockout-season-transition"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging'));
assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run test:material-demand-stockout-transition'));
console.log('Build 385 recorded demand event trend, current stockout truth, season transition and fail-closed coverage PASS');
