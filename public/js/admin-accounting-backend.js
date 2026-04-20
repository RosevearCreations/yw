// File: /public/js/admin-accounting-backend.js
// Brief description: Starter accounting backend UI for GL, expenses, write-offs, product costs, and export presets.

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("accountingBackendMount");
  if (!mount || !window.DDAuth) return;

  mount.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Accounting Backend (Starter)</h2>
      <p class="small">Track general ledger accounts, operating expenses, overhead allocations, write-offs, unit costs, and export presets for accountants.</p>
      <div id="accountingBackendMessage" class="small" style="display:none;margin-top:10px"></div>
    </div>
    <div class="grid cols-2" style="gap:18px;margin-top:18px">
      <div class="card" id="gl-accounts">
        <h3 style="margin-top:0">General ledger accounts</h3>
        <form id="glAccountForm" class="grid" style="gap:8px">
          <input name="code" type="text" placeholder="6100" />
          <input name="name" type="text" placeholder="Electricity" />
          <select name="category"><option value="expense">Expense</option><option value="income">Income</option><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option></select>
          <button class="btn primary" type="submit">Add GL account</button>
        </form>
        <div id="glAccountsList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="expense-entry">
        <h3 style="margin-top:0">Expense entry</h3>
        <form id="expenseForm" class="grid" style="gap:8px">
          <input name="expense_date" type="date"/>
          <input name="vendor_name" type="text" placeholder="Hydro One"/>
          <input name="amount" type="number" step="0.01" placeholder="0.00"/>
          <input name="tax_amount" type="number" step="0.01" placeholder="Tax amount"/>
          <select name="ledger_code" id="expenseLedgerCode"></select>
          <textarea name="notes" rows="3" placeholder="Bill, invoice, or cost notes"></textarea>
          <button class="btn primary" type="submit">Add expense</button>
        </form>
        <div id="expensesList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="overhead-allocation">
        <h3 style="margin-top:0">Overhead allocation</h3>
        <form id="overheadForm" class="grid" style="gap:8px">
          <input name="period_month" type="month"/>
          <input name="ledger_code" type="text" placeholder="6200"/>
          <input name="ledger_name" type="text" placeholder="Rent allocation"/>
          <select name="allocation_basis"><option value="manual">Manual</option><option value="revenue">Revenue</option><option value="orders">Orders</option><option value="units">Units</option></select>
          <input name="amount" type="number" step="0.01" placeholder="Allocated amount"/>
          <textarea name="notes" rows="3" placeholder="How this overhead should flow into rough P&amp;L or later item costs"></textarea>
          <button class="btn primary" type="submit">Save overhead allocation</button>
        </form>
        <div id="overheadList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="writeoff-entry">
        <h3 style="margin-top:0">Write-off entry</h3>
        <form id="writeoffForm" class="grid" style="gap:8px">
          <input name="writeoff_date" type="date"/>
          <input name="item_name" type="text" placeholder="Broken silicone mold"/>
          <input name="amount" type="number" step="0.01" placeholder="Total write-off"/>
          <select name="reason_code"><option value="damaged">Damaged</option><option value="obsolete">Obsolete</option><option value="gifted">Gifted</option><option value="lost">Lost</option><option value="other">Other</option></select>
          <textarea name="notes" rows="3" placeholder="Reason and details"></textarea>
          <button class="btn primary" type="submit">Add write-off</button>
        </form>
        <div id="writeoffsList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="product-costs">
        <h3 style="margin-top:0">Product unit costs</h3>
        <form id="productCostForm" class="grid" style="gap:8px">
          <input name="product_number" type="text" placeholder="DD1000"/>
          <input name="cost_per_unit" type="number" step="0.01" placeholder="Cost per unit"/>
          <input name="effective_date" type="date"/>
          <textarea name="notes" rows="3" placeholder="Material, labour, overhead notes"></textarea>
          <button class="btn primary" type="submit">Add cost</button>
        </form>
        <div id="productCostsList" class="small" style="margin-top:10px"></div>
      </div>
    </div>
    <div class="card" id="export-presets" style="margin-top:18px">
      <h3 style="margin-top:0">Export presets</h3>
      <div class="grid cols-3" style="gap:12px;align-items:end">
        <div><label class="small" for="monthlyExportMonth">Month-end</label><input id="monthlyExportMonth" type="month"/></div>
        <div><label class="small" for="quarterExportPeriod">Quarter-end</label><input id="quarterExportPeriod" type="text" placeholder="2026-Q2"/></div>
        <div><label class="small" for="yearExportPeriod">Year-end</label><input id="yearExportPeriod" type="number" min="2000" max="2100" placeholder="2026"/></div>
      </div>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="downloadMonthlyExportButton" type="button">Download Month CSV</button>
        <button class="btn" id="downloadQuarterExportButton" type="button">Download Quarter CSV</button>
        <button class="btn" id="downloadYearExportButton" type="button">Download Year CSV</button>
      </div>
    </div>`;

  const message = mount.querySelector('#accountingBackendMessage');
  const state = { gl: [] };

  function activeMonth() {
    return String(mount.querySelector('#monthlyExportMonth')?.value || new Date().toISOString().slice(0,7));
  }

  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.style.display = text ? 'block' : 'none';
    message.style.color = isError ? '#b00020' : '';
  }

  function renderSmallList(el, rows, formatter) {
    if (!el) return;
    if (!rows.length) { el.innerHTML = '<div>No entries yet.</div>'; return; }
    el.innerHTML = rows.slice(0, 8).map(formatter).join('');
  }

  function glOptionsHtml(selected = '') {
    return state.gl.map((row) => `<option value="${row.code || ''}" ${String(row.code||'')===String(selected||'') ? 'selected' : ''}>${row.code || ''} — ${row.name || ''}</option>`).join('');
  }

  async function readJson(response, fallback) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(fallback);
    return response.json();
  }

  async function loadGl() {
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts');
    const data = await readJson(response, 'General ledger endpoint is unavailable.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading GL accounts.');
    state.gl = Array.isArray(data.accounts) ? data.accounts : [];
    const select = mount.querySelector('#expenseLedgerCode');
    if (select) select.innerHTML = `<option value="">Select account</option>${glOptionsHtml()}`;
    renderSmallList(mount.querySelector('#glAccountsList'), state.gl, (row) => `<div>${row.code || ''} — ${row.name || ''} <span class="small">(${row.category || 'expense'})</span></div>`);
  }

  async function loadExpenses() {
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-expenses');
    const data = await readJson(response, 'Expenses endpoint is unavailable.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading expenses.');
    renderSmallList(mount.querySelector('#expensesList'), Array.isArray(data.expenses) ? data.expenses : [], (row) => `<div>${row.expense_date || row.created_at || ''} — ${row.vendor_name || ''} — $${Number(row.amount || 0).toFixed(2)} ${row.ledger_code ? `(${row.ledger_code})` : ''}</div>`);
  }


  async function loadOverhead() {
    const response = await window.DDAuth.apiFetch(`/api/admin/accounting-overhead-allocations?month=${encodeURIComponent(activeMonth())}`);
    const data = await readJson(response, 'Overhead endpoint is unavailable.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading overhead allocations.');
    renderSmallList(mount.querySelector('#overheadList'), Array.isArray(data.allocations) ? data.allocations : [], (row) => `<div>${row.period_month || ''} — ${row.ledger_code || ''} — $${Number(row.amount || 0).toFixed(2)} <span class="small">(${row.allocation_basis || 'manual'})</span></div>`);
  }

  async function loadWriteoffs() {
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-writeoffs');
    const data = await readJson(response, 'Write-off endpoint is unavailable.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading write-offs.');
    renderSmallList(mount.querySelector('#writeoffsList'), Array.isArray(data.writeoffs) ? data.writeoffs : [], (row) => `<div>${row.writeoff_date || row.created_at || ''} — ${row.item_name || ''} — $${Number(row.amount || 0).toFixed(2)} (${row.reason_code || 'other'})</div>`);
  }

  async function loadProductCosts() {
    const response = await window.DDAuth.apiFetch('/api/admin/product-costs');
    const data = await readJson(response, 'Product cost endpoint is unavailable.');
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading product costs.');
    renderSmallList(mount.querySelector('#productCostsList'), Array.isArray(data.product_costs) ? data.product_costs : [], (row) => `<div>${row.product_number || ''} — $${Number(row.cost_per_unit || 0).toFixed(2)} <span class="small">${row.effective_date || ''}</span></div>`);
  }

  async function refreshAll() {
    await loadGl();
    await Promise.all([loadExpenses(), loadOverhead(), loadWriteoffs(), loadProductCosts()]);
  }

  mount.querySelector('#glAccountForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { code: form.code.value, name: form.name.value, category: form.category.value };
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readJson(response, 'GL account save failed.');
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving GL account.', true);
    form.reset();
    setMessage('General ledger account saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });

  mount.querySelector('#expenseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-expenses', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readJson(response, 'Expense save failed.');
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving expense.', true);
    form.reset();
    setMessage('Expense saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });


  mount.querySelector('#overheadForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-overhead-allocations', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readJson(response, 'Overhead save failed.');
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving overhead allocation.', true);
    setMessage('Overhead allocation saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });

  mount.querySelector('#writeoffForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-writeoffs', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readJson(response, 'Write-off save failed.');
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving write-off.', true);
    form.reset();
    setMessage('Write-off saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });

  mount.querySelector('#productCostForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await window.DDAuth.apiFetch('/api/admin/product-costs', { method: 'POST', body: JSON.stringify(payload) });
    const data = await readJson(response, 'Product cost save failed.');
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving product cost.', true);
    form.reset();
    setMessage('Product cost saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });

  async function downloadCsv(url, fallbackName) {
    const response = await window.DDAuth.apiFetch(url);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return setMessage(data?.error || 'Failed generating export.', true);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  mount.querySelector('#downloadMonthlyExportButton')?.addEventListener('click', async () => {
    const month = mount.querySelector('#monthlyExportMonth')?.value;
    if (!month) return setMessage('Choose a month before downloading the export.', true);
    await downloadCsv(`/api/admin/accounting-monthly-summary-export?month=${encodeURIComponent(month)}`, `devilndove-accounting-${month}.csv`);
  });

  mount.querySelector('#downloadQuarterExportButton')?.addEventListener('click', async () => {
    const quarter = String(mount.querySelector('#quarterExportPeriod')?.value || '').trim();
    if (!quarter) return setMessage('Enter a quarter like 2026-Q2.', true);
    await downloadCsv(`/api/admin/accounting-period-summary-export?scope=quarter&period=${encodeURIComponent(quarter)}`, `devilndove-accounting-${quarter}.csv`);
  });

  mount.querySelector('#downloadYearExportButton')?.addEventListener('click', async () => {
    const year = String(mount.querySelector('#yearExportPeriod')?.value || '').trim();
    if (!year) return setMessage('Choose a year first.', true);
    await downloadCsv(`/api/admin/accounting-period-summary-export?scope=year&period=${encodeURIComponent(year)}`, `devilndove-accounting-${year}.csv`);
  });

  const monthlyInput = mount.querySelector('#monthlyExportMonth');
  if (monthlyInput && !monthlyInput.value) monthlyInput.value = new Date().toISOString().slice(0,7);
  const overheadMonth = mount.querySelector('#overheadForm [name=period_month]');
  if (overheadMonth && !overheadMonth.value) overheadMonth.value = activeMonth();

  refreshAll().then(() => {
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }).catch((error) => setMessage(String(error?.message || error || 'Failed loading accounting tools.'), true));
});
