/* Operations Cockpit - schema 149
   Responsive Admin forms for payment, bank CSV, reconciliation, equipment,
   visual assets, and public route approvals with local retry fallback. */
'use strict';

(function () {
  const BUILD = '2026-06-17a';
  const RETRY_KEY = 'ywi_operations_cockpit_retry_v1';
  const DRAFT_KEY = 'ywi_operations_cockpit_draft_v1';
  let cameraStream = null;
  let scanTimer = null;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const idempotency = (prefix) => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  const byId = (id) => document.getElementById(id);

  function status(message, isError = false) {
    const el = byId('oc_status');
    if (!el) return;
    el.textContent = message;
    el.dataset.status = isError ? 'error' : 'ok';
    el.hidden = false;
  }

  function saveRetry(payload, label) {
    try {
      localStorage.setItem(RETRY_KEY, JSON.stringify({ payload, label, saved_at: new Date().toISOString() }));
      renderRetry();
    } catch {}
  }
  function clearRetry() {
    try { localStorage.removeItem(RETRY_KEY); } catch {}
    renderRetry();
  }
  function getRetry() {
    try { return JSON.parse(localStorage.getItem(RETRY_KEY) || 'null'); } catch { return null; }
  }
  function saveDraft() {
    const fields = [...document.querySelectorAll('#operationsCockpit [name]')];
    const data = {};
    fields.forEach((field) => {
      if (field.type === 'file') return;
      data[field.name] = field.type === 'checkbox' ? field.checked : field.value;
    });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
  }
  function restoreDraft() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch {}
    Object.entries(data).forEach(([name, value]) => {
      const field = document.querySelector(`#operationsCockpit [name="${CSS.escape(name)}"]`);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = !!value;
      else if (!field.value) field.value = String(value ?? '');
    });
  }

  async function send(payload, label) {
    if (!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    status(`${label}…`);
    try {
      const response = await window.YWIAPI.manageOperations(payload);
      if (!response?.ok) throw new Error(response?.error || `${label} failed.`);
      clearRetry();
      status(`${label} completed.`);
      document.dispatchEvent(new CustomEvent('ywi:operations-cockpit-updated', { detail: { action: payload.action, response } }));
      return response;
    } catch (error) {
      saveRetry(payload, label);
      status(`${error?.message || label + ' failed.'} A retry copy was saved on this device.`, true);
      throw error;
    }
  }

  function renderRetry() {
    const wrap = byId('oc_retry_wrap');
    const item = getRetry();
    if (!wrap) return;
    wrap.hidden = !item;
    if (item) byId('oc_retry_text').textContent = `${item.label || item.payload?.action || 'Operation'} saved ${new Date(item.saved_at).toLocaleString()}`;
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function renderBankRows(parsed) {
    const tbody = byId('oc_bank_preview_rows');
    const summary = byId('oc_bank_preview_summary');
    if (!tbody || !summary) return;
    summary.textContent = parsed.errors?.length
      ? parsed.errors.join(' ')
      : `${parsed.rows.length} row(s) parsed. Only the first 20 are shown before server validation.`;
    const headers = parsed.headers.slice(0, 5);
    tbody.innerHTML = parsed.rows.slice(0, 20).map((row, index) => `<tr><td>${index + 1}</td>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">No rows parsed.</td></tr>';
    byId('oc_bank_preview_headers').innerHTML = `<tr><th>#</th>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  }

  async function handlePayment(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    await send({
      action: 'payment_action_request',
      idempotency_key: idempotency('payment'),
      action_type: data.action_type,
      customer_or_vendor_name: data.customer_or_vendor_name,
      invoice_reference: data.invoice_reference,
      payment_reference: data.payment_reference,
      amount: Number(data.amount || 0),
      reason: data.reason,
      proof_required: true,
      proof_reference: data.proof_reference
    }, 'Payment action request');
    event.currentTarget.reset();
    saveDraft();
  }

  async function handleBankPreview(event) {
    event.preventDefault();
    const file = byId('oc_bank_file')?.files?.[0];
    if (!file) throw new Error('Choose a CSV file first.');
    const text = await file.text();
    const parsed = window.YWIAPI?.parseBankCsvPreviewText?.(text, 1000);
    if (!parsed || parsed.errors?.length) throw new Error(parsed?.errors?.join(' ') || 'CSV parsing failed.');
    renderBankRows(parsed);
    const response = await send({
      action: 'bank_csv_preview',
      idempotency_key: idempotency('bank'),
      original_filename: file.name,
      bank_account_hint: byId('oc_bank_account_hint')?.value || '',
      headers: parsed.headers,
      rows: parsed.rows
    }, 'Bank CSV preview');
    byId('oc_bank_import_id').value = response?.batch?.id || '';
    byId('oc_bank_server_summary').textContent = `Accepted ${response?.summary?.accepted || 0}; rejected ${response?.summary?.rejected || 0}; possible duplicates ${response?.summary?.duplicates || 0}.`;
  }

  async function handleBankConfirm() {
    const importId = byId('oc_bank_import_id')?.value?.trim();
    if (!importId) throw new Error('Create a bank preview before confirming it.');
    await send({ action: 'bank_csv_confirm_import', import_id: importId, confirmation_note: byId('oc_bank_confirmation_note')?.value || '' }, 'Bank CSV confirmation');
  }

  async function handleReconciliation(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    let splitRows = [];
    if (String(data.split_rows || '').trim()) {
      try { splitRows = JSON.parse(String(data.split_rows)); } catch { throw new Error('Split rows must be valid JSON.'); }
    }
    await send({
      action: 'reconciliation_action',
      idempotency_key: idempotency('recon'),
      action_type: data.action_type,
      import_id: data.import_id,
      bank_row_id: data.bank_row_id,
      target_reference: data.target_reference,
      split_rows: splitRows,
      signoff_note: data.signoff_note
    }, 'Reconciliation action');
  }

  async function handleEquipment(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    await send({
      action: 'equipment_scan_event',
      idempotency_key: idempotency('equipment'),
      scan_code: data.scan_code,
      scan_source: data.scan_source || 'manual',
      scan_stage: data.scan_stage,
      custody_stage: data.scan_stage,
      equipment_reference: data.equipment_reference || data.scan_code,
      job_reference: data.job_reference,
      condition_summary: data.condition_summary,
      accessory_summary: data.accessory_summary,
      signer_name: data.signer_name,
      service_required: !!event.currentTarget.elements.service_required.checked,
      cost_recovery_required: !!event.currentTarget.elements.cost_recovery_required.checked,
      notes: data.notes
    }, 'Equipment custody event');
  }

  async function handleAsset(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    await send({
      action: 'visual_asset_register',
      asset_status: data.asset_status,
      surface_area: data.surface_area,
      image_role: data.image_role,
      source_url: data.source_url,
      alt_text: data.alt_text,
      consent_status: data.consent_status,
      compression_status: data.compression_status,
      route_key: data.route_key,
      notes: data.notes
    }, 'Visual asset registration');
  }

  function routeReadiness() {
    const title = byId('oc_route_title')?.value.trim() || '';
    const h1 = byId('oc_route_h1')?.value.trim() || '';
    const meta = byId('oc_route_meta')?.value.trim() || '';
    const proof = byId('oc_route_proof')?.value.trim() || '';
    const cta = byId('oc_route_cta')?.value.trim() || '';
    const checks = [title.length >= 20 && title.length <= 70, h1.length >= 10 && h1.length <= 120, meta.length >= 70 && meta.length <= 170, proof.length >= 20, cta.startsWith('/') || cta.startsWith('#')];
    const score = checks.filter(Boolean).length * 20;
    const el = byId('oc_route_score');
    if (el) { el.textContent = `${score}% ready`; el.dataset.score = String(score); }
    return score;
  }

  async function handleRoute(event) {
    event.preventDefault();
    const data = formData(event.currentTarget);
    await send({
      action: 'public_route_register',
      route_key: data.route_key,
      route_status: data.route_status,
      route_path: data.route_path,
      page_title: data.page_title,
      h1_text: data.h1_text,
      meta_description: data.meta_description,
      local_proof_hint: data.local_proof_hint,
      primary_cta_path: data.primary_cta_path,
      visual_asset_key: data.visual_asset_key,
      sitemap_ready: routeReadiness() === 100
    }, 'Public route registration');
  }

  async function stopCamera() {
    if (scanTimer) cancelAnimationFrame(scanTimer);
    scanTimer = null;
    cameraStream?.getTracks?.().forEach((track) => track.stop());
    cameraStream = null;
    const video = byId('oc_scan_video');
    if (video) { video.srcObject = null; video.hidden = true; }
  }

  async function startCamera() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      status('Camera scanning is not supported in this browser. Use manual code entry.', true);
      byId('oc_scan_code')?.focus();
      return;
    }
    await stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const video = byId('oc_scan_video');
    video.hidden = false;
    video.srcObject = cameraStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e'] });
    const scan = async () => {
      if (!cameraStream) return;
      try {
        const codes = await detector.detect(video);
        if (codes?.[0]?.rawValue) {
          byId('oc_scan_code').value = codes[0].rawValue;
          byId('oc_scan_source').value = 'camera';
          status(`Scanned ${codes[0].rawValue}. Review and save the custody event.`);
          await stopCamera();
          return;
        }
      } catch {}
      scanTimer = requestAnimationFrame(scan);
    };
    scan();
  }

  function panelHtml() {
    return `
      <section id="operationsCockpit" class="operations-cockpit admin-panel-block" data-admin-panel-title="Operations Cockpit" aria-labelledby="oc_title">
        <div class="section-heading operations-cockpit-heading">
          <div><span class="operations-kicker">Schema 149 live actions</span><h3 id="oc_title">Operations Cockpit</h3><p class="section-subtitle">Create and validate accounting, bank, reconciliation, equipment, visual, and SEO route actions from desktop or mobile. Failed submissions keep a local retry copy.</p></div>
          <div class="section-graphic-placeholder operations-graphic"><span aria-hidden="true">⌁</span><strong>Live workflow control</strong><small>Future approved visual: office dashboard connected to field-mobile actions.</small></div>
        </div>
        <div id="oc_status" class="operations-status" hidden aria-live="polite"></div>
        <div id="oc_retry_wrap" class="operations-retry" hidden><span id="oc_retry_text"></span><button id="oc_retry_btn" type="button">Retry saved action</button><button id="oc_retry_clear" class="secondary" type="button">Discard retry</button></div>
        <div class="operations-scorecards" aria-label="Implementation progress">
          <article><span>Quote intake</span><strong>80%</strong><progress max="100" value="80"></progress></article>
          <article><span>Payment actions</span><strong>60%</strong><progress max="100" value="60"></progress></article>
          <article><span>Bank/reconciliation</span><strong>65%</strong><progress max="100" value="65"></progress></article>
          <article><span>Equipment custody</span><strong>60%</strong><progress max="100" value="60"></progress></article>
          <article><span>Assets/routes</span><strong>65%</strong><progress max="100" value="65"></progress></article>
        </div>
        <div class="operations-grid">
          <details open><summary>Payment action</summary><form id="oc_payment_form" class="operations-form">
            <label>Action<select name="action_type"><option value="apply_payment">Apply payment</option><option value="reverse_payment">Reverse payment</option><option value="refund">Refund</option><option value="write_off">Write-off</option><option value="overpayment_credit">Overpayment credit</option></select></label>
            <label>Customer/vendor<input name="customer_or_vendor_name" required /></label><label>Invoice reference<input name="invoice_reference" /></label><label>Payment reference<input name="payment_reference" /></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Proof reference<input name="proof_reference" required placeholder="Receipt, bank row, or attachment reference" /></label><label class="operations-span">Reason<textarea name="reason" minlength="8" required></textarea></label><button type="submit">Submit payment action</button>
          </form></details>
          <details><summary>Bank CSV preview</summary><form id="oc_bank_form" class="operations-form">
            <label class="operations-span">CSV file<input id="oc_bank_file" type="file" accept=".csv,text/csv" required /></label><label>Bank account hint<input id="oc_bank_account_hint" /></label><button type="submit">Parse and validate</button><input id="oc_bank_import_id" type="hidden" /><label class="operations-span">Confirmation note<input id="oc_bank_confirmation_note" /></label><button id="oc_bank_confirm" type="button" class="secondary">Confirm accepted rows</button>
          </form><p id="oc_bank_preview_summary" class="muted"></p><p id="oc_bank_server_summary" class="muted"></p><div class="table-scroll"><table><thead id="oc_bank_preview_headers"></thead><tbody id="oc_bank_preview_rows"></tbody></table></div></details>
          <details><summary>Reconciliation action</summary><form id="oc_recon_form" class="operations-form">
            <label>Action<select name="action_type"><option value="match">Match</option><option value="split">Split</option><option value="undo">Undo</option><option value="signoff">Sign off</option><option value="reject">Reject</option></select></label><label>Import ID<input name="import_id" /></label><label>Bank row ID<input name="bank_row_id" /></label><label>Target reference<input name="target_reference" /></label><label class="operations-span">Split rows JSON<textarea name="split_rows" placeholder='[{"reference":"INV-1","amount":100},{"reference":"INV-2","amount":50}]'></textarea></label><label class="operations-span">Signoff/decision note<textarea name="signoff_note"></textarea></label><button type="submit">Submit reconciliation action</button>
          </form></details>
          <details><summary>Equipment scan and custody</summary><form id="oc_equipment_form" class="operations-form">
            <label>Scan code<input id="oc_scan_code" name="scan_code" required /></label><input id="oc_scan_source" name="scan_source" type="hidden" value="manual" /><label>Stage<select name="scan_stage"><option value="checkout">Checkout</option><option value="site_arrival">Site arrival</option><option value="return">Return</option><option value="return_to_service">Return to service</option><option value="field_check">Field check</option></select></label><label>Equipment reference<input name="equipment_reference" /></label><label>Job reference<input name="job_reference" /></label><label>Condition<input name="condition_summary" /></label><label>Accessories<input name="accessory_summary" /></label><label>Signer<input name="signer_name" /></label><label class="operations-inline-check"><input name="service_required" type="checkbox" /> Service required</label><label class="operations-inline-check"><input name="cost_recovery_required" type="checkbox" /> Cost recovery review</label><label class="operations-span">Notes<textarea name="notes"></textarea></label><div class="operations-actions"><button type="submit">Save custody event</button><button id="oc_camera_start" type="button" class="secondary">Scan QR/barcode</button><button id="oc_camera_stop" type="button" class="secondary">Stop camera</button></div><video id="oc_scan_video" class="operations-scan-video" playsinline muted hidden></video>
          </form></details>
          <details><summary>Visual asset approval intake</summary><form id="oc_asset_form" class="operations-form">
            <label>Status<select name="asset_status"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option></select></label><label>Surface<input name="surface_area" value="public" /></label><label>Image role<input name="image_role" value="placeholder_replacement" /></label><label class="operations-span">Source URL<input name="source_url" type="url" /></label><label class="operations-span">Alt text<input name="alt_text" minlength="12" /></label><label>Consent<select name="consent_status"><option value="not_required">Not required</option><option value="approved">Approved</option><option value="pending">Pending</option></select></label><label>Compression<select name="compression_status"><option value="pending">Pending</option><option value="ready">Ready</option><option value="optimized">Optimized</option></select></label><label>Route key<input name="route_key" /></label><label class="operations-span">Notes<textarea name="notes"></textarea></label><button type="submit">Register visual asset</button>
          </form></details>
          <details><summary>Public route approval</summary><form id="oc_route_form" class="operations-form">
            <div class="operations-readiness"><span id="oc_route_score">0% ready</span><small>Title 20–70, H1 10–120, meta 70–170, local proof, and CTA are required for approval.</small></div><label>Route key<input name="route_key" required /></label><label>Path<input name="route_path" value="/" required /></label><label>Status<select name="route_status"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option></select></label><label class="operations-span">Page title<input id="oc_route_title" name="page_title" maxlength="70" required /></label><label class="operations-span">One H1 text<input id="oc_route_h1" name="h1_text" maxlength="120" required /></label><label class="operations-span">Meta description<textarea id="oc_route_meta" name="meta_description" maxlength="170"></textarea></label><label class="operations-span">Local proof<input id="oc_route_proof" name="local_proof_hint" /></label><label>Primary CTA path<input id="oc_route_cta" name="primary_cta_path" placeholder="#quote-intake" /></label><label>Visual asset key<input name="visual_asset_key" /></label><button type="submit">Save route approval row</button>
          </form></details>
        </div>
      </section>`;
  }

  function inject() {
    const admin = byId('admin');
    if (!admin || byId('operationsCockpit')) return;
    const anchor = byId('ad_stats_grid') || admin.querySelector('.section-heading');
    if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', panelHtml());
    bind();
    restoreDraft();
    renderRetry();
    routeReadiness();
  }

  function bind() {
    byId('oc_payment_form')?.addEventListener('submit', (e) => handlePayment(e).catch(() => {}));
    byId('oc_bank_form')?.addEventListener('submit', (e) => handleBankPreview(e).catch((err) => status(err.message, true)));
    byId('oc_bank_confirm')?.addEventListener('click', () => handleBankConfirm().catch((err) => status(err.message, true)));
    byId('oc_recon_form')?.addEventListener('submit', (e) => handleReconciliation(e).catch(() => {}));
    byId('oc_equipment_form')?.addEventListener('submit', (e) => handleEquipment(e).catch(() => {}));
    byId('oc_asset_form')?.addEventListener('submit', (e) => handleAsset(e).catch(() => {}));
    byId('oc_route_form')?.addEventListener('submit', (e) => handleRoute(e).catch(() => {}));
    byId('oc_route_form')?.addEventListener('input', routeReadiness);
    byId('oc_camera_start')?.addEventListener('click', () => startCamera().catch((err) => status(err.message, true)));
    byId('oc_camera_stop')?.addEventListener('click', stopCamera);
    byId('oc_retry_btn')?.addEventListener('click', async () => {
      const item = getRetry();
      if (!item?.payload) return;
      await send(item.payload, `Retry ${item.label || item.payload.action}`).catch(() => {});
    });
    byId('oc_retry_clear')?.addEventListener('click', clearRetry);
    byId('operationsCockpit')?.addEventListener('input', saveDraft);
  }

  const observer = new MutationObserver(inject);
  document.addEventListener('DOMContentLoaded', () => {
    inject();
    observer.observe(document.body, { childList: true, subtree: true });
  });
  document.addEventListener('ywi:auth-changed', () => setTimeout(inject, 0));
  window.addEventListener('beforeunload', stopCamera);
})();
