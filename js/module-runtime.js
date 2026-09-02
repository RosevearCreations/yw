/* File: js/module-runtime.js
   Schema 162 Shared Core + standalone module runtime.
   The shell/Core may exist without any business module. Once auth and module permissions resolve,
   this runtime loads only the browser scripts owned by modules the current profile can view.
   If the identity changes, the user signs out, or a loaded permission is removed, the page is
   reloaded so stale module code is purged from memory. Server-side RLS/RPC/Edge authorization
   remains the actual security boundary.
*/

'use strict';

(function () {
  const BUILD = '2026-09-02l';
  const CONTRACT_VERSION = 2;

  const CORE_ENTITY_CONTRACTS = Object.freeze({
    profile: Object.freeze({ relation: 'profiles', primaryKey: 'id', primaryKeyType: 'uuid' }),
    customer: Object.freeze({ relation: 'clients', primaryKey: 'id', primaryKeyType: 'uuid' }),
    customer_site: Object.freeze({ relation: 'client_sites', primaryKey: 'id', primaryKeyType: 'uuid' }),
    job: Object.freeze({ relation: 'jobs', primaryKey: 'id', primaryKeyType: 'bigint' }),
    equipment: Object.freeze({ relation: 'equipment_master', primaryKey: 'id', primaryKeyType: 'uuid' }),
    customer_asset: Object.freeze({ relation: 'customer_assets', primaryKey: 'id', primaryKeyType: 'uuid' }),
    service_document: Object.freeze({ relation: 'service_contract_documents', primaryKey: 'id', primaryKeyType: 'uuid' })
  });

  const SHARED_CORE_DEPENDENCIES = Object.freeze(Object.keys(CORE_ENTITY_CONTRACTS));

  const MODULE_MANIFEST = Object.freeze({
    safety: Object.freeze({
      key: 'safety',
      label: 'Safety / OHSA',
      version: CONTRACT_VERSION,
      scripts: Object.freeze([
        '/js/hse-ops-ui.js',
        '/js/logbook-ui.js',
        '/js/reports-ui.js',
        '/js/forms-toolbox.js',
        '/js/forms-ppe.js',
        '/js/forms-firstaid.js',
        '/js/forms-incident.js',
        '/js/forms-inspection.js',
        '/js/forms-drill.js'
      ]),
      coreDependencies: SHARED_CORE_DEPENDENCIES
    }),
    finance: Object.freeze({
      key: 'finance',
      label: 'Finance',
      version: CONTRACT_VERSION,
      scripts: Object.freeze(['/js/finance-ui.js','/js/finance-account-mapping-ui.js']),
      coreDependencies: SHARED_CORE_DEPENDENCIES
    }),
    jobs: Object.freeze({
      key: 'jobs',
      label: 'Jobs',
      version: CONTRACT_VERSION,
      scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js']),
      coreDependencies: SHARED_CORE_DEPENDENCIES
    }),
    admin: Object.freeze({
      key: 'admin',
      label: 'Admin',
      version: CONTRACT_VERSION,
      scripts: Object.freeze([
        '/js/admin-actions.js',
        '/js/admin-ui.js',
        '/js/operations-cockpit.js',
        '/js/module-access-ui.js',
        '/js/it-readiness-ui.js'
      ]),
      coreDependencies: SHARED_CORE_DEPENDENCIES
    })
  });

  const state = {
    syncing: false,
    queued: false,
    reloading: false,
    activeProfileId: null,
    loadedModules: new Set(),
    loadedScripts: new Set(),
    failedScripts: new Map(),
    lastSyncAt: 0
  };

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function currentRole() { return authState().role || 'employee'; }
  function security() { return window.YWISecurity || null; }
  function profileIdentity(stateNow = authState()) { return stateNow?.profile?.id || stateNow?.user?.id || null; }

  function normalizeScriptSrc(src) {
    try { return new URL(src, window.location.origin).pathname; }
    catch { return String(src || '').split('?')[0]; }
  }

  function existingScript(src) {
    const target = normalizeScriptSrc(src);
    return [...document.scripts].find((script) => normalizeScriptSrc(script.src || script.getAttribute('src') || '') === target) || null;
  }

  function moduleAllowed(moduleKey) {
    const stateNow = authState();
    if (!stateNow.isAuthenticated || stateNow.pendingAuthResolution || stateNow.needsAccountSetup) return false;
    const sec = security();
    if (!sec?.canViewModule) return false;
    return sec.canViewModule(moduleKey, currentRole(), 'view') === true;
  }

  function staleRuntimeReason(stateNow = authState()) {
    if (state.reloading || stateNow.pendingAuthResolution) return null;
    const hasLoadedModuleCode = state.loadedModules.size > 0 || state.loadedScripts.size > 0;
    if (!hasLoadedModuleCode) return null;
    if (!stateNow.isAuthenticated) return 'signed_out';
    const nextProfileId = profileIdentity(stateNow);
    if (state.activeProfileId && nextProfileId && state.activeProfileId !== nextProfileId) return 'profile_changed';
    const lostModule = [...state.loadedModules].find((moduleKey) => !moduleAllowed(moduleKey));
    if (lostModule) return `permission_removed:${lostModule}`;
    return null;
  }

  function purgeStaleRuntime(reason) {
    if (state.reloading) return;
    state.reloading = true;
    document.dispatchEvent(new CustomEvent('ywi:module-runtime-purge', { detail: { reason, build: BUILD, contractVersion: CONTRACT_VERSION } }));
    window.location.reload();
  }

  function loadScript(src, moduleKey) {
    const normalized = normalizeScriptSrc(src);
    if (state.loadedScripts.has(normalized)) return Promise.resolve(true);
    const present = existingScript(src);
    if (present) { state.loadedScripts.add(normalized); return Promise.resolve(true); }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const joiner = src.includes('?') ? '&' : '?';
      script.src = `${src}${joiner}v=${encodeURIComponent(BUILD)}`;
      script.async = false;
      script.dataset.ywiModule = moduleKey;
      script.dataset.ywiRuntime = 'permission-driven';
      script.onload = () => { state.loadedScripts.add(normalized); state.failedScripts.delete(normalized); resolve(true); };
      script.onerror = () => {
        const error = new Error(`Unable to load ${moduleKey} module script: ${src}`);
        state.failedScripts.set(normalized, error.message);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  async function loadModule(moduleKey) {
    const manifest = MODULE_MANIFEST[moduleKey];
    if (!manifest || !moduleAllowed(moduleKey)) return false;
    if (state.loadedModules.has(moduleKey)) return true;
    for (const script of manifest.scripts) await loadScript(script, moduleKey);
    state.loadedModules.add(moduleKey);
    document.dispatchEvent(new CustomEvent('ywi:module-loaded', { detail: { moduleKey, build: BUILD, contractVersion: CONTRACT_VERSION } }));
    return true;
  }

  function initializeLoadedFactories() {
    window.initFormModules?.();
    window.initProtectedModules?.();
    window.seedAllTables?.();
    window.YWIModuleNav?.sync?.();
  }

  async function syncForCurrentAccess() {
    if (state.syncing) { state.queued = true; return false; }
    state.syncing = true;
    state.queued = false;
    try {
      const stateNow = authState();
      const staleReason = staleRuntimeReason(stateNow);
      if (staleReason) { purgeStaleRuntime(staleReason); return false; }
      if (!stateNow.isAuthenticated || stateNow.pendingAuthResolution || stateNow.needsAccountSetup) return false;
      state.activeProfileId = state.activeProfileId || profileIdentity(stateNow);
      for (const moduleKey of Object.keys(MODULE_MANIFEST)) if (moduleAllowed(moduleKey)) await loadModule(moduleKey);
      initializeLoadedFactories();
      state.lastSyncAt = Date.now();
      document.dispatchEvent(new CustomEvent('ywi:module-runtime-ready', { detail: getRuntimeState() }));
      return true;
    } catch (err) {
      window.dispatchEvent(new CustomEvent('ywi:app-error', { detail: { scope:'module-runtime', message:err?.message || 'A permitted module could not be loaded.', details:['Only authorized modules are requested by the browser runtime. Refresh after resolving the module load failure.'] } }));
      return false;
    } finally {
      state.syncing = false;
      if (state.queued && !state.reloading) queueMicrotask(() => syncForCurrentAccess());
    }
  }

  function getRuntimeState() {
    return { build:BUILD, contractVersion:CONTRACT_VERSION, activeProfileId:state.activeProfileId, loadedModules:[...state.loadedModules], loadedScripts:[...state.loadedScripts], failedScripts:Object.fromEntries(state.failedScripts), lastSyncAt:state.lastSyncAt, reloading:state.reloading };
  }
  function getManifest(moduleKey) { return moduleKey ? MODULE_MANIFEST[String(moduleKey || '').toLowerCase()] || null : MODULE_MANIFEST; }
  function getCoreContract(entityKey) { return entityKey ? CORE_ENTITY_CONTRACTS[String(entityKey || '').toLowerCase()] || null : CORE_ENTITY_CONTRACTS; }

  function bind() {
    document.addEventListener('ywi:auth-changed', () => queueMicrotask(syncForCurrentAccess));
    document.addEventListener('ywi:module-permissions-changed', () => queueMicrotask(syncForCurrentAccess));
    document.addEventListener('DOMContentLoaded', () => queueMicrotask(syncForCurrentAccess));
  }

  bind();
  window.YWIModuleRuntime = Object.freeze({ BUILD, CONTRACT_VERSION, CORE_ENTITY_CONTRACTS, MODULE_MANIFEST, moduleAllowed, loadModule, syncForCurrentAccess, getRuntimeState, getManifest, getCoreContract });
})();
