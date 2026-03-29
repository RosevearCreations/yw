/* File: js/api.js
   Brief description: Shared API and upload helper module for YWI HSE.
   Centralizes Edge Function calls, authenticated fetch helpers, connection diagnostics,
   and image upload helpers so frontend modules can stay smaller.
*/

'use strict';

(function () {
  const DEFAULT_SB_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';

  function getRuntimeConfig() {
    return window.YWI_RUNTIME_CONFIG || window.__YWI_RUNTIME_CONFIG || {};
  }

  function getSupabaseUrl() {
    return String(getRuntimeConfig().SUPABASE_URL || window.YWI_BOOT?.state?.supabaseUrl || DEFAULT_SB_URL).trim() || DEFAULT_SB_URL;
  }

  function getEndpoints() {
    const SB_URL = getSupabaseUrl();
    return {
      FUNCTION_URL: `${SB_URL}/functions/v1/resend-email`,
      LIST_URL: `${SB_URL}/functions/v1/clever-endpoint`,
      REVIEW_URL: `${SB_URL}/functions/v1/review-submission`,
      DIRECTORY_URL: `${SB_URL}/functions/v1/admin-directory`,
      MANAGE_URL: `${SB_URL}/functions/v1/admin-manage`,
      DETAIL_URL: `${SB_URL}/functions/v1/submission-detail`,
      SELECTORS_URL: `${SB_URL}/functions/v1/admin-selectors`,
      REFERENCE_URL: `${SB_URL}/functions/v1/reference-data`,
      NOTIFY_URL: `${SB_URL}/functions/v1/notify-admins`,
      JOBS_DIRECTORY_URL: `${SB_URL}/functions/v1/jobs-directory`,
      JOBS_MANAGE_URL: `${SB_URL}/functions/v1/jobs-manage`,
      ACCOUNT_URL: `${SB_URL}/functions/v1/account-maintenance`,
      BOOTSTRAP_ADMIN_URL: `${SB_URL}/functions/v1/bootstrap-admin`,
      UPLOAD_URL: `${SB_URL}/functions/v1/upload-image`,
      UPLOAD_EQUIPMENT_EVIDENCE_URL: `${SB_URL}/functions/v1/upload-equipment-evidence`,
      STORAGE_BUCKET: 'submission-images',
      EQUIPMENT_EVIDENCE_BUCKET: 'equipment-evidence'
    };
  }

  function boot() { return window.YWI_BOOT || null; }
  function auth() { return window.YWI_AUTH || null; }
  function sb() { return window.YWI_SB || window._sb || null; }

  function getAnonKey() {
    try {
      return String(
        getRuntimeConfig().SUPABASE_ANON_KEY ||
        window.SUPABASE_ANON_KEY ||
        window.__SUPABASE_ANON_KEY ||
        localStorage.getItem('ywi_supabase_anon_key') ||
        ''
      ).trim();
    } catch {
      return String(getRuntimeConfig().SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY || '').trim();
    }
  }

  function publicAuthHeaders() {
    const anonKey = getAnonKey();
    if (!anonKey) return {};
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    };
  }

  async function authHeader() {
    const b = boot();
    if (b?.authHeader) {
      const headers = await b.authHeader();
      if (headers && Object.keys(headers).length) return headers;
    }
    return {};
  }

  function ensureOnline(message) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(message || 'Offline. Reconnect to the internet or your Supabase server, then try again.');
    }
  }

  function looksLikeHtml(text) {
    return /^\s*</.test(String(text || ''));
  }

  function summarizeErrorBody(text) {
    const body = String(text || '').trim();
    if (!body) return 'Empty response body.';
    if (looksLikeHtml(body)) return 'HTML response returned instead of JSON. This usually means an old cached route or missing endpoint is being hit.';
    return body;
  }

  async function jsonFetch(url, { method = 'POST', headers = {}, body = null, allowPublicAuthFallback = false } = {}) {
    ensureOnline('Offline. Reconnect to the internet or your Supabase server, then try again.');
    let authHeaders = await authHeader();
    if (allowPublicAuthFallback && !authHeaders?.Authorization && !authHeaders?.authorization) {
      authHeaders = { ...publicAuthHeaders(), ...authHeaders };
    }

    let res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    });

    if (res.status === 401 && auth()?.refresh && authHeaders?.Authorization) {
      try { await auth().refresh(); } catch {}
      authHeaders = await authHeader();
      if (allowPublicAuthFallback && !authHeaders?.Authorization && !authHeaders?.authorization) {
        authHeaders = { ...publicAuthHeaders(), ...authHeaders };
      }
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
      });
    }

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${summarizeErrorBody(text)}`);
    if (!String(text || '').trim()) return {};
    if (looksLikeHtml(text)) return { ok: false, html_response: true, message: summarizeErrorBody(text) };
    try { return JSON.parse(text); } catch { return text; }
  }

  async function uploadFormDataFetch(url, formData) {
    ensureOnline('Offline. Image uploads require a live connection.');
    let authHeaders = await authHeader();
    let res = await fetch(url, { method: 'POST', headers: { ...authHeaders }, body: formData });

    if (res.status === 401 && auth()?.refresh) {
      try { await auth().refresh(); } catch {}
      authHeaders = await authHeader();
      res = await fetch(url, { method: 'POST', headers: { ...authHeaders }, body: formData });
    }

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  async function sendToFunction(formType, payload) {
    return jsonFetch(getEndpoints().FUNCTION_URL, { body: { formType, payload } });
  }
  async function fetchLogData(payload) { return jsonFetch(getEndpoints().LIST_URL, { body: payload }); }
  async function saveSubmissionReview(payload) { return jsonFetch(getEndpoints().REVIEW_URL, { body: payload }); }
  async function loadAdminDirectory(payload) { return jsonFetch(getEndpoints().DIRECTORY_URL, { body: payload }); }
  async function manageAdminEntity(payload) { return jsonFetch(getEndpoints().MANAGE_URL, { body: payload }); }
  async function fetchSubmissionDetail(submissionId) { return jsonFetch(getEndpoints().DETAIL_URL, { body: { submission_id: submissionId } }); }
  async function loadAdminSelectors(payload = {}) { return jsonFetch(getEndpoints().SELECTORS_URL, { body: payload }); }
  async function fetchReferenceData(payload = {}) { return jsonFetch(getEndpoints().REFERENCE_URL, { body: payload }); }
  async function notifyAdmins(payload = {}) { return jsonFetch(getEndpoints().NOTIFY_URL, { body: payload }); }

  async function fetchProfileScope(scope = 'self', extra = {}) {
    return jsonFetch(getEndpoints().DIRECTORY_URL, { body: { scope, ...extra } });
  }

  async function fetchJobsDirectory(payload = {}) {
    return jsonFetch(getEndpoints().JOBS_DIRECTORY_URL, { body: payload });
  }

  async function manageJobsEntity(payload = {}) {
    return jsonFetch(getEndpoints().JOBS_MANAGE_URL, { body: payload });
  }

  async function requestPhoneVerification(payload = {}) {
    return jsonFetch(getEndpoints().ACCOUNT_URL, { body: { action: 'request_phone_verification', ...payload } });
  }

  async function sendPhoneVerificationCode(payload = {}) {
    return jsonFetch(getEndpoints().ACCOUNT_URL, { body: { action: 'send_phone_verification_code', ...payload } });
  }

  async function verifyPhoneCode(payload = {}) {
    return jsonFetch(getEndpoints().ACCOUNT_URL, { body: { action: 'verify_phone_code', ...payload } });
  }

  async function retryPhoneVerificationCode(payload = {}) {
    return jsonFetch(getEndpoints().ACCOUNT_URL, { body: { action: 'retry_phone_verification_code', ...payload } });
  }

  async function accountRecoveryAction(payload = {}) {
    return jsonFetch(getEndpoints().ACCOUNT_URL, { body: payload, allowPublicAuthFallback: true });
  }

  async function uploadEquipmentEvidenceAsset({ signoutId, stage = 'checkout', evidenceKind = 'photo', signerRole = '', caption = '', file, equipmentItemId = '', jobId = '' } = {}) {
    const formData = new FormData();
    formData.append('signout_id', String(signoutId || ''));
    formData.append('stage', String(stage || 'checkout'));
    formData.append('evidence_kind', String(evidenceKind || 'photo'));
    if (signerRole) formData.append('signer_role', String(signerRole));
    if (caption) formData.append('caption', String(caption));
    if (equipmentItemId) formData.append('equipment_item_id', String(equipmentItemId));
    if (jobId) formData.append('job_id', String(jobId));
    formData.append('file', file);
    return uploadFormDataFetch(getEndpoints().UPLOAD_EQUIPMENT_EVIDENCE_URL, formData);
  }

  async function uploadEquipmentEvidenceBatch(items = []) {
    const results = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item?.file || !item?.signoutId) continue;
      results.push(await uploadEquipmentEvidenceAsset(item));
    }
    return results;
  }

  async function saveMyProfile(payload) {
    return manageAdminEntity({ entity: 'profile', action: 'self_update', ...payload });
  }

  async function bootstrapAdmin(payload = {}) {
    return jsonFetch(getEndpoints().BOOTSTRAP_ADMIN_URL, { body: payload });
  }

  async function uploadImageViaFunction(submissionId, image) {
    const formData = new FormData();
    formData.append('submission_id', String(submissionId));
    formData.append('image_type', image.image_type || 'general');
    formData.append('caption', image.caption || '');
    formData.append('file', image.file);
    return uploadFormDataFetch(getEndpoints().UPLOAD_URL, formData);
  }

  async function uploadImagesForSubmission(images, submissionId) {
    for (const image of images) await uploadImageViaFunction(submissionId, image);
  }

  function storagePreviewUrl(filePath) {
    const client = sb();
    if (!client || !filePath) return '';
    const { data } = client.storage.from(getEndpoints().STORAGE_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || '';
  }

  async function diagnoseConnections() {
    const result = {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      supabase_url: getSupabaseUrl(),
      has_client: !!sb(),
      boot_ready: !!boot()?.state?.initialized,
      auth_ready: !!auth(),
      checks: []
    };
    if (!result.online) {
      result.checks.push({ scope: 'network', ok: false, message: 'Browser is offline.' });
      return result;
    }
    try {
      const response = await fetch(getSupabaseUrl() + '/auth/v1/health', { method: 'GET' });
      result.checks.push({ scope: 'auth-health', ok: response.ok, status: response.status, message: response.ok ? 'Supabase auth endpoint reachable.' : 'Supabase auth endpoint returned an error.' });
    } catch (err) {
      result.checks.push({ scope: 'auth-health', ok: false, message: err?.message || 'Failed to reach Supabase auth endpoint.' });
    }
    return result;
  }

  window.YWIAPI = {
    get SB_URL() { return getSupabaseUrl(); },
    get ENDPOINTS() { return getEndpoints(); },
    authHeader,
    jsonFetch,
    uploadFormDataFetch,
    sendToFunction,
    fetchLogData,
    saveSubmissionReview,
    loadAdminDirectory,
    manageAdminEntity,
    fetchSubmissionDetail,
    loadAdminSelectors,
    fetchReferenceData,
    notifyAdmins,
    fetchProfileScope,
    fetchJobsDirectory,
    manageJobsEntity,
    requestPhoneVerification,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    retryPhoneVerificationCode,
    accountRecoveryAction,
    uploadEquipmentEvidenceAsset,
    uploadEquipmentEvidenceBatch,
    saveMyProfile,
    bootstrapAdmin,
    uploadImageViaFunction,
    uploadImagesForSubmission,
    storagePreviewUrl,
    diagnoseConnections
  };
})();
