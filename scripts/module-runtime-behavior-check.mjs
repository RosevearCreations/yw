#!/usr/bin/env node
/** Schema 162/180/185/191 + Build 228 behavior gate: active module and persistent Core loaders stay route-bounded. */
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
    dispatchEvent(event){ dispatchedEvents.push(event); for(const handler of this.listeners.get(event.type)||[]) handler.call(this,event); return true; },
    createElement(tagName){
      assert.equal(tagName,'script');
      return { src:'', async:true, dataset:{}, getAttribute(name){ return name==='src'?this.src:null; } };
    },
    head:{ appendChild(script){ appendedScripts.push(script); document.scripts.push(script); queueMicrotask(()=>script.onload?.()); return script; } }
  };

  const sectionModules={toolbox:'safety',finance:'finance',today:'jobs',crew:'jobs',jobs:'jobs',equipment:'jobs',admin:'admin',it:'admin'};
  const location={ hash:initialHash, origin:'https://example.test', reload(){ reloadCount+=1; } };
  const calls={
    protected:0, forms:0, seed:0, admin:0, adminActions:0, logbook:0, reports:0, profile:0, reference:0, jobs:0,
    profileSelfTransport:0, profileTimeTransport:0, profileCrewTransport:0, profileRoleRender:0, referenceTransport:0
  };

  const profileFactory = {
    create(config = {}) {
      const getAuthState = config.getAuthState || (()=>authState);
      const getAccessProfile = config.getAccessProfile || (()=>({canViewCrew:true}));
      const instance = {
        async loadSelfProfile(){ if(getAuthState()?.isAuthenticated) calls.profileSelfTransport+=1; },
        async loadCrew(){ if(getAuthState()?.isAuthenticated && getAccessProfile(authState.role)?.canViewCrew) calls.profileCrewTransport+=1; },
        applyRoleVisibility(){ calls.profileRoleRender+=1; },
        async init(){
          document.addEventListener('ywi:auth-changed',()=>{
            const next=getAuthState();
            if(!next?.isAuthenticated||next?.isLoggingOut) return;
            calls.profileSelfTransport+=1;
            calls.profileTimeTransport+=1;
            if(getAccessProfile(authState.role)?.canViewCrew) calls.profileCrewTransport+=1;
          });
          document.addEventListener('ywi:route-shown',(event)=>{
            const section=event?.detail?.allowed||event?.detail?.requested||'';
            if(section==='me'&&getAuthState()?.isAuthenticated){calls.profileSelfTransport+=1;calls.profileTimeTransport+=1;}
            if(section==='crew'&&getAuthState()?.isAuthenticated&&getAccessProfile(authState.role)?.canViewCrew) calls.profileCrewTransport+=1;
          });
          const next=getAuthState();
          if(!next?.isAuthenticated||next?.isLoggingOut) return;
          calls.profileSelfTransport+=1;
          calls.profileTimeTransport+=1;
          if(getAccessProfile(authState.role)?.canViewCrew) calls.profileCrewTransport+=1;
        }
      };
      return instance;
    }
  };

  const referenceFactory = {
    create(config = {}) {
      const instance={
        async load(){ return config.api?.fetchReferenceData?.({include_people:true,include_sites:true,include_catalogs:true}); },
        init(){
          document.addEventListener('ywi:auth-changed',()=>instance.load());
          document.addEventListener('ywi:boot-ready',()=>instance.load());
          instance.load();
        }
      };
      return instance;
    }
  };

  const window = {
    location,
    YWI_AUTH:{ getState:()=>authState },
    YWISecurity:{
      canViewModule:(moduleKey)=>grants[moduleKey]===true,
      getModuleForSection:(section)=>sectionModules[section]||null
    },
    YWIProfileUI:profileFactory,
    YWIReferenceData:referenceFactory,
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
    window,
    document,
    grants,
    appendedScripts,
    moduleScripts:()=>appendedScripts.filter((script)=>!!script.dataset.ywiModule),
    coreSecurityScripts:()=>appendedScripts.filter((script)=>script.dataset.ywiCoreSecurity==='password'),
    dispatchedEvents,
    calls,
    get reloadCount(){return reloadCount;},
    setAuth(next){authState={...authState,...next};},
    async event(type,detail={}){ document.dispatchEvent(new TestCustomEvent(type,{detail})); await new Promise((resolve)=>setTimeout(resolve,0)); },
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
  assert.equal(h.calls.reference,0,'Today must not initialize shared reference data just because it belongs to Jobs.');

  await h.route('jobs');
  assert.equal(h.calls.reference,1,'The Jobs manager may initialize reference data when its selector-rich route is actually active.');
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

{
  const h=createHarness('#crew');
  const profile=h.window.YWIProfileUI.create({
    getAuthState:()=>h.window.YWI_AUTH.getState(),
    getAccessProfile:()=>({canViewCrew:true})
  });
  await profile.init();
  assert.equal(h.calls.profileSelfTransport,0,'Opening Crew must not preload self-profile data.');
  assert.equal(h.calls.profileTimeTransport,0,'Opening Crew must not preload time-clock context.');
  assert.equal(h.calls.profileCrewTransport,1,'Opening Crew loads only the Crew transport once.');

  await h.route('finance');
  await h.event('ywi:auth-changed',{state:h.window.YWI_AUTH.getState()});
  assert.equal(h.calls.profileSelfTransport,0,'A persistent profile listener must not reload self profile while Finance is active.');
  assert.equal(h.calls.profileTimeTransport,0,'A persistent profile listener must not reload time clock while Finance is active.');
  assert.equal(h.calls.profileCrewTransport,1,'A persistent profile listener must not reload Crew while Finance is active.');

  await h.route('today');
  await h.event('ywi:auth-changed',{state:h.window.YWI_AUTH.getState()});
  assert.equal(h.calls.profileSelfTransport,0,'Supabase auth/visibility recovery on Today must not trigger self-profile transport.');
  assert.equal(h.calls.profileTimeTransport,0,'Supabase auth/visibility recovery on Today must not trigger time-clock transport.');
  assert.equal(h.calls.profileCrewTransport,1,'Supabase auth/visibility recovery on Today must not trigger Crew transport.');

  await h.route('me');
  assert.equal(h.calls.profileSelfTransport,1,'My Profile route loads self profile when explicitly opened.');
  assert.equal(h.calls.profileTimeTransport,1,'My Profile route loads time-clock context when explicitly opened.');
  assert.equal(h.calls.profileCrewTransport,1,'My Profile route does not preload Crew.');
}

{
  const h=createHarness('#jobs');
  const reference=h.window.YWIReferenceData.create({
    api:{fetchReferenceData:async()=>{h.calls.referenceTransport+=1;return {sites:[],supervisors:[],admins:[],employees:[],positions:[],trades:[]};}}
  });
  reference.init();
  await new Promise((resolve)=>setTimeout(resolve,0));
  assert.equal(h.calls.referenceTransport,1,'Reference data loads when the selector-rich Jobs manager is explicitly active.');

  await h.route('today');
  await h.event('ywi:auth-changed',{state:h.window.YWI_AUTH.getState()});
  await h.event('ywi:boot-ready',{});
  assert.equal(h.calls.referenceTransport,1,'Today auth/boot recovery must not reload reference data.');

  await h.route('finance');
  await h.event('ywi:auth-changed',{state:h.window.YWI_AUTH.getState()});
  assert.equal(h.calls.referenceTransport,1,'Finance auth recovery must not reload a previously initialized reference-data service.');

  await h.route('equipment');
  await new Promise((resolve)=>setTimeout(resolve,0));
  assert.equal(h.calls.referenceTransport,2,'Equipment may refresh reference data when that selector-rich route is explicitly opened.');
}

console.log('PASS runtime-active-module-only-first-sync');
console.log('PASS runtime-route-lazy-loads-next-module');
console.log('PASS runtime-finance-does-not-boot-admin-jobs-profile-reference');
console.log('PASS runtime-it-does-not-boot-heavy-admin-control-center');
console.log('PASS runtime-today-does-not-boot-reference-profile');
console.log('PASS runtime-denied-module-not-requested');
console.log('PASS runtime-jobs-bundle-remains-bounded');
console.log('PASS runtime-signout-purges-stale-code');
console.log('PASS runtime-profile-change-purges-stale-code');
console.log('PASS runtime-persistent-profile-auth-listener-route-bounded');
console.log('PASS runtime-persistent-reference-listeners-route-bounded');
console.log('\nSchema 162/180/185/191 + Build 228 module runtime behavior gate passed: 11/11 checks.');
