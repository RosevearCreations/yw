/* CONFIG: replace with your deployed function URL */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';
const OUTBOX_KEY = 'ywi_outbox_v1';


// ===== Toolbox Talk (E) =====
const attendeesTableBody = document.getElementById('attendeesTable') ? document.getElementById('attendeesTable').querySelector('tbody') : null;
const addRowBtn = document.getElementById('addRowBtn');
const tbForm = document.getElementById('toolboxForm');
const tbDate = document.getElementById('tb_date');


// ===== PPE Check (D) =====
const ppeTableBody = document.getElementById('ppeTable') ? document.getElementById('ppeTable').querySelector('tbody') : null;
const ppeAddRowBtn = document.getElementById('ppeAddRowBtn');
const ppeForm = document.getElementById('ppeForm');
const ppeDate = document.getElementById('ppe_date');


// ===== First Aid (B) =====
const faTableBody = document.getElementById('faTable') ? document.getElementById('faTable').querySelector('tbody') : null;
const faAddRowBtn = document.getElementById('faAddRowBtn');
const faForm = document.getElementById('faForm');
const faDate = document.getElementById('fa_date');


// Default today date for any date inputs present
(function setTodayDates(){
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth()+1).padStart(2,'0');
const dd = String(today.getDate()).padStart(2,'0');
if (tbDate) tbDate.value = `${yyyy}-${mm}-${dd}`;
if (ppeDate) ppeDate.value = `${yyyy}-${mm}-${dd}`;
if (faDate) faDate.value = `${yyyy}-${mm}-${dd}`;
})();


// ---- Outbox helpers ----
function getOutbox(){ try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } }
function setOutbox(list){ localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }


async function sendToFunction(formType, payload){
const res = await fetch(FUNCTION_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ formType, payload })
});
const text = await res.text();
if (!res.ok) { console.error('Function error', res.status, text); throw new Error(text || `HTTP ${res.status}`); }
try { return JSON.parse(text); } catch { return { ok: true }; }
}


async function flushOutbox(){
const outbox = getOutbox();
if (!outbox.length) { alert('Outbox is empty.'); return; }
const remaining = [];
for (const item of outbox){
try { await sendToFunction(item.formType, item.payload); }
catch(e){ remaining.push(item); }
}
setOutbox(remaining);
alert(remaining.length ? `Some failed, ${remaining.length} left.` : 'All queued submissions sent.');
}


document.querySelectorAll('[data-role="retry-outbox"]').forEach(btn => btn.addEventListener('click', flushOutbox));


// ===== Toolbox Talk (E) UI logic =====
let tbRowCount = 0; const sigPads = new Map();
function addAttendeeRow(initialName = '', initialRole = '') {
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
});
