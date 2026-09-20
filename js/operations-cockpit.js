/* Operations Cockpit - schema 159
   Live Admin work queues, row-level approvals/posting, bank promotion,
   exact reconciliation, equipment resolution, public media upload, route
   publication, quote follow-up, dispatch, deposits, and job-cost refresh. */
'use strict';

(function () {
  const BUILD = '322-recurring-lawn-yard-maintenance';
  const RETRY_KEY = 'ywi_operations_cockpit_retry_v2';
  const DRAFT_KEY = 'ywi_operations_cockpit_draft_v2';
  let cameraStream = null;
  let scanTimer = null;
  let queues = {};
  let queueLoading = false;
  let selectedReconItemId = '';
  let reconciliationSuggestions = [];
  let selectedReconSuggestion = null;
  let paymentApplicationPreview = null;

  const actionCapability = {
    'payment-approve':'payment_action_decision', 'payment-reject':'payment_action_decision', 'payment-post':'payment_action_decision',
    'bank-promote':'bank_csv_confirm_import', 'recon-suggest':'reconciliation_action', 'recon-use':'reconciliation_action', 'recon-reject':'reconciliation_action', 'recon-review':'reconciliation_action', 'recon-exception-own':'reconciliation_action', 'recon-exception-resolve':'reconciliation_action',
    'recovery-approve':'equipment_cost_recovery_decision', 'recovery-decline':'equipment_cost_recovery_decision',
    'asset-approve':'visual_asset_decision', 'asset-reject':'visual_asset_decision',
    'route-approve':'public_route_decision', 'route-reject':'public_route_decision', 'route-publish':'public_route_publish',
    'quote-assign':'quote_owner_assign', 'quote-contact':'quote_followup_event',
    'portal-dispatch':'dispatch_schedule', 'job-cost-refresh':'job_cost_refresh', 'deposit-paid':'deposit_status_update',
    'job-update-retract':'work_order_live_update_retract',
    'execution-proof-approve':'work_order_execution_proof_decision', 'execution-proof-reject':'work_order_execution_proof_decision',
    'customer-notification-retry':'customer_notification_retry',
    'closeout-approve':'work_order_closeout_decision', 'closeout-reject':'work_order_closeout_decision', 'closeout-rework':'work_order_closeout_decision', 'closeout-invoice':'work_order_closeout_decision',
    'webhook-ack':'stripe_webhook_alert_decision', 'webhook-resolve':'stripe_webhook_alert_decision',
    'signal-review':'content_signal_decision', 'signal-actioned':'content_signal_decision',
    'release-readiness-capture':'release_readiness_snapshot',
    'attention-defer':'operations_attention_defer', 'attention-resolve':'operations_attention_resolve',
    'dispatch-load':'dispatch_schedule', 'dispatch-cancel':'dispatch_schedule', 'dispatch-now':'dispatch_schedule',
    'recurring-program-edit':'recurring_service_program_save',
    'recurring-visit-skip':'recurring_service_visit_event', 'recurring-visit-weather':'recurring_service_visit_event', 'recurring-visit-makeup':'recurring_service_visit_event', 'recurring-visit-hold':'recurring_service_visit_event', 'recurring-visit-resume':'recurring_service_visit_event', 'recurring-visit-cancel':'recurring_service_visit_event'
  };


  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const byId = (id) => document.getElementById(id);
  const idem = (prefix) => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  const money = (value) => Number(value || 0).toLocaleString('en-CA', { style:'currency', currency:'CAD' });
  const when = (value) => value ? new Date(value).toLocaleString() : '—';
  const short = (value, max = 70) => String(value ?? '').length > max ? `${String(value).slice(0, max - 1)}…` : String(value ?? '');
  const statusClass = (value) => `oc-badge oc-badge-${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  function status(message, isError = false) {
    const el = byId('oc_status');
    if (!el) return;
    el.textContent = message;
    el.dataset.status = isError ? 'error' : 'ok';
    el.hidden = false;
  }
  function saveRetry(payload, label) {
    try { localStorage.setItem(RETRY_KEY, JSON.stringify({ payload, label, saved_at:new Date().toISOString() })); } catch {}
    renderRetry();
  }
  function clearRetry() { try { localStorage.removeItem(RETRY_KEY); } catch {} renderRetry(); }
  function getRetry() { try { return JSON.parse(localStorage.getItem(RETRY_KEY) || 'null'); } catch { return null; } }
  function renderRetry() {
    const wrap = byId('oc_retry_wrap');
    const item = getRetry();
    if (!wrap) return;
    wrap.hidden = !item;
    if (item) byId('oc_retry_text').textContent = `${item.label || item.payload?.action || 'Operation'} saved ${new Date(item.saved_at).toLocaleString()}`;
  }
  function saveDraft() {
    const fields = [...document.querySelectorAll('#operationsCockpit [name]')];
    const data = {};
    fields.forEach((field) => {
      if (field.type === 'file' || field.closest('.oc-live-queue')) return;
      data[field.name] = field.type === 'checkbox' ? field.checked : field.value;
    });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
  }
  function restoreDraft() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch {}
    Object.entries(data).forEach(([name, value]) => {
      const field = document.querySelector(`#operationsCockpit [name="${CSS.escape(name)}"]`);
      if (!field || field.closest('.oc-live-queue')) return;
      if (field.type === 'checkbox') field.checked = !!value;
      else if (!field.value) field.value = String(value ?? '');
    });
  }
  async function send(payload, label, refresh = true) {
    if (!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    status(`${label}…`);
    try {
      const response = await window.YWIAPI.manageOperations(payload);
      if (!response?.ok) throw new Error(response?.error || `${label} failed.`);
      clearRetry();
      status(`${label} completed.`);
      if (refresh) await loadQueues(true);
      document.dispatchEvent(new CustomEvent('ywi:operations-cockpit-updated', { detail:{ action:payload.action, response } }));
      return response;
    } catch (error) {
      saveRetry(payload, label);
      status(`${error?.message || label + ' failed.'} A retry copy was saved on this device.`, true);
      throw error;
    }
  }
  const formData = (form) => Object.fromEntries(new FormData(form).entries());
  const emptyQueue = (title, note) => `<div class="oc-empty"><span aria-hidden="true">◇</span><strong>${esc(title)}</strong><small>${esc(note)}</small></div>`;
  const buttons = (items) => `<div class="oc-row-actions">${items.filter(Boolean).join('')}</div>`;
  function capabilityFor(key) { return key ? queues?.capabilities?.actions?.[key] || null : null; }
  function button(label, action, id, extra = '', secondary = false, capabilityKey = '') {
    const cap = capabilityFor(capabilityKey || actionCapability[action]);
    const denied = cap?.permitted === false;
    const reason = denied ? ` title="${esc(cap.reason || 'Your role cannot perform this action.')}" aria-disabled="true" disabled` : '';
    const marker = capabilityKey || actionCapability[action] || '';
    return `<button type="button" class="${secondary ? 'secondary ' : ''}oc-row-action" data-oc-action="${esc(action)}" data-id="${esc(id)}" data-oc-permission="${esc(marker)}" ${extra}${reason}>${esc(label)}${denied ? ' · restricted' : ''}</button>`;
  }
  const optionList = (rows, selected = '') => (rows || []).map((row) => `<option value="${esc(row.id)}" ${String(row.id) === String(selected) ? 'selected' : ''}>${esc(row.full_name || row.email || row.account_name || row.id)}</option>`).join('');

  async function loadQueues(silent = false) {
    if (queueLoading || !byId('operationsCockpit')) return;
    queueLoading = true;
    if (!silent) status('Loading live work queues…');
    try {
      const response = await window.YWIAPI.manageOperations({ action:'operations_queue_list' });
      queues = response?.queues || {};
      renderQueues();
      hydrateBankSelects();
      hydrateArApplicationSelects();
      if (!silent) status(`Live queues refreshed for build ${response?.build || BUILD}.`);
    } catch (error) {
      if (!silent) status(error?.message || 'Live queues could not be loaded.', true);
    } finally { queueLoading = false; }
  }

  function renderRails() {
    const wrap = byId('oc_scorecards');
    if (!wrap) return;
    const rails = queues.rails || [];
    wrap.innerHTML = rails.length ? rails.map((rail) => `<article><span>${esc(rail.rail_title)}</span><strong>${Number(rail.progress_percent || 0)}%</strong><progress max="100" value="${Number(rail.progress_percent || 0)}"></progress><small>${esc(short(rail.next_action_hint, 120))}</small></article>`).join('') : emptyQueue('Progress data unavailable', 'Apply schema 155 and refresh.');
  }

  function renderPaymentQueue() {
    const wrap = byId('oc_payment_queue'); if (!wrap) return;
    const rows = queues.payments || [];
    wrap.innerHTML = rows.length ? rows.map((row) => {
      const actions = [];
      if (['submitted','draft'].includes(row.action_status)) {
        actions.push(button('Approve review request','payment-approve',row.id));
        actions.push(button('Reject','payment-reject',row.id,'',true));
      }
      const app=row?.metadata?.payment_application || {};
      const type=app.application_type || row.action_type || 'payment action';
      const postingNote=row.action_status==='approved' && row.posting_status!=='posted'
        ? 'Approved for accounting review. Ledger posting remains disabled in Build 313.'
        : (row.posting_message || row.decision_note || 'Awaiting review');
      return `<article class="oc-queue-card"><header><strong>${esc(String(type).replaceAll('_',' '))}</strong><span class="${statusClass(row.posting_status || row.action_status)}">${esc(row.posting_status || row.action_status)}</span></header><dl><div><dt>Side / date</dt><dd>${esc((row.ledger_side || 'auto').toUpperCase())} · ${esc(row.transaction_date || '—')}</dd></div><div><dt>Customer</dt><dd>${esc(row.customer_or_vendor_name || app.client_name || '—')}</dd></div><div><dt>Invoice / source</dt><dd>${esc(row.invoice_reference || app.invoice_reference || '—')} / ${esc(row.payment_reference || app.source_reference || '—')}</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Proof</dt><dd>${esc(row.proof_reference || 'Missing')}</dd></div><div><dt>Posting</dt><dd>${esc(postingNote)}</dd></div></dl>${buttons(actions)}</article>`;
    }).join('') : emptyQueue('No payment applications', 'Validated A/R application requests will appear here for approval. Ledger posting remains disabled.');
  }

  function renderBankQueue() {
    const wrap = byId('oc_bank_queue'); if (!wrap) return;
    const rows = queues.bank_imports || [];
    wrap.innerHTML = rows.length ? rows.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.original_filename || row.import_key)}</strong><span class="${statusClass(row.preview_status)}">${esc(row.preview_status)}</span></header><dl><div><dt>Bank</dt><dd>${esc(row.bank_account_name || row.bank_account_hint || 'Not selected')}</dd></div><div><dt>Rows</dt><dd>${Number(row.accepted_row_count || row.accepted_rows || 0)} accepted · ${Number(row.rejected_row_count || row.rejected_rows || 0)} rejected</dd></div><div><dt>Promoted</dt><dd>${Number(row.promoted_row_count || 0)} row(s)</dd></div><div><dt>Created</dt><dd>${when(row.created_at)}</dd></div></dl>${buttons([!row.promoted_at ? button('Confirm and promote','bank-promote',row.id) : '', row.reconciliation_session_id ? button('Use session','bank-use-session',row.reconciliation_session_id,'',true) : ''])}</article>`).join('') : emptyQueue('No bank imports', 'Previewed CSV files will appear here before promotion to reconciliation.');
  }

  function toCentInteger(value) { return Math.round(Number(value || 0) * 100); }
  function reconciliationRecordFor(itemId) {
    return (queues.reconciliation || []).find((row) => String(row.reconciliation_item_id || row.bank_row_id || row.item_id || '') === String(itemId)) || null;
  }
  function splitRowsFor(record) {
    const raw = record?.split_rows || record?.split_json || record?.allocation_json || record?.metadata?.split_rows || [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  }
  function renderReconciliationReview(itemId = selectedReconItemId) {
    const wrap = byId('oc_recon_review'); if (!wrap) return;
    const item = (queues.bank_items || []).find((row) => String(row.id) === String(itemId));
    const record = reconciliationRecordFor(itemId);
    if (!itemId || !item) { wrap.innerHTML = '<p class="muted">Select “Review exact math” on a bank row to see the amount, score components, split total, difference, and sign-off state in one place.</p>'; return; }
    const explanation = record?.match_explanation || {};
    const components = explanation?.components || {};
    const splitRows = splitRowsFor(record);
    const splitTotal = splitRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0);
    const bankAmount = Number(item.amount || 0);
    const exactDifference = (toCentInteger(Math.abs(bankAmount)) - toCentInteger(Math.abs(splitRows.length ? splitTotal : (record?.matched_amount || record?.target_amount || bankAmount)))) / 100;
    const score = record?.match_score ?? explanation?.score ?? '—';
    const state = record?.action_status || item.match_status || 'open';
    const splitMarkup = splitRows.length ? `<ul>${splitRows.map((row) => `<li><code>${esc(row.reference || row.target_reference || 'Unlabelled target')}</code><span>${money(row.amount)}</span></li>`).join('')}</ul>` : '<p class="muted">No split allocations have been recorded for this row.</p>';
    wrap.innerHTML = `<article class="oc-recon-review-card"><header><div><span class="operations-kicker">Explainable reconciliation review</span><h4>${esc(item.item_description || 'Bank row')}</h4></div><span class="${statusClass(state)}">${esc(state)}</span></header><div class="oc-recon-math"><div><span>Bank amount</span><strong>${money(bankAmount)}</strong></div><div><span>Match score</span><strong>${esc(score)}${score === '—' ? '' : '%'}</strong></div><div><span>Exact split total</span><strong>${money(splitRows.length ? splitTotal : (record?.matched_amount || record?.target_amount || 0))}</strong></div><div><span>Difference</span><strong class="${Math.abs(exactDifference) < 0.005 ? 'oc-math-ok' : 'oc-math-warning'}">${money(exactDifference)}</strong></div></div><p class="oc-recon-summary">${esc(explanation?.summary || record?.decision_note || 'No match decision has been recorded yet. Use the suggestions or enter an exact target reference.')}</p><dl class="oc-score-components"><div><dt>Amount</dt><dd>${esc(components.amount ?? '—')}/55</dd></div><div><dt>Date</dt><dd>${esc(components.date ?? '—')}/20</dd></div><div><dt>Reference</dt><dd>${esc(components.reference ?? '—')}/15</dd></div><div><dt>Description</dt><dd>${esc(components.description ?? '—')}/10</dd></div></dl><div class="oc-split-review"><strong>Exact split allocation</strong>${splitMarkup}</div><small>Exact-cent rule: allocations must equal the absolute bank amount exactly. A non-zero difference cannot be posted or signed off.</small></article>`;
  }
  function renderReconQueue() {
    const wrap = byId('oc_recon_queue'); if (!wrap) return;
    const items = queues.bank_items || [];
    const history = queues.reconciliation || [];
    const exceptions = queues.reconciliation_exceptions || [];
    const ownerSelect = byId('oc_recon_exception_owner');
    if (ownerSelect) ownerSelect.innerHTML = '<option value="">Current reviewer</option>' + optionList(queues.profiles || [], ownerSelect.value);
    const exceptionWrap = byId('oc_recon_exception_queue');
    if (exceptionWrap) {
      const blockers = exceptions.filter((row) => row.finance_readiness_blocker || row.month_end_close_blocker).length;
      const cards = exceptions.length ? exceptions.map((row) => `<article class="oc-queue-card oc-recon-exception-card" data-resolution="${esc(row.resolution_status || 'open')}" data-severity="${esc(row.exception_severity || 'medium')}" data-finance-blocker="${row.finance_readiness_blocker ? 'true' : 'false'}" data-close-blocker="${row.month_end_close_blocker ? 'true' : 'false'}"><header><strong>${esc(row.item_description || 'Reconciliation exception')}</strong><span class="${statusClass(row.exception_severity || 'medium')}">${esc(row.exception_severity || 'medium')}</span></header><dl><div><dt>Category</dt><dd>${esc(String(row.exception_category || 'manual_accounting_review').replaceAll('_',' '))}</dd></div><div><dt>Owner</dt><dd>${esc(row.owner_name || 'Unassigned')}</dd></div><div><dt>Age</dt><dd>${Number(row.age_days || 0)} day(s)</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Evidence</dt><dd>${esc(short(row.evidence_reference || 'Missing',180))}</dd></div><div><dt>Resolution</dt><dd>${esc(row.resolution_status || 'open')}${row.resolution_reason ? ' · '+esc(short(row.resolution_reason,120)) : ''}</dd></div><div><dt>Close impact</dt><dd>${row.finance_readiness_blocker || row.month_end_close_blocker ? 'BLOCKS Finance readiness / month-end close' : 'Non-material or resolved'}</dd></div></dl>${buttons([button('Own / classify','recon-exception-own',row.id,'',true), row.resolution_status !== 'resolved' ? button('Resolve','recon-exception-resolve',row.id,'',true) : ''])}</article>`).join('') : emptyQueue('No reconciliation exceptions', 'Unmatched, partial, and exception bank rows will be classified here.');
      exceptionWrap.innerHTML = `<p class="muted"><strong>${blockers}</strong> material unresolved exception(s) currently block Finance readiness and month-end close.</p>${cards}`;
    }
    if (selectedReconItemId && !items.some((row) => String(row.id) === String(selectedReconItemId))) selectedReconItemId = '';
    const itemHtml = items.length ? items.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.item_description || 'Bank row')}</strong><span class="${statusClass(row.match_status)}">${esc(row.match_status)}</span></header><dl><div><dt>Date</dt><dd>${esc(row.item_date || '—')}</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Item ID</dt><dd><code>${esc(row.id)}</code></dd></div><div><dt>Exception</dt><dd>${esc(row.difference_reason || '—')}</dd></div></dl>${buttons([button('Review exact math','recon-review',row.id,'',true), button('Find matches','recon-suggest',row.id), button('Use for match','recon-use',row.id,'',true), button('Own exception','recon-exception-own',row.id,'',true), button('Reject','recon-reject',row.id,'',true)])}</article>`).join('') : emptyQueue('No open reconciliation rows', 'Confirmed CSV rows will appear here until matched or signed off.');
    const historyHtml = history.slice(0, 10).map((row) => `<li><strong>${esc(row.action_type)}</strong> · ${esc(row.action_status)} · ${row.match_score ?? '—'}% · ${esc(short(row.match_explanation?.summary || row.decision_note || '', 120))}</li>`).join('');
    wrap.innerHTML = `${itemHtml}${historyHtml ? `<details class="oc-queue-history"><summary>Recent reconciliation decisions</summary><ul>${historyHtml}</ul></details>` : ''}`;
    renderReconciliationReview();
  }

  function renderEquipmentQueue() {
    const wrap = byId('oc_equipment_queue'); if (!wrap) return;
    const scans = queues.equipment || [];
    const service = queues.equipment_service || [];
    const scanHtml = scans.slice(0, 25).map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.equipment_name || row.scan_code)}</strong><span class="${statusClass(row.resolution_status)}">${esc(row.resolution_status)}</span></header><dl><div><dt>Code</dt><dd>${esc(row.equipment_code || row.scan_code)}</dd></div><div><dt>Status</dt><dd>${esc(row.equipment_status || '—')}${row.is_locked_out ? ' · locked out' : ''}</dd></div><div><dt>Stage / job</dt><dd>${esc(row.scan_stage)} · ${esc(row.job_reference || '—')}</dd></div><div><dt>Defect</dt><dd>${esc(row.defect_status || '—')}</dd></div></dl></article>`).join('');
    const serviceHtml = service.map((row) => `<article class="oc-queue-card oc-service-card"><header><strong>${esc(row.equipment_name || row.equipment_code || 'Equipment service')}</strong><span class="${statusClass(row.recovery_status || row.task_status)}">${esc(row.recovery_status || row.task_status)}</span></header><dl><div><dt>Service task</dt><dd>${esc(row.task_type || '—')} · ${esc(row.task_status || '—')}</dd></div><div><dt>Recovery</dt><dd>${money(row.recoverable_amount)} · ${row.customer_billable ? 'customer billable' : 'internal'}</dd></div><div><dt>Condition</dt><dd>${esc(short(row.condition_summary || row.notes || '—', 150))}</dd></div></dl>${row.cost_recovery_action_id ? buttons([button('Approve recovery','recovery-approve',row.cost_recovery_action_id),button('Decline','recovery-decline',row.cost_recovery_action_id,'',true)]) : ''}</article>`).join('');
    wrap.innerHTML = serviceHtml || scanHtml ? `${serviceHtml}${scanHtml}` : emptyQueue('No equipment activity', 'Resolved scans, service tasks, and cost-recovery reviews will appear here.');
  }

  function renderAssetQueue() {
    const wrap = byId('oc_asset_queue'); if (!wrap) return;
    const rows = queues.assets || [];
    wrap.innerHTML = rows.length ? rows.map((row) => {
      const publicImage = row.thumbnail_url || row.public_url || row.source_url;
      const thumb = publicImage ? `<img src="${esc(publicImage)}" alt="" loading="lazy" />` : `<span class="oc-private-media" aria-label="Private review asset">Private<br>review</span>`;
      return `<article class="oc-queue-card oc-media-card"><div class="oc-media-thumb">${thumb}</div><div class="oc-media-body"><header><strong>${esc(row.asset_key)}</strong><span class="${statusClass(row.asset_status)}">${esc(row.asset_status)}</span></header><dl><div><dt>Role / route</dt><dd>${esc(row.image_role)} · ${esc(row.route_key || 'general')}</dd></div><div><dt>Dimensions</dt><dd>${Number(row.pixel_width || 0)}×${Number(row.pixel_height || 0)} · ${Math.round(Number(row.file_size_bytes || 0)/1024)} KB</dd></div><div><dt>Storage</dt><dd>${publicImage ? 'public/linked' : 'private review'} · ${row.published_at ? 'published' : 'not published'}</dd></div><div><dt>Readiness</dt><dd>${Number(row.readiness_score || 0)}% · ${row.publication_ready ? 'publication ready' : 'blocked'}</dd></div><div><dt>Alt</dt><dd>${esc(short(row.alt_text || 'Missing', 150))}</dd></div></dl>${buttons([row.asset_status !== 'approved' ? button('Approve','asset-approve',row.id) : '', row.asset_status !== 'rejected' ? button('Reject','asset-reject',row.id,'',true) : ''])}</div></article>`;
    }).join('') : emptyQueue('No visual assets', 'Uploaded and linked images will appear here for consent and publication review.');
  }

  function renderRouteQueue() {
    const wrap = byId('oc_route_queue'); if (!wrap) return;
    const rows = queues.routes || [];
    wrap.innerHTML = rows.length ? rows.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.page_title || row.route_key)}</strong><span class="${statusClass(row.published_at ? 'published' : row.route_status)}">${esc(row.published_at ? 'published' : row.route_status)}</span></header><dl><div><dt>Path</dt><dd><code>${esc(row.route_path)}</code></dd></div><div><dt>SEO readiness</dt><dd>${Number(row.seo_readiness_score || 0)}% · ${row.publication_ready ? 'publishable' : 'blocked'}</dd></div><div><dt>H1</dt><dd>${esc(row.h1_text || '—')}</dd></div><div><dt>Visual</dt><dd>${esc(row.visual_asset_key || 'Missing')}</dd></div><div><dt>Published</dt><dd>${when(row.published_at)}</dd></div></dl>${buttons([row.route_status !== 'approved' ? button('Approve','route-approve',row.id) : '', row.route_status === 'approved' && row.publication_ready ? button('Publish + sitemap','route-publish',row.id) : '', row.route_status !== 'rejected' ? button('Reject','route-reject',row.id,'',true) : ''])}</article>`).join('') : emptyQueue('No route approvals', 'Approved service/location routes will appear here before page and sitemap publication.');
  }

  function renderQuoteQueue() {
    const wrap = byId('oc_quote_queue'); if (!wrap) return;
    const rows = queues.quotes || [];
    const owners = queues.profiles || [];
    wrap.innerHTML = rows.length ? rows.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.full_name)}</strong><span class="${statusClass(row.overdue ? 'overdue' : row.request_status)}">${esc(row.overdue ? 'overdue' : row.request_status)}</span></header><dl><div><dt>Contact</dt><dd>${esc(row.contact_value)}</dd></div><div><dt>Service / area</dt><dd>${esc(row.service_type || '—')} · ${esc(row.service_area || '—')}</dd></div><div><dt>Owner</dt><dd>${esc(row.assigned_owner_name || 'Unassigned')}</dd></div><div><dt>Follow-up</dt><dd>${when(row.followup_due_at)}</dd></div><div><dt>Response</dt><dd>${row.first_response_at ? `${Math.round(Number(row.response_minutes || 0))} min` : 'Awaiting first response'}</dd></div></dl><div class="oc-inline-controls"><label>Owner<select data-owner-for="${esc(row.id)}"><option value="">Unassigned</option>${optionList(owners,row.assigned_to_profile_id)}</select></label><label>Follow-up<input type="datetime-local" data-due-for="${esc(row.id)}" value="${row.followup_due_at ? new Date(row.followup_due_at).toISOString().slice(0,16) : ''}" /></label></div>${buttons([button('Assign / alert','quote-assign',row.id),button('Record contact','quote-contact',row.id,'',true)])}</article>`).join('') : emptyQueue('No quote follow-ups', 'New public requests will appear here for owner assignment and response tracking.');
  }

  function renderPortalQueue() {
    const wrap = byId('oc_portal_queue'); if (!wrap) return;
    const rows = queues.portal || [];
    const costRows = queues.job_costs || [];
    const portalHtml = rows.slice(0, 30).map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.rendered_title || row.estimate_number)}</strong><span class="${statusClass(row.package_status)}">${esc(row.package_status)}</span></header><dl><div><dt>Customer</dt><dd>${esc(row.client_name || row.client_email || '—')}</dd></div><div><dt>Total / deposit</dt><dd>${money(row.total_amount)} · ${money(row.latest_paid_amount || 0)} paid</dd></div><div><dt>Work order</dt><dd>${esc(row.work_order_number || 'Not created')} · ${esc(row.schedule_status || row.work_order_status || '—')}</dd></div><div><dt>Portal token</dt><dd><code>${esc(short(row.public_token, 22))}</code></dd></div></dl>${buttons([row.work_order_id ? button('Schedule dispatch','portal-dispatch',row.work_order_id) : '', row.latest_deposit_request_id && row.latest_deposit_status !== 'paid' ? button('Mark deposit paid','deposit-paid',row.latest_deposit_request_id,'',true) : ''])}</article>`).join('');
    const costHtml = costRows.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.job_code)} · ${esc(row.job_name)}</strong><span class="${statusClass(row.snapshot_status)}">${esc(row.snapshot_status)}</span></header><dl><div><dt>Revenue / cost</dt><dd>${money(row.revenue_total)} / ${money(row.total_cost)}</dd></div><div><dt>Margin</dt><dd>${money(row.margin_amount)} · ${Number(row.margin_percent || 0).toFixed(1)}%</dd></div><div><dt>Calculated</dt><dd>${when(row.calculated_at)}</dd></div></dl>${buttons([button('Refresh job cost','job-cost-refresh',row.job_id,'',true)])}</article>`).join('');
    wrap.innerHTML = portalHtml || costHtml ? `${portalHtml}${costHtml}` : emptyQueue('No portal or job-cost records', 'Accepted quotes, deposits, dispatches, and current job margins will appear here.');
  }

  function renderLiveUpdateQueue() {
    const wrap = byId('oc_live_updates_queue'); if (!wrap) return;
    const rows = queues.job_updates || [];
    wrap.innerHTML = rows.length ? rows.map((row) => {
      const status = row.update_status || 'published';
      const canRetract = status === 'published';
      const visibility = row.visibility === 'customer' ? 'customer-visible' : 'staff-only';
      return `<article class="oc-queue-card oc-live-update-card"><header><div><strong>${esc(row.work_order_number || 'Work order')}</strong><small>${esc(row.client_name || 'Client not linked')}</small></div><span class="${statusClass(status)}">${esc(status)}</span></header><dl><div><dt>Visibility / type</dt><dd>${esc(visibility)} · ${esc(String(row.update_type || 'note').replaceAll('_',' '))}</dd></div><div><dt>Update</dt><dd>${esc(short(row.title || 'Untitled update', 150))}</dd></div><div><dt>When / progress</dt><dd>${when(row.occurred_at)}${row.progress_percent === null || row.progress_percent === undefined ? '' : ` · ${Number(row.progress_percent).toFixed(0)}%`}</dd></div><div><dt>Media</dt><dd>${Number(row.approved_public_asset_count || 0)} approved public / ${Number(row.attached_asset_count || 0)} attached</dd></div><div><dt>Author</dt><dd>${esc(row.author_name || '—')}</dd></div></dl>${row.message ? `<p class="oc-live-update-message">${esc(short(row.message, 260))}</p>` : ''}${status === 'retracted' ? `<small>Retracted ${when(row.retracted_at)}${row.retraction_reason ? ` · ${esc(short(row.retraction_reason, 120))}` : ''}</small>` : ''}${buttons([canRetract ? button('Retract update','job-update-retract',row.id,'',true) : ''])}</article>`;
    }).join('') : emptyQueue('No live work updates yet', 'Staff updates and supervisor-approved customer updates will appear here.');
  }

  function renderRolePermissions() {
    const wrap = byId('oc_role_permissions'); if (!wrap) return;
    const snapshot = queues.capabilities || {};
    const actions = Object.entries(snapshot.actions || {});
    const role = snapshot.actor_role ? String(snapshot.actor_role).replaceAll('_', ' ') : 'role loading';
    wrap.innerHTML = `<div class="oc-permission-summary"><span class="operations-kicker">Server-provided role guard</span><strong>${esc(role)}</strong><small>Rank ${esc(snapshot.actor_rank ?? '—')}. Buttons stay protected by the server even when this display is unavailable.</small></div><div class="oc-permission-list">${actions.length ? actions.map(([key, item]) => `<span class="oc-permission ${item?.permitted ? 'is-allowed' : 'is-restricted'}" title="${esc(item?.reason || '')}">${item?.permitted ? '✓' : '•'} ${esc(item?.label || key)}</span>`).join('') : '<span class="oc-permission is-pending">Apply schema 155 to display the role capability checklist.</span>'}</div>`;
  }
  function decoratePermissionControls() {
    document.querySelectorAll('#operationsCockpit [data-oc-permission]').forEach((control) => {
      const cap = capabilityFor(control.dataset.ocPermission);
      if (!cap) return;
      const base = control.dataset.ocBaseLabel || control.textContent.replace(/ · restricted$/, '');
      control.dataset.ocBaseLabel = base;
      const permissionDenied = cap.permitted === false;
      const businessBlocked = control.id === 'oc_ar_application_submit' && !paymentApplicationPreview?.allowed;
      control.disabled = permissionDenied || businessBlocked;
      control.setAttribute('title', permissionDenied ? (cap.reason || 'Your role cannot perform this action.') : businessBlocked ? 'Preview and pass all A/R application checks before submitting.' : (cap.reason || 'Server permission check applies.'));
      control.textContent = permissionDenied ? `${base} · restricted` : base;
      control.setAttribute('aria-disabled', control.disabled ? 'true' : 'false');
    });
  }
  function renderOperationsHealth() {
    const stripeWrap = byId('oc_stripe_health');
    const stripe = queues.stripe_health || {};
    if (stripeWrap) {
      const last = stripe.latest_event_at || stripe.last_received_at;
      const providerReady = stripe.webhook_secret_configured && stripe.api_key_configured;
      stripeWrap.innerHTML = `<article class="oc-health-card"><span>Stripe configuration</span><strong class="${providerReady ? 'oc-math-ok' : 'oc-math-warning'}">${providerReady ? 'Ready for test mode' : 'Configuration incomplete'}</strong><small>API key: ${stripe.api_key_configured ? 'present' : 'missing'} · webhook secret: ${stripe.webhook_secret_configured ? 'present' : 'missing'}</small></article><article class="oc-health-card"><span>Webhook delivery, last 24 hours</span><strong>${Number(stripe.processed_24h || 0)} processed · ${Number(stripe.failed_24h || 0)} failed</strong><small>${last ? `Latest ${when(last)} · ${esc(stripe.last_validation_reason || stripe.last_event_type || 'No recorded event')}` : 'No verified webhook event is recorded yet.'}</small></article>`;
    }
    const exportWrap = byId('oc_export_readiness'); const readiness = queues.accountant_export || {};
    if (exportWrap) exportWrap.innerHTML = `<div><strong class="${readiness.package_ready ? 'oc-math-ok' : 'oc-math-warning'}">${readiness.package_ready ? 'Package readiness: clear' : 'Package readiness: review required'}</strong><small>${esc(readiness.readiness_message || 'Apply schema 155 for accountant package readiness.')}</small></div><div class="oc-export-metrics"><span>${Number(readiness.approved_payment_actions_pending || 0)} approved payment action(s) pending</span><span>${Number(readiness.unresolved_bank_items || 0)} unresolved bank item(s)</span><span>${readiness.latest_export_generated_at ? `Latest package: ${when(readiness.latest_export_generated_at)}` : 'No package generated yet'}</span></div>`;
    const testsWrap = byId('oc_staging_test_summary'); const runs = queues.staging_tests || [];
    if (testsWrap) testsWrap.innerHTML = runs.length ? runs.map((run) => `<span class="${statusClass(run.run_status)}">${esc(run.run_status)} · ${Number(run.passed_count || 0)}/${Number(run.case_count || 0)} passed · ${when(run.started_at)}</span>`).join('') : '<span class="muted">No staging-proof run has been recorded yet.</span>';
  }
  function renderReleaseDashboard() {
    const wrap = byId('oc_release_dashboard');
    const dash = queues.release_dashboard || {};
    if (!wrap) return;
    const yes = (value) => value === true || value === 'true';
    const stagingOk = dash.staging_evidence_status === 'staging_evidence_ready';
    const contentOk = dash.public_content_status === 'public_content_ready';
    const policyOk = yes(dash.policy_ready);
    const backupOk = dash.backup_rehearsal_status === 'passed';
    const testOk = dash.latest_staging_run_status === 'passed';
    const webhookOk = Number(dash.critical_webhook_alert_count || 0) === 0;
    const gate = (title, value, detail, ok) => `<article class="oc-release-gate ${ok ? 'is-clear' : 'is-review'}"><span>${esc(title)}</span><strong class="${ok ? 'oc-math-ok' : 'oc-math-warning'}">${esc(value)}</strong><small>${esc(detail)}</small></article>`;
    const snapshot = dash.latest_snapshot_at ? `Latest evidence snapshot: ${when(dash.latest_snapshot_at)}${dash.latest_snapshot_scope ? ` · ${String(dash.latest_snapshot_scope).replaceAll('_',' ')}` : ''}` : 'No release-evidence snapshot has been recorded yet.';
    wrap.innerHTML = `<article class="oc-release-dashboard-card"><header><div><span class="operations-kicker">Human release review</span><h4>Release readiness dashboard</h4><p>${esc(dash.dashboard_message || 'Apply schema 155 to load release-readiness evidence.')}</p></div><span class="${statusClass(stagingOk ? 'ready' : 'review')}">${stagingOk ? 'staging evidence ready' : 'review required'}</span></header><div class="oc-release-gates">${gate('Schema', dash.schema_status || 'unknown', `Expected ${dash.expected_schema_version || '—'} · applied ${dash.latest_applied_schema_version || '—'}`, dash.schema_status === 'current')}${gate('Policy', policyOk ? 'protected' : 'review', `${Number(dash.policy_passed_count || 0)}/${Number(dash.policy_assertion_count || 0)} assertions passed`, policyOk)}${gate('Staging tests', dash.latest_staging_run_status || 'not recorded', `${Number(dash.latest_staging_passed_count || 0)}/${Number(dash.latest_staging_case_count || 0)} passed`, testOk)}${gate('Recovery proof', dash.backup_rehearsal_status || 'not recorded', dash.backup_rehearsal_at ? `Last recorded ${when(dash.backup_rehearsal_at)}` : 'A successful restore rehearsal is required.', backupOk)}${gate('Webhook health', `${Number(dash.webhook_failed_24h || 0)} failed / 24h`, `${Number(dash.critical_webhook_alert_count || 0)} critical alert(s) · ${Number(dash.webhook_processed_24h || 0)} processed`, webhookOk)}${gate('Public content', contentOk ? 'ready' : 'review', `${Number(dash.approved_route_count || 0)} approved route(s) · ${Number(dash.pending_public_asset_count || 0)} public asset(s) pending`, contentOk)}</div><footer><small>${esc(snapshot)}</small><small>Snapshots preserve evidence only. They never deploy code, publish routes, charge customers, or override a blocked check.</small></footer></article>`;
  }

  function renderReleaseProof() {
    const policyWrap = byId('oc_policy_summary');
    const policy = queues.security_policy || {};
    if (policyWrap) {
      const passed = Number(policy.passed_count || 0); const total = Number(policy.assertion_count || 0);
      policyWrap.innerHTML = `<article class="oc-release-card"><span>Policy evidence</span><strong class="${policy.policy_ready ? 'oc-math-ok' : 'oc-math-warning'}">${policy.policy_ready ? 'Protected paths ready' : 'Policy review required'}</strong><small>${passed}/${total || '—'} assertions passed. Private review uploads, private accountant ZIPs, RLS, and service-role RPC grants are verified from the database view after schema 155 is applied.</small></article>`;
    }
    const alertWrap = byId('oc_webhook_alerts'); const alerts = queues.webhook_alerts || [];
    if (alertWrap) alertWrap.innerHTML = alerts.length ? alerts.map((row) => `<article class="oc-release-card"><header><strong>${esc(row.alert_type.replaceAll('_',' '))}</strong><span class="${statusClass(row.severity)}">${esc(row.severity)}</span></header><p>${esc(row.message)}</p><small>Last detected ${when(row.last_detected_at)}.</small>${buttons([row.alert_status === 'open' ? button('Acknowledge','webhook-ack',row.id,'',true) : '', button('Resolve','webhook-resolve',row.id,'',true)])}</article>`).join('') : emptyQueue('No webhook delivery alerts', 'Verified delivery outcomes are checked automatically when the queue refreshes.');
    const signalWrap = byId('oc_signal_queue'); const signals = queues.content_signals || [];
    if (signalWrap) signalWrap.innerHTML = signals.length ? signals.map((row) => `<article class="oc-release-card"><header><strong>${esc(row.route_path || row.route_key || 'Unlinked route signal')}</strong><span class="${statusClass(row.source_name)}">${esc(row.source_name.replaceAll('_',' '))}</span></header><dl><div><dt>Date</dt><dd>${esc(row.observation_date || '—')}</dd></div><div><dt>Evidence</dt><dd>${Number(row.impressions || 0)} impressions · ${Number(row.clicks || 0)} clicks · pos. ${row.average_position ?? '—'}</dd></div><div><dt>Recommendation</dt><dd>${esc(short(row.recommended_next_action, 160))}</dd></div></dl>${buttons([button('Mark review','signal-review',row.id,'',true),button('Mark actioned','signal-actioned',row.id,'',true)])}</article>`).join('') : emptyQueue('No route signals awaiting a decision', 'Add a Search Console, Google Business Profile, or manual analytics observation below.');
  }

  function renderExecutionProofQueue() {
    const wrap = byId('oc_execution_proof_queue'); if (!wrap) return;
    const proofs = queues.execution_proofs || [];
    const costs = queues.execution_costs || [];
    const costCards = costs.slice(0, 8).map((row) => `<article class="oc-execution-cost-card"><header><strong>${esc(row.work_order_number || 'Work order')}</strong><span class="${statusClass(row.cost_status)}">${esc(String(row.cost_status || 'unknown').replaceAll('_',' '))}</span></header><dl><div><dt>Customer</dt><dd>${esc(row.client_name || '—')}</dd></div><div><dt>Estimate / actual</dt><dd>${money(row.accepted_estimate_total)} / ${money(row.total_actual_cost)}</dd></div><div><dt>Margin</dt><dd>${money(row.margin_amount)} · ${Number(row.margin_percent || 0).toFixed(1)}%</dd></div><div><dt>Proofs</dt><dd>${Number(row.approved_proof_count || 0)} approved · ${Number(row.submitted_proof_count || 0)} pending</dd></div></dl></article>`).join('');
    const proofCards = proofs.slice(0, 30).map((row) => {
      const actions = [];
      if (row.proof_status === 'submitted') {
        actions.push(button('Approve proof','execution-proof-approve',row.id));
        actions.push(button('Reject proof','execution-proof-reject',row.id,'',true));
      }
      return `<article class="oc-queue-card oc-execution-proof-card"><header><div><strong>${esc(row.work_order_number || 'Work order')}</strong><small>${esc(row.proof_type || 'proof')} · ${esc(row.title || 'Execution proof')}</small></div><span class="${statusClass(row.proof_status)}">${esc(row.proof_status || 'unknown')}</span></header><dl><div><dt>Customer</dt><dd>${esc(row.client_name || '—')}</dd></div><div><dt>Occurred</dt><dd>${when(row.occurred_at)}</dd></div><div><dt>Customer safe</dt><dd>${row.customer_visible ? 'yes, after approval' : 'no, staff only'}</dd></div><div><dt>Internal cost</dt><dd>${money(row.total_cost)} · labour ${money(row.labour_cost_total)} · materials ${money(row.material_cost_total)} · equipment ${money(row.equipment_cost_total)}</dd></div><div><dt>Assets</dt><dd>${Number(row.approved_public_asset_count || 0)} approved public / ${Number(row.attached_asset_count || 0)} attached</dd></div><div><dt>Cost status</dt><dd>${esc(String(row.cost_status || 'awaiting proof').replaceAll('_',' '))}</dd></div></dl>${row.staff_notes ? `<p class="oc-execution-note">${esc(short(row.staff_notes, 240))}</p>` : ''}${buttons(actions)}</article>`;
    }).join('');
    wrap.innerHTML = `<div class="oc-execution-summary"><p>Approved proof updates internal job-cost snapshots. Customer portal proof cards show only approved customer summaries and public images; labour, material, equipment, and margin data stay in this Cockpit.</p></div>${costCards ? `<div class="oc-execution-cost-grid">${costCards}</div>` : ''}${proofCards || emptyQueue('No execution proof yet', 'Submit arrival, progress, completion, or quality proof when a dispatched crew captures real service evidence.')}`;
  }

  function renderCloseoutQueue() {
    const wrap = byId('oc_closeout_queue'); if (!wrap) return;
    const rows = queues.closeouts || [];
    wrap.innerHTML = rows.length ? rows.map((row) => {
      const actions = [];
      if (row.closeout_status === 'submitted') {
        actions.push(button('Approve closeout','closeout-approve',row.id));
        actions.push(button('Request rework','closeout-rework',row.id,'',true));
        actions.push(button('Reject','closeout-reject',row.id,'',true));
      }
      if ((row.closeout_status === 'approved' || row.closeout_status === 'invoice_ready') && row.invoice_readiness_status !== 'ready') {
        actions.push(button('Mark invoice-ready','closeout-invoice',row.id));
      }
      return `<article class="oc-queue-card oc-closeout-card"><header><div><strong>${esc(row.work_order_number || 'Work order')}</strong><small>${esc(row.client_name || 'Client')} · ${esc(row.cost_status || 'cost status pending')}</small></div><span class="${statusClass(row.closeout_status)}">${esc(String(row.closeout_status || 'unknown').replaceAll('_',' '))}</span></header><dl><div><dt>Signoff</dt><dd>${esc(String(row.customer_signoff_status || 'not requested').replaceAll('_',' '))}</dd></div><div><dt>Invoice readiness</dt><dd>${esc(String(row.invoice_readiness_status || 'blocked').replaceAll('_',' '))}</dd></div><div><dt>Review / maintenance</dt><dd>${esc(String(row.review_request_status || 'not requested').replaceAll('_',' '))} · ${esc(row.maintenance_followup_due_at || 'no reminder')}</dd></div><div><dt>Proof / gallery</dt><dd>${Number(row.approved_proof_count || 0)} approved proof · ${Number(row.before_count || 0)} before / ${Number(row.after_count || 0)} after</dd></div><div><dt>Internal margin</dt><dd>${money(row.margin_amount)} · ${Number(row.margin_percent || 0).toFixed(1)}%</dd></div></dl><p class="oc-closeout-summary">${esc(short(row.customer_summary || row.closeout_message || 'Closeout summary pending.', 260))}</p><small>${esc(row.closeout_message || 'Closeout is awaiting supervisor review.')}</small>${buttons(actions)}</article>`;
    }).join('') : emptyQueue('No closeout packages yet', 'Create a supervisor closeout after approved proof is available. Customer signoff, invoice readiness, review request, and maintenance follow-up will appear here.');
  }

  function renderCustomerNotificationQueue() {
    const wrap = byId('oc_customer_notification_queue'); if (!wrap) return;
    const rows = queues.customer_notifications || [];
    const delivery = queues.customer_notification_delivery || {};
    const deliveryState = delivery.enabled
      ? (delivery.resend_configured && delivery.run_token_configured ? 'Protected e-mail delivery is configured.' : 'Delivery is enabled but one or more provider credentials are still missing.')
      : 'E-mail delivery is off for this deployment; queued messages will not send.';
    const deliveryBadge = delivery.enabled && delivery.resend_configured && delivery.run_token_configured ? 'ready' : 'review';
    const cards = rows.map((row) => {
      const actions = [];
      if (['manual_review','failed','blocked'].includes(String(row.delivery_status || ''))) actions.push(button('Retry after review','customer-notification-retry',row.id,'',true));
      return `<article class="oc-queue-card oc-notification-delivery-card"><header><div><strong>${esc(row.work_order_number || 'Work order')}</strong><small>${esc(row.live_update_title || row.update_type || 'Customer-visible update')}</small></div><span class="${statusClass(row.delivery_status)}">${esc(row.delivery_status || 'unknown')}</span></header><dl><div><dt>Consent</dt><dd>${esc(row.consent_status || 'unknown')} · ${row.live_work_update_opt_in ? 'email on' : 'email off'}</dd></div><div><dt>Attempts</dt><dd>${Number(row.attempt_count || 0)} of ${Number(row.max_attempts || 0)}</dd></div><div><dt>Next attempt</dt><dd>${esc(when(row.next_attempt_at))}</dd></div><div><dt>Last result</dt><dd>${esc(short(row.last_error || row.cancellation_reason || row.provider_message_id || 'Awaiting protected dispatch', 150))}</dd></div></dl>${buttons(actions)}</article>`;
    });
    wrap.innerHTML = `<div class="oc-notification-delivery-status"><span class="${statusClass(deliveryBadge)}">${esc(delivery.enabled ? 'delivery state' : 'delivery off')}</span><p>${esc(deliveryState)} Email addresses, portal tokens, staff notes, and private media are never shown in this queue.</p></div>${cards.length ? cards.join('') : emptyQueue('No customer e-mails awaiting review', 'Customer-visible updates require an explicit portal opt-in before delivery is queued.')}`;
  }

  function recurringDateLabel(value) {
    if(!value) return 'Not set';
    const d=new Date(`${value}T12:00:00`);
    return Number.isNaN(d.valueOf()) ? String(value) : d.toLocaleDateString(undefined,{weekday:'short',year:'numeric',month:'short',day:'numeric'});
  }
  function recurringSeasonLabel(row) {
    if(!row?.season_start_month || !row?.season_start_day || !row?.season_end_month || !row?.season_end_day) return 'No annual season gate';
    return `${Number(row.season_start_month)}/${Number(row.season_start_day)} → ${Number(row.season_end_month)}/${Number(row.season_end_day)}`;
  }
  function recurringProgramLabel(row) {
    const frequency=String(row?.recurrence_frequency || '').replaceAll('_',' ');
    if(row?.recurrence_frequency==='custom_days') return `Every ${Number(row.custom_interval_days || row.recurrence_interval || 1)} day(s)`;
    return frequency ? frequency.replace(/\b\w/g,(m)=>m.toUpperCase()) : (row?.recurrence_label || 'Not set');
  }
  function renderRecurringService() {
    const programsWrap=byId('oc_recurring_programs');
    const visitsWrap=byId('oc_recurring_visits');
    if(!programsWrap || !visitsWrap) return;
    const programs=queues.recurring_service_programs || [];
    const visits=(queues.recurring_service_visits || []).filter((row)=>row.service_date >= new Date().toISOString().slice(0,10));
    const active=programs.filter((row)=>row.agreement_status==='active').length;
    const held=visits.filter((row)=>row.visit_status==='held').length;
    const delayed=visits.filter((row)=>row.visit_status==='weather_delayed' || row.visit_status==='makeup').length;
    const summary=byId('oc_recurring_summary');
    if(summary) summary.textContent=`${programs.length} program(s) · ${active} active · ${visits.length} upcoming visit(s) · ${held} held · ${delayed} delayed/make-up`;

    programsWrap.innerHTML=programs.length ? programs.map((row)=>{
      const location=[row.site_name,row.service_address,row.site_city].filter(Boolean).join(' · ') || row.client_name || 'Property not linked';
      const timing=[recurringProgramLabel(row),recurringSeasonLabel(row)].join(' · ');
      return `<article class="oc-queue-card oc-recurring-program-card">
        <header><div><strong>${esc(row.service_name || row.agreement_code)}</strong><small>${esc(row.agreement_code || '')} · ${esc(String(row.service_program_type || 'other').replaceAll('_',' '))}</small></div><span class="${statusClass(row.agreement_status)}">${esc(row.agreement_status || 'draft')}</span></header>
        <dl>
          <div><dt>Customer / property</dt><dd>${esc(location)}</dd></div>
          <div><dt>Recurrence</dt><dd>${esc(timing)}</dd></div>
          <div><dt>Window</dt><dd>${esc([row.service_window_start,row.service_window_end].filter(Boolean).join('–') || 'No preferred clock window')}</dd></div>
          <div><dt>Crew / route</dt><dd>${esc([row.crew_name,row.route_name].filter(Boolean).join(' · ') || 'Unassigned')}</dd></div>
          <div><dt>Next visit</dt><dd>${esc(row.next_service_date ? recurringDateLabel(row.next_service_date) : 'No generated visit')}${row.next_visit_status ? ` · ${esc(String(row.next_visit_status).replaceAll('_',' '))}` : ''}</dd></div>
          <div><dt>Scheduler</dt><dd>${row.auto_create_session_candidates ? 'Planned session candidates on' : 'Manual only'}</dd></div>
        </dl>
        ${row.pause_reason ? `<p class="muted">Hold/pause: ${esc(short(row.pause_reason,180))}</p>` : ''}
        ${row.cancellation_reason ? `<p class="muted">Cancellation: ${esc(short(row.cancellation_reason,180))}</p>` : ''}
        ${buttons([button('Edit program','recurring-program-edit',row.id,'',true,'recurring_service_program_save')])}
      </article>`;
    }).join('') : emptyQueue('No recurring lawn/yard programs','Create the first weekly, biweekly, custom or seasonal program with the form above.');

    visitsWrap.innerHTML=visits.length ? visits.slice(0,120).map((row)=>{
      const program=programs.find((item)=>String(item.id)===String(row.agreement_id)) || {};
      const moved=row.service_date && row.original_service_date && row.service_date!==row.original_service_date;
      const heldVisit=row.visit_status==='held';
      const finalVisit=['skipped','cancelled'].includes(row.visit_status);
      return `<article class="oc-queue-card oc-recurring-visit-card" data-status="${esc(row.visit_status || 'scheduled')}">
        <header><div><strong>${esc(row.service_name || row.agreement_code)}</strong><small>${esc(recurringDateLabel(row.service_date))}${moved ? ` · originally ${esc(recurringDateLabel(row.original_service_date))}` : ''}</small></div><span class="${statusClass(row.visit_status)}">${esc(String(row.visit_status || 'scheduled').replaceAll('_',' '))}</span></header>
        <dl>
          <div><dt>Recurrence</dt><dd>${esc(row.recurrence_label || recurringProgramLabel(program))}</dd></div>
          <div><dt>Service window</dt><dd>${esc([row.service_window_start,row.service_window_end].filter(Boolean).join('–') || 'Not set')}</dd></div>
          <div><dt>Duration / travel</dt><dd>${Number(row.visit_estimated_minutes || 0)} min · ${Number(row.default_travel_allowance_minutes || 0)} min travel</dd></div>
          <div><dt>Weather policy</dt><dd>${esc(String(row.weather_delay_policy || 'manual').replaceAll('_',' '))}</dd></div>
        </dl>
        ${row.latest_event_reason ? `<p class="muted">Latest event: ${esc(short(row.latest_event_reason,220))}</p>` : ''}
        ${buttons([
          !finalVisit && !heldVisit ? button('Skip','recurring-visit-skip',row.occurrence_key,'',true,'recurring_service_visit_event') : '',
          !finalVisit && !heldVisit ? button('Weather delay','recurring-visit-weather',row.occurrence_key,'',true,'recurring_service_visit_event') : '',
          !finalVisit && !heldVisit ? button('Make-up date','recurring-visit-makeup',row.occurrence_key,'',true,'recurring_service_visit_event') : '',
          !finalVisit && !heldVisit ? button('Customer hold','recurring-visit-hold',row.occurrence_key,'',true,'recurring_service_visit_event') : '',
          heldVisit ? button('Resume','recurring-visit-resume',row.occurrence_key,'',true,'recurring_service_visit_event') : '',
          !finalVisit ? button('Cancel visit','recurring-visit-cancel',row.occurrence_key,'',true,'recurring_service_visit_event') : ''
        ])}
      </article>`;
    }).join('') : emptyQueue('No upcoming recurring visits','Active programs generate visits from their recurrence and seasonal windows.');
  }
  function hydrateRecurringSelectors() {
    const programs=queues.recurring_service_programs || [];
    const clients=queues.recurring_service_clients || [];
    const sites=queues.recurring_service_sites || [];
    const crews=queues.crew_dispatch_crews || [];
    const routes=queues.crew_dispatch_routes || [];
    const apply=(selector,html)=>document.querySelectorAll(selector).forEach((select)=>{ const current=select.value; select.innerHTML=html; if(current) select.value=current; });
    apply('[data-oc-recurring-client]',`<option value="">No customer selected</option>${clients.map((row)=>`<option value="${esc(row.id)}">${esc(row.display_name || row.legal_name || row.id)}</option>`).join('')}`);
    apply('[data-oc-recurring-site]',`<option value="">No property selected</option>${sites.map((row)=>`<option value="${esc(row.id)}" data-client-id="${esc(row.client_id || '')}">${esc(row.site_name || row.service_address || row.id)}${row.city ? ` · ${esc(row.city)}` : ''}</option>`).join('')}`);
    apply('[data-oc-recurring-crew]',`<option value="">No default crew</option>${crews.filter((row)=>!['inactive','archived'].includes(String(row.crew_status||'').toLowerCase())).map((row)=>`<option value="${esc(row.id)}">${esc(row.crew_name)}</option>`).join('')}`);
    apply('[data-oc-recurring-route]',`<option value="">No default route</option>${routes.map((row)=>`<option value="${esc(row.id)}">${esc(row.name || row.route_code || row.id)}</option>`).join('')}`);
  }
  function resetRecurringProgramForm() {
    const form=byId('oc_recurring_program_form'); if(!form) return;
    form.reset();
    form.elements.id.value='';
    form.elements.agreement_status.value='draft';
    form.elements.service_program_type.value='mowing';
    form.elements.recurrence_frequency.value='weekly';
    form.elements.recurrence_interval.value='1';
    form.elements.weather_delay_policy.value='manual';
    form.elements.weather_makeup_days.value='1';
    form.elements.default_travel_allowance_minutes.value='0';
    form.elements.auto_create_session_candidates.checked=true;
  }
  function loadRecurringProgram(row) {
    const form=byId('oc_recurring_program_form'); if(!form || !row) return;
    const keys=['id','agreement_code','service_name','agreement_status','service_program_type','billing_method','client_id','client_site_id','crew_id','route_id','recurrence_frequency','recurrence_interval','custom_interval_days','preferred_weekday','recurrence_anchor_date','start_date','end_date','service_window_start','service_window_end','season_start_month','season_start_day','season_end_month','season_end_day','visit_estimated_minutes','default_travel_allowance_minutes','weather_delay_policy','weather_makeup_days','customer_hold_until','customer_hold_reason','pause_reason','cancellation_reason','service_notes'];
    keys.forEach((key)=>{ if(form.elements[key]) form.elements[key].value=row[key] ?? ''; });
    form.elements.open_end_date.checked=row.open_end_date===true;
    form.elements.auto_create_session_candidates.checked=row.auto_create_session_candidates!==false;
    form.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function handleRecurringProgram(event) {
    event.preventDefault();
    const form=event.currentTarget;
    const data=formData(form);
    await send({
      action:'recurring_service_program_save',
      ...data,
      open_end_date:form.elements.open_end_date.checked,
      auto_create_session_candidates:form.elements.auto_create_session_candidates.checked
    },'Recurring lawn/yard program save');
    resetRecurringProgramForm();
  }
  async function recurringVisitEvent(row,eventType) {
    if(!row) return;
    let reason='';
    let effectiveDate=null;
    let workability=null;
    if(eventType==='resume') {
      reason='Customer/program hold resumed';
    } else {
      reason=(prompt(eventType==='customer_hold' ? 'Customer hold reason:' : `${String(eventType).replaceAll('_',' ')} reason:`) || '').trim();
      if(!reason) return;
    }
    if(eventType==='weather_delay' || eventType==='makeup' || eventType==='customer_hold') {
      const label=eventType==='customer_hold' ? 'Hold-until date (blank = indefinite hold, YYYY-MM-DD):' : 'New service date (YYYY-MM-DD):';
      const entered=(prompt(label,eventType==='customer_hold' ? '' : row.service_date || row.original_service_date || '') || '').trim();
      if(eventType!=='customer_hold' && !/^\d{4}-\d{2}-\d{2}$/.test(entered)) return;
      effectiveDate=entered || null;
    }
    if(eventType==='weather_delay') workability='delayed';
    if(eventType==='makeup') workability='caution';
    await send({
      action:'recurring_service_visit_event',
      agreement_id:row.agreement_id,
      original_service_date:row.original_service_date,
      event_type:eventType,
      effective_service_date:effectiveDate,
      reason,
      workability_state:workability
    },`Recurring visit ${String(eventType).replaceAll('_',' ')}`);
  }

  function dispatchLocalValue(value) {
    if (!value) return '';
    const d=new Date(value); if(Number.isNaN(d.valueOf())) return '';
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,16);
  }
  function dispatchSelectedValues(selector) {
    const el=document.querySelector(selector);
    return el ? [...el.selectedOptions].map((option)=>option.value).filter(Boolean) : [];
  }
  function dispatchWindowRows() {
    const rows=(queues.crew_dispatch_schedule || []).filter((row)=>row.schedule_status!=='superseded');
    const anchor=byId('oc_dispatch_board_date')?.value || new Date().toISOString().slice(0,10);
    const mode=byId('oc_dispatch_board_mode')?.value || 'week';
    const start=new Date(`${anchor}T00:00:00`);
    if(Number.isNaN(start.valueOf())) return rows;
    const end=new Date(start);
    end.setDate(end.getDate()+(mode==='day'?1:7));
    return rows.filter((row)=>{
      const whenValue=new Date(row.scheduled_start || 0).valueOf();
      return whenValue>=start.valueOf() && whenValue<end.valueOf();
    });
  }
  function renderCrewDispatch() {
    const wrap=byId('oc_crew_dispatch_board'); if(!wrap) return;
    const rows=dispatchWindowRows();
    const meta=queues.crew_dispatch_meta || {};
    const activeConflicts=rows.filter((row)=>Number(row.conflict_count||0)>0 && !row.conflict_override_note && !['cancelled','completed'].includes(row.schedule_status)).length;
    const blocked=rows.filter((row)=>row.workability_state==='blocked').length;
    const summary=byId('oc_dispatch_board_summary');
    if(summary) summary.textContent=`${rows.length} visit(s) · ${activeConflicts} conflict(s) · ${blocked} workability block(s) · ${meta.permission_filtered===true?'permission filtered':'loading'}`;
    if(!rows.length){ wrap.innerHTML=emptyQueue('No scheduled visits in this window','Use the scheduler form to assign a crew, route and equipment to an eligible work order.'); return; }
    const byDay=new Map();
    rows.sort((a,b)=>new Date(a.scheduled_start||0)-new Date(b.scheduled_start||0) || Number(a.route_order||999)-Number(b.route_order||999));
    rows.forEach((row)=>{
      const day=(row.scheduled_start || '').slice(0,10) || 'Unscheduled';
      if(!byDay.has(day)) byDay.set(day,[]);
      byDay.get(day).push(row);
    });
    wrap.innerHTML=[...byDay.entries()].map(([day,dayRows])=>`<section class="oc-dispatch-day"><h4>${esc(day)}</h4><div class="oc-live-queue">${dayRows.map((row)=>{
      const readiness=row.dispatch_readiness || 'ready';
      const crew=row.crew_name || row.lead_name || row.supervisor_name || 'Crew unassigned';
      const location=[row.site_name,row.service_address,row.site_city].filter(Boolean).join(' · ');
      const resourceBits=[
        row.truck_name ? `Truck: ${row.truck_name}` : '',
        row.trailer_name ? `Trailer: ${row.trailer_name}` : '',
        Array.isArray(row.assigned_equipment_item_ids) && row.assigned_equipment_item_ids.length ? `${row.assigned_equipment_item_ids.length} extra equipment` : ''
      ].filter(Boolean).join(' · ') || 'No vehicle/equipment assigned';
      const recurring=row.recurrence_label || row.recurring_visit_key || 'One-time / not labelled';
      const conflictText=Number(row.conflict_count||0)>0 ? `${Number(row.conflict_count)} overlapping assignment(s)${row.conflict_override_note?' · override recorded':''}` : 'No detected resource conflicts';
      return `<article class="oc-queue-card oc-dispatch-card" data-readiness="${esc(readiness)}">
        <header><div><strong>${esc(row.work_order_number || row.job_code || 'Work order')}</strong><small>${esc(row.work_type || row.job_name || '')}</small></div><span class="${statusClass(readiness)}">${esc(String(readiness).replaceAll('_',' '))}</span></header>
        <dl>
          <div><dt>Time</dt><dd>${when(row.scheduled_start)} → ${when(row.scheduled_end)}</dd></div>
          <div><dt>Crew / lead</dt><dd>${esc(crew)}${row.lead_name && row.crew_name ? ` · lead ${esc(row.lead_name)}` : ''}</dd></div>
          <div><dt>Property / customer</dt><dd>${esc(location || row.client_name || 'Property not linked')}</dd></div>
          <div><dt>Route</dt><dd>${esc(row.route_name || 'No route')}${row.route_order ? ` · stop ${Number(row.route_order)}` : ''}</dd></div>
          <div><dt>Duration / travel</dt><dd>${Number(row.estimated_duration_minutes||0)} min · ${Number(row.travel_allowance_minutes||0)} min travel</dd></div>
          <div><dt>Equipment</dt><dd>${esc(resourceBits)}</dd></div>
          <div><dt>Recurring</dt><dd>${esc(recurring)}</dd></div>
          <div><dt>Workability</dt><dd>${esc(String(row.workability_state||'not assessed').replaceAll('_',' '))}${row.weather_summary ? ` · ${esc(short(row.weather_summary,100))}` : ''}</dd></div>
          <div><dt>Conflicts</dt><dd>${esc(conflictText)}</dd></div>
          <div><dt>Status</dt><dd>${esc(String(row.schedule_status||'scheduled').replaceAll('_',' '))}</dd></div>
        </dl>
        ${row.dispatch_notes ? `<p class="muted">${esc(short(row.dispatch_notes,220))}</p>` : ''}
        ${buttons([
          button('Edit / reschedule','dispatch-load',row.id,'',true,'dispatch_schedule'),
          row.schedule_status!=='cancelled' ? button('Dispatch now','dispatch-now',row.id,'',false,'dispatch_schedule') : '',
          row.schedule_status!=='cancelled' ? button('Cancel visit','dispatch-cancel',row.id,'',true,'dispatch_schedule') : ''
        ])}
      </article>`;
    }).join('')}</div></section>`).join('');
  }
  function hydrateCrewDispatchSelectors() {
    const crews=queues.crew_dispatch_crews || [];
    const profiles=queues.profiles || [];
    const equipment=(queues.crew_dispatch_equipment || []).filter((row)=>!row.is_locked_out && !['inactive','retired','out_of_service'].includes(String(row.status||'').toLowerCase()));
    const routes=queues.crew_dispatch_routes || [];
    const workOrders=queues.crew_dispatch_work_orders || [];
    const apply=(selector,html)=>document.querySelectorAll(selector).forEach((select)=>{ const current=select.value; select.innerHTML=html; if(current) select.value=current; });
    apply('[data-oc-dispatch-work-order]',`<option value="">Choose work order</option>${workOrders.map((row)=>`<option value="${esc(row.work_order_id)}">${esc(row.work_order_number || row.job_code || row.work_order_id)} · ${esc(row.client_name || row.site_name || row.work_type || 'work')}</option>`).join('')}`);
    apply('[data-oc-dispatch-crew]',`<option value="">No named crew</option>${crews.filter((row)=>!['inactive','archived'].includes(String(row.crew_status||'').toLowerCase())).map((row)=>`<option value="${esc(row.id)}">${esc(row.crew_name)} · ${Number(row.member_count||0)} member(s)</option>`).join('')}`);
    const profileOptions=`<option value="">Use crew/default assignment</option>${profiles.map((row)=>`<option value="${esc(row.id)}">${esc(row.full_name || row.email || row.id)} · ${esc(row.role || '')}</option>`).join('')}`;
    apply('[data-oc-dispatch-lead]',profileOptions);
    apply('[data-oc-dispatch-supervisor]',profileOptions);
    apply('#oc_dispatch_crew_members',profiles.map((row)=>`<option value="${esc(row.id)}">${esc(row.full_name || row.email || row.id)} · ${esc(row.role || '')}</option>`).join(''));
    apply('[data-oc-dispatch-route]',`<option value="">Use work-order/default route</option>${routes.map((row)=>`<option value="${esc(row.id)}">${esc(row.name)}${row.route_code?` · ${esc(row.route_code)}`:''}</option>`).join('')}`);
    const equipOptions=`<option value="">None</option>${equipment.map((row)=>`<option value="${esc(row.id)}">${esc(row.equipment_name)}${row.category?` · ${esc(row.category)}`:''}</option>`).join('')}`;
    const truckChoices=equipment.filter((row)=>/truck|vehicle|fleet|pickup|van/i.test(String(row.category||row.equipment_name||'')));
    const trailerChoices=equipment.filter((row)=>/trailer/i.test(String(row.category||row.equipment_name||'')));
    apply('[data-oc-dispatch-truck]',`<option value="">No truck/vehicle assigned</option>${(truckChoices.length?truckChoices:equipment).map((row)=>`<option value="${esc(row.id)}">${esc(row.equipment_name)}</option>`).join('')}`);
    apply('[data-oc-dispatch-trailer]',`<option value="">No trailer assigned</option>${(trailerChoices.length?trailerChoices:equipment).map((row)=>`<option value="${esc(row.id)}">${esc(row.equipment_name)}</option>`).join('')}`);
    document.querySelectorAll('[data-oc-dispatch-equipment]').forEach((select)=>{
      const current=[...select.selectedOptions].map((o)=>o.value);
      select.innerHTML=equipment.map((row)=>`<option value="${esc(row.id)}">${esc(row.equipment_name)}${row.category?` · ${esc(row.category)}`:''}</option>`).join('');
      current.forEach((value)=>{ const option=[...select.options].find((o)=>o.value===value); if(option) option.selected=true; });
    });
  }
  function populateCrewFromSelection() {
    const form=byId('oc_crew_dispatch_form'); if(!form) return;
    const crew=(queues.crew_dispatch_crews || []).find((row)=>String(row.id)===String(form.elements.crew_id?.value || ''));
    if(!crew) return;
    if(crew.lead_profile_id) form.elements.lead_profile_id.value=crew.lead_profile_id;
    if(crew.supervisor_profile_id) form.elements.assigned_supervisor_profile_id.value=crew.supervisor_profile_id;
    const memberIds=Array.isArray(crew.members_json) ? crew.members_json.map((row)=>String(row.profile_id||row.id||'')).filter(Boolean) : [];
    const select=form.elements.assigned_crew_profile_ids;
    if(select) [...select.options].forEach((option)=>{ option.selected=memberIds.includes(option.value); });
  }
  function resetCrewDispatchForm() {
    const form=byId('oc_crew_dispatch_form'); if(!form) return;
    form.reset();
    form.elements.supersedes_dispatch_id.value='';
    if(form.elements.schedule_status) form.elements.schedule_status.value='scheduled';
    if(form.elements.workability_state) form.elements.workability_state.value='not_assessed';
  }
  function loadDispatchIntoForm(row,statusValue='rescheduled') {
    const form=byId('oc_crew_dispatch_form'); if(!form || !row) return;
    form.elements.work_order_id.value=row.work_order_id || '';
    form.elements.schedule_status.value=statusValue;
    form.elements.scheduled_start.value=dispatchLocalValue(row.scheduled_start);
    form.elements.scheduled_end.value=dispatchLocalValue(row.scheduled_end);
    form.elements.crew_id.value=row.crew_id || '';
    form.elements.lead_profile_id.value=row.lead_profile_id || '';
    form.elements.assigned_supervisor_profile_id.value=row.assigned_supervisor_profile_id || '';
    form.elements.route_id.value=row.route_id || '';
    form.elements.route_order.value=row.route_order || '';
    form.elements.estimated_duration_minutes.value=row.estimated_duration_minutes || '';
    form.elements.travel_allowance_minutes.value=row.travel_allowance_minutes || 0;
    form.elements.assigned_truck_equipment_item_id.value=row.assigned_truck_equipment_item_id || '';
    form.elements.assigned_trailer_equipment_item_id.value=row.assigned_trailer_equipment_item_id || '';
    form.elements.recurring_visit_key.value=row.recurring_visit_key || '';
    form.elements.recurrence_label.value=row.recurrence_label || '';
    form.elements.workability_state.value=row.workability_state || 'not_assessed';
    form.elements.weather_summary.value=row.weather_summary || '';
    form.elements.workability_note.value=row.workability_note || '';
    form.elements.dispatch_notes.value=row.dispatch_notes || '';
    form.elements.supersedes_dispatch_id.value=row.id || '';
    const crewSelect=form.elements.assigned_crew_profile_ids;
    const crewIds=Array.isArray(row.assigned_crew_profile_ids)?row.assigned_crew_profile_ids.map(String):[];
    if(crewSelect) [...crewSelect.options].forEach((option)=>{ option.selected=crewIds.includes(option.value); });
    const equipmentSelect=form.elements.assigned_equipment_item_ids;
    const equipmentIds=Array.isArray(row.assigned_equipment_item_ids)?row.assigned_equipment_item_ids.map(String):[];
    if(equipmentSelect) [...equipmentSelect.options].forEach((option)=>{ option.selected=equipmentIds.includes(option.value); });
    form.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function handleCrewDispatch(event) {
    event.preventDefault();
    const form=event.currentTarget;
    const data=formData(form);
    const payload={
      action:'dispatch_schedule',
      work_order_id:data.work_order_id,
      schedule_status:data.schedule_status,
      scheduled_start:data.scheduled_start ? new Date(data.scheduled_start).toISOString() : '',
      scheduled_end:data.scheduled_end ? new Date(data.scheduled_end).toISOString() : '',
      crew_id:data.crew_id || null,
      lead_profile_id:data.lead_profile_id || null,
      assigned_supervisor_profile_id:data.assigned_supervisor_profile_id || null,
      assigned_crew_profile_ids:dispatchSelectedValues('#oc_dispatch_crew_members'),
      route_id:data.route_id || null,
      route_order:data.route_order || null,
      estimated_duration_minutes:data.estimated_duration_minutes || null,
      travel_allowance_minutes:data.travel_allowance_minutes || 0,
      assigned_truck_equipment_item_id:data.assigned_truck_equipment_item_id || null,
      assigned_trailer_equipment_item_id:data.assigned_trailer_equipment_item_id || null,
      assigned_equipment_item_ids:dispatchSelectedValues('#oc_dispatch_equipment'),
      recurring_visit_key:data.recurring_visit_key || null,
      recurrence_label:data.recurrence_label || null,
      workability_state:data.workability_state || 'not_assessed',
      weather_summary:data.weather_summary || null,
      workability_note:data.workability_note || null,
      schedule_reason:data.schedule_reason || null,
      reschedule_reason:data.reschedule_reason || null,
      cancellation_reason:data.cancellation_reason || null,
      supersedes_dispatch_id:data.supersedes_dispatch_id || null,
      conflict_override_note:data.conflict_override_note || null,
      dispatch_notes:data.dispatch_notes || null
    };
    await send(payload,`Crew dispatch ${String(data.schedule_status||'scheduled').replaceAll('_',' ')}`);
    resetCrewDispatchForm();
  }

  function renderAttentionQueue() {
    const wrap=byId('oc_attention_queue');
    const resolvedWrap=byId('oc_attention_resolved');
    const meta=queues.operations_attention_meta || {};
    const rows=queues.operations_attention || [];
    const resolved=queues.operations_attention_resolved || [];
    const role=window.YWI_AUTH?.getState?.()?.role || 'employee';
    const canManage=window.YWISecurity?.canViewModule?.('admin',role,'manage') === true;
    const canNavigate=(row)=>window.YWISecurity?.canViewModule?.(row.source_module,role,'view') === true;
    if (wrap) {
      wrap.innerHTML=rows.length ? rows.map((row)=> {
        const nav=canNavigate(row)
          ? `<button type="button" class="secondary oc-row-action" data-oc-action="attention-open" data-id="${esc(row.source_key)}">Open ${esc(row.source_module)}</button>`
          : '<button type="button" class="secondary" disabled title="Source module access is required.">Source restricted</button>';
        const manage=canManage
          ? `${button('Defer','attention-defer',row.source_key,'',true,'operations_attention_defer')}${button('Resolve','attention-resolve',row.source_key,'','', 'operations_attention_resolve')}`
          : '<button type="button" class="secondary" disabled title="Admin manage access is required.">Manage restricted</button>';
        return `<article class="oc-queue-card oc-attention-card" data-priority="${esc(row.priority)}">
          <header><strong>${esc(row.title)}</strong><span class="${statusClass(row.priority)}">${esc(row.priority)}</span></header>
          <dl>
            <div><dt>Source</dt><dd>${esc(row.source_module)} · ${esc(String(row.source_type||'').replaceAll('_',' '))}</dd></div>
            <div><dt>Owner</dt><dd>${esc(row.owner || 'Unassigned')}</dd></div>
            <div><dt>Due</dt><dd>${when(row.due_at)}</dd></div>
            <div><dt>Context</dt><dd>${esc(row.context || '—')}</dd></div>
          </dl>
          <div class="oc-row-actions">${nav}${manage}</div>
        </article>`;
      }).join('') : emptyQueue('Nothing needs attention', 'No visible cross-business source currently meets the Build 320 attention rules.');
      const summary=byId('oc_attention_summary');
      if(summary) summary.textContent=`${Number(meta.total_active || rows.length)} active · ${Number(meta.deferred_count || 0)} deferred · permission filtered`;
    }
    if (resolvedWrap) resolvedWrap.innerHTML=resolved.length ? resolved.map((row)=>`
      <article class="oc-queue-card oc-attention-resolved">
        <header><strong>${esc(row.title)}</strong><span class="${statusClass('resolved')}">resolved</span></header>
        <dl><div><dt>Source</dt><dd>${esc(row.source_module)} · ${esc(String(row.source_type||'').replaceAll('_',' '))}</dd></div><div><dt>Resolved</dt><dd>${when(row.resolved_at)}</dd></div><div><dt>Note</dt><dd>${esc(row.state_note || 'Resolved')}</dd></div></dl>
      </article>`).join('') : emptyQueue('No recently resolved items', 'Resolved Build 320 attention items will remain visible here as management history.');
  }

  function renderQueues() {
    renderRecurringService(); renderCrewDispatch(); renderAttentionQueue(); renderRails(); renderRolePermissions(); renderOperationsHealth(); renderReleaseDashboard(); renderReleaseProof(); renderPaymentQueue(); renderBankQueue(); renderReconQueue(); renderEquipmentQueue(); renderAssetQueue(); renderRouteQueue(); renderQuoteQueue(); renderPortalQueue(); renderLiveUpdateQueue(); renderExecutionProofQueue(); renderCloseoutQueue(); renderCustomerNotificationQueue(); hydrateArApplicationSelects(); hydrateLiveUpdateSelects(); hydrateRecurringSelectors(); hydrateCrewDispatchSelectors(); decoratePermissionControls();
  }
  function hydrateBankSelects() {
    const options = `<option value="">Choose bank account</option>${(queues.banks || []).map((bank) => `<option value="${esc(bank.id)}">${esc(bank.account_name)}${bank.is_default ? ' (default)' : ''}</option>`).join('')}`;
    document.querySelectorAll('[data-oc-bank-select]').forEach((select) => { const current = select.value; select.innerHTML = options; if (current) select.value = current; });
  }

  function hydrateArApplicationSelects() {
    const invoiceOptions = `<option value="">Choose open invoice</option>${(queues.ar_invoices || []).map((row) => `<option value="${esc(row.id)}">${esc(row.invoice_number || row.id)} · ${money(row.balance_due)} open</option>`).join('')}`;
    const paymentOptions = `<option value="">Choose receipt / unapplied cash</option>${(queues.ar_payments || []).map((row) => `<option value="${esc(row.id)}">${esc(row.payment_number || row.reference_number || row.id)} · ${money(row.unapplied_amount ?? row.amount)} available</option>`).join('')}`;
    const depositOptions = `<option value="">Choose paid deposit</option>${(queues.customer_deposits || []).map((row) => `<option value="${esc(row.id)}">${esc(row.payment_reference || row.id)} · ${money(row.paid_amount)} paid</option>`).join('')}`;
    const applyOptions=(selector,html)=>document.querySelectorAll(selector).forEach((select)=>{ const current=select.value; select.innerHTML=html; if(current) select.value=current; });
    applyOptions('[data-oc-ar-invoice-select]',invoiceOptions);
    applyOptions('[data-oc-ar-payment-select]',paymentOptions);
    applyOptions('[data-oc-ar-deposit-select]',depositOptions);
  }
  function buildArApplicationPayload(form) {
    const data=formData(form);
    return {
      application_type:data.application_type,
      invoice_id:data.invoice_id,
      payment_id:data.payment_id,
      deposit_id:data.deposit_id,
      source_reference:data.source_reference,
      application_date:data.application_date,
      amount:Number(data.amount || 0),
      proof_reference:data.proof_reference,
      reason:data.reason
    };
  }
  function invalidateArApplicationPreview() {
    paymentApplicationPreview=null;
    const submit=byId('oc_ar_application_submit'); if(submit) submit.disabled=true;
    const wrap=byId('oc_ar_application_preview'); if(wrap) wrap.innerHTML='<p class="muted">Preview the application to validate customer identity, source balance, invoice balance, date, proof, and open-period status before submitting.</p>';
  }
  function renderArApplicationPreview(preview) {
    const wrap=byId('oc_ar_application_preview'); if(!wrap) return;
    const application=preview?.application || {};
    const validations=preview?.validations || [];
    const failed=validations.filter((item)=>item.status!=='pass');
    wrap.innerHTML=`<article class="oc-recon-review-card"><header><div><span class="operations-kicker">Build 313 server validation</span><h4>${esc(String(application.application_type || 'A/R application').replaceAll('_',' '))}</h4></div><span class="${statusClass(preview?.allowed ? 'approved' : 'blocked')}">${preview?.allowed ? 'ready for review' : 'blocked'}</span></header><div class="oc-recon-math"><div><span>Application amount</span><strong>${money(application.amount)}</strong></div><div><span>Invoice balance</span><strong>${money(application.invoice_balance)}</strong></div><div><span>Source available</span><strong>${money(application.available_amount)}</strong></div><div><span>Posting</span><strong>OFF</strong></div></div><ul class="oc-score-components">${validations.map((item)=>`<li><strong>${item.status==='pass'?'PASS':'BLOCK'}</strong> · ${esc(item.message)}</li>`).join('')}</ul><p class="muted">${failed.length ? 'Correct every blocked check before submitting.' : 'All pre-application checks passed. Submission creates an auditable review request only; it does not post a ledger entry.'}</p></article>`;
    const submit=byId('oc_ar_application_submit'); if(submit) {
      const permissionDenied=capabilityFor('payment_action_request')?.permitted === false;
      submit.disabled=permissionDenied || !preview?.allowed;
      submit.setAttribute('aria-disabled', submit.disabled ? 'true' : 'false');
    }
  }
  async function handleArApplicationPreview() {
    const form=byId('oc_ar_application_form'); if(!form) return;
    const payload=buildArApplicationPayload(form);
    const response=await send({action:'payment_action_request',preview_only:true,...payload},'A/R application validation',false);
    paymentApplicationPreview=response?.preview || null;
    renderArApplicationPreview(paymentApplicationPreview);
    if(paymentApplicationPreview?.allowed) status('A/R application checks passed. Review the evidence, then submit for approval. Ledger posting remains OFF.');
  }
  async function handleArApplication(event) {
    event.preventDefault();
    const form=event.currentTarget;
    if(!paymentApplicationPreview?.allowed) throw new Error('Preview and pass all A/R application checks before submitting.');
    const payload=buildArApplicationPayload(form);
    await send({action:'payment_action_request',idempotency_key:idem('ar_application'),...payload,proof_required:true},'A/R application request');
    form.reset();
    const date=byId('oc_ar_application_date'); if(date) date.value=new Date().toISOString().slice(0,10);
    invalidateArApplicationPreview();
    hydrateArApplicationSelects();
  }

  function hydrateLiveUpdateSelects() {
    const workOrders = (queues.portal || []).filter((row) => row.work_order_id);
    const workOrderOptions = `<option value="">Choose accepted work order</option>${workOrders.map((row) => `<option value="${esc(row.work_order_id)}">${esc(row.work_order_number || 'Work order')} · ${esc(row.client_name || row.client_email || 'Customer')}</option>`).join('')}`;
    document.querySelectorAll('[data-oc-work-order-select]').forEach((select) => {
      const current = select.value; select.innerHTML = workOrderOptions; if (current) select.value = current;
    });
    const approvedAssets = (queues.assets || []).filter((row) => row.asset_status === 'approved' && row.public_url);
    const assetOptions = approvedAssets.map((row) => `<option value="${esc(row.id)}">${esc(short(row.asset_key || row.original_file_name || row.id, 72))} · ${esc(row.route_key || row.image_role || 'approved visual')}</option>`).join('');
    document.querySelectorAll('[data-oc-live-update-assets], [data-oc-closeout-before-assets], [data-oc-closeout-after-assets]').forEach((select) => {
      const selected = new Set([...select.selectedOptions].map((option) => option.value));
      select.innerHTML = assetOptions || '<option value="" disabled>No approved public images are available yet.</option>';
      [...select.options].forEach((option) => { option.selected = selected.has(option.value); });
    });
  }

  function renderBankRows(parsed) {
    const tbody = byId('oc_bank_preview_rows'); const summary = byId('oc_bank_preview_summary');
    if (!tbody || !summary) return;
    summary.textContent = parsed.errors?.length ? parsed.errors.join(' ') : `${parsed.rows.length} row(s) parsed. The first 20 are shown before server validation.`;
    const headers = parsed.headers.slice(0, 5);
    tbody.innerHTML = parsed.rows.slice(0, 20).map((row, index) => `<tr><td>${index + 1}</td>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">No rows parsed.</td></tr>';
    byId('oc_bank_preview_headers').innerHTML = `<tr><th>#</th>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  }

  async function handleLiveUpdate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const assetIds = [...form.querySelectorAll('[data-oc-live-update-assets] option:checked')].map((option) => option.value).filter(Boolean);
    const occurredAt = String(data.occurred_at || '').trim();
    const occurredIso = occurredAt ? new Date(occurredAt).toISOString() : null;
    if (occurredAt && Number.isNaN(new Date(occurredAt).valueOf())) throw new Error('Choose a valid update time.');
    const notificationRequested = form.elements.customer_notification_requested?.checked === true;
    const response = await send({
      action:'work_order_live_update_create',
      idempotency_key:idem('work_update'),
      work_order_id:data.work_order_id,
      visibility:data.visibility,
      update_type:data.update_type,
      title:data.title,
      message:data.message,
      occurred_at:occurredIso,
      progress_percent:data.progress_percent === '' ? null : Number(data.progress_percent),
      asset_ids:assetIds,
      customer_notification_requested:notificationRequested
    }, data.visibility === 'customer' ? 'Customer-visible live work update' : 'Staff-only live work update');
    const notification = response?.notification;
    if (notificationRequested && notification?.status === 'pending_consent') {
      status('Update published. E-mail was not queued because the customer has not opted in through the secure portal.');
    } else if (notificationRequested && notification?.queued) {
      status('Update published and customer e-mail is queued for protected delivery.');
    } else if (notificationRequested && notification?.message) {
      status(notification.message);
    }
    form.reset();
    hydrateLiveUpdateSelects();
  }


  async function handleExecutionProof(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const assetIds = [...form.querySelectorAll('[data-oc-live-update-assets] option:checked')].map((option) => option.value).filter(Boolean);
    const occurredAt = String(data.occurred_at || '').trim();
    const occurredIso = occurredAt ? new Date(occurredAt).toISOString() : null;
    if (occurredAt && Number.isNaN(new Date(occurredAt).valueOf())) throw new Error('Choose a valid proof time.');
    await send({
      action:'work_order_execution_proof_submit',
      idempotency_key:idem('execution_proof'),
      work_order_id:data.work_order_id,
      proof_type:data.proof_type,
      title:data.title,
      staff_notes:data.staff_notes,
      customer_summary:data.customer_summary,
      customer_visible:form.elements.customer_visible?.checked === true,
      occurred_at:occurredIso,
      progress_percent:data.progress_percent === '' ? null : Number(data.progress_percent),
      asset_ids:assetIds,
      labour_minutes:Number(data.labour_minutes || 0),
      labour_hourly_rate:Number(data.labour_hourly_rate || 0),
      material_cost_total:Number(data.material_cost_total || 0),
      equipment_cost_total:Number(data.equipment_cost_total || 0),
      other_cost_total:Number(data.other_cost_total || 0)
    }, 'Service-execution proof capture');
    form.reset();
    hydrateLiveUpdateSelects();
  }

  async function handleCloseout(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const beforeAssetIds = [...form.querySelectorAll('[data-oc-closeout-before-assets] option:checked')].map((option) => option.value).filter(Boolean);
    const afterAssetIds = [...form.querySelectorAll('[data-oc-closeout-after-assets] option:checked')].map((option) => option.value).filter(Boolean);
    await send({
      action:'work_order_closeout_submit',
      idempotency_key:idem('closeout'),
      work_order_id:data.work_order_id,
      customer_summary:data.customer_summary,
      staff_closeout_notes:data.staff_closeout_notes,
      invoice_ready_requested:form.elements.invoice_ready_requested?.checked === true,
      review_request_requested:form.elements.review_request_requested?.checked === true,
      maintenance_followup_due_at:data.maintenance_followup_due_at || null,
      before_asset_ids:beforeAssetIds,
      after_asset_ids:afterAssetIds
    }, 'Supervisor closeout package');
    form.reset();
    hydrateLiveUpdateSelects();
  }

  async function handlePayment(event) {
    event.preventDefault(); const data = formData(event.currentTarget);
    await send({ action:'payment_action_request', idempotency_key:idem('payment'), action_type:data.action_type, ledger_side:data.ledger_side, bank_account_id:data.bank_account_id, transaction_date:data.transaction_date, customer_or_vendor_name:data.customer_or_vendor_name, invoice_reference:data.invoice_reference, payment_reference:data.payment_reference, reversal_of_request_id:data.reversal_of_request_id, amount:Number(data.amount || 0), reason:data.reason, proof_required:true, proof_reference:data.proof_reference }, 'Payment action request');
    event.currentTarget.reset(); byId('oc_payment_date').value = new Date().toISOString().slice(0,10); saveDraft();
  }
  async function handleBankPreview(event) {
    event.preventDefault(); const file = byId('oc_bank_file')?.files?.[0]; if (!file) throw new Error('Choose a CSV file first.');
    const parsed = window.YWIAPI?.parseBankCsvPreviewText?.(await file.text(), 2500);
    if (!parsed || parsed.errors?.length) throw new Error(parsed?.errors?.join(' ') || 'CSV parsing failed.');
    renderBankRows(parsed);
    const response = await send({ action:'bank_csv_preview', idempotency_key:idem('bank'), original_filename:file.name, bank_account_id:byId('oc_bank_account')?.value || '', bank_account_hint:byId('oc_bank_account_hint')?.value || '', headers:parsed.headers, rows:parsed.rows }, 'Bank CSV preview');
    byId('oc_bank_import_id').value = response?.batch?.id || '';
    byId('oc_bank_server_summary').textContent = `Accepted ${response?.summary?.accepted || 0}; rejected ${response?.summary?.rejected || 0}; possible duplicates ${response?.summary?.duplicates || 0}.`;
  }
  async function handleBankConfirm(importId = '') {
    const id = importId || byId('oc_bank_import_id')?.value?.trim(); if (!id) throw new Error('Create or select a bank preview before confirming it.');
    await send({ action:'bank_csv_confirm_import', import_id:id, bank_account_id:byId('oc_bank_account')?.value || '', confirmation_note:byId('oc_bank_confirmation_note')?.value || '' }, 'Bank CSV promotion');
  }
  async function handleReconciliation(event) {
    event.preventDefault(); const data = formData(event.currentTarget); let splitRows = [];
    if (String(data.split_rows || '').trim()) { try { splitRows = JSON.parse(String(data.split_rows)); } catch { throw new Error('Split rows must be valid JSON.'); } }
    if (selectedReconSuggestion && selectedReconSuggestion.actionable === false && ['match','split'].includes(String(data.action_type || ''))) {
      throw new Error('This ranked suggestion is review-only. Partial and many-to-one candidates cannot be auto-applied.');
    }
    const selected = selectedReconSuggestion?.actionable ? selectedReconSuggestion : null;
    const response = await send({
      action:'reconciliation_action', idempotency_key:idem('recon'), action_type:data.action_type, import_id:data.import_id,
      bank_row_id:data.bank_row_id, target_reference:data.target_reference, target_type:selected?.type || undefined,
      target_id:selected?.target_id || undefined, match_score:selected?.explanation?.score ?? undefined,
      match_explanation:selected?.explanation || undefined, suggestion_context:selected ? {
        build:312, rank:selected.rank, match_mode:selected.match_mode, confidence_band:selected.confidence_band,
        requires_human_confirmation:true, partial:selected.partial === true
      } : undefined,
      undo_of_action_id:data.undo_of_action_id, split_rows:splitRows, signoff_note:data.signoff_note
    }, 'Reconciliation action');
    selectedReconItemId = data.bank_row_id || selectedReconItemId;
    selectedReconSuggestion = null;
    byId('oc_recon_explanation').textContent = response?.match_explanation?.summary || 'Reconciliation action recorded.';
    renderReconciliationReview(selectedReconItemId);
  }
  async function handleReconException(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const resolved = String(data.resolution_status || 'open') === 'resolved';
    if (resolved && String(data.resolution_reason || '').trim().length < 8) throw new Error('Resolved exceptions require a clear resolution reason of at least 8 characters.');
    await send({
      action:'reconciliation_action',
      idempotency_key:idem('recon-exception'),
      action_type:resolved ? 'exception_resolve' : 'exception_update',
      bank_row_id:data.bank_row_id,
      exception_severity:data.exception_severity,
      exception_category:data.exception_category,
      owner_profile_id:data.owner_profile_id || undefined,
      evidence_reference:data.evidence_reference,
      resolution_reason:data.resolution_reason
    }, resolved ? 'Reconciliation exception resolution' : 'Reconciliation exception ownership');
    selectedReconItemId = data.bank_row_id || selectedReconItemId;
  }

  async function handleEquipment(event) {
    event.preventDefault(); const data = formData(event.currentTarget);
    const response = await send({ action:'equipment_scan_event', idempotency_key:idem('equipment'), scan_code:data.scan_code, scan_source:data.scan_source || 'manual', scan_stage:data.scan_stage, custody_stage:data.scan_stage, equipment_reference:data.equipment_reference || data.scan_code, job_reference:data.job_reference, condition_summary:data.condition_summary, accessory_summary:data.accessory_summary, signer_name:data.signer_name, service_required:event.currentTarget.elements.service_required.checked, cost_recovery_required:event.currentTarget.elements.cost_recovery_required.checked, customer_billable:event.currentTarget.elements.customer_billable.checked, estimated_cost:Number(data.estimated_cost || 0), notes:data.notes }, 'Equipment custody event');
    byId('oc_equipment_resolution').textContent = response?.resolution?.status === 'resolved' ? `Resolved to ${response.resolution.equipment} (${response.resolution.equipment_status}).${response.service_task ? ' Service task created.' : ''}` : 'Code was recorded but did not match an equipment record; review it in the queue.';
  }

  async function imageToBlob(file, maxWidth, maxHeight, quality = 0.82) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:false }); ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close?.();
    const mime = 'image/webp';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error('Browser image compression failed.');
    return { blob, width, height, mime };
  }
  async function handleAsset(event) {
    event.preventDefault(); const data = formData(event.currentTarget); const file = byId('oc_asset_file')?.files?.[0];
    if (!file) {
      await send({ action:'visual_asset_register', asset_status:data.asset_status, surface_area:data.surface_area, image_role:data.image_role, source_url:data.source_url, public_url:data.source_url, alt_text:data.alt_text, consent_status:data.consent_status, compression_status:data.compression_status, route_key:data.route_key, placeholder_selector:data.placeholder_selector, pixel_width:Number(data.pixel_width || 0), pixel_height:Number(data.pixel_height || 0), notes:data.notes }, 'Visual asset registration');
      return;
    }
    const progress = byId('oc_asset_progress'); progress.hidden = false; progress.value = 10; status('Reading and optimizing image…');
    const optimized = await imageToBlob(file, 2200, 2200, 0.82); progress.value = 45;
    const thumbnail = await imageToBlob(file, 520, 520, 0.78); progress.value = 65;
    const optimizedFile = new File([optimized.blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type:optimized.mime });
    const thumbnailFile = new File([thumbnail.blob], `${file.name.replace(/\.[^.]+$/, '')}-thumb.webp`, { type:thumbnail.mime });
    const upload = new FormData(); upload.set('file', optimizedFile); upload.set('thumbnail', thumbnailFile); upload.set('original_file_name', file.name);
    upload.set('pixel_width', String(optimized.width)); upload.set('pixel_height', String(optimized.height)); upload.set('thumbnail_width', String(thumbnail.width)); upload.set('thumbnail_height', String(thumbnail.height));
    ['surface_area','image_role','alt_text','consent_status','route_key','placeholder_selector','notes'].forEach((key) => upload.set(key, String(data[key] || '')));
    status('Uploading optimized image and thumbnail…'); progress.value = 80;
    const response = await window.YWIAPI.uploadPublicAsset(upload); progress.value = 100;
    status(`Image uploaded at ${optimized.width}×${optimized.height}; ${Math.round(optimized.blob.size / 1024)} KB. It is awaiting approval.`);
    const publicPreview = response?.record?.thumbnail_url || response?.record?.public_url;
    byId('oc_asset_preview').innerHTML = publicPreview ? `<img src="${esc(publicPreview)}" alt="" /><span>${esc(response?.record?.asset_key || '')}</span>` : `<span class="oc-private-media">Private review upload saved. Approve it to create the public replacement.</span>`;
    await loadQueues(true); setTimeout(() => { progress.hidden = true; }, 1200);
  }

  function routeReadiness() {
    const title = byId('oc_route_title')?.value.trim() || ''; const h1 = byId('oc_route_h1')?.value.trim() || ''; const meta = byId('oc_route_meta')?.value.trim() || ''; const proof = byId('oc_route_proof')?.value.trim() || ''; const cta = byId('oc_route_cta')?.value.trim() || ''; const path = byId('oc_route_path')?.value.trim() || '';
    const checks = [title.length >= 20 && title.length <= 70, h1.length >= 10 && h1.length <= 120, meta.length >= 70 && meta.length <= 170, proof.length >= 20, cta.startsWith('/') || cta.startsWith('#'), path === '/' || /^\/[a-z0-9][a-z0-9\/-]*$/.test(path)];
    const score = Math.round(checks.filter(Boolean).length / checks.length * 100); const el = byId('oc_route_score'); if (el) { el.textContent = `${score}% ready`; el.dataset.score = String(score); } return score;
  }
  async function handleRoute(event) {
    event.preventDefault(); const data = formData(event.currentTarget);
    await send({ action:'public_route_register', route_key:data.route_key, route_status:data.route_status, route_type:data.route_type, route_path:data.route_path, service_name:data.service_name, location_name:data.location_name, page_title:data.page_title, h1_text:data.h1_text, meta_description:data.meta_description, page_intro:data.page_intro, page_body_markdown:data.page_body_markdown, local_proof_hint:data.local_proof_hint, primary_cta_path:data.primary_cta_path, visual_asset_key:data.visual_asset_key, canonical_url:data.canonical_url, sitemap_ready:routeReadiness() === 100 }, 'Public route registration');
  }

  async function stopCamera() {
    if (scanTimer) cancelAnimationFrame(scanTimer); scanTimer = null; cameraStream?.getTracks?.().forEach((track) => track.stop()); cameraStream = null;
    const video = byId('oc_scan_video'); if (video) { video.srcObject = null; video.hidden = true; }
  }
  async function startCamera() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { status('Camera scanning is not supported in this browser. Use manual code entry.', true); byId('oc_scan_code')?.focus(); return; }
    await stopCamera(); cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    const video = byId('oc_scan_video'); video.hidden = false; video.srcObject = cameraStream; await video.play();
    const detector = new BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e'] });
    const scan = async () => { if (!cameraStream) return; try { const codes = await detector.detect(video); if (codes?.[0]?.rawValue) { byId('oc_scan_code').value = codes[0].rawValue; byId('oc_scan_source').value = 'camera'; status(`Scanned ${codes[0].rawValue}. Review and save.`); await stopCamera(); return; } } catch {} scanTimer = requestAnimationFrame(scan); }; scan();
  }

  async function handleRowAction(buttonEl) {
    const action = buttonEl.dataset.ocAction; const id = buttonEl.dataset.id;
    if (!action || !id || buttonEl.disabled) return;
    if (action === 'attention-open') {
      const row=(queues.operations_attention || []).find((item)=>String(item.source_key)===String(id));
      if (!row) return;
      const role=window.YWI_AUTH?.getState?.()?.role || 'employee';
      if (window.YWISecurity?.canViewModule?.(row.source_module,role,'view') !== true) {
        status('Source module access is required to open this attention item.',true); return;
      }
      const target=row.route_hint || window.YWISecurity?.getDefaultSectionForModule?.(row.source_module,role);
      if (target) window.YWIRouter?.showSection?.(target);
      return;
    }
    if (action === 'attention-defer' || action === 'attention-resolve') {
      const row=(queues.operations_attention || []).find((item)=>String(item.source_key)===String(id));
      if (!row) return;
      const isResolve=action === 'attention-resolve';
      const note=prompt(isResolve ? 'Resolution note:' : 'Defer note (optional):') || '';
      if (isResolve && note.trim().length < 3) return;
      let deferredUntil=null;
      if (!isResolve) {
        const suggested=new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10);
        const dateText=prompt('Defer until (YYYY-MM-DD):',suggested) || '';
        if(!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return;
        deferredUntil=new Date(`${dateText}T23:59:59`).toISOString();
      }
      await send({
        action:isResolve ? 'operations_attention_resolve' : 'operations_attention_defer',
        source_key:row.source_key, source_module:row.source_module, source_type:row.source_type, source_id:row.source_id,
        source_title:row.title, source_context:row.context, source_priority:row.priority, source_due_at:row.due_at,
        deferred_until:deferredUntil, note:note.trim()
      },isResolve ? 'Resolving attention item' : 'Deferring attention item');
      return;
    }

    if (action.startsWith('payment-')) {
      const decision = action.split('-')[1]; const note = ['reject','cancel'].includes(decision) ? prompt('Decision note (required):') : '';
      if (['reject','cancel'].includes(decision) && !note) return;
      await send({ action:'payment_action_decision', request_id:id, decision, decision_note:note || '' }, `Payment ${decision}`); return;
    }
    if (action === 'bank-promote') { await handleBankConfirm(id); return; }
    if (action === 'bank-use-session') { byId('oc_recon_import_id').value = id; byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if (action === 'recon-review') { selectedReconItemId = id; renderReconciliationReview(id); byId('oc_recon_review')?.scrollIntoView({ behavior:'smooth', block:'nearest' }); return; }
    if (action === 'recon-use') { selectedReconItemId = id; byId('oc_recon_row_id').value = id; byId('oc_recon_action').value = 'match'; renderReconciliationReview(id); byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if (action === 'recon-suggest') {
      const response = await send({ action:'reconciliation_suggest', bank_row_id:id }, 'Finding reconciliation matches', false);
      reconciliationSuggestions = response?.suggestions || [];
      selectedReconSuggestion = null;
      selectedReconItemId = id;
      byId('oc_recon_row_id').value = id;
      renderReconciliationReview(id);
      byId('oc_recon_suggestions').innerHTML = reconciliationSuggestions.length ? reconciliationSuggestions.map((item,index) => {
        const mode = String(item.match_mode || 'one_to_one').replaceAll('_',' → ');
        const difference = Number(item?.explanation?.amount_difference || 0);
        const actionLabel = item.actionable ? (item.match_mode === 'one_to_many' ? 'Prepare exact split' : 'Use exact candidate') : 'Review candidate';
        return `<article class="oc-queue-card oc-smart-recon-suggestion" data-confidence="${esc(item.confidence_band || 'low')}">
          <header><strong>#${Number(item.rank || index + 1)} · ${esc(item.reference || 'Candidate')}</strong><span class="${statusClass(item.confidence_band || 'low')}">${esc(item.confidence_band || 'low')} · ${Number(item.explanation?.score || 0)}%</span></header>
          <dl><div><dt>Mode</dt><dd>${esc(mode)}</dd></div><div><dt>Candidate total</dt><dd>${money(item.group_total ?? item.explanation?.target_amount)}</dd></div><div><dt>Difference</dt><dd>${money(difference)}</dd></div><div><dt>Coverage</dt><dd>${Number(item.explanation?.amount_coverage_percent || 0).toFixed(1)}%</dd></div></dl>
          <p>${esc(item.explanation?.summary || '')}</p><small>${esc(item.matching_rule || 'Human confirmation required.')}</small>
          <div class="oc-row-actions"><button type="button" class="secondary oc-suggestion" data-suggestion-index="${index}">${esc(actionLabel)}</button></div>
        </article>`;
      }).join('') : emptyQueue('No close matches', 'Enter a target reference manually or leave the bank row open for research.');
      byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return;
    }
    if (action === 'recon-exception-own' || action === 'recon-exception-resolve') {
      const row = (queues.reconciliation_exceptions || []).find((item) => String(item.id) === String(id)) || (queues.bank_items || []).find((item) => String(item.id) === String(id)) || {};
      const form = byId('oc_recon_exception_form');
      if (!form) return;
      byId('oc_recon_exception_item_id').value = id;
      form.elements.exception_severity.value = row.exception_severity || 'medium';
      form.elements.exception_category.value = row.exception_category || 'manual_accounting_review';
      form.elements.owner_profile_id.value = row.owner_profile_id || '';
      form.elements.resolution_status.value = action === 'recon-exception-resolve' ? 'resolved' : (row.resolution_status || 'open');
      form.elements.evidence_reference.value = row.evidence_reference || row.notes || row.difference_reason || '';
      form.elements.resolution_reason.value = row.resolution_reason || '';
      form.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if (action === 'recon-reject') { const note = prompt('Why should this bank row be treated as an exception?'); if (!note) return; await send({ action:'reconciliation_action', idempotency_key:idem('recon'), action_type:'reject', bank_row_id:id, signoff_note:note }, 'Reconciliation exception'); return; }
    if (action.startsWith('recovery-')) { const decision = action.endsWith('approve') ? 'approve' : 'decline'; const note = prompt(`${decision === 'approve' ? 'Approval' : 'Decline'} note:`) || ''; await send({ action:'equipment_cost_recovery_decision', recovery_id:id, decision, decision_note:note }, `Cost recovery ${decision}`); return; }
    if (action.startsWith('asset-')) { const decision = action.endsWith('approve') ? 'approved' : 'rejected'; const row = (queues.assets || []).find((item) => item.id === id); const note = decision === 'rejected' ? prompt('Asset rejection reason:') : ''; if (decision === 'rejected' && !note) return; await send({ action:'visual_asset_decision', asset_id:id, asset_status:decision, source_url:row?.source_url, public_url:row?.public_url, thumbnail_url:row?.thumbnail_url, alt_text:row?.alt_text, consent_status:row?.consent_status, compression_status:row?.compression_status, route_key:row?.route_key, pixel_width:row?.pixel_width, pixel_height:row?.pixel_height, file_size_bytes:row?.file_size_bytes, mime_type:row?.mime_type, placeholder_selector:row?.placeholder_selector, notes:note || row?.notes }, `Asset ${decision}`); return; }
    if (action.startsWith('route-')) {
      if (action === 'route-publish') { await send({ action:'public_route_publish', route_id:id }, 'Route and sitemap publication'); return; }
      const decision = action.endsWith('approve') ? 'approved' : 'rejected'; const row = (queues.routes || []).find((item) => item.id === id); const note = decision === 'rejected' ? prompt('Route rejection reason:') : ''; if (decision === 'rejected' && !note) return;
      await send({ action:'public_route_decision', route_key:row.route_key, route_status:decision, route_type:row.route_type, route_path:row.route_path, service_name:row.service_name, location_name:row.location_name, page_title:row.page_title, h1_text:row.h1_text, meta_description:row.meta_description, page_intro:row.page_intro, local_proof_hint:row.local_proof_hint, primary_cta_path:row.primary_cta_path, visual_asset_key:row.visual_asset_key, canonical_url:row.canonical_url, rejection_reason:note }, `Route ${decision}`); return;
    }
    if (action === 'quote-assign') {
      const owner = document.querySelector(`[data-owner-for="${CSS.escape(id)}"]`)?.value || ''; const due = document.querySelector(`[data-due-for="${CSS.escape(id)}"]`)?.value || '';
      await send({ action:'quote_owner_assign', request_id:id, assigned_to_profile_id:owner, followup_due_at:due ? new Date(due).toISOString() : null, event_note:'Owner/follow-up updated from Operations Cockpit.' }, 'Quote owner assignment'); return;
    }
    if (action === 'quote-contact') { const note = prompt('Contact or follow-up note:'); if (!note) return; await send({ action:'quote_followup_event', request_id:id, event_type:'contacted', request_status:'contacted', response_status:'responded', event_note:note }, 'Quote contact history'); return; }
    if (action === 'recurring-program-edit') {
      const row=(queues.recurring_service_programs || []).find((item)=>String(item.id)===String(id));
      if(row) loadRecurringProgram(row);
      return;
    }
    if (action.startsWith('recurring-visit-')) {
      const row=(queues.recurring_service_visits || []).find((item)=>String(item.occurrence_key)===String(id));
      if(!row) return;
      const map={
        'recurring-visit-skip':'skip',
        'recurring-visit-weather':'weather_delay',
        'recurring-visit-makeup':'makeup',
        'recurring-visit-hold':'customer_hold',
        'recurring-visit-resume':'resume',
        'recurring-visit-cancel':'cancel_visit'
      };
      const eventType=map[action];
      if(eventType) await recurringVisitEvent(row,eventType);
      return;
    }
    if (action === 'dispatch-load' || action === 'dispatch-now' || action === 'dispatch-cancel') {
      const row=(queues.crew_dispatch_schedule || []).find((item)=>String(item.id)===String(id));
      if(!row) return;
      if(action==='dispatch-load'){ loadDispatchIntoForm(row,'rescheduled'); return; }
      if(action==='dispatch-cancel'){
        const reason=prompt('Cancellation reason (required):') || ''; if(!reason.trim()) return;
        await send({
          action:'dispatch_schedule', work_order_id:row.work_order_id, schedule_status:'cancelled',
          scheduled_start:row.scheduled_start, scheduled_end:row.scheduled_end,
          crew_id:row.crew_id, lead_profile_id:row.lead_profile_id, assigned_supervisor_profile_id:row.assigned_supervisor_profile_id,
          assigned_crew_profile_ids:row.assigned_crew_profile_ids || [], route_id:row.route_id, route_order:row.route_order,
          estimated_duration_minutes:row.estimated_duration_minutes, travel_allowance_minutes:row.travel_allowance_minutes || 0,
          assigned_truck_equipment_item_id:row.assigned_truck_equipment_item_id, assigned_trailer_equipment_item_id:row.assigned_trailer_equipment_item_id,
          assigned_equipment_item_ids:row.assigned_equipment_item_ids || [], recurring_visit_key:row.recurring_visit_key, recurrence_label:row.recurrence_label,
          workability_state:row.workability_state || 'not_assessed', weather_summary:row.weather_summary, workability_note:row.workability_note,
          cancellation_reason:reason.trim(), supersedes_dispatch_id:row.id, dispatch_notes:row.dispatch_notes
        },'Crew dispatch cancellation');
        return;
      }
      if(action==='dispatch-now'){
        if(row.workability_state==='blocked'){ status('This visit is workability-blocked and cannot be dispatched.',true); return; }
        await send({
          action:'dispatch_schedule', work_order_id:row.work_order_id, schedule_status:'dispatched',
          scheduled_start:row.scheduled_start, scheduled_end:row.scheduled_end,
          crew_id:row.crew_id, lead_profile_id:row.lead_profile_id, assigned_supervisor_profile_id:row.assigned_supervisor_profile_id,
          assigned_crew_profile_ids:row.assigned_crew_profile_ids || [], route_id:row.route_id, route_order:row.route_order,
          estimated_duration_minutes:row.estimated_duration_minutes, travel_allowance_minutes:row.travel_allowance_minutes || 0,
          assigned_truck_equipment_item_id:row.assigned_truck_equipment_item_id, assigned_trailer_equipment_item_id:row.assigned_trailer_equipment_item_id,
          assigned_equipment_item_ids:row.assigned_equipment_item_ids || [], recurring_visit_key:row.recurring_visit_key, recurrence_label:row.recurrence_label,
          workability_state:row.workability_state || 'not_assessed', weather_summary:row.weather_summary, workability_note:row.workability_note,
          schedule_reason:'Dispatched from Crew Scheduling & Dispatch board.', supersedes_dispatch_id:row.id,
          conflict_override_note:row.conflict_override_note || null, dispatch_notes:row.dispatch_notes
        },'Crew dispatch activation');
        return;
      }
    }
    if (action === 'portal-dispatch') {
      resetCrewDispatchForm();
      const form=byId('oc_crew_dispatch_form');
      if(form){
        form.elements.work_order_id.value=id;
        form.scrollIntoView({behavior:'smooth',block:'start'});
        status('Work order loaded into Build 321 Crew Scheduling & Dispatch. Add crew, timing, route, equipment and workability before saving.');
      }
      return;
    }
    if (action === 'webhook-ack' || action === 'webhook-resolve') { const decision = action === 'webhook-ack' ? 'acknowledged' : 'resolved'; await send({ action:'stripe_webhook_alert_decision', alert_id:id, alert_status:decision }, `Webhook alert ${decision}`); return; }
    if (action === 'signal-review' || action === 'signal-actioned') { const decision = action === 'signal-review' ? 'review' : 'actioned'; const note = prompt(decision === 'actioned' ? 'What change was made or scheduled?' : 'Review note (optional):') || ''; await send({ action:'content_signal_decision', observation_id:id, decision_status:decision, decision_note:note }, `Route signal marked ${decision}`); return; }
    if (action === 'execution-proof-approve' || action === 'execution-proof-reject') { const decision = action.endsWith('approve') ? 'approve' : 'reject'; const note = prompt(decision === 'approve' ? 'Approval note (optional):' : 'Why is this proof rejected?'); if (decision === 'reject' && !note) return; await send({ action:'work_order_execution_proof_decision', execution_proof_id:id, decision, decision_note:note || '' }, `Execution proof ${decision}`); return; }
    if (action.startsWith('closeout-')) { const map = { 'closeout-approve':'approve', 'closeout-reject':'reject', 'closeout-rework':'rework', 'closeout-invoice':'invoice_ready' }; const decision = map[action] || 'approve'; const promptText = decision === 'approve' ? 'Approval note (optional):' : decision === 'invoice_ready' ? 'Invoice readiness note (optional):' : 'Reason required:'; const note = prompt(promptText) || ''; if ((decision === 'reject' || decision === 'rework') && !note) return; await send({ action:'work_order_closeout_decision', closeout_package_id:id, decision, decision_note:note }, `Closeout ${decision.replace('_',' ')}`); return; }
    if (action === 'customer-notification-retry') { const note = prompt('Why is this e-mail safe to retry? This note remains staff-only.'); if (!note) return; await send({ action:'customer_notification_retry', outbox_id:id, retry_note:note }, 'Re-queuing customer e-mail'); return; }
    if (action === 'job-update-retract') { const reason = prompt('Why should this live update be retracted?'); if (!reason) return; await send({ action:'work_order_live_update_retract', live_update_id:id, retraction_reason:reason }, 'Live work update retraction'); return; }
    if (action === 'deposit-paid') { status('Deposit status is webhook-controlled. Use Stripe test checkout and confirm the verified webhook health card updates.', true); return; }
    if (action === 'job-cost-refresh') { await send({ action:'job_cost_refresh', job_id:Number(id) }, 'Live job-cost refresh'); }
  }

  function panelHtml() {
    const todayValue = new Date().toISOString().slice(0,10);
    return `<section id="operationsCockpit" class="operations-cockpit admin-panel-block" data-admin-panel-title="Operations Cockpit" aria-labelledby="oc_title">
      <div class="section-heading operations-cockpit-heading"><div><span class="operations-kicker">Schema 159 module-gated field proof and customer update controls</span><h3 id="oc_title">Operations Cockpit</h3><p class="section-subtitle">Approve, post, reconcile, resolve, publish, schedule, and share deliberately customer-visible work progress from desktop or mobile. Failed writes keep one local retry copy.</p></div><div class="section-graphic-placeholder operations-graphic"><span aria-hidden="true">⌁</span><strong>Live workflow control</strong><small>Replace with an approved dashboard/workshop photograph after consent and image review.</small></div></div>
      <div id="oc_status" class="operations-status" hidden aria-live="polite"></div>
      <div id="oc_retry_wrap" class="operations-retry" hidden><span id="oc_retry_text"></span><button id="oc_retry_btn" type="button">Retry saved action</button><button id="oc_retry_clear" class="secondary" type="button">Discard retry</button></div>
      <div class="operations-toolbar"><button id="oc_refresh" type="button">Refresh all live queues</button><span>Build ${BUILD}</span></div>
      <div id="oc_scorecards" class="operations-scorecards" aria-label="Implementation progress"></div><section id="oc_role_permissions" class="oc-permission-strip" aria-label="Role capability checklist"></section><section class="oc-health-grid" aria-label="Payment and release health"><div id="oc_stripe_health" class="oc-health-list"></div><div id="oc_export_readiness" class="oc-export-readiness"></div></section><section id="oc_release_dashboard" class="oc-release-dashboard" aria-label="Release readiness dashboard"></section>
      <div class="operations-grid">
        <details open class="operations-recurring-panel"><summary>Recurring Lawn &amp; Yard Maintenance</summary>
          <p class="muted">Build 322 extends the canonical recurring-service agreement and existing service-execution scheduler. Weekly, biweekly, custom-day and seasonal programs generate auditable visit dates; skips, weather delays, make-up visits, customer holds/resumes and single-visit cancellations are recorded as private Jobs evidence rather than overwriting history.</p>
          <div class="finance-module-note"><strong id="oc_recurring_summary">Loading recurring programs…</strong> · Finance posting and payment-provider mutation remain off.</div>
          <form id="oc_recurring_program_form" class="operations-form">
            <input type="hidden" name="id" />
            <label>Agreement code<input name="agreement_code" maxlength="80" placeholder="Auto-generated if blank" /></label>
            <label>Program status<select name="agreement_status"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused / customer hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Service name<input name="service_name" maxlength="180" required placeholder="Example: Weekly mowing" /></label>
            <label>Program type<select name="service_program_type"><option value="mowing">Mowing</option><option value="garden_bed_maintenance">Garden / bed maintenance</option><option value="hedge_shrub_trimming">Hedge / shrub trimming</option><option value="spring_cleanup">Spring cleanup</option><option value="fall_cleanup">Fall cleanup</option><option value="aeration">Aeration</option><option value="fertilizing">Fertilizing</option><option value="seasonal_program">Other seasonal program</option><option value="other">Other</option></select></label>
            <label>Customer<select name="client_id" data-oc-recurring-client><option value="">Loading customers…</option></select></label>
            <label>Property<select name="client_site_id" data-oc-recurring-site><option value="">Loading properties…</option></select></label>
            <label>Default crew<select name="crew_id" data-oc-recurring-crew><option value="">Loading crews…</option></select></label>
            <label>Default route<select name="route_id" data-oc-recurring-route><option value="">Loading routes…</option></select></label>
            <label>Billing method<select name="billing_method"><option value="per_visit">Per visit</option><option value="flat_period">Flat period</option><option value="seasonal">Seasonal</option><option value="time_and_material">Time &amp; material</option></select></label>
            <label>Recurrence<select name="recurrence_frequency"><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="custom_days">Custom days</option><option value="seasonal_once">Seasonal once</option><option value="manual">Manual</option></select></label>
            <label>Interval multiplier<input name="recurrence_interval" type="number" min="1" max="52" value="1" /></label>
            <label>Custom interval days<input name="custom_interval_days" type="number" min="1" max="366" placeholder="Required for Custom days" /></label>
            <label>Preferred weekday<select name="preferred_weekday"><option value="">Use anchor date</option><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>
            <label>Recurrence anchor<input name="recurrence_anchor_date" type="date" /></label>
            <label>Agreement start<input name="start_date" type="date" /></label>
            <label>Agreement end<input name="end_date" type="date" /></label>
            <label class="operations-inline-check"><input name="open_end_date" type="checkbox" /> Open-ended agreement</label>
            <label>Service window start<input name="service_window_start" type="time" /></label>
            <label>Service window end<input name="service_window_end" type="time" /></label>
            <label>Season start month<input name="season_start_month" type="number" min="1" max="12" /></label>
            <label>Season start day<input name="season_start_day" type="number" min="1" max="31" /></label>
            <label>Season end month<input name="season_end_month" type="number" min="1" max="12" /></label>
            <label>Season end day<input name="season_end_day" type="number" min="1" max="31" /></label>
            <label>Estimated visit minutes<input name="visit_estimated_minutes" type="number" min="1" max="1440" /></label>
            <label>Travel allowance minutes<input name="default_travel_allowance_minutes" type="number" min="0" max="720" value="0" /></label>
            <label>Weather delay policy<select name="weather_delay_policy"><option value="manual">Manual decision</option><option value="next_available">Next available</option><option value="fixed_days">Fixed-day make-up</option></select></label>
            <label>Default weather make-up days<input name="weather_makeup_days" type="number" min="0" max="30" value="1" /></label>
            <label class="operations-inline-check"><input name="auto_create_session_candidates" type="checkbox" checked /> Feed generated visits to existing service scheduler</label>
            <label>Customer hold until<input name="customer_hold_until" type="date" /></label>
            <label class="operations-span">Customer hold reason<textarea name="customer_hold_reason" maxlength="1000"></textarea></label>
            <label class="operations-span">Pause / hold reason<textarea name="pause_reason" maxlength="1000" placeholder="Required when status is Paused"></textarea></label>
            <label class="operations-span">Cancellation reason<textarea name="cancellation_reason" maxlength="1000" placeholder="Required when status is Cancelled"></textarea></label>
            <label class="operations-span">Service notes<textarea name="service_notes" maxlength="2000"></textarea></label>
            <button type="submit" data-oc-permission="recurring_service_program_save">Save recurring program</button>
            <button id="oc_recurring_reset" type="button" class="secondary">Clear form</button>
          </form>
          <h4>Programs</h4><div id="oc_recurring_programs" class="oc-live-queue"></div>
          <h4>Upcoming generated visits</h4><div id="oc_recurring_visits" class="oc-live-queue"></div>
        </details>
        <details open class="operations-dispatch-panel"><summary>Crew Scheduling &amp; Dispatch</summary>
          <p class="muted">Build 321 extends the canonical Jobs dispatch record with crew composition, lead/supervisor, employee, truck/trailer/equipment, property, recurring-visit, duration/travel, route-order and workability evidence. Conflicting resource assignments require an explicit management override note; blocked workability can never be dispatched.</p>
          <div class="operations-toolbar"><label>Board start<input id="oc_dispatch_board_date" type="date" value="${todayValue}" /></label><label>View<select id="oc_dispatch_board_mode"><option value="week">7-day</option><option value="day">Daily</option></select></label><strong id="oc_dispatch_board_summary">Loading scheduler…</strong></div>
          <form id="oc_crew_dispatch_form" class="operations-form">
            <input type="hidden" name="supersedes_dispatch_id" />
            <label>Work order<select name="work_order_id" data-oc-dispatch-work-order required><option value="">Loading work orders…</option></select></label>
            <label>Status<select name="schedule_status"><option value="scheduled">Scheduled</option><option value="dispatched">Dispatch now</option><option value="rescheduled">Rescheduled</option><option value="cancelled">Cancelled</option></select></label>
            <label>Start<input name="scheduled_start" type="datetime-local" required /></label>
            <label>End<input name="scheduled_end" type="datetime-local" required /></label>
            <label>Crew<select name="crew_id" data-oc-dispatch-crew><option value="">No named crew</option></select></label>
            <label>Lead<select name="lead_profile_id" data-oc-dispatch-lead><option value="">Use crew/default</option></select></label>
            <label>Supervisor<select name="assigned_supervisor_profile_id" data-oc-dispatch-supervisor><option value="">Use crew/default</option></select></label>
            <label class="operations-span">Crew members<select id="oc_dispatch_crew_members" name="assigned_crew_profile_ids" multiple size="5"></select><small>Named crew membership is loaded automatically and may be adjusted for this visit.</small></label>
            <label>Route<select name="route_id" data-oc-dispatch-route><option value="">Use work-order/default route</option></select></label>
            <label>Route order<input name="route_order" type="number" min="1" max="999" step="1" /></label>
            <label>Estimated duration (min)<input name="estimated_duration_minutes" type="number" min="1" max="1440" step="1" /></label>
            <label>Travel allowance (min)<input name="travel_allowance_minutes" type="number" min="0" max="720" step="1" value="0" /></label>
            <label>Truck / vehicle<select name="assigned_truck_equipment_item_id" data-oc-dispatch-truck><option value="">None</option></select></label>
            <label>Trailer<select name="assigned_trailer_equipment_item_id" data-oc-dispatch-trailer><option value="">None</option></select></label>
            <label class="operations-span">Other equipment<select id="oc_dispatch_equipment" name="assigned_equipment_item_ids" data-oc-dispatch-equipment multiple size="5"></select><small>Locked-out and unavailable assets are excluded and also rejected by the server.</small></label>
            <label>Recurring visit key<input name="recurring_visit_key" maxlength="180" placeholder="Optional stable program/visit key" /></label>
            <label>Recurrence label<input name="recurrence_label" maxlength="180" placeholder="Example: Weekly mowing" /></label>
            <label>Workability<select name="workability_state"><option value="not_assessed">Not assessed</option><option value="workable">Workable</option><option value="caution">Caution</option><option value="delayed">Delayed</option><option value="blocked">Blocked</option></select></label>
            <label>Weather / field summary<input name="weather_summary" maxlength="500" placeholder="Observed/forecast context; supervisor retains decision authority" /></label>
            <label class="operations-span">Workability note<textarea name="workability_note" maxlength="1000" placeholder="Ground, access, heat/wind/rain or other workability context."></textarea></label>
            <label class="operations-span">Schedule reason<textarea name="schedule_reason" maxlength="1000" placeholder="Why this timing/crew/route was chosen."></textarea></label>
            <label class="operations-span">Reschedule reason<textarea name="reschedule_reason" maxlength="1000" placeholder="Required only when status is Rescheduled."></textarea></label>
            <label class="operations-span">Cancellation reason<textarea name="cancellation_reason" maxlength="1000" placeholder="Required only when status is Cancelled."></textarea></label>
            <label class="operations-span">Conflict override note<textarea name="conflict_override_note" maxlength="1200" placeholder="Required only if intentionally overriding an overlapping crew/person/equipment assignment."></textarea></label>
            <label class="operations-span">Dispatch notes<textarea name="dispatch_notes" maxlength="1500"></textarea></label>
            <button type="submit" data-oc-permission="dispatch_schedule">Save crew dispatch</button>
            <button id="oc_dispatch_reset" type="button" class="secondary">Clear form</button>
          </form>
          <div id="oc_crew_dispatch_board"></div>
        </details>
        <details open class="operations-attention-panel"><summary>Operations Needs Attention</summary><p class="muted">Build 320 prioritizes overdue/unassigned Jobs, customer follow-up, Equipment defects and maintenance, Safety/training, time-entry issues, completed-not-invoiced work, overdue receivables and Finance reconciliation exceptions. Source records remain authoritative.</p><div class="finance-module-note"><strong id="oc_attention_summary">Loading attention summary…</strong> · Defer/resolve changes management disposition only; it never edits the source business record.</div><div id="oc_attention_queue" class="oc-live-queue"></div><h4>Recently resolved</h4><div id="oc_attention_resolved" class="oc-live-queue"></div></details>
        <details open><summary>Quote owners, alerts, and follow-up</summary><p class="muted">Assign each request, set a due time, and preserve every contact event.</p><div id="oc_quote_queue" class="oc-live-queue"></div></details>
        <details open><summary>Live job updates: staff-only or customer-visible</summary><p class="muted">Site leaders may save staff-only updates. Customer-visible updates require a supervisor, show only in the secure portal, and can attach only approved public images. This does not send a payment, publish a public web page, or expose staff notes.</p><form id="oc_live_update_form" class="operations-form"><label>Work order<select name="work_order_id" data-oc-work-order-select required><option value="">Loading accepted work orders…</option></select></label><label>Visibility<select name="visibility"><option value="staff">Staff only</option><option value="customer">Customer visible (supervisor)</option></select></label><label>Update type<select name="update_type"><option value="arrival">Arrival</option><option value="progress" selected>Progress</option><option value="delay">Timing update</option><option value="access">Access/site update</option><option value="completion">Completion</option><option value="note">Service note</option></select></label><label>Progress %<input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="Optional" /></label><label>When<input name="occurred_at" type="datetime-local" /></label><label class="operations-span">Update title<input name="title" maxlength="180" minlength="3" required placeholder="Example: Crew arrived and site walk-through started" /></label><label class="operations-span">Customer-safe message<textarea name="message" maxlength="4000" placeholder="Use plain language. Do not include private staff, costing, or access-code information in customer-visible updates."></textarea></label><label class="operations-span">Approved public images (optional)<select name="asset_ids" data-oc-live-update-assets multiple size="4" aria-describedby="oc_live_update_asset_help"></select><small id="oc_live_update_asset_help">Only approved public images are available here. Private review images and staff-only notes cannot be shown to customers.</small></label><label class="operations-inline-check operations-span"><input name="customer_notification_requested" type="checkbox" /> Queue a consent-controlled customer e-mail when the customer has opted in</label><button type="submit" data-oc-permission="work_order_live_update">Save live update</button></form><h4>Live update history</h4><div id="oc_live_updates_queue" class="oc-live-queue"></div><h4>Customer e-mail delivery</h4><div id="oc_customer_notification_queue" class="oc-live-queue"></div></details>
        <details open><summary>Service-execution proof and internal job cost</summary><p class="muted">Capture arrival/completion evidence plus labour, material, equipment, and other costs. Customer-visible proof requires approved public images and a customer-safe summary; internal costs never appear in the portal.</p><form id="oc_execution_proof_form" class="operations-form"><label>Work order<select name="work_order_id" data-oc-work-order-select required><option value="">Loading accepted work orders…</option></select></label><label>Proof type<select name="proof_type"><option value="arrival">Arrival</option><option value="progress">Progress</option><option value="completion">Completion</option><option value="quality">Quality check</option><option value="material">Material use</option><option value="equipment">Equipment use</option><option value="expense">Other expense</option><option value="note">Service note</option></select></label><label>Progress %<input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="Optional" /></label><label>When<input name="occurred_at" type="datetime-local" /></label><label>Labour minutes<input name="labour_minutes" type="number" min="0" step="1" value="0" /></label><label>Labour hourly cost<input name="labour_hourly_rate" type="number" min="0" step="0.01" value="0" /></label><label>Material cost<input name="material_cost_total" type="number" min="0" step="0.01" value="0" /></label><label>Equipment cost<input name="equipment_cost_total" type="number" min="0" step="0.01" value="0" /></label><label>Other cost<input name="other_cost_total" type="number" min="0" step="0.01" value="0" /></label><label class="operations-span">Proof title<input name="title" maxlength="180" minlength="3" required placeholder="Example: Arrival walkaround completed" /></label><label class="operations-span">Staff notes<textarea name="staff_notes" maxlength="4000" placeholder="Internal proof notes, cost context, issue notes, or crew details. Never shown to customers."></textarea></label><label class="operations-span">Customer-safe summary<textarea name="customer_summary" maxlength="1500" placeholder="Optional summary shown only after supervisor approval if customer-visible is checked. Do not include costs or access details."></textarea></label><label class="operations-span">Approved public images (optional)<select name="asset_ids" data-oc-live-update-assets multiple size="4"></select><small>Customer-visible proof may use only approved public images. Private review media stays internal.</small></label><label class="operations-inline-check operations-span"><input name="customer_visible" type="checkbox" /> After supervisor approval, show this proof summary in the secure customer portal</label><button type="submit" data-oc-permission="work_order_execution_proof_submit">Capture service proof</button></form><h4>Execution proof and cost review</h4><div id="oc_execution_proof_queue" class="oc-live-queue"></div></details>
        <details open><summary>Supervisor closeout, signoff, invoice readiness, and follow-up</summary><p class="muted">Build the final customer-safe closeout from approved proof. Before/after gallery, customer signoff, review request, invoice-readiness, and maintenance follow-up stay separate from public SEO pages and never expose costs.</p><form id="oc_closeout_form" class="operations-form"><label>Work order<select name="work_order_id" data-oc-work-order-select required><option value="">Loading accepted work orders…</option></select></label><label>Maintenance follow-up due<input name="maintenance_followup_due_at" type="date" /></label><label class="operations-inline-check"><input name="invoice_ready_requested" type="checkbox" /> Prepare invoice-readiness after customer signoff</label><label class="operations-inline-check"><input name="review_request_requested" type="checkbox" /> Queue review request after customer signoff</label><label class="operations-span">Customer-safe closeout summary<textarea name="customer_summary" maxlength="2000" minlength="12" required placeholder="Summarize what was completed, what the customer should know, and any care/maintenance tip. Do not include costs, staff notes, access codes, or internal margin."></textarea></label><label class="operations-span">Staff-only closeout notes<textarea name="staff_closeout_notes" maxlength="4000" placeholder="Internal notes for invoice, rework, cost context, or supervisor review. Never shown in the customer portal."></textarea></label><label class="operations-span">Approved BEFORE images<select name="before_asset_ids" data-oc-closeout-before-assets multiple size="4"></select><small>Only approved public images are selectable. Review-stage media stays private.</small></label><label class="operations-span">Approved AFTER images<select name="after_asset_ids" data-oc-closeout-after-assets multiple size="4"></select><small>The portal gallery shows approved customer-safe public images only.</small></label><button type="submit" data-oc-permission="work_order_closeout_submit">Submit closeout package</button></form><h4>Closeout review queue</h4><div id="oc_closeout_queue" class="oc-live-queue"></div></details>
        <details open><summary>Payment Application &amp; A/R Completion</summary><p class="muted">Apply receipts and unapplied cash, paid deposits, credits, discounts, approved write-offs, or overpayments only after server validation. Every submission is review/audit evidence; <strong>ledger posting remains OFF</strong> until a separately authorized release.</p><form id="oc_ar_application_form" class="operations-form">
          <label>Application type<select name="application_type"><option value="receipt">Receipt to invoice</option><option value="unapplied_cash">Unapplied cash to invoice</option><option value="deposit">Paid deposit to invoice</option><option value="credit">Credit to invoice</option><option value="discount">Discount to invoice</option><option value="writeoff">Approved write-off</option><option value="overpayment">Overpayment / customer credit</option></select></label>
          <label>Application date<input id="oc_ar_application_date" name="application_date" type="date" value="${todayValue}" required /></label>
          <label>Open invoice<select name="invoice_id" data-oc-ar-invoice-select></select></label>
          <label>Receipt / unapplied source<select name="payment_id" data-oc-ar-payment-select></select></label>
          <label>Paid deposit source<select name="deposit_id" data-oc-ar-deposit-select></select></label>
          <label>Adjustment/source reference<input name="source_reference" placeholder="Credit memo, approval, discount authorization…" /></label>
          <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label>Proof reference<input name="proof_reference" required placeholder="Receipt, deposit, approval, or document reference" /></label>
          <label class="operations-span">Reason / reviewer context<textarea name="reason" minlength="8" required placeholder="Explain why this amount should be applied and any adjustment authority."></textarea></label>
          <div class="operations-actions operations-span"><button id="oc_ar_application_preview_btn" type="button" class="secondary" data-oc-permission="payment_action_request">Preview &amp; validate</button><button id="oc_ar_application_submit" type="submit" data-oc-permission="payment_action_request" disabled>Submit for approval</button></div>
        </form><div id="oc_ar_application_preview" class="oc-recon-review" aria-live="polite"><p class="muted">Preview the application to validate customer identity, source balance, invoice balance, date, proof, and open-period status before submitting.</p></div><h4>A/R application review queue</h4><div id="oc_payment_queue" class="oc-live-queue"></div></details>
        <details><summary>General payment request — posting disabled</summary><p class="muted">Legacy/general payment requests can still be staged for review. Build 313 does not provide a ledger-post action.</p><form id="oc_payment_form" class="operations-form">
          <label>Action<select name="action_type"><option value="apply_payment">Apply payment</option><option value="reverse_payment">Reverse payment</option><option value="refund">Refund</option><option value="write_off">Write-off</option><option value="overpayment_credit">Overpayment credit</option></select></label>
          <label>Ledger side<select name="ledger_side"><option value="auto">Auto resolve</option><option value="ar">Accounts receivable</option><option value="ap">Accounts payable</option></select></label>
          <label>Bank account<select name="bank_account_id" data-oc-bank-select></select></label><label>Date<input id="oc_payment_date" name="transaction_date" type="date" value="${todayValue}" required /></label>
          <label>Customer/vendor<input name="customer_or_vendor_name" required /></label><label>Invoice/bill reference<input name="invoice_reference" /></label><label>Payment reference<input name="payment_reference" /></label><label>Reversal request ID<input name="reversal_of_request_id" /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Proof reference<input name="proof_reference" required placeholder="Receipt, bank row, or attachment reference" /></label><label class="operations-span">Reason<textarea name="reason" minlength="8" required></textarea></label><button type="submit" data-oc-permission="payment_action_request">Submit for approval</button>
        </form></details>
        <details><summary>Bank CSV preview and promotion</summary><form id="oc_bank_form" class="operations-form"><label class="operations-span">CSV file<input id="oc_bank_file" type="file" accept=".csv,text/csv" required /></label><label>Bank account<select id="oc_bank_account" data-oc-bank-select></select></label><label>Fallback bank hint<input id="oc_bank_account_hint" /></label><button type="submit" data-oc-permission="bank_csv_preview">Parse and validate</button><input id="oc_bank_import_id" type="hidden" /><label class="operations-span">Confirmation note<input id="oc_bank_confirmation_note" /></label><button id="oc_bank_confirm" type="button" class="secondary" data-oc-permission="bank_csv_confirm_import">Confirm and promote accepted rows</button></form><p id="oc_bank_preview_summary" class="muted"></p><p id="oc_bank_server_summary" class="muted"></p><div class="table-scroll"><table><thead id="oc_bank_preview_headers"></thead><tbody id="oc_bank_preview_rows"></tbody></table></div><h4>Live import queue</h4><div id="oc_bank_queue" class="oc-live-queue"></div></details>
        <details><summary>Smart Reconciliation Workbench — ranked matching, split, sign-off, and undo</summary><form id="oc_recon_form" class="operations-form"><label>Action<select id="oc_recon_action" name="action_type"><option value="match">Exact match</option><option value="split">Exact split</option><option value="undo">Undo prior action</option><option value="signoff">Sign off session</option><option value="reject">Exception/reject</option></select></label><label>Import/session ID<input id="oc_recon_import_id" name="import_id" /></label><label>Promoted bank item ID<input id="oc_recon_row_id" name="bank_row_id" /></label><label>Target reference<input id="oc_recon_target" name="target_reference" /></label><label>Prior action ID for undo<input name="undo_of_action_id" /></label><label class="operations-span">Split rows JSON<textarea name="split_rows" placeholder='[{"reference":"INV-1","amount":100},{"reference":"INV-2","amount":50}]'></textarea></label><label class="operations-span">Sign-off/decision note<textarea name="signoff_note"></textarea></label><button type="submit" data-oc-permission="reconciliation_action">Process reconciliation action</button></form><p id="oc_recon_explanation" class="operations-explanation muted"></p><div id="oc_recon_suggestions" class="oc-suggestions"></div><div id="oc_recon_review" class="oc-recon-review" aria-live="polite"></div>
        <h4>Build 315 — Reconciliation Exception Resolution</h4><p class="muted">Own, classify, evidence, and resolve reconciliation exceptions. Material unresolved exceptions stay visible as Finance-readiness and month-end-close blockers. This workflow never enables posting.</p>
        <form id="oc_recon_exception_form" class="operations-form">
          <label>Bank item ID<input id="oc_recon_exception_item_id" name="bank_row_id" required /></label>
          <label>Severity<select name="exception_severity"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label>Category<select name="exception_category"><option value="timing_difference">Timing difference</option><option value="duplicate">Duplicate</option><option value="missing_document">Missing document</option><option value="wrong_account">Wrong account</option><option value="amount_mismatch">Amount mismatch</option><option value="transfer_pair">Transfer pair</option><option value="provider_settlement">Provider settlement</option><option value="manual_accounting_review">Manual accounting review</option></select></label>
          <label>Owner<select id="oc_recon_exception_owner" name="owner_profile_id"></select></label>
          <label>Status<select name="resolution_status"><option value="open">Open / owned</option><option value="resolved">Resolved</option></select></label>
          <label class="operations-span">Evidence reference<input name="evidence_reference" minlength="3" required placeholder="Bank statement line, invoice, provider settlement, transfer proof…" /></label>
          <label class="operations-span">Resolution reason<textarea name="resolution_reason" placeholder="Required when resolving: timing difference cleared, duplicate confirmed, document supplied, account corrected…"></textarea></label>
          <button type="submit" data-oc-permission="reconciliation_action">Save exception decision</button>
        </form><div id="oc_recon_exception_queue" class="oc-live-queue"></div><h4>Open bank rows</h4><div id="oc_recon_queue" class="oc-live-queue"></div></details>
        <details><summary>Equipment scan, service, and cost recovery</summary><form id="oc_equipment_form" class="operations-form"><label>Scan code<input id="oc_scan_code" name="scan_code" required /></label><input id="oc_scan_source" name="scan_source" type="hidden" value="manual" /><label>Stage<select name="scan_stage"><option value="checkout">Checkout</option><option value="site_arrival">Site arrival</option><option value="return">Return</option><option value="return_to_service">Return to service</option><option value="field_check">Field check</option></select></label><label>Equipment reference<input name="equipment_reference" /></label><label>Job code/ID<input name="job_reference" /></label><label>Condition<input name="condition_summary" /></label><label>Accessories<input name="accessory_summary" /></label><label>Signer<input name="signer_name" /></label><label>Estimated recovery cost<input name="estimated_cost" type="number" min="0" step="0.01" /></label><label class="operations-inline-check"><input name="service_required" type="checkbox" /> Service required</label><label class="operations-inline-check"><input name="cost_recovery_required" type="checkbox" /> Cost recovery review</label><label class="operations-inline-check"><input name="customer_billable" type="checkbox" /> Customer billable</label><label class="operations-span">Notes<textarea name="notes"></textarea></label><div class="operations-actions"><button type="submit" data-oc-permission="equipment_scan_event">Resolve and save custody event</button><button id="oc_camera_start" type="button" class="secondary">Scan QR/barcode</button><button id="oc_camera_stop" type="button" class="secondary">Stop camera</button></div><video id="oc_scan_video" class="operations-scan-video" playsinline muted hidden></video></form><p id="oc_equipment_resolution" class="muted"></p><h4>Live service and scan queue</h4><div id="oc_equipment_queue" class="oc-live-queue"></div></details>
        <details><summary>Real visual upload and approval</summary><form id="oc_asset_form" class="operations-form"><label class="operations-span">Image file<input id="oc_asset_file" name="asset_file" type="file" accept="image/jpeg,image/png,image/webp" /></label><label>Status<select name="asset_status"><option value="review">Review</option><option value="draft">Draft</option></select></label><label>Surface<input name="surface_area" value="public" /></label><label>Image role<input name="image_role" value="placeholder_replacement" /></label><label class="operations-span">Existing source URL (file optional)<input name="source_url" type="url" /></label><label class="operations-span">Alt text<input name="alt_text" minlength="12" required /></label><label>Consent<select name="consent_status"><option value="not_required">Not required</option><option value="approved">Approved</option><option value="pending">Pending</option></select></label><label>Compression<select name="compression_status"><option value="optimized">Optimized</option><option value="ready">Ready</option><option value="pending">Pending</option></select></label><label>Route key<input name="route_key" /></label><label>Placeholder selector<input name="placeholder_selector" placeholder=".hero-visual" /></label><label>Known width for URL<input name="pixel_width" type="number" min="0" /></label><label>Known height for URL<input name="pixel_height" type="number" min="0" /></label><label class="operations-span">Notes<textarea name="notes"></textarea></label><button type="submit" data-oc-permission="visual_asset_register">Optimize, upload, and register</button><progress id="oc_asset_progress" max="100" value="0" hidden></progress><div id="oc_asset_preview" class="oc-asset-preview"></div></form><h4>Live visual approval queue</h4><div id="oc_asset_queue" class="oc-live-queue"></div></details>
        <details><summary>Approved public route and sitemap publication</summary><form id="oc_route_form" class="operations-form"><div class="operations-readiness"><span id="oc_route_score">0% ready</span><small>Title, one H1, meta, local proof, CTA, clean path, and approved visual are publication gates.</small></div><label>Route key<input name="route_key" required /></label><label>Path<input id="oc_route_path" name="route_path" value="/services/" required /></label><label>Type<select name="route_type"><option value="service">Service</option><option value="location">Location</option><option value="service_location">Service + location</option><option value="guide">Guide</option></select></label><label>Status<select name="route_status"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option></select></label><label>Service name<input name="service_name" /></label><label>Location name<input name="location_name" /></label><label class="operations-span">Page title<input id="oc_route_title" name="page_title" maxlength="70" required /></label><label class="operations-span">One H1 text<input id="oc_route_h1" name="h1_text" maxlength="120" required /></label><label class="operations-span">Meta description<textarea id="oc_route_meta" name="meta_description" maxlength="170"></textarea></label><label class="operations-span">Intro<textarea name="page_intro"></textarea></label><label class="operations-span">Body Markdown<textarea name="page_body_markdown" rows="8"></textarea></label><label class="operations-span">Local proof<input id="oc_route_proof" name="local_proof_hint" /></label><label>Primary CTA path<input id="oc_route_cta" name="primary_cta_path" placeholder="#quote-intake" /></label><label>Visual asset key<input name="visual_asset_key" /></label><label class="operations-span">Canonical URL<input name="canonical_url" type="url" /></label><button type="submit" data-oc-permission="public_route_register">Save route approval row</button></form><h4>Live route publication queue</h4><div id="oc_route_queue" class="oc-live-queue"></div></details>
        <details><summary>Customer portal, deposits, dispatch, and job cost</summary><p class="muted">Accepted customer quotes, hosted deposit status, work-order scheduling, and latest job margin are combined here. Deposit paid status is verified by the Stripe webhook, not a manual staff button.</p><div id="oc_portal_queue" class="oc-live-queue"></div></details><details><summary>Accountant package and staging-proof record</summary><p class="muted">Generate a private CSV/ZIP bundle only after the readiness panel is clear. This is an accountant-review package, not a tax filing.</p><form id="oc_accountant_export_form" class="operations-form"><label>Period start<input name="period_start" type="date" /></label><label>Period end<input name="period_end" type="date" /></label><label class="operations-span">Package title<input name="export_title" maxlength="180" placeholder="Accounting package (defaults to previous month)" /></label><button type="submit" data-oc-permission="accountant_export_prepare">Generate private accountant package</button></form><div id="oc_staging_test_summary" class="oc-staging-test-summary"></div></details>
        <details><summary>Release proof: staging fixtures, policy checks, route signals, and webhook alerts</summary><p class="muted">Create labelled disposable records only on a dedicated staging deployment with fixture creation explicitly enabled. Private review media is copied to public assets only after approval.</p><div class="oc-release-grid"><div id="oc_policy_summary"></div><form id="oc_release_snapshot_form" class="operations-form"><label>Review scope<select name="review_scope"><option value="staging">Staging evidence</option><option value="production_candidate">Production-candidate review</option></select></label><label>Confirmation<input name="confirmation_phrase" maxlength="80" placeholder="Type REVIEW ONLY" required /></label><label class="operations-span">Reviewer note<textarea name="reviewer_note" maxlength="2000" placeholder="What was reviewed, what remains, and any release decision outside this app."></textarea></label><button type="submit" data-oc-permission="release_readiness_snapshot">Capture evidence snapshot</button><small class="operations-span">This records evidence only. It cannot deploy code, publish routes, or change payment status.</small></form><form id="oc_fixture_form" class="operations-form"><label class="operations-span">Fixture label<input name="fixture_label" value="STAGING-RPC" pattern="STAGING-.*" required /></label><label class="operations-inline-check operations-span"><input name="fixture_confirm" type="checkbox" /> I confirm this is a disposable staging project, not production.</label><button type="submit" data-oc-permission="staging_fixture_create">Create disposable fixture set</button><label>Fixture set ID<input id="oc_fixture_set_id" /></label><button id="oc_fixture_cleanup" type="button" class="secondary" data-oc-permission="staging_fixture_cleanup">Clean fixture set</button></form></div><form id="oc_signal_form" class="operations-form"><label>Evidence source<select name="source_name"><option value="search_console">Search Console</option><option value="google_business_profile">Google Business Profile</option><option value="manual_analytics">Manual analytics</option></select></label><label>Route key<input name="route_key" /></label><label>Observation date<input name="observation_date" type="date" value="${todayValue}" /></label><label>Impressions<input name="impressions" type="number" min="0" /></label><label>Clicks<input name="clicks" type="number" min="0" /></label><label>Average position<input name="average_position" type="number" min="0" step="0.01" /></label><label>Calls<input name="calls" type="number" min="0" /></label><label>Website visits<input name="website_visits" type="number" min="0" /></label><label class="operations-span">Evidence URL<input name="evidence_url" type="url" placeholder="Optional Search Console/GBP report URL" /></label><label class="operations-span">Human note<input name="notes" /></label><button type="submit" data-oc-permission="content_signal_record">Record route evidence</button></form><h4>Route/content decision queue</h4><div id="oc_signal_queue" class="oc-live-queue"></div><h4>Payment-provider alert queue</h4><div id="oc_webhook_alerts" class="oc-live-queue"></div></details>
      </div></section>`;
  }

  function bind() {
    byId('oc_recurring_program_form')?.addEventListener('submit',(e)=>handleRecurringProgram(e).catch((err)=>status(err?.message || 'Recurring program save failed.',true)));
    byId('oc_recurring_reset')?.addEventListener('click',resetRecurringProgramForm);
    byId('oc_crew_dispatch_form')?.addEventListener('submit',(e)=>handleCrewDispatch(e).catch((err)=>status(err?.message || 'Crew dispatch failed.',true)));
    byId('oc_crew_dispatch_form')?.elements?.crew_id?.addEventListener('change',populateCrewFromSelection);
    byId('oc_dispatch_board_date')?.addEventListener('change',renderCrewDispatch);
    byId('oc_dispatch_board_mode')?.addEventListener('change',renderCrewDispatch);
    byId('oc_dispatch_reset')?.addEventListener('click',resetCrewDispatchForm);
    byId('oc_live_update_form')?.addEventListener('submit', (e) => handleLiveUpdate(e).catch((err) => status(err?.message || 'Live work update failed.', true)));
    byId('oc_execution_proof_form')?.addEventListener('submit', (e) => handleExecutionProof(e).catch((err) => status(err?.message || 'Service-execution proof failed.', true)));
    byId('oc_closeout_form')?.addEventListener('submit', (e) => handleCloseout(e).catch((err) => status(err?.message || 'Closeout package failed.', true)));
    byId('oc_ar_application_form')?.addEventListener('submit', (e) => handleArApplication(e).catch((err) => status(err?.message || 'A/R application request failed.', true)));
    byId('oc_ar_application_preview_btn')?.addEventListener('click', () => handleArApplicationPreview().catch((err) => status(err?.message || 'A/R application validation failed.', true)));
    byId('oc_ar_application_form')?.addEventListener('input', invalidateArApplicationPreview);
    byId('oc_payment_form')?.addEventListener('submit', (e) => handlePayment(e).catch((err) => status(err?.message || 'Payment request failed.', true)));
    byId('oc_bank_form')?.addEventListener('submit', (e) => handleBankPreview(e).catch((err) => status(err.message, true)));
    byId('oc_bank_confirm')?.addEventListener('click', () => handleBankConfirm().catch((err) => status(err.message, true)));
    byId('oc_recon_form')?.addEventListener('submit', (e) => handleReconciliation(e).catch((err) => status(err?.message || 'Reconciliation action failed.', true)));
    byId('oc_recon_exception_form')?.addEventListener('submit', (e) => handleReconException(e).catch((err) => status(err?.message || 'Reconciliation exception update failed.', true)));
    byId('oc_equipment_form')?.addEventListener('submit', (e) => handleEquipment(e).catch(() => {}));
    byId('oc_asset_form')?.addEventListener('submit', (e) => handleAsset(e).catch((err) => status(err.message, true)));
    byId('oc_route_form')?.addEventListener('submit', (e) => handleRoute(e).catch(() => {}));
    byId('oc_accountant_export_form')?.addEventListener('submit', (event) => { event.preventDefault(); const data = formData(event.currentTarget); if (!capabilityFor('accountant_export_prepare')?.permitted && queues?.capabilities?.actions) { status(capabilityFor('accountant_export_prepare')?.reason || 'Your role cannot generate an accountant package.', true); return; } status('Generating private accountant package…'); window.YWIAPI?.accountantExport({ action:'prepare', period_start:data.period_start, period_end:data.period_end, export_title:data.export_title }).then((response) => { if (!response?.ok) throw new Error(response?.error || 'Accountant package failed.'); status('Private accountant package generated. The signed download is available for 15 minutes.'); if (response.download_url) window.open(response.download_url, '_blank', 'noopener'); return loadQueues(true); }).catch((err) => status(err?.message || 'Accountant package failed.', true)); });
    byId('oc_release_snapshot_form')?.addEventListener('submit', (event) => { event.preventDefault(); const data=formData(event.currentTarget); if (String(data.confirmation_phrase || '').trim().toUpperCase() !== 'REVIEW ONLY') { status('Type REVIEW ONLY to confirm this is an evidence snapshot, not a release command.', true); return; } send({ action:'release_readiness_capture', review_scope:data.review_scope, reviewer_note:data.reviewer_note, confirmation_phrase:data.confirmation_phrase }, 'Release evidence snapshot').then((response) => { status(response?.snapshot?.message || 'Release-readiness evidence snapshot captured. No deployment was performed.'); event.currentTarget.reset(); }).catch(() => {}); });
    byId('oc_fixture_form')?.addEventListener('submit', (event) => { event.preventDefault(); const data = formData(event.currentTarget); const label = String(data.fixture_label || '').trim().toUpperCase(); if (!label.startsWith('STAGING-')) { status('Fixture labels must begin with STAGING-.', true); return; } if (!event.currentTarget.elements.fixture_confirm.checked) { status('Confirm that this is a disposable staging project before creating fixtures.', true); return; } send({ action:'staging_fixture_create', fixture_label:label }, 'Disposable staging fixture creation').then((response) => { const fixture=response?.fixture||{}; byId('oc_fixture_set_id').value=fixture.fixture_set_id||''; status('Disposable STAGING fixture created. Run the harness, then clean it using the fixture ID.'); }).catch(() => {}); });
    byId('oc_fixture_cleanup')?.addEventListener('click', () => { const id=byId('oc_fixture_set_id')?.value?.trim(); if (!id) { status('Enter the staging fixture set ID to clean.', true); return; } const note=prompt('Cleanup note (optional):')||''; send({ action:'staging_fixture_cleanup', fixture_set_id:id, cleanup_note:note }, 'Staging fixture cleanup').catch(() => {}); });
    byId('oc_signal_form')?.addEventListener('submit', (event) => { event.preventDefault(); const data=formData(event.currentTarget); send({ action:'content_signal_record', idempotency_key:idem('signal'), source_name:data.source_name, route_key:data.route_key, observation_date:data.observation_date, period_start:data.period_start, period_end:data.period_end, impressions:data.impressions, clicks:data.clicks, average_position:data.average_position, calls:data.calls, direction_requests:data.direction_requests, website_visits:data.website_visits, review_count:data.review_count, rating:data.rating, evidence_url:data.evidence_url, notes:data.notes }, 'Route performance observation').then(() => event.currentTarget.reset()).catch(() => {}); });
    byId('oc_route_form')?.addEventListener('input', routeReadiness);
    byId('oc_camera_start')?.addEventListener('click', () => startCamera().catch((err) => status(err.message, true)));
    byId('oc_camera_stop')?.addEventListener('click', stopCamera);
    byId('oc_refresh')?.addEventListener('click', () => loadQueues(false));
    byId('oc_retry_btn')?.addEventListener('click', async () => { const item = getRetry(); if (item?.payload) await send(item.payload, `Retry ${item.label || item.payload.action}`).catch(() => {}); });
    byId('oc_retry_clear')?.addEventListener('click', clearRetry);
    byId('operationsCockpit')?.addEventListener('input', saveDraft);
    byId('operationsCockpit')?.addEventListener('click', (event) => {
      const rowAction = event.target.closest('[data-oc-action]'); if (rowAction) handleRowAction(rowAction).catch(() => {});
      const suggestion = event.target.closest('.oc-suggestion'); if (suggestion) {
        const item = reconciliationSuggestions[Number(suggestion.dataset.suggestionIndex)];
        if (!item) return;
        selectedReconSuggestion = item;
        const splitField = byId('oc_recon_form')?.elements?.split_rows;
        if (item.actionable === false) {
          byId('oc_recon_target').value = '';
          if (splitField) splitField.value = '';
          status(`Rank #${item.rank || '?'} is review-only (${String(item.match_mode || 'candidate').replaceAll('_',' ')}). No reconciliation action was prepared.`, true);
          return;
        }
        if (item.match_mode === 'one_to_many') {
          byId('oc_recon_action').value = 'split';
          byId('oc_recon_target').value = '';
          if (splitField) splitField.value = JSON.stringify((item.targets || []).map((target) => ({
            target_type:target.target_type, target_id:target.target_id, target_reference:target.target_reference,
            allocated_amount:target.allocated_amount, match_score:item.explanation?.score, match_explanation:item.explanation
          })), null, 2);
          status(`Prepared exact split from ranked suggestion #${item.rank}. Review every allocation and submit only after human confirmation.`);
          return;
        }
        byId('oc_recon_target').value = item.reference || '';
        byId('oc_recon_action').value = 'match';
        if (splitField) splitField.value = '';
        status(`Selected exact ranked candidate #${item.rank}: ${item.reference}. Human confirmation is still required before recording the match.`);
      }
    });
  }
  function inject() {
    const admin = byId('admin'); if (!admin || byId('operationsCockpit')) return;
    const anchor = byId('ad_stats_grid') || admin.querySelector('.section-heading'); if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', panelHtml()); bind(); restoreDraft(); renderRetry(); routeReadiness(); hydrateBankSelects(); hydrateArApplicationSelects(); hydrateLiveUpdateSelects(); loadQueues(true);
  }

  const observer = new MutationObserver(inject);
  document.addEventListener('DOMContentLoaded', () => { inject(); observer.observe(document.body, { childList:true, subtree:true }); });
  document.addEventListener('ywi:auth-changed', () => setTimeout(() => { inject(); loadQueues(true); }, 0));
  window.addEventListener('beforeunload', stopCamera);
})();
