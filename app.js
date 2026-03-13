'use strict';

/* =========================================================
Document 17: /app.js
Purpose:
- Stable Supabase magic-link login
- Session persistence after refresh
- JWT-authenticated calls to:
  - resend-email
  - clever-endpoint
  - submission-images
  - review-submission
- Form handling for A/B/C/D/E
- Logbook loading + CSV export
- Review/admin panel support
- Starter rows + date defaults
- Safe handling of Supabase auth hash fragments
- Image upload support for:
  - Site Inspection
  - Emergency Drill
========================================================= */

/* =========================
   CONFIG
========================= */
const SB_URL  = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
const SB_KEY  = 'sb_publishable_Xyg1zQU9_vsAaME9BeHm_w_RRgtPs_e';

const FUNCTION_URL = `${SB_URL}/functions/v1/resend-email`;
const LIST_URL = `${SB_URL}/functions/v1/clever-endpoint`;
const IMAGE_META_URL = `${SB_URL}/functions/v1/submission-images`;
const REVIEW_URL = `${SB_URL}/functions/v1/review-submission`;
const STORAGE_BUCKET = 'submission-images';

const OUTBOX_KEY = 'ywi_outbox_v1';
const IDLE_MS = 30 * 60 * 1000;

/* =========================
   SUPABASE CLIENT
========================= */
let sb = null;
if (window.supabase && SB_URL && SB_KEY) {
  sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ywi-auth'
    }
  });
  window._sb = sb;
} else {
  console.warn('Supabase client not loaded or missing config.');
}

/* =========================
   DOM HELPERS
========================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const mainEl     = $('main.container');
const loginView  = $('#loginView');
const loginForm  = $('#loginForm');
const emailInput = $('#loginEmail');
const authInfo   = $('#authInfo');
const whoami     = $('#whoami');
const logoutBtn  = $('#logoutBtn');

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
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
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

function showLogin() {
  if (loginView) loginView.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';
  if (authInfo) authInfo.hidden = true;
}

function showApp(session) {
  if (loginView) loginView.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';
  if (authInfo) authInfo.hidden = false;
  if (whoami) whoami.textContent = session?.user?.email || '';
}

function cleanAuthHash() {
  const hash = window.location.hash || '';
  if (
    hash.startsWith('#access_token=') ||
    hash.startsWith('#refresh_token=') ||
    hash.includes('type=signup') ||
    hash.includes('type=recovery') ||
    hash.includes('expires_at=')
  ) {
    history.replaceState({}, '', window.location.pathname + '#toolbox');
  }
}

function extFromName(name = '') {
  const clean = name.toLowerCase().trim();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.gif')) return 'gif';
  if (clean.endsWith('.jpeg')) return 'jpeg';
  return 'jpg';
}

function bytesLabel(size) {
  const n = Number(size || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/* =========================
   AUTH
========================= */
async function renderByAuth() {
  if (!sb) {
    showLogin();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showApp(session);
    seedAllTables();
  } else {
    showLogin();
  }
}

async function bootAuth() {
  if (!sb) {
    showLogin();
    return;
  }

  await sb.auth.getSession();
  cleanAuthHash();
  await renderByAuth();
}

if (sb) {
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      cleanAuthHash();
    }
    if (session) showApp(session);
    else showLogin();
  });

  if (IDLE_MS > 0) {
    let idleTimer = null;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        try { await sb.auth.signOut(); } catch {}
      }, IDLE_MS);
    };
    ['click', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetIdle, { passive: true });
    });
    resetIdle();
  }
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sb) return alert('Auth client not available.');

  const email = (emailInput?.value || '').trim();
  if (!email) return alert('Please enter your email.');

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/#toolbox`
      }
    });

    if (error) {
      alert(`Login error: ${error.message}`);
    } else {
      alert('Magic link sent. Please check your email.');
    }
  } finally {
    setTimeout(() => {
      if (submitBtn) submitBtn.disabled = false;
    }, 65000);
  }
});

logoutBtn?.addEventListener('click', async () => {
  if (!sb) return;
  await sb.auth.signOut();
});

/* =========================
   FETCH / AUTH HEADERS
========================= */
async function authHeader() {
  if (!sb) return {};
  const { data: { session } } = await sb.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

async function jsonFetch(url, { method = 'POST', headers = {}, body = null } = {}) {
  let auth = await authHeader();

  let res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth, ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
  });

  if (res.status === 401 && sb) {
    try { await sb.auth.refreshSession(); } catch {}
    auth = await authHeader();
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...auth, ...headers },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error('HTTP error', res.status, text);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  try { return JSON.parse(text); }
  catch { return text; }
}

async function sendToFunction(formType, payload) {
  return jsonFetch(FUNCTION_URL, {
    body: { formType, payload }
  });
}

async function attachSubmissionImages(submissionId, images) {
  return jsonFetch(IMAGE_META_URL, {
    body: { submission_id: submissionId, images }
  });
}

async function saveSubmissionReview(payload) {
  return jsonFetch(REVIEW_URL, {
    body: payload
  });
}

async function flushOutbox() {
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
      if (submissionId && item.localImages?.length) {
        const uploadedImages = await uploadImagesForSubmission(item.localImages, submissionId, item.imagePrefix || 'submission');
        if (uploadedImages.length) {
          await attachSubmissionImages(submissionId, uploadedImages);
        }
      }
    } catch (err) {
      console.warn('Outbox send failed', err);
      remaining.push(item);
    }
  }

  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} remain.` : 'All queued submissions sent.');
}

$$('[data-role="retry-outbox"]').forEach(btn => {
  if (!btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', flushOutbox);
  }
});

/* =========================
   DATE SUPPORT
========================= */
function supportsDateInput() {
  const i = document.createElement('input');
  i.setAttribute('type', 'date');
  return i.type === 'date';
}

function applyDateFallback() {
  if (supportsDateInput()) return;
  $$('input[type="date"]').forEach(inp => {
    inp.setAttribute('type', 'text');
    inp.setAttribute('placeholder', 'YYYY-MM-DD');
    inp.setAttribute('inputmode', 'numeric');
    inp.setAttribute('pattern', '\\d{4}-\\d{2}-\\d{2}');
  });
}

/* =========================
   IMAGE UPLOAD SUPPORT
========================= */
const inspImageState = [];
const drImageState = [];

const inspImageFiles = $('#insp_image_files');
const inspImageType = $('#insp_image_type');
const inspImageCaption = $('#insp_image_caption');
const inspImageBody = ensureTBody('inspImageTable');

const drImageFiles = $('#dr_image_files');
const drImageType = $('#dr_image_type');
const drImageCaption = $('#dr_image_caption');
const drImageBody = ensureTBody('drImageTable');

function renderImageRows(state, tbody) {
  if (!tbody) return;
  tbody.innerHTML = '';

  state.forEach((img, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <img
          src="${escHtml(img.preview_url)}"
          alt="preview"
          style="width:160px;max-width:100%;height:auto;border-radius:8px;border:1px solid rgba(255,255,255,.12);"
        />
      </td>
      <td>
        <div>${escHtml(img.file_name)}</div>
        <div style="color:#9ca3af;font-size:.85rem;">${escHtml(bytesLabel(img.file_size_bytes))}</div>
      </td>
      <td>${escHtml(img.image_type)}</td>
      <td>${escHtml(img.caption || '')}</td>
      <td>
        <div class="controls">
          <button type="button" data-remove-image="${index}">Remove</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function clearImageState(state, tbody, fileInput, captionInput) {
  state.forEach(item => {
    if (item.preview_url) URL.revokeObjectURL(item.preview_url);
  });
  state.length = 0;
  if (tbody) tbody.innerHTML = '';
  if (fileInput) fileInput.value = '';
  if (captionInput) captionInput.value = '';
}

async function uploadImagesForSubmission(localImages, submissionId, prefix) {
  if (!sb || !localImages.length) return [];

  const uploaded = [];

  for (const item of localImages) {
    const ext = extFromName(item.file_name);
    const safePrefix = prefix || 'submission';
    const filePath = `${safePrefix}/${submissionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, item.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: item.content_type || item.file?.type || 'image/jpeg'
      });

    if (uploadErr) throw uploadErr;

    uploaded.push({
      image_type: item.image_type || 'status',
      file_name: item.file_name,
      file_path: filePath,
      file_size_bytes: item.file_size_bytes ?? null,
      content_type: item.content_type ?? null,
      caption: item.caption || null
    });
  }

  return uploaded;
}

function bindImageInput(fileInput, typeInput, captionInput, state, tbody) {
  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const imageType = typeInput?.value || 'status';
    const caption = captionInput?.value?.trim?.() || '';

    files.forEach(file => {
      state.push({
        file,
        file_name: file.name,
        file_size_bytes: file.size,
        content_type: file.type || 'image/jpeg',
        image_type: imageType,
        caption,
        preview_url: URL.createObjectURL(file)
      });
    });

    renderImageRows(state, tbody);

    if (fileInput) fileInput.value = '';
    if (captionInput) captionInput.value = '';
  });

  tbody?.addEventListener('click', (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
    if (!btn) return;
    const idx = btn.dataset.removeImage;
    if (idx === undefined) return;

    const index = Number(idx);
    const item = state[index];
    if (item?.preview_url) URL.revokeObjectURL(item.preview_url);
    state.splice(index, 1);
    renderImageRows(state, tbody);
  });
}

bindImageInput(inspImageFiles, inspImageType, inspImageCaption, inspImageState, inspImageBody);
bindImageInput(drImageFiles, drImageType, drImageCaption, drImageState, drImageBody);

/* =========================
   FORM E — TOOLBOX TALK
========================= */
const tbForm = $('#toolboxForm');
const tbDate = $('#tb_date');
if (tbDate) tbDate.value = todayISO();

const attendeesTableBody = ensureTBody('attendeesTable');
const addRowBtn = $('#addRowBtn');

let tbRowCount = 0;
const sigPads = new Map();

function addAttendeeRow(initialName = '', initialRole = 'worker') {
  if (!attendeesTableBody) return;
  tbRowCount++;
  const id = `tb_row_${tbRowCount}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type="text" class="att-name" placeholder="Full name" value="${escHtml(initialName)}" required></td>
    <td>
      <select class="att-role">
        <option value="worker" ${initialRole === 'worker' ? 'selected' : ''}>Worker</option>
        <option value="foreman" ${initialRole === 'foreman' ? 'selected' : ''}>Foreman</option>
        <option value="supervisor" ${initialRole === 'supervisor' ? 'selected' : ''}>Supervisor</option>
        <option value="visitor" ${initialRole === 'visitor' ? 'selected' : ''}>Visitor</option>
      </select>
    </td>
    <td>
      <div class="canvas-wrap">
        <canvas id="${id}_canvas" width="600" height="140"></canvas>
        <div class="controls"><button type="button" data-act="clear">Clear</button></div>
      </div>
    </td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  attendeesTableBody.appendChild(tr);

  const canvas = tr.querySelector('canvas');
  if (window.SignaturePad && canvas) {
    try {
      const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
      sigPads.set(id, pad);
    } catch (err) {
      console.warn('SignaturePad init failed:', err);
    }
  }
}

function seedToolbox() {
  if (attendeesTableBody && attendeesTableBody.children.length === 0) {
    addAttendeeRow();
    addAttendeeRow();
  }
}

addRowBtn?.addEventListener('click', () => addAttendeeRow());

attendeesTableBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  const tr = btn.closest('tr');
  const rowId = tr?.dataset.rowId || '';
  const act = btn.dataset.act;

  if (act === 'remove' && tr) {
    sigPads.delete(rowId);
    tr.remove();
  }
  if (act === 'clear') {
    const pad = sigPads.get(rowId);
    if (pad?.clear) pad.clear();
  }
});

tbForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site   = $('#tb_site')?.value?.trim?.() || '';
  const date   = $('#tb_date')?.value || '';
  const leader = $('#tb_leader')?.value?.trim?.() || '';
  const notes  = $('#tb_topics')?.value?.trim?.() || '';

  if (!site || !date || !leader) {
    alert('Please fill Site, Date, and Discussion Leader.');
    return;
  }

  const rows = attendeesTableBody ? Array.from(attendeesTableBody.querySelectorAll('tr')) : [];
  const attendees = rows.map(tr => {
    const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.att-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? sigPads.get(rowId) : null;
    const signed = pad && typeof pad.isEmpty === 'function' ? !pad.isEmpty() : false;
    return {
      name,
      role_on_site: role,
      signature_png: signed && pad?.toDataURL ? pad.toDataURL('image/png') : null
    };
  }).filter(a => a.name);

  const payload = {
    site,
    date,
    submitted_by: leader,
    topic_notes: notes,
    attendees
  };

  try {
    await sendToFunction('E', payload);
    alert('Toolbox submitted.');
    tbForm.reset();
    if (tbDate) tbDate.value = todayISO();
    if (attendeesTableBody) {
      attendeesTableBody.innerHTML = '';
      sigPads.clear();
      seedToolbox();
    }
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({ ts: Date.now(), formType: 'E', payload });
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
        <option value="foreman">Foreman</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><input type="checkbox" class="ppe-shoes" checked></td>
    <td><input type="checkbox" class="ppe-vest" checked></td>
    <td><input type="checkbox" class="ppe-plugs" checked></td>
    <td><input type="checkbox" class="ppe-goggles" checked></td>
    <td><input type="checkbox" class="ppe-muffs" checked></td>
    <td><input type="checkbox" class="ppe-gloves" checked></td>
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

  const site    = $('#ppe_site')?.value?.trim?.() || '';
  const date    = $('#ppe_date')?.value || '';
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
      shoes:   !!tr.querySelector('.ppe-shoes')?.checked,
      vest:    !!tr.querySelector('.ppe-vest')?.checked,
      plugs:   !!tr.querySelector('.ppe-plugs')?.checked,
      goggles: !!tr.querySelector('.ppe-goggles')?.checked,
      muffs:   !!tr.querySelector('.ppe-muffs')?.checked,
      gloves:  !!tr.querySelector('.ppe-gloves')?.checked
    }
  })).filter(r => r.name);

  const nonCompliant = roster.some(r =>
    !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves
  );

  const payload = {
    site,
    date,
    checked_by: checker,
    roster,
    nonCompliant
  };

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

  const site    = $('#fa_site')?.value?.trim?.() || '';
  const date    = $('#fa_date')?.value || '';
  const checker = $('#fa_checker')?.value?.trim?.() || '';

  if (!site || !date || !checker) {
    alert('Please fill Site, Date, and Checked By.');
    return;
  }

  const rows = faTableBody ? Array.from(faTableBody.querySelectorAll('tr')) : [];
  const items = rows.map(tr => {
    const name = tr.querySelector('.fa-name')?.value?.trim?.() || '';
    const qty  = parseInt(tr.querySelector('.fa-qty')?.value || '0', 10);
    const min  = parseInt(tr.querySelector('.fa-min')?.value || '0', 10);
    const exp  = tr.querySelector('.fa-exp')?.value || null;
    return { name, quantity: qty, min, expiry: exp };
  }).filter(i => i.name);

  const flagged = items.some(i =>
    (i.quantity <= (i.min || 0)) ||
    (i.expiry && (within30Days(i.expiry) || (new Date(i.expiry) < new Date())))
  );

  const payload = {
    site,
    date,
    checked_by: checker,
    items,
    flagged
  };

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
      const uploadedImages = await uploadImagesForSubmission(inspImageState, submissionId, 'inspection');
      if (uploadedImages.length) {
        await attachSubmissionImages(submissionId, uploadedImages);
      }
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
      localImages: [...inspImageState],
      imagePrefix: 'inspection'
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

const drSigPads = new Map();
let drRowCount = 0;

function addDrillParticipantRow() {
  if (!drRosterBody) return;
  drRowCount++;
  const id = `dr_row_${drRowCount}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type="text" class="dr-name" placeholder="Full name" required></td>
    <td>
      <select class="dr-role">
        <option value="worker">Worker</option>
        <option value="foreman">Foreman</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td>
      <div class="canvas-wrap">
        <canvas id="${id}_canvas" width="600" height="140"></canvas>
        <div class="controls"><button type="button" data-act="clear">Clear</button></div>
      </div>
    </td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
  drRosterBody.appendChild(tr);

  const canvas = tr.querySelector('canvas');
  if (window.SignaturePad && canvas) {
    try {
      const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.2, throttle: 8 });
      drSigPads.set(id, pad);
    } catch (err) {
      console.warn('SignaturePad init (drill) failed:', err);
    }
  }
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
  const tr = btn.closest('tr');
  const rowId = tr?.dataset.rowId || '';
  const act = btn.dataset.act;
  if (act === 'remove' && tr) {
    drSigPads.delete(rowId);
    tr.remove();
  }
  if (act === 'clear') {
    const pad = drSigPads.get(rowId);
    if (pad?.clear) pad.clear();
  }
});

drForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const site = $('#dr_site')?.value?.trim?.() || '';
  const date = $('#dr_date')?.value || '';
  const supervisor = $('#dr_supervisor')?.value?.trim?.() || '';

  if (!site || !date || !supervisor) {
    alert('Please fill Site, Date, and Supervisor.');
    return;
  }

  const participants = drRosterBody ? Array.from(drRosterBody.querySelectorAll('tr')).map(tr => {
    const name = tr.querySelector('.dr-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.dr-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? drSigPads.get(rowId) : null;
    return {
      name,
      role_on_site: role,
      signature_png: (pad && !pad.isEmpty?.()) ? pad.toDataURL('image/png') : null
    };
  }).filter(p => p.name) : [];

  const payload = {
    site,
    date,
    supervisor,
    drill_type: $('#dr_type')?.value || '',
    start_time: $('#dr_start')?.value || '',
    end_time: $('#dr_end')?.value || '',
    scenario_notes: $('#dr_notes')?.value?.trim?.() || '',
    participants,
    evaluation: $('#dr_eval')?.value?.trim?.() || '',
    follow_up_actions: $('#dr_follow')?.value?.trim?.() || '',
    next_drill_date: $('#dr_next')?.value || '',
    issues: !!$('#dr_issues')?.checked
  };

  try {
    const resp = await sendToFunction('A', payload);
    const submissionId = resp?.id;

    if (submissionId && drImageState.length) {
      const uploadedImages = await uploadImagesForSubmission(drImageState, submissionId, 'drill');
      if (uploadedImages.length) {
        await attachSubmissionImages(submissionId, uploadedImages);
      }
    }

    alert('Drill submitted.');
    drForm.reset();
    if (drDate) drDate.value = todayISO();
    if (drRosterBody) {
      drRosterBody.innerHTML = '';
      seedDrill();
    }
    clearImageState(drImageState, drImageBody, drImageFiles, drImageCaption);
  } catch (err) {
    const outbox = getOutbox();
    outbox.push({
      ts: Date.now(),
      formType: 'A',
      payload,
      localImages: [...drImageState],
      imagePrefix: 'drill'
    });
    setOutbox(outbox);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   LOGBOOK
========================= */
const lgSite   = $('#lg_site');
const lgFrom   = $('#lg_from');
const lgTo     = $('#lg_to');
const lgForm   = $('#lg_form');
const lgStatus = $('#lg_status');
const lgLoad   = $('#lg_load');
const lgExport = $('#lg_export');
const lgBody   = $('#lg_table')?.querySelector('tbody') || null;

window._logRows = window._logRows || [];
window._logRole = window._logRole || '';

function fmtSummary(row) {
  const t = row.form_type;
  const p = row.payload || {};
  if (t === 'E') return `Leader: ${p.submitted_by || ''}; Attendees: ${Array.isArray(p.attendees) ? p.attendees.length : 0}`;
  if (t === 'D') return `Checked by: ${p.checked_by || ''}; Non-compliance: ${p.nonCompliant ? 'YES' : 'No'}`;
  if (t === 'B') return `Checked by: ${p.checked_by || ''}; Flagged: ${p.flagged ? 'YES' : 'No'}`;
  if (t === 'C') return `Inspector: ${p.inspector || ''}; Open hazards: ${p.openHazards ? 'YES' : 'No'}`;
  if (t === 'A') return `Supervisor: ${p.supervisor || ''}; Issues: ${p.issues ? 'YES' : 'No'}`;
  return '';
}

function renderRows(rows) {
  if (!lgBody) return;
  lgBody.innerHTML = '';

  const canReview = ['supervisor', 'hse', 'admin'].includes(window._logRole || '');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    const d = (r.date || '').slice(0, 10);

    tr.innerHTML = `
      <td>${escHtml(r.id)}</td>
      <td>${escHtml(d)}</td>
      <td>${escHtml(r.form_type)}</td>
      <td>${escHtml(r.site || '')}</td>
      <td>${escHtml(r.status || 'submitted')}</td>
      <td>${escHtml(fmtSummary(r))}</td>
      <td>
        <details>
          <summary>View</summary>
          <pre style="white-space:pre-wrap; word-break:break-word; max-width:60ch;">${escHtml(JSON.stringify(r.payload, null, 2))}</pre>
        </details>
        ${canReview ? `<div class="controls" style="margin-top:8px;"><button type="button" data-review-id="${escHtml(r.id)}">Review</button></div>` : ''}
      </td>
    `;

    lgBody.appendChild(tr);
  });
}

async function fetchLog() {
  if (!sb) {
    alert('Please sign in first.');
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    alert('Please sign in to load the logbook.');
    return;
  }

  const body = {
    site: (lgSite && lgSite.value.trim()) || undefined,
    formType: (lgForm && lgForm.value) || undefined,
    from: (lgFrom && lgFrom.value) || undefined,
    to: (lgTo && lgTo.value) || undefined,
    status: (lgStatus && lgStatus.value) || undefined,
    limit: 100
  };

  const data = await jsonFetch(LIST_URL, { body });
  if (!data.ok) throw new Error(data.error || 'load_failed');

  window._logRows = data.rows || [];
  window._logRole = data.role || '';
  renderRows(window._logRows);
}

function toCSV(rows) {
  const header = ['id', 'date', 'form_type', 'site', 'status', 'summary'];
  const lines = [header.join(',')];
  const esc = v => `"${String(v).replaceAll('"', '""')}"`;

  rows.forEach(r => {
    const row = [
      r.id,
      (r.date || '').slice(0, 10),
      r.form_type,
      r.site || '',
      r.status || '',
      fmtSummary(r)
    ];
    lines.push(row.map(esc).join(','));
  });

  return lines.join('\n');
}

if (lgLoad && !lgLoad.dataset.bound) {
  lgLoad.dataset.bound = '1';
  lgLoad.addEventListener('click', async () => {
    try {
      await fetchLog();
    } catch (err) {
      console.error(err);
      alert('Failed to load log.');
    }
  });
}

lgExport?.addEventListener('click', () => {
  const rows = window._logRows || [];
  if (!rows.length) {
    alert('Nothing to export. Load the log first.');
    return;
  }

  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ywi-log.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* =========================
   REVIEW PANEL
========================= */
const rvSubmissionId = $('#rv_submission_id');
const rvStatus = $('#rv_status');
const rvAction = $('#rv_action');
const rvNote = $('#rv_note');
const rvAdminNotes = $('#rv_admin_notes');
const rvSubmit = $('#rv_submit');
const rvClear = $('#rv_clear');
const rvSummary = $('#rv_summary');

function clearReviewPanel() {
  if (rvSubmissionId) rvSubmissionId.value = '';
  if (rvStatus) rvStatus.value = '';
  if (rvAction) rvAction.value = 'commented';
  if (rvNote) rvNote.value = '';
  if (rvAdminNotes) rvAdminNotes.value = '';
  if (rvSummary) {
    rvSummary.style.display = 'none';
    rvSummary.textContent = '';
  }
}

function setReviewPanelFromRow(row) {
  if (!row) return;
  if (rvSubmissionId) rvSubmissionId.value = String(row.id || '');
  if (rvStatus) rvStatus.value = row.status || '';
  if (rvAction) rvAction.value = 'commented';
  if (rvNote) rvNote.value = '';
  if (rvAdminNotes) rvAdminNotes.value = row.admin_notes || '';
  if (rvSummary) {
    rvSummary.style.display = 'block';
    rvSummary.textContent = `Selected submission #${row.id} | ${row.form_type} | ${row.site || ''} | ${row.status || 'submitted'}`;
  }
}

lgBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button[data-review-id]') : null;
  if (!btn) return;

  const id = Number(btn.dataset.reviewId || 0);
  const row = (window._logRows || []).find(r => Number(r.id) === id);
  if (!row) return;

  setReviewPanelFromRow(row);
  location.hash = '#log';
});

rvClear?.addEventListener('click', clearReviewPanel);

rvSubmit?.addEventListener('click', async () => {
  const submissionId = Number(rvSubmissionId?.value || 0);
  const status = rvStatus?.value || '';
  const reviewAction = rvAction?.value || 'commented';
  const reviewNote = rvNote?.value?.trim?.() || '';
  const adminNotes = rvAdminNotes?.value ?? '';

  if (!submissionId) {
    alert('Select a submission from the logbook first.');
    return;
  }

  try {
    const resp = await saveSubmissionReview({
      submission_id: submissionId,
      status: status || undefined,
      review_action: reviewAction || undefined,
      review_note: reviewNote || undefined,
      admin_notes: adminNotes
    });

    if (!resp?.ok) {
      throw new Error(resp?.error || 'Review save failed');
    }

    if (rvSummary) {
      rvSummary.style.display = 'block';
      rvSummary.textContent = `Review saved for submission #${submissionId}.`;
    }

    await fetchLog();

    const updatedRow = (window._logRows || []).find(r => Number(r.id) === submissionId);
    if (updatedRow) setReviewPanelFromRow(updatedRow);

    alert('Review saved.');
  } catch (err) {
    console.error(err);
    alert('Failed to save review.');
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
   BOOTSTRAP
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  applyDateFallback();
  await bootAuth();
  seedAllTables();
  clearReviewPanel();
});

window.addEventListener('hashchange', () => {
  setTimeout(seedAllTables, 0);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(seedAllTables, 0);
  }
});
