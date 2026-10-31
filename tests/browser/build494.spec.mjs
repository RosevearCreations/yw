import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const admin=readFileSync('js/platform-account-audit-490.js','utf8');
const gate=readFileSync('js/ql268-connection-gate-494.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerSetup(page,{foreign=false,defer=false}={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"><h2>Settings</h2></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(({keys,foreign,defer})=>{
  window.__identity='owner';window.__rpcCalls=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const company=[{id:'owned-one',name:'Rosevear Grounds',owner_user_id:'owner'}];
  const modules=keys.map(module_key=>({company_id:'owned-one',module_key,enabled:module_key==='landscape'}));
  const events=[{id:1,company_id:'owned-one',module_key:'landscape',action:'enabled',previous_enabled:false,next_enabled:true,recorded_at:'2026-10-30T12:00:00Z'}];
  const summaries=keys.map(module_key=>({module_key,enabled:module_key==='landscape',
   initialized_events:1,enabled_events:module_key==='landscape'?2:0,disabled_events:0,
   last_action:module_key==='landscape'?'enabled':'initialized',last_event_at:'2026-10-30T12:00:00Z'}));
  if(foreign)summaries[0].module_key='foreign-service';
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
   from(table){return {select(){return this},eq(){return this},order(){return this},
    limit:async()=>({error:null,data:table==='ywi_companies'?company:
     table==='ywi_company_service_modules'?modules:events})};},
   rpc:async(name,args)=>{
    window.__rpcCalls.push({name,args});
    if(defer)return await new Promise(resolve=>{window.__resolveSummary=()=>resolve({data:summaries,error:null});});
    return {data:summaries,error:null};
   }};
 },{keys,foreign,defer});
 await page.addScriptTag({content:owner});
 await page.locator('#owner490Load').click();
 await expect(page.locator('[data-owner490-company]')).toHaveCount(1);
 const details=page.locator('[data-owner494-summary]');await details.locator('summary').click();
 return details;
}

test('owner obtains exact seven-service counts from the owner-scoped RPC and mobile cards remain contained',async({page})=>{
 const details=await ownerSetup(page);
 await details.getByRole('button',{name:'Load exact audit summary'}).click();
 await expect(details).toContainText('9 total audit events across 7 services');
 await expect(details.locator('tbody tr')).toHaveCount(7);
 expect(await page.evaluate(()=>window.__rpcCalls)).toEqual([{
  name:'ywi_company_service_audit_summary_494',args:{p_company_id:'owned-one'}}]);
 await expect(page.locator('#owner494Metrics')).toContainText('1 / 7');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('foreign summary data is withheld; logout invalidates a pending exact-count response',async({page})=>{
 let details=await ownerSetup(page,{foreign:true});
 await details.getByRole('button',{name:'Load exact audit summary'}).click();
 await expect(details).toContainText('WITHHELD');
 await expect(details.locator('tbody tr')).toHaveCount(0);
 details=await ownerSetup(page,{defer:true});
 await details.getByRole('button',{name:'Load exact audit summary'}).click({noWaitAfter:true});
 await page.waitForFunction(()=>typeof window.__resolveSummary==='function');
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));window.__resolveSummary();});
 await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
 await expect(page.locator('#owner494Metrics')).toBeEmpty();
});

test('curated admin reconciles present/missing legacy ticket references without role writes',async({page})=>{
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  window.__writes=[];const uid='primary';
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:uid}})};
  const row=(id,name,primary)=>({profile_id:id,account_name:name,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},
   rpc:async name=>{window.__writes.push(name);return {error:null,data:name==='ywi_platform_account_audit_490'?
    [row('primary','Primary',true),row('legacy-a','Legacy A',false),row('legacy-b','Legacy B',false)]:
    [{entry_id:1,profile_id:'legacy-a',evidence_reference:'QL-268-OWNER-01',evidence_state:'UNVERIFIED_REFERENCE',recorded_at:'2026-10-30T12:00:00Z'}]};}};
 });
 await page.addScriptTag({content:admin});
 await page.locator('#platform490 > summary').click();await page.locator('#platform490Refresh').click();
 await expect(page.locator('#platform494Metrics')).toContainText('2');
 await expect(page.locator('[data-platform490-role]')).toHaveCount(3);
 await page.locator('#platform494ReviewFilter').selectOption('missing');
 await expect(page.locator('[data-platform490-role]:visible')).toHaveCount(1);
 await expect(page.locator('[data-platform490-role]:visible')).toContainText('NO REFERENCE');
 await page.locator('#platform494ReviewFilter').selectOption('recorded');
 await expect(page.locator('[data-platform490-role]:visible')).toHaveCount(1);
 await expect(page.locator('[data-platform490-role]:visible')).toContainText('UNVERIFIED ONLY');
 expect(await page.evaluate(()=>window.__writes)).toEqual([
  'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493']);
});

async function gateSetup(page,{enabled=false}={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(({enabled})=>{
  window.__calls=[];window.fetch=async(path,opts)=>{
   window.__calls.push({path,opts});
   const common={app_id:'yard-workers',contract_version:'1',connection_status:'HOLD',events_enabled:false,commands_enabled:false};
   return {ok:true,json:async()=>path.endsWith('/health')?
    {...common,authenticated:false}:
    {...common,owner_approval_required:true,tenant_scope:'required_before_connection',
     service_module_scope:'required_before_connection',capabilities:[{name:'read_client',enabled}]}};
  };
 },{enabled});
 await page.addScriptTag({content:gate});await page.locator('#ql268Gate494 > summary').click();
 await page.locator('#ql268Read494').click();
}

test('QL-268 technical readback uses only anonymous public GETs and leaves all four proof gates under review',async({page})=>{
 await gateSetup(page);
 await expect(page.locator('#ql268Status494')).toContainText('UNDER REVIEW');
 await expect(page.locator('#ql268Gates494 [data-gate-state="review"]')).toHaveCount(4);
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.map(x=>x.path)).toEqual(['/api/integration/v1/health','/api/integration/v1/capabilities']);
 expect(calls.every(x=>x.opts.method==='GET'&&x.opts.credentials==='omit'&&x.opts.redirect==='error')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('any enabled gateway capability forces a review exception and no authorization',async({page})=>{
 await gateSetup(page,{enabled:true});
 await expect(page.locator('#ql268Status494')).toContainText('REVIEW EXCEPTION');
 await expect(page.locator('#ql268Status494')).toContainText('No trial authorized');
});
