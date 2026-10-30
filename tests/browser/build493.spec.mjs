import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ownerUI=readFileSync('js/company-owner-workspace-490.js','utf8');
const adminUI=readFileSync('js/platform-account-audit-490.js','utf8');
const gateUI=readFileSync('js/ql267-connection-exceptions-493.js','utf8');

async function ownerSetup(page,{foreignAudit=false}={}){
 await page.setContent('<section id="settings"><h2>Settings</h2><details id="owner420"><button id="owner420Refresh">Refresh</button></details></section>');
 await page.evaluate(({foreignAudit})=>{
  const uid='company-owner';window.__auditRequests=[];window.__identity=uid;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];
  const company=[{id:'company-one',name:'Rosevear Landscaping',owner_user_id:uid}];
  const modules=keys.map(module_key=>({company_id:'company-one',module_key,enabled:false}));
  const events=[
   {id:1,company_id:'company-one',module_key:'landscape',action:'initialized',previous_enabled:null,next_enabled:false,recorded_at:'2026-10-21T00:00:00Z'},
   {id:2,company_id:'company-one',module_key:'snow_plowing',action:'enabled',previous_enabled:false,next_enabled:true,recorded_at:'2026-10-27T00:00:00Z'},
   {id:3,company_id:'company-one',module_key:'snow_plowing',action:'disabled',previous_enabled:true,next_enabled:false,recorded_at:'2026-10-28T00:00:00Z'}
  ];
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:uid}}})},
   from(table){const filters={};return {
    select(){return this},eq(k,v){filters[k]=v;return this},
    gte(k,v){filters['gte_'+k]=v;return this},order(){return this},
    async limit(n){
     if(table==='ywi_companies')return {data:company,error:null};
     if(table==='ywi_company_service_modules')return {data:modules,error:null};
     window.__auditRequests.push({...filters,limit:n});
     let data=events.filter(x=>x.company_id===filters.company_id);
     if(filters.module_key)data=data.filter(x=>x.module_key===filters.module_key);
     if(filters.action)data=data.filter(x=>x.action===filters.action);
     if(filters.gte_recorded_at)data=data.filter(x=>x.recorded_at>=filters.gte_recorded_at);
     if(foreignAudit&&filters.module_key)data=[...data,{...events[0],company_id:'company-two'}];
     return {data,error:null};
    }
   };}
  };
 },{foreignAudit});
 await page.addScriptTag({content:ownerUI});
 await page.locator('#owner490Load').click();
}

test('initial event with null previous state is valid and filters execute on the tenant query',async({page})=>{
 await ownerSetup(page);
 const timeline=page.locator('[data-owner492-timeline]');
 await expect(timeline).toHaveCount(1);
 await expect(timeline).toContainText('INITIAL → OFF');
 await timeline.locator('summary').click();
 await timeline.locator('select').first().selectOption('snow_plowing');
 await timeline.locator('select').nth(1).selectOption('enabled');
 await timeline.locator('input[type=date]').fill('2026-10-25');
 await timeline.getByRole('button',{name:'Filter audit'}).click();
 await expect(timeline.locator('ol li')).toHaveCount(1);
 await expect(timeline).toContainText('Showing 1 matching audited event');
 expect((await page.evaluate(()=>window.__auditRequests)).at(-1)).toEqual({
  company_id:'company-one',module_key:'snow_plowing',action:'enabled',
  gte_recorded_at:'2026-10-25T00:00:00.000Z',limit:101});
});

test('foreign audit data and changed owner session are withheld',async({page})=>{
 await ownerSetup(page,{foreignAudit:true});
 const timeline=page.locator('[data-owner492-timeline]');
 await timeline.locator('summary').click();
 await timeline.locator('select').first().selectOption('snow_plowing');
 await timeline.getByRole('button',{name:'Filter audit'}).click();
 await expect(timeline).toContainText('WITHHELD');
 await expect(timeline.locator('ol li')).toHaveCount(0);
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#owner490Status')).toContainText('Session changed');
 await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
});

async function adminSetup(page,{ledgerForeign=false}={}){
 await page.setContent('<section id="admin"></section>');
 await page.evaluate(({ledgerForeign})=>{
  const uid='curated-admin';window.__identity=uid;window.__rpcCalls=[];window.__records=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!!window.__identity,user:{id:window.__identity}})};
  const accounts=[
   {profile_id:uid,account_name:'Curated Admin',account_email:'admin@example.invalid',global_role:'admin',curated_platform_admin:true,owned_company_count:0,active:true,staff_tier:'admin',profile_email_matches_auth:true},
   {profile_id:'legacy-admin',account_name:'Legacy Admin',account_email:'legacy@example.invalid',global_role:'admin',curated_platform_admin:false,owned_company_count:0,active:true,staff_tier:'admin',profile_email_matches_auth:true}
  ];
  const ledger=[{entry_id:1,profile_id:ledgerForeign?'other':'legacy-admin',
   evidence_reference:'QL-267-REVIEW-001',evidence_state:'UNVERIFIED_REFERENCE',recorded_at:'2026-10-30T12:00:00Z'}];
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},
   rpc:async(name,args)=>{
    window.__rpcCalls.push(name);
    if(name==='ywi_platform_account_audit_490')return {data:accounts,error:null};
    if(name==='ywi_platform_legacy_evidence_list_493')return {data:ledger,error:null};
    if(name==='ywi_platform_legacy_evidence_record_493'){
     window.__records.push(args);
     ledger.unshift({entry_id:2,profile_id:args.p_profile_id,evidence_reference:args.p_reference,
      evidence_state:'UNVERIFIED_REFERENCE',recorded_at:'2026-10-30T14:00:00Z'});
     return {data:2,error:null};
    }
    return {error:{message:'unexpected RPC'}};
   }};
 },{ledgerForeign});
 await page.addScriptTag({content:adminUI});
 await page.locator('#platform490 summary').click();
 await page.locator('#platform490Refresh').click();
}

test('curated admin can append an unverified ticket but cannot approve or change a role',async({page})=>{
 await adminSetup(page);
 const ledger=page.locator('[data-legacy493-ledger]');
 await expect(ledger).toHaveCount(1);
 await ledger.locator('summary').click();
 await expect(ledger).toContainText('UNVERIFIED_REFERENCE');
 await ledger.locator('input').fill('QL-267-REVIEW-002');
 await ledger.getByRole('button',{name:'Record unverified reference'}).click();
 await expect(page.locator('#platform490Status')).toContainText('2 unverified reference(s)');
 expect(await page.evaluate(()=>window.__records)).toEqual([
  {p_profile_id:'legacy-admin',p_reference:'QL-267-REVIEW-002'}]);
 expect(await page.evaluate(()=>window.__rpcCalls)).not.toContain('ywi_platform_role_update');
});

test('unknown legacy evidence is withheld, and session changes erase the ledger',async({page})=>{
 await adminSetup(page,{ledgerForeign:true});
 await expect(page.locator('#platform490Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-legacy493-ledger]')).toHaveCount(0);
 await page.evaluate(()=>{window.__identity=null;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#platform490Records')).toBeEmpty();
});

async function connectionSetup(page,{enabled=false}={}){
 await page.setContent('<section id="settings"></section>');
 await page.evaluate(({enabled})=>{
  window.__discoveryCalls=[];
  window.fetch=async(path,options)=>{
   window.__discoveryCalls.push({path,options});
   const common={contract_version:'1',app_id:'yard-workers',connection_status:'HOLD',events_enabled:false,commands_enabled:false};
   return {ok:true,json:async()=>path.endsWith('health')?
    {...common,authenticated:false}:
    {...common,tenant_scope:'required_before_connection',service_module_scope:'required_before_connection',
     owner_approval_required:true,capabilities:[{name:'read_client',enabled}]}};
  };
 },{enabled});
 await page.addScriptTag({content:gateUI});
 await page.locator('#ql267Exceptions493 summary').click();
 await page.getByRole('button',{name:'Read QL-267 exceptions'}).click();
}

test('QL-267 public discovery reports HOLD and does not call authenticated or write routes',async({page})=>{
 await connectionSetup(page);
 await expect(page.locator('#ql267Status493')).toContainText('HOLD / DISCONNECTED');
 await expect(page.locator('#ql267List493 li')).toHaveCount(4);
 const requests=await page.evaluate(()=>window.__discoveryCalls);
 expect(requests.map(x=>x.path)).toEqual(['/api/integration/v1/health','/api/integration/v1/capabilities']);
 expect(requests.every(x=>x.options.method==='GET'&&x.options.credentials==='omit')).toBe(true);
});

test('unexpected enabled capability is an exception and does not release the gateway',async({page})=>{
 await connectionSetup(page,{enabled:true});
 await expect(page.locator('#ql267Status493')).toContainText('WITHHELD / HOLD');
 await expect(page.locator('#ql267Status493')).toContainText('no trial authorized');
});
