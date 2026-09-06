#!/usr/bin/env node
/** Schema 162/180/185/191 + Build 228 behavior gate: only the active permitted business module is requested. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'js/module-runtime.js'), 'utf8');

class TestCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

function createHarness(initialHash = '#finance') {
  let authState = { isAuthenticated:true, pendingAuthResolution:false, needsAccountSetup:false, role:'admin', profile:{id:'profile-a'}, user:{id:'user-a'} };
  const grants = { safety:true, finance:true, jobs:true, admin:true };
  const appendedScripts = [];
  const dispatchedEvents = [];
  let reloadCount = 0;

  const document = {
    scripts: [], listeners:new Map(),
    addEventListener(type,handler){ if(!this.listeners.has(type))this.listeners.set(type,[]); this.listeners.get(type).push(handler); },
    dispatchEvent(event){ dispatchedEvents.push(event); for(const handler of this.listeners.get(event.type)||[]) handler(event); return true; },
    createElement(tagName){
      assert.equal(tagName,'script');
      return { src:'', async:true, dataset:{}, getAttribute(name){ return name==='src'?this.src:null; } };
    },
    head:{ appendChild(script){ appendedScripts.push(script); document.scripts.push(script); queueMicrotask(()=>script.onload?.()); return script; } }
  };

  const sectionModules={toolbox:'safety',finance:'finance',today:'jobs',crew:'jobs',jobs:'jobs',equipment:'jobs',admin:'admin',it:'admin'};
  const location={ hash:initialHash, origin:'https://example.test', reload(){ reloadCount+=1; } };
  const calls={ protected:0, forms:0, seed:0, admin:0, adminActions:0, logbook:0, reports:0, profile:0, reference:0, jobs:0 };
  const window = {
    location,
    YWI_AUTH:{ getState:()=>authState },
    YWISecurity:{
      canViewModule:(moduleKey)=>grants[moduleKey]===true,
      getModuleForSection:(section)=>sectionModules[section]||null
    },
    initProtectedModules(){ calls.protected+=1; },
    initFormModules(){ calls.forms+=1; },
    seedAllTables(){ calls.seed+=1; },
    initAdminModule(){ calls.admin+=1; },
    initAdminActions(){ calls.adminActions+=1; },
    initLogbookModule(){ calls.logbook+=1; },
    initReportsModule(){ calls.reports+=1; },
    initProfileModule(){ calls.profile+=1; },
    initReferenceDataModule(){ calls.reference+=1; },
    initJobsModule(){ calls.jobs+=1; },
    YWIModuleNav:{sync(){},activeModule(){return sectionModules[String(location.hash||'').replace(/^#/,'')]||'';}},
    dispatchEvent(event){ dispatchedEvents.push(event); return true; }
  };

  const sandbox={ window,document,URL,Date,Error,Promise,Set,Map,Object,String,Array,encodeURIComponent,CustomEvent:TestCustomEvent,queueMicrotask,console };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'js/module-runtime.js'});
  return {
    runtime:window.YWIModuleRuntime,
    grants,
    appendedScripts,
    moduleScripts:()=>appendedScripts.filter((script)=>!!script.dataset.ywiModule),
    coreSecurityScripts:()=>appendedScripts.filter((script)=>script.dataset.ywiCoreSecurity==='password'),
    dispatchedEvents,
    calls,
    get reloadCount(){return reloadCount;},
    setAuth(next){authState={...authState,...next};},
    async route(section){ location.hash=`#${section}`; document.dispatchEvent(new TestCustomEvent('ywi:route-shown',{detail:{allowed:section,requested:section}})); await new Promise((resolve)=>setTimeout(resolve,0)); }
  };
}

{
  const h=createHarness('#finance');
  assert.ok(h.runtime,'YWIModuleRuntime should be exposed.');
  assert.equal(h.runtime.BUILD,'2026-09-06a');
  assert.equal(h.runtime.CONTRACT_VERSION,2);
  assert.equal(h.coreSecurityScripts().length,1,'Password-security core script should load exactly once.');
  assert.equal(h.coreSecurityScripts()[0].src,'/js/password-security.js?v=2026-09-06a-b191');

  await h.runtime.syncForCurrentAccess();
  assert.deepEqual(Array.from(h.runtime.getRuntimeState().loadedModules),['finance'],'An admin with all grants must request only the active Finance module on first sync.');
  assert.equal(h.moduleScripts().length,2,'Active Finance should request only its two scripts.');
  assert.equal(h.moduleScripts()[0].src,'/js/finance-ui.js?v=2026-09-06a');
  assert.equal(h.moduleScripts()[1].src,'/js/finance-account-mapping-ui.js?v=2026-09-06a');
  assert.ok(h.moduleScripts().every((script)=>script.dataset.ywiRuntime==='permission-driven'));
  assert.equal(h.calls.admin,0,'Finance boot must not initialize Admin.');
  assert.equal(h.calls.jobs,0,'Finance boot must not initialize Jobs.');
  assert.equal(h.calls.profile,0,'Finance boot must not initialize profile/crew services.');
  assert.equal(h.calls.reference,0,'Finance boot must not initialize reference-data services.');

  await h.route('admin');
  assert.deepEqual(Array.from(h.runtime.getRuntimeState().loadedModules),['finance','admin'],'Navigating to Admin should lazy-load Admin after Finance.');
  assert.equal(h.calls.admin,1,'Admin controller should initialize only when #admin is active.');
  assert.equal(h.calls.adminActions,1,'Admin actions should initialize only when #admin is active.');

  await h.route('it');
  assert.equal(h.calls.admin,1,'I.T. Readiness must not reinitialize the heavy Admin Control Center.');

  await h.route('today');
  assert.ok(h.runtime.getRuntimeState().loadedModules.includes('jobs'),'Navigating to Jobs should lazy-load Jobs.');
  assert.equal(h.calls.jobs,1,'Jobs controller should initialize when a Jobs route is active.');
  assert.equal(h.calls.reference,1,'Jobs may initialize shared reference data when it is the active module.');
}

{
  const h=createHarness('#finance');
  h.grants.finance=false;
  const deniedFinance=await h.runtime.loadModule('finance');
  assert.equal(deniedFinance,false,'Denied Finance load must return false.');
  assert.equal(h.moduleScripts().length,0,'Denied Finance must not append or request a business-module script.');
}

{
  const h=createHarness('#today');
  await h.runtime.syncForCurrentAccess();
  const jobScripts=h.moduleScripts();
  assert.equal(jobScripts.length,3,'Active Jobs should load the Jobs UI, Finance-boundary shim, and equipment scanner.');
  assert.equal(jobScripts[0].src,'/js/jobs-ui.js?v=2026-09-06a');
  assert.equal(jobScripts[1].src,'/js/jobs-finance-boundary.js?v=2026-09-06a');
  assert.equal(jobScripts[2].src,'/js/equipment-scanner.js?v=2026-09-06a');
  h.setAuth({isAuthenticated:false});
  await h.runtime.syncForCurrentAccess();
  assert.equal(h.reloadCount,1,'Sign-out should reload once after module code was loaded.');
  assert.ok(h.dispatchedEvents.some((event)=>event.type==='ywi:module-runtime-purge'&&event.detail?.reason==='signed_out'));
}

{
  const h=createHarness('#toolbox');
  await h.runtime.syncForCurrentAccess();
  h.setAuth({profile:{id:'profile-b'},user:{id:'user-b'}});
  await h.runtime.syncForCurrentAccess();
  assert.equal(h.reloadCount,1,'Profile identity change should reload once after module code was loaded.');
  assert.ok(h.dispatchedEvents.some((event)=>event.type==='ywi:module-runtime-purge'&&event.detail?.reason==='profile_changed'));
}

console.log('PASS runtime-active-module-only-first-sync');
console.log('PASS runtime-route-lazy-loads-next-module');
console.log('PASS runtime-finance-does-not-boot-admin-jobs-profile-reference');
console.log('PASS runtime-it-does-not-boot-heavy-admin-control-center');
console.log('PASS runtime-denied-module-not-requested');
console.log('PASS runtime-jobs-bundle-remains-bounded');
console.log('PASS runtime-signout-purges-stale-code');
console.log('PASS runtime-profile-change-purges-stale-code');
console.log('\nSchema 162/180/185/191 + Build 228 module runtime behavior gate passed: 8/8 checks.');