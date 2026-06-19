/* Operations Cockpit - schema 150
   Live Admin work queues, row-level approvals/posting, bank promotion,
   exact reconciliation, equipment resolution, public media upload, route
   publication, quote follow-up, dispatch, deposits, and job-cost refresh. */
'use strict';

(function () {
  const BUILD = '2026-06-17b';
  const RETRY_KEY = 'ywi_operations_cockpit_retry_v2';
  const DRAFT_KEY = 'ywi_operations_cockpit_draft_v2';
  let cameraStream = null;
  let scanTimer = null;
  let queues = {};
  let queueLoading = false;

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
  const button = (label, action, id, extra = '', secondary = false) => `<button type="button" class="${secondary ? 'secondary ' : ''}oc-row-action" data-oc-action="${esc(action)}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
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
    wrap.innerHTML = rails.length ? rails.map((rail) => `<article><span>${esc(rail.rail_title)}</span><strong>${Number(rail.progress_percent || 0)}%</strong><progress max="100" value="${Number(rail.progress_percent || 0)}"></progress><small>${esc(short(rail.next_action_hint, 120))}</small></article>`).join('') : emptyQueue('Progress data unavailable', 'Apply schema 150 and refresh.');
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

  function renderReconQueue() {
    const wrap = byId('oc_recon_queue'); if (!wrap) return;
    const items = queues.bank_items || [];
    const history = queues.reconciliation || [];
    const itemHtml = items.length ? items.map((row) => `<article class="oc-queue-card"><header><strong>${esc(row.item_description || 'Bank row')}</strong><span class="${statusClass(row.match_status)}">${esc(row.match_status)}</span></header><dl><div><dt>Date</dt><dd>${esc(row.item_date || '—')}</dd></div><div><dt>Amount</dt><dd>${money(row.amount)}</dd></div><div><dt>Item ID</dt><dd><code>${esc(row.id)}</code></dd></div><div><dt>Exception</dt><dd>${esc(row.difference_reason || '—')}</dd></div></dl>${buttons([button('Find matches','recon-suggest',row.id), button('Use for match','recon-use',row.id,'',true), button('Reject','recon-reject',row.id,'',true)])}</article>`).join('') : emptyQueue('No open reconciliation rows', 'Confirmed CSV rows will appear here until matched or signed off.');
    const historyHtml = history.slice(0, 10).map((row) => `<li><strong>${esc(row.action_type)}</strong> · ${esc(row.action_status)} · ${row.match_score ?? '—'}% · ${esc(short(row.match_explanation?.summary || row.decision_note || '', 120))}</li>`).join('');
    wrap.innerHTML = `${itemHtml}${historyHtml ? `<details class="oc-queue-history"><summary>Recent reconciliation decisions</summary><ul>${historyHtml}</ul></details>` : ''}`;
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
    wrap.innerHTML = rows.length ? rows.map((row) => `<article class="oc-queue-card oc-media-card"><div class="oc-media-thumb">${row.thumbnail_url || row.public_url || row.source_url ? `<img src="${esc(row.thumbnail_url || row.public_url || row.source_url)}" alt="" loading="lazy" />` : '<span aria-hidden="true">▧</span>'}</div><div class="oc-media-body"><header><strong>${esc(row.asset_key)}</strong><span class="${statusClass(row.asset_status)}">${esc(row.asset_status)}</span></header><dl><div><dt>Role / route</dt><dd>${esc(row.image_role)} · ${esc(row.route_key || 'general')}</dd></div><div><dt>Dimensions</dt><dd>${Number(row.pixel_width || 0)}×${Number(row.pixel_height || 0)} · ${Math.round(Number(row.file_size_bytes || 0)/1024)} KB</dd></div><div><dt>Readiness</dt><dd>${Number(row.readiness_score || 0)}% · ${row.publication_ready ? 'publication ready' : 'blocked'}</dd></div><div><dt>Alt</dt><dd>${esc(short(row.alt_text || 'Missing', 150))}</dd></div></dl>${buttons([row.asset_status !== 'approved' ? button('Approve','asset-approve',row.id) : '', row.asset_status !== 'rejected' ? button('Reject','asset-reject',row.id,'',true) : ''])}</div></article>`).join('') : emptyQueue('No visual assets', 'Uploaded and linked images will appear here for consent and publication review.');
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

  function renderQueues() {
    renderRails(); renderPaymentQueue(); renderBankQueue(); renderReconQueue(); renderEquipmentQueue(); renderAssetQueue(); renderRouteQueue(); renderQuoteQueue(); renderPortalQueue();
  }
  function hydrateBankSelects() {
    const options = `<option value="">Choose bank account</option>${(queues.banks || []).map((bank) => `<option value="${esc(bank.id)}">${esc(bank.account_name)}${bank.is_default ? ' (default)' : ''}</option>`).join('')}`;
    document.querySelectorAll('[data-oc-bank-select]').forEach((select) => { const current = select.value; select.innerHTML = options; if (current) select.value = current; });
  }

  function renderBankRows(parsed) {
    const tbody = byId('oc_bank_preview_rows'); const summary = byId('oc_bank_preview_summary');
    if (!tbody || !summary) return;
    summary.textContent = parsed.errors?.length ? parsed.errors.join(' ') : `${parsed.rows.length} row(s) parsed. The first 20 are shown before server validation.`;
    const headers = parsed.headers.slice(0, 5);
    tbody.innerHTML = parsed.rows.slice(0, 20).map((row, index) => `<tr><td>${index + 1}</td>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">No rows parsed.</td></tr>';
    byId('oc_bank_preview_headers').innerHTML = `<tr><th>#</th>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
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
    byId('oc_recon_explanation').textContent = response?.match_explanation?.summary || 'Reconciliation action recorded.';
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
    byId('oc_asset_preview').innerHTML = `<img src="${esc(response?.record?.thumbnail_url || response?.record?.public_url)}" alt="" /><span>${esc(response?.record?.asset_key || '')}</span>`;
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
    if (!action || !id) return;
    if (action.startsWith('payment-')) {
      const decision = action.split('-')[1]; const note = ['reject','cancel'].includes(decision) ? prompt('Decision note (required):') : '';
      if (['reject','cancel'].includes(decision) && !note) return;
      await send({ action:'payment_action_decision', request_id:id, decision, decision_note:note || '' }, `Payment ${decision}`); return;
    }
    if (action === 'bank-promote') { await handleBankConfirm(id); return; }
    if (action === 'bank-use-session') { byId('oc_recon_import_id').value = id; byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if (action === 'recon-use') { byId('oc_recon_row_id').value = id; byId('oc_recon_action').value = 'match'; byId('oc_recon_form')?.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if (action === 'recon-suggest') {
      const response = await send({ action:'reconciliation_suggest', bank_row_id:id }, 'Finding reconciliation matches', false);
      const suggestions = response?.suggestions || []; byId('oc_recon_row_id').value = id;
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
    if (action === 'deposit-paid') { const reference = prompt('Payment reference:'); if (!reference) return; await send({ action:'deposit_status_update', deposit_id:id, deposit_status:'paid', payment_reference:reference }, 'Deposit status update'); return; }
    if (action === 'job-cost-refresh') { await send({ action:'job_cost_refresh', job_id:Number(id) }, 'Live job-cost refresh'); }
  }

  function panelHtml() {
    const todayValue = new Date().toISOString().slice(0,10);
    return `<section id="operationsCockpit" class="operations-cockpit admin-panel-block" data-admin-panel-title="Operations Cockpit" aria-labelledby="oc_title">
      <div class="section-heading operations-cockpit-heading"><div><span class="operations-kicker">Schema 150 end-to-end actions</span><h3 id="oc_title">Operations Cockpit</h3><p class="section-subtitle">Approve, post, reconcile, resolve, publish, schedule, and review the same records from desktop or mobile. Failed writes keep one local retry copy.</p></div><div class="section-graphic-placeholder operations-graphic"><span aria-hidden="true">⌁</span><strong>Live workflow control</strong><small>Replace with an approved dashboard/workshop photograph after consent and image review.</small></div></div>
      <div id="oc_status" class="operations-status" hidden aria-live="polite"></div>
      <div id="oc_retry_wrap" class="operations-retry" hidden><span id="oc_retry_text"></span><button id="oc_retry_btn" type="button">Retry saved action</button><button id="oc_retry_clear" class="secondary" type="button">Discard retry</button></div>
      <div class="operations-toolbar"><button id="oc_refresh" type="button">Refresh all live queues</button><span>Build ${BUILD}</span></div>
      <div id="oc_scorecards" class="operations-scorecards" aria-label="Implementation progress"></div>
      <div class="operations-grid">
        <details open><summary>Quote owners, alerts, and follow-up</summary><p class="muted">Assign each request, set a due time, and preserve every contact event.</p><div id="oc_quote_queue" class="oc-live-queue"></div></details>
        <details open><summary>Payment action and posting</summary><form id="oc_payment_form" class="operations-form">
          <label>Action<select name="action_type"><option value="apply_payment">Apply payment</option><option value="reverse_payment">Reverse payment</option><option value="refund">Refund</option><option value="write_off">Write-off</option><option value="overpayment_credit">Overpayment credit</option></select></label>
          <label>Ledger side<select name="ledger_side"><option value="auto">Auto resolve</option><option value="ar">Accounts receivable</option><option value="ap">Accounts payable</option></select></label>
          <label>Bank account<select name="bank_account_id" data-oc-bank-select></select></label><label>Date<input id="oc_payment_date" name="transaction_date" type="date" value="${todayValue}" required /></label>
          <label>Customer/vendor<input name="customer_or_vendor_name" required /></label><label>Invoice/bill reference<input name="invoice_reference" /></label><label>Payment reference<input name="payment_reference" /></label><label>Reversal request ID<input name="reversal_of_request_id" /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Proof reference<input name="proof_reference" required placeholder="Receipt, bank row, or attachment reference" /></label><label class="operations-span">Reason<textarea name="reason" minlength="8" required></textarea></label><button type="submit">Submit for approval</button>
        </form><h4>Live payment queue</h4><div id="oc_payment_queue" class="oc-live-queue"></div></details>
        <details><summary>Bank CSV preview and promotion</summary><form id="oc_bank_form" class="operations-form"><label class="operations-span">CSV file<input id="oc_bank_file" type="file" accept=".csv,text/csv" required /></label><label>Bank account<select id="oc_bank_account" data-oc-bank-select></select></label><label>Fallback bank hint<input id="oc_bank_account_hint" /></label><button type="submit">Parse and validate</button><input id="oc_bank_import_id" type="hidden" /><label class="operations-span">Confirmation note<input id="oc_bank_confirmation_note" /></label><button id="oc_bank_confirm" type="button" class="secondary">Confirm and promote accepted rows</button></form><p id="oc_bank_preview_summary" class="muted"></p><p id="oc_bank_server_summary" class="muted"></p><div class="table-scroll"><table><thead id="oc_bank_preview_headers"></thead><tbody id="oc_bank_preview_rows"></tbody></table></div><h4>Live import queue</h4><div id="oc_bank_queue" class="oc-live-queue"></div></details>
        <details><summary>Reconciliation scoring, split, sign-off, and undo</summary><form id="oc_recon_form" class="operations-form"><label>Action<select id="oc_recon_action" name="action_type"><option value="match">Exact match</option><option value="split">Exact split</option><option value="undo">Undo prior action</option><option value="signoff">Sign off session</option><option value="reject">Exception/reject</option></select></label><label>Import/session ID<input id="oc_recon_import_id" name="import_id" /></label><label>Promoted bank item ID<input id="oc_recon_row_id" name="bank_row_id" /></label><label>Target reference<input id="oc_recon_target" name="target_reference" /></label><label>Prior action ID for undo<input name="undo_of_action_id" /></label><label class="operations-span">Split rows JSON<textarea name="split_rows" placeholder='[{"reference":"INV-1","amount":100},{"reference":"INV-2","amount":50}]'></textarea></label><label class="operations-span">Sign-off/decision note<textarea name="signoff_note"></textarea></label><button type="submit">Process reconciliation action</button></form><p id="oc_recon_explanation" class="operations-explanation muted"></p><div id="oc_recon_suggestions" class="oc-suggestions"></div><h4>Open bank rows</h4><div id="oc_recon_queue" class="oc-live-queue"></div></details>
        <details><summary>Equipment scan, service, and cost recovery</summary><form id="oc_equipment_form" class="operations-form"><label>Scan code<input id="oc_scan_code" name="scan_code" required /></label><input id="oc_scan_source" name="scan_source" type="hidden" value="manual" /><label>Stage<select name="scan_stage"><option value="checkout">Checkout</option><option value="site_arrival">Site arrival</option><option value="return">Return</option><option value="return_to_service">Return to service</option><option value="field_check">Field check</option></select></label><label>Equipment reference<input name="equipment_reference" /></label><label>Job code/ID<input name="job_reference" /></label><label>Condition<input name="condition_summary" /></label><label>Accessories<input name="accessory_summary" /></label><label>Signer<input name="signer_name" /></label><label>Estimated recovery cost<input name="estimated_cost" type="number" min="0" step="0.01" /></label><label class="operations-inline-check"><input name="service_required" type="checkbox" /> Service required</label><label class="operations-inline-check"><input name="cost_recovery_required" type="checkbox" /> Cost recovery review</label><label class="operations-inline-check"><input name="customer_billable" type="checkbox" /> Customer billable</label><label class="operations-span">Notes<textarea name="notes"></textarea></label><div class="operations-actions"><button type="submit">Resolve and save custody event</button><button id="oc_camera_start" type="button" class="secondary">Scan QR/barcode</button><button id="oc_camera_stop" type="button" class="secondary">Stop camera</button></div><video id="oc_scan_video" class="operations-scan-video" playsinline muted hidden></video></form><p id="oc_equipment_resolution" class="muted"></p><h4>Live service and scan queue</h4><div id="oc_equipment_queue" class="oc-live-queue"></div></details>
        <details><summary>Real visual upload and approval</summary><form id="oc_asset_form" class="operations-form"><label class="operations-span">Image file<input id="oc_asset_file" name="asset_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label><label>Status<select name="asset_status"><option value="review">Review</option><option value="draft">Draft</option></select></label><label>Surface<input name="surface_area" value="public" /></label><label>Image role<input name="image_role" value="placeholder_replacement" /></label><label class="operations-span">Existing source URL (file optional)<input name="source_url" type="url" /></label><label class="operations-span">Alt text<input name="alt_text" minlength="12" required /></label><label>Consent<select name="consent_status"><option value="not_required">Not required</option><option value="approved">Approved</option><option value="pending">Pending</option></select></label><label>Compression<select name="compression_status"><option value="optimized">Optimized</option><option value="ready">Ready</option><option value="pending">Pending</option></select></label><label>Route key<input name="route_key" /></label><label>Placeholder selector<input name="placeholder_selector" placeholder=".hero-visual" /></label><label>Known width for URL<input name="pixel_width" type="number" min="0" /></label><label>Known height for URL<input name="pixel_height" type="number" min="0" /></label><label class="operations-span">Notes<textarea name="notes"></textarea></label><button type="submit">Optimize, upload, and register</button><progress id="oc_asset_progress" max="100" value="0" hidden></progress><div id="oc_asset_preview" class="oc-asset-preview"></div></form><h4>Live visual approval queue</h4><div id="oc_asset_queue" class="oc-live-queue"></div></details>
        <details><summary>Approved public route and sitemap publication</summary><form id="oc_route_form" class="operations-form"><div class="operations-readiness"><span id="oc_route_score">0% ready</span><small>Title, one H1, meta, local proof, CTA, clean path, and approved visual are publication gates.</small></div><label>Route key<input name="route_key" required /></label><label>Path<input id="oc_route_path" name="route_path" value="/services/" required /></label><label>Type<select name="route_type"><option value="service">Service</option><option value="location">Location</option><option value="service_location">Service + location</option><option value="guide">Guide</option></select></label><label>Status<select name="route_status"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option></select></label><label>Service name<input name="service_name" /></label><label>Location name<input name="location_name" /></label><label class="operations-span">Page title<input id="oc_route_title" name="page_title" maxlength="70" required /></label><label class="operations-span">One H1 text<input id="oc_route_h1" name="h1_text" maxlength="120" required /></label><label class="operations-span">Meta description<textarea id="oc_route_meta" name="meta_description" maxlength="170"></textarea></label><label class="operations-span">Intro<textarea name="page_intro"></textarea></label><label class="operations-span">Body Markdown<textarea name="page_body_markdown" rows="8"></textarea></label><label class="operations-span">Local proof<input id="oc_route_proof" name="local_proof_hint" /></label><label>Primary CTA path<input id="oc_route_cta" name="primary_cta_path" placeholder="#quote-intake" /></label><label>Visual asset key<input name="visual_asset_key" /></label><label class="operations-span">Canonical URL<input name="canonical_url" type="url" /></label><button type="submit">Save route approval row</button></form><h4>Live route publication queue</h4><div id="oc_route_queue" class="oc-live-queue"></div></details>
        <details><summary>Customer portal, deposits, dispatch, and job cost</summary><p class="muted">Accepted customer quotes, hosted deposit status, work-order scheduling, and latest job margin are combined here.</p><div id="oc_portal_queue" class="oc-live-queue"></div></details>
      </div></section>`;
  }

  function bind() {
    byId('oc_payment_form')?.addEventListener('submit', (e) => handlePayment(e).catch(() => {}));
    byId('oc_bank_form')?.addEventListener('submit', (e) => handleBankPreview(e).catch((err) => status(err.message, true)));
    byId('oc_bank_confirm')?.addEventListener('click', () => handleBankConfirm().catch((err) => status(err.message, true)));
    byId('oc_recon_form')?.addEventListener('submit', (e) => handleReconciliation(e).catch(() => {}));
    byId('oc_equipment_form')?.addEventListener('submit', (e) => handleEquipment(e).catch(() => {}));
    byId('oc_asset_form')?.addEventListener('submit', (e) => handleAsset(e).catch((err) => status(err.message, true)));
    byId('oc_route_form')?.addEventListener('submit', (e) => handleRoute(e).catch(() => {}));
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
    anchor.insertAdjacentHTML('afterend', panelHtml()); bind(); restoreDraft(); renderRetry(); routeReadiness(); hydrateBankSelects(); loadQueues(true);
  }

  const observer = new MutationObserver(inject);
  document.addEventListener('DOMContentLoaded', () => { inject(); observer.observe(document.body, { childList:true, subtree:true }); });
  document.addEventListener('ywi:auth-changed', () => setTimeout(() => { inject(); loadQueues(true); }, 0));
  window.addEventListener('beforeunload', stopCamera);
})();
