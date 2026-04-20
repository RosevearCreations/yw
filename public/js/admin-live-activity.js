// File: /public/js/admin-live-activity.js
// Brief description: Loads and refreshes the short live activity feed on the admin dashboard.

document.addEventListener("DOMContentLoaded", () => {
  if (!window.DDAuth) return;

  const mount = document.getElementById("adminLiveActivityMount");
  if (!mount) return;

  let timer = null;

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmt(dt) {
    if (!dt) return "—";
    const d = new Date(dt);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }

  function chip(severity) {
    const label = severity || 'info';
    return `<span class="status-chip">${esc(label)}</span>`;
  }

  function render(items) {
    if (!Array.isArray(items) || !items.length) {
      mount.innerHTML = '<div class="admin-panel"><h3 style="margin-top:0">Live Activity</h3><div class="small">No recent activity yet.</div></div>';
      return;
    }
    mount.innerHTML = `
      <div class="admin-panel">
        <div class="admin-toolbar">
          <div>
            <h3 style="margin:0">Live Activity</h3>
            <div class="small">Recent searches, visitor sessions, cart events, orders, and webhook updates.</div>
          </div>
          <button class="btn" type="button" id="adminLiveRefreshButton">Refresh Live Feed</button>
        </div>
        <div class="admin-live-feed" style="margin-top:14px">
          ${items.map((item) => `
            <div class="admin-live-item">
              <div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">
                <strong>${esc(item.title || 'Activity')}</strong>
                ${chip(item.severity)}
              </div>
              <div class="small json-inline" style="margin-top:6px">${esc(item.detail || '')}</div>
              <div class="admin-live-meta">
                <span>${esc(item.type || 'activity')}</span>
                <span>${esc(fmt(item.at))}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    mount.querySelector('#adminLiveRefreshButton')?.addEventListener('click', load);
  }

  async function load() {
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/live-activity', { method: 'GET' });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load live activity.');
      render(data.items || []);
    } catch (error) {
      mount.innerHTML = `<div class="admin-panel"><h3 style="margin-top:0">Live Activity</h3><div class="small">${esc(error.message || 'Failed to load live activity.')}</div></div>`;
    }
  }

  document.addEventListener('dd:admin-ready', (event) => {
    if (!event?.detail?.ok) return;
    load();
    if (timer) clearInterval(timer);
    timer = setInterval(load, 30000);
  });
});
