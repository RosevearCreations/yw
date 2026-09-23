import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-landscape-material-estimator-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(()=>{
    window.__lme343=[];
    const data={ok:true,
      material_estimator_plans:[{id:'p1',estimator_code:'LME-1',service_context:'landscape_installation',season_context:'spring_summer',plan_status:'planned'}],
      material_estimator_lines:[{id:'l1',material_estimate_id:'p1',estimator_code:'LME-1',material_type:'mulch',material_label:'Mulch',planned_quantity:3.6,planned_unit:'yd3',actual_event_count:1,actual_quantity_planned_unit:3.4,variance_quantity:-0.2,variance_percent:-5.56,season_context:'spring_summer'}],
      material_estimator_actual_use:[],
      material_estimator_materials:[{id:'m1',sku:'MULCH',item_name:'Black mulch',material_category:'mulch'}],
      material_estimator_properties:[{id:'s1',site_name:'Test Property',city:'Tillsonburg'}],
      material_estimator_estimates:[{id:'e1',estimate_number:'EST-1',quote_title:'Front bed'}],
      material_estimator_work_orders:[{id:'w1',work_order_number:'WO-1',status:'scheduled'}]
    };
    window.YWIAPI={
      loadAdminDirectory:async(q)=>{window.__lme343.push({kind:'load',q});return structuredClone(data);},
      manageOperations:async(q)=>{window.__lme343.push({kind:'manage',q});return {ok:true,record:q.action==='landscape_material_estimate_save'?{estimate:{id:'p2'},line:{id:'l2'}}:{event:{id:'a2'}},inventory_mutated:false,job_mutated:false};}
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWILandscapeMaterialEstimatorUI.mount({api:window.YWIAPI}));
}

test('Build 343 renders four-season material estimator and authority boundary',async({page})=>{
  await boot(page);
  const panel=page.locator('#landscapeMaterialEstimator343');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
  await expect(panel).toContainText('Four-season coverage');
  await expect(panel).toContainText('Salt / de-icer');
  await expect(panel).toContainText('Traction material');
  await expect(panel).toContainText('does not move inventory');
  await expect(panel).toContainText('planned 3.60 yd3');
});

test('Build 343 calculates area/depth mulch with conversion and waste',async({page})=>{
  await boot(page);
  await page.selectOption('#lme343Type','mulch');
  await page.fill('#lme343Length','10');
  await page.fill('#lme343Width','5');
  await page.fill('#lme343DepthCm','5');
  await page.selectOption('#lme343Unit','yd3');
  await page.fill('#lme343Waste','10');
  await page.click('#lme343Calculate');
  await expect(page.locator('#lme343Preview')).toContainText('3.597 yd3');
});

test('Build 343 saves plan without inventory or job mutation',async({page})=>{
  await boot(page);
  await page.selectOption('#lme343Property','s1');
  await page.selectOption('#lme343Estimate','e1');
  await page.selectOption('#lme343WorkOrder','w1');
  await page.fill('#lme343Length','10');
  await page.fill('#lme343Width','5');
  await page.fill('#lme343DepthCm','5');
  await page.click('#lme343Save');
  await expect.poll(async()=>page.evaluate(()=>window.__lme343.filter(x=>x.kind==='manage').length)).toBeGreaterThan(0);
  const calls=await page.evaluate(()=>window.__lme343.filter(x=>x.kind==='manage').map(x=>x.q));
  expect(calls.some(x=>x.action==='landscape_material_estimate_save'&&x.material_type==='mulch'&&x.area_m2===50&&Math.abs(x.depth_m-.05)<.000001)).toBeTruthy();
  expect(calls.some(x=>['material_stock_issue','material_stock_receipt','material_stock_adjust','estimate_workflow_save','change_order_save'].includes(x.action))).toBeFalsy();
});

test('Build 343 records actual-use evidence separately from inventory',async({page})=>{
  await boot(page);
  await page.selectOption('#lme343ActualLine','l1');
  await page.fill('#lme343ActualQty','3.4');
  await page.fill('#lme343ActualUnit','yd3');
  await page.fill('#lme343ActualFactor','1');
  await page.fill('#lme343ActualNote','Crew measured remaining material after install.');
  await page.click('#lme343RecordActual');
  await expect.poll(async()=>page.evaluate(()=>window.__lme343.filter(x=>x.kind==='manage').length)).toBeGreaterThan(0);
  const calls=await page.evaluate(()=>window.__lme343.filter(x=>x.kind==='manage').map(x=>x.q));
  expect(calls.some(x=>x.action==='landscape_material_actual_use_save'&&x.material_estimate_line_id==='l1'&&x.actual_quantity===3.4)).toBeTruthy();
  expect(calls.some(x=>['material_stock_issue','material_stock_adjust'].includes(x.action))).toBeFalsy();
});
