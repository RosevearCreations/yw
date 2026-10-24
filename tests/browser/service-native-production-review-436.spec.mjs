import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const script=readFileSync('js/service-native-production-review-436.js','utf8');

async function setup(page,options={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(opts=>{
  window.__calls=[];window.__writes=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:'owner'}})};
  const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
  const company={id:'company-1',name:'Original family company',owner_user_id:opts.foreign?'foreign':'owner'};
  const offerings=keys.map(k=>({company_id:opts.foreignOffering?'foreign':'company-1',module_key:k,enabled:k!=='septic'}));
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:opts.badSession?'foreign':'owner'}}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve({data:table==='ywi_companies'?[company]:offerings,error:null});},
    insert(){window.__writes.push('insert');},update(){window.__writes.push('update');},
    delete(){window.__writes.push('delete');}};},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    const key=name.endsWith('_427')?'snow_plowing':name.endsWith('_428')?'septic':
     name.endsWith('_426')?'water_parks':name.endsWith('_425')?'construction':'landscape';
    const order={id:'job-1',number:'WO-1',status:'in_progress',...(key.startsWith('snow_')?{service:key}:{})};
    const base={company_id:opts.foreignResponse?'foreign':'company-1',
     work_order_id:args.p_work_order_id,complete:true,source_limit:80,
     state:args.p_work_order_id?'review_only':'choose_order',orders:[order]};
    if(!args.p_work_order_id)return {data:{...base},error:opts.denied?{message:'denied'}:null};
    const source={id:'qty-1',eligible:true,actual_quantity:22,unit_label:'square_metres',metric_label:'Mowing area'};
    const detail=key==='landscape'?{sources:[source],receipts:opts.missingReceipt?[]:[{
     id:'field-1',production_quantity_id:'qty-1',state:'recorded_unreviewed'}]}:
     key==='snow_plowing'?{sources:[{dispatch_id:'dispatch-1',activation_id:'activation-1'}],
      receipts:[{id:'storm-1',dispatch_id:'dispatch-1',service_module_key:opts.wrongSnow?'snow_removal':'snow_plowing',
       evidence_state:'reported_unverified',source_gate:'independent_dispatch_safety_review_required'}],
      workability:[{id:'workability-1'}],safety:[{id:'safety-1'}],fleet:[{id:'fleet-1'}]}:
     {sources:[],receipts:[],dispatch:[],artifacts:[],fleet:[],safety:[],
      phases:[],permits:[],changes:[],lines:[],release:null,inspections:[],followups:[],workability:[]};
    return {data:{...base,...detail},error:opts.denied?{message:'denied'}:null};
   }};
 },options);
 await page.addScriptTag({content:script});
 await page.locator('#owner436 summary').click();
 await page.locator('#owner436Refresh').click();
}

async function chooseService(page,service){
 await page.locator('#owner436Service').selectOption(service);
 await page.locator('#owner436Refresh').click();
}

test('390px owner review uses actual 424 originals and remains REVIEW without writes',async({page})=>{
 await setup(page);await chooseService(page,'landscape');
 await expect(page.locator('#owner436Status')).toContainText('REVIEW');
 await expect(page.locator('#owner436Results')).toContainText('Measured Production quantities: 1');
 await expect(page.locator('#owner436Results')).toContainText('Independent Jobs, QC, Safety');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>window.__calls)).toEqual([
  'ywi_companies','ywi_company_service_modules','ywi_companies','ywi_company_service_modules',
  'ywi_rpc_landscape_field_dashboard_424','ywi_rpc_landscape_field_dashboard_424']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('missing original 424 field receipt remains HOLD, not completed',async({page})=>{
 await setup(page,{missingReceipt:true});await chooseService(page,'landscape');
 await expect(page.locator('#owner436Status')).toContainText('HOLD');
 await expect(page.locator('[data-owner436-group="holds"]')).toContainText('no 424 field attestation receipt');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

test('snow receipt cannot be silently borrowed from another offering',async({page})=>{
 await setup(page,{wrongSnow:true});await chooseService(page,'snow_plowing');
 await expect(page.locator('#owner436Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner436Results')).toBeEmpty();
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.startsWith('ywi_rpc_')))).toEqual([
  'ywi_rpc_snow_service_dashboard_427','ywi_rpc_snow_service_dashboard_427']);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

test('denied, foreign and signed-out owner cannot see original evidence',async({page})=>{
 for(const options of [{foreign:true},{foreignOffering:true},{foreignResponse:true},{denied:true},{badSession:true},{signedOut:true}]){
  await setup(page,options);
  if(!options.signedOut&&!options.foreign&&!options.badSession&&!options.foreignOffering)
   await chooseService(page,'landscape');
  await expect(page.locator('#owner436Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});

test('auth change clears old review evidence and requires a new identity check',async({page})=>{
 await setup(page);await chooseService(page,'landscape');
 await expect(page.locator('#owner436Results')).toContainText('Measured Production quantities');
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:auth-changed')));
 await expect(page.locator('#owner436Status')).toContainText('session changed');
 await expect(page.locator('#owner436Results')).toBeEmpty();
});
