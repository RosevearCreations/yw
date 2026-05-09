document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('mobileDashboardMonth');
  const refreshButton = document.getElementById('mobileDashboardRefreshButton');
  const messageEl = document.getElementById('mobileDashboardMessage');
  const monthStats = document.getElementById('mobileAdminMonthSummary');
  const draftStats = document.getElementById('mobileAdminDraftSummary');
  const accountingStats = document.getElementById('mobileAdminAccountingSummary');
  const healthStats = document.getElementById('mobileAdminHealthSummary');
  if (!monthInput || !refreshButton || !messageEl || !monthStats || !draftStats || !accountingStats || !healthStats || !window.DDAuth) return;

  const SNAPSHOT_KEY = 'dd_mobile_admin_dashboard_snapshot_v2';
  const ORDER_PENDING_ACTIONS_KEY = 'dd_admin_order_pending_actions_v1';
  const PRODUCT_PENDING_ACTIONS_KEY = 'dd_admin_product_review_pending_actions_v1';
  const PRODUCT_UPDATE_PENDING_ACTIONS_KEY = 'dd_admin_product_update_pending_actions_v1';

  function centsToMoney(cents, currency = 'CAD') {
    const value = Number(cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); }
    catch { return `${currency} ${value.toFixed(2)}`; }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function setMessage(text, tone = 'info') {
    messageEl.textContent = text || '';
    messageEl.style.display = text ? 'block' : 'none';
    messageEl.className = text ? `status-note ${tone}` : 'status-note';
  }
  function monthValue() { return String(monthInput.value || new Date().toISOString().slice(0, 7)); }
  function parseSafeJson(value, fallback = null) { try { return JSON.parse(value); } catch { return fallback; } }
  function loadSnapshot() { return parseSafeJson(localStorage.getItem(SNAPSHOT_KEY) || 'null', null); }
  function saveSnapshot(snapshot) { try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {} }
  function countLocalRows(key) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows.length : 0;
    } catch {
      return 0;
    }
  }
  function loadPendingClientActionsCount() {
    return countLocalRows(ORDER_PENDING_ACTIONS_KEY) + countLocalRows(PRODUCT_PENDING_ACTIONS_KEY) + countLocalRows(PRODUCT_UPDATE_PENDING_ACTIONS_KEY);
  }

  function renderMonthSummary(report, costing) {
    const summary = report?.summary || {};
    const costingSummary = costing?.summary || {};
    monthStats.innerHTML = `
      <div class="admin-stat"><div class="admin-stat-label">Recognized revenue</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Math.round(Number(summary.recognized_amount || 0) * 100)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Expenses + tax</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.operating_expense_cents || 0) + Number(summary.operating_expense_tax_cents || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Allocated overhead</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.overhead_allocated_cents || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Net after overhead</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(summary.rough_net_after_overhead_cents || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Negative margins</div><div class="admin-stat-value">${escapeHtml(String(Number(costingSummary.negative_margin_count || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Missing cost links</div><div class="admin-stat-value">${escapeHtml(String(Number(costingSummary.missing_cost_link_count || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Products sold this month</div><div class="admin-stat-value">${escapeHtml(String(Number(costingSummary.products_sold_in_period || 0)))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Recognized full COGS</div><div class="admin-stat-value">${escapeHtml(centsToMoney(Number(costingSummary.estimated_recognized_full_cogs_cents || 0)))}</div></div>`;
  }

  function renderAccountingSummary(payload) {
    const summary = payload?.summary || {};
    accountingStats.innerHTML = `
      <div class="mobile-summary-list">
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(summary.open_records_count || 0)))}</strong><div class="small">Open or partially paid records</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(centsToMoney(Number(summary.total_outstanding_cents || 0)))}</strong><div class="small">Outstanding amount still open</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(centsToMoney(Number(summary.total_paid_cents || 0)))}</strong><div class="small">Paid amount recorded so far</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(centsToMoney(Number(summary.total_tax_cents || 0)))}</strong><div class="small">Tax liability recorded</div></div>
      </div>`;
  }

  function renderDraftSummary(drafts) {
    const rows = Array.isArray(drafts) ? drafts : [];
    const latest = rows.slice(0, 6);
    draftStats.innerHTML = rows.length ? `<div class="mobile-summary-list">${latest.map((row) => {
      const issues = [];
      if (!row.name) issues.push('name');
      if (!row.product_category) issues.push('category');
      if (Number(row.price_cents || 0) <= 0) issues.push('price');
      if (Number(row.image_count || 0) <= 0) issues.push('photo');
      return `<div class="mobile-summary-list-item"><strong>DD${String(row.product_number || '').padStart(4, '0')}</strong> <span>${escapeHtml(row.name || row.capture_reference || 'Unnamed draft')}</span><div class="small">${escapeHtml(row.updated_at || '—')} · ${issues.length ? `Needs ${issues.join(', ')}` : 'Basics present'}</div></div>`;
    }).join('')}</div><div class="small" style="margin-top:8px">${rows.length} draft products available from this screen.</div>` : '<div class="small">No draft products are waiting right now.</div>';
  }

  function renderHealthSummary(summary) {
    const s = summary || {};
    const pendingClientActions = loadPendingClientActionsCount();
    healthStats.innerHTML = `
      <div class="mobile-summary-list">
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.recent_runtime_incidents_count || 0)))}</strong><div class="small">Runtime incidents in the last 7 days</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.admin_order_runtime_incidents_count || 0)))}</strong><div class="small">Order and payment incident warnings</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.admin_write_runtime_incidents_count || 0)))}</strong><div class="small">Admin write-path incident warnings</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.pending_shared_admin_actions_count || 0)))}</strong><div class="small">Shared queued admin fallback actions</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.failed_shared_admin_actions_count || 0)))}</strong><div class="small">Shared queued actions still failing replay</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.pending_shared_admin_order_actions_count || 0)))}</strong><div class="small">Shared queued order/payment actions</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.pending_shared_product_review_actions_count || 0)))}</strong><div class="small">Shared queued product review actions</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.pending_shared_product_update_actions_count || 0)))}</strong><div class="small">Shared queued product edit actions</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.outstanding_orders_count || 0)))}</strong><div class="small">Orders still waiting for payment or closure</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.payment_sync_failures_count || 0)))}</strong><div class="small">Provider refund sync failures</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.journal_imbalance_count || 0)))}</strong><div class="small">Journal rows still out of balance</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(s.overhead_product_override_count || 0)))}</strong><div class="small">Explicit overhead product overrides</div></div>
        <div class="mobile-summary-list-item"><strong>${escapeHtml(String(Number(pendingClientActions || 0)))}</strong><div class="small">Browser-only fallback actions still not shared</div></div>
      </div>`;
  }

  async function fetchJsonState(url, fallbackLabel) {
    try {
      const response = await window.DDAuth.apiFetch(url);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || fallbackLabel);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error?.message || fallbackLabel, data: null };
    }
  }

  async function load() {
    setMessage('Loading phone dashboard snapshot...');
    const month = monthValue();
    const cached = loadSnapshot();

    const [reportState, costState, draftsState, accountingState, dashboardState] = await Promise.all([
      fetchJsonState(`/api/admin/accounting-profit-loss?month=${encodeURIComponent(month)}`, 'Failed loading accounting snapshot.'),
      fetchJsonState(`/api/admin/accounting-item-costing?month=${encodeURIComponent(month)}`, 'Failed loading costing snapshot.'),
      fetchJsonState('/api/admin/mobile-product-drafts?status=draft&limit=12', 'Failed loading draft products.'),
      fetchJsonState('/api/admin/accounting-summary', 'Failed loading accounting records.'),
      fetchJsonState('/api/admin/dashboard-summary', 'Failed loading site health snapshot.')
    ]);

    const effective = {
      month,
      report: reportState.data || (cached?.report ?? null),
      costing: costState.data || (cached?.costing ?? null),
      drafts: draftsState.data || (cached?.drafts ?? null),
      accounting: accountingState.data || (cached?.accounting ?? null),
      dashboard: dashboardState.data || (cached?.dashboard ?? null),
      cached_at: new Date().toISOString()
    };

    if (effective.report && effective.costing) renderMonthSummary(effective.report, effective.costing);
    else monthStats.innerHTML = '<div class="small">Month snapshot is unavailable right now.</div>';

    if (effective.drafts) renderDraftSummary(effective.drafts.drafts || []);
    else draftStats.innerHTML = '<div class="small">Draft snapshot is unavailable right now.</div>';

    if (effective.accounting) renderAccountingSummary(effective.accounting);
    else accountingStats.innerHTML = '<div class="small">Accounting snapshot is unavailable right now.</div>';

    if (effective.dashboard) renderHealthSummary(effective.dashboard.summary || {});
    else healthStats.innerHTML = '<div class="small">Site health snapshot is unavailable right now.</div>';

    if (reportState.ok || costState.ok || draftsState.ok || accountingState.ok || dashboardState.ok) saveSnapshot(effective);

    const warnings = [reportState, costState, draftsState, accountingState, dashboardState]
      .filter((entry) => !entry.ok)
      .map((entry) => entry.error);

    if (!warnings.length) {
      setMessage(`Loaded ${month} phone dashboard snapshot.`, 'success');
      return;
    }

    if (effective.report || effective.costing || effective.drafts || effective.accounting || effective.dashboard) {
      setMessage(`Showing partial dashboard data. ${warnings.join(' ')}`, 'warning');
      return;
    }

    setMessage(`Failed loading phone dashboard snapshot. ${warnings.join(' ')}`, 'error');
  }

  monthInput.value = monthValue();
  refreshButton.addEventListener('click', load);
  monthInput.addEventListener('change', load);
  load();
});
