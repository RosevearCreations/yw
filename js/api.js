/* File: js/api.js
   Brief description: Shared API client for YWI HSE frontend.
   Handles auth-aware fetches to Supabase Edge Functions, storage preview URLs,
   smoke checks, evidence uploads, account maintenance actions, and admin/entity helpers.
   This version uses SB_* runtime config values and always sends both apikey and bearer token.
*/

'use strict';

(function () {
  const DEFAULT_FUNCTION_TIMEOUT_MS = 30000;
  const ANALYTICS_ENDPOINT = 'analytics-traffic';

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

  function getHostCompatibilityUrl(path = '') {
    return `${window.location.origin}/api/auth/${String(path).replace(/^\/+/, '')}`;
  }

  function getHostProxyUrl(path = '') {
    return `${window.location.origin}/api/${String(path).replace(/^\/+/, '')}`;
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


function getClientSessionKey() {
  try {
    const key = 'ywi_analytics_session_key_v1';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function getClientVisitorKey() {
  try {
    const key = 'ywi_analytics_visitor_key_v1';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function sendAnalyticsPayload(payload = {}, requireAuth = false) {
  const anonKey = getSupabaseAnonKey();
  const token = requireAuth ? await getAccessToken() : '';
  const headers = {
    'Content-Type': 'application/json',
    ...(anonKey ? { apikey: anonKey } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  try {
    await fetch(`${getFunctionsBaseUrl()}/${ANALYTICS_ENDPOINT}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_key: getClientSessionKey(),
        visitor_key: getClientVisitorKey(),
        page_path: location.pathname + location.hash,
        referrer: document.referrer || '',
        page_title: document.title || '',
        ...payload,
      }),
      keepalive: true
    });
  } catch {
    // swallow analytics failures
  }
}

async function trackTrafficEvent(payload = {}, requireAuth = false) {
  return sendAnalyticsPayload(payload, requireAuth);
}

async function trackMonitorEvent(payload = {}, requireAuth = false) {
  return sendAnalyticsPayload(payload, requireAuth);
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
          const err = buildError(
            response.status,
            'Received HTML instead of JSON. This usually means a stale route, bad deploy, or compatibility endpoint issue.',
            { message: rawText.slice(0, 180) }
          );
          if (!String(url).includes(ANALYTICS_ENDPOINT)) {
            trackMonitorEvent({
              event_name: 'api_error',
              monitor_scope: 'backend',
              severity: response.status >= 500 ? 'error' : 'warning',
              endpoint_path: pathOrUrl,
              http_status: response.status,
              title: 'Received HTML instead of JSON',
              message: err.message,
              details: { response_preview: rawText.slice(0, 180) }
            }, requireAuth).catch(() => {});
          }
          throw err;
        }

        const err = buildError(response.status, rawText, parsed);
        if (response.status === 400 && err.details?.length) {
          dispatchValidation(err.message, err.details);
        }
        if (!String(url).includes(ANALYTICS_ENDPOINT)) {
          trackMonitorEvent({
            event_name: 'api_error',
            monitor_scope: 'backend',
            severity: response.status >= 500 ? 'error' : 'warning',
            endpoint_path: pathOrUrl,
            http_status: response.status,
            error_code: parsed?.code || null,
            title: `API ${response.status}`,
            message: err.message,
            details: Array.isArray(err.details) && err.details.length ? { validation: err.details } : (parsed || {})
          }, requireAuth).catch(() => {});
        }
        throw err;
      }

      if (responseType === 'text') return rawText;
      return parsed;
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (!String(url).includes(ANALYTICS_ENDPOINT)) {
          trackMonitorEvent({
            event_name: 'api_error',
            monitor_scope: 'backend',
            severity: 'warning',
            endpoint_path: pathOrUrl,
            title: 'Request timed out',
            message: 'Request timed out.'
          }, requireAuth).catch(() => {});
        }
        throw new Error('Request timed out.');
      }
      if (String(err?.message || '').includes('Missing authorization header')) {
        const authErr = buildError(401, '{"code":401,"message":"Missing authorization header"}', {
          code: 401,
          message: 'Missing authorization header'
        });
        if (!String(url).includes(ANALYTICS_ENDPOINT)) {
          trackMonitorEvent({
            event_name: 'api_error',
            monitor_scope: 'auth',
            severity: 'warning',
            endpoint_path: pathOrUrl,
            http_status: 401,
            title: 'Missing authorization header',
            message: authErr.message
          }, false).catch(() => {});
        }
        throw authErr;
      }
      if (!String(url).includes(ANALYTICS_ENDPOINT)) {
        trackMonitorEvent({
          event_name: 'api_error',
          monitor_scope: 'backend',
          severity: 'warning',
          endpoint_path: pathOrUrl,
          title: 'Network or runtime failure',
          message: String(err?.message || err || 'Unknown request failure')
        }, requireAuth).catch(() => {});
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }



  function enrichUploadError(err) {
    const payload = err?.payload || {};
    const failureId = payload?.failure_id || err?.failure_id || null;
    if (failureId && !String(err.message || '').includes('Failure log')) {
      err.message = `${err.message} Failure log: ${failureId}`;
    }
    return err;
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
      throw enrichUploadError(buildError(response.status, rawText, payload));
    }
    return payload;
  }


  async function manageJobsEntity(payload = {}) {
    return jsonFetch('jobs-manage', {
      method: 'POST',
      body: payload,
      requireAuth: true
    });
  }

  async function uploadEquipmentEvidenceBatch(items = []) {
    const results = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item?.signoutId || !item?.file) continue;
      const formData = new FormData();
      formData.set('signout_id', String(item.signoutId));
      formData.set('stage', String(item.stage || 'checkout'));
      formData.set('evidence_kind', String(item.evidenceKind || 'photo'));
      if (item.signerRole) formData.set('signer_role', String(item.signerRole));
      if (item.caption) formData.set('caption', String(item.caption));
      formData.set('file', item.file);
      results.push(await uploadEquipmentEvidence(formData, true));
    }
    return results;
  }

  async function uploadJobCommentAttachment(formData, requireAuth = true) {
    const token = requireAuth ? await getAccessToken() : '';
    const anonKey = getSupabaseAnonKey();

    if (requireAuth && !token) {
      throw new Error('Missing authorization header');
    }

    const response = await fetch(`${getFunctionsBaseUrl()}/upload-job-comment-attachment`, {
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
      throw enrichUploadError(buildError(response.status, rawText, payload));
    }
    return payload;
  }

  async function uploadJobCommentAttachmentBatch(items = []) {
    const results = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item?.commentId || !item?.file) continue;
      const formData = new FormData();
      formData.set('job_comment_id', String(item.commentId));
      formData.set('attachment_kind', String(item.attachmentKind || 'photo'));
      if (item.caption) formData.set('caption', String(item.caption));
      formData.set('file', item.file);
      results.push(await uploadJobCommentAttachment(formData, true));
    }
    return results;
  }

  async function uploadRouteExecutionAttachment(formData, requireAuth = true) {
    const token = requireAuth ? await getAccessToken() : '';
    const anonKey = getSupabaseAnonKey();

    if (requireAuth && !token) {
      throw new Error('Missing authorization header');
    }

    const response = await fetch(`${getFunctionsBaseUrl()}/upload-route-execution-attachment`, {
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
      trackTrafficEvent({
        event_name: 'upload_failure',
        monitor_scope: 'storage',
        severity: response.status >= 500 ? 'error' : 'warning',
        endpoint_path: 'upload-route-execution-attachment',
        http_status: response.status,
        linked_failure_id: payload?.failure_id || null,
        title: 'Route execution upload failed',
        message: payload?.error || rawText || `HTTP ${response.status}`
      }, requireAuth).catch(() => {});
      throw enrichUploadError(buildError(response.status, rawText, payload));
    }

    trackTrafficEvent({
      event_name: 'upload_success',
      route_name: 'admin',
      endpoint_path: 'upload-route-execution-attachment',
      details: { record_id: payload?.record?.id || null }
    }, requireAuth).catch(() => {});
    return payload;
  }

  async function uploadEmployeeTimePhoto(formData, requireAuth = true) {
    const token = requireAuth ? await getAccessToken() : '';
    const anonKey = getSupabaseAnonKey();

    if (requireAuth && !token) {
      throw new Error('Missing authorization header');
    }

    const response = await fetch(`${getFunctionsBaseUrl()}/upload-employee-time-photo`, {
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
      trackTrafficEvent({
        event_name: 'upload_failure',
        monitor_scope: 'storage',
        severity: response.status >= 500 ? 'error' : 'warning',
        endpoint_path: 'upload-employee-time-photo',
        http_status: response.status,
        linked_failure_id: payload?.failure_id || null,
        title: 'Employee time photo upload failed',
        message: payload?.error || rawText || `HTTP ${response.status}`
      }, requireAuth).catch(() => {});
      throw enrichUploadError(buildError(response.status, rawText, payload));
    }

    trackTrafficEvent({
      event_name: 'upload_success',
      route_name: 'profile',
      endpoint_path: 'upload-employee-time-photo',
      details: { record_id: payload?.record?.id || null }
    }, requireAuth).catch(() => {});
    return payload;
  }


  async function uploadHsePacketProof(formData, requireAuth = true) {
    const token = requireAuth ? await getAccessToken() : '';
    const anonKey = getSupabaseAnonKey();

    if (requireAuth && !token) {
      throw new Error('Missing authorization header');
    }

    const response = await fetch(`${getFunctionsBaseUrl()}/upload-hse-packet-proof`, {
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
      trackTrafficEvent({
        event_name: 'upload_failure',
        monitor_scope: 'storage',
        severity: response.status >= 500 ? 'error' : 'warning',
        endpoint_path: 'upload-hse-packet-proof',
        http_status: response.status,
        linked_failure_id: payload?.failure_id || null,
        title: 'HSE proof upload failed',
        message: payload?.error || rawText || `HTTP ${response.status}`
      }, requireAuth).catch(() => {});
      throw enrichUploadError(buildError(response.status, rawText, payload));
    }

    trackTrafficEvent({
      event_name: 'upload_success',
      route_name: 'admin',
      endpoint_path: 'upload-hse-packet-proof',
      details: { record_id: payload?.record?.id || null }
    }, requireAuth).catch(() => {});
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
    try {
      return await jsonFetch('admin-manage', {
        method: 'POST',
        body: payload,
        requireAuth: true,
        timeoutMs: 15000
      });
    } catch (error) {
      const message = String(error?.message || '');
      const shouldFallback = error?.status === 404
        || error?.status === 0
        || error?.status === 502
        || error?.status === 503
        || /Failed to fetch|CORS|ERR_FAILED|Request timed out|Received HTML instead of JSON|Network or runtime failure/i.test(message);
      if (!shouldFallback) throw error;
      return jsonFetch(getHostCompatibilityUrl('admin-manage'), {
        method: 'POST',
        body: payload,
        requireAuth: true,
        timeoutMs: 20000
      });
    }
  }

  async function accountRecoveryAction(payload = {}, requireAuth = true) {
    try {
      return await jsonFetch('account-maintenance', {
        method: 'POST',
        body: payload,
        requireAuth
      });
    } catch (error) {
      if (error?.status !== 404) throw error;
      return jsonFetch(getHostCompatibilityUrl('account-maintenance'), {
        method: 'POST',
        body: payload,
        requireAuth
      });
    }
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

  async function fetchSessionHealth() {
    return accountRecoveryAction({ action: 'session_health' }, true);
  }

  async function fetchMyTimeClockContext() {
    return accountRecoveryAction({ action: 'list_my_time_clock_context' }, true);
  }

  async function employeeTimeClockAction(action, payload = {}) {
    return accountRecoveryAction({ action, ...payload }, true);
  }

  async function fetchLogData(payload = {}) {
    try {
      return await jsonFetch('review-list', {
        method: 'POST',
        body: payload,
        requireAuth: true
      });
    } catch (error) {
      const message = String(error?.message || '');
      const shouldFallback = error?.status === 404 || error?.status === 0 || /Failed to fetch|CORS|ERR_FAILED/i.test(message);
      if (!shouldFallback) throw error;
      return jsonFetch(getHostProxyUrl('logbook/review-list'), {
        method: 'POST',
        body: payload,
        requireAuth: true
      });
    }
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

      try {
        const refResp = await fetchReferenceData({ scope: 'lists' });
        checks.push({
          scope: 'authenticated-reference-data',
          ok: !!refResp,
          message: 'Authenticated reference-data probe completed.'
        });
      } catch (err) {
        checks.push({
          scope: 'authenticated-reference-data',
          ok: false,
          message: err?.message || 'Authenticated reference-data probe failed.'
        });
      }

      try {
        const sessionHealth = await fetchSessionHealth();
        const warnings = Array.isArray(sessionHealth?.warnings) ? sessionHealth.warnings : [];
        checks.push({
          scope: 'authenticated-session-health',
          ok: !!sessionHealth?.ok && warnings.length === 0,
          message: warnings.length
            ? `Session health returned ${warnings.length} warning(s).`
            : 'Authenticated session-health probe completed.',
          details: warnings
        });
      } catch (err) {
        checks.push({
          scope: 'authenticated-session-health',
          ok: false,
          message: err?.message || 'Authenticated session-health probe failed.'
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
    uploadEquipmentEvidenceBatch,
    uploadJobCommentAttachment,
    uploadJobCommentAttachmentBatch,
    uploadRouteExecutionAttachment,
    uploadEmployeeTimePhoto,
    uploadHsePacketProof,
    trackTrafficEvent,
    trackMonitorEvent,
    manageJobsEntity,
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
    fetchSessionHealth,
    fetchMyTimeClockContext,
    employeeTimeClockAction,
    fetchLogData,
    fetchSubmissionDetail,
    saveSubmissionReview,
    runSmokeCheck,
    storagePreviewUrl
  };
})();
