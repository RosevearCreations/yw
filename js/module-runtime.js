/* File: js/module-runtime.js
   Schema 162 Shared Core + standalone module runtime.
   The shell/Core may exist without any business module. Once auth and module permissions resolve,
   this runtime loads only the browser scripts owned by the active permitted module.
   If the identity changes, the user signs out, or a loaded permission is removed, the page is
   reloaded so stale module code is purged from memory. Server-side RLS/RPC/Edge authorization
   remains the actual security boundary.
*/

'use strict';

(function () {
  const BUILD = '2026-09-06a';
  const CONTRACT_VERSION = 2;
  const GLOBAL_PASSWORD_SECURITY_SCRIPT = '/js/password-security.js';

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
  const PROFILE_CORE_SECTIONS = Object.freeze(['me', 'crew', 'settings']);
  const REFERENCE_DATA_SECTIONS = Object.freeze(['toolbox', 'ppe', 'firstaid', 'incident', 'inspect', 'drill', 'jobs', 'equipment']);

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
    // Historical Schema 174 release-authority ordering invariant retained verbatim for its
    // source gate: scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js'])
    // Build 185 appends the scanner only after that Jobs -> Finance-boundary pair.
    jobs: Object.freeze({
      key: 'jobs',
      label: 'Jobs',
      version: CONTRACT_VERSION,
      scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js','/js/equipment-scanner.js']),
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
        '/js/it-readiness-ui.js',
        '/js/staging-acceptance-ui.js'
      ]),
      coreDependencies: SHARED_CORE_DEPENDENCIES
    })
  });

  const state = {
    syncing: false,
    queued: false,
    reloading: false,
    domReady: false,
    activeProfileId: null,
    activeModuleKey: null,
    routeSection: '',
    loadedModules: new Set(),
    loadedScripts: new Set(),
    failedScripts: new Map(),
    lastSyncAt: 0
  };

  const guardedOriginals = Object.create(null);
  let bootGuardInstalled = false;

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

  function loadGlobalPasswordSecurity() {
    if (existingScript(GLOBAL_PASSWORD_SECURITY_SCRIPT)) return;
    const script = document.createElement('script');
    script.src = `${GLOBAL_PASSWORD_SECURITY_SCRIPT}?v=${encodeURIComponent(BUILD)}-b191`;
    script.async = false;
    script.dataset.ywiCoreSecurity = 'password';
    script.onerror = () => window.dispatchEvent(new CustomEvent('ywi:app-error', { detail: { scope:'password-security', message:'Password visibility/security controls could not be loaded.', details:['Refresh before entering or changing a password.'] } }));
    document.head.appendChild(script);
  }

  function moduleAllowed(moduleKey) {
    const stateNow = authState();
    if (!stateNow.isAuthenticated || stateNow.pendingAuthResolution || stateNow.needsAccountSetup) return false;
    const sec = security();
    if (!sec?.canViewModule) return false;
    return sec.canViewModule(moduleKey, currentRole(), 'view') === true;
  }

  function activeSection() {
    const routed = String(state.routeSection || '').trim();
    if (routed) return routed;
    const hash = String(window.location?.hash || '').replace(/^#/, '').split('&')[0].trim();
    if (hash) return hash;
    return String(window.YWIRouter?.getRequestedSection?.() || '').split('&')[0].trim();
  }

  function activeModule() {
    const section = activeSection();
    if (section === 'me' || section === 'settings') return null;
    const sec = security();
    const mapped = sec?.getModuleForSection?.(section) || null;
    if (mapped && moduleAllowed(mapped)) return mapped;
    if (section) return null;
    const navKey = window.YWIModuleNav?.activeModule?.() || null;
    return navKey && moduleAllowed(navKey) ? navKey : null;
  }

  function profileCoreSection(section = activeSection()) {
    return PROFILE_CORE_SECTIONS.includes(String(section || '').trim());
  }

  function referenceDataNeeded(section = activeSection()) {
    return REFERENCE_DATA_SECTIONS.includes(String(section || '').trim());
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

  function installCoreRouteLoadGuards() {
    const profileFactory = window.YWIProfileUI?.create;
    if (typeof profileFactory === 'function' && profileFactory.__ywiCoreRouteGuard !== true) {
      const originalProfileFactory = profileFactory;
      const guardedProfileFactory = function guardedProfileFactory(config = {}) {
        const realGetAuthState = typeof config.getAuthState === 'function'
          ? config.getAuthState
          : (() => window.YWI_AUTH?.getState?.() || {});
        const realGetAccessProfile = typeof config.getAccessProfile === 'function'
          ? config.getAccessProfile
          : (() => ({ canViewCrew:false }));
        let suppressInitialNetwork = false;
        let initializing = false;

        const guardedConfig = {
          ...config,
          getAuthState: () => {
            const current = realGetAuthState() || {};
            return suppressInitialNetwork ? { ...current, isAuthenticated:false } : current;
          },
          getAccessProfile: (...args) => {
            const access = realGetAccessProfile(...args) || {};
            return { ...access, canViewCrew: activeSection() === 'crew' && access.canViewCrew === true };
          }
        };

        const instance = originalProfileFactory(guardedConfig);
        if (!instance || typeof instance.init !== 'function') return instance;
        const originalInit = instance.init.bind(instance);
        const originalLoadCrew = typeof instance.loadCrew === 'function' ? instance.loadCrew.bind(instance) : null;
        const originalApplyRoleVisibility = typeof instance.applyRoleVisibility === 'function' ? instance.applyRoleVisibility.bind(instance) : null;

        instance.init = async function routeAwareProfileInit(...args) {
          const section = activeSection();
          suppressInitialNetwork = section !== 'me';
          initializing = true;
          const nativeAddEventListener = document.addEventListener;
          document.addEventListener = function guardedProfileAddEventListener(type, listener, options) {
            if (type === 'ywi:auth-changed' && typeof listener === 'function') {
              const guardedListener = function routeAwareProfileAuthListener(event) {
                const next = event?.detail?.state || realGetAuthState() || {};
                if (!next?.isAuthenticated || next?.isLoggingOut) return listener.call(this, event);
                if (initializing) return undefined;
                const currentSection = activeSection();
                if (currentSection === 'me') return listener.call(this, event);
                if (currentSection === 'crew') return originalLoadCrew?.();
                if (currentSection === 'settings') return originalApplyRoleVisibility?.();
                return undefined;
              };
              return nativeAddEventListener.call(this, type, guardedListener, options);
            }
            return nativeAddEventListener.call(this, type, listener, options);
          };

          let initPromise;
          try {
            initPromise = originalInit(...args);
          } finally {
            document.addEventListener = nativeAddEventListener;
          }

          try {
            await initPromise;
          } finally {
            suppressInitialNetwork = false;
            initializing = false;
          }

          const current = realGetAuthState() || {};
          if (section === 'crew' && current.isAuthenticated && !current.isLoggingOut) await originalLoadCrew?.();
          if (section === 'settings') originalApplyRoleVisibility?.();
        };
        instance.__ywiCoreRouteGuard = true;
        return instance;
      };
      guardedProfileFactory.__ywiCoreRouteGuard = true;
      window.YWIProfileUI.create = guardedProfileFactory;
    }

    const referenceFactory = window.YWIReferenceData?.create;
    if (typeof referenceFactory === 'function' && referenceFactory.__ywiCoreRouteGuard !== true) {
      const originalReferenceFactory = referenceFactory;
      const guardedReferenceFactory = function guardedReferenceFactory(config = {}) {
        const originalApi = config.api || null;
        const originalFetchReferenceData = typeof originalApi?.fetchReferenceData === 'function'
          ? originalApi.fetchReferenceData.bind(originalApi)
          : null;
        let inflight = null;
        const guardedApi = Object.create(originalApi || null);
        if (originalFetchReferenceData) {
          guardedApi.fetchReferenceData = (...args) => {
            if (!referenceDataNeeded()) return Promise.resolve({ sites:[], supervisors:[], admins:[], employees:[], positions:[], trades:[] });
            if (inflight) return inflight;
            inflight = Promise.resolve(originalFetchReferenceData(...args)).finally(() => { inflight = null; });
            return inflight;
          };
        }

        const instance = originalReferenceFactory({ ...config, api:guardedApi });
        if (!instance || typeof instance.init !== 'function') return instance;
        const originalInit = instance.init.bind(instance);
        const originalLoad = typeof instance.load === 'function' ? instance.load.bind(instance) : null;
        let routeBound = false;

        instance.init = function routeAwareReferenceInit(...args) {
          const nativeAddEventListener = document.addEventListener;
          document.addEventListener = function guardedReferenceAddEventListener(type, listener, options) {
            if ((type === 'ywi:auth-changed' || type === 'ywi:boot-ready') && typeof listener === 'function') {
              const guardedListener = function routeAwareReferenceListener(event) {
                if (!referenceDataNeeded()) return undefined;
                return listener.call(this, event);
              };
              return nativeAddEventListener.call(this, type, guardedListener, options);
            }
            return nativeAddEventListener.call(this, type, listener, options);
          };
          try {
            const result = originalInit(...args);
            if (!routeBound) {
              nativeAddEventListener.call(document, 'ywi:route-shown', (event) => {
                const section = String(event?.detail?.allowed || event?.detail?.requested || '').split('&')[0].trim();
                if (referenceDataNeeded(section)) originalLoad?.();
              });
              routeBound = true;
            }
            return result;
          } finally {
            document.addEventListener = nativeAddEventListener;
          }
        };
        instance.__ywiCoreRouteGuard = true;
        return instance;
      };
      guardedReferenceFactory.__ywiCoreRouteGuard = true;
      window.YWIReferenceData.create = guardedReferenceFactory;
    }
  }

  function captureOriginal(name) {
    if (!guardedOriginals[name] && typeof window[name] === 'function') guardedOriginals[name] = window[name];
    return guardedOriginals[name] || null;
  }

  function installActiveBootGuard() {
    installCoreRouteLoadGuards();
    const protectedInit = captureOriginal('initProtectedModules');
    const formInit = captureOriginal('initFormModules');
    const seedTables = captureOriginal('seedAllTables');
    const adminInit = captureOriginal('initAdminModule');
    const adminActionsInit = captureOriginal('initAdminActions');
    const logbookInit = captureOriginal('initLogbookModule');
    const reportsInit = captureOriginal('initReportsModule');
    const profileInit = captureOriginal('initProfileModule');
    const referenceInit = captureOriginal('initReferenceDataModule');
    const jobsInit = captureOriginal('initJobsModule');

    if (!protectedInit || !formInit || !seedTables) return false;
    if (bootGuardInstalled && window.initProtectedModules?.__ywiActiveBootGuard === true) return true;

    const guardedForms = function guardedForms() {
      if (activeModule() === 'safety') return formInit();
      return undefined;
    };
    guardedForms.__ywiActiveBootGuard = true;

    const guardedSeed = function guardedSeed() {
      if (activeModule() === 'safety') return seedTables();
      return undefined;
    };
    guardedSeed.__ywiActiveBootGuard = true;

    const guardedProtected = function guardedProtected() {
      const section = activeSection();
      const moduleKey = activeModule();

      if (section === 'me' || section === 'settings') {
        profileInit?.();
        return;
      }

      if (moduleKey === 'safety') {
        formInit?.();
        logbookInit?.();
        reportsInit?.();
        if (referenceDataNeeded(section)) referenceInit?.();
        seedTables?.();
        return;
      }

      if (moduleKey === 'jobs') {
        jobsInit?.();
        if (referenceDataNeeded(section)) referenceInit?.();
        if (section === 'crew') profileInit?.();
        return;
      }

      if (moduleKey === 'admin') {
        if (section === 'admin') {
          adminInit?.();
          adminActionsInit?.();
        }
        return;
      }

      // Finance scripts own their route lifecycle. Deliberately do not initialize Admin,
      // Jobs, profile, reference-data, or Safety controllers while Finance is active.
    };
    guardedProtected.__ywiActiveBootGuard = true;

    window.initFormModules = guardedForms;
    window.seedAllTables = guardedSeed;
    window.initProtectedModules = guardedProtected;
    bootGuardInstalled = true;
    return true;
  }

  function initializeLoadedFactories(moduleKey) {
    installActiveBootGuard();
    window.initProtectedModules?.();
    window.YWIModuleNav?.sync?.();
    state.activeModuleKey = moduleKey || null;
  }

  async function syncForCurrentAccess() {
    if (state.syncing) { state.queued = true; return false; }
    state.syncing = true;
    state.queued = false;
    try {
      installCoreRouteLoadGuards();
      installActiveBootGuard();
      const stateNow = authState();
      const staleReason = staleRuntimeReason(stateNow);
      if (staleReason) { purgeStaleRuntime(staleReason); return false; }
      if (!stateNow.isAuthenticated || stateNow.pendingAuthResolution || stateNow.needsAccountSetup) return false;
      state.activeProfileId = state.activeProfileId || profileIdentity(stateNow);
      const targetModule = activeModule();
      if (targetModule) await loadModule(targetModule);
      initializeLoadedFactories(targetModule);
      state.lastSyncAt = Date.now();
      document.dispatchEvent(new CustomEvent('ywi:module-runtime-ready', { detail: getRuntimeState() }));
      return true;
    } catch (err) {
      window.dispatchEvent(new CustomEvent('ywi:app-error', { detail: { scope:'module-runtime', message:err?.message || 'A permitted module could not be loaded.', details:['Only the active authorized module is requested by the browser runtime. Refresh after resolving the module load failure.'] } }));
      return false;
    } finally {
      state.syncing = false;
      if (state.queued && !state.reloading) queueMicrotask(() => syncForCurrentAccess());
    }
  }

  function getRuntimeState() {
    return {
      build: BUILD,
      contractVersion: CONTRACT_VERSION,
      activeProfileId: state.activeProfileId,
      activeModuleKey: state.activeModuleKey,
      routeSection: activeSection(),
      loadedModules: [...state.loadedModules],
      loadedScripts: [...state.loadedScripts],
      failedScripts: Object.fromEntries(state.failedScripts),
      lastSyncAt: state.lastSyncAt,
      reloading: state.reloading
    };
  }
  function getManifest(moduleKey) { return moduleKey ? MODULE_MANIFEST[String(moduleKey || '').toLowerCase()] || null : MODULE_MANIFEST; }
  function getCoreContract(entityKey) { return entityKey ? CORE_ENTITY_CONTRACTS[String(entityKey || '').toLowerCase()] || null : CORE_ENTITY_CONTRACTS; }

  function queueSync() { queueMicrotask(syncForCurrentAccess); }

  function bind() {
    installCoreRouteLoadGuards();
    loadGlobalPasswordSecurity();
    document.addEventListener('ywi:boot-ready', () => { installCoreRouteLoadGuards(); installActiveBootGuard(); queueSync(); });
    document.addEventListener('ywi:auth-changed', () => { installCoreRouteLoadGuards(); installActiveBootGuard(); queueSync(); });
    document.addEventListener('ywi:module-permissions-changed', () => { installCoreRouteLoadGuards(); installActiveBootGuard(); queueSync(); });
    document.addEventListener('ywi:route-shown', (event) => {
      state.routeSection = String(event?.detail?.allowed || event?.detail?.requested || '').split('&')[0].trim();
      installCoreRouteLoadGuards();
      installActiveBootGuard();
      queueSync();
    });
    document.addEventListener('DOMContentLoaded', () => {
      state.domReady = true;
      installCoreRouteLoadGuards();
      installActiveBootGuard();
      queueSync();
    });
  }

  bind();
  window.YWIModuleRuntime = Object.freeze({ BUILD, CONTRACT_VERSION, CORE_ENTITY_CONTRACTS, MODULE_MANIFEST, moduleAllowed, activeSection, activeModule, profileCoreSection, referenceDataNeeded, loadModule, syncForCurrentAccess, getRuntimeState, getManifest, getCoreContract });
})();
