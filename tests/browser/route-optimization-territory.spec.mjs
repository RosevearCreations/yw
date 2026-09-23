import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-route-optimization-ui.js'),'utf8');
async function boot(page){
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{
  window.__route341=[];
  const data={ok:true,
   route_territories:[{id:'t1',territory_name:'Tillsonburg North',season_context:'four_season',service_area_name:'Tillsonburg',owner_crew_name:'Crew A',site_count:2,route_count:1}],
   route_territory_sites:[],
   route_planning:[{route_id:'r1',route_name:'North Route',season_context:'winter',storm_event_capable:true,daily_capacity_minutes:480,service_priority:'high'}],
   route_optimization_runs:[{id:'o1',route_name:'North Route',service_date:'2026-12-01',season_context:'winter',run_status:'generated',storm_event_active:true,proposed_stop_count:2,capacity_status:'within_capacity',proposed_service_minutes:180,proposed_travel_minutes:30,dispatch_application_status:'advisory_only_operator_dispatch_required'}],
   route_optimization_stops:[{run_id:'o1',proposed_order:1,current_order:2,site_name:'Snow Property A',service_priority:'critical',estimated_service_minutes:90,proximity_travel_minutes_estimate:12,data_quality:'complete'},{run_id:'o1',proposed_order:2,current_order:1,site_name:'Snow Property B',service_priority:'high',estimated_service_minutes:90,proximity_travel_minutes_estimate:18,data_quality:'complete'}],
   service_areas:[{id:'a1',name:'Tillsonburg'}],route_properties:[{id:'s1',site_name:'Snow Property A',city:'Tillsonburg'}],route_crews:[{id:'c1',crew_name:'Crew A'}],route_profiles:[]};
  window.YWIAPI={loadAdminDirectory:async(q)=>{window.__route341.push({kind:'load',q});return structuredClone(data);},manageOperations:async(q)=>{window.__route341.push({kind:'manage',q});return {ok:true,record:{id:q.action==='route_optimization_generate'?'o2':(q.id||'x1'),...q}};}};
 });
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIRouteOptimizationUI.mount({api:window.YWIAPI}));
}
test('Build 341 renders four-season advisory routing',async({page})=>{
 await boot(page); const panel=page.locator('#routeOptimization341');
 await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
 await expect(panel).toContainText('Four-season Ontario routing');
 await expect(panel).toContainText('winter snow clearing/removal');
 await expect(panel).toContainText('Dispatch boundary');
 await expect(panel).toContainText('Snow Property A');
 await expect(panel).toContainText('advisory_only_operator_dispatch_required');
});
test('Build 341 generates explicit winter storm proposal',async({page})=>{
 await boot(page);
 await page.selectOption('#route341Route','r1'); await page.fill('#route341Date','2026-12-01'); await page.selectOption('#route341Season','winter'); await page.selectOption('#route341Goal','storm_priority');
 await page.check('#route341Storm'); await page.fill('#route341StormKey','2026-12-01-A'); await page.click('#route341Generate');
 await expect.poll(async()=>page.evaluate(()=>window.__route341.filter(x=>x.kind==='manage').length)).toBeGreaterThan(0);
 const calls=await page.evaluate(()=>window.__route341.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='route_optimization_generate'&&x.storm_event_active===true&&x.season_context==='winter'&&x.storm_event_key==='2026-12-01-A')).toBeTruthy();
});
test('Build 341 accept records decision without dispatch action',async({page})=>{
 await boot(page); await page.click('#route341Accept');
 await expect.poll(async()=>page.evaluate(()=>window.__route341.filter(x=>x.kind==='manage').length)).toBeGreaterThan(0);
 const calls=await page.evaluate(()=>window.__route341.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='route_optimization_decision'&&x.run_status==='accepted')).toBeTruthy();
 expect(calls.some(x=>/dispatch_schedule|schedule|route_stop/i.test(x.action||''))).toBeFalsy();
});