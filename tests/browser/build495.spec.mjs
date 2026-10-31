import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const admin=readFileSync('js/platform-account-audit-490.js','utf8');
const gate=readFileSync('js/ql268-connection-gate-494.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerSetup(page){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(keys=>{
  window.__identity='owner';window.__auditQueries=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const company=[{id:'owned-one',name:'Rosevear Grounds',owner_user_id:'owner'}];
  const modules=keys.map(module_key=>({company_id:'owned-one',module_key,enabled:module_key==='landscape'}));
  const events=[
   {id:2,company_id:'owned-one',module_key:'landscape',action:'disabled',previous_enabled:true,next_enabled:false,recorded_at:'2026-10-30T12:00:00Z'},
   {id:1,company_id:'owned-one',module_key:'landscape',action:'enabled',previous_enabled:false,next_enabled:true,recorded_at:'2026-10-29T12:00:00Z'}];
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
   from(table){const constraints=[];return {select(){return this},eq(key,value){constraints.push([key,value]);return this},gte(key,value){constraints.push([key,'gte:'+value]);return this},order(){return this},
    async limit(){window.__auditQueries.push({table,constraints});
     const result=table==='ywi_companies'?company:table==='ywi_company_service_modules'?modules:events.filter(event=>constraints.every(([key,value])=>value.startsWith('gte:')?event[key]>=value.slice(4):event[key]===value));
     return {error:null,data:result};}};}
  };
 },keys);
 await page.addScriptTag({content:owner});
 await page.locator('#owner490Load').click();
 await expect(page.locator('[data-owner490-company]')).toHaveCount(1);
 await page.locator('[data-owner492-timeline] > summary').click();
}

test('owner presets run company-scoped audit filters and custom preset remains session-local',async({page})=>{
 await ownerSetup(page);
 await page.locator('[data-owner495-preset="enabled"]').click();
 await expect(page.locator('[data-owner492-timeline] [role="status"]').last()).toContainText('1 matching audited event');
 let queries=await page.evaluate(()=>window.__auditQueries);
 expect(queries.at(-1)).toEqual({table:'ywi_company_service_module_audit',
  constraints:[['company_id','owned-one'],['action','enabled']]});
 await page.locator('select[aria-label="Filter service audit by service"]').selectOption('landscape');
 await page.locator('[data-owner495-preset="save"]').click();
 await expect(page.locator('[data-owner495-preset="restore"]')).toBeEnabled();
 await page.locator('[data-owner495-preset="disabled"]').click();
 await page.locator('[data-owner495-preset="restore"]').click();
 await expect(page.locator('select[aria-label="Filter service audit by action"]')).toHaveValue('enabled');
 await expect(page.locator('select[aria-label="Filter service audit by service"]')).toHaveValue('landscape');
 queries=await page.evaluate(()=>window.__auditQueries);
 expect(queries.at(-1).constraints).toEqual([['company_id','owned-one'],['module_key','landscape'],['action','enabled']]);
 await expect(page.locator('[data-owner495-preset="save"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('owner logout discards presets and any server audit response from the old session',async({page})=>{
 await ownerSetup(page);
 await page.locator('[data-owner495-preset="save"]').click();
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-owner495-preset]')).toHaveCount(0);
 await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
});

test('curated administrator prepares a reference-only decision handoff with zero role writes',async({page})=>{
 await page.setContent('<section id="admin"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{
  window.__identity='primary';window.__calls=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const row=(id,primary)=>({profile_id:id,account_name:id,account_email:id+'@example.invalid',
   global_role:'admin',curated_platform_admin:primary,owned_company_count:0,active:true,
   staff_tier:'admin',profile_email_matches_auth:true});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},rpc:async name=>{
   window.__calls.push(name);return {error:null,data:name==='ywi_platform_account_audit_490'?
    [row('primary',true),row('legacy-a',false)]:
    [{entry_id:1,profile_id:'legacy-a',evidence_reference:'QL-269-REVIEW-001',
      evidence_state:'UNVERIFIED_REFERENCE',recorded_at:'2026-10-30T12:00:00Z'}]};}};
 });
 await page.addScriptTag({content:admin});
 await page.locator('#platform490 > summary').click();await page.locator('#platform490Refresh').click();
 const handoff=page.locator('[data-platform495-handoff="legacy-a"]');
 await handoff.locator('summary').click();
 await handoff.locator('select').selectOption('RESTRICT_SCOPE');
 await handoff.getByRole('button',{name:'Prepare read-only handoff'}).click();
 const text=await handoff.locator('textarea').inputValue();
 expect(text).toContain('QL-269-REVIEW-001 (UNVERIFIED_REFERENCE)');
 expect(text).toContain('Requested review question: RESTRICT_SCOPE');
 expect(text).toContain('Owner decision: NOT RECEIVED');
 expect(text).toContain('No privileged role changes');
 expect(await page.evaluate(()=>window.__calls)).toEqual(['ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493']);
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-platform495-handoff]')).toHaveCount(0);
});

test('QL-269 is paused for review; safety readback is manual and never authenticates',async({page})=>{
 await page.setContent('<section id="settings"></section>');await page.addStyleTag({content:css});
 await page.evaluate(()=>{window.__calls=[];window.fetch=async(path,options)=>{
  window.__calls.push({path,options});const common={app_id:'yard-workers',contract_version:'1',connection_status:'HOLD',events_enabled:false,commands_enabled:false};
  return {ok:true,json:async()=>path.endsWith('/health')?{...common,authenticated:false}:{...common,
   owner_approval_required:true,tenant_scope:'required_before_connection',service_module_scope:'required_before_connection',
   capabilities:[{name:'read_client',enabled:false}]}};};});
 await page.addScriptTag({content:gate});
 await expect(page.locator('#ql268Gate494')).toContainText('Under Review');
 await expect(page.locator('#ql268Gate494')).toContainText('PAUSED');
 expect(await page.evaluate(()=>window.__calls.length)).toBe(0);
 await page.locator('#ql268Gate494 > summary').click();await page.locator('#ql268Read494').click();
 await expect(page.locator('#ql268Status494')).toContainText('QL-269 UNDER REVIEW');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.map(x=>x.path)).toEqual(['/api/integration/v1/health','/api/integration/v1/capabilities']);
 expect(calls.every(x=>x.options.method==='GET'&&x.options.credentials==='omit'&&x.options.redirect==='error')).toBe(true);
 await expect(page.locator('#ql268Gates494 [data-gate-state="review"]')).toHaveCount(4);
 expect((await page.locator('#ql268Gate494').innerText()).includes('HELD')).toBe(false);
});
