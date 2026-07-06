/* Operations Cockpit - schema 155
   Live Admin work queues, row-level approvals/posting, bank promotion,
   exact reconciliation, equipment resolution, public media upload, route
   publication, quote follow-up, dispatch, deposits, and job-cost refresh. */
'use strict';

(function () {
  const BUILD = '2026-07-05a';
  const RETRY_KEY = 'ywi_operations_cockpit_retry_v2';
  const DRAFT_KEY = 'ywi_operations_cockpit_draft_v2';
  let cameraStream = null;
  let scanTimer = null;
  let queues = {};
  let queueLoading = false;
  let selectedReconItemId = '';

  const actionCapability = {
    'payment-approve':'payment_action_decision', 'payment-reject':'payment_action_decision', 'payment-post':'payment_action_decision',
    'bank-promote':'bank_csv_confirm_import', 'recon-suggest':'reconciliation_action', 'recon-use':'reconciliation_action', 'recon-reject':'reconciliation_action', 'recon-review':'reconciliation_action',
    'recovery-approve':'equipment_cost_recovery_decision', 'recovery-decline':'equipment_cost_recovery_decision',
    'asset-approve':'visual_asset_decision', 'asset-reject':'visual_asset_decision',
    'route-approve':'public_route_decision', 'route-reject':'public_route_decision', 'route-publish':'public_route_publish',
    'quote-assign':'quote_owner_assign', 'quote-contact':'quote_followup_event',
    'portal-dispatch':'dispatch_schedule', 'job-cost-refresh':'job_cost_refresh', 'deposit-paid':'deposit_status_update',
    'job-update-retract':'work_order_live_update_retract',
    'webhook-ack':'stripe_webhook_alert_decision', 'webhook-resolve':'stripe_webhook_alert_decision',
    'signal-review':'content_signal_decision', 'signal-actioned':'content_signal_decision',
    'release-readiness-capture':'release_readiness_snapshot'
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
        actions.push(button('Approve','payment-approve',row.id));
        actions.push(button('Reject','payment-reject',row.id,'',true));
      }
      if (row.action_status === 'approved' && row.posting_status !== 'posted') {
        actions.push(button('Post to ledger','payment-post',row.id));
        actions.push(button('Reject','payment-reject',row.id,'',true));
      }
      return `<article class="oc-queue-card"><header><strong>${esc(row.action_type?.replaceAll('_',' '))}</strong><span class="${statusClass(row.posting_status || row.action_status)}">${esc(row.posting_status || row.action_status)}</span></header><dl><div><dt>Side / date</dt><dd>${esc((row.ledger_side || 'auto').toUpperCase())} · ${esc(row.transaction_date || '—')}</dd></div><div><dt>Party</dt><dd>${esc(row.customer_or_vendor_name || '—')}</dd></div><div><dt>Invoice / payment</dt><dd>${esc(row.invoice_reference || '—')} / ${esc(row.payment_reference || '—')}</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Proof</dt><dd>${esc(row.proof_reference || 'Missing')}</dd></div><div><dt>Posting</dt><dd>${esc(row.posting_message || row.decision_note || 'Awaiting action')}</dd></div></dl>${buttons(actions)}</article>`;
    }).join('') : emptyQueue('No payment actions', 'Submitted payment requests will appear here for approval and posting.');
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
    if (selectedReconItemId && !items.some((row) => String(row.id) === String(selectedReconItemId))) selectedReconItemId = '';
    const itemHtml = items.length ? items.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.item_description || 'Bank row')}</strong><span class="${statusClass(row.match_status)}">${esc(row.match_status)}</span></header><dl><div><dt>Date</dt><dd>${esc(row.item_date || '—')}</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Item ID</dt><dd><code>${esc(row.id)}</code></dd></div><div><dt>Exception</dt><dd>${esc(row.difference_reason || '—')}</dd></div></dl>${buttons([button('Review exact math','recon-review',row.id,'',true), button('Find matches','recon-suggest',row.id), button('Use for match','recon-use',row.id,'',true), button('Reject','recon-reject',row.id,'',true)])}</article>`).join('') : emptyQueue('No open reconciliation rows', 'Confirmed CSV rows will appear here until matched or signed off.');
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
      control.disabled = cap.permitted === false;
      control.setAttribute('title', cap.reason || 'Server permission check applies.');
      control.textContent = cap.permitted === false ? `${base} · restricted` : base;
      control.setAttribute('aria-disabled', cap.permitted === false ? 'true' : 'false');
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
  function renderQueues() {
    renderRails(); renderRolePermissions(); renderOperationsHealth(); renderReleaseDashboard(); renderReleaseProof(); renderPaymentQueue(); renderBankQueue(); renderReconQueue(); renderEquipmentQueue(); renderAssetQueue(); renderRouteQueue(); renderQuoteQueue(); renderPortalQueue(); renderLiveUpdateQueue(); hydrateLiveUpdateSelects(); decoratePermissionControls();
  }
  function hydrateBankSelects() {
    const options = `<option value="">Choose bank account</option>${(queues.banks || []).map((bank) => `<option value="${esc(bank.id)}">${esc(bank.account_name)}${bank.is_default ? ' (default)' : ''}</option>`).join('')}`;
    document.querySelectorAll('[data-oc-bank-select]').forEach((select) => { const current = select.value; select.innerHTML = options; if (current) select.value = current; });
  }

  function hydrateLiveUpdateSelects() {
    const workOrders = (queues.portal || []).filter((row) => row.work_order_id);
    const workOrderOptions = `<option value="">Choose accepted work order</option>${workOrders.map((row) => `<option value="${esc(row.work_order_id)}">${esc(row.work_order_number || 'Work order')} · ${esc(row.client_name || row.client_email || 'Customer')}</option>`).join('')}`;
    document.querySelectorAll('[data-oc-work-order-select]').forEach((select) => {
      const current = select.value; select.innerHTML = workOrderOptions; if (current) select.value = current;
    });
    const approvedAssets = (queues.assets || []).filter((row) => row.asset_status === 'approved' && row.public_url);
    const assetOptions = approvedAssets.map((row) => `<option value="${esc(row.id)}">${esc(short(row.asset_key || row.original_file_name || row.id, 72))} · ${esc(row.route_key || row.image_role || 'approved visual')}</option>`).join('');
    document.querySelectorAll('[data-oc-live-update-assets]').forEach((select) => {
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
    await send({
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
      customer_notification_requested:form.elements.customer_notification_requested?.checked === true
    }, data.visibility === 'customer' ? 'Customer-visible live work update' : 'Staff-only live work update');
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
    const response = await send({ action:'reconciliation_action', idempotency_key:idem('recon'), action_type:data.action_type, import_id:data.import_id, bank_row_id:data.bank_row_id, target_reference:data.target_reference, undo_of_action_id:data.undo_of_action_id, split_rows:splitRows, signoff_note:data.signoff_note }, 'Reconciliation action');
    selectedReconItemId = data.bank_row_id || selectedReconItemId;
    byId('oc_recon_explanation').textContent = response?.match_explanation?.summary || 'Reconciliation action recorded.';
    renderReconciliationReview(selectedReconItemId);
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
      const suggestions = response?.suggestions || []; selectedReconItemId = id; byId('oc_recon_row_id').value = id; renderReconciliationReview(id);
      byId('oc_recon_suggestions').innerHTML = suggestions.length ? suggestions.map((item) => `<button type="button" class="secondary oc-suggestion" data-ref="${esc(item.reference)}"><strong>${esc(item.reference)}</strong><span>${esc(item.type)} · ${item.explanation.score}% · ${money(item.explanation.target_amount)}</span><small>${esc(item.explanation.summary)}</small></button>`).join('') : emptyQueue('No close matches', 'Enter a target reference manually or use an exact split.');
      byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return;
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
    if (action === 'portal-dispatch') { const start = prompt('Scheduled start (YYYY-MM-DDTHH:MM):'); if (!start) return; const end = prompt('Scheduled end (YYYY-MM-DDTHH:MM):'); if (!end) return; await send({ action:'dispatch_schedule', work_order_id:id, scheduled_start:new Date(start).toISOString(), scheduled_end:new Date(end).toISOString(), schedule_status:'scheduled' }, 'Dispatch schedule'); return; }
    if (action === 'webhook-ack' || action === 'webhook-resolve') { const decision = action === 'webhook-ack' ? 'acknowledged' : 'resolved'; await send({ action:'stripe_webhook_alert_decision', alert_id:id, alert_status:decision }, `Webhook alert ${decision}`); return; }
    if (action === 'signal-review' || action === 'signal-actioned') { const decision = action === 'signal-review' ? 'review' : 'actioned'; const note = prompt(decision === 'actioned' ? 'What change was made or scheduled?' : 'Review note (optional):') || ''; await send({ action:'content_signal_decision', observation_id:id, decision_status:decision, decision_note:note }, `Route signal marked ${decision}`); return; }
    if (action === 'job-update-retract') { const reason = prompt('Why should this live update be retracted?'); if (!reason) return; await send({ action:'work_order_live_update_retract', live_update_id:id, retraction_reason:reason }, 'Live work update retraction'); return; }
    if (action === 'deposit-paid') { status('Deposit status is webhook-controlled. Use Stripe test checkout and confirm the verified webhook health card updates.', true); return; }
    if (action === 'job-cost-refresh') { await send({ action:'job_cost_refresh', job_id:Number(id) }, 'Live job-cost refresh'); }
  }

  function panelHtml() {
    const todayValue = new Date().toISOString().slice(0,10);
    return `<section id="operationsCockpit" class="operations-cockpit admin-panel-block" data-admin-panel-title="Operations Cockpit" aria-labelledby="oc_title">
      <div class="section-heading operations-cockpit-heading"><div><span class="operations-kicker">Schema 155 field-to-customer update controls</span><h3 id="oc_title">Operations Cockpit</h3><p class="section-subtitle">Approve, post, reconcile, resolve, publish, schedule, and share deliberately customer-visible work progress from desktop or mobile. Failed writes keep one local retry copy.</p></div><div class="section-graphic-placeholder operations-graphic"><span aria-hidden="true">⌁</span><strong>Live workflow control</strong><small>Replace with an approved dashboard/workshop photograph after consent and image review.</small></div></div>
      <div id="oc_status" class="operations-status" hidden aria-live="polite"></div>
      <div id="oc_retry_wrap" class="operations-retry" hidden><span id="oc_retry_text"></span><button id="oc_retry_btn" type="button">Retry saved action</button><button id="oc_retry_clear" class="secondary" type="button">Discard retry</button></div>
      <div class="operations-toolbar"><button id="oc_refresh" type="button">Refresh all live queues</button><span>Build ${BUILD}</span></div>
      <div id="oc_scorecards" class="operations-scorecards" aria-label="Implementation progress"></div><section id="oc_role_permissions" class="oc-permission-strip" aria-label="Role capability checklist"></section><section class="oc-health-grid" aria-label="Payment and release health"><div id="oc_stripe_health" class="oc-health-list"></div><div id="oc_export_readiness" class="oc-export-readiness"></div></section><section id="oc_release_dashboard" class="oc-release-dashboard" aria-label="Release readiness dashboard"></section>
      <div class="operations-grid">
        <details open><summary>Quote owners, alerts, and follow-up</summary><p class="muted">Assign each request, set a due time, and preserve every contact event.</p><div id="oc_quote_queue" class="oc-live-queue"></div></details>
        <details open><summary>Live job updates: staff-only or customer-visible</summary><p class="muted">Site leaders may save staff-only updates. Customer-visible updates require a supervisor, show only in the secure portal, and can attach only approved public images. This does not send a payment, publish a public web page, or expose staff notes.</p><form id="oc_live_update_form" class="operations-form"><label>Work order<select name="work_order_id" data-oc-work-order-select required><option value="">Loading accepted work orders…</option></select></label><label>Visibility<select name="visibility"><option value="staff">Staff only</option><option value="customer">Customer visible (supervisor)</option></select></label><label>Update type<select name="update_type"><option value="arrival">Arrival</option><option value="progress" selected>Progress</option><option value="delay">Timing update</option><option value="access">Access/site update</option><option value="completion">Completion</option><option value="note">Service note</option></select></label><label>Progress %<input name="progress_percent" type="number" min="0" max="100" step="1" placeholder="Optional" /></label><label>When<input name="occurred_at" type="datetime-local" /></label><label class="operations-span">Update title<input name="title" maxlength="180" minlength="3" required placeholder="Example: Crew arrived and site walk-through started" /></label><label class="operations-span">Customer-safe message<textarea name="message" maxlength="4000" placeholder="Use plain language. Do not include private staff, costing, or access-code information in customer-visible updates."></textarea></label><label class="operations-span">Approved public images (optional)<select name="asset_ids" data-oc-live-update-assets multiple size="4" aria-describedby="oc_live_update_asset_help"></select><small id="oc_live_update_asset_help">Only approved public images are available here. Private review images and staff-only notes cannot be shown to customers.</small></label><label class="operations-inline-check operations-span"><input name="customer_notification_requested" type="checkbox" /> Queue a customer-notification request when delivery is configured</label><button type="submit" data-oc-permission="work_order_live_update">Save live update</button></form><h4>Live update history</h4><div id="oc_live_updates_queue" class="oc-live-queue"></div></details>
        <details open><summary>Payment action and posting</summary><form id="oc_payment_form" class="operations-form">
          <label>Action<select name="action_type"><option value="apply_payment">Apply payment</option><option value="reverse_payment">Reverse payment</option><option value="refund">Refund</option><option value="write_off">Write-off</option><option value="overpayment_credit">Overpayment credit</option></select></label>
          <label>Ledger side<select name="ledger_side"><option value="auto">Auto resolve</option><option value="ar">Accounts receivable</option><option value="ap">Accounts payable</option></select></label>
          <label>Bank account<select name="bank_account_id" data-oc-bank-select></select></label><label>Date<input id="oc_payment_date" name="transaction_date" type="date" value="${todayValue}" required /></label>
          <label>Customer/vendor<input name="customer_or_vendor_name" required /></label><label>Invoice/bill reference<input name="invoice_reference" /></label><label>Payment reference<input name="payment_reference" /></label><label>Reversal request ID<input name="reversal_of_request_id" /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Proof reference<input name="proof_reference" required placeholder="Receipt, bank row, or attachment reference" /></label><label class="operations-span">Reason<textarea name="reason" minlength="8" required></textarea></label><button type="submit" data-oc-permission="payment_action_request">Submit for approval</button>
        </form><h4>Live payment queue</h4><div id="oc_payment_queue" class="oc-live-queue"></div></details>
        <details><summary>Bank CSV preview and promotion</summary><form id="oc_bank_form" class="operations-form"><label class="operations-span">CSV file<input id="oc_bank_file" type="file" accept=".csv,text/csv" required /></label><label>Bank account<select id="oc_bank_account" data-oc-bank-select></select></label><label>Fallback bank hint<input id="oc_bank_account_hint" /></label><button type="submit" data-oc-permission="bank_csv_preview">Parse and validate</button><input id="oc_bank_import_id" type="hidden" /><label class="operations-span">Confirmation note<input id="oc_bank_confirmation_note" /></label><button id="oc_bank_confirm" type="button" class="secondary" data-oc-permission="bank_csv_confirm_import">Confirm and promote accepted rows</button></form><p id="oc_bank_preview_summary" class="muted"></p><p id="oc_bank_server_summary" class="muted"></p><div class="table-scroll"><table><thead id="oc_bank_preview_headers"></thead><tbody id="oc_bank_preview_rows"></tbody></table></div><h4>Live import queue</h4><div id="oc_bank_queue" class="oc-live-queue"></div></details>
        <details><summary>Reconciliation scoring, split, sign-off, and undo</summary><form id="oc_recon_form" class="operations-form"><label>Action<select id="oc_recon_action" name="action_type"><option value="match">Exact match</option><option value="split">Exact split</option><option value="undo">Undo prior action</option><option value="signoff">Sign off session</option><option value="reject">Exception/reject</option></select></label><label>Import/session ID<input id="oc_recon_import_id" name="import_id" /></label><label>Promoted bank item ID<input id="oc_recon_row_id" name="bank_row_id" /></label><label>Target reference<input id="oc_recon_target" name="target_reference" /></label><label>Prior action ID for undo<input name="undo_of_action_id" /></label><label class="operations-span">Split rows JSON<textarea name="split_rows" placeholder='[{"reference":"INV-1","amount":100},{"reference":"INV-2","amount":50}]'></textarea></label><label class="operations-span">Sign-off/decision note<textarea name="signoff_note"></textarea></label><button type="submit" data-oc-permission="reconciliation_action">Process reconciliation action</button></form><p id="oc_recon_explanation" class="operations-explanation muted"></p><div id="oc_recon_suggestions" class="oc-suggestions"></div><div id="oc_recon_review" class="oc-recon-review" aria-live="polite"></div><h4>Open bank rows</h4><div id="oc_recon_queue" class="oc-live-queue"></div></details>
        <details><summary>Equipment scan, service, and cost recovery</summary><form id="oc_equipment_form" class="operations-form"><label>Scan code<input id="oc_scan_code" name="scan_code" required /></label><input id="oc_scan_source" name="scan_source" type="hidden" value="manual" /><label>Stage<select name="scan_stage"><option value="checkout">Checkout</option><option value="site_arrival">Site arrival</option><option value="return">Return</option><option value="return_to_service">Return to service</option><option value="field_check">Field check</option></select></label><label>Equipment reference<input name="equipment_reference" /></label><label>Job code/ID<input name="job_reference" /></label><label>Condition<input name="condition_summary" /></label><label>Accessories<input name="accessory_summary" /></label><label>Signer<input name="signer_name" /></label><label>Estimated recovery cost<input name="estimated_cost" type="number" min="0" step="0.01" /></label><label class="operations-inline-check"><input name="service_required" type="checkbox" /> Service required</label><label class="operations-inline-check"><input name="cost_recovery_required" type="checkbox" /> Cost recovery review</label><label class="operations-inline-check"><input name="customer_billable" type="checkbox" /> Customer billable</label><label class="operations-span">Notes<textarea name="notes"></textarea></label><div class="operations-actions"><button type="submit" data-oc-permission="equipment_scan_event">Resolve and save custody event</button><button id="oc_camera_start" type="button" class="secondary">Scan QR/barcode</button><button id="oc_camera_stop" type="button" class="secondary">Stop camera</button></div><video id="oc_scan_video" class="operations-scan-video" playsinline muted hidden></video></form><p id="oc_equipment_resolution" class="muted"></p><h4>Live service and scan queue</h4><div id="oc_equipment_queue" class="oc-live-queue"></div></details>
        <details><summary>Real visual upload and approval</summary><form id="oc_asset_form" class="operations-form"><label class="operations-span">Image file<input id="oc_asset_file" name="asset_file" type="file" accept="image/jpeg,image/png,image/webp" /></label><label>Status<select name="asset_status"><option value="review">Review</option><option value="draft">Draft</option></select></label><label>Surface<input name="surface_area" value="public" /></label><label>Image role<input name="image_role" value="placeholder_replacement" /></label><label class="operations-span">Existing source URL (file optional)<input name="source_url" type="url" /></label><label class="operations-span">Alt text<input name="alt_text" minlength="12" required /></label><label>Consent<select name="consent_status"><option value="not_required">Not required</option><option value="approved">Approved</option><option value="pending">Pending</option></select></label><label>Compression<select name="compression_status"><option value="optimized">Optimized</option><option value="ready">Ready</option><option value="pending">Pending</option></select></label><label>Route key<input name="route_key" /></label><label>Placeholder selector<input name="placeholder_selector" placeholder=".hero-visual" /></label><label>Known width for URL<input name="pixel_width" type="number" min="0" /></label><label>Known height for URL<input name="pixel_height" type="number" min="0" /></label><label class="operations-span">Notes<textarea name="notes"></textarea></label><button type="submit" data-oc-permission="visual_asset_register">Optimize, upload, and register</button><progress id="oc_asset_progress" max="100" value="0" hidden></progress><div id="oc_asset_preview" class="oc-asset-preview"></div></form><h4>Live visual approval queue</h4><div id="oc_asset_queue" class="oc-live-queue"></div></details>
        <details><summary>Approved public route and sitemap publication</summary><form id="oc_route_form" class="operations-form"><div class="operations-readiness"><span id="oc_route_score">0% ready</span><small>Title, one H1, meta, local proof, CTA, clean path, and approved visual are publication gates.</small></div><label>Route key<input name="route_key" required /></label><label>Path<input id="oc_route_path" name="route_path" value="/services/" required /></label><label>Type<select name="route_type"><option value="service">Service</option><option value="location">Location</option><option value="service_location">Service + location</option><option value="guide">Guide</option></select></label><label>Status<select name="route_status"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option></select></label><label>Service name<input name="service_name" /></label><label>Location name<input name="location_name" /></label><label class="operations-span">Page title<input id="oc_route_title" name="page_title" maxlength="70" required /></label><label class="operations-span">One H1 text<input id="oc_route_h1" name="h1_text" maxlength="120" required /></label><label class="operations-span">Meta description<textarea id="oc_route_meta" name="meta_description" maxlength="170"></textarea></label><label class="operations-span">Intro<textarea name="page_intro"></textarea></label><label class="operations-span">Body Markdown<textarea name="page_body_markdown" rows="8"></textarea></label><label class="operations-span">Local proof<input id="oc_route_proof" name="local_proof_hint" /></label><label>Primary CTA path<input id="oc_route_cta" name="primary_cta_path" placeholder="#quote-intake" /></label><label>Visual asset key<input name="visual_asset_key" /></label><label class="operations-span">Canonical URL<input name="canonical_url" type="url" /></label><button type="submit" data-oc-permission="public_route_register">Save route approval row</button></form><h4>Live route publication queue</h4><div id="oc_route_queue" class="oc-live-queue"></div></details>
        <details><summary>Customer portal, deposits, dispatch, and job cost</summary><p class="muted">Accepted customer quotes, hosted deposit status, work-order scheduling, and latest job margin are combined here. Deposit paid status is verified by the Stripe webhook, not a manual staff button.</p><div id="oc_portal_queue" class="oc-live-queue"></div></details><details><summary>Accountant package and staging-proof record</summary><p class="muted">Generate a private CSV/ZIP bundle only after the readiness panel is clear. This is an accountant-review package, not a tax filing.</p><form id="oc_accountant_export_form" class="operations-form"><label>Period start<input name="period_start" type="date" /></label><label>Period end<input name="period_end" type="date" /></label><label class="operations-span">Package title<input name="export_title" maxlength="180" placeholder="Accounting package (defaults to previous month)" /></label><button type="submit" data-oc-permission="accountant_export_prepare">Generate private accountant package</button></form><div id="oc_staging_test_summary" class="oc-staging-test-summary"></div></details>
        <details><summary>Release proof: staging fixtures, policy checks, route signals, and webhook alerts</summary><p class="muted">Create labelled disposable records only on a dedicated staging deployment with fixture creation explicitly enabled. Private review media is copied to public assets only after approval.</p><div class="oc-release-grid"><div id="oc_policy_summary"></div><form id="oc_release_snapshot_form" class="operations-form"><label>Review scope<select name="review_scope"><option value="staging">Staging evidence</option><option value="production_candidate">Production-candidate review</option></select></label><label>Confirmation<input name="confirmation_phrase" maxlength="80" placeholder="Type REVIEW ONLY" required /></label><label class="operations-span">Reviewer note<textarea name="reviewer_note" maxlength="2000" placeholder="What was reviewed, what remains, and any release decision outside this app."></textarea></label><button type="submit" data-oc-permission="release_readiness_snapshot">Capture evidence snapshot</button><small class="operations-span">This records evidence only. It cannot deploy code, publish routes, or change payment status.</small></form><form id="oc_fixture_form" class="operations-form"><label class="operations-span">Fixture label<input name="fixture_label" value="STAGING-RPC" pattern="STAGING-.*" required /></label><label class="operations-inline-check operations-span"><input name="fixture_confirm" type="checkbox" /> I confirm this is a disposable staging project, not production.</label><button type="submit" data-oc-permission="staging_fixture_create">Create disposable fixture set</button><label>Fixture set ID<input id="oc_fixture_set_id" /></label><button id="oc_fixture_cleanup" type="button" class="secondary" data-oc-permission="staging_fixture_cleanup">Clean fixture set</button></form></div><form id="oc_signal_form" class="operations-form"><label>Evidence source<select name="source_name"><option value="search_console">Search Console</option><option value="google_business_profile">Google Business Profile</option><option value="manual_analytics">Manual analytics</option></select></label><label>Route key<input name="route_key" /></label><label>Observation date<input name="observation_date" type="date" value="${todayValue}" /></label><label>Impressions<input name="impressions" type="number" min="0" /></label><label>Clicks<input name="clicks" type="number" min="0" /></label><label>Average position<input name="average_position" type="number" min="0" step="0.01" /></label><label>Calls<input name="calls" type="number" min="0" /></label><label>Website visits<input name="website_visits" type="number" min="0" /></label><label class="operations-span">Evidence URL<input name="evidence_url" type="url" placeholder="Optional Search Console/GBP report URL" /></label><label class="operations-span">Human note<input name="notes" /></label><button type="submit" data-oc-permission="content_signal_record">Record route evidence</button></form><h4>Route/content decision queue</h4><div id="oc_signal_queue" class="oc-live-queue"></div><h4>Payment-provider alert queue</h4><div id="oc_webhook_alerts" class="oc-live-queue"></div></details>
      </div></section>`;
  }

  function bind() {
    byId('oc_live_update_form')?.addEventListener('submit', (e) => handleLiveUpdate(e).catch((err) => status(err?.message || 'Live work update failed.', true)));
    byId('oc_payment_form')?.addEventListener('submit', (e) => handlePayment(e).catch(() => {}));
    byId('oc_bank_form')?.addEventListener('submit', (e) => handleBankPreview(e).catch((err) => status(err.message, true)));
    byId('oc_bank_confirm')?.addEventListener('click', () => handleBankConfirm().catch((err) => status(err.message, true)));
    byId('oc_recon_form')?.addEventListener('submit', (e) => handleReconciliation(e).catch(() => {}));
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
      const suggestion = event.target.closest('.oc-suggestion'); if (suggestion) { byId('oc_recon_target').value = suggestion.dataset.ref || ''; byId('oc_recon_action').value = 'match'; status(`Selected ${suggestion.dataset.ref}. Submit to validate the exact amount and record the match.`); }
    });
  }
  function inject() {
    const admin = byId('admin'); if (!admin || byId('operationsCockpit')) return;
    const anchor = byId('ad_stats_grid') || admin.querySelector('.section-heading'); if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', panelHtml()); bind(); restoreDraft(); renderRetry(); routeReadiness(); hydrateBankSelects(); hydrateLiveUpdateSelects(); loadQueues(true);
  }

  const observer = new MutationObserver(inject);
  document.addEventListener('DOMContentLoaded', () => { inject(); observer.observe(document.body, { childList:true, subtree:true }); });
  document.addEventListener('ywi:auth-changed', () => setTimeout(() => { inject(); loadQueues(true); }, 0));
  window.addEventListener('beforeunload', stopCamera);
})();
