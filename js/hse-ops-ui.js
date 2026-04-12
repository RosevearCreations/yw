/* File: js/hse-ops-ui.js
   Brief description: Separate HSE Operations hub outside Admin.
   Renders OSHA-oriented workflow cards, mobile-safe quick actions, linked packet review lanes,
   monitoring drill-through shortcuts, and cached fallback summaries.
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

  function rankAlertLevel(level) {
    return { error: 1, critical: 1, warning: 2, info: 3 }[String(level || '').toLowerCase()] || 9;
  }

  function rankSeverity(level) {
    return { critical: 1, error: 2, warning: 3, info: 4 }[String(level || '').toLowerCase()] || 9;
  }

  function sortPacketRows(rows = []) {
    return [...rows].sort((a, b) => {
      const aAttention = a?.needs_attention ? 0 : 1;
      const bAttention = b?.needs_attention ? 0 : 1;
      if (aAttention !== bAttention) return aAttention - bAttention;
      const aPriority = Number(a?.action_priority || 999);
      const bPriority = Number(b?.action_priority || 999);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a?.packet_number || '').localeCompare(String(b?.packet_number || ''));
    });
  }

  function deriveLinkedContextSummary(payload = {}) {
    const existing = Array.isArray(payload?.hse_link_context_summary) ? payload.hse_link_context_summary.filter(Boolean) : [];
    if (existing.length) return existing;

    const packets = Array.isArray(payload?.linked_hse_packets) ? payload.linked_hse_packets : [];
    const actionMap = new Map((Array.isArray(payload?.hse_packet_action_items) ? payload.hse_packet_action_items : []).map((item) => [String(item?.packet_id || item?.id || ''), item]));
    const rows = packets.map((packet) => ({ ...packet, ...(actionMap.get(String(packet?.id || '')) || {}) }));
    const lanes = [
      { lane_key: 'job_work_order', lane_title: 'Jobs and work orders', match: (row) => !!row?.job_id || !!row?.work_order_id },
      { lane_key: 'site_context', lane_title: 'Sites and client locations', match: (row) => !!row?.client_site_id },
      { lane_key: 'route_dispatch', lane_title: 'Routes, dispatches, and subcontract work', match: (row) => !!row?.route_id || !!row?.dispatch_id },
      { lane_key: 'equipment', lane_title: 'Equipment-linked packets', match: (row) => !!row?.equipment_master_id },
      { lane_key: 'standalone', lane_title: 'Standalone and unscheduled packets', match: (row) => !!row?.unscheduled_project || String(row?.packet_scope || '').toLowerCase() === 'standalone' || String(row?.packet_type || '').toLowerCase() === 'unscheduled_project' || (!row?.job_id && !row?.work_order_id && !row?.client_site_id && !row?.route_id && !row?.dispatch_id && !row?.equipment_master_id) }
    ];

    return lanes.map((lane, index) => {
      const laneRows = sortPacketRows(rows.filter((row) => lane.match(row)));
      const top = laneRows[0] || null;
      return {
        lane_key: lane.lane_key,
        lane_title: lane.lane_title,
        sort_order: index + 1,
        related_entity: 'linked_hse_packet',
        packet_count: laneRows.length,
        attention_count: laneRows.filter((row) => !!row?.needs_attention).length,
        ready_for_closeout_count: laneRows.filter((row) => String(row?.packet_status || '').toLowerCase() === 'ready_for_closeout').length,
        top_packet_id: top?.id || top?.packet_id || '',
        top_packet_number: top?.packet_number || '',
        top_action_title: top?.action_title || (top ? 'Packet review' : ''),
        top_action_summary: top?.action_summary || '',
        observed_at: top?.last_event_at || top?.updated_at || top?.created_at || ''
      };
    }).filter((row) => row.packet_count > 0);
  }

  function deriveMonitorReviewSummary(payload = {}) {
    const existing = Array.isArray(payload?.monitor_review_summary) ? payload.monitor_review_summary.filter(Boolean) : [];
    if (existing.length) return existing;

    const uploads = Array.isArray(payload?.field_upload_failures) ? [...payload.field_upload_failures] : [];
    uploads.sort((a, b) => {
      const aOpen = a?.resolved_at ? 1 : 0;
      const bOpen = b?.resolved_at ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
    });
    const topUpload = uploads[0] || null;

    const alerts = Array.isArray(payload?.monitor_threshold_alerts) ? payload.monitor_threshold_alerts.filter((row) => String(row?.alert_scope || '').toLowerCase() === 'analytics' || String(row?.alert_key || '').startsWith('traffic-')) : [];
    alerts.sort((a, b) => {
      const diff = rankAlertLevel(a?.alert_level) - rankAlertLevel(b?.alert_level);
      if (diff) return diff;
      return String(b?.observed_at || '').localeCompare(String(a?.observed_at || ''));
    });
    const topAlert = alerts[0] || null;

    const backend = Array.isArray(payload?.backend_monitor_events) ? payload.backend_monitor_events.filter((row) => ['open', 'investigating'].includes(String(row?.lifecycle_status || '').toLowerCase()) || ['critical', 'error'].includes(String(row?.severity || '').toLowerCase())) : [];
    backend.sort((a, b) => {
      const severity = rankSeverity(a?.severity) - rankSeverity(b?.severity);
      if (severity) return severity;
      return String(b?.last_seen_at || b?.created_at || '').localeCompare(String(a?.last_seen_at || a?.created_at || ''));
    });
    const topBackend = backend[0] || null;

    return [
      {
        lane_key: 'upload_failures',
        lane_title: 'Upload issues',
        sort_order: 1,
        related_entity: 'field_upload_failure',
        record_count: uploads.length,
        open_count: uploads.filter((row) => !row?.resolved_at).length,
        error_count: uploads.filter((row) => ['failed', 'dead_letter'].includes(String(row?.retry_status || '').toLowerCase())).length,
        top_record_id: topUpload?.id || '',
        top_label: topUpload?.file_name || topUpload?.packet_number || topUpload?.job_code || topUpload?.linked_record_type || '',
        top_summary: topUpload ? [topUpload.failure_scope, topUpload.failure_stage, topUpload.failure_reason].filter(Boolean).join(' | ') : '',
        observed_at: topUpload?.created_at || ''
      },
      {
        lane_key: 'traffic_reliability',
        lane_title: 'Traffic and reliability',
        sort_order: 2,
        related_entity: 'app_traffic_event',
        record_count: alerts.length,
        open_count: alerts.length,
        error_count: alerts.filter((row) => String(row?.alert_level || '').toLowerCase() === 'error').length,
        top_record_id: '',
        top_label: topAlert?.alert_title || '',
        top_summary: topAlert?.alert_summary || '',
        observed_at: topAlert?.observed_at || ''
      },
      {
        lane_key: 'runtime_incidents',
        lane_title: 'Runtime and API incidents',
        sort_order: 3,
        related_entity: 'backend_monitor_event',
        record_count: backend.length,
        open_count: backend.filter((row) => ['open', 'investigating'].includes(String(row?.lifecycle_status || '').toLowerCase())).length,
        error_count: backend.filter((row) => ['critical', 'error'].includes(String(row?.severity || '').toLowerCase())).length,
        top_record_id: topBackend?.id || '',
        top_label: topBackend?.title || topBackend?.event_name || '',
        top_summary: topBackend ? [topBackend.monitor_scope, topBackend.severity, topBackend.message].filter(Boolean).join(' | ') : '',
        observed_at: topBackend?.last_seen_at || topBackend?.created_at || ''
      }
    ].filter((row) => row.record_count > 0);
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
      linkedShortcuts: deriveLinkedContextSummary(payload),
      monitorShortcuts: deriveMonitorReviewSummary(payload),
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

  function linkedShortcutCardsMarkup(summary) {
    const rows = Array.isArray(summary?.linkedShortcuts) ? [...summary.linkedShortcuts] : [];
    rows.sort((a, b) => Number(a?.sort_order || 99) - Number(b?.sort_order || 99));
    if (!rows.length) {
      return '<div class="notice" style="margin-top:14px;">No linked-packet context rows are available yet. Standalone packets can still be opened from Admin until linked record traffic starts to grow.</div>';
    }
    return `<div class="hseops-grid hseops-grid--compact">${rows.map((row) => {
      const subtitle = row?.top_packet_number
        ? `${row.top_packet_number} — ${row.top_action_title || 'review required'}`
        : 'No focused packet yet';
      const helper = [
        `Packets: ${row.packet_count || 0}`,
        `Needs attention: ${row.attention_count || 0}`,
        Number(row.ready_for_closeout_count || 0) > 0 ? `Ready for closeout: ${row.ready_for_closeout_count}` : ''
      ].filter(Boolean).join(' • ');
      const summaryText = row?.top_packet_number
        ? `Focused ${row.lane_title}. Top packet ${row.top_packet_number} — ${row.top_action_title || row.top_action_summary || 'review required'}.`
        : `Focused ${row.lane_title}.`;
      return `<button class="hseops-card hseops-card--accent" type="button" data-admin-focus="linked_hse_packet" data-preferred-id="${escHtml(row.top_packet_id || '')}" data-summary="${escHtml(summaryText)}"><strong>${escHtml(row.lane_title || 'Linked packets')}</strong><span>${escHtml(subtitle)}</span><small>${escHtml(helper)}</small><em>Review</em></button>`;
    }).join('')}</div>`;
  }

  function monitorShortcutCardsMarkup(summary) {
    const rows = Array.isArray(summary?.monitorShortcuts) ? [...summary.monitorShortcuts] : [];
    rows.sort((a, b) => Number(a?.sort_order || 99) - Number(b?.sort_order || 99));
    if (!rows.length) {
      return '<div class="notice" style="margin-top:14px;">No upload failures or monitor incidents are loaded yet. Analytics and runtime review will appear here automatically as events arrive.</div>';
    }
    return `<div class="hseops-grid hseops-grid--compact">${rows.map((row) => {
      const subtitle = row?.top_label
        ? `${row.top_label}${row.top_summary ? ` — ${row.top_summary}` : ''}`
        : 'Review the latest lane activity';
      const helper = [
        `Records: ${row.record_count || 0}`,
        Number(row.open_count || 0) > 0 ? `Open: ${row.open_count}` : '',
        Number(row.error_count || 0) > 0 ? `Errors: ${row.error_count}` : ''
      ].filter(Boolean).join(' • ');
      const summaryText = row?.top_label
        ? `Focused ${row.lane_title}. Top item ${row.top_label}${row.top_summary ? ` — ${row.top_summary}` : ''}.`
        : `Focused ${row.lane_title}.`;
      return `<button class="hseops-card hseops-card--accent" type="button" data-admin-focus="${escHtml(row.related_entity || 'app_traffic_event')}" data-target-entity="${escHtml(row.related_entity || 'app_traffic_event')}" data-preferred-id="${escHtml(row.top_record_id || '')}" data-summary="${escHtml(summaryText)}"><strong>${escHtml(row.lane_title || 'Monitoring')}</strong><span>${escHtml(subtitle)}</span><small>${escHtml(helper)}</small><em>Review</em></button>`;
    }).join('')}</div>`;
  }

  function routeShortcutMarkup(role) {
    const canAdminFocus = window.YWISecurity?.hasMinRole?.(role, 'supervisor');
    if (!canAdminFocus) {
      return `<div class="notice" style="margin-top:14px;">Supervisor, HSE, job admin, or admin roles can open linked packet follow-up and monitor review from this hub.</div>`;
    }
    return `
      <div class="hseops-grid hseops-grid--compact">
        <button class="hseops-card" type="button" data-route="jobs"><strong>Jobs and Crews</strong><span>Open jobs, recurring work, crew assignments, and supervisor ownership.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="equipment"><strong>Equipment</strong><span>Open field equipment, inspections, damage, evidence, and signout context.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="admin"><strong>Full Admin Shell</strong><span>Open the full backbone shell when the shortcut cards are not enough.</span><em>Open</em></button>
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
        <div class="section-heading"><div><h3 style="margin:0;">Linked HSE packet shortcuts</h3><p class="section-subtitle">Keep HSE standalone-capable, but open linked packets when a formal job, route, dispatch, site, or equipment record exists.</p></div></div>
        ${linkedShortcutCardsMarkup(summary)}
      </div>
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Analytics and monitor review</h3><p class="section-subtitle">Review upload issues, traffic telemetry, and runtime incidents from the same workflow shell without hunting through long tables.</p></div></div>
        ${monitorShortcutCardsMarkup(summary)}
      </div>
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Jobs, crews, and equipment</h3><p class="section-subtitle">Jump into the adjacent workflow shells when you need deeper route, crew, or equipment context.</p></div></div>
        ${routeShortcutMarkup(role)}
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
        const preferredId = btn.getAttribute('data-preferred-id') || '';
        const summaryText = btn.getAttribute('data-summary') || '';
        const targetEntity = btn.getAttribute('data-target-entity') || '';
        window.YWIRouter?.showSection?.('admin', { skipFocus: true });
        window.setTimeout(() => {
          document.dispatchEvent(new CustomEvent('ywi:admin-focus-request', { detail: { entity, preferredId, summary: summaryText, targetEntity } }));
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
