'use strict';

/* ===================================================================
   YWI HSE — app.js (secure v4)
   - Supabase auth (magic link), logout, idle auto-logout
   - JWT to Edge Functions via Authorization header
   - Outbox for offline retries
   - Forms: E (Toolbox), D (PPE), B (First Aid), C (Inspection), A (Drill)
   - Logbook loader + CSV export
   - Starter-row seeding on visibility / navigation
   - Date input fallback if unsupported
=================================================================== */

/* =========================
   AUTH / PROJECT SETTINGS
========================= */
// Replace with YOUR project values:
const SB_URL  = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
const SB_ANON = 'sb_publishable_Xyg1zQU9_vsAaME9BeHm_w_RRgtPs_e';  // ← your Supabase "anon public" key

// Optional idle auto-logout (ms). Set to 0 to disable.
const IDLE_MS = 30 * 60 * 1000;
if (!SB_URL.startsWith('https://') || !SB_ANON || SB_ANON === 'SUPABASE_ANON_KEY') {
  alert('Supabase not configured: paste your real SB_URL and anon public key from Settings → API.');
  throw new Error('Missing SB_URL/SB_ANON');
}

/* =========================
   EDGE FUNCTION ENDPOINTS
========================= */
const FUNCTION_URL = `${SB_URL}/functions/v1/resend-email`;
const LIST_URL     = `${SB_URL}/functions/v1/clever-endpoint`;

/* =========================
   GLOBALS & CLIENT
========================= */
const OUTBOX_KEY = 'ywi_outbox_v1';

let sb = null;
if (window.supabase && SB_URL && SB_ANON) {
  sb = window.supabase.createClient(SB_URL, SB_ANON);
  window._sb = sb;
}

/* =========================
   DOM SHORTCUTS
========================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
  const tbl = document.getElementById(tableId);
  if (!tbl) return null;
  let tb = tbl.querySelector('tbody');
  if (!tb) { tb = document.createElement('tbody'); tbl.appendChild(tb); }
  return tb;
}

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}
function setOutbox(list) { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }

/* =========================
   AUTH UI BINDINGS
========================= */
const mainEl     = $('main.container');
const loginView  = $('#loginView');      // section wrapper for login
const loginForm  = $('#loginForm');      // the actual <form>
const emailInput = $('#loginEmail');
const authInfo   = $('#authInfo');
const whoami     = $('#whoami');
const logoutBtn  = $('#logoutBtn');

async function renderByAuth() {
  // If no Supabase client, show the app (public mode)
  if (!sb) {
    if (mainEl) mainEl.style.display = 'block';
    if (loginView) loginView.style.display = 'none';
    if (authInfo) authInfo.hidden = true;
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  const authed = !!session;

  if (mainEl)      mainEl.style.display    = authed ? 'block' : 'none';
  if (loginView)   loginView.style.display = authed ? 'none'  : 'block';
  if (authInfo)    authInfo.hidden         = !authed;
  if (whoami)      whoami.textContent      = authed ? (session.user.email || session.user.id) : '';

  // When we become visible, make sure tables are seeded
  if (authed) seedAllTables();
}

if (sb) {
  sb.auth.onAuthStateChange(() => renderByAuth());

  // Idle auto-logout
  if (IDLE_MS > 0) {
    (function idleGuard(){
      let timer = null;
      function reset(){ clearTimeout(timer); timer = setTimeout(() => sb.auth.signOut(), IDLE_MS); }
      ['click','mousemove','keydown','touchstart','scroll'].forEach(evt =>
        window.addEventListener(evt, reset, { passive: true })
      );
      reset();
    })();
  }
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sb) return alert('Auth client not loaded.');
  const email = (emailInput?.value || '').trim();
  if (!email) return;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  if (error) alert('Login error: ' + error.message);
  else alert('Check your email for the sign-in link.');
});

logoutBtn?.addEventListener('click', async () => { if (sb) await sb.auth.signOut(); });

/* =========================
   AUTH HEADERS & FETCH
========================= */
async function authHeader() {
  // Prefer a real session token
  try {
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {/* ignore */}
  // Fallback to anon key (public functions / dev)
  if (SB_ANON && SB_ANON !== 'SUPABASE_ANON_KEY') return { Authorization: `Bearer ${SB_ANON}` };
  return {};
}

async function jsonFetch(url, { method = 'POST', headers = {}, body = null } = {}) {
  const auth = await authHeader();
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth, ...headers },
    body: body && (typeof body === 'string' ? body : JSON.stringify(body))
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('HTTP error', res.status, text);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function sendToFunction(formType, payload) {
  return jsonFetch(FUNCTION_URL, { body: { formType, payload } });
}

async function flushOutbox() {
  const outbox = getOutbox();
  if (!outbox.length) { alert('Outbox is empty.'); return; }
  const remaining = [];
  for (const item of outbox) {
    try { await sendToFunction(item.formType, item.payload); }
    catch (e) { console.warn('Outbox send failed', e); remaining.push(item); }
  }
  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}
$$('[data-role="retry-outbox"]').forEach(btn => {
  if (!btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', flushOutbox);
  }
});

/* =========================
   DATE INPUT FALLBACK
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
    inp.setAttribute('inputmode', 'numeric');
    inp.setAttribute('placeholder', 'YYYY-MM-DD');
    inp.setAttribute('pattern', '\\d{4}-\\d{2}-\\d{2}');
  });
}

/* =========================
   FORM E — TOOLBOX TALK
========================= */
const tbForm  = $('#toolboxForm');
const tbDate  = $('#tb_date');
if (tbDate) tbDate.value = todayISO();

const attendeesTableBody = ensureTBody('attendeesTable');
const addRowBtn = $('#addRowBtn');

let tbRowCount = 0;
const sigPads = new Map(); // rowId -> SignaturePad

function addAttendeeRow(initialName = '', initialRole = 'worker') {
  if (!attendeesTableBody) return;
  tbRowCount++;
  const id = `row_${tbRowCount}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type="text" class="att-name" placeholder="Full name" value="${initialName}" required></td>
    <td>
      <select class="att-role">
        <option value="worker" ${initialRole==='worker'?'selected':''}>Worker</option>
        <option value="foreman" ${initialRole==='foreman'?'selected':''}>Foreman</option>
        <option value="supervisor" ${initialRole==='supervisor'?'selected':''}>Supervisor</option>
        <option value="visitor" ${initialRole==='visitor'?'selected':''}>Visitor</option>
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
      const pad = new SignaturePad(canvas, { minWidth: .7, maxWidth: 2.5, throttle: 8 });
      sigPads.set(id, pad);
    } catch (e) { console.warn('SignaturePad init failed:', e); }
  }
}
addRowBtn?.addEventListener('click', () => addAttendeeRow());

attendeesTableBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  const tr = btn.closest('tr');
  const rowId = tr ? tr.dataset.rowId : null;
  const act = btn.dataset.act;
  if (act === 'remove' && tr) { if (rowId) sigPads.delete(rowId); tr.remove(); }
  if (act === 'clear' && rowId) { const pad = sigPads.get(rowId); if (pad?.clear) pad.clear(); }
});

// Default rows
function seedToolbox() {
  if (attendeesTableBody && attendeesTableBody.children.length === 0) { addAttendeeRow(); addAttendeeRow(); }
}
seedToolbox();

tbForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site   = $('#tb_site')?.value?.trim?.() || '';
  const date   = $('#tb_date')?.value || '';
  const leader = $('#tb_leader')?.value?.trim?.() || '';
  const notes  = $('#tb_topics')?.value?.trim?.() || '';
  if (!site || !date || !leader) { alert('Please fill Site, Date, and Discussion Leader.'); return; }

  const rows = attendeesTableBody ? Array.from(attendeesTableBody.querySelectorAll('tr')) : [];
  const attendees = rows.map(tr => {
    const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.att-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? sigPads.get(rowId) : null;
    const signed = pad && typeof pad.isEmpty === 'function' ? !pad.isEmpty() : false;
    return { name, role_on_site: role, signature_png: signed && pad?.toDataURL ? pad.toDataURL('image/png') : null };
  }).filter(a => a.name);

  const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };
  try {
    await sendToFunction('E', payload);
    alert('Toolbox submitted. Email sent.');
    tbForm.reset();
    if (attendeesTableBody) { attendeesTableBody.innerHTML = ''; sigPads.clear(); seedToolbox(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'E', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM D — PPE CHECK
========================= */
const ppeForm = $('#ppeForm');
$('#ppe_date') && ($('#ppe_date').value = todayISO());

const ppeTableBody = ensureTBody('ppeTable');
const ppeAddRowBtn = $('#ppeAddRowBtn');

function ppeRowTemplate() {
  return `
    <td><input type="text" class="ppe-name" placeholder="Full name" required></td>
    <td>
      <select class="ppe-role">
        <option value="worker">Worker</option>
        <option value="foreman">Foreman</option>
        <option value="supervisor">Supervisor</option>
        <option value="visitor">Visitor</option>
      </select>
    </td>
    <td><input type="checkbox" class="ppe-shoes"   checked></td>
    <td><input type="checkbox" class="ppe-vest"    checked></td>
    <td><input type="checkbox" class="ppe-plugs"   checked></td>
    <td><input type="checkbox" class="ppe-goggles" checked></td>
    <td><input type="checkbox" class="ppe-muffs"   checked></td>
    <td><input type="checkbox" class="ppe-gloves"  checked></td>
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
  `;
}
function addPPERow() {
  if (!ppeTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = ppeRowTemplate();
  ppeTableBody.appendChild(tr);
}
function seedPPE() {
  if (ppeTableBody && ppeTableBody.children.length === 0) { addPPERow(); addPPERow(); }
}
seedPPE();

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
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }

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
      gloves:  !!tr.querySelector('.ppe-gloves')?.checked,
    }
  })).filter(r => r.name);

  const nonCompliant = roster.some(r =>
    !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves
  );

  const payload = { site, date, checked_by: checker, roster, nonCompliant };
  try {
    const resp = await sendToFunction('D', payload);
    alert(resp && resp.emailed ? 'Submitted. Non-compliance emailed.' : 'Submitted.');
    ppeForm.reset();
    if (ppeTableBody) { ppeTableBody.innerHTML = ''; seedPPE(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'D', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM B — FIRST AID
========================= */
const faForm = $('#faForm');
$('#fa_date') && ($('#fa_date').value = todayISO());

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
  if (faTableBody && faTableBody.children.length === 0) { addItemRow(); addItemRow(); }
}
seedFirstAid();

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
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }

  const rows = faTableBody ? Array.from(faTableBody.querySelectorAll('tr')) : [];
  const items = rows.map(tr => {
    const name = tr.querySelector('.fa-name')?.value?.trim?.() || '';
    const qty  = parseInt(tr.querySelector('.fa-qty')?.value || '0', 10);
    const min  = parseInt(tr.querySelector('.fa-min')?.value || '0', 10);
    const exp  = tr.querySelector('.fa-exp')?.value || null;
    return { name, quantity: qty, min, expiry: exp };
  }).filter(i => i.name);

  const flagged = items.some(i => (i.quantity <= (i.min || 0)) ||
    (i.expiry && (within30Days(i.expiry) || (new Date(i.expiry) < new Date())))
  );

  const payload = { site, date, checked_by: checker, items, flagged };
  try {
    const resp = await sendToFunction('B', payload);
    alert(resp && resp.emailed ? 'Submitted. Restock/expiry emailed.' : 'Submitted.');
    faForm.reset();
    if (faTableBody) { faTableBody.innerHTML = ''; seedFirstAid(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'B', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM C — SITE INSPECTION
========================= */
const inspForm = $('#inspForm');
$('#insp_date') && ($('#insp_date').value = todayISO());

const inspRosterBody = ensureTBody('inspRoster');
const inspHazBody    = ensureTBody('inspHazards');

const inspAddWorker      = $('#inspAddWorker');
const inspAddHazard      = $('#inspAddHazard');
const inspApprover       = $('#insp_approver');
const inspApproverOther  = $('#insp_approver_other');
const inspSigCanvas      = $('#insp_approver_canvas');
let   inspSigPad         = null;

if (window.SignaturePad && inspSigCanvas) {
  try { inspSigPad = new SignaturePad(inspSigCanvas, { minWidth:.7, maxWidth:2.2, throttle:8 }); }
  catch (e) { console.warn('SignaturePad init failed for approval', e); }
}
$('#inspClearSig')?.addEventListener('click', () => { if (inspSigPad?.clear) inspSigPad.clear(); });

function addInspWorkerRow(){
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
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
  inspRosterBody.appendChild(tr);
}
function addInspHazardRow(){
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
    <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
  inspHazBody.appendChild(tr);
}

function seedInspection(){
  if (inspRosterBody && inspRosterBody.children.length === 0) addInspWorkerRow();
  if (inspHazBody    && inspHazBody.children.length    === 0) addInspHazardRow();
}
seedInspection();

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
  const site      = $('#insp_site')?.value?.trim?.() || '';
  const date      = $('#insp_date')?.value || '';
  const inspector = $('#insp_inspector')?.value?.trim?.() || '';
  if (!site || !date || !inspector) { alert('Please fill Site, Date, and Inspector.'); return; }

  const roster = inspRosterBody ? Array.from(inspRosterBody.querySelectorAll('tr')).map(tr => ({
    name: tr.querySelector('.iw-name')?.value?.trim?.() || '',
    role_on_site: tr.querySelector('.iw-role')?.value || 'worker'
  })).filter(r => r.name) : [];

  const hazards = inspHazBody ? Array.from(inspHazBody.querySelectorAll('tr')).map(tr => ({
    hazard:         tr.querySelector('.hz-desc')?.value?.trim?.() || '',
    location:       tr.querySelector('.hz-loc')?.value?.trim?.() || '',
    risk:           tr.querySelector('.hz-risk')?.value || 'Low',
    action:         tr.querySelector('.hz-action')?.value?.trim?.() || '',
    assigned_to:    tr.querySelector('.hz-assigned')?.value?.trim?.() || '',
    completed:      !!tr.querySelector('.hz-done')?.checked,
    completed_by:   tr.querySelector('.hz-doneby')?.value?.trim?.() || '',
    completed_date: tr.querySelector('.hz-donedate')?.value || null
  })).filter(h => h.hazard) : [];

  // Approver name
  let approver_name = inspApprover ? inspApprover.value : '';
  if (approver_name === 'Other') {
    const v = (inspApproverOther && inspApproverOther.value.trim()) || '';
    if (!v) { alert('Please type the approver name.'); return; }
    approver_name = v;
  }
  // Require a signature
  if (!inspSigPad || (inspSigPad.isEmpty && inspSigPad.isEmpty())) {
    alert('HSE approval signature is required.');
    return;
  }
  const approver_signature_png = (inspSigPad && inspSigPad.toDataURL) ? inspSigPad.toDataURL('image/png') : null;

  const openHazards = hazards.some(h => !h.completed);
  const payload = { site, date, inspector, roster, hazards, openHazards, approved:true, approver_name, approver_signature_png };

  try {
    const resp = await sendToFunction('C', payload);
    alert(resp && resp.emailed ? 'Submitted. Open hazards emailed.' : 'Submitted.');
    inspForm.reset();
    if (inspRosterBody) { inspRosterBody.innerHTML = ''; }
    if (inspHazBody)    { inspHazBody.innerHTML    = ''; }
    seedInspection();
    if (inspSigPad?.clear) inspSigPad.clear();
    if (inspApprover) inspApprover.value = 'Krista';
    if (inspApproverOther) inspApproverOther.value = '';
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'C', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FORM A — EMERGENCY DRILL
========================= */
const drForm = $('#drForm');
$('#dr_date') && ($('#dr_date').value = todayISO());

const drRosterBody = ensureTBody('drRoster');
const drAddPartBtn = $('#drAddPart');

const drSigPads = new Map();
let drRowCount = 0;

function addDrillParticipantRow() {
  if (!drRosterBody) return;
  drRowCount++;
  const id = `drp_${drRowCount}`;
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
    try { const pad = new SignaturePad(canvas, { minWidth:.7, maxWidth:2.2, throttle:8 }); drSigPads.set(id, pad); }
    catch (e) { console.warn('SignaturePad init (drill) failed:', e); }
  }
}
function seedDrill() {
  if (drRosterBody && drRosterBody.children.length === 0) { addDrillParticipantRow(); addDrillParticipantRow(); }
}
seedDrill();

drAddPartBtn?.addEventListener('click', addDrillParticipantRow);
drRosterBody?.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  const tr = btn.closest('tr');
  const rowId = tr ? tr.dataset.rowId : null;
  const act = btn.dataset.act;
  if (act === 'remove' && tr) { if (rowId) drSigPads.delete(rowId); tr.remove(); }
  if (act === 'clear' && rowId) { const pad = drSigPads.get(rowId); if (pad?.clear) pad.clear(); }
});

drForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = $('#dr_site')?.value?.trim?.() || '';
  const date = $('#dr_date')?.value || '';
  const supervisor = $('#dr_supervisor')?.value?.trim?.() || '';
  if (!site || !date || !supervisor) { alert('Please fill Site, Date, and Supervisor.'); return; }

  const participants = drRosterBody ? Array.from(drRosterBody.querySelectorAll('tr')).map(tr => {
    const name = tr.querySelector('.dr-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.dr-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? drSigPads.get(rowId) : null;
    const signature_png = (pad && !pad.isEmpty?.()) ? (pad.toDataURL ? pad.toDataURL('image/png') : null) : null;
    return { name, role_on_site: role, signature_png };
  }).filter(p => p.name) : [];

  const payload = {
    site,
    date,
    supervisor,
    drill_type: $('#dr_type')?.value || '',
    start_time: $('#dr_start')?.value || '',
    end_time:   $('#dr_end')?.value || '',
    scenario_notes: $('#dr_notes')?.value?.trim?.() || '',
    participants,
    evaluation: $('#dr_eval')?.value?.trim?.() || '',
    follow_up_actions: $('#dr_follow')?.value?.trim?.() || '',
    next_drill_date: $('#dr_next')?.value || '',
    issues: !!$('#dr_issues')?.checked,
  };

  try {
    const resp = await sendToFunction('A', payload);
    alert(resp && resp.emailed ? 'Submitted. HSE notified.' : 'Submitted.');
    drForm.reset();
    if (drRosterBody) { drRosterBody.innerHTML = ''; }
    seedDrill();
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'A', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   LOGBOOK — list & export
========================= */
const lgSite   = $('#lg_site');
const lgFrom   = $('#lg_from');
const lgTo     = $('#lg_to');
const lgForm   = $('#lg_form');
const lgLoad   = $('#lg_load');
const lgExport = $('#lg_export');
const lgBody   = $('#lg_table')?.querySelector('tbody') || null;

function fmtSummary(row){
  const t = row.form_type; const p = row.payload || {};
  if (t === 'E') return `Leader: ${p.submitted_by||''}; Attendees: ${Array.isArray(p.attendees)?p.attendees.length:0}`;
  if (t === 'D') return `Checked by: ${p.checked_by||''}; Non-compliance: ${p.nonCompliant?'YES':'No'}`;
  if (t === 'B') return `Checked by: ${p.checked_by||''}; Flagged: ${p.flagged?'YES':'No'}`;
  if (t === 'C') return `Inspector: ${p.inspector||''}; Open hazards: ${p.openHazards? 'YES':'No'}`;
  if (t === 'A') return `Supervisor: ${p.supervisor||''}; Issues: ${p.issues? 'YES':'No'}`;
  return '';
}

function renderRows(rows){
  if (!lgBody) return;
  lgBody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const d = (r.date || '').slice(0,10);
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${d}</td>
      <td>${r.form_type}</td>
      <td>${r.site||''}</td>
      <td>${fmtSummary(r)}</td>
      <td>
        <details>
          <summary>View</summary>
          <pre style="white-space:pre-wrap; word-break:break-word; max-width:60ch;">${JSON.stringify(r.payload, null, 2)}</pre>
        </details>
      </td>`;
    lgBody.appendChild(tr);
  });
}

async function fetchLog(){
  const body = {
    site: (lgSite && lgSite.value.trim()) || undefined,
    formType: (lgForm && lgForm.value) || undefined,
    from: (lgFrom && lgFrom.value) || undefined,
    to: (lgTo && lgTo.value) || undefined,
    limit: 100
  };
  const data = await jsonFetch(LIST_URL, { body });
  if (!data.ok) throw new Error(data.error || 'load_failed');
  renderRows(data.rows || []);
  window._logRows = data.rows || [];
}

function toCSV(rows){
  const header = ['id','date','form_type','site','summary'];
  const lines = [header.join(',')];
  const esc = v => '"' + String(v).replaceAll('"','""') + '"';
  rows.forEach(r => {
    const row = [r.id, (r.date||'').slice(0,10), r.form_type, r.site||'', fmtSummary(r)];
    lines.push(row.map(esc).join(','));
  });
  return lines.join('\n');   // ← fixed (previous bad newline caused SyntaxError)
}

if (lgLoad && !lgLoad.dataset.bound) {
  lgLoad.dataset.bound = '1';
  lgLoad.addEventListener('click', async ()=>{
    try { await fetchLog(); } catch(e){ console.error(e); alert('Failed to load log.'); }
  });
}

lgExport?.addEventListener('click', ()=>{
  const rows = window._logRows || [];
  if (!rows.length) { alert('Nothing to export. Load the log first.'); return; }
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ywi-log.csv'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
});

/* =========================
   SEED ALL TABLES ON VIEW
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
document.addEventListener('DOMContentLoaded', () => {
  applyDateFallback();
  renderByAuth();          // shows login or app
  // Also seed on initial load; renderByAuth will seed again when authed
  seedAllTables();
});
window.addEventListener('hashchange', () => setTimeout(seedAllTables, 0));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(seedAllTables, 0);
});




