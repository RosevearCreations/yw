import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-seasonal-operations-ui.js'),'utf8');
async function boot(page){
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{
   window.__seasonal346=[];
   const data={ok:true,
    seasonal_operations_cycles:[{id:'11111111-1111-4111-8111-111111111111',cycle_code:'SEAS-W26',season_year:2026,season_context:'winter',cycle_name:'Winter Snow Operations 2026–2027',cycle_status:'readiness',operating_priority:'core',start_date:'2026-11-01',end_date:'2027-03-31',checklist_total:9,checklist_ready:4,checklist_blocked:1,readiness_blocked:1,readiness_open:2,rollover_open:1,storm_events_open:1}],
    seasonal_operations_checklist_templates:[],
    seasonal_operations_checklist_items:[{id:'21111111-1111-4111-8111-111111111111',cycle_id:'11111111-1111-4111-8111-111111111111',item_key:'materials_ready',category:'materials',item_label:'Confirm salt, de-icer and traction-material stock',item_status:'blocked',due_date:'2026-10-11',item_note:'Salt below target.'}],
    seasonal_operations_readiness:[],
    seasonal_operations_rollovers:[],
    seasonal_storm_events:[{id:'31111111-1111-4111-8111-111111111111',cycle_id:'11111111-1111-4111-8111-111111111111',storm_code:'STORM-1',storm_name:'Lake-effect watch',storm_status:'ready'}],
    seasonal_storm_routes:[],
    seasonal_operations_outstanding_work:[{cycle_id:'11111111-1111-4111-8111-111111111111',item_type:'checklist',item_id:'21111111-1111-4111-8111-111111111111',category:'materials',status:'blocked',label:'Confirm salt, de-icer and traction-material stock',due_date:'2026-10-11',detail:'Salt below target.'}],
    canonical_recurring_programs:[{id:'41111111-1111-4111-8111-111111111111',agreement_code:'AGR-26',client_name:'Winter Client',service_name:'Snow clearing',agreement_status:'active'}],
    canonical_crew_schedule:[],
    canonical_crews:[{id:'51111111-1111-4111-8111-111111111111',crew_code:'SNOW-1',crew_name:'Snow Crew',crew_status:'active',seasonal_status:'winter'}],
    canonical_preventive_maintenance:[{id:'61111111-1111-4111-8111-111111111111',equipment_item_id:12,equipment_code:'PLW-12',equipment_name:'Plow Truck',due_status:'due_soon',equipment_status:'active'}],
    canonical_material_stock:[{id:'71111111-1111-4111-8111-111111111111',sku:'SALT-BULK',item_name:'Bulk road salt',stock_status:'reorder',stock_on_hand:2,reorder_required:true}],
    canonical_route_planning:[
      {route_id:'81111111-1111-4111-8111-111111111111',route_code:'SNOW-A',route_name:'North Snow',season_context:'winter',storm_event_capable:true,is_active:true},
      {route_id:'91111111-1111-4111-8111-111111111111',route_code:'MOW-A',route_name:'Summer Route',season_context:'spring_summer',storm_event_capable:false,is_active:true}
    ],
    canonical_workability:[{id:'a1111111-1111-4111-8111-111111111111',observation_code:'WK-W26',season_context:'winter',route_name:'North Snow',workability_queue_status:'review'}],
    canonical_routes:[]
   };
   window.YWIAPI={
    loadAdminDirectory:async(q)=>{window.__seasonal346.push({kind:'load',q});return structuredClone(data);},
    manageOperations:async(q)=>{window.__seasonal346.push({kind:'manage',q});return {ok:true,record:{id:q.cycle_id||q.storm_event_id||'11111111-1111-4111-8111-111111111111',cycle_id:q.cycle_id||'11111111-1111-4111-8111-111111111111',season_context:q.season_context||'winter',cycle_status:q.cycle_status||'readiness'},canonical_sources_mutated:false};}
   };
 });
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWISeasonalOperationsUI.mount({api:window.YWIAPI}));
}
test('Build 346 renders winter core operations and canonical authority boundary',async({page})=>{
 await boot(page);
 const panel=page.locator('#seasonalOperations346');
 await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
 await expect(panel).toContainText('Winter is core operations');
 await expect(panel).toContainText('Recurring agreements, workforce, preventive maintenance, materials stock, route planning/dispatch and workability remain authoritative');
 await expect(panel).toContainText('Confirm salt, de-icer and traction-material stock');
});
test('Build 346 winter cycle always saves core priority',async({page})=>{
 await boot(page);
 await page.selectOption('#seasonal346Cycle','11111111-1111-4111-8111-111111111111');
 await page.dispatchEvent('#seasonal346Cycle','change');
 await page.selectOption('#seasonal346Season','winter');
 await page.dispatchEvent('#seasonal346Season','change');
 await expect(page.locator('#seasonal346Priority')).toHaveValue('core');
 await page.click('#seasonal346CycleSave');
 const calls=await page.evaluate(()=>window.__seasonal346.filter(x=>x.kind==='manage').map(x=>x.q));
 const call=calls.find(x=>x.action==='seasonal_cycle_save');
 expect(call).toBeTruthy();
 expect(call.season_context).toBe('winter');
 expect(call.operating_priority).toBe('core');
});
test('Build 346 records material readiness and recurring rollover without canonical mutation actions',async({page})=>{
 await boot(page);
 await page.selectOption('#seasonal346Cycle','11111111-1111-4111-8111-111111111111'); await page.dispatchEvent('#seasonal346Cycle','change');
 await page.selectOption('#seasonal346ReadinessType','material'); await page.dispatchEvent('#seasonal346ReadinessType','change');
 await page.selectOption('#seasonal346ReadinessEntity','71111111-1111-4111-8111-111111111111');
 await page.selectOption('#seasonal346ReadinessStatus','blocked');
 await page.fill('#seasonal346ReadinessNext','Reorder bulk salt.');
 await page.click('#seasonal346ReadinessSave');
 await page.selectOption('#seasonal346RolloverAgreement','41111111-1111-4111-8111-111111111111');
 await page.selectOption('#seasonal346RolloverState','continue');
 await page.click('#seasonal346RolloverSave');
 const calls=await page.evaluate(()=>window.__seasonal346.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='seasonal_readiness_save'&&x.material_id==='71111111-1111-4111-8111-111111111111')).toBeTruthy();
 expect(calls.some(x=>x.action==='seasonal_rollover_save'&&x.rollover_state==='continue')).toBeTruthy();
 expect(calls.some(x=>['material_stock_adjust','recurring_service_program_save'].includes(x.action))).toBeFalsy();
});
test('Build 346 storm activation exposes only canonical storm-capable winter routes',async({page})=>{
 await boot(page);
 await page.selectOption('#seasonal346Cycle','11111111-1111-4111-8111-111111111111'); await page.dispatchEvent('#seasonal346Cycle','change');
 await expect(page.locator('#seasonal346StormRoute option')).toHaveCount(2);
 await expect(page.locator('#seasonal346StormRoute')).toContainText('North Snow');
 await expect(page.locator('#seasonal346StormRoute')).not.toContainText('Summer Route');
 await page.fill('#seasonal346StormName','Lake-effect event');
 await page.selectOption('#seasonal346StormStatus','active');
 await page.click('#seasonal346StormSave');
 await page.selectOption('#seasonal346StormEvent','31111111-1111-4111-8111-111111111111');
 await page.selectOption('#seasonal346StormRoute','81111111-1111-4111-8111-111111111111');
 await page.selectOption('#seasonal346StormRouteStatus','active');
 await page.click('#seasonal346StormRouteSave');
 const calls=await page.evaluate(()=>window.__seasonal346.filter(x=>x.kind==='manage').map(x=>x.q));
 expect(calls.some(x=>x.action==='seasonal_storm_event_save')).toBeTruthy();
 expect(calls.some(x=>x.action==='seasonal_storm_route_activation_save'&&x.route_id==='81111111-1111-4111-8111-111111111111')).toBeTruthy();
});
