import{test,expect}from'@playwright/test';
import{readFileSync}from'node:fs';
import{fixture,people,ownerId,companyId,company2Id,foreignCompanyId,orderId}from'../fixtures/pms-company-job-cost-453.mjs';
const source=readFileSync('js/pms-company-job-cost-453.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1160:390,height:840});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}.pms-finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px;min-width:0}.pms-finance-grid label{display:grid;min-width:0}.pms-finance-grid input,.pms-finance-grid select,.pms-finance-grid textarea{box-sizing:border-box;width:100%;min-width:0}.pms-finance-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:10px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,people,ownerId,companyId,company2Id,first,second})=>{
  window.__options=options;window.__first=first;window.__second=second;window.__writes=[];window.__signedOut=!!options.signedOut;
  window.confirm=()=>!options.cancel;
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> '84530000-0000-4453-8453-000000000020'});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(module,role,access)=>role==='admin'&&
   !(options.noFinance&&module==='finance')&&!(options.noJobs&&module==='jobs')&&
   ['admin','finance','jobs'].includes(module)};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'wrong':ownerId}})},
   from(table){return{select(){return this},order(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?options.noCompany?[]:
     people.map(x=>options.foreignOwner?{...x,owner_user_id:'foreign'}:x):[]));},
    insert(){window.__writes.push('direct-insert')},update(){window.__writes.push('direct-update')},
    delete(){window.__writes.push('direct-delete')}}},
   rpc:async(name,args)=>{
    if(name==='ywi_rpc_pms_job_cost_snapshot_453'){
     if(options.deniedCompany===args.p_company_id)return {data:null,error:{message:'cost permission off'}};
     return ok(args.p_company_id===companyId?window.__first:window.__second);}
    if(name==='ywi_rpc_pms_job_cost_append_453'){window.__writes.push({name,args});return ok('84530000-0000-4453-8453-000000000021');}
    return{data:null,error:{message:'unknown RPC'}};
   }};
 },{options,people,ownerId,companyId,company2Id,first:fixture({now:Date.now()}),
  second:fixture({company:company2Id,now:Date.now()})});
 await page.addScriptTag({content:source});
 await page.locator('#owner453JobCost > summary').click();
 await page.locator('#pms453Refresh').click();
 return page;
}
test('owner-only two-company comparisons redact wages and fit on narrow screens',async({page})=>{
 await setup(page);await expect(page.locator('#pms453Status')).toContainText('VERIFIED OWNERSHIP');
 await expect(page.locator('#pms453Portfolio')).toContainText('Yard Rosevear');
 await expect(page.locator('#pms453Portfolio')).toContainText('Demo East Operations');
 await expect(page.locator('#pms453Portfolio')).toContainText('$550.00');
 await expect(page.locator('[data-pms453-line]')).toHaveCount(2);
 await expect(page.locator('#owner453JobCost a[href="/help.html#pms-company-job-cost-453"]')).toHaveCount(1);
 await expect(page.locator('#owner453JobCost')).not.toContainText('hourly rate');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('new original-order cost allocation is append-only and not a posting',async({page})=>{
 await setup(page);await page.locator('#pms453EntryPanel summary').click();
 await page.locator('#pms453Order').selectOption(orderId);
 await page.locator('#pms453Category').selectOption('material');
 await page.locator('#pms453Amount').fill('12.34');
 await page.locator('#pms453State').selectOption('for_review');
 await page.locator('#pms453Source').fill('original-invoice-reference');
 await page.locator('#pms453Append').click();
 expect(await page.evaluate(()=>window.__writes)).toMatchObject([
  {name:'ywi_rpc_pms_job_cost_append_453',args:{p_company_id:companyId,
   p_work_order_id:orderId,p_category:'material',p_amount_cents:1234,
   p_source_reference:'original-invoice-reference',p_status:'for_review'}}]);
 await expect(page.locator('#pms453Status')).toContainText('NOT posted');
});
test('foreign owner, permission denial and incomplete portfolio fail closed',async({page})=>{
 for(const opt of [{noFinance:true},{noJobs:true},{badSession:true},{signedOut:true},
  {foreignOwner:true},{noCompany:true}]){
  await setup(page,opt);await expect(page.locator('#pms453Status')).not.toContainText('VERIFIED OWNERSHIP');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);}
 await setup(page,{deniedCompany:company2Id});
 await expect(page.locator('#pms453Portfolio')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page);await page.evaluate(id=>{window.__first.lines[0].company_id=id;},foreignCompanyId);
 await page.locator('#pms453Refresh').click();await expect(page.locator('#pms453Status')).toContainText('WITHHELD');
 await setup(page);await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'))});
 await expect(page.locator('[data-pms453-line]')).toHaveCount(0);
});
