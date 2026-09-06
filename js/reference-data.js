/* File: js/reference-data.js
   Brief description: Shared reference-data loader for populated site, supervisor, employee,
   position, and trade fields. Build 230 keeps the directory in memory for a short bounded
   freshness window, coalesces concurrent reads, invalidates on identity changes, and loads
   only when the active route actually contains a reference-data workflow.
*/

'use strict';

(function () {
  const REFERENCE_TTL_MS = 5 * 60 * 1000;
  const REFERENCE_ROUTES = new Set(['toolbox','ppe','firstaid','inspect','drill','hseops','jobs','equipment','admin','me']);

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function ensureDataList(id) {
    let dl = document.getElementById(id);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = id;
      document.body.appendChild(dl);
    }
    return dl;
  }

  function fillDataList(id, values) {
    const dl = ensureDataList(id);
    dl.innerHTML = '';
    [...new Set((values || []).filter(Boolean))].sort().forEach((value) => {
      const opt = document.createElement('option');
      opt.value = String(value);
      dl.appendChild(opt);
    });
  }

  function setListOnSelectors(selectors, listId) {
    selectors.forEach((sel) => {
      $$(sel).forEach((el) => el.setAttribute('list', listId));
    });
  }

  function currentRoute() {
    return String(window.location?.hash || '#today').replace(/^#/, '').split(/[?&]/)[0].trim().toLowerCase() || 'today';
  }

  function routeNeedsReferenceData(route = currentRoute()) {
    return REFERENCE_ROUTES.has(String(route || '').trim().toLowerCase());
  }

  function identityKey(authState = {}) {
    return String(authState?.identityKey || authState?.profile?.id || authState?.user?.id || authState?.profile?.email || authState?.user?.email || '').trim();
  }

  function createReferenceDataUI(config = {}) {
    const api = config.api;
    const getAuthState = config.getAuthState || (() => window.YWI_AUTH?.getState?.() || {});
    const now = config.now || (() => Date.now());
    const state = {
      last: null,
      loadedAt: 0,
      identityKey: '',
      inflight: null,
      inflightIdentity: '',
      loadVersion: 0,
      bound: false,
      lastInvalidationReason: ''
    };

    function isFresh(authState = getAuthState()) {
      const key = identityKey(authState);
      return !!(
        state.last &&
        key &&
        state.identityKey === key &&
        state.loadedAt > 0 &&
        (now() - state.loadedAt) < REFERENCE_TTL_MS
      );
    }

    function apply(resp = state.last || {}) {
      if (!resp) return null;
      const sites = (resp.sites || []).map((s) => s.site_name ? `${s.site_code || s.site_name} — ${s.site_name}` : (s.site_code || s.site_name)).filter(Boolean);
      const supervisors = (resp.supervisors || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
      const admins = (resp.admins || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
      const employees = (resp.employees || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
      const positions = (resp.positions || []).map((x) => x.name || x).filter(Boolean);
      const trades = (resp.trades || []).map((x) => x.name || x).filter(Boolean);

      fillDataList('site-options', sites);
      fillDataList('supervisor-options', supervisors);
      fillDataList('employee-options', employees);
      fillDataList('admin-options', admins);
      fillDataList('position-options', positions);
      fillDataList('trade-options', trades);

      setListOnSelectors(['#tb_site','#ppe_site','#fa_site','#insp_site','#dr_site','#ad_search_site_name'], 'site-options');
      setListOnSelectors(['#tb_leader','#ppe_checker','#fa_checker','#insp_inspector','#dr_supervisor','#insp_approver_other','#job_supervisor_name','#job_signing_supervisor_name','#eq_assigned_supervisor','#am_profile_default_supervisor_name','#am_profile_override_supervisor_name'], 'supervisor-options');
      setListOnSelectors(['.insp-assigned','.tb-name','.ppe-name','.dr-name','.insp-worker-name'], 'employee-options');
      setListOnSelectors(['#job_admin_name','#am_profile_default_admin_name','#am_profile_override_admin_name'], 'admin-options');
      setListOnSelectors(['#me_current_position','#am_profile_current_position'], 'position-options');
      setListOnSelectors(['#me_trade_specialty','#am_profile_trade_specialty'], 'trade-options');
      return resp;
    }

    function invalidate(reason = 'manual') {
      state.loadVersion += 1;
      state.last = null;
      state.loadedAt = 0;
      state.identityKey = '';
      state.inflight = null;
      state.inflightIdentity = '';
      state.lastInvalidationReason = String(reason || 'manual');
    }

    async function load(options = {}) {
      const force = options?.force === true;
      if (!api?.fetchReferenceData) return null;
      const authState = getAuthState();
      if (!authState?.isAuthenticated || authState?.isLoggingOut) return null;
      const key = identityKey(authState);
      if (!key) return null;

      if (state.identityKey && state.identityKey !== key) invalidate('identity-change');
      if (!force && isFresh(authState)) return apply(state.last);
      if (!force && state.inflight && state.inflightIdentity === key) return state.inflight;

      const loadVersion = ++state.loadVersion;
      const request = Promise.resolve()
        .then(() => api.fetchReferenceData({ include_people: true, include_sites: true, include_catalogs: true }))
        .then((resp) => {
          const currentState = getAuthState();
          if (loadVersion !== state.loadVersion || identityKey(currentState) !== key || !currentState?.isAuthenticated || currentState?.isLoggingOut) return null;
          state.last = resp || {};
          state.loadedAt = now();
          state.identityKey = key;
          return apply(state.last);
        })
        .catch((err) => {
          const currentState = getAuthState();
          if (currentState?.isLoggingOut || !currentState?.isAuthenticated || loadVersion !== state.loadVersion) return null;
          console.warn('Reference data refresh failed; the current screen remains usable.', err?.message || err);
          return state.last ? apply(state.last) : null;
        })
        .finally(() => {
          if (state.inflight === request) {
            state.inflight = null;
            state.inflightIdentity = '';
          }
        });

      state.inflight = request;
      state.inflightIdentity = key;
      return request;
    }

    function loadForRoute(route, options = {}) {
      if (!routeNeedsReferenceData(route)) return Promise.resolve(null);
      return load(options);
    }

    function bind() {
      if (state.bound) return;
      state.bound = true;
      document.addEventListener('ywi:auth-changed', (event) => {
        const nextState = event?.detail?.state || getAuthState();
        const nextKey = identityKey(nextState);
        if (!nextState?.isAuthenticated || nextState?.isLoggingOut) {
          invalidate('signed-out');
          return;
        }
        if (state.identityKey && nextKey && state.identityKey !== nextKey) invalidate('identity-change');
        if (event?.detail?.event === 'TOKEN_REFRESHED' && event?.detail?.sameIdentity === true) return;
        void loadForRoute(currentRoute());
      });
      document.addEventListener('ywi:boot-ready', () => { void loadForRoute(currentRoute()); });
      document.addEventListener('ywi:route-shown', (event) => {
        const route = event?.detail?.allowed || event?.detail?.requested || currentRoute();
        void loadForRoute(route);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !routeNeedsReferenceData(currentRoute()) || isFresh()) return;
        void load();
      });
    }

    function init() {
      bind();
      return loadForRoute(currentRoute());
    }

    return { init, load, loadForRoute, invalidate, isFresh, apply, state, ttlMs: REFERENCE_TTL_MS };
  }

  const registry = {
    active: null,
    create(config = {}) {
      const instance = createReferenceDataUI(config);
      registry.active = instance;
      return instance;
    },
    routeNeedsReferenceData
  };

  window.YWIReferenceData = registry;

  // Profile/Crew network coordination. Profile UI keeps all rendering and write authority; this
  // decorator only prevents off-route reads and reuses an identical request while it is in flight.
  function decorateProfileFactory() {
    const profileRegistry = window.YWIProfileUI;
    const originalCreate = profileRegistry?.create;
    if (typeof originalCreate !== 'function' || originalCreate.__ywiReferenceLifecycleDecorated) return false;

    function createGuardedApi(api = {}) {
      const inflight = new Map();
      const originalFetchProfileScope = typeof api.fetchProfileScope === 'function' ? api.fetchProfileScope.bind(api) : null;
      const originalFetchTimeClock = typeof api.fetchMyTimeClockContext === 'function' ? api.fetchMyTimeClockContext.bind(api) : null;
      const originalSaveMyProfile = typeof api.saveMyProfile === 'function' ? api.saveMyProfile.bind(api) : null;

      function scopeName(input) {
        return typeof input === 'string' ? input : String(input?.scope || '').trim();
      }

      function profileIdentity() {
        return identityKey(window.YWI_AUTH?.getState?.() || window.YWI_BOOT?.getState?.() || {});
      }

      function safeOffRouteResponse(scope) {
        const state = window.YWI_AUTH?.getState?.() || window.YWI_BOOT?.getState?.() || {};
        if (scope === 'self') return { profile: state?.profile || null, profiles: state?.profile ? [state.profile] : [] };
        if (scope === 'crew') return { profiles: [] };
        return {};
      }

      function routeAllows(scope) {
        const route = currentRoute();
        if (scope === 'self') return route === 'me';
        if (scope === 'crew') return route === 'crew';
        return ['me','crew','settings'].includes(route);
      }

      function coalesce(key, run) {
        if (inflight.has(key)) return inflight.get(key);
        const request = Promise.resolve().then(run).finally(() => {
          if (inflight.get(key) === request) inflight.delete(key);
        });
        inflight.set(key, request);
        return request;
      }

      async function fetchProfileScope(input) {
        const scope = scopeName(input);
        if (!originalFetchProfileScope || !routeAllows(scope)) return safeOffRouteResponse(scope);
        const payload = typeof input === 'object' && input ? input : { scope };
        const key = `${profileIdentity()}|${scope}|${String(payload.search || '')}|${String(payload.role_filter || '')}`;
        return coalesce(key, () => originalFetchProfileScope(input));
      }

      async function fetchMyTimeClockContext(...args) {
        if (!originalFetchTimeClock || currentRoute() !== 'me') return { active_entry:null, recent_entries:[], jobs:[] };
        return coalesce(`${profileIdentity()}|time-clock`, () => originalFetchTimeClock(...args));
      }

      async function saveMyProfile(...args) {
        if (!originalSaveMyProfile) throw new Error('Profile save is unavailable.');
        const response = await originalSaveMyProfile(...args);
        if (response?.ok) registry.active?.invalidate?.('self-profile-save');
        return response;
      }

      return {
        ...api,
        fetchProfileScope,
        ...(originalFetchTimeClock ? { fetchMyTimeClockContext } : {}),
        ...(originalSaveMyProfile ? { saveMyProfile } : {}),
        __ywiProfileRequestLifecycle: Object.freeze({ inflight, currentRoute })
      };
    }

    const decoratedCreate = function createProfileWithReferenceLifecycle(config = {}) {
      return originalCreate({ ...config, api:createGuardedApi(config.api || {}) });
    };
    decoratedCreate.__ywiReferenceLifecycleDecorated = true;
    profileRegistry.create = decoratedCreate;
    profileRegistry.referenceLifecycleVersion = 1;
    return true;
  }

  decorateProfileFactory();
})();
