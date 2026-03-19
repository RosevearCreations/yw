'use strict';

/* =========================================================
   app.js
   Main application controller

   Purpose:
   - use shared bootstrap/auth layer
   - keep forms and uploads working
   - hand admin dashboard UI to js/admin-ui.js
   - hand logbook/detail/review UI to js/logbook-ui.js
========================================================= */

/* =========================
   CONFIG / ENDPOINTS
========================= */
const SB_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';

const FUNCTION_URL   = `${SB_URL}/functions/v1/resend-email`;
const LIST_URL       = `${SB_URL}/functions/v1/clever-endpoint`;
const REVIEW_URL     = `${SB_URL}/functions/v1/review-submission`;
const DIRECTORY_URL  = `${SB_URL}/functions/v1/admin-directory`;
const MANAGE_URL     = `${SB_URL}/functions/v1/admin-manage`;
const DETAIL_URL     = `${SB_URL}/functions/v1/submission-detail`;
const SELECTORS_URL  = `${SB_URL}/functions/v1/admin-selectors`;
const UPLOAD_URL     = `${SB_URL}/functions/v1/upload-image`;
const STORAGE_BUCKET = 'submission-images';

const OUTBOX_KEY = 'ywi_outbox_v1';

/* =========================
   DOM HELPERS
========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* =========================
   APP DOM
========================= */
const whoami = $('#whoami');
const reviewPanel = $('#reviewPanel');

const appState = {
  currentUser: null,
  currentRole: 'worker',
  currentProfileActive: false,
  isAuthenticated: false,
  adminLocked: true,
  bootReady: false
};

let adminUI = null;
let logbookUI = null;

/* =========================
   BASIC HELPERS
========================= */
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ensureTBody(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return null;
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }
  return tbody;
}

function getOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
}

function setOutbox(list) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

function escHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bytesLabel(size) {
  const n = Number(size || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function setNotice(el, text) {
  if (!el) return;
  if (text) {
    el.style.display = 'block';
    el.textContent = text;
  } else {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function boot() {
  return window.YWI_BOOT || null;
}

function auth() {
  return window.YWI_AUTH || null;
}

function sb() {
  return window.YWI_SB || window._sb || null;
}

function storagePreviewUrl(filePath) {
  const client = sb();
  if (!client || !filePath) return '';
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/* =========================
   AUTH / ROLE VISIBILITY
========================= */
function applyRoleVisibility() {
  const role = appState.currentRole || 'worker';
  const canReview = ['site_leader', 'supervisor', 'hse', 'admin', 'job_admin', 'onsite_admin'].includes(role);

  document.body.dataset.userRole = role || 'worker';

  if (reviewPanel) {
    reviewPanel.style.display = canReview ? '' : 'none';
  }

  if (adminUI?.applyRoleAccess) {
    adminUI.applyRoleAccess();
    appState.adminLocked = !!adminUI.state?.locked;
  } else {
    appState.adminLocked = role !== 'admin';
  }

  if (logbookUI?.applyRoleVisibility) {
    logbookUI.applyRoleVisibility();
  }
}

function syncAuthStateFromBoot(detail = {}) {
  const state = detail.state || auth()?.getState?.() || null;
  const profile = state?.profile || null;
  const user = state?.user || null;

  appState.currentUser = profile || user || null;
  appState.currentRole = state?.role || profile?.role || 'worker';
  appState.currentProfileActive = profile?.is_active !== false && !!state?.isAuthenticated;
  appState.isAuthenticated = !!state?.isAuthenticated;

  if (whoami) {
    const email = profile?.email || user?.email || '';
    const roleLabel = state?.roleLabel || appState.currentRole || '';
    whoami.textContent = email ? `${email} (${roleLabel})` : roleLabel;
  }

  applyRoleVisibility();
}

/* =========================
   FETCH / AUTH HEADERS
========================= */
async function authHeader() {
  const b = boot();
  if (b?.authHeader) {
    return b.authHeader();
  }
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
    try {
      await auth().refresh();
    } catch {}
    authHeaders = await authHeader();
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error('HTTP error', res.status, text);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function uploadFormDataFetch(url, formData) {
  let authHeaders = await authHeader();

  let res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData
  });

  if (res.status === 401 && auth()?.refresh) {
    try {
      await auth().refresh();
    } catch {}
    authHeaders = await authHeader();
    res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders },
      body: formData
    });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error('HTTP error', res.status, text);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function sendToFunction(formType, payload) {
  return jsonFetch(FUNCTION_URL, { body: { formType, payload } });
}

async function fetchLogData(payload) {
  return jsonFetch(LIST_URL, { body: payload });
}

async function saveSubmissionReview(payload) {
  return jsonFetch(REVIEW_URL, { body: payload });
}

async function loadAdminDirectory(payload) {
  return jsonFetch(DIRECTORY_URL, { body: payload });
}

async function manageAdminEntity(payload) {
  return jsonFetch(MANAGE_URL, { body: payload });
}

async function fetchSubmissionDetail(submissionId) {
  return jsonFetch(DETAIL_URL, { body: { submission_id: submissionId } });
}

async function loadAdminSelectors(payload) {
  return jsonFetch(SELECTORS_URL, { body: payload });
}

async function uploadImageViaFunction(submissionId, image) {
  const formData = new FormData();
  formData.append('submission_id', String(submissionId));
  formData.append('image_type', image.image_type || 'general');
  formData.append('caption', image.caption || '');
  formData.append('file', image.file);
  return uploadFormDataFetch(UPLOAD_URL, formData);
}

/* =========================
   HASH NAV
========================= */
function route() {
  const hash = location.hash || '#toolbox';

  $$('nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });

  $$('main.container > section.card').forEach(sec => {
    sec.classList.toggle('active', `#${sec.id}` === hash);
  });
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);

/* =========================
   DATE FALLBACKS
========================= */
function applyDateFallback() {
  [
    '#tb_date',
    '#ppe_date',
    '#fa_date',
    '#insp_date',
    '#dr_date',
    '#lg_from',
    '#lg_to'
  ].forEach(sel => {
    const el = $(sel);
    if (el && !el.value) el.value = todayISO();
  });
}

/* =========================
   OUTBOX RETRY
========================= */
async function retryOutbox() {
  if (!appState.isAuthenticated) {
    alert('Please sign in first.');
    return;
  }

  const outbox = getOutbox();
  if (!outbox.length) {
    alert('Outbox is empty.');
    return;
  }

  const remaining = [];
  for (const item of outbox) {
    try {
      const resp = await sendToFunction(item.formType, item.payload);
      const submissionId = resp?.id;

      if (submissionId && Array.isArray(item.localImages) && item.localImages.length) {
        await uploadImagesForSubmission(item.localImages, submissionId);
      }
    } catch {
      remaining.push(item);
    }
  }

  setOutbox(remaining);
  alert(remaining.length ? `Retried. ${remaining.length} item(s) remain.` : 'Outbox sent successfully.');
}

$$('[data-role="retry-outbox"]').forEach(btn => {
  btn.addEventListener('click', retryOutbox);
});

/* =========================
   IMAGE HELPERS
========================= */
function clearImageState(state, body, fileInput, captionInput) {
  state.splice(0, state.length);
  if (body) body.innerHTML = '';
  if (fileInput) fileInput.value = '';
  if (captionInput) captionInput.value = '';
}

function renderImageRows(state, body) {
  if (!body) return;
  body.innerHTML = '';

  state.forEach((img, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(img.file.name || '')}</td>
      <td>${escHtml(img.image_type || '')}</td>
      <td>${escHtml(bytesLabel(img.file.size || 0))}</td>
      <td>${escHtml(img.caption || '')}</td>
      <td><button type="button" data-remove-index="${idx}">Remove</button></td>
    `;
    body.appendChild(tr);
  });
}

function wireImageRemover(state, body) {
  body?.addEventListener('click', (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest('button[data-remove-index]') : null;
    if (!btn) return;
    const idx = Number(btn.dataset.removeIndex);
    if (Number.isNaN(idx)) return;
    state.splice(idx, 1);
    renderImageRows(state, body);
  });
}

async function uploadImagesForSubmission(state, submissionId) {
  for (const image of state) {
    await uploadImageViaFunction(submissionId, image);
  }
}

/* =========================
   FORM E — TOOLBOX TALK
========================= */
const toolboxForm = $('#toolboxForm');
const tbDate = $('#tb_date');
if (tbDate) tbDate.value = todayISO();

const tbAttendeesBody = ensureTBody('tbAttendees');
const tbAddRowBtn = $('#tbAddRowBtn');

const tbImageFiles = $('#tb_image_files');
const tbImageType = $('#tb_image_type');
const tbImageCaption = $('#tb_image_caption');
const tbImageAddBtn = $('#tb_image_add');
const tbImageBody = $('#tb_images_table')?.querySelector('tbody') || null;
const toolboxImageState = [];
wireImageRemover(toolboxImageState, tbImageBody);

function addAttendeeRow() {
  if (!tbAttendeesBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="att-name" placeholder="Full name" required></td>
    <td>
      <select class="att-role">
        <option value="worker">Worker</option>
        <option value="staff">Staff</option>
        <option value="site_leader">Site Leader</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><input type="text" class="att-company" placeholder="Company"></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  tbAttendeesBody.appendChild(tr);
}

function seedToolbox() {
  if (tbAttendeesBody && tbAttendeesBody.children.length === 0) {
    addAttendeeRow();
    addAttendeeRow();
  }
}

tbAddRowBtn?.addEventListener('click', addAttendeeRow);

tbAttendeesBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

tbImageAddBtn?.addEventListener('click', () => {
  const files = Array.from(tbImageFiles?.files || []);
  if (!files.length) {
    alert('Choose at least one image file.');
    return;
  }

  files.forEach(file => {
    toolboxImageState.push({
      file,
      image_type: tbImageType?.value || 'general',
      caption: tbImageCaption?.value?.trim?.() || ''
    });
  });

  renderImageRows(toolboxImageState, tbImageBody);
  if (tbImageFiles) tbImageFiles.value = '';
  if (tbImageCaption) tbImageCaption.value = '';
});

toolboxForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#tb_site')?.value?.trim?.() || '';
  const date = $('#tb_date')?.value || '';
  const leader = $('#tb_leader')?.value?.trim?.() || '';
  const topic = $('#tb_topic')?.value?.trim?.() || '';

  if (!site || !date || !leader) {
    alert('Please fill Site, Date, and Submitted By.');
    return;
  }

  const rows = tbAttendeesBody ? Array.from(tbAttendeesBody.querySelectorAll('tr')) : [];
  const attendees = rows.map(tr => {
    const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.att-role')?.value || 'worker';
    const company = tr.querySelector('.att-company')?.value?.trim?.() || '';
    return { name, role_on_site: role, company };
  }).filter(r => r.name);

  const payload = {
    site,
    date,
    submitted_by: leader,
    topic_notes: topic,
    attendees
  };

  try {
    const resp = await sendToFunction('E', payload);
    const submissionId = resp?.id;

    if (submissionId && toolboxImageState.length) {
      await uploadImagesForSubmission(toolboxImageState, submissionId);
    }

    alert('Toolbox talk submitted.');
    toolboxForm.reset();
    if (tbDate) tbDate.value = todayISO();
    if (tbAttendeesBody) {
      tbAttendeesBody.innerHTML = '';
      seedToolbox();
    }
    clearImageState(toolboxImageState, tbImageBody, tbImageFiles, tbImageCaption);
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({
      ts: Date.now(),
      formType: 'E',
      payload,
      localImages: [...toolboxImageState]
    });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM D — PPE CHECK
========================= */
const ppeForm = $('#ppeForm');
const ppeDate = $('#ppe_date');
if (ppeDate) ppeDate.value = todayISO();

const ppeTableBody = ensureTBody('ppeTable');
const ppeAddRowBtn = $('#ppeAddRowBtn');

function addPPERow() {
  if (!ppeTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="ppe-name" placeholder="Full name" required></td>
    <td>
      <select class="ppe-role">
        <option value="worker">Worker</option>
        <option value="staff">Staff</option>
        <option value="site_leader">Site Leader</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td style="text-align:center"><input type="checkbox" class="ppe-shoes" checked></td>
    <td style="text-align:center"><input type="checkbox" class="ppe-vest" checked></td>
    <td style="text-align:center"><input type="checkbox" class="ppe-plugs" checked></td>
    <td style="text-align:center"><input type="checkbox" class="ppe-goggles" checked></td>
    <td style="text-align:center"><input type="checkbox" class="ppe-muffs" checked></td>
    <td style="text-align:center"><input type="checkbox" class="ppe-gloves" checked></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  ppeTableBody.appendChild(tr);
}

function seedPPE() {
  if (ppeTableBody && ppeTableBody.children.length === 0) {
    addPPERow();
    addPPERow();
  }
}

ppeAddRowBtn?.addEventListener('click', addPPERow);

ppeTableBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

ppeForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#ppe_site')?.value?.trim?.() || '';
  const date = $('#ppe_date')?.value || '';
  const checker = $('#ppe_checker')?.value?.trim?.() || '';

  if (!site || !date || !checker) {
    alert('Please fill Site, Date, and Checked By.');
    return;
  }

  const rows = ppeTableBody ? Array.from(ppeTableBody.querySelectorAll('tr')) : [];
  const roster = rows.map(tr => ({
    name: tr.querySelector('.ppe-name')?.value?.trim?.() || '',
    role_on_site: tr.querySelector('.ppe-role')?.value || 'worker',
    items: {
      shoes: !!tr.querySelector('.ppe-shoes')?.checked,
      vest: !!tr.querySelector('.ppe-vest')?.checked,
      plugs: !!tr.querySelector('.ppe-plugs')?.checked,
      goggles: !!tr.querySelector('.ppe-goggles')?.checked,
      muffs: !!tr.querySelector('.ppe-muffs')?.checked,
      gloves: !!tr.querySelector('.ppe-gloves')?.checked
    }
  })).filter(r => r.name);

  const nonCompliant = roster.some(r =>
    !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves
  );

  const payload = { site, date, checked_by: checker, roster, nonCompliant };

  try {
    await sendToFunction('D', payload);
    alert('PPE check submitted.');
    ppeForm.reset();
    if (ppeDate) ppeDate.value = todayISO();
    if (ppeTableBody) {
      ppeTableBody.innerHTML = '';
      seedPPE();
    }
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({ ts: Date.now(), formType: 'D', payload });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM B — FIRST AID
========================= */
const faForm = $('#faForm');
const faDate = $('#fa_date');
if (faDate) faDate.value = todayISO();

const faTableBody = ensureTBody('faTable');
const faAddRowBtn = $('#faAddRowBtn');

function addItemRow() {
  if (!faTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="fa-name" list="fa-catalog" placeholder="Select or type…" required></td>
    <td><input type="number" class="fa-qty" min="0" value="0"></td>
    <td><input type="number" class="fa-min" min="0" value="0"></td>
    <td><input type="date" class="fa-exp"></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  faTableBody.appendChild(tr);
}

function seedFirstAid() {
  if (faTableBody && faTableBody.children.length === 0) {
    addItemRow();
    addItemRow();
  }
}

faAddRowBtn?.addEventListener('click', addItemRow);

faTableBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

function within30Days(iso) {
  if (!iso) return false;
  const now = new Date();
  const d = new Date(iso);
  return ((d.getTime() - now.getTime()) / 86400000) <= 30;
}

faForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#fa_site')?.value?.trim?.() || '';
  const date = $('#fa_date')?.value || '';
  const checker = $('#fa_checker')?.value?.trim?.() || '';

  if (!site || !date || !checker) {
    alert('Please fill Site, Date, and Checked By.');
    return;
  }

  const rows = faTableBody ? Array.from(faTableBody.querySelectorAll('tr')) : [];
  const items = rows.map(tr => {
    const name = tr.querySelector('.fa-name')?.value?.trim?.() || '';
    const qty = parseInt(tr.querySelector('.fa-qty')?.value || '0', 10);
    const min = parseInt(tr.querySelector('.fa-min')?.value || '0', 10);
    const exp = tr.querySelector('.fa-exp')?.value || null;
    return { name, quantity: qty, min, expiry: exp };
  }).filter(i => i.name);

  const flagged = items.some(i =>
    (i.quantity <= (i.min || 0)) ||
    (i.expiry && (within30Days(i.expiry) || (new Date(i.expiry) < new Date())))
  );

  const payload = { site, date, checked_by: checker, items, flagged };

  try {
    await sendToFunction('B', payload);
    alert('First aid check submitted.');
    faForm.reset();
    if (faDate) faDate.value = todayISO();
    if (faTableBody) {
      faTableBody.innerHTML = '';
      seedFirstAid();
    }
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({ ts: Date.now(), formType: 'B', payload });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM C — SITE INSPECTION
========================= */
const inspForm = $('#inspForm');
const inspDate = $('#insp_date');
if (inspDate) inspDate.value = todayISO();

const inspRosterBody = ensureTBody('inspRoster');
const inspHazBody = ensureTBody('inspHazards');

const inspAddWorker = $('#inspAddWorker');
const inspAddHazard = $('#inspAddHazard');
const inspApprover = $('#insp_approver');
const inspApproverOther = $('#insp_approver_other');
const inspSigCanvas = $('#insp_approver_canvas');
let inspSigPad = null;

if (window.SignaturePad && inspSigCanvas) {
  try {
    inspSigPad = new SignaturePad(inspSigCanvas, { minWidth: 0.7, maxWidth: 2.2, throttle: 8 });
  } catch (err) {
    console.warn('SignaturePad init failed for approval', err);
  }
}

$('#inspClearSig')?.addEventListener('click', () => {
  if (inspSigPad?.clear) inspSigPad.clear();
});

function addInspWorkerRow() {
  if (!inspRosterBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="iw-name" placeholder="Full name" required></td>
    <td>
      <select class="iw-role">
        <option value="worker">Worker</option>
        <option value="staff">Staff</option>
        <option value="foreman">Foreman</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  inspRosterBody.appendChild(tr);
}

function addInspHazardRow() {
  if (!inspHazBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="hz-desc" placeholder="Describe hazard" required></td>
    <td><input type="text" class="hz-loc" placeholder="Where?"></td>
    <td>
      <select class="hz-risk">
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
      </select>
    </td>
    <td><input type="text" class="hz-action" placeholder="Action to fix"></td>
    <td><input type="text" class="hz-assigned" placeholder="Assigned to"></td>
    <td style="text-align:center"><input type="checkbox" class="hz-done"></td>
    <td><input type="text" class="hz-doneby" placeholder="Completed by"></td>
    <td><input type="date" class="hz-donedate"></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  inspHazBody.appendChild(tr);
}

function seedInspection() {
  if (inspRosterBody && inspRosterBody.children.length === 0) addInspWorkerRow();
  if (inspHazBody && inspHazBody.children.length === 0) addInspHazardRow();
}

inspAddWorker?.addEventListener('click', addInspWorkerRow);
inspAddHazard?.addEventListener('click', addInspHazardRow);

inspRosterBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

inspHazBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

const inspImageFiles = $('#insp_image_files');
const inspImageType = $('#insp_image_type');
const inspImageCaption = $('#insp_image_caption');
const inspImageAddBtn = $('#insp_image_add');
const inspImageBody = $('#insp_images_table')?.querySelector('tbody') || null;
const inspImageState = [];
wireImageRemover(inspImageState, inspImageBody);

inspImageAddBtn?.addEventListener('click', () => {
  const files = Array.from(inspImageFiles?.files || []);
  if (!files.length) {
    alert('Choose at least one image file.');
    return;
  }

  files.forEach(file => {
    inspImageState.push({
      file,
      image_type: inspImageType?.value || 'general',
      caption: inspImageCaption?.value?.trim?.() || ''
    });
  });

  renderImageRows(inspImageState, inspImageBody);
  if (inspImageFiles) inspImageFiles.value = '';
  if (inspImageCaption) inspImageCaption.value = '';
});

inspForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#insp_site')?.value?.trim?.() || '';
  const date = $('#insp_date')?.value || '';
  const inspector = $('#insp_inspector')?.value?.trim?.() || '';

  if (!site || !date || !inspector) {
    alert('Please fill Site, Date, and Inspector.');
    return;
  }

  const roster = inspRosterBody ? Array.from(inspRosterBody.querySelectorAll('tr')).map(tr => ({
    name: tr.querySelector('.iw-name')?.value?.trim?.() || '',
    role_on_site: tr.querySelector('.iw-role')?.value || 'worker'
  })).filter(r => r.name) : [];

  const hazards = inspHazBody ? Array.from(inspHazBody.querySelectorAll('tr')).map(tr => ({
    hazard: tr.querySelector('.hz-desc')?.value?.trim?.() || '',
    location: tr.querySelector('.hz-loc')?.value?.trim?.() || '',
    risk: tr.querySelector('.hz-risk')?.value || 'Low',
    action: tr.querySelector('.hz-action')?.value?.trim?.() || '',
    assigned_to: tr.querySelector('.hz-assigned')?.value?.trim?.() || '',
    completed: !!tr.querySelector('.hz-done')?.checked,
    completed_by: tr.querySelector('.hz-doneby')?.value?.trim?.() || '',
    completed_date: tr.querySelector('.hz-donedate')?.value || null
  })).filter(h => h.hazard) : [];

  let approver_name = inspApprover ? inspApprover.value : '';
  if (approver_name === 'Other') {
    const other = inspApproverOther?.value?.trim?.() || '';
    if (!other) {
      alert('Please type the approver name.');
      return;
    }
    approver_name = other;
  }

  if (!inspSigPad || (inspSigPad.isEmpty && inspSigPad.isEmpty())) {
    alert('HSE approval signature is required.');
    return;
  }

  const payload = {
    site,
    date,
    inspector,
    roster,
    hazards,
    openHazards: hazards.some(h => !h.completed),
    approved: true,
    approver_name,
    approver_signature_png: inspSigPad.toDataURL('image/png')
  };

  try {
    const resp = await sendToFunction('C', payload);
    const submissionId = resp?.id;

    if (submissionId && inspImageState.length) {
      await uploadImagesForSubmission(inspImageState, submissionId);
    }

    alert('Site inspection submitted.');
    inspForm.reset();
    if (inspDate) inspDate.value = todayISO();
    if (inspRosterBody) inspRosterBody.innerHTML = '';
    if (inspHazBody) inspHazBody.innerHTML = '';
    seedInspection();
    if (inspSigPad?.clear) inspSigPad.clear();
    if (inspApprover) inspApprover.value = 'Krista';
    if (inspApproverOther) inspApproverOther.value = '';
    clearImageState(inspImageState, inspImageBody, inspImageFiles, inspImageCaption);
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({
      ts: Date.now(),
      formType: 'C',
      payload,
      localImages: [...inspImageState]
    });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM A — EMERGENCY DRILL
========================= */
const drForm = $('#drForm');
const drDate = $('#dr_date');
if (drDate) drDate.value = todayISO();

const drRosterBody = ensureTBody('drRoster');
const drAddPartBtn = $('#drAddPart');

const drImageFiles = $('#dr_image_files');
const drImageType = $('#dr_image_type');
const drImageCaption = $('#dr_image_caption');
const drImageAddBtn = $('#dr_image_add');
const drImageBody = $('#dr_images_table')?.querySelector('tbody') || null;
const drillImageState = [];
wireImageRemover(drillImageState, drImageBody);

const drSigCanvas = $('#dr_supervisor_canvas');
let drSigPad = null;

if (window.SignaturePad && drSigCanvas) {
  try {
    drSigPad = new SignaturePad(drSigCanvas, { minWidth: 0.7, maxWidth: 2.2, throttle: 8 });
  } catch (err) {
    console.warn('SignaturePad init failed for drill', err);
  }
}

$('#drClearSig')?.addEventListener('click', () => {
  if (drSigPad?.clear) drSigPad.clear();
});

function addDrillParticipantRow() {
  if (!drRosterBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="dr-name" placeholder="Full name" required></td>
    <td>
      <select class="dr-role">
        <option value="worker">Worker</option>
        <option value="staff">Staff</option>
        <option value="site_leader">Site Leader</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><input type="text" class="dr-company" placeholder="Company"></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  drRosterBody.appendChild(tr);
}

function seedDrill() {
  if (drRosterBody && drRosterBody.children.length === 0) {
    addDrillParticipantRow();
    addDrillParticipantRow();
  }
}

drAddPartBtn?.addEventListener('click', addDrillParticipantRow);

drRosterBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') btn.closest('tr')?.remove();
});

drImageAddBtn?.addEventListener('click', () => {
  const files = Array.from(drImageFiles?.files || []);
  if (!files.length) {
    alert('Choose at least one image file.');
    return;
  }

  files.forEach(file => {
    drillImageState.push({
      file,
      image_type: drImageType?.value || 'general',
      caption: drImageCaption?.value?.trim?.() || ''
    });
  });

  renderImageRows(drillImageState, drImageBody);
  if (drImageFiles) drImageFiles.value = '';
  if (drImageCaption) drImageCaption.value = '';
});

drForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#dr_site')?.value?.trim?.() || '';
  const date = $('#dr_date')?.value || '';
  const supervisor = $('#dr_supervisor')?.value?.trim?.() || '';
  const drillType = $('#dr_type')?.value?.trim?.() || '';
  const startTime = $('#dr_start')?.value || '';
  const endTime = $('#dr_end')?.value || '';
  const scenario = $('#dr_scenario')?.value?.trim?.() || '';
  const evaluation = $('#dr_eval')?.value?.trim?.() || '';
  const followUp = $('#dr_followup')?.value?.trim?.() || '';
  const nextDrillDate = $('#dr_next_date')?.value || null;

  if (!site || !date || !supervisor || !drillType || !startTime || !endTime) {
    alert('Please fill Site, Date, Supervisor, Drill Type, Start Time, and End Time.');
    return;
  }

  if (!drSigPad || (drSigPad.isEmpty && drSigPad.isEmpty())) {
    alert('Supervisor signature is required.');
    return;
  }

  const participants = drRosterBody ? Array.from(drRosterBody.querySelectorAll('tr')).map(tr => {
    const name = tr.querySelector('.dr-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.dr-role')?.value || 'worker';
    const company = tr.querySelector('.dr-company')?.value?.trim?.() || '';
    return { name, role_on_site: role, company };
  }).filter(r => r.name) : [];

  const issues = !!$('#dr_issues')?.checked;

  const payload = {
    site,
    date,
    supervisor,
    drill_type: drillType,
    start_time: startTime,
    end_time: endTime,
    scenario_notes: scenario,
    participants,
    evaluation,
    follow_up_actions: followUp,
    next_drill_date: nextDrillDate,
    issues,
    supervisor_signature_png: drSigPad.toDataURL('image/png')
  };

  try {
    const resp = await sendToFunction('A', payload);
    const submissionId = resp?.id;

    if (submissionId && drillImageState.length) {
      await uploadImagesForSubmission(drillImageState, submissionId);
    }

    alert('Emergency drill submitted.');
    drForm.reset();
    if (drDate) drDate.value = todayISO();
    if (drRosterBody) {
      drRosterBody.innerHTML = '';
      seedDrill();
    }
    if (drSigPad?.clear) drSigPad.clear();
    clearImageState(drillImageState, drImageBody, drImageFiles, drImageCaption);
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({
      ts: Date.now(),
      formType: 'A',
      payload,
      localImages: [...drillImageState]
    });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   ADMIN MANAGEMENT ACTIONS
========================= */
const amProfileId = $('#am_profile_id');
const amProfileName = $('#am_profile_name');
const amProfileRole = $('#am_profile_role');
const amProfileActive = $('#am_profile_active');
const amProfileSave = $('#am_profile_save');

const amSiteId = $('#am_site_id');
const amSiteCode = $('#am_site_code');
const amSiteName = $('#am_site_name');
const amSiteAddress = $('#am_site_address');
const amSiteNotes = $('#am_site_notes');
const amSiteActive = $('#am_site_active');
const amSiteCreate = $('#am_site_create');
const amSiteUpdate = $('#am_site_update');

const amAssignmentId = $('#am_assignment_id');
const amAssignmentSiteId = $('#am_assignment_site_id');
const amAssignmentProfileId = $('#am_assignment_profile_id');
const amAssignmentRole = $('#am_assignment_role');
const amAssignmentPrimary = $('#am_assignment_primary');
const amAssignmentCreate = $('#am_assignment_create');
const amAssignmentUpdate = $('#am_assignment_update');
const amAssignmentDelete = $('#am_assignment_delete');

const amSummary = $('#am_summary');

function setManageSummary(text) {
  setNotice(amSummary, text);
}

function ensureAdminAllowed() {
  if (appState.adminLocked) {
    alert('Admin access is required for this action.');
    return false;
  }
  return true;
}

async function refreshAdminModuleAfterSave() {
  if (adminUI?.loadDirectory) {
    await adminUI.loadDirectory();
  }
  if (adminUI?.refreshSelectors) {
    await adminUI.refreshSelectors();
  }
}

amProfileSave?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const profileId = amProfileId?.value?.trim?.() || '';
  if (!profileId) {
    alert('Profile ID is required.');
    return;
  }

  try {
    const resp = await manageAdminEntity({
      entity: 'profile',
      action: 'update',
      profile_id: profileId,
      full_name: amProfileName?.value?.trim?.() || null,
      role: amProfileRole?.value || undefined,
      is_active: !!amProfileActive?.checked
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Profile save failed');

    setManageSummary(`Profile updated: ${resp?.record?.email || profileId}`);
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to save profile.');
  }
});

amSiteCreate?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const siteCode = amSiteCode?.value?.trim?.() || '';
  const siteName = amSiteName?.value?.trim?.() || '';

  if (!siteCode || !siteName) {
    alert('Site code and site name are required.');
    return;
  }

  try {
    const resp = await manageAdminEntity({
      entity: 'site',
      action: 'create',
      site_code: siteCode,
      site_name: siteName,
      address: amSiteAddress?.value?.trim?.() || null,
      notes: amSiteNotes?.value?.trim?.() || null,
      is_active: !!amSiteActive?.checked
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Site create failed');

    setManageSummary(`Site created: ${resp?.record?.site_code || siteCode}`);
    if (amSiteId) amSiteId.value = resp?.record?.id || '';
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to create site.');
  }
});

amSiteUpdate?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const siteId = amSiteId?.value?.trim?.() || '';
  if (!siteId) {
    alert('Site ID is required for update.');
    return;
  }

  try {
    const resp = await manageAdminEntity({
      entity: 'site',
      action: 'update',
      site_id: siteId,
      site_code: amSiteCode?.value?.trim?.() || undefined,
      site_name: amSiteName?.value?.trim?.() || undefined,
      address: amSiteAddress?.value?.trim?.() || null,
      notes: amSiteNotes?.value?.trim?.() || null,
      is_active: !!amSiteActive?.checked
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Site update failed');

    setManageSummary(`Site updated: ${resp?.record?.site_code || siteId}`);
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to update site.');
  }
});

amAssignmentCreate?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const siteId = amAssignmentSiteId?.value?.trim?.() || '';
  const profileId = amAssignmentProfileId?.value?.trim?.() || '';

  if (!siteId || !profileId) {
    alert('Site ID and Profile ID are required.');
    return;
  }

  try {
    const resp = await manageAdminEntity({
      entity: 'assignment',
      action: 'create',
      site_id: siteId,
      profile_id: profileId,
      assignment_role: amAssignmentRole?.value || 'worker',
      is_primary: !!amAssignmentPrimary?.checked
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Assignment create failed');

    if (amAssignmentId) amAssignmentId.value = resp?.record?.id || '';
    setManageSummary(`Assignment created: ${resp?.record?.id || ''}`);
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to create assignment.');
  }
});

amAssignmentUpdate?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const assignmentId = amAssignmentId?.value?.trim?.() || '';
  if (!assignmentId) {
    alert('Assignment ID is required for update.');
    return;
  }

  try {
    const resp = await manageAdminEntity({
      entity: 'assignment',
      action: 'update',
      assignment_id: assignmentId,
      assignment_role: amAssignmentRole?.value || 'worker',
      is_primary: !!amAssignmentPrimary?.checked
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Assignment update failed');

    setManageSummary(`Assignment updated: ${assignmentId}`);
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to update assignment.');
  }
});

amAssignmentDelete?.addEventListener('click', async () => {
  if (!ensureAdminAllowed()) return;

  const assignmentId = amAssignmentId?.value?.trim?.() || '';
  if (!assignmentId) {
    alert('Assignment ID is required for delete.');
    return;
  }

  const confirmed = window.confirm(`Delete assignment ${assignmentId}?`);
  if (!confirmed) return;

  try {
    const resp = await manageAdminEntity({
      entity: 'assignment',
      action: 'delete',
      assignment_id: assignmentId
    });

    if (!resp?.ok) throw new Error(resp?.error || 'Assignment delete failed');

    setManageSummary(`Assignment deleted: ${assignmentId}`);
    if (amAssignmentId) amAssignmentId.value = '';
    await refreshAdminModuleAfterSave();
  } catch (err) {
    console.error(err);
    alert('Failed to delete assignment.');
  }
});

/* =========================
   TABLE SEEDING
========================= */
function seedAllTables() {
  seedToolbox();
  seedPPE();
  seedFirstAid();
  seedInspection();
  seedDrill();
}

/* =========================
   ADMIN MODULE
========================= */
function initAdminModule() {
  if (!window.YWIAdminUI?.create) return;

  adminUI = window.YWIAdminUI.create({
    loadAdminDirectory,
    loadAdminSelectors,
    manageSummary: setManageSummary,
    getCurrentRole: () => appState.currentRole,
    onProfileLoaded: () => {},
    onSiteLoaded: () => {},
    onAssignmentLoaded: () => {}
  });

  adminUI.init().catch((err) => {
    console.error('Admin UI init failed', err);
  });
}

/* =========================
   LOGBOOK MODULE
========================= */
function initLogbookModule() {
  if (!window.YWILogbookUI?.create) return;

  logbookUI = window.YWILogbookUI.create({
    fetchLogData,
    fetchSubmissionDetail,
    saveSubmissionReview,
    storagePreviewUrl,
    getCurrentRole: () => appState.currentRole
  });

  logbookUI.init().catch((err) => {
    console.error('Logbook UI init failed', err);
  });
}

/* =========================
   BOOTSTRAP / STARTUP
========================= */
async function initializeAppShell() {
  applyDateFallback();
  seedAllTables();
  setManageSummary('');

  if (!adminUI) initAdminModule();
  if (!logbookUI) initLogbookModule();

  const currentAuthState = auth()?.getState?.();
  if (currentAuthState) {
    syncAuthStateFromBoot({ state: currentAuthState });
  } else {
    applyRoleVisibility();
  }

  if (location.hash === '#admin' && appState.isAuthenticated && adminUI?.loadDirectory) {
    try {
      await adminUI.loadDirectory();
    } catch (err) {
      console.error('Admin auto-load failed', err);
    }
  }
}

document.addEventListener('ywi:boot-ready', async (e) => {
  appState.bootReady = true;
  syncAuthStateFromBoot({ state: auth()?.getState?.() || null, ...e.detail });
  await initializeAppShell();
});

document.addEventListener('ywi:auth-changed', async (e) => {
  syncAuthStateFromBoot(e.detail || {});

  if (adminUI?.refreshSelectors) {
    await adminUI.refreshSelectors();
  }

  if (location.hash === '#admin' && appState.isAuthenticated && adminUI?.loadDirectory) {
    try {
      await adminUI.loadDirectory();
    } catch (err) {
      console.error('Admin auth refresh failed', err);
    }
  } else if (!appState.isAuthenticated) {
    if (adminUI?.clearDirectory) adminUI.clearDirectory();
    if (logbookUI?.clearSubmissionDetail) logbookUI.clearSubmissionDetail();
    if (logbookUI?.clearReviewPanel) logbookUI.clearReviewPanel();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  applyDateFallback();
  seedAllTables();
  setManageSummary('');
  initAdminModule();
  initLogbookModule();
  applyRoleVisibility();
});

window.addEventListener('hashchange', () => {
  setTimeout(seedAllTables, 0);
  if (location.hash === '#admin' && appState.isAuthenticated && adminUI?.loadDirectory) {
    adminUI.loadDirectory().catch(err => console.error('Admin hash load failed', err));
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(seedAllTables, 0);
  }
});
