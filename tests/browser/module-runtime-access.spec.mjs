import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const runtimeSource = fs.readFileSync(path.join(process.cwd(), 'js/module-runtime.js'), 'utf8');

const moduleScripts = Object.freeze({
  safety: [
    '/js/hse-ops-ui.js','/js/logbook-ui.js','/js/reports-ui.js','/js/forms-toolbox.js','/js/forms-ppe.js',
    '/js/forms-firstaid.js','/js/forms-incident.js','/js/forms-inspection.js','/js/forms-drill.js'
  ],
  finance: ['/js/finance-ui.js','/js/finance-account-mapping-ui.js'],
  jobs: ['/js/jobs-ui.js','/js/jobs-finance-boundary.js','/js/equipment-scanner.js'],
  admin: ['/js/admin-actions.js','/js/admin-ui.js','/js/admin-hub-ui.js','/js/operations-cockpit.js','/js/module-access-ui.js','/js/it-readiness-ui.js','/js/staging-acceptance-ui.js']
});

const coreSecurityScripts = ['/js/password-security.js'];
const routeModules = Object.freeze({
  toolbox:'safety', ppe:'safety', firstaid:'safety', incident:'safety', inspect:'safety', drill:'safety',
  finance:'finance', today:'jobs', crew:'jobs', jobs:'jobs', equipment:'jobs', admin:'admin', it:'admin'
});

// Build 228 deliberately tests grants separately from the route that is active. A browser with
// multiple grants must request only the active module, not every module it is allowed to visit.
const scenarios = [
  { key:'anonymous', authenticated:false, allowed:[], activeSection:'finance', expectedActive:null },
  { key:'safety_only', authenticated:true, allowed:['safety'], activeSection:'toolbox', expectedActive:'safety' },
  { key:'finance_only', authenticated:true, allowed:['finance'], activeSection:'finance', expectedActive:'finance' },
  { key:'jobs_only', authenticated:true, allowed:['jobs'], activeSection:'today', expectedActive:'jobs' },
  { key:'admin_only', authenticated:true, allowed:['admin'], activeSection:'admin', expectedActive:'admin' },
  { key:'safety_jobs', authenticated:true, allowed:['safety','jobs'], activeSection:'today', expectedActive:'jobs' },
  { key:'finance_admin', authenticated:true, allowed:['finance','admin'], activeSection:'finance', expectedActive:'finance' },
  { key:'full_admin', authenticated:true, allowed:['safety','finance','jobs','admin'], activeSection:'admin', expectedActive:'admin' }
];

const viewports=[{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:960}];
const canonicalCore={profile:'profiles',customer:'clients',customer_site:'client_sites',job:'jobs',equipment:'equipment_master',customer_asset:'customer_assets',service_document:'service_contract_documents'};
const expectedScripts=(activeModule)=>[...coreSecurityScripts,...(activeModule?moduleScripts[activeModule]:[])];

async function mountRuntime(page,scenario){
  const requested=[];
  await page.route('https://runtime.test/**',async(route)=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/js/')){
      requested.push(url.pathname);
      await route.fulfill({status:200,contentType:'application/javascript',body:`window.__ywiLoadedScripts = window.__ywiLoadedScripts || []; window.__ywiLoadedScripts.push(${JSON.stringify(url.pathname)});`});
      return;
    }
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><main id="app-shell">YWI test shell</main></body></html>'});
  });
  const activeSection=String(scenario.activeSection||'').trim();
  await page.goto(`https://runtime.test/${activeSection?`#${activeSection}`:''}`,{waitUntil:'domcontentloaded'});
  await page.evaluate(({allowed,authenticated})=>{
    const sectionModules={toolbox:'safety',ppe:'safety',firstaid:'safety',incident:'safety',inspect:'safety',drill:'safety',finance:'finance',today:'jobs',crew:'jobs',jobs:'jobs',equipment:'jobs',admin:'admin',it:'admin'};
    window.__ywiGrants=Object.fromEntries(['safety','finance','jobs','admin'].map((key)=>[key,allowed.includes(key)]));
    window.__ywiAuthState={isAuthenticated:authenticated,pendingAuthResolution:false,needsAccountSetup:false,role:allowed.length===4?'admin':'employee',profile:authenticated?{id:'profile-acceptance'}:null,user:authenticated?{id:'user-acceptance'}:null};
    window.YWI_AUTH={getState:()=>window.__ywiAuthState};
    window.YWISecurity={
      canViewModule:(moduleKey)=>window.__ywiGrants[moduleKey]===true,
      getModuleForSection:(section)=>sectionModules[String(section||'')]||null
    };
    window.initFormModules=()=>{};
    window.initProtectedModules=()=>{};
    window.seedAllTables=()=>{};
    window.initAdminModule=()=>{};
    window.initAdminActions=()=>{};
    window.initLogbookModule=()=>{};
    window.initReportsModule=()=>{};
    window.initProfileModule=()=>{};
    window.initReferenceDataModule=()=>{};
    window.initJobsModule=()=>{};
    window.YWIModuleNav={
      sync(){},
      activeModule(){const section=String(location.hash||'').replace(/^#/,'');return sectionModules[section]||null;}
    };
  },scenario);
  await page.addScriptTag({content:runtimeSource});
  await page.evaluate(()=>window.YWIModuleRuntime.syncForCurrentAccess());
  return requested;
}

for(const viewport of viewports){
  for(const scenario of scenarios){
    test(`${scenario.key} requests only its active permitted bundle on ${viewport.name}`,async({page})=>{
      await page.setViewportSize({width:viewport.width,height:viewport.height});
      const requested=await mountRuntime(page,scenario);
      const state=await page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState());
      const manifestKeys=await page.evaluate(()=>Object.keys(window.YWIModuleRuntime.getManifest()));
      const coreRelations=await page.evaluate(()=>Object.fromEntries(Object.entries(window.YWIModuleRuntime.getCoreContract()).map(([key,value])=>[key,value.relation])));
      const expectedLoaded=scenario.expectedActive?[scenario.expectedActive]:[];
      expect(state.loadedModules).toEqual(expectedLoaded);
      expect(state.activeModuleKey).toBe(scenario.expectedActive);
      expect(requested).toEqual(expectedScripts(scenario.expectedActive));
      expect(requested.filter((path)=>path==='/js/password-security.js')).toHaveLength(1);
      expect(manifestKeys).toEqual(['safety','finance','jobs','admin']);
      expect(manifestKeys).not.toContain('it');
      expect(coreRelations).toEqual(canonicalCore);

      // Every granted-but-inactive bundle must remain unrequested, as must every denied bundle.
      for(const moduleKey of ['safety','finance','jobs','admin']){
        const shouldBeLoaded=moduleKey===scenario.expectedActive;
        for(const script of moduleScripts[moduleKey]) expect(requested.includes(script)).toBe(shouldBeLoaded);
      }
      expect(requested.includes('/js/admin-hub-ui.js')).toBe(scenario.expectedActive==='admin');
      expect(requested.includes('/js/it-readiness-ui.js')).toBe(scenario.expectedActive==='admin');
      expect(requested.includes('/js/staging-acceptance-ui.js')).toBe(scenario.expectedActive==='admin');
      expect(requested.includes('/js/jobs-finance-boundary.js')).toBe(scenario.expectedActive==='jobs');
      expect(requested.includes('/js/equipment-scanner.js')).toBe(scenario.expectedActive==='jobs');
      expect(requested.includes('/js/finance-account-mapping-ui.js')).toBe(scenario.expectedActive==='finance');
    });
  }
}

test('full admin lazy-loads the next granted module only after route transition',async({page})=>{
  const requested=await mountRuntime(page,{authenticated:true,allowed:['safety','finance','jobs','admin'],activeSection:'finance',expectedActive:'finance'});
  let state=await page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState());
  expect(state.loadedModules).toEqual(['finance']);
  expect(requested).toEqual(expectedScripts('finance'));
  for(const script of [...moduleScripts.safety,...moduleScripts.jobs,...moduleScripts.admin]) expect(requested).not.toContain(script);

  await page.evaluate(()=>{
    location.hash='#admin';
    document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'admin',requested:'admin'}}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState().activeModuleKey)).toBe('admin');
  state=await page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState());
  expect(state.loadedModules).toEqual(['finance','admin']);
  expect(requested).toEqual([...expectedScripts('finance'),...moduleScripts.admin]);
  for(const script of [...moduleScripts.safety,...moduleScripts.jobs]) expect(requested).not.toContain(script);
});

test('granted but inactive module is not requested',async({page})=>{
  const requested=await mountRuntime(page,{authenticated:true,allowed:['finance','admin'],activeSection:'finance',expectedActive:'finance'});
  expect(requested).toEqual(expectedScripts('finance'));
  for(const script of moduleScripts.admin) expect(requested).not.toContain(script);
});

test('permission downgrade emits purge after Finance was actually loaded',async({page})=>{
  await mountRuntime(page,{authenticated:true,allowed:['finance'],activeSection:'finance',expectedActive:'finance'});
  expect(await page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState().loadedModules)).toEqual(['finance']);
  let purgeReason=null;
  await page.exposeFunction('recordYwiPurge',(reason)=>{purgeReason=reason;});
  await page.evaluate(()=>{
    document.addEventListener('ywi:module-runtime-purge',(event)=>window.recordYwiPurge(event.detail?.reason||null),{once:true});
    window.__ywiGrants.finance=false;
  });
  await page.evaluate(()=>window.YWIModuleRuntime.syncForCurrentAccess()).catch(()=>{});
  await expect.poll(()=>purgeReason).toBe('permission_removed:finance');
});

test('sign-out emits purge after Jobs was actually loaded',async({page})=>{
  await mountRuntime(page,{authenticated:true,allowed:['jobs'],activeSection:'today',expectedActive:'jobs'});
  expect(await page.evaluate(()=>window.YWIModuleRuntime.getRuntimeState().loadedModules)).toEqual(['jobs']);
  let purgeReason=null;
  await page.exposeFunction('recordYwiPurge',(reason)=>{purgeReason=reason;});
  await page.evaluate(()=>{
    document.addEventListener('ywi:module-runtime-purge',(event)=>window.recordYwiPurge(event.detail?.reason||null),{once:true});
    window.__ywiAuthState={...window.__ywiAuthState,isAuthenticated:false};
  });
  await page.evaluate(()=>window.YWIModuleRuntime.syncForCurrentAccess()).catch(()=>{});
  await expect.poll(()=>purgeReason).toBe('signed_out');
});
