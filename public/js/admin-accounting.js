// File: /public/js/admin-accounting.js
// Brief description: Shows a lightweight accounting view for created orders.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("adminAccountingMount");
  if (!mountEl || !window.DDAuth) return;

  function formatMoney(cents, currency = "CAD") {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((Number(cents || 0) / 100));
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('\"', '&quot;').replaceAll("'", "&#039;");
  }

  function renderEmpty(message = "No accounting records yet.") {
    mountEl.innerHTML = `<div class="card"><h3 style="margin-top:0">Accounting Shadow Records</h3><div class="small">${escapeHtml(message)}</div></div>`;
  }

  async function load() {
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/accounting-summary', { method: 'GET' });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load accounting summary.');
      const summary = data.summary || {};
      const rows = Array.isArray(data.records) ? data.records : [];
      mountEl.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <h3 style="margin:0">Accounting Shadow Records</h3>
              <p class="small" style="margin:8px 0 0 0">Each created order now seeds a basic accounting-ready record for later cost, revenue, inventory, and tax work.</p>
            </div>
            <div class="small">${escapeHtml(String(summary.records_count || 0))} records • ${escapeHtml(String(summary.open_records_count || 0))} open</div>
          </div>
          <div class="admin-summary-grid" style="margin-top:14px">
            <div class="admin-stat"><div class="admin-stat-label">Booked</div><div class="admin-stat-value">${formatMoney(summary.total_booked_cents || 0)}</div></div>
            <div class="admin-stat"><div class="admin-stat-label">Paid</div><div class="admin-stat-value">${formatMoney(summary.total_paid_cents || 0)}</div></div>
            <div class="admin-stat"><div class="admin-stat-label">Outstanding</div><div class="admin-stat-value">${formatMoney(summary.total_outstanding_cents || 0)}</div></div>
            <div class="admin-stat"><div class="admin-stat-label">Tax Liability</div><div class="admin-stat-value">${formatMoney(summary.total_tax_cents || 0)}</div></div>
          </div>
          <div class="admin-table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Outstanding</th><th>Tax</th><th>Updated</th></tr></thead>
              <tbody>
                ${rows.length ? rows.map((row) => `
                  <tr>
                    <td><a href="/admin/order-detail/?order_id=${encodeURIComponent(row.order_id)}">${escapeHtml(row.order_number || `#${row.order_id}`)}</a></td>
                    <td><div>${escapeHtml(row.customer_name || '—')}</div><div class="small">${escapeHtml(row.customer_email || '')}</div></td>
                    <td>${escapeHtml(row.entry_status || 'open')}<div class="small">${escapeHtml(row.source_order_status || '')} • ${escapeHtml(row.source_payment_status || '')}</div></td>
                    <td>${formatMoney(row.total_cents || 0, row.currency || 'CAD')}</td>
                    <td>${formatMoney(row.amount_outstanding_cents || 0, row.currency || 'CAD')}</td>
                    <td>${formatMoney(row.tax_liability_cents || 0, row.currency || 'CAD')}</td>
                    <td>${escapeHtml(row.updated_at || row.created_at || '—')}</td>
                  </tr>`).join('') : `<tr><td colspan="7" style="padding:12px">No accounting records yet.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (error) {
      renderEmpty(error.message || 'Failed to load accounting summary.');
    }
  }

  document.addEventListener('dd:admin-ready', (event) => { if (event?.detail?.ok) load(); });
  document.addEventListener('dd:order-updated', load);
  renderEmpty('Loading accounting records...');
});
