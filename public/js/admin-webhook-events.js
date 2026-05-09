// File: /public/js/admin-webhook-events.js
// Brief description: Renders webhook idempotency/replay tooling inside admin so failed or ignored
// events can be reviewed and safely re-queued without leaving the dashboard.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('webhookEventsAdminMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let rendered = false;
  let busy = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById('webhookEventsMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  function titleCase(value) {
    return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (x) => x.toUpperCase());
  }

  function render() {
    if (rendered) return;
    rendered = true;
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">Webhook Review & Replay</h3>
            <p class="small" style="margin:8px 0 0 0">Review idempotent webhook history, failed dispatch attempts, and safely requeue selected events.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="refreshWebhookEventsButton">Refresh Webhooks</button><button class="btn" type="button" id="dispatchWebhookEventsButton">Dispatch Due</button></div>
        </div>
        <div id="webhookEventsMessage" class="small" style="display:none;margin-top:12px"></div>
        <div class="grid cols-3" style="gap:12px;margin-top:12px">
          <div>
            <label class="small" for="webhookProviderFilter">Provider</label>
            <select id="webhookProviderFilter"><option value="">All</option><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select>
          </div>
          <div>
            <label class="small" for="webhookStatusFilter">Process Status</label>
            <select id="webhookStatusFilter"><option value="">All</option><option value="received">Received</option><option value="processed">Processed</option><option value="ignored">Ignored</option><option value="duplicate">Duplicate</option><option value="failed">Failed</option></select>
          </div>
          <div>
            <label class="small" for="webhookSearchInput">Search</label>
            <input id="webhookSearchInput" type="text" placeholder="event id, type, order number..." />
          </div>
        </div>
        <div class="grid cols-6" style="gap:12px;margin-top:12px">
          <div class="card"><div class="small">Total</div><div id="webhookSummaryTotal" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Queued</div><div id="webhookSummaryQueued" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Failed</div><div id="webhookSummaryFailed" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Ignored</div><div id="webhookSummaryIgnored" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Duplicate</div><div id="webhookSummaryDuplicate" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Processed</div><div id="webhookSummaryProcessed" style="font-size:1.15rem;font-weight:800">—</div></div>
        </div>
        <div style="overflow:auto;margin-top:14px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Event</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Order</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Attempts</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Last Seen</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th>
              </tr>
            </thead>
            <tbody id="webhookEventsTableBody"><tr><td colspan="6" style="padding:8px">Loading webhook events...</td></tr></tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('refreshWebhookEventsButton')?.addEventListener('click', load);
    document.getElementById('dispatchWebhookEventsButton')?.addEventListener('click', dispatchDue);
    document.getElementById('webhookProviderFilter')?.addEventListener('change', load);
    document.getElementById('webhookStatusFilter')?.addEventListener('change', load);
    document.getElementById('webhookSearchInput')?.addEventListener('input', debounce(load, 250));

    mountEl.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-webhook-action]');
      if (!btn) return;
      const webhookEventId = Number(btn.getAttribute('data-webhook-event-id') || 0);
      const action = String(btn.getAttribute('data-webhook-action') || '').trim();
      if (!webhookEventId || !action) return;
      await performAction(webhookEventId, action);
    });
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced() {
      clearTimeout(timer);
      timer = setTimeout(() => fn(), wait);
    };
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? '—');
  }

  async function load() {
    if (busy) return;
    busy = true;
    try {
      setMessage('Loading webhook events...');
      const provider = document.getElementById('webhookProviderFilter')?.value || '';
      const process_status = document.getElementById('webhookStatusFilter')?.value || '';
      const q = document.getElementById('webhookSearchInput')?.value || '';
      const response = await window.DDAuth.apiFetch(`/api/admin/webhook-events?provider=${encodeURIComponent(provider)}&process_status=${encodeURIComponent(process_status)}&q=${encodeURIComponent(q)}&limit=80`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load webhook events.');
      const summary = data.summary || {};
      setValue('webhookSummaryTotal', summary.total_events || 0);
      setValue('webhookSummaryQueued', summary.queued_events || 0);
      setValue('webhookSummaryFailed', summary.failed_events || 0);
      setValue('webhookSummaryIgnored', summary.ignored_events || 0);
      setValue('webhookSummaryDuplicate', summary.duplicate_events || 0);
      setValue('webhookSummaryProcessed', summary.processed_events || 0);
      const rows = Array.isArray(data.items) ? data.items : [];
      const body = document.getElementById('webhookEventsTableBody');
      if (!body) return;
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="6" style="padding:8px">No webhook events match the current filters.</td></tr>';
      } else {
        body.innerHTML = rows.map((row) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">
              <div><strong>${titleCase(row.provider || '—')}</strong> • ${row.provider_event_id || '—'}</div>
              <div class="small">${row.event_type || '—'}</div>
              ${row.error_text ? `<div class="small" style="color:#b00020">${row.error_text}</div>` : ''}
            </td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${titleCase(row.process_status || '—')}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${row.order_number || '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${Number(row.attempt_count || 0)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${fmtDate(row.last_attempt_at || row.received_at)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn" type="button" data-webhook-action="requeue" data-webhook-event-id="${row.webhook_event_id}">Requeue</button>
                <button class="btn" type="button" data-webhook-action="mark_processed" data-webhook-event-id="${row.webhook_event_id}">Mark Processed</button>
              </div>
            </td>
          </tr>`).join('');
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Failed to load webhook events.', true);
    } finally {
      busy = false;
    }
  }


  async function dispatchDue() {
    try {
      setMessage('Dispatching due webhook events...');
      const response = await window.DDAuth.apiFetch('/api/admin/webhook-dispatch', {
        method: 'POST',
        body: JSON.stringify({ mode: 'dispatch_due', limit: 25 })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to dispatch due webhooks.');
      setMessage(`Requeued ${Number(data.processed_count || 0)} due webhook event(s).`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Failed to dispatch due webhooks.', true);
    }
  }

  async function performAction(webhookEventId, action) {
    try {
      setMessage(`Running ${action}...`);
      const response = await window.DDAuth.apiFetch('/api/admin/webhook-events', {
        method: 'PATCH',
        body: JSON.stringify({ webhook_event_id: webhookEventId, action })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Failed to ${action} webhook event.`);
      setMessage(data.message || 'Webhook event updated.');
      await load();
      document.dispatchEvent(new CustomEvent('dd:webhooks-updated', { detail: data }));
    } catch (error) {
      setMessage(error.message || 'Failed to update webhook event.', true);
    }
  }

  document.addEventListener('dd:admin-ready', (event) => {
    if (!event?.detail?.ok) return;
    render();
    load();
  });

  render();
});
