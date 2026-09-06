/* File: js/profile-reference-lifecycle.js
   Build 230 profile / crew request lifecycle guard.
   The existing Profile UI remains the rendering and action authority. This decorator prevents
   off-route profile/crew/time-clock reads, coalesces duplicate in-flight profile reads, and
   invalidates shared reference data after a successful self-profile save.
*/

'use strict';

(function () {
  const LIFECYCLE_VERSION = 1;
  const PROFILE_ROUTES = new Set(['me','crew','settings']);

  function currentRoute() {
    return String(window.location?.hash || '#today').replace(/^#/, '').split(/[?&]/)[0].trim().toLowerCase() || 'today';
  }

  function authState() {
    return window.YWI_AUTH?.getState?.() || window.YWI_BOOT?.getState?.() || {};
  }

  function identityKey() {
    const state = authState();
    return String(state?.identityKey || state?.profile?.id || state?.user?.id || '').trim();
  }

  function scopeName(input) {
    return typeof input === 'string' ? input : String(input?.scope || '').trim();
  }

  function safeOffRouteResponse(scope) {
    const state = authState();
    if (scope === 'self') return { profile: state?.profile || null, profiles: state?.profile ? [state.profile] : [] };
    if (scope === 'crew') return { profiles: [] };
    return {};
  }

  function createGuardedApi(api = {}) {
    const inflight = new Map();
    const originalFetchProfileScope = typeof api.fetchProfileScope === 'function' ? api.fetchProfileScope.bind(api) : null;
    const originalFetchTimeClock = typeof api.fetchMyTimeClockContext === 'function' ? api.fetchMyTimeClockContext.bind(api) : null;
    const originalSaveMyProfile = typeof api.saveMyProfile === 'function' ? api.saveMyProfile.bind(api) : null;

    function requestKey(scope, input) {
      const payload = typeof input === 'object' && input ? input : { scope };
      return `${identityKey()}|${scope}|${String(payload.search || '')}|${String(payload.role_filter || '')}`;
    }

    function routeAllows(scope) {
      const route = currentRoute();
      if (scope === 'self') return route === 'me';
      if (scope === 'crew') return route === 'crew';
      return PROFILE_ROUTES.has(route);
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
      if (!originalFetchProfileScope) return safeOffRouteResponse(scope);
      if (!routeAllows(scope)) return safeOffRouteResponse(scope);
      const key = requestKey(scope, input);
      return coalesce(key, () => originalFetchProfileScope(input));
    }

    async function fetchMyTimeClockContext(...args) {
      if (!originalFetchTimeClock) return { active_entry:null, recent_entries:[], jobs:[] };
      if (currentRoute() !== 'me') return { active_entry:null, recent_entries:[], jobs:[] };
      return coalesce(`${identityKey()}|time-clock`, () => originalFetchTimeClock(...args));
    }

    async function saveMyProfile(...args) {
      if (!originalSaveMyProfile) throw new Error('Profile save is unavailable.');
      const response = await originalSaveMyProfile(...args);
      if (response?.ok) window.YWIReferenceData?.active?.invalidate?.('self-profile-save');
      return response;
    }

    return {
      ...api,
      fetchProfileScope,
      ...(originalFetchTimeClock ? { fetchMyTimeClockContext } : {}),
      ...(originalSaveMyProfile ? { saveMyProfile } : {}),
      __ywiProfileLifecycle: Object.freeze({ version:LIFECYCLE_VERSION, inflight, currentRoute })
    };
  }

  function decorateFactory() {
    const registry = window.YWIProfileUI;
    const originalCreate = registry?.create;
    if (typeof originalCreate !== 'function' || originalCreate.__ywiLifecycleDecorated) return false;

    const decoratedCreate = function createProfileWithLifecycle(config = {}) {
      return originalCreate({ ...config, api:createGuardedApi(config.api || {}) });
    };
    decoratedCreate.__ywiLifecycleDecorated = true;
    registry.create = decoratedCreate;
    registry.lifecycleVersion = LIFECYCLE_VERSION;
    registry.currentRoute = currentRoute;
    return true;
  }

  if (!decorateFactory()) {
    document.addEventListener('DOMContentLoaded', decorateFactory, { once:true });
  }
})();
