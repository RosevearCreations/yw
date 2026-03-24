/* File: js/api.js
   Brief description: Shared API and upload helper module for YWI HSE.
   Centralizes Edge Function calls, authenticated fetch helpers, scoped people/profile loading,
   and image upload helpers so frontend modules can stay smaller.
*/

'use strict';

(function () {
  const SB_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';

  const ENDPOINTS = {
    FUNCTION_URL:  `${SB_URL}/functions/v1/resend-email`,
    LIST_URL:      `${SB_URL}/functions/v1/clever-endpoint`,
    REVIEW_URL:    `${SB_URL}/functions/v1/review-submission`,
    DIRECTORY_URL: `${SB_URL}/functions/v1/admin-directory`,
    MANAGE_URL:    `${SB_URL}/functions/v1/admin-manage`,
    DETAIL_URL:    `${SB_URL}/functions/v1/submission-detail`,
    SELECTORS_URL: `${SB_URL}/functions/v1/admin-selectors`,
    REFERENCE_URL: `${SB_URL}/functions/v1/reference-data`,
    NOTIFY_URL: `${SB_URL}/functions/v1/notify-admins`,
    JOBS_DIRECTORY_URL: `${SB_URL}/functions/v1/jobs-directory`,
    JOBS_MANAGE_URL: `${SB_URL}/functions/v1/jobs-manage`,
    ACCOUNT_URL: `${SB_URL}/functions/v1/account-maintenance`,
    UPLOAD_URL:    `${SB_URL}/functions/v1/upload-image`,
    STORAGE_BUCKET: 'submission-images'
  };

  function boot() { return window.YWI_BOOT || null; }
  function auth() { return window.YWI_AUTH || null; }
  function sb() { return window.YWI_SB || window._sb || null; }

  async function authHeader() {
    const b = boot();
    if (b?.authHeader) return b.authHeader();
    return {};
  }

  async function jsonFetch(url, { method = 'POST', headers = {}, body = null } = {}) {
    let authHeaders = await authHeader();

    let res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    });

    if (res.status === 401 && auth()?.refresh) {
      try { await auth().refresh(); } catch {}
      authHeaders = await authHeader();
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
      });
    }

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  async function uploadFormDataFetch(url, formData) {
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
    return jsonFetch(ENDPOINTS.FUNCTION_URL, { body: { formType, payload } });
  }
  async function fetchLogData(payload) { return jsonFetch(ENDPOINTS.LIST_URL, { body: payload }); }
  async function saveSubmissionReview(payload) { return jsonFetch(ENDPOINTS.REVIEW_URL, { body: payload }); }
  async function loadAdminDirectory(payload) { return jsonFetch(ENDPOINTS.DIRECTORY_URL, { body: payload }); }
  async function manageAdminEntity(payload) { return jsonFetch(ENDPOINTS.MANAGE_URL, { body: payload }); }
  async function fetchSubmissionDetail(submissionId) { return jsonFetch(ENDPOINTS.DETAIL_URL, { body: { submission_id: submissionId } }); }
  async function loadAdminSelectors(payload = {}) { return jsonFetch(ENDPOINTS.SELECTORS_URL, { body: payload }); }
  async function fetchReferenceData(payload = {}) { return jsonFetch(ENDPOINTS.REFERENCE_URL, { body: payload }); }
  async function notifyAdmins(payload = {}) { return jsonFetch(ENDPOINTS.NOTIFY_URL, { body: payload }); }

  async function fetchProfileScope(scope = 'self', extra = {}) {
    return jsonFetch(ENDPOINTS.DIRECTORY_URL, { body: { scope, ...extra } });
  }

  async function fetchJobsDirectory(payload = {}) {
    return jsonFetch(ENDPOINTS.JOBS_DIRECTORY_URL, { body: payload });
  }

  async function manageJobsEntity(payload = {}) {
    return jsonFetch(ENDPOINTS.JOBS_MANAGE_URL, { body: payload });
  }

  async function requestPhoneVerification(payload = {}) {
    return jsonFetch(ENDPOINTS.ACCOUNT_URL, { body: { action: 'request_phone_verification', ...payload } });
  }

  async function saveMyProfile(payload) {
    return manageAdminEntity({ entity: 'profile', action: 'self_update', ...payload });
  }

  async function uploadImageViaFunction(submissionId, image) {
    const formData = new FormData();
    formData.append('submission_id', String(submissionId));
    formData.append('image_type', image.image_type || 'general');
    formData.append('caption', image.caption || '');
    formData.append('file', image.file);
    return uploadFormDataFetch(ENDPOINTS.UPLOAD_URL, formData);
  }

  async function uploadImagesForSubmission(images, submissionId) {
    for (const image of images) await uploadImageViaFunction(submissionId, image);
  }

  function storagePreviewUrl(filePath) {
    const client = sb();
    if (!client || !filePath) return '';
    const { data } = client.storage.from(ENDPOINTS.STORAGE_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || '';
  }

  window.YWIAPI = {
    SB_URL,
    ENDPOINTS,
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
    saveMyProfile,
    uploadImageViaFunction,
    uploadImagesForSubmission,
    storagePreviewUrl
  };
})();
