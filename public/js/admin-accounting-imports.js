document.addEventListener('DOMContentLoaded', () => {
  if (!window.DDAuth) return;
  const mount = document.getElementById('accountingBackendMount');
  if (!mount) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function money(cents) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format((Number(cents || 0) || 0) / 100);
  }
  async function readJson(response, fallbackMessage) {
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || fallbackMessage || 'Request failed.');
    return data;
  }
  function ensureCard() {
    if (document.getElementById('statementImportCard')) return;
    const wrap = document.createElement('div');
    wrap.className = 'grid cols-2';
    wrap.style.gap = '18px';
    wrap.style.marginTop = '18px';
    wrap.innerHTML = `
      <div class="card" id="statementImportCard">
        <h3 style="margin-top:0">Statement import & auto-match</h3>
        <p class="small">Import bank, PayPal, Stripe, and Etsy CSVs, then auto-stage statement totals into reconciliation reviews and surface unresolved differences.</p>
        <form id="statementImportForm" class="grid" style="gap:8px" enctype="multipart/form-data">
          <div class="grid cols-2" style="gap:8px"><select name="provider_scope"><option value="bank">Bank</option><option value="paypal">PayPal</option><option value="stripe">Stripe</option><option value="etsy">Etsy</option><option value="square">Square</option><option value="other">Other</option></select><input name="period_month" type="month" value="${new Date().toISOString().slice(0,7)}" /></div>
          <div class="grid cols-2" style="gap:8px"><input name="statement_reference" type="text" placeholder="Statement reference / payout batch" /><input name="currency" type="text" value="CAD" maxlength="3" /></div>
          <input name="file" type="file" accept=".csv,text/csv" />
          <button class="btn primary" type="submit">Import CSV</button>
        </form>
        <div id="statementImportList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="reconciliationExceptionsCard">
        <h3 style="margin-top:0">Reconciliation exceptions queue</h3>
        <p class="small">Track unresolved statement-vs-book differences before month lock and year-end handoff.</p>
        <div class="grid cols-2" style="gap:8px;align-items:end"><input id="exceptionMonthFilter" type="month" value="${new Date().toISOString().slice(0,7)}" /><button class="btn" type="button" id="loadExceptionsButton">Refresh exceptions</button></div>
        <div id="reconciliationExceptionsList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="salesTaxWorksheetCard">
        <h3 style="margin-top:0">Sales-tax filing worksheet</h3>
        <p class="small">Use the current reconciliation detail as a reporting-period worksheet before the final filing workflow is built.</p>
        <div class="grid cols-2" style="gap:8px;align-items:end"><input id="salesTaxWorksheetMonth" type="month" value="${new Date().toISOString().slice(0,7)}" /><button class="btn" type="button" id="loadSalesTaxWorksheetButton">Load worksheet</button></div>
        <div id="salesTaxWorksheetList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="fixedAssetsCard">
        <h3 style="margin-top:0">CCA / depreciation groundwork</h3>
        <p class="small">Start listing tools, fixtures, equipment, and other longer-lived assets so year-end review can separate operating expenses from capital assets.</p>
        <form id="fixedAssetForm" class="grid" style="gap:8px">
          <div class="grid cols-2" style="gap:8px"><input name="asset_label" type="text" placeholder="Rolling mill" /><input name="asset_category" type="text" placeholder="equipment" /></div>
          <div class="grid cols-3" style="gap:8px"><input name="cca_class" type="text" placeholder="CCA class" /><input name="acquisition_date" type="date" /><input name="cost_cents" type="number" step="1" placeholder="Cost cents" /></div>
          <div class="grid cols-2" style="gap:8px"><input name="vendor_name" type="text" placeholder="Vendor name" /><input name="business_use_percent" type="number" min="0" max="100" value="100" /></div>
          <textarea name="notes" rows="2" placeholder="Why this should be reviewed as an asset instead of a direct expense"></textarea>
          <button class="btn" type="submit">Save fixed asset</button>
        </form>
        <div id="fixedAssetsList" class="small" style="margin-top:10px"></div>
      </div>
      <div class="card" id="vendorStatementsCard">
        <h3 style="margin-top:0">Vendor statements & payable-style review</h3>
        <p class="small">See which vendors already have statement support uploaded for the month and which still need statement-backed review.</p>
        <div class="grid cols-2" style="gap:8px;align-items:end"><input id="vendorStatementsMonth" type="month" value="${new Date().toISOString().slice(0,7)}" /><button class="btn" type="button" id="loadVendorStatementsButton">Load vendor statement view</button></div>
        <div id="vendorStatementsList" class="small" style="margin-top:10px"></div>
      </div>
    `;
    mount.appendChild(wrap);
  }

  async function loadImports(periodMonth = '') {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-statement-imports?period_month=${encodeURIComponent(periodMonth || '')}`), 'Statement import endpoint is unavailable.');
    const listEl = document.getElementById('statementImportList');
    if (!listEl) return;
    listEl.innerHTML = data.imports?.length ? data.imports.map((row) => `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(row.provider_scope)}</strong> • ${esc(row.period_month || '')} • ${esc(row.source_filename || row.statement_reference || '')}<div class="small">Rows ${esc(String(row.row_count || 0))} • Gross ${esc(money(row.gross_cents || 0))} • Fees ${esc(money(row.fee_cents || 0))} • Tax ${esc(money(row.tax_cents || 0))} • Shipping ${esc(money(row.shipping_cents || 0))}</div><div class="small">Status ${esc(row.import_status || 'imported')}</div></div>`).join('') : '<div class="small">No statement imports yet.</div>';
  }

  async function loadExceptions(periodMonth = '') {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-reconciliation-exceptions?period_month=${encodeURIComponent(periodMonth || '')}`), 'Exceptions endpoint is unavailable.');
    const listEl = document.getElementById('reconciliationExceptionsList');
    if (!listEl) return;
    listEl.innerHTML = data.exceptions?.length ? data.exceptions.map((row) => `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(row.reconciliation_type || '')}</strong> • ${esc(row.scope_key || 'all')} • ${esc(row.period_month || '')}<div class="small">Difference ${esc(money(row.difference_cents || 0))} • tolerance ${esc(money(row.tolerance_cents || 0))} • ${esc(row.exception_status || 'open')}</div><div class="small">${esc(row.notes || row.reference_label || '')}</div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-resolve-exception="${esc(String(row.accounting_reconciliation_exception_id || 0))}">Resolve</button><button class="btn" type="button" data-ignore-exception="${esc(String(row.accounting_reconciliation_exception_id || 0))}">Ignore</button></div></div>`).join('') : '<div class="small">No reconciliation exceptions for this period.</div>';
  }

  async function loadWorksheet(periodMonth = '') {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-sales-tax-filing?period_month=${encodeURIComponent(periodMonth || '')}`), 'Sales-tax worksheet endpoint is unavailable.');
    const row = data.worksheet || {};
    const listEl = document.getElementById('salesTaxWorksheetList');
    if (!listEl) return;
    listEl.innerHTML = `<div class="small">Collected ${esc(money(row.tax_collected_cents || 0))} • ITCs ${esc(money(row.input_tax_cents || 0))} • Net payable ${esc(money(row.net_tax_payable_cents || 0))}</div><div class="small">Statement tax ${esc(money(row.statement_tax_cents || 0))} • Difference ${esc(money(row.filing_difference_cents || 0))}</div><div class="small">Orders ${esc(String(row.order_count || 0))} • Expense rows ${esc(String(row.expense_count || 0))} • Status ${esc(row.review_status || 'draft')}</div><div class="small" style="margin-top:6px">Reference ${esc(row.statement_reference || '')}${row.note ? ` • ${esc(row.note)}` : ''}</div>`;
  }

  async function loadFixedAssets() {
    const data = await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-fixed-assets'), 'Fixed-asset endpoint is unavailable.');
    const listEl = document.getElementById('fixedAssetsList');
    if (!listEl) return;
    listEl.innerHTML = data.assets?.length ? data.assets.map((row) => `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>${esc(row.asset_label || '')}</strong> • ${esc(row.asset_category || '')}${row.cca_class ? ` • ${esc(row.cca_class)}` : ''}<div class="small">Cost ${esc(money(row.cost_cents || 0))} • business use ${esc(String(row.business_use_percent || 100))}%${row.vendor_name ? ` • ${esc(row.vendor_name)}` : ''}</div></div>`).join('') : '<div class="small">No fixed assets tracked yet.</div>';
  }

  async function loadVendorStatements(periodMonth = '') {
    const data = await readJson(await window.DDAuth.apiFetch(`/api/admin/accounting-vendor-statements?period_month=${encodeURIComponent(periodMonth || '')}`), 'Vendor statement endpoint is unavailable.');
    const listEl = document.getElementById('vendorStatementsList');
    if (!listEl) return;
    listEl.innerHTML = data.rows?.length ? data.rows.map((row) => `<div style="padding:8px 0;border-bottom:1px solid #eee"><strong>Vendor ${esc(String(row.vendor_id || 'unlinked'))}</strong><div class="small">Statements ${esc(String(row.statement_count || 0))} • Gross ${esc(money(row.gross_cents || 0))} • Fees ${esc(money(row.fee_cents || 0))} • Net ${esc(money(row.net_cents || 0))}</div><div class="small">${esc((row.filenames || []).join(', '))}</div></div>`).join('') : '<div class="small">No vendor statement coverage found for this month.</div>';
  }

  mount.addEventListener('submit', async (event) => {
    const importForm = event.target.closest('#statementImportForm');
    if (importForm) {
      event.preventDefault();
      const formData = new FormData(importForm);
      const response = await window.DDAuth.apiFetch('/api/admin/accounting-statement-imports', { method: 'POST', body: formData, headers: {} });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) return;
      await loadImports(importForm.elements?.period_month?.value || '');
      await loadExceptions(importForm.elements?.period_month?.value || '');
      await loadWorksheet(importForm.elements?.period_month?.value || '');
      return;
    }
    const assetForm = event.target.closest('#fixedAssetForm');
    if (assetForm) {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(assetForm).entries());
      await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-fixed-assets', { method: 'POST', body: JSON.stringify(payload) }), 'Failed saving fixed asset.');
      assetForm.reset();
      await loadFixedAssets();
    }
  });

  mount.addEventListener('click', async (event) => {
    if (event.target.id === 'loadExceptionsButton') {
      await loadExceptions(document.getElementById('exceptionMonthFilter')?.value || '');
      return;
    }
    if (event.target.id === 'loadSalesTaxWorksheetButton') {
      await loadWorksheet(document.getElementById('salesTaxWorksheetMonth')?.value || '');
      return;
    }
    if (event.target.id === 'loadVendorStatementsButton') {
      await loadVendorStatements(document.getElementById('vendorStatementsMonth')?.value || '');
      return;
    }
    const resolveBtn = event.target.closest('[data-resolve-exception]');
    if (resolveBtn) {
      await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-reconciliation-exceptions', { method: 'POST', body: JSON.stringify({ accounting_reconciliation_exception_id: Number(resolveBtn.getAttribute('data-resolve-exception') || 0), exception_status: 'resolved' }) }), 'Failed resolving exception.');
      await loadExceptions(document.getElementById('exceptionMonthFilter')?.value || '');
      return;
    }
    const ignoreBtn = event.target.closest('[data-ignore-exception]');
    if (ignoreBtn) {
      await readJson(await window.DDAuth.apiFetch('/api/admin/accounting-reconciliation-exceptions', { method: 'POST', body: JSON.stringify({ accounting_reconciliation_exception_id: Number(ignoreBtn.getAttribute('data-ignore-exception') || 0), exception_status: 'ignored' }) }), 'Failed updating exception.');
      await loadExceptions(document.getElementById('exceptionMonthFilter')?.value || '');
    }
  });

  ensureCard();
  loadImports(new Date().toISOString().slice(0,7)).catch(() => {});
  loadExceptions(new Date().toISOString().slice(0,7)).catch(() => {});
  loadWorksheet(new Date().toISOString().slice(0,7)).catch(() => {});
  loadFixedAssets().catch(() => {});
  loadVendorStatements(new Date().toISOString().slice(0,7)).catch(() => {});
});
