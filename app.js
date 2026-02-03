/* =========================
   CONFIG
========================= */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';
const LIST_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/clever-endpoint';

const SUPABASE_ANON_KEY = ''; // leave '' if your function is public (Verify JWT OFF)
const OUTBOX_KEY = 'ywi_outbox_v1';

/* =========================
   HELPERS
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
function setOutbox(list) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

async function sendToFunction(formType, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ formType, payload })
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Function error', res.status, text);
    throw new Error(text || `HTTP ${res.status}`);
  }
  try { return JSON.parse(text); } catch { return { ok: true }; }
}

async function flushOutbox() {
  const outbox = getOutbox();
  if (!outbox.length) { alert('Outbox is empty.'); return; }
  const remaining = [];
  for (const item of outbox) {
    try { await sendToFunction(item.formType, item.payload); }
    catch { remaining.push(item); }
  }
  setOutbox(remaining);
  alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}
document.querySelectorAll('[data-role="retry-outbox"]').forEach(btn =>
  btn.addEventListener('click', flushOutbox)
);

/* =========================
   TOOLBOX TALK (E)
========================= */
const tbForm = document.getElementById('toolboxForm');
const tbDate = document.getElementById('tb_date');
if (tbDate) tbDate.value = todayISO();

const attendeesTableBody = ensureTBody('attendeesTable');
const addRowBtn = document.getElementById('addRowBtn');

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

  // Optional signatures if SignaturePad is loaded via CDN
  const canvas = tr.querySelector('canvas');
  if (window.SignaturePad && canvas) {
    try {
      // eslint-disable-next-line no-undef
      const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.5, throttle: 8 });
      sigPads.set(id, pad);
    } catch (e) {
      console.warn('SignaturePad init failed:', e);
    }
  }
}

if (addRowBtn) addRowBtn.addEventListener('click', () => addAttendeeRow());
if (attendeesTableBody) {
  attendeesTableBody.addEventListener('click', (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
    if (!btn) return;
    const tr = btn.closest('tr');
    const rowId = tr ? tr.dataset.rowId : null;
    const act = btn.dataset.act;
    if (act === 'remove' && tr) { if (rowId) sigPads.delete(rowId); tr.remove(); }
    if (act === 'clear' && rowId) { const pad = sigPads.get(rowId); if (pad && pad.clear) pad.clear(); }
  });

  // default two rows
  addAttendeeRow();
  addAttendeeRow();
}

if (tbForm) tbForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site   = (document.getElementById('tb_site')   || {}).value?.trim?.() || '';
  const date   = (document.getElementById('tb_date')   || {}).value || '';
  const leader = (document.getElementById('tb_leader') || {}).value?.trim?.() || '';
  const notes  = (document.getElementById('tb_topics') || {}).value?.trim?.() || '';

  if (!site || !date || !leader) { alert('Please fill Site, Date, and Discussion Leader.'); return; }

  const rows = attendeesTableBody ? Array.from(attendeesTableBody.querySelectorAll('tr')) : [];
  const attendees = rows.map(tr => {
    const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
    const role = tr.querySelector('.att-role')?.value || 'worker';
    const rowId = tr.dataset.rowId;
    const pad = rowId ? sigPads.get(rowId) : null;
    const signed = pad && typeof pad.isEmpty === 'function' ? !pad.isEmpty() : false;
    return { name, role_on_site: role, signature_png: signed && pad.toDataURL ? pad.toDataURL('image/png') : null };
  }).filter(a => a.name);

  const payload = { site, date, submitted_by: leader, topic_notes: notes, attendees };

  try {
    await sendToFunction('E', payload);
    alert('Toolbox submitted. Email sent.');
    tbForm.reset();
    if (attendeesTableBody) { attendeesTableBody.innerHTML = ''; sigPads.clear(); addAttendeeRow(); addAttendeeRow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'E', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   PPE CHECK (D)
========================= */
const ppeForm = document.getElementById('ppeForm');
const ppeDate = document.getElementById('ppe_date');
if (ppeDate) ppeDate.value = todayISO();

const ppeTableBody = ensureTBody('ppeTable');
const ppeAddRowBtn = document.getElementById('ppeAddRowBtn');

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

if (ppeAddRowBtn) ppeAddRowBtn.addEventListener('click', addPPERow);
if (ppeTableBody) { addPPERow(); addPPERow(); }
if (ppeTableBody) ppeTableBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
  }
});

if (ppeForm) ppeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site    = (document.getElementById('ppe_site')    || {}).value?.trim?.() || '';
  const date    = (document.getElementById('ppe_date')    || {}).value || '';
  const checker = (document.getElementById('ppe_checker') || {}).value?.trim?.() || '';
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
    if (ppeTableBody) { ppeTableBody.innerHTML = ''; addPPERow(); addPPERow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'D', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});

/* =========================
   FIRST AID KIT (B)
========================= */
const faForm = document.getElementById('faForm');
const faDate = document.getElementById('fa_date');
if (faDate) faDate.value = todayISO();

const faTableBody = ensureTBody('faTable');
const faAddRowBtn = document.getElementById('faAddRowBtn');

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
if (faAddRowBtn) faAddRowBtn.addEventListener('click', addItemRow);
if (faTableBody) { addItemRow(); addItemRow(); }
if (faTableBody) faTableBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
  }
});

function within30Days(iso) {
  if (!iso) return false;
  const now = new Date();
  const d = new Date(iso);
  const diffDays = (d.getTime() - now.getTime()) / 86400000;
  return diffDays <= 30;
}

if (faForm) faForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site    = (document.getElementById('fa_site')    || {}).value?.trim?.() || '';
  const date    = (document.getElementById('fa_date')    || {}).value || '';
  const checker = (document.getElementById('fa_checker') || {}).value?.trim?.() || '';
  if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }

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

  const payload = { site, date, checked_by: checker, items, flagged };

  try {
    const resp = await sendToFunction('B', payload);
    alert(resp && resp.emailed ? 'Submitted. Restock/expiry emailed.' : 'Submitted.');
    faForm.reset();
    if (faTableBody) { faTableBody.innerHTML = ''; addItemRow(); addItemRow(); }
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'B', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});
/* =========================
   SITE INSPECTION (C)
========================= */
const inspForm = document.getElementById('inspForm');
const inspDate = document.getElementById('insp_date');
if (inspDate) inspDate.value = todayISO();

// 1) Get TBODY refs FIRST (no IIFEs)
const inspRosterBody = ensureTBody('inspRoster');
const inspHazBody    = ensureTBody('inspHazards');

const inspAddWorker = document.getElementById('inspAddWorker');
const inspAddHazard = document.getElementById('inspAddHazard');
const inspApprover       = document.getElementById('insp_approver');
const inspApproverOther  = document.getElementById('insp_approver_other');
const inspSigCanvas      = document.getElementById('insp_approver_canvas');
let   inspSigPad         = null;

if (window.SignaturePad && inspSigCanvas) {
  try { inspSigPad = new SignaturePad(inspSigCanvas, { minWidth: 0.7, maxWidth: 2.2, throttle: 8 }); }
  catch (e) { console.warn('SignaturePad init failed for approval', e); }
}
const inspClearSigBtn = document.getElementById('inspClearSig');
if (inspClearSigBtn) inspClearSigBtn.addEventListener('click', () => { if (inspSigPad && inspSigPad.clear) inspSigPad.clear(); });

// 2) Row builders
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

// 3) Seed default rows AFTER functions exist
if (inspRosterBody && inspRosterBody.children.length === 0) addInspWorkerRow();
if (inspHazBody && inspHazBody.children.length === 0) addInspHazardRow();

// 4) Listeners
if (inspAddWorker) inspAddWorker.addEventListener('click', addInspWorkerRow);
if (inspAddHazard) inspAddHazard.addEventListener('click', addInspHazardRow);

if (inspRosterBody) inspRosterBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr'); if (tr) tr.remove();
  }
});

if (inspHazBody) inspHazBody.addEventListener('click', (e) => {
  const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
  if (!btn) return;
  if (btn.dataset.act === 'remove') {
    const tr = btn.closest('tr'); if (tr) tr.remove();
  }
});

if (inspForm) inspForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site      = (document.getElementById('insp_site')      || {}).value?.trim?.() || '';
  const date      = (document.getElementById('insp_date')      || {}).value || '';
  const inspector = (document.getElementById('insp_inspector') || {}).value?.trim?.() || '';
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
// derive approver name
let approver_name = inspApprover ? inspApprover.value : '';
if (approver_name === 'Other') {
  const v = (inspApproverOther && inspApproverOther.value.trim()) || '';
  if (!v) { alert('Please type the approver name.'); return; }
  approver_name = v;
}

// require a signature
if (!inspSigPad || (inspSigPad.isEmpty && inspSigPad.isEmpty())) {
  alert('HSE approval signature is required.');
  return;
}
const approver_signature_png = (inspSigPad && inspSigPad.toDataURL) ? inspSigPad.toDataURL('image/png') : null;

  const openHazards = hazards.some(h => !h.completed);
  const payload = { site, date, inspector, roster, hazards, openHazards, approved: true, approver_name, approver_signature_png,};

  try {
    const resp = await sendToFunction('C', payload);
    alert(resp && resp.emailed ? 'Submitted. Open hazards emailed.' : 'Submitted.');
    inspForm.reset();
    if (inspRosterBody) { inspRosterBody.innerHTML = ''; addInspWorkerRow(); }
    if (inspHazBody)    { inspHazBody.innerHTML    = ''; addInspHazardRow(); }
     if (inspSigPad && inspSigPad.clear) inspSigPad.clear();
if (inspApprover) inspApprover.value = 'Krista';
if (inspApproverOther) inspApproverOther.value = '';
  } catch (err) {
    const out = getOutbox(); out.push({ ts: Date.now(), formType: 'C', payload }); setOutbox(out);
    alert('Offline/server error. Saved to Outbox.');
  }
});


/* =========================
========================= */



const lgSite = document.getElementById('lg_site');
const lgFrom = document.getElementById('lg_from');
const lgTo = document.getElementById('lg_to');
const lgForm = document.getElementById('lg_form');
const lgLoad = document.getElementById('lg_load');
const lgExport= document.getElementById('lg_export');
const lgTable = document.getElementById('lg_table');
const lgBody = lgTable ? lgTable.querySelector('tbody') : null;


function fmtSummary(row){
const t = row.form_type;
const p = row.payload || {};
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
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const body = {
    site: (lgSite && lgSite.value.trim()) || undefined,
    formType: (lgForm && lgForm.value) || undefined,
    from: (lgFrom && lgFrom.value) || undefined,
    to: (lgTo && lgTo.value) || undefined,
    limit: 100
  };

  let res, text;
  try {
    res = await fetch(LIST_URL, { method:'POST', headers, body: JSON.stringify(body) });
    text = await res.text();
  } catch (e) {
    console.error('Network/Fetch error:', e);
    alert('Failed to load log (network).');
    throw e;
  }

  if (!res.ok) {
    console.error('HTTP error:', res.status, text);
    alert(`Failed to load log (HTTP ${res.status}).`);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  let data;
  try { data = JSON.parse(text); }
  catch {
    console.error('Bad JSON:', text);
    alert('Failed to load log (bad JSON).');
    throw new Error('Bad JSON');
  }

  if (!data.ok) {
    console.error('Function error payload:', data);
    alert(`Failed to load log: ${data.error || 'unknown error'}`);
    throw new Error(data.error || 'load_failed');
  }

  renderRows(data.rows || []);
  window._logRows = data.rows || [];
}


function toCSV(rows){
const header = ['id','date','form_type','site','summary'];
const lines = [header.join(',')];
rows.forEach(r => {
const row = [r.id, (r.date||'').slice(0,10), r.form_type, r.site||'', fmtSummary(r)];
const esc = v => '"' + String(v).replaceAll('"','""') + '"';
lines.push(row.map(esc).join(','));
});
return lines.join('\n');
}


if (lgLoad) lgLoad.addEventListener('click', async ()=>{
try { await fetchLog(); } catch(e){ alert('Failed to load log.'); }
});


if (lgExport) lgExport.addEventListener('click', ()=>{
const rows = window._logRows || [];
if (!rows.length) { alert('Nothing to export. Load the log first.'); return; }
const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'ywi-log.csv'; a.click();
setTimeout(()=> URL.revokeObjectURL(url), 1000);
});







