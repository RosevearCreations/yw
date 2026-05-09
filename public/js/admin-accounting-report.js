// File: /public/js/admin-accounting-report.js
// Brief description: Adds a monthly accounting summary card with a rough P&L style view,
// journal visibility, and explicit product-level overhead overrides.
(function () {
  const mountEl = document.getElementById('adminAccountingReportMount');
  if (!mountEl || !window.DDAuth) return;

  function centsToMoney(cents, currency = 'CAD') {
    const value = Number(cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); }
    catch { return `${currency} ${value.toFixed(2)}`; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function monthValue() {
    const el = document.getElementById('accountingReportMonth');
    return String(el?.value || new Date().toISOString().slice(0, 7));
  }

  function setMessage(message, tone = 'success') {
    const el = document.getElementById('accountingReportMessage');
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
    el.className = message ? `status-note ${tone}` : 'status-note';
  }

  function renderShell() {
    mountEl.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">Accounting overview</h2>
            <p class="small" style="margin:8px 0 0 0">Track rough revenue, operating expenses, write-offs, journal balance health, product-level overhead overrides, and estimated fully loaded item costs while the deeper accounting backend grows.</p>
          </div>
          <div class="dd-install-actions" style="margin-top:0">
            <div><label class="small" for="accountingReportMonth">Month</label><input id="accountingReportMonth" type="month"/></div>
            <button class="btn" id="refreshAccountingReportButton" type="button">Refresh report</button>
            <button class="btn" id="syncAccountingJournalButton" type="button">Sync journal</button>
          </div>
        </div>
        <div id="accountingReportMessage" class="small" style="display:none;margin-top:10px"></div>
        <div class="admin-summary-grid" id="accountingReportStats" style="margin-top:14px"></div>
        <div class="grid cols-2" style="gap:14px;margin-top:14px">
          <div class="card" style="margin:0"><h3 style="margin-top:0">Operating expense groups</h3><div id="accountingExpenseGroups"></div></div>
          <div class="card" style="margin:0"><h3 style="margin-top:0">Allocated overhead groups</h3><div id="accountingOverheadGroups"></div></div>
          <div class="card" style="margin:0"><h3 style="margin-top:0">Product overhead overrides</h3><div id="accountingOverheadOverrides"></div></div>
          <div class="card" style="margin:0"><h3 style="margin-top:0">Journal health</h3><div id="accountingJournalSummary"></div></div>
          <div class="card" style="margin:0"><h3 style="margin-top:0">General ledger map</h3><div id="accountingGlMap"></div></div>
          <div class="card" style="margin:0"><h3 style="margin-top:0">Costing attention</h3><div id="accountingCostingAttention"></div></div>
          <div class="card" id="item-costing" style="margin:0;grid-column:1/-1"><h3 style="margin-top:0">Estimated item costing</h3><div class="small" style="margin-bottom:8px">Blends direct unit cost, linked resource cost, overhead pools, and any explicit product-level overhead overrides for a fuller rough unit cost and recognized rough COGS view.</div><div id="accountingItemCosting"></div></div>
        </div>
      </div>`;
    const monthInput = document.getElementById('accountingReportMonth');
    if (monthInput && !monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);
    document.getElementById('refreshAccountingReportButton')?.addEventListener('click', () => loadReport());
    document.getElementById('syncAccountingJournalButton')?.addEventListener('click', () => syncJournal());
    monthInput?.addEventListener('change', () => loadReport());
  }

  function renderTableRows(rows, emptyText, mapper) {
    return rows.length ? mapper(rows) : `<div class="small">${emptyText}</div>`;
  }

  function renderAttention(costing) {
    const wrap = document.getElementById('accountingCostingAttention');
    if (!wrap) return;
    const items = Array.isArray(costing?.items) ? costing.items : [];
    const needingHelp = items.filter((row) => Number(row.missing_cost_links || 0) > 0 || Number(row.rough_unit_margin_cents || 0) < 0 || Number(row.base_unit_cost_cents || 0) <= 0).slice(0, 8);
    wrap.innerHTML = renderTableRows(needingHelp, 'No urgent costing warnings for the selected month.', (rows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Issue</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Margin</th></tr></thead><tbody>${rows.map((row) => {
      const issues = [];
      if (Number(row.base_unit_cost_cents || 0) <= 0) issues.push('No direct or linked cost yet');
      if (Number(row.missing_cost_links || 0) > 0) issues.push(`${Number(row.missing_cost_links || 0)} missing resource cost links`);
      if (Number(row.rough_unit_margin_cents || 0) < 0) issues.push('Negative rough unit margin');
      if (Number(row.sold_quantity_in_period || 0) > 0 && Number(row.estimated_full_unit_cost_cents || 0) > Number(row.price_cents || 0)) issues.push('Sold below rough fully loaded cost');
      return `<tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(row.name || `DD${row.product_number || ''}`)}</strong><div class="small">${escapeHtml(row.status || 'draft')} · ${escapeHtml(row.review_status || '')}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(issues.join(' • ') || 'Review')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.rough_unit_margin_cents || 0), row.currency || 'CAD'))}</td></tr>`;
    }).join('')}</tbody></table></div>`);
  }

  function renderReport(data, costing, journal, overrides) {
    const summary = data?.summary || {};
    const costingSummary = costing?.summary || {};
    const journalSummary = journal?.summary || {};
    const stats = document.getElementById('accountingReportStats');
    if (stats) {
      stats.innerHTML = `
        <div class="admin-stat"><div class="admin-stat-label">Booked revenue</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Math.round(Number(summary.booked_amount || 0) * 100)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Recognized revenue</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Math.round(Number(summary.recognized_amount || 0) * 100)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Operating expenses</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.operating_expense_cents || 0) + Number(summary.operating_expense_tax_cents || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Allocated overhead</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.overhead_allocated_cents || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Overhead overrides</div><div class="admin-stat-value">${escapeHtml(String(Number(summary.overhead_product_override_count || costingSummary.explicit_product_overrides_count || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Net after overhead</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.rough_net_after_overhead_cents || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Recognized full COGS</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(costingSummary.estimated_recognized_full_cogs_cents || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Products sold this month</div><div class="admin-stat-value">${escapeHtml(String(Number(costingSummary.products_sold_in_period || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Avg full unit cost</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(costingSummary.average_full_unit_cost_cents || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Negative margins</div><div class="admin-stat-value">${escapeHtml(String(Number(costingSummary.negative_margin_count || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Journal entries</div><div class="admin-stat-value">${escapeHtml(String(Number(journalSummary.entry_count || 0)))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Journal imbalances</div><div class="admin-stat-value">${escapeHtml(String(Number(journalSummary.imbalance_count || 0)))}</div></div>`;
    }

    const expenseGroups = document.getElementById('accountingExpenseGroups');
    if (expenseGroups) {
      const rows = Array.isArray(data?.expense_groups) ? data.expense_groups : [];
      expenseGroups.innerHTML = renderTableRows(rows, 'No expense groups found for the selected month.', (groupRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">GL</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Group</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Entries</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Total</th></tr></thead><tbody>${groupRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_code || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_name || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(String(Number(row.entry_count || 0)))}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.total_cents || 0)))}</td></tr>`).join('')}</tbody></table></div>`);
    }

    const overheadGroups = document.getElementById('accountingOverheadGroups');
    if (overheadGroups) {
      const rows = Array.isArray(data?.overhead_groups) ? data.overhead_groups : [];
      const pools = Array.isArray(costingSummary.overhead_pools) ? costingSummary.overhead_pools : [];
      const rowsToRender = rows.length ? rows : pools.map((row) => ({
        ledger_code: row.ledger_code || '',
        ledger_name: row.weighting_mode || 'Pool',
        allocation_basis: row.allocation_basis || 'manual',
        total_cents: row.amount_cents || 0,
        weighting_mode: row.weighting_mode || '',
        reserved_override_cents: row.reserved_override_cents || 0
      }));
      overheadGroups.innerHTML = renderTableRows(rowsToRender, 'No overhead allocations found for the selected month.', (groupRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">GL</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Group</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Basis</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Total</th></tr></thead><tbody>${groupRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_code || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_name || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.weighting_mode ? `${row.allocation_basis || 'manual'} · ${row.weighting_mode}` : (row.allocation_basis || 'manual'))}${Number(row.reserved_override_cents || 0) > 0 ? `<div class="small">Overrides ${escapeHtml(centsToMoney(Number(row.reserved_override_cents || 0)))}</div>` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.total_cents || row.amount_cents || 0)))}</td></tr>`).join('')}</tbody></table></div>`);
    }

    const overridesWrap = document.getElementById('accountingOverheadOverrides');
    if (overridesWrap) {
      const rows = Array.isArray(overrides?.allocations) ? overrides.allocations : (Array.isArray(data?.overhead_product_overrides) ? data.overhead_product_overrides : []);
      overridesWrap.innerHTML = renderTableRows(rows, 'No explicit product overhead overrides are stored for the selected month.', (groupRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">GL</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Amount</th></tr></thead><tbody>${groupRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_code || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.product_name || `DD${row.product_number || ''}`)}${row.notes ? `<div class="small">${escapeHtml(row.notes)}</div>` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.amount_cents || 0)))}</td></tr>`).join('')}</tbody></table></div>`);
    }

    const journalWrap = document.getElementById('accountingJournalSummary');
    if (journalWrap) {
      const rows = Array.isArray(journal?.ledger_summary) ? journal.ledger_summary : [];
      journalWrap.innerHTML = `<div class="small" style="margin-bottom:8px">${escapeHtml(String(Number(journalSummary.entry_count || 0)))} entries • ${escapeHtml(String(Number(journalSummary.balanced_entry_count || 0)))} balanced • ${escapeHtml(String(Number(journalSummary.imbalance_count || 0)))} imbalanced</div>${renderTableRows(rows, 'No journal rows exist yet for the selected month. Use Sync journal to build the current rough double-entry layer.', (ledgerRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Code</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Name</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Debit</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Credit</th></tr></thead><tbody>${ledgerRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_code || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.ledger_name || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.debit_cents || 0)))}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.credit_cents || 0)))}</td></tr>`).join('')}</tbody></table></div>`)}`;
    }

    const glMap = document.getElementById('accountingGlMap');
    if (glMap) {
      const rows = Array.isArray(data?.general_ledger_accounts) ? data.general_ledger_accounts : [];
      glMap.innerHTML = renderTableRows(rows, 'No general ledger accounts yet.', (accountRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Code</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Name</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Category</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Group</th></tr></thead><tbody>${accountRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.code || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.name || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.category || '')}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.parent_group || '')}</td></tr>`).join('')}</tbody></table></div>`);
    }

    renderAttention(costing);

    const itemCosting = document.getElementById('accountingItemCosting');
    if (itemCosting) {
      const rows = Array.isArray(costing?.items) ? costing.items : [];
      itemCosting.innerHTML = renderTableRows(rows, 'No products available for costing yet.', (itemRows) => `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Price</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Direct cost</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Resources</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Overhead</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Full unit cost</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Sold</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Unit margin</th></tr></thead><tbody>${itemRows.slice(0, 24).map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(row.name || `DD${row.product_number || ''}`)}</strong><div class="small">${escapeHtml(row.status || 'draft')} · ${escapeHtml(row.review_status || '')} · ${escapeHtml(row.allocation_basis || 'none')}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.price_cents || 0), row.currency || 'CAD'))}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.direct_unit_cost_cents || 0), row.currency || 'CAD'))}<div class="small">${escapeHtml(row.direct_cost_effective_date || '')}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.linked_resource_cost_cents || 0), row.currency || 'CAD'))}<div class="small">${Number(row.missing_cost_links || 0)} missing cost links</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.allocated_overhead_cents || 0), row.currency || 'CAD'))}<div class="small">Pool ${escapeHtml(centsToMoney(Number(row.allocated_overhead_pool_cents || 0), row.currency || 'CAD'))}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.estimated_full_unit_cost_cents || 0), row.currency || 'CAD'))}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(String(Number(row.sold_quantity_in_period || 0)))} units<div class="small">${escapeHtml(String(Number(row.sold_order_count_in_period || 0)))} orders</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(centsToMoney(Number(row.rough_unit_margin_cents || 0), row.currency || 'CAD'))}</td></tr>`).join('')}</tbody></table></div>`);
    }
  }

  async function syncJournal() {
    setMessage('Syncing rough journal...', 'warning');
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/accounting-journal', { method: 'POST', body: JSON.stringify({ action: 'sync_month', month: monthValue() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to sync accounting journal.');
      setMessage(`Journal synced for ${data.period}.`, 'success');
      await loadReport();
    } catch (error) {
      setMessage(error.message || 'Failed to sync accounting journal.', 'error');
    }
  }

  async function loadReport() {
    setMessage('Loading accounting overview...', 'warning');
    try {
      const month = monthValue();
      const [reportRes, costRes, journalRes, overridesRes] = await Promise.all([
        window.DDAuth.apiFetch(`/api/admin/accounting-profit-loss?month=${encodeURIComponent(month)}`),
        window.DDAuth.apiFetch(`/api/admin/accounting-item-costing?month=${encodeURIComponent(month)}`),
        window.DDAuth.apiFetch(`/api/admin/accounting-journal?month=${encodeURIComponent(month)}`),
        window.DDAuth.apiFetch(`/api/admin/accounting-overhead-product-allocations?month=${encodeURIComponent(month)}`),
      ]);
      const data = await reportRes.json().catch(() => null);
      const costing = await costRes.json().catch(() => null);
      const journal = await journalRes.json().catch(() => null);
      const overrides = await overridesRes.json().catch(() => null);
      if (!reportRes.ok || !data?.ok) throw new Error(data?.error || 'Failed to load accounting overview.');
      if (!costRes.ok || !costing?.ok) throw new Error(costing?.error || 'Failed to load estimated item costing.');
      if (!journalRes.ok || !journal?.ok) throw new Error(journal?.error || 'Failed to load accounting journal.');
      if (!overridesRes.ok || !overrides?.ok) throw new Error(overrides?.error || 'Failed to load product overhead overrides.');
      renderReport(data, costing, journal, overrides);
      setMessage(`Loaded ${data.period} accounting overview.`, 'success');
    } catch (error) {
      setMessage(error.message || 'Failed to load accounting overview.', 'error');
    }
  }

  renderShell();
  loadReport();
})();
