/* CONFIG: replace with your deployed function URL */
const FUNCTION_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/resend-email';
const OUTBOX_KEY = 'ywi_outbox_v1';

</td>
<td><input type="checkbox" class="ppe-shoes" checked></td>
<td><input type="checkbox" class="ppe-vest" checked></td>
<td><input type="checkbox" class="ppe-plugs" checked></td>
<td><input type="checkbox" class="ppe-goggles" checked></td>
<td><input type="checkbox" class="ppe-muffs" checked></td>
<td><input type="checkbox" class="ppe-gloves" checked></td>
<td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
}
function addPPERow(){ if (!ppeTableBody) return; ppeRowCount++; const tr = document.createElement('tr'); tr.dataset.rowId = `pr_${ppeRowCount}`; tr.innerHTML = ppeRowTemplate(); ppeTableBody.appendChild(tr); }
if (ppeAddRowBtn) ppeAddRowBtn.addEventListener('click', addPPERow);
if (ppeTableBody) { addPPERow(); addPPERow(); }
if (ppeTableBody) ppeTableBody.addEventListener('click', (e)=>{ const btn = e.target && e.target.closest ? e.target.closest('button') : null; if(!btn) return; if(btn.dataset.act==='remove'){ const tr = btn.closest('tr'); if (tr) tr.remove(); }});


if (ppeForm) ppeForm.addEventListener('submit', async (e) => {
e.preventDefault();
const site = document.getElementById('ppe_site').value.trim();
const date = document.getElementById('ppe_date').value;
const checker = document.getElementById('ppe_checker').value.trim();
if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }
const rows = Array.from(ppeTableBody.querySelectorAll('tr')).map(tr => ({
name: tr.querySelector('.ppe-name').value.trim(),
role_on_site: tr.querySelector('.ppe-role').value,
items: {
shoes: tr.querySelector('.ppe-shoes').checked,
vest: tr.querySelector('.ppe-vest').checked,
plugs: tr.querySelector('.ppe-plugs').checked,
goggles: tr.querySelector('.ppe-goggles').checked,
muffs: tr.querySelector('.ppe-muffs').checked,
gloves: tr.querySelector('.ppe-gloves').checked,
}
})).filter(r => r.name);
const nonCompliant = rows.some(r => !r.items.shoes || !r.items.vest || !r.items.plugs || !r.items.goggles || !r.items.muffs || !r.items.gloves);
const payload = { site, date, checked_by: checker, roster: rows, nonCompliant };
try { const resp = await sendToFunction('D', payload); alert(resp.emailed ? 'Submitted. Non-compliance emailed.' : 'Submitted.'); ppeForm.reset(); if (ppeTableBody){ ppeTableBody.innerHTML=''; addPPERow(); addPPERow(); } }
catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'D', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});


// ===== First Aid (B) UI logic =====
let faRowCount = 0;
function addItemRow(){
if (!faTableBody) return;
faRowCount++;
const tr = document.createElement('tr');
tr.innerHTML = `
<td><input type="text" class="fa-name" placeholder="e.g., Bandages" required></td>
<td><input type="number" class="fa-qty" min="0" value="0"></td>
<td><input type="number" class="fa-min" min="0" value="0"></td>
<td><input type="date" class="fa-exp"></td>
<td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>`;
faTableBody.appendChild(tr);
}
if (faAddRowBtn) faAddRowBtn.addEventListener('click', addItemRow);
if (faTableBody) { addItemRow(); addItemRow(); }
if (faTableBody) faTableBody.addEventListener('click', (e)=>{ const btn = e.target && e.target.closest ? e.target.closest('button') : null; if(!btn) return; if(btn.dataset.act==='remove'){ const tr = btn.closest('tr'); if (tr) tr.remove(); }});


function within30Days(iso){ if(!iso) return false; const now=new Date(); const d=new Date(iso); const diff=(d.getTime()-now.getTime())/(1000*60*60*24); return diff<=30; }


if (faForm) faForm.addEventListener('submit', async (e)=>{
e.preventDefault();
const site = document.getElementById('fa_site').value.trim();
const date = document.getElementById('fa_date').value;
const checker = document.getElementById('fa_checker').value.trim();
if (!site || !date || !checker) { alert('Please fill Site, Date, and Checked By.'); return; }
const items = Array.from(faTableBody.querySelectorAll('tr')).map(tr=>{
const name = tr.querySelector('.fa-name').value.trim();
const qty = parseInt(tr.querySelector('.fa-qty').value || '0',10);
const min = parseInt(tr.querySelector('.fa-min').value || '0',10);
const expiry = tr.querySelector('.fa-exp').value || null;
return { name, quantity: qty, min, expiry };
}).filter(i=>i.name);
const flagged = items.some(i => (i.quantity <= (i.min||0)) || (i.expiry && (within30Days(i.expiry) || new Date(i.expiry) < new Date())) );
const payload = { site, date, checked_by: checker, items, flagged };
try { const resp = await sendToFunction('B', payload); alert(resp.emailed ? 'Submitted. Restock/expiry emailed.' : 'Submitted.'); faForm.reset(); if (faTableBody){ faTableBody.innerHTML=''; addItemRow(); addItemRow(); } }
catch(err){ const out = getOutbox(); out.push({ ts: Date.now(), formType:'B', payload }); setOutbox(out); alert('Offline/server error. Saved to Outbox.'); }
});
