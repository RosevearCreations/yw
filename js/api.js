/* File: js/api.js
   Brief description: Shared API client for YWI HSE frontend.
   Handles auth-aware fetches to Supabase Edge Functions, storage preview URLs,
   smoke checks, evidence uploads, account maintenance actions, and admin/entity helpers.
   This version uses SB_* runtime config values and always sends both apikey and bearer token.
*/

'use strict';

(function () {
  const DEFAULT_FUNCTION_TIMEOUT_MS = 30000;

  function getRuntimeConfig() {
    return window.YWI_RUNTIME_CONFIG || window.__YWI_RUNTIME_CONFIG || {};
  }

  function getSupabaseUrl() {
    const cfg = getRuntimeConfig();
    return String(
      cfg.SB_URL ||
      cfg.SUPABASE_URL ||
      window.SB_URL ||
      window.SUPABASE_URL ||
      window.YWI_BOOT?.state?.supabaseUrl ||
      'https://jmqvkgiqlimdhcofwkxr.supabase.co'
    ).trim();
  }

  function getSupabaseAnonKey() {
    const cfg = getRuntimeConfig();
    return String(
      cfg.SB_ANON_KEY ||
      cfg.SUPABASE_ANON_KEY ||
      cfg.SUPABASE_PUBLISHABLE_KEY ||
      window.SB_ANON_KEY ||
      window.SUPABASE_ANON_KEY ||
      window.SUPABASE_PUBLISHABLE_KEY ||
      ''
    ).trim();
  }

  function getFunctionsBaseUrl() {
    return `${getSupabaseUrl()}/functions/v1`;
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildError(status, rawText, payload) {
    const message =
      payload?.message ||
      payload?.error ||
      rawText ||
      `HTTP ${status}`;
    const err = new Error(`HTTP ${status}: ${message}`);
    err.status = status;
    err.payload = payload;
    err.details = Array.isArray(payload?.details) ? payload.details : [];
    return err;
  }

  function dispatchValidation(message, details = []) {
    window.dispatchEvent(new CustomEvent('ywi:api-validation', {
      detail: { message, details }
    }));
  }

  async function getLiveSession() {
    const sb = window.YWI_SB || window._sb;
    if (!sb?.auth?.getSession) return null;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    const session = await getLiveSession();
    if (session?.access_token) return session.access_token;

    const bootState = window.YWI_BOOT?.getState?.() || {};
    if (bootState?.session?.access_token) return bootState.session.access_token;

    return '';
  }

  async function buildHeaders(extraHeaders = {}, requireAuth = true) {
    const anonKey = getSupabaseAnonKey();

    const headers = {
      'Content-Type': 'application/json',
      ...(anonKey ? { apikey: anonKey } : {}),
      ...extraHeaders
    };

    if (!requireAuth) return headers;

    const token = await getAccessToken();
    if (!token) {
      throw new Error('Missing authorization header');
    }

    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function maybeRefreshOnUnauthorized(response, options) {
    if (response.status !== 401) return response;

    const sb = window.YWI_SB || window._sb;
    if (!sb?.auth?.refreshSession) return response;

    try {
      const { data, error } = await sb.auth.refreshSession();
      if (error || !data?.session?.access_token) return response;

      const retriedHeaders = {
        ...(options.headers || {}),
        ...(getSupabaseAnonKey() ? { apikey: getSupabaseAnonKey() } : {}),
        Authorization: `Bearer ${data.session.access_token}`
      };

      return await fetch(options.url, {
        method: options.method,
        headers: retriedHeaders,
        body: options.body,
        signal: options.signal
      });
    } catch {
      return response;
    }
  }

  async function jsonFetch(pathOrUrl, {
    method = 'POST',
    body,
    headers = {},
    requireAuth = true,
    timeoutMs = DEFAULT_FUNCTION_TIMEOUT_MS,
    responseType = 'json'
  } = {}) {
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${getFunctionsBaseUrl()}/${String(pathOrUrl).replace(/^\/+/, '')}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timed out.')), timeoutMs);

    try {
      const builtHeaders = await buildHeaders(headers, requireAuth);
      const payload = body === undefined ? undefined : JSON.stringify(body);

      let response = await fetch(url, {
        method,
        headers: builtHeaders,
        body: payload,
        signal: controller.signal
      });

      response = await maybeRefreshOnUnauthorized(response, {
        url,
        method,
        headers: builtHeaders,
        body: payload,
        signal: controller.signal
      });

      const rawText = await response.text();
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const isHtml = /^\s*</.test(rawText || '');
        if (isHtml) {
          throw buildError(
            response.status,
            'Received HTML instead of JSON. This usually means a stale route, bad deploy, or compatibility endpoint issue.',
            { message: rawText.slice(0, 180) }
          );
        }

        const err = buildError(response.status, rawText, parsed);
        if (response.status === 400 && err.details?.length) {
          dispatchValidation(err.message, err.details);
        }
        throw err;
      }

      if (responseType === 'text') return rawText;
      return parsed;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Request timed out.');
      }
      if (String(err?.message || '').includes('Missing authorization header')) {
        throw buildError(401, '{"code":401,"message":"Missing authorization header"}', {
          code: 401,
          message: 'Missing authorization header'
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function uploadEquipmentEvidence(formData, requireAuth = true) {
    const token = requireAuth ? await getAccessToken() : '';
    const anonKey = getSupabaseAnonKey();

    if (requireAuth && !token) {
      throw new Error('Missing authorization header');
    }

    const response = await fetch(`${getFunctionsBaseUrl()}/upload-equipment-evidence`, {
      method: 'POST',
      headers: {
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });

    const rawText = await response.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw buildError(response.status, rawText, payload);
    }
    return payload;
  }

  async function sendToFunction(fnName, payload, requireAuth = true) {
    return jsonFetch(fnName, {
      method: 'POST',
      body: payload,
      requireAuth
    });
  }

  async function fetchReferenceData(payload = {}) {
    return jsonFetch('reference-data', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function fetchProfileScope(payload = {}) {
    const body = typeof payload === 'string' ? { scope: payload } : payload;
    return jsonFetch('admin-directory', {
      method: 'POST',
      body,
      requireAuth: true
    });
  }

  async function saveMyProfile(payload = {}) {
    return accountRecoveryAction({ action: 'update_recovery_profile', ...payload }, true);
  }

  async function fetchJobsDirectory(payload = {}) {
    return jsonFetch('jobs-directory', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function loadAdminDirectory(payload = {}) {
    return jsonFetch('admin-directory', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function loadAdminSelectors(payload = {}) {
    return jsonFetch('admin-selectors', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function manageAdminEntity(payload = {}) {
    return jsonFetch('admin-manage', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function accountRecoveryAction(payload = {}, requireAuth = true) {
    return jsonFetch('account-maintenance', {
      method: 'POST',
      body: payload,
      requireAuth
    });
  }

  async function requestPhoneVerification(payload = {}) {
    return accountRecoveryAction({ action: 'request_phone_verification', ...payload }, true);
  }

  async function sendPhoneVerificationCode(payload = {}) {
    return accountRecoveryAction({ action: 'send_phone_verification_code', ...payload }, true);
  }

  async function verifyPhoneCode(payload = {}) {
    return accountRecoveryAction({ action: 'verify_phone_code', ...payload }, true);
  }

  async function fetchLogData(payload = {}) {
    return jsonFetch('review-list', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function fetchSubmissionDetail(payload = {}) {
    return jsonFetch('review-detail', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function saveSubmissionReview(payload = {}) {
    return jsonFetch('review-save', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function runSmokeCheck() {
    const checks = [];
    const state = window.YWI_BOOT?.getState?.() || {};
    const runtimeCfg = getRuntimeConfig();

    checks.push({
      scope: 'single-h1',
      ok: document.querySelectorAll('h1').length <= 1,
      message: `Found ${document.querySelectorAll('h1').length} H1 tag(s).`
    });

    checks.push({
      scope: 'runtime-config',
      ok: !!(runtimeCfg.SB_URL || runtimeCfg.SUPABASE_URL || state.supabaseUrl),
      message: (runtimeCfg.SB_URL || runtimeCfg.SUPABASE_URL || state.supabaseUrl)
        ? 'Supabase URL is configured.'
        : 'Supabase URL is missing.'
    });

    checks.push({
      scope: 'runtime-anon-key',
      ok: !!getSupabaseAnonKey(),
      message: getSupabaseAnonKey()
        ? 'Supabase anon/public key is configured.'
        : 'Supabase anon/public key is missing.'
    });

    try {
      const cfgResp = await fetch('/js/app-config.js', { cache: 'no-store' });
      checks.push({
        scope: 'app-config-file',
        ok: cfgResp.ok,
        status: cfgResp.status,
        message: cfgResp.ok ? 'app-config.js reachable.' : 'app-config.js missing.'
      });
    } catch (err) {
      checks.push({
        scope: 'app-config-file',
        ok: false,
        message: err?.message || 'app-config.js check failed.'
      });
    }

    try {
      const compat = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smoke: true })
      });
      checks.push({
        scope: 'bootstrap-admin-compat',
        ok: compat.ok,
        status: compat.status,
        message: compat.ok ? 'Compatibility bootstrap endpoint reachable.' : 'Compatibility bootstrap endpoint failed.'
      });
    } catch (err) {
      checks.push({
        scope: 'bootstrap-admin-compat',
        ok: false,
        message: err?.message || 'Compatibility bootstrap endpoint failed.'
      });
    }

    const session = await getLiveSession();
    if (session?.access_token) {
      try {
        const adminResp = await fetchProfileScope({ scope: 'counts' });
        checks.push({
          scope: 'authenticated-admin-directory',
          ok: !!adminResp,
          message: 'Authenticated admin-directory probe completed.'
        });
      } catch (err) {
        checks.push({
          scope: 'authenticated-admin-directory',
          ok: false,
          message: err?.message || 'Authenticated admin-directory probe failed.'
        });
      }

      try {
        const jobsResp = await fetchJobsDirectory({ scope: 'summary' });
        checks.push({
          scope: 'authenticated-jobs-directory',
          ok: !!jobsResp,
          message: 'Authenticated jobs-directory probe completed.'
        });
      } catch (err) {
        checks.push({
          scope: 'authenticated-jobs-directory',
          ok: false,
          message: err?.message || 'Authenticated jobs-directory probe failed.'
        });
      }
    } else {
      checks.push({
        scope: 'authenticated-probes',
        ok: true,
        message: 'Skipped authenticated probes because there is no signed-in session.'
      });
    }

    const result = {
      ok: checks.every((item) => item.ok),
      checks,
      runtime: {
        supabaseUrl: getSupabaseUrl(),
        hasSession: !!session?.access_token,
        hasAnonKey: !!getSupabaseAnonKey(),
        authFlow: state.authFlow || 'idle',
        needsAccountSetup: !!state.needsAccountSetup,
        pendingAuthResolution: !!state.pendingAuthResolution
      }
    };

    window.__YWI_LAST_SMOKE_CHECK = result;
    return result;
  }

  function storagePreviewUrl(bucket, path, expiresIn = 3600) {
    const sb = window.YWI_SB || window._sb;
    if (!sb?.storage?.from) return '';
    return sb.storage.from(bucket).createSignedUrl(path, expiresIn)
      .then(({ data, error }) => error ? '' : (data?.signedUrl || ''))
      .catch(() => '');
  }

  window.YWIAPI = {
    escHtml,
    jsonFetch,
    sendToFunction,
    uploadEquipmentEvidence,
    fetchReferenceData,
    fetchProfileScope,
    saveMyProfile,
    fetchJobsDirectory,
    loadAdminDirectory,
    loadAdminSelectors,
    manageAdminEntity,
    accountRecoveryAction,
    requestPhoneVerification,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    fetchLogData,
    fetchSubmissionDetail,
    saveSubmissionReview,
    runSmokeCheck,
    storagePreviewUrl
  };
})();
