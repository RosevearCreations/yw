/* File: js/hse-ops-ui.js
   Brief description: Separate HSE Operations hub outside Admin.
   Renders OSHA-oriented workflow cards, mobile-safe quick actions, cached fallback summaries,
   and admin shortcuts for linked HSE packets and analytics monitoring.
*/

'use strict';

(function () {
  const SECTION_ID = 'hseops';
  const ADMIN_CACHE_KEY = 'ywi_admin_directory_cache_v1';
  const HSE_CACHE_KEY = 'ywi_hse_ops_cache_v1';
  const state = { loaded: false, loading: false, payload: null, summary: null };

  function getSection() {
    return document.getElementById(SECTION_ID);
  }

  function getAuthState() {
    return window.YWI_AUTH?.getState?.() || {};
  }

  function getRole() {
    return String(getAuthState()?.role || 'employee').trim().toLowerCase() || 'employee';
  }

  function canLoadOperationalData() {
    const security = window.YWISecurity;
    if (!security?.hasMinRole) return false;
    return security.hasMinRole(getRole(), 'supervisor');
  }

  function escHtml(value) {
    return window.YWIAPI?.escHtml?.(value) || String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function loadCachedPayload() {
    try {
      const cached = JSON.parse(localStorage.getItem(HSE_CACHE_KEY) || 'null');
      if (cached?.payload) return cached.payload;
    } catch {}
    try {
      const cached = JSON.parse(localStorage.getItem(ADMIN_CACHE_KEY) || 'null');
      if (cached?.payload) return cached.payload;
    } catch {}
    return null;
  }

  function saveCache(payload) {
    try {
      localStorage.setItem(HSE_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), payload }));
    } catch {}
  }

  function normalizeSummary(payload = {}) {
    const hseSummary = Array.isArray(payload?.hse_dashboard_summary) ? payload.hse_dashboard_summary[0] : null;
    const accountingSummary = Array.isArray(payload?.accounting_review_summary) ? payload.accounting_review_summary[0] : null;
    const packets = Array.isArray(payload?.linked_hse_packets) ? payload.linked_hse_packets : [];
    const actionItems = Array.isArray(payload?.hse_packet_action_items) ? payload.hse_packet_action_items : [];
    const alerts = Array.isArray(payload?.monitor_threshold_alerts) ? payload.monitor_threshold_alerts : [];
    const exceptions = Array.isArray(payload?.gl_journal_sync_exceptions) ? payload.gl_journal_sync_exceptions : [];
    const batches = Array.isArray(payload?.gl_journal_batches) ? payload.gl_journal_batches : [];
    const trafficDaily = Array.isArray(payload?.app_traffic_daily_summary) ? payload.app_traffic_daily_summary : [];

    const needsAttention = actionItems.filter((item) => item?.needs_attention);
    const openExceptions = exceptions.filter((item) => String(item?.exception_status || '').toLowerCase() === 'open');
    const staleBatches = batches.filter((item) => ['stale', 'out_of_sync', 'needs_review'].includes(String(item?.source_sync_state || '').toLowerCase()));
    const latestTraffic = trafficDaily[0] || null;

    return {
      hse: hseSummary || {
        total_packets: packets.length,
        action_needed_packets: needsAttention.length,
        ready_for_closeout_packets: packets.filter((item) => String(item?.packet_status || '').toLowerCase() === 'ready_for_closeout').length,
        exception_packets: packets.filter((item) => Number(item?.exception_event_count || 0) > 0).length,
        reopen_packets: packets.filter((item) => !!item?.reopen_in_progress).length,
        signoff_open_packets: packets.filter((item) => !!item?.field_signoff_required && !item?.field_signoff_completed).length,
        weather_open_packets: packets.filter((item) => !!item?.weather_monitoring_required && !item?.weather_monitoring_completed).length,
        heat_open_packets: packets.filter((item) => !!item?.heat_monitoring_required && !item?.heat_monitoring_completed).length,
        chemical_open_packets: packets.filter((item) => !!item?.chemical_handling_required && !item?.chemical_handling_completed).length,
        traffic_open_packets: packets.filter((item) => !!item?.traffic_control_required && !item?.traffic_control_completed).length
      },
      accounting: accountingSummary || {
        open_sync_exception_count: openExceptions.length,
        stale_source_batch_count: staleBatches.length,
        unposted_batch_count: batches.filter((item) => String(item?.batch_status || '').toLowerCase() !== 'posted').length,
        unbalanced_batch_count: batches.filter((item) => item?.is_balanced === false).length,
        latest_daily_event_date: latestTraffic?.event_date || '',
        latest_daily_total_events: latestTraffic?.total_events || 0
      },
      alerts,
      actionItems,
      latestTraffic,
      savedAt: new Date().toISOString()
    };
  }

  function quickActionsMarkup() {
    return `
      <div class="hseops-grid">
        <button class="hseops-card" type="button" data-route="toolbox"><strong>Toolbox Talk</strong><span>Daily briefings, work-start signoff, and task hazard notes.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="ppe"><strong>PPE Check</strong><span>Verify required PPE before dispatch, maintenance, or public-facing work.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="inspect"><strong>Site Inspection</strong><span>Capture slips, trips, lifting, traffic, weather, and chemical hazards.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="firstaid"><strong>First Aid Kit</strong><span>Track field readiness for crews, vehicles, and unscheduled jobs.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="drill"><strong>Emergency Drill</strong><span>Review preparedness, response, and repeat-crew safety expectations.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="log"><strong>Logbook / Review</strong><span>Review submissions, images, approvals, and linked field history.</span><em>Open</em></button>
      </div>`;
  }

  function adminActionsMarkup(role) {
    const canAdminFocus = window.YWISecurity?.hasMinRole?.(role, 'supervisor');
    if (!canAdminFocus) {
      return `<div class="notice" style="margin-top:14px;">Supervisor, HSE, job admin, or admin roles can open linked HSE packet follow-up and monitoring review from this hub.</div>`;
    }
    return `
      <div class="hseops-grid hseops-grid--compact">
        <button class="hseops-card hseops-card--accent" type="button" data-admin-focus="linked_hse_packet"><strong>Linked HSE Packets</strong><span>Open standalone-capable packets tied to jobs, sites, work orders, routes, equipment, dispatches, and subcontract work.</span><em>Review</em></button>
        <button class="hseops-card hseops-card--accent" type="button" data-admin-focus="app_traffic_event"><strong>Analytics / Traffic Monitor</strong><span>Review traffic telemetry, upload issues, and runtime incidents from the same workflow shell.</span><em>Review</em></button>
        <button class="hseops-card" type="button" data-route="jobs"><strong>Jobs and Crews</strong><span>Open jobs, recurring work, crew assignments, and supervisor ownership.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="equipment"><strong>Equipment</strong><span>Open field equipment, inspections, damage, evidence, and signout context.</span><em>Open</em></button>
      </div>`;
  }

  function guidanceMarkup() {
    return `
      <div class="hseops-guidance-grid">
        <article class="hseops-guidance-card"><h3>Machinery and tools</h3><p>Keep packet and inspection notes focused on moving blades, pinch points, thrown objects, guards, lockout, and task-specific tool risks.</p></article>
        <article class="hseops-guidance-card"><h3>Lifting and awkward posture</h3><p>Capture manual handling, repetitive work, reach height, uneven terrain, and crew-size needs before field start and closeout.</p></article>
        <article class="hseops-guidance-card"><h3>Weather and heat</h3><p>Review workload, temperature, humidity, sun, air movement, clothing, hydration, and worker-specific risk before and during field work.</p></article>
        <article class="hseops-guidance-card"><h3>Chemicals and public interaction</h3><p>Track chemical handling, PPE, SDS awareness, public traffic, cones/barriers, roadside exposure, and site communication notes.</p></article>
      </div>`;
  }

  function summaryMarkup(summary) {
    const hse = summary?.hse || {};
    const acct = summary?.accounting || {};
    const latestTraffic = summary?.latestTraffic || null;
    const alertCount = Array.isArray(summary?.alerts) ? summary.alerts.length : 0;
    return `
      <div class="admin-backbone-summary">
        <div class="admin-backbone-card"><span>Open HSE follow-up</span><strong>${escHtml(hse.action_needed_packets || 0)}</strong><small>Packets still needing signoff, closeout, or exception review.</small></div>
        <div class="admin-backbone-card"><span>Ready for closeout</span><strong>${escHtml(hse.ready_for_closeout_packets || 0)}</strong><small>Field packets ready for supervisor closeout.</small></div>
        <div class="admin-backbone-card"><span>Weather / heat open</span><strong>${escHtml((Number(hse.weather_open_packets || 0) + Number(hse.heat_open_packets || 0)))}</strong><small>Packets missing weather or heat workflow completion.</small></div>
        <div class="admin-backbone-card"><span>Chemical / traffic open</span><strong>${escHtml((Number(hse.chemical_open_packets || 0) + Number(hse.traffic_open_packets || 0)))}</strong><small>Chemical-handling and public-interaction steps still open.</small></div>
        <div class="admin-backbone-card"><span>Accounting review</span><strong>${escHtml((Number(acct.open_sync_exception_count || 0) + Number(acct.stale_source_batch_count || 0)))}</strong><small>Open sync exceptions and stale source batches still waiting for review.</small></div>
        <div class="admin-backbone-card"><span>Traffic alerts</span><strong>${escHtml(alertCount)}</strong><small>${latestTraffic ? `${escHtml(latestTraffic.event_date || '')} · ${escHtml(latestTraffic.total_events || 0)} events` : 'Monitoring summary unavailable.'}</small></div>
      </div>`;
  }

  function render(summary = null, options = {}) {
    const section = getSection();
    if (!section) return;
    const role = getRole();
    const label = window.YWISecurity?.getRoleLabel?.(role) || role;
    const cacheNote = options.cached ? '<div class="notice" style="margin-bottom:14px;">Live operational summary is unavailable. Showing the last good HSE/monitoring snapshot from local cache.</div>' : '';
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>HSE Operations</h2>
          <p class="section-subtitle">A cleaner safety hub outside Admin for linked packets, dispatch safety, weather and heat checks, chemical handling, traffic/public interaction, and field closeout.</p>
        </div>
      </div>
      ${cacheNote}
      <div class="notice" style="margin-bottom:14px;">
        <strong>Current focus</strong>
        <p style="margin:8px 0 0;">Use this area to move field safety forward without digging through the full Admin page. ${escHtml(label)} access still controls which linked packet and monitoring shortcuts are available.</p>
      </div>
      ${summaryMarkup(summary)}
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Field safety quick actions</h3><p class="section-subtitle">Open the most-used field workflows quickly on phone, tablet, or desktop.</p></div></div>
        ${quickActionsMarkup()}
      </div>
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Linked packet and monitoring shortcuts</h3><p class="section-subtitle">Keep HSE standalone-capable, but open linked packets and monitor review when a formal job, route, dispatch, or equipment record exists.</p></div></div>
        ${adminActionsMarkup(role)}
      </div>
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">OSHA-oriented field reminders</h3><p class="section-subtitle">Use the packet workflow to keep machinery, lifting, slips, chemicals, traffic, and heat controls visible for the crew.</p></div></div>
        ${guidanceMarkup()}
      </div>`;

    section.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => window.YWIRouter?.showSection?.(btn.getAttribute('data-route') || 'toolbox'));
    });
    section.querySelectorAll('[data-admin-focus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entity = btn.getAttribute('data-admin-focus') || 'linked_hse_packet';
        window.YWIRouter?.showSection?.('admin', { skipFocus: true });
        window.setTimeout(() => {
          document.dispatchEvent(new CustomEvent('ywi:admin-focus-request', { detail: { entity } }));
        }, 80);
      });
    });
  }

  async function loadLiveSummary() {
    if (state.loading || !canLoadOperationalData() || !window.YWIAPI?.loadAdminSelectors) return;
    state.loading = true;
    try {
      const payload = await window.YWIAPI.loadAdminSelectors({ scope: 'all' });
      state.payload = payload || {};
      state.summary = normalizeSummary(state.payload);
      saveCache(state.payload);
      render(state.summary, { cached: false });
    } catch {
      const cached = loadCachedPayload();
      if (cached) {
        state.payload = cached;
        state.summary = normalizeSummary(cached);
        render(state.summary, { cached: true });
      }
    } finally {
      state.loading = false;
      state.loaded = true;
    }
  }

  function ensureBaseRender() {
    const cached = loadCachedPayload();
    state.payload = cached || {};
    state.summary = normalizeSummary(state.payload || {});
    render(state.summary, { cached: !!cached });
  }

  function init() {
    ensureBaseRender();
    document.addEventListener('ywi:route-shown', (event) => {
      const allowed = event?.detail?.allowed || '';
      if (allowed === SECTION_ID) {
        ensureBaseRender();
        loadLiveSummary();
      }
    });
    document.addEventListener('ywi:auth-changed', () => {
      ensureBaseRender();
      if (window.location.hash === '#hseops') loadLiveSummary();
    });
  }

  window.YWIHSEOpsUI = { init, refresh: loadLiveSummary };
  document.addEventListener('DOMContentLoaded', init);
})();
