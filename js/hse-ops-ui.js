/* File: js/hse-ops-ui.js
   Brief description: Separate Ontario Safety Operations hub outside Admin.
   Renders Ontario OHSA-aware workflow cards, mobile-safe quick actions, linked packet review lanes,
   monitoring drill-through shortcuts, and cached fallback summaries.
*/

'use strict';

(function () {
  const BUILD = 329;
  const SAFETY_COMMAND_CENTRE_BUILD = 327;
  const SECTION_ID = 'hseops';
  const ADMIN_CACHE_KEY = 'ywi_admin_directory_cache_v1';
  const HSE_CACHE_KEY = 'ywi_hse_ops_cache_v1';
  const state = { loaded: false, loading: false, payload: null, summary: null, lastLoadedAt: 0, renderScheduled: false, renderKey: '' };

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

  function buildRenderKey(summary = null, options = {}) {
    const hse = summary?.hse || {};
    const acct = summary?.accounting || {};
    return JSON.stringify({
      cached: !!options.cached,
      total: hse.total_packets || 0,
      action: hse.action_needed_packets || 0,
      ready: hse.ready_for_closeout_packets || 0,
      traffic: summary?.latestTraffic?.total_events || 0,
      alerts: Array.isArray(summary?.alerts) ? summary.alerts.length : 0,
      uploads: Array.isArray(summary?.monitorSummary) ? summary.monitorSummary.length : 0,
      packets: Array.isArray(summary?.linkedContext) ? summary.linkedContext.length : 0,
      safetyCommand: summary?.commandCentre?.counts || {},
      acctOpen: acct.open_sync_exception_count || 0
    });
  }

  function scheduleRender(summary = null, options = {}) {
    const key = buildRenderKey(summary, options);
    if (state.renderScheduled && state.renderKey === key) return;
    state.renderKey = key;
    state.renderScheduled = true;
    const run = () => {
      state.renderScheduled = false;
      render(summary, options);
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 0);
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


  function rows(payload, key) {
    return Array.isArray(payload?.[key]) ? payload[key].filter(Boolean) : [];
  }

  function isClosedStatus(value) {
    return ['closed','complete','completed','resolved','approved','cancelled','canceled','waived']
      .includes(String(value || '').trim().toLowerCase());
  }

  function hasText(value) {
    return String(value || '').trim().length > 0;
  }

  function submissionNeedsReview(row) {
    if (!row) return false;
    return !isClosedStatus(row.status)
      || (!!row.requires_admin_review && !row.reviewed_at)
      || !row.signed_off_at;
  }

  function packetNeedsAssessment(row) {
    if (!row || isClosedStatus(row.packet_status)) return false;
    const pairs = [
      ['inspection_required','inspection_completed'],
      ['emergency_review_required','emergency_review_completed'],
      ['weather_monitoring_required','weather_monitoring_completed'],
      ['heat_monitoring_required','heat_monitoring_completed'],
      ['chemical_handling_required','chemical_handling_completed'],
      ['traffic_control_required','traffic_control_completed'],
      ['machinery_review_required','machinery_review_completed'],
      ['lifting_review_required','lifting_review_completed'],
      ['cones_barriers_required','cones_barriers_completed']
    ];
    return pairs.some(([required, completed]) => !!row?.[required] && !row?.[completed]);
  }

  function siteHasRecordedHazard(row) {
    return [
      row?.hazard_notes,
      row?.slope_notes,
      row?.drainage_wet_area_notes,
      row?.utility_locate_notes,
      row?.tree_brush_notes
    ].some(hasText);
  }

  function safetyQueuePriority(value) {
    return { critical:0, high:1, urgent:1, overdue:1, medium:2, warning:2, low:3, info:4 }[String(value || '').toLowerCase()] ?? 5;
  }

  function deriveSafetyCommandCentre(payload = {}) {
    const actionItems = rows(payload, 'hse_packet_action_items').filter((row) => !!row?.needs_attention);
    const packets = rows(payload, 'linked_hse_packets');
    const equipmentHazards = rows(payload, 'equipment_jsa_hazards').filter((row) => !isClosedStatus(row?.status));
    const submissions = rows(payload, 'safety_submissions');
    const incidents = rows(payload, 'incident_near_miss_history').filter((row) => {
      const actionOpen = hasText(row?.corrective_action_required) && !isClosedStatus(row?.corrective_action_status);
      return !isClosedStatus(row?.status) || !row?.last_reviewed_at || actionOpen;
    });
    const corrective = rows(payload, 'corrective_action_tasks').filter((row) => !isClosedStatus(row?.status));
    const training = rows(payload, 'training_records').filter((row) => !!row?.is_expired || !!row?.expires_within_30_days);
    const lockouts = rows(payload, 'equipment_lockouts').filter((row) => !!row?.is_locked_out);
    const scorecards = rows(payload, 'site_safety_scorecards').filter((row) =>
      Number(row?.open_corrective_count || 0) > 0
      || Number(row?.overdue_corrective_count || 0) > 0
      || Number(row?.escalation_attention_count || 0) > 0
      || ['attention','needs_attention','review','blocked','red','warning'].includes(String(row?.scorecard_status || '').toLowerCase())
    );
    const unreviewedPropertyHazards = rows(payload, 'client_site_hazards').filter((row) =>
      row?.is_active !== false && siteHasRecordedHazard(row) && !row?.property_reviewed_at
    );
    const siteRefs = new Set([
      ...scorecards.map((row) => String(row?.site_id || row?.site_ref || row?.site_code || row?.site_label || '')).filter(Boolean),
      ...unreviewedPropertyHazards.map((row) => String(row?.id || row?.site_code || row?.site_name || '')).filter(Boolean)
    ]);
    const pendingAssessments = packets.filter(packetNeedsAssessment);
    const pendingInspectionSubmissions = submissions.filter((row) => String(row?.form_type || '').toUpperCase() === 'C' && submissionNeedsReview(row));
    const toolboxTalks = submissions.filter((row) => String(row?.form_type || '').toUpperCase() === 'E' && submissionNeedsReview(row));
    const ppeReviews = submissions.filter((row) => String(row?.form_type || '').toUpperCase() === 'D' && submissionNeedsReview(row));
    const signoffPackets = packets.filter((row) => !!row?.field_signoff_required && !row?.field_signoff_completed && !isClosedStatus(row?.packet_status));
    const unsignedSubmissions = submissions.filter((row) => !row?.signed_off_at && !isClosedStatus(row?.status));
    const overdueActions = corrective.filter((row) => !!row?.is_overdue);
    const supervisorQueue = rows(payload, 'supervisor_safety_queue');

    const metrics = [
      { key:'open_hazards', label:'Open hazards', count:actionItems.length + equipmentHazards.length, route:'inspect', note:'HSE follow-up and equipment/JSA hazard records still needing action.' },
      { key:'required_assessments', label:'Required assessments', count:pendingAssessments.length + pendingInspectionSubmissions.length, route:'inspect', note:'Required packet assessments or site inspections still awaiting completion/review.' },
      { key:'toolbox_talks', label:'Toolbox talks', count:toolboxTalks.length, route:'toolbox', note:'Toolbox-talk records still awaiting review or signoff.' },
      { key:'incidents', label:'Incidents / near misses', count:incidents.length, route:'incident', note:'Incident or near-miss records still needing review or corrective follow-up.' },
      { key:'corrective_actions', label:'Corrective actions', count:corrective.length, route:'reports', note:'Open corrective-action tasks.' },
      { key:'training_expiries', label:'Training expiries', count:training.length, route:'reports', note:'Expired or expiring-within-30-days training records.' },
      { key:'ppe_issues', label:'PPE issues / review', count:ppeReviews.length, route:'ppe', note:'PPE checks still awaiting review or signoff; individual PPE failures remain in the source record.' },
      { key:'equipment_lockouts', label:'Equipment lockouts', count:lockouts.length, route:'equipment', note:'Equipment currently marked locked out by the equipment authority.' },
      { key:'site_hazards', label:'Site hazard attention', count:siteRefs.size, route:'inspect', note:'Site scorecard attention or recorded property hazards not yet property-reviewed.' },
      { key:'supervisor_signoff', label:'Supervisor signoff', count:signoffPackets.length + unsignedSubmissions.length, route:'log', note:'Required HSE packet signoff or safety submissions still unsigned.' },
      { key:'overdue_actions', label:'Overdue safety actions', count:overdueActions.length, route:'reports', note:'Corrective actions explicitly marked overdue.' }
    ];

    const queue = [
      ...supervisorQueue.map((row) => ({
        key:'supervisor-' + String(row?.queue_id || ''),
        priority:String(row?.queue_priority || 'medium'),
        headline:String(row?.headline || 'Safety follow-up'),
        context:String(row?.primary_context || ''),
        owner:String(row?.owner_name || row?.supervisor_name || ''),
        due:String(row?.due_label || ''),
        route:'reports',
        sortAt:String(row?.sort_at || '')
      })),
      ...lockouts.map((row) => ({
        key:'lockout-' + String(row?.id || row?.equipment_code || ''),
        priority:'high',
        headline:'Equipment locked out: ' + String(row?.equipment_code || row?.equipment_name || 'equipment'),
        context:String(row?.lockout_reason || row?.defect_status || 'Safety lockout'),
        owner:'',
        due:'',
        route:'equipment',
        sortAt:String(row?.locked_out_at || row?.updated_at || '')
      })),
      ...incidents.map((row) => ({
        key:'incident-' + String(row?.submission_id || ''),
        priority:['critical','high'].includes(String(row?.severity || '').toLowerCase()) ? String(row?.severity).toLowerCase() : 'medium',
        headline:String(row?.event_summary || row?.incident_kind || 'Incident / near miss review'),
        context:String(row?.site_label || row?.job_code || row?.work_order_number || ''),
        owner:String(row?.corrective_action_owner || ''),
        due:String(row?.corrective_action_due_date || ''),
        route:'incident',
        sortAt:String(row?.updated_at || row?.created_at || row?.submission_date || '')
      })),
      ...signoffPackets.map((row) => ({
        key:'signoff-' + String(row?.id || row?.packet_number || ''),
        priority:'medium',
        headline:'Supervisor signoff: ' + String(row?.packet_number || 'HSE packet'),
        context:String(row?.standalone_project_name || row?.packet_type || ''),
        owner:'',
        due:'',
        route:'log',
        sortAt:String(row?.updated_at || row?.ready_for_closeout_at || '')
      }))
    ].sort((a, b) => {
      const rank = safetyQueuePriority(a.priority) - safetyQueuePriority(b.priority);
      if (rank) return rank;
      return String(b.sortAt || '').localeCompare(String(a.sortAt || ''));
    }).slice(0, 12);

    return {
      metrics,
      queue,
      counts:Object.fromEntries(metrics.map((row) => [row.key, row.count])),
      generatedAt:new Date().toISOString()
    };
  }

  function safetyMetricMarkup(metric) {
    return '<button class="hseops-card" type="button" data-route="' + escHtml(metric.route) + '" data-safety-metric="' + escHtml(metric.key) + '">'
      + '<strong>' + escHtml(metric.count) + '</strong>'
      + '<span>' + escHtml(metric.label) + '</span>'
      + '<small>' + escHtml(metric.note) + '</small>'
      + '<em>Open source workflow</em></button>';
  }

  function safetyQueueMarkup(item) {
    const details = [
      item.priority ? 'Priority: ' + item.priority : '',
      item.owner ? 'Owner: ' + item.owner : '',
      item.due ? 'Due: ' + item.due : ''
    ].filter(Boolean).join(' • ');
    return '<button class="hseops-card hseops-card--accent" type="button" data-route="' + escHtml(item.route) + '" data-safety-queue-key="' + escHtml(item.key) + '">'
      + '<strong>' + escHtml(item.headline) + '</strong>'
      + '<span>' + escHtml(item.context || 'Safety follow-up') + '</span>'
      + '<small>' + escHtml(details) + '</small>'
      + '<em>Review source</em></button>';
  }

  function safetyCommandCentreMarkup(summary) {
    const command = summary?.commandCentre || { metrics:[], queue:[] };
    const metrics = Array.isArray(command.metrics) ? command.metrics : [];
    const queue = Array.isArray(command.queue) ? command.queue : [];
    return '<section id="safetyComplianceCommandCentre" class="admin-panel-block" data-build="' + escHtml(SAFETY_COMMAND_CENTRE_BUILD) + '" style="margin-top:16px;">'
      + '<div class="section-heading"><div>'
      + '<span class="module-kicker">Build ' + escHtml(SAFETY_COMMAND_CENTRE_BUILD) + ' · operating centre</span>'
      + '<h3 style="margin:4px 0 0;">Safety &amp; Compliance Command Centre</h3>'
      + '<p class="section-subtitle">One supervisor view of safety work that needs attention, using existing HSE, incident, training, PPE, equipment, property and signoff authorities.</p>'
      + '</div></div>'
      + '<div class="notice" style="margin-bottom:14px;"><strong>Operational readiness, not a legal-compliance certificate.</strong> These indicators help find missing or overdue safety work. A form, check, or GREEN count does not by itself establish legal or regulatory compliance.</div>'
      + '<div class="hseops-grid hseops-grid--compact" aria-label="Safety command centre metrics">' + metrics.map(safetyMetricMarkup).join('') + '</div>'
      + '<div class="section-heading" style="margin-top:16px;"><div><h4 style="margin:0;">Priority safety queue</h4><p class="section-subtitle">Highest-priority open safety work from existing supervisor, incident, lockout and signoff records.</p></div></div>'
      + (queue.length
        ? '<div class="hseops-grid hseops-grid--compact safety-command-queue">' + queue.map(safetyQueueMarkup).join('') + '</div>'
        : '<div class="notice">No priority safety items are currently loaded for this supervisor view.</div>')
      + '</section>';
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
        traffic_open_packets: packets.filter((item) => !!item?.traffic_control_required && !item?.traffic_control_completed).length,
        machinery_open_packets: packets.filter((item) => !!item?.machinery_review_required && !item?.machinery_review_completed).length,
        lifting_open_packets: packets.filter((item) => !!item?.lifting_review_required && !item?.lifting_review_completed).length,
        cones_open_packets: packets.filter((item) => !!item?.cones_barriers_required && !item?.cones_barriers_completed).length
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
      commandCentre: deriveSafetyCommandCentre(payload),
      hazardPlanning: deriveJobHazardPlanning(payload),
      incidentInvestigations: deriveIncidentInvestigations(payload),
      savedAt: new Date().toISOString()
    };
  }

  function deriveIncidentInvestigations(payload = {}) {
    const reports = rows(payload, 'incident_near_miss_history');
    const investigations = rows(payload, 'incident_investigations');
    const bySubmission = new Map(investigations.map((row) => [String(row?.source_submission_id || ''), row]));
    const uninvestigated = reports.filter((row) => !bySubmission.has(String(row?.submission_id || '')));
    const active = investigations.filter((row) => String(row?.investigation_status || '').toLowerCase() !== 'closed');
    const ready = active.filter((row) => String(row?.investigation_status || '').toLowerCase() === 'ready_for_review');
    const changesRequired = active.filter((row) => String(row?.investigation_status || '').toLowerCase() === 'changes_required' || String(row?.supervisor_review_status || '').toLowerCase() === 'changes_required');
    const closureBlocked = active.filter((row) => {
      if (String(row?.supervisor_review_status || '').toLowerCase() !== 'approved') return false;
      const open = Number(row?.open_corrective_action_count || 0);
      const count = Number(row?.corrective_action_count || 0);
      return open > 0 || (!!row?.corrective_action_required && count === 0) || !row?.closure_ready;
    });
    const highSeverityOpen = active.filter((row) => ['high','critical'].includes(String(row?.severity || '').toLowerCase()));
    return { reports, investigations, bySubmission, uninvestigated, active, ready, changesRequired, closureBlocked, highSeverityOpen };
  }

  function investigationList(value, limit = 48) {
    return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  function investigationRowLabel(row) {
    const bits = [
      row?.investigation_number || ('Incident #' + (row?.source_submission_id || '')),
      row?.site_label || '',
      row?.incident_kind || row?.event_classification || '',
      row?.severity ? String(row.severity).toUpperCase() : ''
    ].filter(Boolean);
    return bits.join(' · ');
  }

  function incidentInvestigationMarkup(summary, role) {
    const inv = summary?.incidentInvestigations || { reports:[], investigations:[], uninvestigated:[], active:[], ready:[], changesRequired:[], closureBlocked:[], highSeverityOpen:[] };
    const canApprove = window.YWISecurity?.hasMinRole?.(role, 'supervisor');
    const reportOptions = (inv.reports || []).map((row) =>
      '<option value="' + escHtml(row.submission_id || '') + '">' +
      escHtml([row.submission_date || '', row.site_label || 'Unknown site', row.incident_kind || 'incident', row.severity || 'medium', row.event_summary || ''].filter(Boolean).join(' · ')) +
      '</option>'
    ).join('');
    const recent = [...(inv.investigations || [])].sort((a,b)=>String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''))).slice(0,18);
    const cards = recent.map((row) => {
      const actions = canApprove && String(row?.investigation_status || '').toLowerCase() !== 'closed'
        ? '<div class="hseops-inline-actions"><button type="button" data-investigation-review="approve" data-investigation-id="' + escHtml(row.id || '') + '">Approve review</button><button type="button" data-investigation-review="changes_required" data-investigation-id="' + escHtml(row.id || '') + '">Changes required</button></div>'
        : '';
      const actionBits = [
        'Photos: ' + Number(row?.photo_count || 0),
        'Actions: ' + Number(row?.corrective_action_count || 0),
        Number(row?.open_corrective_action_count || 0) ? 'Open actions: ' + Number(row.open_corrective_action_count) : '',
        Number(row?.overdue_corrective_action_count || 0) ? 'Overdue: ' + Number(row.overdue_corrective_action_count) : '',
        row?.closure_ready ? 'Closure ready' : ''
      ].filter(Boolean).join(' • ');
      return '<article class="hseops-card" data-investigation-row="' + escHtml(row.id || '') + '"><button type="button" class="hseops-card-link" data-investigation-load="' + escHtml(row.id || '') + '"><strong>' + escHtml(investigationRowLabel(row)) + '</strong><span>Status: ' + escHtml(row.investigation_status || 'in_progress') + ' • Review: ' + escHtml(row.supervisor_review_status || 'pending') + '</span><small>' + escHtml(actionBits) + '</small><em>Open investigation</em></button>' + actions + '</article>';
    }).join('');

    return '<section id="incidentNearMissInvestigation" class="admin-panel-block" data-build="329" style="margin-top:16px;">'
      + '<div class="section-heading"><div><span class="module-kicker">Build 329 · investigation &amp; closure</span><h3 style="margin:4px 0 0;">Incident &amp; Near-Miss Investigation</h3><p class="section-subtitle">Investigate an existing incident/near-miss submission without replacing the immediate field report, its photos, or the established corrective-action workflow.</p></div></div>'
      + '<div class="notice" style="margin-bottom:14px;"><strong>Immediate safety response comes first.</strong> This investigation record supports internal fact finding, contributing/root-factor analysis, corrective-action follow-through, supervisor review and closure evidence. It is not a legal-compliance or external-reporting certificate and must not delay emergency, medical, environmental or regulatory actions that may be required.</div>'
      + '<div class="admin-backbone-summary">'
      + '<div class="admin-backbone-card"><span>Awaiting investigation</span><strong>' + escHtml(inv.uninvestigated?.length || 0) + '</strong><small>Existing incident reports with no investigation record yet.</small></div>'
      + '<div class="admin-backbone-card"><span>Active investigations</span><strong>' + escHtml(inv.active?.length || 0) + '</strong><small>Open fact-finding and review work.</small></div>'
      + '<div class="admin-backbone-card"><span>Ready for review</span><strong>' + escHtml(inv.ready?.length || 0) + '</strong><small>Root cause and investigation summary recorded.</small></div>'
      + '<div class="admin-backbone-card"><span>Changes required</span><strong>' + escHtml(inv.changesRequired?.length || 0) + '</strong><small>Supervisor returned investigation for more work.</small></div>'
      + '<div class="admin-backbone-card"><span>Closure blockers</span><strong>' + escHtml(inv.closureBlocked?.length || 0) + '</strong><small>Approved investigations still missing action resolution/evidence.</small></div>'
      + '<div class="admin-backbone-card"><span>High severity open</span><strong>' + escHtml(inv.highSeverityOpen?.length || 0) + '</strong><small>High/critical records still active.</small></div>'
      + '</div>'
      + '<details class="admin-panel-block" open style="margin-top:14px;"><summary><strong>Investigation workbench</strong></summary>'
      + '<input id="inc_inv_id" type="hidden"><div class="hseops-grid" style="margin-top:12px;">'
      + '<label>Incident submission<select id="inc_inv_submission"><option value="">Choose incident report</option>' + reportOptions + '</select></label>'
      + '<label>Investigation status<select id="inc_inv_status"><option value="in_progress">In progress</option><option value="ready_for_review">Ready for supervisor review</option><option value="changes_required">Changes required</option></select></label>'
      + '<label>Classification<input id="inc_inv_classification" type="text" placeholder="near_miss, injury_illness, property_damage…"></label>'
      + '<label>Severity<select id="inc_inv_severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>'
      + '</div>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label>People involved — one per line<textarea id="inc_inv_people" rows="4"></textarea></label><label>Witness accounts / references — one per line<textarea id="inc_inv_witnesses" rows="4"></textarea></label><label>Equipment involved — one per line<textarea id="inc_inv_equipment" rows="4"></textarea></label></div>'
      + '<label style="display:block;margin-top:10px;">Initial response / scene actions<textarea id="inc_inv_response" rows="3" placeholder="First aid, shutdown, barricade, notification, spill control, scene preservation…"></textarea></label>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label><input id="inc_inv_scene_secured" type="checkbox"> Scene / area secured</label><label><input id="inc_inv_hazard_controlled" type="checkbox"> Immediate hazard controlled</label></div>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label>Contributing factors — one per line<textarea id="inc_inv_contributing" rows="5"></textarea></label><label>Root factors — one per line<textarea id="inc_inv_root_factors" rows="5"></textarea></label></div>'
      + '<label style="display:block;margin-top:10px;">Root-cause summary<textarea id="inc_inv_root_summary" rows="3"></textarea></label>'
      + '<label style="display:block;margin-top:10px;">Investigation summary<textarea id="inc_inv_summary" rows="4"></textarea></label>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label><input id="inc_inv_action_required" type="checkbox"> Corrective action required</label><label>Corrective-action rationale<textarea id="inc_inv_action_rationale" rows="3"></textarea></label></div>'
      + '<label style="display:block;margin-top:10px;">External reporting assessment note<textarea id="inc_inv_external_note" rows="3" placeholder="Record who assessed reporting/notification needs and what follow-up is required. This note does not itself satisfy any external reporting duty."></textarea></label>'
      + '<label style="display:block;margin-top:10px;">Investigation event note<input id="inc_inv_event_note" type="text" placeholder="Optional reason/context for this save"></label>'
      + '<div class="section-heading" style="margin-top:16px;"><div><h4 style="margin:0;">Closure evidence</h4><p class="section-subtitle">Closure stays blocked until supervisor approval, required corrective actions are linked/resolved, and evidence references are recorded.</p></div></div>'
      + '<label>Closure summary<textarea id="inc_inv_closure_summary" rows="3"></textarea></label>'
      + '<label style="display:block;margin-top:10px;">Closure evidence references — one per line<textarea id="inc_inv_closure_evidence" rows="4" placeholder="Submission photo reference, corrective-action event, repair record, training evidence, supervisor verification…"></textarea></label>'
      + '<div class="hseops-inline-actions" style="margin-top:12px;"><button type="button" data-investigation-save="1">Save investigation</button><button type="button" data-investigation-review-current="approve">Approve review</button><button type="button" data-investigation-review-current="changes_required">Changes required</button><button type="button" data-investigation-review-current="reopen">Reopen</button><button type="button" data-investigation-close="1">Close investigation</button><button type="button" data-route="incident">Open immediate incident report</button><button type="button" data-route="reports">Open safety reports</button></div>'
      + '<div id="inc_inv_message" class="notice" aria-live="polite" style="margin-top:10px;">Choose an existing incident/near-miss report. Its original report and photos remain authoritative evidence.</div>'
      + '</details>'
      + '<div class="section-heading" style="margin-top:16px;"><div><h4 style="margin:0;">Recent investigations</h4><p class="section-subtitle">Select a record to continue fact finding, review corrective-action blockers, or prepare evidence-gated closure.</p></div></div>'
      + (cards ? '<div class="hseops-grid hseops-grid--compact">' + cards + '</div>' : '<div class="notice">No investigations have been opened yet.</div>')
      + '</section>';
  }

  function fillInvestigationWorkbench(section, row) {
    if(!section || !row) return;
    const set=(id,value)=>{const el=section.querySelector(id);if(el) el.value=value ?? '';};
    const check=(id,value)=>{const el=section.querySelector(id);if(el) el.checked=!!value;};
    set('#inc_inv_id',row.id || '');
    set('#inc_inv_submission',row.source_submission_id || '');
    set('#inc_inv_status',row.investigation_status === 'closed' ? 'in_progress' : (row.investigation_status || 'in_progress'));
    set('#inc_inv_classification',row.event_classification || row.incident_kind || '');
    set('#inc_inv_severity',row.severity || 'medium');
    set('#inc_inv_people',(Array.isArray(row.people_involved)?row.people_involved:[]).join('\n'));
    set('#inc_inv_witnesses',(Array.isArray(row.witness_accounts)?row.witness_accounts:[]).join('\n'));
    set('#inc_inv_equipment',(Array.isArray(row.equipment_involved)?row.equipment_involved:[]).join('\n'));
    set('#inc_inv_response',row.initial_response_summary || row.reported_immediate_actions || '');
    check('#inc_inv_scene_secured',row.scene_secured);
    check('#inc_inv_hazard_controlled',row.immediate_hazard_controlled);
    set('#inc_inv_contributing',(Array.isArray(row.contributing_factors)?row.contributing_factors:[]).join('\n'));
    set('#inc_inv_root_factors',(Array.isArray(row.root_factors)?row.root_factors:[]).join('\n'));
    set('#inc_inv_root_summary',row.root_cause_summary || row.reported_root_cause_summary || '');
    set('#inc_inv_summary',row.investigation_summary || '');
    check('#inc_inv_action_required',row.corrective_action_required);
    set('#inc_inv_action_rationale',row.corrective_action_rationale || '');
    set('#inc_inv_external_note',row.external_reporting_assessment_note || '');
    set('#inc_inv_closure_summary',row.closure_summary || '');
    set('#inc_inv_closure_evidence',(Array.isArray(row.closure_evidence)?row.closure_evidence:[]).join('\n'));
    const msg=section.querySelector('#inc_inv_message');
    if(msg) msg.textContent=(row.investigation_number || ('Incident #' + (row.source_submission_id || ''))) + ' loaded. Photos: ' + Number(row.photo_count || 0) + ' · Corrective actions: ' + Number(row.corrective_action_count || 0) + ' · Open actions: ' + Number(row.open_corrective_action_count || 0) + ' · Review: ' + (row.supervisor_review_status || 'pending') + '.';
  }

  function seedInvestigationFromReport(section, submissionId) {
    const inv=state.summary?.incidentInvestigations;
    if(!inv) return;
    const existing=(inv.investigations || []).find((row)=>String(row?.source_submission_id || '')===String(submissionId || ''));
    if(existing){ fillInvestigationWorkbench(section,existing); return; }
    const report=(inv.reports || []).find((row)=>String(row?.submission_id || '')===String(submissionId || ''));
    if(!report) return;
    fillInvestigationWorkbench(section,{
      id:'',source_submission_id:report.submission_id,event_classification:report.incident_kind || 'incident',
      severity:report.severity || 'medium',initial_response_summary:report.immediate_actions_taken || '',
      root_cause_summary:report.root_cause_summary || '',witness_accounts:investigationList(report.witness_names || ''),
      equipment_involved:report.equipment_code ? [report.equipment_code] : [],
      immediate_hazard_controlled:false,corrective_action_required:hasText(report.corrective_action_required),
      corrective_action_rationale:report.corrective_action_required || '',photo_count:report.image_count || 0
    });
    const msg=section.querySelector('#inc_inv_message');
    if(msg) msg.textContent='New investigation seeded from the existing report. Verify every field against the actual evidence before saving.';
  }

  function investigationPayload(section) {
    const get=(id)=>section.querySelector(id)?.value || '';
    const checked=(id)=>!!section.querySelector(id)?.checked;
    const submissionId=Number(get('#inc_inv_submission'));
    if(!Number.isSafeInteger(submissionId) || submissionId<=0) throw new Error('Choose an incident / near-miss submission.');
    return {
      action:'incident_investigation_save',
      id:get('#inc_inv_id') || null,
      source_submission_id:submissionId,
      investigation_status:get('#inc_inv_status') || 'in_progress',
      event_classification:get('#inc_inv_classification') || 'incident',
      severity:get('#inc_inv_severity') || 'medium',
      people_involved:investigationList(get('#inc_inv_people')),
      witness_accounts:investigationList(get('#inc_inv_witnesses')),
      equipment_involved:investigationList(get('#inc_inv_equipment')),
      initial_response_summary:get('#inc_inv_response'),
      scene_secured:checked('#inc_inv_scene_secured'),
      immediate_hazard_controlled:checked('#inc_inv_hazard_controlled'),
      contributing_factors:investigationList(get('#inc_inv_contributing')),
      root_factors:investigationList(get('#inc_inv_root_factors')),
      root_cause_summary:get('#inc_inv_root_summary'),
      investigation_summary:get('#inc_inv_summary'),
      corrective_action_required:checked('#inc_inv_action_required'),
      corrective_action_rationale:get('#inc_inv_action_rationale'),
      external_reporting_assessment_note:get('#inc_inv_external_note'),
      event_note:get('#inc_inv_event_note')
    };
  }

  async function runInvestigationSave(section) {
    if(!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    const result=await window.YWIAPI.manageOperations(investigationPayload(section));
    if(!result?.ok) throw new Error(result?.error || 'Incident investigation could not be saved.');
    return result;
  }

  async function runInvestigationReview(section, decision, investigationId = '') {
    if(!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    const id=investigationId || section.querySelector('#inc_inv_id')?.value || '';
    if(!id) throw new Error('Save or select an investigation first.');
    const note=window.prompt?.('Supervisor investigation review note (optional):','') || '';
    const result=await window.YWIAPI.manageOperations({action:'incident_investigation_review',investigation_id:id,decision,note});
    if(!result?.ok) throw new Error(result?.error || 'Investigation review could not be recorded.');
    return result;
  }

  async function runInvestigationClose(section) {
    if(!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    const id=section.querySelector('#inc_inv_id')?.value || '';
    if(!id) throw new Error('Save or select an investigation first.');
    const closureSummary=section.querySelector('#inc_inv_closure_summary')?.value || '';
    const closureEvidence=investigationList(section.querySelector('#inc_inv_closure_evidence')?.value,40);
    const result=await window.YWIAPI.manageOperations({action:'incident_investigation_close',investigation_id:id,closure_summary:closureSummary,closure_evidence:closureEvidence});
    if(!result?.ok) throw new Error(result?.error || 'Investigation could not be closed.');
    return result;
  }

  function deriveJobHazardPlanning(payload = {}) {
    const templates = rows(payload, 'job_hazard_plan_templates').filter((row) => row?.is_active !== false);
    const plans = rows(payload, 'job_hazard_site_safety_plans');
    const openPlans = plans.filter((row) => !['closed'].includes(String(row?.plan_status || '').toLowerCase()));
    const ready = plans.filter((row) => String(row?.plan_status || '').toLowerCase() === 'ready_for_signoff');
    const reviewOpen = plans.filter((row) => String(row?.supervisor_review_status || 'pending').toLowerCase() !== 'approved');
    const stopWork = openPlans.filter((row) => !!row?.stop_work_required);
    const utilityOpen = openPlans.filter((row) => !!row?.requires_utility_locate_review && !row?.utility_locate_confirmed);
    return { templates, plans, openPlans, ready, reviewOpen, stopWork, utilityOpen };
  }

  function textLines(value, limit = 48) {
    return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  function hazardTemplateRequirements(row) {
    return [
      row?.requires_toolbox_talk ? 'toolbox talk' : '',
      row?.requires_site_inspection ? 'site inspection' : '',
      row?.requires_weather_review ? 'weather' : '',
      row?.requires_heat_review ? 'heat' : '',
      row?.requires_chemical_review ? 'chemical/SDS' : '',
      row?.requires_traffic_control ? 'traffic control' : '',
      row?.requires_machinery_review ? 'machinery/tools' : '',
      row?.requires_lifting_review ? 'lifting/manual handling' : '',
      row?.requires_utility_locate_review ? 'utility locate' : '',
      row?.requires_public_control ? 'public separation' : ''
    ].filter(Boolean).join(' • ');
  }

  function jobHazardPlanningMarkup(summary, role) {
    const planning = summary?.hazardPlanning || { templates:[], plans:[], openPlans:[], ready:[], reviewOpen:[], stopWork:[], utilityOpen:[] };
    const templates = planning.templates || [];
    const packets = rows(state.payload, 'linked_hse_packets').filter((row) => String(row?.packet_status || '').toLowerCase() !== 'closed');
    const plans = [...(planning.plans || [])].sort((a,b)=>String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''))).slice(0,18);
    const canReview = window.YWISecurity?.hasMinRole?.(role, 'supervisor');
    const templateOptions = templates.map((row)=>'<option value="' + escHtml(row.id || '') + '">' + escHtml(row.template_name || row.work_type || 'Safety plan') + ' · r' + escHtml(row.revision || 1) + '</option>').join('');
    const packetOptions = packets.map((row)=>'<option value="' + escHtml(row.id || '') + '">' + escHtml(row.packet_number || 'HSE packet') + (row.work_order_number ? ' · ' + escHtml(row.work_order_number) : '') + '</option>').join('');
    const templateCards = templates.map((row)=>'<button class="hseops-card" type="button" data-hazard-template="' + escHtml(row.id || '') + '"><strong>' + escHtml(row.template_name || row.work_type || 'Template') + '</strong><span>' + escHtml((row.hazard_prompts || []).slice(0,3).join(' • ') || 'Record actual hazards before work.') + '</span><small>' + escHtml(hazardTemplateRequirements(row) || 'Site-specific assessment required') + '</small><em>Use template</em></button>').join('');
    const planCards = plans.map((row)=>{
      const site = row.site_name || row.work_order_number || row.packet_number || 'Linked HSE packet';
      const review = String(row.supervisor_review_status || 'pending').toLowerCase();
      const status = String(row.plan_status || 'draft').toLowerCase();
      const controls = Array.isArray(row.active_controls) ? row.active_controls.length : 0;
      const actions = canReview
        ? '<div class="hseops-inline-actions"><button type="button" data-hazard-review="approve" data-plan-id="' + escHtml(row.id || '') + '">Approve review</button><button type="button" data-hazard-review="changes_required" data-plan-id="' + escHtml(row.id || '') + '">Changes required</button></div>'
        : '';
      return '<article class="hseops-card" data-hazard-plan-row="' + escHtml(row.id || '') + '"><strong>' + escHtml(row.plan_number || 'Safety plan') + '</strong><span>' + escHtml(row.template_name || row.work_type || '') + ' · ' + escHtml(site) + '</span><small>Status: ' + escHtml(status) + ' • Supervisor review: ' + escHtml(review) + ' • Controls: ' + escHtml(controls) + (row.utility_locate_confirmed ? ' • Locate recorded' : '') + (row.stop_work_required ? ' • STOP WORK' : '') + '</small>' + actions + '</article>';
    }).join('');

    return '<section id="jobHazardSiteSafetyPlans" class="admin-panel-block" data-build="328" style="margin-top:16px;">'
      + '<div class="section-heading"><div><span class="module-kicker">Build 328 · field planning</span><h3 style="margin:4px 0 0;">Job Hazard &amp; Site Safety Plans</h3><p class="section-subtitle">Start from a reusable landscaping work-type template, then record the actual site conditions, hazards and controls against the existing HSE packet.</p></div></div>'
      + '<div class="notice" style="margin-bottom:14px;"><strong>Plan the work that is actually in front of the crew.</strong> Templates are prompts, not proof that a site is safe. Conditions can change; stop work and reassess when the plan no longer matches the field. This record is operational evidence, not a legal-compliance certificate.</div>'
      + '<div class="admin-backbone-summary">'
      + '<div class="admin-backbone-card"><span>Reusable templates</span><strong>' + escHtml(templates.length) + '</strong><small>Landscaping work-type starting points.</small></div>'
      + '<div class="admin-backbone-card"><span>Open field plans</span><strong>' + escHtml(planning.openPlans?.length || 0) + '</strong><small>Plans still active against HSE packets.</small></div>'
      + '<div class="admin-backbone-card"><span>Ready for signoff</span><strong>' + escHtml(planning.ready?.length || 0) + '</strong><small>Still separate from actual HSE field signoff.</small></div>'
      + '<div class="admin-backbone-card"><span>Supervisor review open</span><strong>' + escHtml(planning.reviewOpen?.length || 0) + '</strong><small>Review never auto-closes the HSE packet.</small></div>'
      + '<div class="admin-backbone-card"><span>Stop-work flags</span><strong>' + escHtml(planning.stopWork?.length || 0) + '</strong><small>Plans explicitly holding work.</small></div>'
      + '<div class="admin-backbone-card"><span>Utility locate open</span><strong>' + escHtml(planning.utilityOpen?.length || 0) + '</strong><small>Locate-sensitive plans missing confirmation/reference.</small></div>'
      + '</div>'
      + '<details class="admin-panel-block" open style="margin-top:14px;"><summary><strong>Create / update field plan</strong></summary>'
      + '<div class="hseops-grid" style="margin-top:12px;">'
      + '<label>HSE packet<select id="jh_plan_packet"><option value="">Choose packet</option>' + packetOptions + '</select></label>'
      + '<label>Work-type template<select id="jh_plan_template"><option value="">Choose template</option>' + templateOptions + '</select></label>'
      + '<label>Field date<input id="jh_plan_date" type="date" value="' + escHtml(new Date().toISOString().slice(0,10)) + '"></label>'
      + '<label>Plan status<select id="jh_plan_status"><option value="draft">Draft</option><option value="in_progress">In progress</option><option value="ready_for_signoff">Ready for signoff</option></select></label>'
      + '</div>'
      + '<label style="display:block;margin-top:10px;">Actual field conditions<textarea id="jh_plan_conditions" rows="3" placeholder="Weather, ground, slope, access, crew, public activity, changing conditions…"></textarea></label>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label>Identified hazards — one per line<textarea id="jh_plan_hazards" rows="6"></textarea></label><label>Active controls — one per line<textarea id="jh_plan_controls" rows="6"></textarea></label></div>'
      + '<label style="display:block;margin-top:10px;">Additional controls<textarea id="jh_plan_additional" rows="2"></textarea></label>'
      + '<div class="hseops-grid" style="margin-top:10px;"><label><input id="jh_plan_stop" type="checkbox"> Stop work required</label><label>Stop-work reason<input id="jh_plan_stop_reason" type="text"></label><label><input id="jh_plan_utility_confirmed" type="checkbox"> Utility locate confirmed</label><label>Utility locate / authorization reference<input id="jh_plan_utility_ref" type="text"></label></div>'
      + '<label style="display:block;margin-top:10px;">Emergency / escalation notes<textarea id="jh_plan_emergency" rows="2"></textarea></label>'
      + '<label style="display:block;margin-top:10px;">Public / pedestrian interaction notes<textarea id="jh_plan_public" rows="2"></textarea></label>'
      + '<div class="hseops-inline-actions" style="margin-top:12px;"><button type="button" data-hazard-plan-save="1">Save field safety plan</button><button type="button" data-route="toolbox">Open Toolbox Talk</button><button type="button" data-route="inspect">Open Site Inspection</button><button type="button" data-route="ppe">Open PPE Check</button></div>'
      + '<div id="jh_plan_status_message" class="notice" aria-live="polite" style="margin-top:10px;">Select a packet and template. Template controls are starting prompts; edit them to match actual field conditions.</div>'
      + '</details>'
      + '<div class="section-heading" style="margin-top:16px;"><div><h4 style="margin:0;">Reusable template library</h4><p class="section-subtitle">The initial library covers mowing, trimming/edging, blowers, chainsaw/brush work, hedge work, loading/unloading, trailers/towing, roadside, digging/utility concerns, permitted application work, weather, slips/trips, slopes and public interaction.</p></div></div>'
      + (templateCards ? '<div class="hseops-grid hseops-grid--compact">' + templateCards + '</div>' : '<div class="notice">Template library will appear after Schema 216 is deployed.</div>')
      + '<div class="section-heading" style="margin-top:16px;"><div><h4 style="margin:0;">Recent site safety plans</h4><p class="section-subtitle">Supervisor review is explicit and separate from HSE field signoff/closeout.</p></div></div>'
      + (planCards ? '<div class="hseops-grid hseops-grid--compact">' + planCards + '</div>' : '<div class="notice">No field safety plans are loaded yet.</div>')
      + '</section>';
  }

  async function saveJobHazardPlan(section) {
    if(!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    const packetId=section.querySelector('#jh_plan_packet')?.value || '';
    const templateId=section.querySelector('#jh_plan_template')?.value || '';
    if(!packetId || !templateId) throw new Error('Choose an HSE packet and work-type template.');
    const payload={
      action:'job_hazard_plan_save',
      hse_packet_id:packetId,
      template_id:templateId,
      field_date:section.querySelector('#jh_plan_date')?.value || '',
      plan_status:section.querySelector('#jh_plan_status')?.value || 'draft',
      actual_conditions:{field_notes:section.querySelector('#jh_plan_conditions')?.value || ''},
      identified_hazards:textLines(section.querySelector('#jh_plan_hazards')?.value),
      active_controls:textLines(section.querySelector('#jh_plan_controls')?.value),
      additional_controls:section.querySelector('#jh_plan_additional')?.value || '',
      stop_work_required:!!section.querySelector('#jh_plan_stop')?.checked,
      stop_work_reason:section.querySelector('#jh_plan_stop_reason')?.value || '',
      utility_locate_confirmed:!!section.querySelector('#jh_plan_utility_confirmed')?.checked,
      utility_locate_reference:section.querySelector('#jh_plan_utility_ref')?.value || '',
      emergency_notes:section.querySelector('#jh_plan_emergency')?.value || '',
      public_interaction_notes:section.querySelector('#jh_plan_public')?.value || ''
    };
    const result=await window.YWIAPI.manageOperations(payload);
    if(!result?.ok) throw new Error(result?.error || 'Safety plan could not be saved.');
    return result;
  }

  function applyHazardTemplate(section, templateId) {
    const template=rows(state.payload,'job_hazard_plan_templates').find((row)=>String(row?.id || '')===String(templateId || ''));
    if(!template) return;
    const select=section.querySelector('#jh_plan_template');
    if(select) select.value=String(template.id || '');
    const hazards=section.querySelector('#jh_plan_hazards');
    const controls=section.querySelector('#jh_plan_controls');
    if(hazards && !hazards.value.trim()) hazards.value=(Array.isArray(template.hazard_prompts)?template.hazard_prompts:[]).join('\n');
    if(controls && !controls.value.trim()) controls.value=(Array.isArray(template.default_controls)?template.default_controls:[]).join('\n');
    const status=section.querySelector('#jh_plan_status_message');
    if(status) status.textContent=(template.template_name || template.work_type || 'Template') + ' selected. Review every prompt and change the controls to match actual field conditions.';
  }

  function quickActionsMarkup() {
    return `
      <div class="hseops-grid">
        <button class="hseops-card" type="button" data-route="toolbox"><strong>Toolbox Talk</strong><span>Daily briefings, work-start signoff, and task hazard notes.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="ppe"><strong>PPE Check</strong><span>Verify required PPE before dispatch, maintenance, or public-facing work.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="inspect"><strong>Site Inspection</strong><span>Capture slips, trips, lifting, traffic, weather, and chemical hazards.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="firstaid"><strong>First Aid Kit</strong><span>Track field readiness for crews, vehicles, and unscheduled jobs.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="incident"><strong>Incident / Near Miss</strong><span>Capture incidents, close calls, damage, witnesses, and corrective action owners from the field.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="drill"><strong>Emergency Drill</strong><span>Review preparedness, response, and repeat-crew safety expectations.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="log"><strong>Logbook / Review</strong><span>Review submissions, images, approvals, and linked field history.</span><em>Open</em></button>
        <button class="hseops-card" type="button" data-route="reports"><strong>Historical Reports</strong><span>Open date-filtered safety, corrective-action, training expiry, payroll, scheduler, and contract history reporting.</span><em>Open</em></button>
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
        <article class="hseops-guidance-card"><h3>Machinery and tools</h3><p>Keep packet and inspection notes focused on moving blades, pinch points, thrown objects, guards, lockout, and task-specific tool risks. The Admin packet/event forms now expose dedicated machinery flags and notes for this review.</p></article>
        <article class="hseops-guidance-card"><h3>Lifting and awkward posture</h3><p>Capture manual handling, repetitive work, reach height, uneven terrain, and crew-size needs before field start and closeout. Lifting review now has its own packet/event cues instead of being buried only in general notes.</p></article>
        <article class="hseops-guidance-card"><h3>Weather and heat</h3><p>Review workload, temperature, humidity, sun, air movement, clothing, hydration, and worker-specific risk before and during field work. Packet/event notes now include hydration, clothing, and worker-specific prompts.</p></article>
        <article class="hseops-guidance-card"><h3>Chemicals and public interaction</h3><p>Track chemical handling, PPE, SDS awareness, public traffic, cones/barriers, roadside exposure, and site communication notes. Packet/event forms now expose cones/barriers and communication cues directly.</p></article>
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
        <div class="admin-backbone-card"><span>Machinery / lifting open</span><strong>${escHtml((Number(hse.machinery_open_packets || 0) + Number(hse.lifting_open_packets || 0)))}</strong><small>Packets missing machinery/tool or lifting/posture review.</small></div>
        <div class="admin-backbone-card"><span>Weather / heat open</span><strong>${escHtml((Number(hse.weather_open_packets || 0) + Number(hse.heat_open_packets || 0)))}</strong><small>Packets missing weather or heat workflow completion.</small></div>
        <div class="admin-backbone-card"><span>Chemical / public open</span><strong>${escHtml((Number(hse.chemical_open_packets || 0) + Number(hse.traffic_open_packets || 0) + Number(hse.cones_open_packets || 0)))}</strong><small>Chemical, cones/barriers, and public-interaction steps still open.</small></div>
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
          <h2>Ontario Safety Operations</h2>
          <p class="section-subtitle">A mobile-first Ontario workplace safety hub outside Admin for linked packets, dispatch safety, weather and heat checks, chemical handling, traffic/public interaction, and field closeout.</p>
        </div>
      </div>
      ${cacheNote}
      <div class="notice" style="margin-bottom:14px;">
        <strong>Current focus</strong>
        <p style="margin:8px 0 0;">Use this area to move field safety forward from a phone without digging through the full Admin page. ${escHtml(label)} access still controls which linked packet and monitoring shortcuts are available.</p>
      </div>
      ${safetyCommandCentreMarkup(summary)}
      ${jobHazardPlanningMarkup(summary, role)}
      ${incidentInvestigationMarkup(summary, role)}
      ${summaryMarkup(summary)}
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Field safety quick actions</h3><p class="section-subtitle">Open the most-used field workflows quickly on phone, tablet, or desktop.</p></div></div>
        ${quickActionsMarkup()}
      </div>
      <div class="admin-panel-block" style="margin-top:16px;">
        <div class="section-heading"><div><h3 style="margin:0;">Linked safety packet shortcuts</h3><p class="section-subtitle">Keep safety records standalone-capable, but open linked packets when a formal job, route, dispatch, site, or equipment record exists.</p></div></div>
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
        <div class="section-heading"><div><h3 style="margin:0;">Ontario workplace safety reminders</h3><p class="section-subtitle">Use the packet workflow to keep machinery, lifting, slips, chemicals, traffic, heat controls, and Ontario due-diligence notes visible for the crew.</p></div></div>
        ${guidanceMarkup()}
      </div>`;

  }


  function bindSectionClicks() {
    const section = getSection();
    if (!section || section.dataset.boundClicks === '1') return;
    section.dataset.boundClicks = '1';
    section.addEventListener('click', async (event) => {
      const templateBtn = event.target.closest('[data-hazard-template]');
      if (templateBtn && section.contains(templateBtn)) {
        applyHazardTemplate(section, templateBtn.getAttribute('data-hazard-template') || '');
        section.querySelector('#jh_plan_template')?.scrollIntoView?.({block:'center'});
        return;
      }
      const saveBtn = event.target.closest('[data-hazard-plan-save]');
      if (saveBtn && section.contains(saveBtn)) {
        const status=section.querySelector('#jh_plan_status_message');
        try {
          saveBtn.disabled=true;
          if(status) status.textContent='Saving field safety plan…';
          const result=await saveJobHazardPlan(section);
          if(status) status.textContent='Saved ' + (result?.record?.plan_number || 'field safety plan') + '. Supervisor review and HSE field signoff remain separate steps.';
          state.lastLoadedAt=0;
          await loadLiveSummary();
        } catch(error) {
          if(status) status.textContent=error?.message || 'Safety plan could not be saved.';
        } finally {
          saveBtn.disabled=false;
        }
        return;
      }
      const reviewBtn = event.target.closest('[data-hazard-review]');
      if (reviewBtn && section.contains(reviewBtn)) {
        const planId=reviewBtn.getAttribute('data-plan-id') || '';
        const decision=reviewBtn.getAttribute('data-hazard-review') || '';
        const status=section.querySelector('#jh_plan_status_message');
        try {
          reviewBtn.disabled=true;
          const note=window.prompt?.('Supervisor review note (optional):','') || '';
          const result=await window.YWIAPI?.manageOperations?.({action:'job_hazard_plan_review',plan_id:planId,decision,note});
          if(!result?.ok) throw new Error(result?.error || 'Supervisor review could not be recorded.');
          if(status) status.textContent='Supervisor review recorded. HSE field signoff/closeout was not changed.';
          state.lastLoadedAt=0;
          await loadLiveSummary();
        } catch(error) {
          if(status) status.textContent=error?.message || 'Supervisor review could not be recorded.';
        } finally {
          reviewBtn.disabled=false;
        }
        return;
      }
      const investigationLoadBtn=event.target.closest('[data-investigation-load]');
      if(investigationLoadBtn && section.contains(investigationLoadBtn)){
        const id=investigationLoadBtn.getAttribute('data-investigation-load') || '';
        const row=rows(state.payload,'incident_investigations').find((item)=>String(item?.id || '')===id);
        if(row) fillInvestigationWorkbench(section,row);
        section.querySelector('#inc_inv_submission')?.scrollIntoView?.({block:'center'});
        return;
      }
      const investigationSaveBtn=event.target.closest('[data-investigation-save]');
      if(investigationSaveBtn && section.contains(investigationSaveBtn)){
        const msg=section.querySelector('#inc_inv_message');
        try{
          investigationSaveBtn.disabled=true;
          if(msg) msg.textContent='Saving investigation…';
          const result=await runInvestigationSave(section);
          if(msg) msg.textContent='Saved ' + (result?.record?.investigation_number || 'incident investigation') + '. Supervisor review and closure remain separate explicit steps.';
          state.lastLoadedAt=0; await loadLiveSummary();
        }catch(error){if(msg) msg.textContent=error?.message || 'Investigation could not be saved.';}
        finally{investigationSaveBtn.disabled=false;}
        return;
      }
      const investigationReviewBtn=event.target.closest('[data-investigation-review],[data-investigation-review-current]');
      if(investigationReviewBtn && section.contains(investigationReviewBtn)){
        const msg=section.querySelector('#inc_inv_message');
        const decision=investigationReviewBtn.getAttribute('data-investigation-review') || investigationReviewBtn.getAttribute('data-investigation-review-current') || '';
        const id=investigationReviewBtn.getAttribute('data-investigation-id') || '';
        try{
          investigationReviewBtn.disabled=true;
          await runInvestigationReview(section,decision,id);
          if(msg) msg.textContent='Supervisor investigation review recorded. This did not close the incident investigation or the original incident submission.';
          state.lastLoadedAt=0; await loadLiveSummary();
        }catch(error){if(msg) msg.textContent=error?.message || 'Investigation review could not be recorded.';}
        finally{investigationReviewBtn.disabled=false;}
        return;
      }
      const investigationCloseBtn=event.target.closest('[data-investigation-close]');
      if(investigationCloseBtn && section.contains(investigationCloseBtn)){
        const msg=section.querySelector('#inc_inv_message');
        try{
          investigationCloseBtn.disabled=true;
          await runInvestigationClose(section);
          if(msg) msg.textContent='Investigation closed with evidence. The original incident submission and its photos remain unchanged.';
          state.lastLoadedAt=0; await loadLiveSummary();
        }catch(error){if(msg) msg.textContent=error?.message || 'Investigation closure is blocked.';}
        finally{investigationCloseBtn.disabled=false;}
        return;
      }
      const routeBtn = event.target.closest('[data-route]');
      if (routeBtn && section.contains(routeBtn)) {
        window.YWIRouter?.showSection?.(routeBtn.getAttribute('data-route') || 'toolbox');
        return;
      }
      const focusBtn = event.target.closest('[data-admin-focus]');
      if (focusBtn && section.contains(focusBtn)) {
        const entity = focusBtn.getAttribute('data-admin-focus') || 'linked_hse_packet';
        const preferredId = focusBtn.getAttribute('data-preferred-id') || '';
        const summaryText = focusBtn.getAttribute('data-summary') || '';
        const targetEntity = focusBtn.getAttribute('data-target-entity') || '';
        window.YWIRouter?.showSection?.('admin', { skipFocus: true });
        window.setTimeout(() => {
          document.dispatchEvent(new CustomEvent('ywi:admin-focus-request', { detail: { entity, preferredId, summary: summaryText, targetEntity } }));
        }, 80);
      }
    });
    section.addEventListener('change', (event) => {
      const templateSelect=event.target.closest?.('#jh_plan_template');
      if(templateSelect && section.contains(templateSelect)) applyHazardTemplate(section,templateSelect.value || '');
      const incidentSelect=event.target.closest?.('#inc_inv_submission');
      if(incidentSelect && section.contains(incidentSelect)) seedInvestigationFromReport(section,incidentSelect.value || '');
    });
  }

  async function loadLiveSummary() {
    if (state.loading || !canLoadOperationalData() || !window.YWIAPI?.loadAdminSelectors) return;
    state.loading = true;
    try {
      const payload = await window.YWIAPI.loadAdminSelectors({ scope: 'hse_ops' });
      state.payload = payload || {};
      state.summary = normalizeSummary(state.payload);
      saveCache(state.payload);
      scheduleRender(state.summary, { cached: false });
    } catch {
      const cached = loadCachedPayload();
      if (cached) {
        state.payload = cached;
        state.summary = normalizeSummary(cached);
        scheduleRender(state.summary, { cached: true });
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
    scheduleRender(state.summary, { cached: !!cached });
  }

  function init() {
    bindSectionClicks();
    ensureBaseRender();
    document.addEventListener('ywi:route-shown', (event) => {
      const allowed = event?.detail?.allowed || '';
      if (allowed === SECTION_ID) {
        if (!state.loaded) ensureBaseRender();
        if (!state.lastLoadedAt || (Date.now() - state.lastLoadedAt) > 60000) loadLiveSummary();
      }
    });
    document.addEventListener('ywi:auth-changed', () => {
      ensureBaseRender();
      if (window.location.hash === '#hseops') loadLiveSummary();
    });
  }

  window.YWIHSEOpsUI = Object.freeze({ init, refresh: loadLiveSummary, normalizeSummary, deriveSafetyCommandCentre, deriveJobHazardPlanning, deriveIncidentInvestigations, build:BUILD });
  document.addEventListener('DOMContentLoaded', init);
})();
