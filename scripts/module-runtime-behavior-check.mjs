#!/usr/bin/env node
/** Schema 162/180/185/191 behavior gate: denied modules are never requested; stale loaded module code is purged; Build 191 core password security may load independently. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'js/module-runtime.js'), 'utf8');

class TestCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

function createHarness() {
  let authState = { isAuthenticated:true, pendingAuthResolution:false, needsAccountSetup:false, role:'employee', profile:{id:'profile-a'}, user:{id:'user-a'} };
  const grants = { safety:false, finance:false, jobs:false, admin:false };
  const appendedScripts = [];
  const dispatchedEvents = [];
  let reloadCount = 0;

  const document = {
    scripts: [], listeners:new Map(),
    addEventListener(type,handler){ if(!this.listeners.has(type))this.listeners.set(type,[]); this.listeners.get(type).push(handler); },
    dispatchEvent(event){ dispatchedEvents.push(event); return true; },
    createElement(tagName){
      assert.equal(tagName,'script');
      return { src:'', async:true, dataset:{}, getAttribute(name){ return name==='src'?this.src:null; } };
    },
    head:{ appendChild(script){ appendedScripts.push(script); document.scripts.push(script); queueMicrotask(()=>script.onload?.()); return script; } }
  };

  const window = {
    location:{ origin:'https://example.test', reload(){ reloadCount+=1; } },
    YWI_AUTH:{ getState:()=>authState },
    YWISecurity:{ canViewModule:(moduleKey)=>grants[moduleKey]===true },
    initFormModules(){}, initProtectedModules(){}, seedAllTables(){}, YWIModuleNav:{sync(){}},
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
    get reloadCount(){return reloadCount;},
    setAuth(next){authState={...authState,...next};}
  };
}

{
  const h=createHarness();
  assert.ok(h.runtime,'YWIModuleRuntime should be exposed.');
  assert.equal(h.runtime.BUILD,'2026-09-02l');
  assert.equal(h.runtime.CONTRACT_VERSION,2);
  assert.equal(h.coreSecurityScripts().length,1,'Build 191 password-security core script should load exactly once.');
  assert.equal(h.coreSecurityScripts()[0].src,'/js/password-security.js?v=2026-09-02l-b191');

  const deniedFinance=await h.runtime.loadModule('finance');
  assert.equal(deniedFinance,false,'Denied Finance load must return false.');
  assert.equal(h.moduleScripts().length,0,'Denied Finance must not append or request a business-module script.');
  assert.deepEqual(Array.from(h.runtime.getRuntimeState().loadedModules),[],'Denied Finance must not initialize as loaded.');

  h.grants.finance=true;
  const allowedFinance=await h.runtime.loadModule('finance');
  assert.equal(allowedFinance,true,'Allowed Finance load should succeed.');
  const financeScripts=h.moduleScripts();
  assert.equal(financeScripts.length,2,'Allowed Finance should request the lifecycle and Schema 180 mapping-review scripts.');
  assert.equal(financeScripts[0].src,'/js/finance-ui.js?v=2026-09-02l');
  assert.equal(financeScripts[1].src,'/js/finance-account-mapping-ui.js?v=2026-09-02l');
  assert.ok(financeScripts.every((script)=>script.dataset.ywiModule==='finance'));
  assert.ok(financeScripts.every((script)=>script.dataset.ywiRuntime==='permission-driven'));

  const beforeAdminAttempt=h.moduleScripts().length;
  const deniedAdmin=await h.runtime.loadModule('admin');
  assert.equal(deniedAdmin,false,'Denied Admin load must return false.');
  assert.equal(h.moduleScripts().length,beforeAdminAttempt,'Denied Admin must not request any Admin scripts.');
}

{
  const h=createHarness(); h.grants.finance=true;
  await h.runtime.syncForCurrentAccess();
  assert.deepEqual(Array.from(h.runtime.getRuntimeState().loadedModules),['finance']);
  h.grants.finance=false;
  const result=await h.runtime.syncForCurrentAccess();
  assert.equal(result,false,'Permission reduction should abort the current sync.');
  assert.equal(h.reloadCount,1,'Permission reduction should reload once to purge stale module code.');
  assert.ok(h.dispatchedEvents.some((event)=>event.type==='ywi:module-runtime-purge'&&event.detail?.reason==='permission_removed:finance'),'Permission reduction should emit a purge event naming Finance.');
}

{
  const h=createHarness(); h.grants.jobs=true;
  await h.runtime.syncForCurrentAccess();
  const jobScripts=h.moduleScripts();
  assert.equal(jobScripts.length,3,'Allowed Jobs should load the Jobs UI, Finance-boundary shim, and Build 185 equipment scanner.');
  assert.equal(jobScripts[0].src,'/js/jobs-ui.js?v=2026-09-02l');
  assert.equal(jobScripts[1].src,'/js/jobs-finance-boundary.js?v=2026-09-02l');
  assert.equal(jobScripts[2].src,'/js/equipment-scanner.js?v=2026-09-02l');
  assert.ok(jobScripts.every((script)=>script.dataset.ywiModule==='jobs'));
  assert.ok(jobScripts.every((script)=>script.dataset.ywiRuntime==='permission-driven'));
  h.setAuth({isAuthenticated:false});
  await h.runtime.syncForCurrentAccess();
  assert.equal(h.reloadCount,1,'Sign-out should reload once after module code was loaded.');
  assert.ok(h.dispatchedEvents.some((event)=>event.type==='ywi:module-runtime-purge'&&event.detail?.reason==='signed_out'));
}

{
  const h=createHarness(); h.grants.safety=true;
  await h.runtime.syncForCurrentAccess();
  h.setAuth({profile:{id:'profile-b'},user:{id:'user-b'}});
  await h.runtime.syncForCurrentAccess();
  assert.equal(h.reloadCount,1,'Profile identity change should reload once after module code was loaded.');
  assert.ok(h.dispatchedEvents.some((event)=>event.type==='ywi:module-runtime-purge'&&event.detail?.reason==='profile_changed'));
}

console.log('PASS runtime-password-security-core-loaded-once');
console.log('PASS runtime-denied-module-not-requested');
console.log('PASS runtime-allowed-module-requested-from-manifest');
console.log('PASS runtime-finance-mapping-review-lazy-loaded');
console.log('PASS runtime-permission-reduction-purges-stale-code');
console.log('PASS runtime-jobs-finance-boundary-and-equipment-scanner-loaded');
console.log('PASS runtime-signout-purges-stale-code');
console.log('PASS runtime-profile-change-purges-stale-code');
console.log('\nSchema 162/180/185/191 module runtime behavior gate passed: 8/8 checks.');
