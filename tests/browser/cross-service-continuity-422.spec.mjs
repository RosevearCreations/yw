import{test,expect}from'@playwright/test';
import fs from'node:fs';
const source=fs.readFileSync('js/cross-service-continuity-422.js','utf8');
const ids={customer:'a65a17a7-6ff1-48b2-88a0-bb6813567281',site:'879974a7-ecb4-4894-a921-4856449f3243',draft:'13f3705f-40f9-4b74-ad83-f43cb43a9b4e'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({opts,ids})=>{
  const user='owner',company='company-1';window.__calls=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:user}})};
  let data=opts.empty?[]:[{id:ids.customer,name:'Original customer',is_active:true}];
  const proof=()=>({company_id:company,client_id:ids.customer,customer_name:'Original customer',
   properties:[{id:ids.site,name:'First property',address:'19 Example Road'}],
   estimates:[{id:'estimate-1',number:'EST-1',service:'landscape',property_id:ids.site,status:'draft',created_at:'2026-10-21T01:00:00Z'}],
   work_orders:[{id:'work-1',number:'WO-1',service:'snow_removal',property_id:ids.site,status:'draft',created_at:'2026-10-21T02:00:00Z'}],
   legacy_unscoped_excluded:true,history_limit_per_type:80});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:user}}})},
   from(table){return {select(){return this},order(){return this},limit(){
    if(table==='ywi_companies')return Promise.resolve({data:[{id:company,name:'Yard Workers',owner_user_id:opts.foreign?'other':user}],error:null});
    return Promise.resolve({data:[],error:null});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_company_customers_422')return {data,error:null};
    if(name==='ywi_rpc_customer_history_422')return {data:opts.mismatch?{...proof(),company_id:'other'}:proof(),error:null};
    if(name==='ywi_rpc_create_customer_422'){data.push({id:ids.customer,name:args.p_legal_name,is_active:true});return{data:ids.customer,error:null};}
    if(name==='ywi_rpc_create_property_422')return {data:ids.site,error:null};
    if(name==='ywi_rpc_attach_draft_customer_422')return {data:args.p_target_id,error:null};
    return {data:null,error:{message:'Unknown RPC'}};
   }};
 },{opts,ids});
 await page.addScriptTag({content:source});await page.locator('#owner422 summary').click();
 await page.locator('#owner422Refresh').click();
}
test('one customer shows multiple services with no automatic legacy claim, mobile safe',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner422Status')).toContainText('verified canonical customers loaded');
 await page.locator('#owner422Customer').selectOption(ids.customer);
 await expect(page.locator('#owner422Results')).toContainText('Landscaping');
 await expect(page.locator('#owner422Results')).toContainText('Snow removal');
 await expect(page.locator('#owner422Results')).toContainText('First property');
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name.includes('create_')||x.name.includes('attach_')))).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('new canonical customer RPC and reviewed draft attachment are explicit',async({page})=>{
 await setup(page,{empty:true});
 await page.locator('#owner422Name').fill('Miller residence');
 page.once('dialog',d=>d.accept());
 await page.locator('#owner422CreateCustomer').click();
 await expect(page.locator('#owner422Status')).toContainText('New canonical customer');
 await page.locator('#owner422Customer').selectOption(ids.customer);
 await page.locator('#owner422Property').selectOption(ids.site);
 await page.locator('#owner422Draft').fill(ids.draft);
 page.once('dialog',d=>d.accept());
 await page.locator('#owner422Attach').click();
 await expect(page.locator('#owner422Status')).toContainText('attached');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.find(x=>x.name==='ywi_rpc_create_customer_422')?.args).toMatchObject({p_company_id:'company-1',p_legal_name:'Miller residence'});
 expect(calls.find(x=>x.name==='ywi_rpc_attach_draft_customer_422')?.args).toEqual({
  p_company_id:'company-1',p_kind:'estimate',p_target_id:ids.draft,p_client_id:ids.customer,p_site_id:ids.site});
});
test('foreign company and signed-out owner withhold all history',async({page})=>{
 await setup(page,{foreign:true});
 await expect(page.locator('#owner422Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner422Customer option')).toHaveCount(0);
});
test('server tenant mismatch withholds cross-service details',async({page})=>{
 await setup(page,{mismatch:true});
 await page.locator('#owner422Customer').selectOption(ids.customer);
 await expect(page.locator('#owner422Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner422-service]')).toHaveCount(0);
});
