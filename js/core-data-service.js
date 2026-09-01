/* File: js/core-data-service.js
   Schema 163 Shared Core Data service.
   Read-only canonical identity directories for Safety, Finance, Jobs and Admin.
   Requests are permission-checked before transport and cached by signed-in profile + module.
*/

'use strict';

(function () {
  const BUILD = '2026-09-01e';
  const CONTRACT_VERSION = 1;
  const DEFAULT_TTL_MS = 30000;
  const ENTITY_KEYS = Object.freeze([
    'profile',
    'customer',
    'customer_site',
    'job',
    'equipment',
    'customer_asset',
    'service_document'
  ]);
  const MODULE_KEYS = Object.freeze(['safety', 'finance', 'jobs', 'admin']);

  const cache = new Map();
  const inflight = new Map();
  let lastProfileId = null;

  function authState() {
    return window.YWI_AUTH?.getState?.() || {};
  }

  function profileId(state = authState()) {
    return state?.profile?.id || state?.user?.id || null;
  }

  function currentRole(state = authState()) {
    return state?.role || state?.profile?.role || 'employee';
  }

  function accessReady(state = authState()) {
    return !!(state?.isAuthenticated && !state?.pendingAuthResolution && !state?.needsAccountSetup && !state?.isLoggingOut);
  }

  function normalizeModuleKey(value) {
    const key = String(value || '').trim().toLowerCase();
    return MODULE_KEYS.includes(key) ? key : '';
  }

  function normalizeEntities(value) {
    const input = Array.isArray(value) && value.length ? value : ENTITY_KEYS;
    const result = [];
    for (const raw of input) {
      const key = String(raw || '').trim().toLowerCase();
      if (ENTITY_KEYS.includes(key) && !result.includes(key)) result.push(key);
    }
    return result.sort();
  }

  function clampLimit(value, fallback = 250) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(500, Math.trunc(parsed)));
  }

  function moduleAllowed(moduleKey, state = authState()) {
    if (!accessReady(state)) return false;
    const key = normalizeModuleKey(moduleKey);
    if (!key) return false;
    const security = window.YWISecurity;
    if (!security?.canViewModule) return false;
    return security.canViewModule(key, currentRole(state), 'view') === true;
  }

  function makeAccessError(moduleKey) {
    const error = new Error(`${moduleKey || 'Requested'} module view access is required for Shared Core data.`);
    error.code = 'MODULE_ACCESS_DENIED';
    error.status = 403;
    return error;
  }

  function makeKey(moduleKey, entities, limit, state = authState()) {
    return `${profileId(state) || 'anonymous'}|${moduleKey}|${limit}|${entities.join(',')}`;
  }

  function invalidate(reason = 'manual') {
    cache.clear();
    inflight.clear();
    document.dispatchEvent(new CustomEvent('ywi:core-data-invalidated', {
      detail: { reason, build: BUILD, contractVersion: CONTRACT_VERSION }
    }));
  }

  async function read(options = {}) {
    const state = authState();
    const moduleKey = normalizeModuleKey(options.moduleKey || options.module_key);
    if (!moduleAllowed(moduleKey, state)) throw makeAccessError(moduleKey);

    const entities = normalizeEntities(options.entities);
    if (!entities.length) throw new Error('At least one valid Shared Core entity is required.');
    const limit = clampLimit(options.limit, 250);
    const ttlMs = Math.max(0, Number.isFinite(Number(options.ttlMs)) ? Number(options.ttlMs) : DEFAULT_TTL_MS);
    const key = makeKey(moduleKey, entities, limit, state);
    const now = Date.now();

    if (!options.force) {
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now) return cached.value;
      if (inflight.has(key)) return inflight.get(key);
    }

    const api = window.YWIAPI;
    if (!api?.jsonFetch) throw new Error('Shared API client is unavailable.');

    const request = api.jsonFetch('core-data-read', {
      method: 'POST',
      body: {
        module_key: moduleKey,
        entities,
        limit
      },
      requireAuth: true,
      timeoutMs: 20000
    }).then((response) => {
      if (!response?.ok || response?.read_only !== true) throw new Error(response?.error || 'Shared Core read failed.');
      const normalized = {
        ...response,
        data: Object.fromEntries(entities.map((entityKey) => [entityKey, Array.isArray(response?.data?.[entityKey]) ? response.data[entityKey] : []]))
      };
      cache.set(key, { value: normalized, expiresAt: Date.now() + ttlMs });
      return normalized;
    }).finally(() => {
      inflight.delete(key);
    });

    inflight.set(key, request);
    return request;
  }

  async function readEntity(moduleKey, entityKey, options = {}) {
    const key = String(entityKey || '').trim().toLowerCase();
    if (!ENTITY_KEYS.includes(key)) throw new Error(`Unknown Shared Core entity: ${entityKey}`);
    const response = await read({ ...options, moduleKey, entities: [key] });
    return response.data[key] || [];
  }

  function getState() {
    return {
      build: BUILD,
      contractVersion: CONTRACT_VERSION,
      profileId: profileId(),
      cacheEntries: cache.size,
      inflightRequests: inflight.size,
      entityKeys: [...ENTITY_KEYS],
      moduleKeys: [...MODULE_KEYS]
    };
  }

  function bind() {
    document.addEventListener('ywi:auth-changed', (event) => {
      const next = event?.detail?.state || authState();
      const nextProfileId = profileId(next);
      if (!next?.isAuthenticated || next?.isLoggingOut || (lastProfileId && nextProfileId && nextProfileId !== lastProfileId)) {
        invalidate(!next?.isAuthenticated || next?.isLoggingOut ? 'auth-ended' : 'profile-changed');
      }
      lastProfileId = nextProfileId;
    });
    document.addEventListener('ywi:module-permissions-changed', () => invalidate('module-permissions-changed'));
  }

  lastProfileId = profileId();
  bind();

  window.YWICoreData = Object.freeze({
    BUILD,
    CONTRACT_VERSION,
    ENTITY_KEYS,
    MODULE_KEYS,
    accessReady,
    moduleAllowed,
    normalizeEntities,
    read,
    readEntity,
    invalidate,
    getState
  });
})();
