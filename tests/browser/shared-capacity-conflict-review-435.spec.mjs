import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const ui=fs.readFileSync('js/shared-capacity-conflict-review-435.js','utf8');

async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(opts=>{
  window.__calls=[];window.__writes=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:'owner'}})};
  const iso=()=>new Date().toISOString();
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},
    limit(){return Promise.resolve({data:[{id:'company',name:'Real owner company',
     owner_user_id:opts.foreign?'another-owner':'owner'}],error:null});},
    insert(){window.__writes.push('insert');},update(){window.__writes.push('update');}};},
   rpc:async(name,args)=>{window.__calls.push(name);
    const first=new Date(args.p_window_start).getTime();
    const start=new Date(first+1*86400000).toISOString(),end=new Date(first+2*86400000).toISOString();
    const d={id:'dispatch',work_order_id:'job',work_order_number:'WO-1',service:'snow_plowing',
     status:'scheduled',start,end,crew_id:'crew',crew_member_ids:['person'],lead_id:'leader',
     supervisor_id:'supervisor',profile_ids:[],truck_id:null,trailer_id:null,equipment_ids:[],assets:[]};
    const entries=opts.overlap?[d,{...d,id:'dispatch-other',work_order_id:'job-other',
     work_order_number:'WO-2',service:'landscape'}]:[d];
    return {data:{company_id:opts.foreignResponse?'foreign':'company',
      window_start:args.p_window_start,window_end:args.p_window_end,
      canonical_source:'original_dispatch_fleet_equipment_material_423_435',retrieved_at:iso(),
      company_scope_only:true,sources_complete:true,cost_posting:false,stock_adjustment:false,
      automatic_reallocation:false,dispatch_authorized:false,dispatch_count:entries.length,
      signout_count:0,material_count:0,dispatches:entries,signouts:[],materials:[]},
      error:opts.denied?{message:'permission denied'}:null};}};
 },opts);
 await page.addScriptTag({content:ui});
 await page.locator('#owner435 summary').click();
 await page.locator('#owner435Refresh').click();
}

test('390px real-company operator screen displays dated cross-service overlap without writes',async({page})=>{
 await setup(page,{overlap:true});
 await expect(page.locator('#owner435Status')).toContainText('HOLD');
 await expect(page.locator('[data-owner435-category="conflict"]')).toContainText('CROSS-SERVICE');
 await expect(page.locator('#owner435Results')).toContainText('No amounts were summed');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>window.__calls)).toEqual(['ywi_companies','ywi_rpc_shared_capacity_review_435']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('no detected conflict still says REVIEW not release or cost approval',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner435Status')).toContainText('REVIEW');
 await expect(page.locator('#owner435Results')).toContainText('Other companies');
 await expect(page.locator('[data-owner435-category="gap"]')).toContainText('None detected');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign company, denied, bad RPC or signed-out session withholds original evidence',async({page})=>{
 for(const opts of [{foreign:true},{foreignResponse:true},{denied:true}]){
  await setup(page,opts);
  await expect(page.locator('#owner435Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-owner435-category="conflict"]')).toHaveCount(0);
 }
 await setup(page,{signedOut:true});
 await expect(page.locator('#owner435Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__calls)).toEqual([]);
});
