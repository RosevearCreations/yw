import{test,expect}from'@playwright/test';
import{readFileSync}from'node:fs';
import{fixture,company,ownerId,companyId,foreignCompanyId,orderConcreteId,
 orderFibreId,projectConcreteId,projectFibreId}from'../fixtures/pms-construction-specialists-452.mjs';
const source=readFileSync('js/pms-construction-specialists-452.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1160:390,height:840});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}.pms452-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;min-width:0}.pms452-grid label{display:grid;min-width:0}.pms452-grid input,.pms452-grid select,.pms452-grid textarea{box-sizing:border-box;min-width:0;width:100%}.pms452-tabs{display:flex;flex-wrap:wrap;gap:8px}.pms452-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,company,ownerId,fixture})=>{
  window.__options=options;window.__source=fixture;window.__writes=[];window.__calls=[];
  window.__signedOut=!!options.signedOut;window.confirm=()=>!options.cancel;
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> '84520000-0000-4452-8452-000000000050'});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(module,role,access)=>!options.noJobs&&role==='admin'&&
   (module==='admin'||module==='jobs')&&!(options.noJobsCreate&&module==='jobs'&&access==='create')};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'unknown':ownerId}})},
   from(table){window.__calls.push(table);return{select(){return this},order(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?options.noCompany?[]:
     [{...company,owner_user_id:options.foreignOwner?'another-owner':ownerId}]:[]));},
    insert(){window.__writes.push('direct-insert')},update(){window.__writes.push('direct-update')},
    upsert(){window.__writes.push('direct-upsert')},delete(){window.__writes.push('direct-delete')}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(options.denied&&name==='ywi_rpc_pms_construction_snapshot_452')return {data:null,error:{message:'owner denied'}};
    if(name==='ywi_rpc_pms_construction_snapshot_452')return ok(window.__source);
    if(name.startsWith('ywi_rpc_pms_construction_')&&name.endsWith('_452')){
     window.__writes.push({name,args});return ok('84520000-0000-4452-8452-000000000050');}
    return{data:null,error:{message:'unknown RPC '+name}};
   }};
 },{options,company,ownerId,fixture:fixture({now:Date.now(),enabled:!options.moduleOff})});
 await page.addScriptTag({content:source});
 await page.locator('#owner452Construction > summary').click();
 await page.locator('#pms452Refresh').click();
 return page;
}
test('four distinct workspaces plus clearance and ditch variants render at mobile width',async({page})=>{
 await setup(page);await expect(page.locator('#pms452Status')).toContainText('Construction ON');
 await expect(page.locator('#pms452Status')).toContainText('concrete');
 await expect(page.locator('[data-pms452-project]')).toHaveCount(1);
 await expect(page.locator('[data-pms452-evidence]')).toHaveCount(1);
 await page.locator('#pms452Tabfibre_line').click();
 await expect(page.locator('#pms452History')).toContainText('West fibre trench');
 await expect(page.locator('#pms452History')).toContainText('utility_locate');
 for(const key of ['light_construction','excavation','land_clearance','ditch_digging']){
  await page.locator('#pms452Tab'+key).click();
  await expect(page.locator('#pms452Status')).toContainText(key.replaceAll('_',' '));
 }
 await expect(page.locator('#owner452Construction a[href="/help.html#pms-construction-452"]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('project creation uses original company Jobs work order and canonical client/property',async({page})=>{
 await setup(page);await page.locator('#pms452ProjectPanel summary').click();
 await page.locator('#pms452Order').selectOption(orderConcreteId);
 await page.locator('#pms452Specialty').selectOption('concrete');
 await page.locator('#pms452Label').fill('North foundation');
 await page.locator('#pms452Scope').fill('Foundation phase site scope, planning evidence');
 await page.locator('#pms452Hazard').fill('original-hazard-document');
 await page.locator('#pms452Source').fill('original-Jobs-line');
 await page.locator('#pms452Add').click();
 await expect(page.locator('#pms452Status')).toContainText('Construction source recorded');
 expect(await page.evaluate(()=>window.__writes)).toMatchObject([
  {name:'ywi_rpc_pms_construction_project_452',args:{p_company_id:companyId,p_order_id:orderConcreteId,
   p_specialty:'concrete',p_label:'North foundation'}}]);
});
test('specialty evidence records quantities and stays operator-reported only',async({page})=>{
 await setup(page);await page.locator('#pms452EvidencePanel summary').click();
 await page.locator('#pms452Project').selectOption(projectConcreteId);
 await page.locator('#pms452Date').fill('2026-10-20');
 await page.locator('#pms452Activity').selectOption('pour');
 await page.locator('#pms452Quantity').fill('2.5');
 await page.locator('#pms452Unit').selectOption('m3');
 await page.locator('#pms452State').selectOption('operator_reported');
 await page.locator('#pms452EvidenceSource').fill('pour-docket-reference');
 await page.locator('#pms452Append').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms452Refresh').click();
 await page.locator('#pms452Safety').fill('original-site-Safety-reference');
 await page.locator('#pms452Append').click();
 await expect(page.locator('#pms452Status')).toContainText('independent approval');
 expect(await page.evaluate(()=>window.__writes)).toMatchObject([
  {name:'ywi_rpc_pms_construction_evidence_452',args:{p_project_id:projectConcreteId,p_activity:'pour',
   p_quantity:2.5,p_unit:'m3',p_safety_source:'original-site-Safety-reference'}}]);
});
test('fibre/excavation field evidence requires both Safety and locate sources',async({page})=>{
 await setup(page);await page.locator('#pms452Tabfibre_line').click();
 await page.locator('#pms452EvidencePanel summary').click();
 await page.locator('#pms452Project').selectOption(projectFibreId);
 await page.locator('#pms452Date').fill('2026-10-20');
 await page.locator('#pms452Activity').selectOption('trench');
 await page.locator('#pms452State').selectOption('operator_reported');
 await page.locator('#pms452EvidenceSource').fill('reported-trench-reference');
 await page.locator('#pms452Safety').fill('original-site-safety');
 await page.locator('#pms452Append').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms452Refresh').click();
 await page.locator('#pms452FieldUtility').fill('original-one-call-locate');
 await page.locator('#pms452Append').click();
 expect(await page.evaluate(()=>window.__writes)).toMatchObject([
  {name:'ywi_rpc_pms_construction_evidence_452',args:{p_project_id:projectFibreId,
   p_activity:'trench',p_safety_source:'original-site-safety',p_utility_source:'original-one-call-locate'}}]);
});
test('OFF module retains owned source history but cannot create',async({page})=>{
 await setup(page,{moduleOff:true});
 await expect(page.locator('#pms452Status')).toContainText('OFF');
 await expect(page.locator('[data-pms452-project]')).toHaveCount(1);
 await page.locator('#pms452ProjectPanel summary').click();await page.locator('#pms452Add').click();
 await page.locator('#pms452EvidencePanel summary').click();await page.locator('#pms452Append').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign owner, stale/foreign sources, denied rights and logout fail closed',async({page})=>{
 for(const opt of [{foreignOwner:true},{noCompany:true},{badSession:true},{denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,opt);
  await expect(page.locator('#pms452Status')).not.toContainText('Construction ON');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page);await page.evaluate(id=>{window.__source.projects[0].company_id=id;},foreignCompanyId);
 await page.locator('#pms452Refresh').click();await expect(page.locator('#pms452Status')).toContainText('WITHHELD');
 await setup(page,{noJobsCreate:true});await page.locator('#pms452ProjectPanel summary').click();
 await page.locator('#pms452Add').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page);await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'))});
 await expect(page.locator('[data-pms452-project]')).toHaveCount(0);
});
