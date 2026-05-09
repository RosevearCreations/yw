// File: /public/js/admin-accounting-backend.js
// Brief description: Accounting backend UI with GL mapping, GIFI staging, GIFI review notes,
// month lock controls, and DB sanity tools.

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('accountingBackendMount');
  if (!mount || !window.DDAuth) return;

  mount.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Accounting Backend (Slow T2/GIFI Step)</h2>
      <p class="small">This pass keeps the accounting system moving slowly toward accountant-ready T2/GIFI support by adding reviewed GIFI mapping fields, accountant notes per GIFI line, Schedule 141 notes capture, month lock controls, and a live DB sanity check.</p>
      <div id="accountingBackendMessage" class="small" style="display:none;margin-top:10px"></div>
    </div>
    <div class="grid cols-2" style="gap:18px;margin-top:18px">
      <div class="card" id="gl-accounts">
        <h3 style="margin-top:0">General ledger accounts</h3>
        <form id="glAccountForm" class="grid" style="gap:8px">
          <div class="grid cols-2" style="gap:8px">
            <input name="code" type="text" placeholder="6100" />
            <input name="name" type="text" placeholder="Electricity" />
          </div>
          <div class="grid cols-3" style="gap:8px">
            <select name="category"><option value="expense">Expense</option><option value="income">Income</option><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option></select>
            <input name="parent_group" type="text" placeholder="utilities / revenue / current_assets" />
            <select name="normal_balance"><option value="debit">Debit</option><option value="credit">Credit</option></select>
          </div>
          <div class="grid cols-3" style="gap:8px">
            <input name="gifi_code" type="text" placeholder="9221" />
            <input name="gifi_label" type="text" placeholder="Electricity" />
            <select name="gifi_section"><option value="income_statement">Income statement</option><option value="balance_sheet">Balance sheet</option><option value="retained_earnings">Retained earnings</option><option value="other">Other / review later</option></select>
          </div>
          <div class="grid cols-3" style="gap:8px">
            <input name="tax_deductibility_percent" type="number" min="0" max="100" step="1" placeholder="100" />
            <input name="sort_order" type="number" step="1" placeholder="0" />
            <select name="is_active"><option value="1">Active</option><option value="0">Inactive</option></select>
          </div>
          <div class="grid cols-2" style="gap:8px">
            <select name="gifi_review_state"><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="needs_accountant">Needs accountant</option><option value="finalized">Finalized</option></select>
            <input name="gifi_review_note" type="text" placeholder="Why this mapping is being used / what still needs review" />
          </div>
          <button class="btn primary" type="submit">Save GL account</button>
        </form>
        <div id="glAccountsSummary" class="small" style="margin-top:10px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" type="button" id="applyStarterGifiMappingsButton">Apply starter GIFI mappings</button><button class="btn" type="button" id="bulkReviewMappedAccountsButton">Mark mapped as reviewed</button><button class="btn" type="button" id="bulkFinalizeReviewedAccountsButton">Finalize reviewed accounts</button><button class="btn" type="button" id="bulkFinalizeMappedAccountsButton">Finalize all mapped accounts</button></div><div id="glAccountsBlockers" class="small" style="margin-top:10px"></div><div id="glAccountsList" class="small" style="margin-top:10px"></div>
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
      <div class="card" id="gifi-staging">
        <h3 style="margin-top:0">T2 / GIFI staging</h3>
        <p class="small">This summary is for accountant review. It groups mapped ledger activity by GIFI code, shows what still needs mapping, and now carries year-specific accountant notes and Schedule 141 notes.</p>
        <div class="grid cols-3" style="gap:8px;align-items:end">
          <div><label class="small" for="gifiYearInput">Tax year</label><input id="gifiYearInput" type="number" min="2000" max="2100" placeholder="2026"></div>
          <div><button class="btn primary" id="loadGifiButton" type="button">Refresh GIFI summary</button></div>
          <div><button class="btn" id="downloadGifiButton" type="button">Download GIFI staging CSV</button></div>
        </div>
        <div id="gifiSummaryMount" class="small" style="margin-top:12px"></div>
      </div>
      <div class="card" id="gifi-review-notes">
        <h3 style="margin-top:0">Accountant notes / Schedule 141 notes</h3>
        <form id="gifiNotesForm" class="grid" style="gap:8px">
          <div class="grid cols-4" style="gap:8px">
            <input name="tax_year" type="number" min="2000" max="2100" placeholder="2026" />
            <input name="gifi_code" type="text" placeholder="9221" />
            <input name="gifi_label" type="text" placeholder="Electricity" />
            <input name="gifi_section" type="text" placeholder="income_statement" />
          </div>
          <div class="grid cols-2" style="gap:8px">
            <select name="review_status"><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="needs_accountant">Needs accountant</option><option value="finalized">Finalized</option></select>
            <input name="supporting_details" type="text" placeholder="Working paper, invoice folder, or follow-up detail" />
          </div>
          <textarea name="accountant_note" rows="3" placeholder="Accountant note for this GIFI line"></textarea>
          <textarea name="schedule_141_note" rows="3" placeholder="Schedule 141 note / disclosure note draft"></textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">Save GIFI notes</button><button class="btn" type="button" id="clearGifiNotesButton">Clear form</button></div>
        </form>
        <div id="gifiNotesList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="period-locks">
        <h3 style="margin-top:0">Month lock / reopen controls</h3>
        <p class="small">Use this slowly. When a month is locked, new expenses, write-offs, overhead allocations, and product-cost entries for that month are blocked until you reopen it.</p>
        <form id="periodLockForm" class="grid" style="gap:8px">
          <div class="grid cols-3" style="gap:8px;align-items:end">
            <div><label class="small" for="periodLockMonth">Period month</label><input id="periodLockMonth" name="period_month" type="month" /></div>
            <div><label class="small" for="periodLockAction">Action</label><select id="periodLockAction" name="action"><option value="lock">Lock month</option><option value="reopen">Reopen month</option></select></div>
            <div><button class="btn primary" type="submit">Save month status</button></div>
          </div>
          <div class="grid cols-3" style="gap:8px">
            <label class="small"><input type="checkbox" name="bank_reconciled" value="1" /> Bank reconciled</label>
            <label class="small"><input type="checkbox" name="sales_tax_reviewed" value="1" /> Sales tax reviewed</label>
            <label class="small"><input type="checkbox" name="receipts_attached" value="1" /> Receipts attached / organized</label>
            <label class="small"><input type="checkbox" name="gifi_reviewed" value="1" /> GIFI staging reviewed</label>
            <label class="small"><input type="checkbox" name="schedule_141_notes_started" value="1" /> Schedule 141 notes started</label>
            <label class="small"><input type="checkbox" name="accountant_followup_flagged" value="1" /> Accountant follow-up flagged</label>
          </div>
          <textarea name="close_notes" rows="3" placeholder="Month-end close notes / reopen reason"></textarea>
        </form>
        <div id="periodLocksList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="db-sanity">
        <h3 style="margin-top:0">DB sanity</h3>
        <p class="small">Checks the live D1 database for the expected tables and key columns used by the current build, with extra attention on accounting, GIFI note, and month-lock tables.</p>
        <button class="btn primary" id="runDbSanityButton" type="button">Run live DB sanity</button>
        <div id="dbSanityMount" class="small" style="margin-top:12px"></div>
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
  const state = { gl: [], gifiRows: [], gifiNotes: [], periodClosures: [] };

  function activeMonth() { return String(mount.querySelector('#monthlyExportMonth')?.value || new Date().toISOString().slice(0, 7)); }
  function activeYear() { return String(mount.querySelector('#gifiYearInput')?.value || new Date().getFullYear()); }
  function centsToMoney(cents, currency = 'CAD') { return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(Number(cents || 0) / 100); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.style.display = text ? 'block' : 'none';
    message.style.color = isError ? '#b00020' : '';
  }
  function renderSmallList(el, rows, formatter) {
    if (!el) return;
    if (!rows.length) { el.innerHTML = '<div>No entries yet.</div>'; return; }
    el.innerHTML = rows.slice(0, 16).map(formatter).join('');
  }
  function glOptionsHtml(selected = '') {
    return state.gl.map((row) => `<option value="${row.code || ''}" ${String(row.code || '') === String(selected || '') ? 'selected' : ''}>${row.code || ''} — ${row.name || ''}</option>`).join('');
  }
  function fillForm(form, values = {}) {
    if (!form) return;
    Object.entries(values).forEach(([key, value]) => {
      const field = form.elements?.[key];
      if (!field) return;
      if (field.type === 'checkbox') field.checked = Number(value || 0) === 1 || value === true;
      else field.value = value == null ? '' : String(value);
    });
  }
  function formToObject(form) {
    const data = new FormData(form);
    const out = {};
    for (const [key, value] of data.entries()) out[key] = value;
    form.querySelectorAll('input[type="checkbox"]').forEach((box) => { out[box.name] = box.checked ? 1 : 0; });
    return out;
  }
  async function readJson(response, fallbackMessage) {
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || fallbackMessage);
    return data;
  }

  async function loadGl() {
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts'), 'GL account endpoint is unavailable.');
    state.gl = Array.isArray(data.accounts) ? data.accounts : [];
    const summary = data.summary || {};
    const expenseLedger = mount.querySelector('#expenseLedgerCode');
    if (expenseLedger) expenseLedger.innerHTML = `<option value="">Choose ledger code</option>${glOptionsHtml(expenseLedger.value)}`;
    const summaryEl = mount.querySelector('#glAccountsSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `Active <strong>${escapeHtml(String(Number(summary.active_count || 0)))}</strong> • mapped <strong>${escapeHtml(String(Number(summary.mapped_count || 0)))}</strong> • finalized <strong>${escapeHtml(String(Number(summary.finalized_count || 0)))}</strong> • unmapped <strong>${escapeHtml(String(Number(summary.unmapped_count || 0)))}</strong> • needs accountant <strong>${escapeHtml(String(Number(summary.needs_accountant_count || 0)))}</strong>`;
    }
    renderSmallList(mount.querySelector('#glAccountsList'), state.gl, (row) => `
      <div style="padding:8px 0;border-bottom:1px solid #eee">
        <strong>${escapeHtml(row.code || '')}</strong> — ${escapeHtml(row.name || '')}
        <div class="small">${escapeHtml(row.category || '')}${row.parent_group ? ` • ${escapeHtml(row.parent_group)}` : ''} • ${escapeHtml(row.normal_balance || '')} • ${escapeHtml(row.gifi_code || 'unmapped')} ${row.gifi_label ? `— ${escapeHtml(row.gifi_label)}` : ''}</div>
        <div class="small">Review ${escapeHtml(row.gifi_review_state || 'draft')} • Deductible ${escapeHtml(String(Number(row.tax_deductibility_percent || 0)))}%${row.gifi_review_note ? ` • ${escapeHtml(row.gifi_review_note)}` : ''}</div>
      </div>`);
  }

  async function loadExpenses() {
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-expenses'), 'Expense endpoint is unavailable.');
    renderSmallList(mount.querySelector('#expensesList'), Array.isArray(data.expenses) ? data.expenses : [], (row) => `<div>${escapeHtml(row.expense_date || row.created_at || '')} — ${escapeHtml(row.vendor_name || '')} — ${escapeHtml(centsToMoney(Math.round(Number(row.amount || 0) * 100)))} ${row.ledger_code ? `(${escapeHtml(row.ledger_code)})` : ''}${Number(row.attachment_count || 0) ? ` <span class="small">• attachments ${escapeHtml(String(Number(row.attachment_count || 0)))}</span>` : ''}</div>`);
  }
  async function loadOverhead() {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-overhead-allocations?month=${encodeURIComponent(activeMonth())}`), 'Overhead endpoint is unavailable.');
    renderSmallList(mount.querySelector('#overheadList'), Array.isArray(data.allocations) ? data.allocations : [], (row) => `<div>${escapeHtml(row.period_month || '')} — ${escapeHtml(row.ledger_code || '')} — ${escapeHtml(centsToMoney(Number(row.amount_cents || 0)))} <span class="small">(${escapeHtml(row.allocation_basis || 'manual')})</span></div>`);
  }
  async function loadWriteoffs() {
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-writeoffs'), 'Write-off endpoint is unavailable.');
    renderSmallList(mount.querySelector('#writeoffsList'), Array.isArray(data.writeoffs) ? data.writeoffs : [], (row) => `<div>${escapeHtml(row.writeoff_date || row.created_at || '')} — ${escapeHtml(row.item_name || '')} — ${escapeHtml(centsToMoney(Math.round(Number(row.amount || 0) * 100)))} (${escapeHtml(row.reason_code || 'other')})</div>`);
  }
  async function loadProductCosts() {
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/product-costs'), 'Product cost endpoint is unavailable.');
    renderSmallList(mount.querySelector('#productCostsList'), Array.isArray(data.product_costs) ? data.product_costs : [], (row) => `<div>${escapeHtml(row.product_number || '')} — ${escapeHtml(centsToMoney(Math.round(Number(row.cost_per_unit || 0) * 100)))} <span class="small">${escapeHtml(row.effective_date || '')}</span></div>`);
  }

  async function loadGifiNotes() {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-gifi-notes?year=${encodeURIComponent(activeYear())}`), 'GIFI notes endpoint is unavailable.');
    state.gifiNotes = Array.isArray(data.notes) ? data.notes : [];
    renderSmallList(mount.querySelector('#gifiNotesList'), state.gifiNotes, (row) => `
      <div style="padding:8px 0;border-bottom:1px solid #eee">
        <strong>${escapeHtml(row.gifi_code || 'UNMAPPED')}</strong>${row.gifi_label ? ` — ${escapeHtml(row.gifi_label)}` : ''}
        <div class="small">${escapeHtml(row.review_status || 'draft')}${row.gifi_section ? ` • ${escapeHtml(row.gifi_section)}` : ''}</div>
        ${row.accountant_note ? `<div class="small"><strong>Accountant:</strong> ${escapeHtml(row.accountant_note)}</div>` : ''}
        ${row.schedule_141_note ? `<div class="small"><strong>Schedule 141:</strong> ${escapeHtml(row.schedule_141_note)}</div>` : ''}
        <div style="margin-top:6px"><button class="btn" type="button" data-fill-gifi-note="${escapeHtml(row.gifi_code || '')}">Edit note</button></div>
      </div>`);
  }

  function fillGifiNotesForm(row = {}) {
    const form = mount.querySelector('#gifiNotesForm');
    if (!form) return;
    fillForm(form, {
      tax_year: activeYear(),
      gifi_code: row.gifi_code || '',
      gifi_label: row.gifi_label || '',
      gifi_section: row.gifi_section || '',
      review_status: row.review_status || 'draft',
      supporting_details: row.supporting_details || '',
      accountant_note: row.accountant_note || '',
      schedule_141_note: row.schedule_141_note || '',
    });
  }

  async function loadGifiSummary() {
    const mountPoint = mount.querySelector('#gifiSummaryMount');
    if (!mountPoint) return;
    mountPoint.innerHTML = '<div>Loading GIFI staging summary…</div>';
    try {
      const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-gifi-summary?year=${encodeURIComponent(activeYear())}`), 'GIFI summary endpoint is unavailable.');
      state.gifiRows = Array.isArray(data.gifi_rows) ? data.gifi_rows : [];
      const rows = state.gifiRows;
      const unmapped = Array.isArray(data.unmapped_accounts) ? data.unmapped_accounts : [];
      mountPoint.innerHTML = `
        <div class="small" style="margin-bottom:8px">${escapeHtml(String(Number(data.summary?.readiness_percent || 0)))}% mapped · ${escapeHtml(String(Number(data.summary?.mapped_line_count || 0)))} mapped rows · ${escapeHtml(String(Number(data.summary?.unmapped_line_count || 0)))} unmapped · source ${escapeHtml(data.source_used || 'unknown')}</div>
        <div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">GIFI</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Ledgers</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Net</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Review</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Notes</th></tr></thead><tbody>${rows.slice(0, 20).map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(row.gifi_code || 'UNMAPPED')}</strong><div class="small">${escapeHtml(row.gifi_label || 'Needs accountant mapping')}</div><div class="small">${escapeHtml(row.gifi_section || '')}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_codes || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.net_cents || 0)))}<div class="small">Deductible ${escapeHtml(centsToMoney(Number(row.deductible_cents || 0)))}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.review_status || 'draft')}<div style="margin-top:6px"><button class="btn" type="button" data-stage-gifi-code="${escapeHtml(row.gifi_code || 'UNMAPPED')}">Stage note</button></div></td><td style="padding:8px;border-bottom:1px solid #eee">${row.accountant_note ? `<div class="small"><strong>Accountant:</strong> ${escapeHtml(row.accountant_note)}</div>` : ''}${row.schedule_141_note ? `<div class="small" style="margin-top:4px"><strong>Schedule 141:</strong> ${escapeHtml(row.schedule_141_note)}</div>` : '<div class="small">No saved note yet.</div>'}</td></tr>`).join('') || '<tr><td colspan="5" style="padding:8px">No GIFI rows yet.</td></tr>'}</tbody></table></div>
        <div style="margin-top:10px">${unmapped.length ? `<strong>Accounts needing mapping:</strong><div class="small" style="margin-top:6px">${unmapped.slice(0, 10).map((row) => `${escapeHtml(row.ledger_code || '')} — ${escapeHtml(row.ledger_name || '')} (${escapeHtml(centsToMoney(Number(row.net_cents || 0)))})`).join('<br>')}</div>` : '<div class="small">No unmapped ledger activity was found in the current staging summary.</div>'}</div>`;
    } catch (error) {
      mountPoint.innerHTML = `<div style="color:#b00020">${escapeHtml(error.message || 'Failed loading GIFI summary.')}</div>`;
    }
  }

  async function loadPeriodLocks() {
    const mountPoint = mount.querySelector('#periodLocksList');
    if (!mountPoint) return;
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-period-locks?limit=18'), 'Month lock endpoint is unavailable.');
    state.periodClosures = Array.isArray(data.closures) ? data.closures : [];
    renderSmallList(mountPoint, state.periodClosures, (row) => {
      const checklist = row.close_checklist || {};
      const doneCount = ['bank_reconciled','sales_tax_reviewed','receipts_attached','gifi_reviewed','schedule_141_notes_started','accountant_followup_flagged'].reduce((sum, key) => sum + (Number(checklist[key] || 0) === 1 ? 1 : 0), 0);
      return `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${escapeHtml(row.period_month || '')}</strong> — ${escapeHtml(row.lock_state || 'open')}<div class="small">Checklist ${doneCount}/6${row.locked_at ? ` • locked ${escapeHtml(row.locked_at)}` : ''}${row.reopened_at ? ` • reopened ${escapeHtml(row.reopened_at)}` : ''}</div>${row.close_notes ? `<div class="small">${escapeHtml(row.close_notes)}</div>` : ''}</div>`;
    });
  }

  async function loadDbSanity() {
    const mountPoint = mount.querySelector('#dbSanityMount');
    if (!mountPoint) return;
    mountPoint.innerHTML = '<div>Running DB sanity…</div>';
    try {
      const data = await readJson(await window.DDAuth.apiFetch('/api/admin/db-sanity'), 'DB sanity endpoint is unavailable.');
      const stale = Array.isArray(data.stale_tables) ? data.stale_tables : [];
      const missing = Array.isArray(data.missing_tables) ? data.missing_tables : [];
      mountPoint.innerHTML = `
        <div class="small" style="margin-bottom:8px">Status: <strong>${escapeHtml(data.summary?.status || 'unknown')}</strong> · ${escapeHtml(String(Number(data.summary?.ok_table_count || 0)))} OK · ${escapeHtml(String(Number(data.summary?.stale_table_count || 0)))} stale · ${escapeHtml(String(Number(data.summary?.missing_table_count || 0)))} missing</div>
        ${missing.length ? `<div style="margin-bottom:10px"><strong>Missing tables</strong><div class="small">${missing.slice(0, 12).map((row) => `${escapeHtml(row.table_name)}${row.missing_columns?.length ? ` — needs ${escapeHtml(row.missing_columns.join(', '))}` : ''}`).join('<br>')}</div></div>` : ''}
        ${stale.length ? `<div><strong>Tables needing column upgrades</strong><div class="small">${stale.slice(0, 12).map((row) => `${escapeHtml(row.table_name)} — missing ${escapeHtml((row.missing_columns || []).join(', '))}`).join('<br>')}</div></div>` : '<div class="small">No missing key columns were found in the current sanity set.</div>'}`;
    } catch (error) {
      mountPoint.innerHTML = `<div style="color:#b00020">${escapeHtml(error.message || 'Failed running DB sanity.')}</div>`;
    }
  }

  async function refreshAll() {
    await loadGl();
    await Promise.all([loadExpenses(), loadOverhead(), loadWriteoffs(), loadProductCosts(), loadGifiNotes(), loadGifiSummary(), loadPeriodLocks(), loadDbSanity()]);
  }

  mount.querySelector('#glAccountForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving GL account.', true);
    event.currentTarget.reset();
    setMessage('General ledger account saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#expenseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-expenses', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving expense.', true);
    event.currentTarget.reset();
    setMessage('Expense saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#overheadForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-overhead-allocations', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving overhead allocation.', true);
    setMessage('Overhead allocation saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#writeoffForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-writeoffs', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving write-off.', true);
    event.currentTarget.reset();
    setMessage('Write-off saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#productCostForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await window.DDAuth.apiFetch('/api/admin/product-costs', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving product cost.', true);
    event.currentTarget.reset();
    setMessage('Product cost saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#gifiNotesForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formToObject(form);
    payload.tax_year = payload.tax_year || activeYear();
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-gifi-notes', { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving GIFI notes.', true);
    setMessage('GIFI review notes saved.');
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#clearGifiNotesButton')?.addEventListener('click', () => {
    const form = mount.querySelector('#gifiNotesForm');
    form?.reset();
    fillForm(form, { tax_year: activeYear(), review_status: 'draft' });
  });
  mount.querySelector('#periodLockForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = formToObject(form);
    const payload = {
      period_month: raw.period_month,
      action: raw.action,
      close_notes: raw.close_notes || '',
      close_checklist: {
        bank_reconciled: raw.bank_reconciled,
        sales_tax_reviewed: raw.sales_tax_reviewed,
        receipts_attached: raw.receipts_attached,
        gifi_reviewed: raw.gifi_reviewed,
        schedule_141_notes_started: raw.schedule_141_notes_started,
        accountant_followup_flagged: raw.accountant_followup_flagged,
      }
    };
    const response = await window.DDAuth.apiFetch('/api/admin/accounting-period-locks', { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed saving month lock.', true);
    setMessage(`Month ${payload.action === 'lock' ? 'locked' : 'reopened'}.`);
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.addEventListener('click', (event) => {
    const stageButton = event.target.closest('[data-stage-gifi-code]');
    if (stageButton) {
      const code = String(stageButton.getAttribute('data-stage-gifi-code') || '');
      const row = state.gifiRows.find((item) => String(item.gifi_code || 'UNMAPPED') === code) || state.gifiNotes.find((item) => String(item.gifi_code || 'UNMAPPED') === code) || { gifi_code: code };
      fillGifiNotesForm({ ...row, tax_year: activeYear() });
      document.getElementById('gifi-review-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const fillButton = event.target.closest('[data-fill-gifi-note]');
    if (fillButton) {
      const code = String(fillButton.getAttribute('data-fill-gifi-note') || '');
      const row = state.gifiNotes.find((item) => String(item.gifi_code || '') === code) || { gifi_code: code };
      fillGifiNotesForm(row);
      document.getElementById('gifi-review-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
  mount.querySelector('#downloadGifiButton')?.addEventListener('click', async () => {
    const year = activeYear();
    if (!year) return setMessage('Choose a GIFI year first.', true);
    await downloadCsv(`/api/admin/accounting-gifi-summary?year=${encodeURIComponent(year)}&format=csv`, `devilndove-gifi-staging-${year}.csv`);
  });
  mount.querySelector('#loadGifiButton')?.addEventListener('click', () => { loadGifiNotes().then(loadGifiSummary).catch((error) => setMessage(String(error?.message || error), true)); });
  mount.querySelector('#runDbSanityButton')?.addEventListener('click', () => { loadDbSanity().catch((error) => setMessage(String(error?.message || error), true)); });
  mount.querySelector('#applyStarterGifiMappingsButton')?.addEventListener('click', async () => {
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify({ action: 'apply_starter_gifi_mappings' }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed applying starter GIFI mappings.', true);
    setMessage(`Starter GIFI mappings applied (${Number(data.changed_rows || 0)} rows touched).`);
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#bulkReviewMappedAccountsButton')?.addEventListener('click', async () => {
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify({ action: 'bulk_mark_reviewed' }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed bulk review update.', true);
    setMessage(`Mapped GL accounts marked reviewed (${Number(data.changed_rows || 0)} rows).`);
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#bulkFinalizeReviewedAccountsButton')?.addEventListener('click', async () => {
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify({ action: 'bulk_finalize_reviewed' }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed finalizing reviewed GL accounts.', true);
    setMessage(`Reviewed GL accounts finalized (${Number(data.changed_rows || 0)} rows).`);
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });
  mount.querySelector('#bulkFinalizeMappedAccountsButton')?.addEventListener('click', async () => {
    const response = await window.DDAuth.apiFetch('/api/admin/general-ledger-accounts', { method: 'POST', body: JSON.stringify({ action: 'bulk_finalize_mapped' }) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return setMessage(data?.error || 'Failed bulk finalize update.', true);
    setMessage(`Mapped GL accounts finalized (${Number(data.changed_rows || 0)} rows).`);
    refreshAll().catch((error) => setMessage(String(error?.message || error), true));
  });

  const monthlyInput = mount.querySelector('#monthlyExportMonth');
  if (monthlyInput && !monthlyInput.value) monthlyInput.value = new Date().toISOString().slice(0, 7);
  const overheadMonth = mount.querySelector('#overheadForm [name=period_month]');
  if (overheadMonth && !overheadMonth.value) overheadMonth.value = activeMonth();
  const gifiYearInput = mount.querySelector('#gifiYearInput');
  if (gifiYearInput && !gifiYearInput.value) gifiYearInput.value = String(new Date().getFullYear());
  const notesYearInput = mount.querySelector('#gifiNotesForm [name=tax_year]');
  if (notesYearInput && !notesYearInput.value) notesYearInput.value = String(new Date().getFullYear());
  const periodLockMonth = mount.querySelector('#periodLockMonth');
  if (periodLockMonth && !periodLockMonth.value) periodLockMonth.value = activeMonth();
  const yearExportInput = mount.querySelector('#yearExportPeriod');
  if (yearExportInput && !yearExportInput.value) yearExportInput.value = String(new Date().getFullYear());

  refreshAll().then(() => {
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }).catch((error) => setMessage(String(error?.message || error || 'Failed loading accounting tools.'), true));
});
