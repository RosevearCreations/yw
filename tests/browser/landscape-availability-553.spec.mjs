import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const script=fs.readFileSync('js/landscape-availability-553.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const day='2026-11-20';

async function setup(page,opts={}){
 await page.route('http://yw553.test/**',route=>route.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><main id="settings"></main></body></html>'}));
 await page.setViewportSize({width:opts.width||390,height:850});
 await page.goto('http://yw553.test');
 await page.evaluate(({owner,company,request,day,opts})=>{
  let signedIn=true,areaRows=[],planRows=[];
  window.__writes=[];window.__rpcCalls=[];
  window.__signOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  const requestRows=[{id:request,company_id:opts.badTenant?'44444444-4444-4444-8444-444444444444':company,
   full_name:'Sample Customer',service_area:'Tillsonburg',requested_date:day,
   request_status:'owner_review',created_at:'2026-11-09T14:00:00Z'}];
  function from(table){
   const filters={},pending={table};
   const q={
    select(){return q},
    order(){return q},
    eq(name,value){filters[name]=value;return q},
    limit:async()=>{
     if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',owner_user_id:opts.badOwner?'other':owner}]};
     if(table==='ywi_landscape_booking_requests_552')return {error:null,data:requestRows};
     if(table==='ywi_landscape_service_areas_553')return {error:null,data:areaRows.filter(a=>!filters.area_key||a.area_key===filters.area_key)};
     if(table==='ywi_landscape_capacity_plans_553')return {error:null,data:planRows.filter(p=>!filters.service_date||p.service_date===filters.service_date)};
     throw Error('Unexpected table '+table);
    },
    insert(row){pending.mode='insert';pending.data=row;return {select:async()=>write()}},
    update(row){pending.mode='update';pending.data=row;return {eq(name,value){filters[name]=value;return this},select:async()=>write()}}
   };
   function write(){
    const rows=table==='ywi_landscape_service_areas_553'?areaRows:planRows;
    if(!['ywi_landscape_service_areas_553','ywi_landscape_capacity_plans_553'].includes(table))
     throw Error('Customer request table write is prohibited');
    const index=rows.findIndex(r=>Object.keys(filters).every(k=>r[k]===filters[k]));
    if(pending.mode==='update'&&index<0)throw Error('Attempted update of missing row');
    if(pending.mode==='insert'&&index>=0)throw Error('Unexpected upsert');
    const value=pending.mode==='update'?{...rows[index],...pending.data}:{...pending.data};
    if(pending.mode==='insert')rows.push(value);else rows[index]=value;
    window.__writes.push({table,mode:pending.mode,value});
    return {error:null,data:[value]};
   }
   return q;
  }
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},
   from, rpc:async(name,args)=>{
    window.__rpcCalls.push({name,args});
    if(opts.noRpc)return {error:{message:'Original Dispatch source missing'}};
    return {error:null,data:{
     company_id:opts.badResult?'44444444-4444-4444-8444-444444444444':company,
     request_id:request,coverage_state:'included',capacity_state:'potential_headroom',
     schedule_state:'company_dispatch_verified',weather_state:'unverified',
     availability_state:'review',owner_crew_count:2,declared_crew_minutes:800,
     scheduled_minutes:480,remaining_minutes_advisory:320,
     evaluated_at:'2026-11-09T15:00:00Z',
     review_matches_customer_date:true,
     company_scope_only:true,advisory_only:true,availability_confirmed:false,
     dispatch_authorized:false,no_business_writes:true,
     source:'company_owner_553_plus_original_dispatch_435',
     reasons:['Weather and site safety require a fresh human check before scheduling',
      'No crew, route, equipment, appointment, customer message or payment was committed']
    }};
   }
  };
 },{owner,company,request,day,opts});
 await page.addScriptTag({content:script});
}

for(const width of [390,768,1440]){
 test(`owner coverage + capacity planning and advisory review at ${width}px`,async({page})=>{
  await setup(page,{width});
  await page.locator('#owner553 summary').click();
  await page.locator('#owner553Refresh').click();
  await expect(page.locator('#owner553Status')).toContainText('Verified owner: 1 requests');
  await page.locator('#owner553Area').fill('Tillsonburg');
  await page.locator('#owner553SaveArea').click();
  await expect(page.locator('#owner553Status')).toContainText('coverage rule saved');
  await page.locator('#owner553Refresh').click();
  await expect(page.locator('#owner553Areas')).toContainText('Tillsonburg — included');
  await page.locator('#owner553Request').selectOption(request);
  await page.locator('#owner553CrewCount').fill('2');
  await page.locator('#owner553Minutes').fill('800');
  await page.locator('#owner553SavePlan').click();
  await expect(page.locator('#owner553Status')).toContainText('Crew-minute plan saved');
  await page.locator('#owner553Refresh').click();
  await page.locator('#owner553Request').selectOption(request);
  await expect(page.locator('#owner553Date')).toHaveValue(day);
  await page.locator('#owner553Review').click();
  await expect(page.locator('#owner553Result')).toContainText('REVIEW — advisory, not a reservation');
  await expect(page.locator('#owner553Result')).toContainText('Potential headroom: 320');
  const calls=await page.evaluate(()=>({writes:window.__writes,rpc:window.__rpcCalls}));
  expect(calls.writes.map(x=>x.table)).toEqual([
   'ywi_landscape_service_areas_553','ywi_landscape_capacity_plans_553']);
  expect(calls.rpc).toEqual([{name:'ywi_rpc_landscape_availability_553',
   args:{p_company_id:company,p_request_id:request,p_review_date:day}}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}

test('unverified company owner cannot read or save cross-company planning',async({page})=>{
 await setup(page,{badOwner:true});
 await page.locator('#owner553 summary').click();
 await page.locator('#owner553Refresh').click();
 await expect(page.locator('#owner553Status')).toContainText('WITHHELD');
 await page.locator('#owner553Area').fill('Tillsonburg');
 await page.locator('#owner553SaveArea').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('cross-company request read is withheld',async({page})=>{
 await setup(page,{badTenant:true});
 await page.locator('#owner553 summary').click();
 await page.locator('#owner553Refresh').click();
 await expect(page.locator('#owner553Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner553Request option')).toHaveCount(1);
});
test('missing canonical Dispatch source is withheld, not promoted to available',async({page})=>{
 await setup(page,{noRpc:true});
 await page.locator('#owner553 summary').click();
 await page.locator('#owner553Refresh').click();
 await page.locator('#owner553Request').selectOption(request);
 await page.locator('#owner553Review').click();
 await expect(page.locator('#owner553Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner553Result')).toContainText('No availability was confirmed');
});
test('invalid RPC company scope is denied and sign-out clears private evidence',async({page})=>{
 await setup(page,{badResult:true});
 await page.locator('#owner553 summary').click();
 await page.locator('#owner553Refresh').click();
 await page.locator('#owner553Request').selectOption(request);
 await page.locator('#owner553Review').click();
 await expect(page.locator('#owner553Status')).toContainText('WITHHELD');
 await page.evaluate(()=>window.__signOut());
 await expect(page.locator('#owner553Request option')).toHaveCount(1);
 await expect(page.locator('#owner553Status')).toContainText('Session changed');
});
