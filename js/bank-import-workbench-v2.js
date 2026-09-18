/* Build 311 — Bank Import Workbench v2
   Saved per-bank/account column mappings, source-file fingerprinting, row-level review,
   bounded bulk decisions, retained import history, and discard-before-promotion controls.
   This UI reuses existing Finance authority; it never posts ledger entries or enables providers.
*/
(function bankImportWorkbenchV2(){
  'use strict';

  const BUILD = '311';
  const TEMPLATE_KEY = 'ywi_bank_import_column_templates_v2';
  const MAX_BULK = 100;
  let draft = null;
  let latestQueues = {};
  let activeImportId = '';

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = (value) => Number(value || 0).toLocaleString('en-CA',{style:'currency',currency:'CAD'});
  const when = (value) => value ? new Date(value).toLocaleString('en-CA') : '—';
  const clean = (value) => String(value ?? '').trim();
  const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function status(message, error = false){
    const el = byId('oc_status');
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('error', !!error);
  }

  async function api(payload){
    if (!window.YWIAPI?.manageOperations) throw new Error('Operations API is not loaded.');
    const response = await window.YWIAPI.manageOperations(payload);
    if (!response?.ok) throw new Error(response?.error || 'Bank import action failed.');
    return response;
  }

  function templateScope(){
    const bankId = clean(byId('oc_bank_account')?.value);
    if (bankId) return `bank:${bankId}`;
    const hint = clean(byId('oc_bank_account_hint')?.value).toLowerCase();
    return hint ? `hint:${hint}` : 'default';
  }

  function templates(){
    try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function readMapping(){
    return {
      date: clean(byId('oc_bank311_map_date')?.value),
      description: clean(byId('oc_bank311_map_description')?.value),
      amount: clean(byId('oc_bank311_map_amount')?.value),
      debit: clean(byId('oc_bank311_map_debit')?.value),
      credit: clean(byId('oc_bank311_map_credit')?.value),
      reference: clean(byId('oc_bank311_map_reference')?.value)
    };
  }

  function saveTemplate(){
    if (!draft?.headers?.length) throw new Error('Choose and parse a CSV file before saving a mapping.');
    const all = templates();
    all[templateScope()] = { mapping:readMapping(), headers:draft.headers, saved_at:new Date().toISOString() };
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(all));
    status(`Saved this column template for ${templateScope()}.`);
  }

  function guessedHeader(headers, aliases){
    const normalized = headers.map((header) => [header, header.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()]);
    for (const alias of aliases) {
      const exact = normalized.find(([,value]) => value === alias);
      if (exact) return exact[0];
    }
    for (const alias of aliases) {
      const partial = normalized.find(([,value]) => value.includes(alias));
      if (partial) return partial[0];
    }
    return '';
  }

  function defaultMapping(headers){
    return {
      date: guessedHeader(headers,['date','transaction date','posted date','posting date']),
      description: guessedHeader(headers,['description','memo','details','transaction']),
      amount: guessedHeader(headers,['amount','transaction amount','value']),
      debit: guessedHeader(headers,['debit','withdrawal','money out']),
      credit: guessedHeader(headers,['credit','deposit','money in']),
      reference: guessedHeader(headers,['reference','reference number','transaction id','cheque number','id'])
    };
  }

  function applyMappingToControls(headers){
    const saved = templates()[templateScope()]?.mapping || {};
    const mapping = { ...defaultMapping(headers), ...Object.fromEntries(Object.entries(saved).filter(([,value]) => headers.includes(value))) };
    const options = `<option value="">Not used</option>${headers.map((header)=>`<option value="${esc(header)}">${esc(header)}</option>`).join('')}`;
    for (const key of ['date','description','amount','debit','credit','reference']) {
      const select = byId(`oc_bank311_map_${key}`);
      if (!select) continue;
      select.innerHTML = options;
      select.value = mapping[key] || '';
    }
  }

  async function sha256(text){
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,'0')).join('');
  }

  function renderRawPreview(parsed){
    const tbody = byId('oc_bank_preview_rows');
    const head = byId('oc_bank_preview_headers');
    const summary = byId('oc_bank_preview_summary');
    if (!tbody || !head || !summary) return;
    const headers = parsed.headers.slice(0,6);
    head.innerHTML = `<tr><th>#</th>${headers.map((h)=>`<th>${esc(h)}</th>`).join('')}</tr>`;
    tbody.innerHTML = parsed.rows.slice(0,20).map((row,index)=>`<tr><td>${index+1}</td>${headers.map((h)=>`<td>${esc(row[h])}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="7">No rows parsed.</td></tr>';
    summary.textContent = `${parsed.rows.length} row(s) parsed locally. Review the mapping, then validate mapped rows on the server.`;
  }

  async function parseSelectedFile(){
    const file = byId('oc_bank_file')?.files?.[0];
    if (!file) { draft = null; return; }
    const text = await file.text();
    const parsed = window.YWIAPI?.parseBankCsvPreviewText?.(text,2500);
    if (!parsed || parsed.errors?.length) throw new Error(parsed?.errors?.join(' ') || 'CSV parsing failed.');
    draft = {
      fileName:file.name,
      fileSize:file.size,
      fileLastModified:file.lastModified ? new Date(file.lastModified).toISOString() : null,
      text,
      sha256:await sha256(text),
      headers:parsed.headers,
      rows:parsed.rows
    };
    applyMappingToControls(parsed.headers);
    renderRawPreview(parsed);
    const trace = byId('oc_bank311_source_trace');
    if (trace) trace.textContent = `Source trace: ${file.name} · ${file.size.toLocaleString()} bytes · SHA-256 ${draft.sha256.slice(0,16)}…`;
    status('CSV parsed locally. Review the saved/guessed column mapping before server validation.');
  }

  function mappedRows(){
    if (!draft?.rows?.length) throw new Error('Choose a CSV file first.');
    const map = readMapping();
    if (!map.date || !map.description) throw new Error('Map both Date and Description.');
    if (!map.amount && !map.debit && !map.credit) throw new Error('Map Amount, or map Debit/Credit.');
    return draft.rows.map((source)=>({
      date: map.date ? source[map.date] : '',
      description: map.description ? source[map.description] : '',
      amount: map.amount ? source[map.amount] : '',
      debit: map.debit ? source[map.debit] : '',
      credit: map.credit ? source[map.credit] : '',
      reference: map.reference ? source[map.reference] : '',
      __source_row: source
    }));
  }

  async function fetchQueues(){
    const response = await api({action:'operations_queue_list'});
    latestQueues = response?.queues || {};
    renderHistory();
    if (activeImportId) renderReview(activeImportId);
    return latestQueues;
  }

  function reviewPermission(){
    const cap = latestQueues?.capabilities?.actions?.bank_csv_confirm_import;
    return cap?.permitted !== false;
  }

  function importDetail(row){
    const meta = row?.metadata || {};
    const hash = clean(meta.source_file_sha256);
    const trace = hash ? `${hash.slice(0,16)}… · ${Number(meta.source_file_bytes || 0).toLocaleString()} bytes` : 'Legacy preview: source hash not recorded';
    return `${esc(row.import_key || row.id)} · ${esc(trace)}`;
  }

  function renderHistory(){
    const wrap = byId('oc_bank311_history');
    if (!wrap) return;
    const rows = latestQueues.bank_imports || [];
    if (!rows.length) {
      wrap.innerHTML = '<p class="muted">No bank-import history yet.</p>';
      return;
    }
    wrap.innerHTML = rows.slice(0,20).map((row)=>{
      const id = esc(row.id);
      const promoted = !!row.promoted_at;
      const discarded = row.preview_status === 'discarded';
      const accepted = Number(row.accepted_row_count ?? row.accepted_rows ?? 0);
      const rejected = Number(row.rejected_row_count ?? row.rejected_rows ?? 0);
      const duplicates = Number(row.duplicate_rows || 0);
      const approveDisabled = !reviewPermission() || promoted || discarded;
      return `<article class="oc-queue-card" data-bank311-import="${id}">
        <header><strong>${esc(row.original_filename || row.import_key || 'Bank import')}</strong><span>${esc(row.preview_status || 'review')}</span></header>
        <dl>
          <div><dt>Bank</dt><dd>${esc(row.bank_account_name || row.bank_account_hint || 'Not selected')}</dd></div>
          <div><dt>Review</dt><dd>${accepted} accepted · ${rejected} rejected · ${duplicates} duplicate flag(s)</dd></div>
          <div><dt>Source</dt><dd><code>${importDetail(row)}</code></dd></div>
          <div><dt>Created</dt><dd>${when(row.created_at)}</dd></div>
        </dl>
        <div class="oc-row-actions">
          ${!promoted && !discarded ? `<button type="button" class="secondary" data-bank311-action="open" data-id="${id}">Review rows</button>` : ''}
          ${!promoted && !discarded ? `<button type="button" class="secondary" data-bank311-action="discard" data-id="${id}" ${approveDisabled?'disabled':''}>Discard before promotion</button>` : ''}
          ${!promoted && !discarded ? `<button type="button" data-bank311-action="promote" data-id="${id}" ${approveDisabled?'disabled':''}>Confirm accepted rows</button>` : ''}
          ${discarded ? '<small>Discarded previews cannot promote. Create a new preview or undo row decisions before discarding.</small>' : ''}
          ${promoted ? `<small>Promoted ${when(row.promoted_at)}. Promotion creates reconciliation candidates; it does not silently post to the ledger.</small>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function reviewRows(importId){
    return (latestQueues.bank_preview_rows || []).filter((row)=>String(row.import_id)===String(importId));
  }

  function renderReview(importId){
    activeImportId = importId || '';
    const wrap = byId('oc_bank311_review');
    if (!wrap) return;
    const rows = reviewRows(activeImportId);
    const source = (latestQueues.bank_imports || []).find((row)=>String(row.id)===String(activeImportId));
    if (!activeImportId) {
      wrap.innerHTML = '<p class="muted">Choose Review rows from import history.</p>';
      return;
    }
    if (!rows.length) {
      wrap.innerHTML = `<p class="muted">No unpromoted review rows are available for ${esc(source?.original_filename || activeImportId)}.</p>`;
      return;
    }
    const allowed = reviewPermission();
    wrap.innerHTML = `<div class="operations-actions">
      <button type="button" id="oc_bank311_bulk_approve" ${allowed?'':'disabled'}>Approve selected</button>
      <button type="button" id="oc_bank311_bulk_reject" class="secondary" ${allowed?'':'disabled'}>Reject selected</button>
      <button type="button" id="oc_bank311_select_rejected" class="secondary">Select rejected</button>
      <span class="muted">Bulk review is capped at ${MAX_BULK} explicitly selected rows.</span>
    </div>
    <div class="table-scroll"><table>
      <thead><tr><th>Select</th><th>#</th><th>Status</th><th>Date</th><th>Description</th><th>Amount</th><th>Reference</th><th>Reason</th><th>Review</th></tr></thead>
      <tbody>${rows.map((row)=>`<tr>
        <td><input type="checkbox" data-bank311-row-select value="${esc(row.id)}" aria-label="Select bank row ${Number(row.row_number||0)}" /></td>
        <td>${Number(row.row_number||0)}</td>
        <td>${esc(row.row_status)}</td>
        <td>${esc(row.transaction_date || '—')}</td>
        <td>${esc(row.description || '—')}</td>
        <td>${money(row.amount)}</td>
        <td>${esc(row.reference || '—')}</td>
        <td>${esc(row.rejection_reason || 'Accepted after validation')}</td>
        <td><div class="oc-row-actions">
          <button type="button" data-bank311-action="approve-row" data-id="${esc(row.id)}" data-import-id="${esc(activeImportId)}" ${allowed?'':'disabled'}>Approve</button>
          <button type="button" class="secondary" data-bank311-action="reject-row" data-id="${esc(row.id)}" data-import-id="${esc(activeImportId)}" ${allowed?'':'disabled'}>Reject</button>
          <button type="button" class="secondary" data-bank311-action="correct-row" data-id="${esc(row.id)}" data-import-id="${esc(activeImportId)}" ${allowed?'':'disabled'}>Correct</button>
          <button type="button" class="secondary" data-bank311-action="undo-row" data-id="${esc(row.id)}" data-import-id="${esc(activeImportId)}" ${allowed?'':'disabled'}>Undo</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  async function rowDecision(importId,rowId,decision,extra={}){
    status(`Bank row ${decision}…`);
    await api({action:'bank_csv_preview',review_operation:'row_decision',import_id:importId,row_id:rowId,decision,...extra});
    await fetchQueues();
    status(`Bank row ${decision} completed. Nothing was posted to the ledger.`);
  }

  function selectedRowIds(){
    return [...document.querySelectorAll('#oc_bank311_review [data-bank311-row-select]:checked')].map((el)=>el.value).filter(Boolean).slice(0,MAX_BULK+1);
  }

  async function bulkDecision(decision){
    const rowIds = selectedRowIds();
    if (!rowIds.length) throw new Error('Select at least one bank row.');
    if (rowIds.length > MAX_BULK) throw new Error(`Select no more than ${MAX_BULK} rows per bulk review.`);
    const reason = decision === 'reject' ? clean(prompt('Reason for rejecting the selected rows:') || '') : '';
    if (decision === 'reject' && reason.length < 5) throw new Error('A rejection reason of at least 5 characters is required.');
    status(`Bulk ${decision} of ${rowIds.length} row(s)…`);
    await api({action:'bank_csv_preview',review_operation:'bulk_decision',import_id:activeImportId,row_ids:rowIds,decision,reason});
    await fetchQueues();
    status(`Bulk ${decision} completed for ${rowIds.length} row(s). Nothing was posted.`);
  }

  async function discardImport(importId){
    const reason = clean(prompt('Why should this preview be discarded before promotion?') || '');
    if (reason.length < 5) throw new Error('A discard reason of at least 5 characters is required.');
    await api({action:'bank_csv_preview',review_operation:'discard_import',import_id:importId,reason});
    activeImportId = '';
    await fetchQueues();
    status('Bank preview discarded. Its source/history is retained and it cannot be promoted.');
  }

  async function promoteImport(importId){
    const note = clean(byId('oc_bank_confirmation_note')?.value);
    const bankAccountId = clean(byId('oc_bank_account')?.value);
    await api({action:'bank_csv_confirm_import',import_id:importId,bank_account_id:bankAccountId,confirmation_note:note});
    activeImportId = '';
    await fetchQueues();
    byId('oc_refresh')?.click();
    status('Accepted rows promoted to reconciliation. No ledger posting was performed.');
  }

  async function handleMappedPreview(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = byId('oc_bank_file')?.files?.[0];
    if (!file) { status('Choose a CSV file first.',true); return; }
    try {
      if (!draft || draft.fileName !== file.name || draft.fileSize !== file.size) await parseSelectedFile();
      const mapping = readMapping();
      const rows = mappedRows();
      status(`Validating ${rows.length} mapped bank row(s)…`);
      const response = await api({
        action:'bank_csv_preview',
        idempotency_key:`bank311_${uuid()}`,
        original_filename:file.name,
        bank_account_id:clean(byId('oc_bank_account')?.value),
        bank_account_hint:clean(byId('oc_bank_account_hint')?.value),
        headers:draft.headers,
        rows,
        source_file_sha256:draft.sha256,
        source_file_bytes:draft.fileSize,
        source_file_last_modified:draft.fileLastModified,
        column_mapping:mapping
      });
      activeImportId = response?.batch?.id || '';
      if (byId('oc_bank_import_id')) byId('oc_bank_import_id').value = activeImportId;
      if (byId('oc_bank_server_summary')) byId('oc_bank_server_summary').textContent =
        `Server validation: ${Number(response?.summary?.accepted||0)} accepted; ${Number(response?.summary?.rejected||0)} rejected; ${Number(response?.summary?.duplicates||0)} duplicate flag(s).`;
      await fetchQueues();
      byId('oc_refresh')?.click();
      status('Server validation complete. Review rejected/duplicate rows before promotion.');
    } catch (error) {
      status(error?.message || 'Bank preview failed.',true);
    }
  }

  function mappingHtml(){
    return `<section id="oc_bank311_mapping" class="operations-span" aria-label="Build 311 bank column mapping">
      <span class="operations-kicker">Build 311 · Bank Import Workbench v2</span>
      <p class="muted"><strong>Promotion is not posting.</strong> Map the bank file once, save the template for this bank/account on this device, then review server validation row by row. Validation and promotion never silently post to the ledger.</p>
      <div class="operations-form">
        <label>Date column<select id="oc_bank311_map_date"></select></label>
        <label>Description column<select id="oc_bank311_map_description"></select></label>
        <label>Amount column<select id="oc_bank311_map_amount"></select></label>
        <label>Debit column<select id="oc_bank311_map_debit"></select></label>
        <label>Credit column<select id="oc_bank311_map_credit"></select></label>
        <label>Reference column<select id="oc_bank311_map_reference"></select></label>
      </div>
      <div class="operations-actions">
        <button type="button" id="oc_bank311_save_template" class="secondary">Save bank/account template</button>
        <button type="button" id="oc_bank311_reload_template" class="secondary">Reload saved template</button>
      </div>
      <p id="oc_bank311_source_trace" class="muted">Choose a CSV file to calculate source traceability.</p>
    </section>`;
  }

  function reviewHtml(){
    return `<section class="operations-span" aria-label="Build 311 bank row review">
      <h4>Row review before promotion</h4>
      <div id="oc_bank311_review"><p class="muted">Validate a file or choose Review rows from history.</p></div>
      <h4>Import history &amp; source traceability</h4>
      <div id="oc_bank311_history" class="oc-live-queue"><p class="muted">Loading bank-import history…</p></div>
    </section>`;
  }

  function bindWorkbench(){
    const form = byId('oc_bank_form');
    if (!form || form.dataset.bank311Bound === 'true') return false;
    form.dataset.bank311Bound = 'true';
    const summary = byId('oc_bank_preview_summary');
    summary?.insertAdjacentHTML('beforebegin',mappingHtml());
    const queue = byId('oc_bank_queue');
    queue?.insertAdjacentHTML('beforebegin',reviewHtml());

    form.addEventListener('submit',handleMappedPreview,true);
    byId('oc_bank_file')?.addEventListener('change',()=>parseSelectedFile().catch((error)=>status(error.message,true)));
    byId('oc_bank_account')?.addEventListener('change',()=>draft?.headers && applyMappingToControls(draft.headers));
    byId('oc_bank_account_hint')?.addEventListener('change',()=>draft?.headers && applyMappingToControls(draft.headers));
    byId('oc_bank311_save_template')?.addEventListener('click',()=>{ try { saveTemplate(); } catch(error){ status(error.message,true); } });
    byId('oc_bank311_reload_template')?.addEventListener('click',()=>{ if(draft?.headers){ applyMappingToControls(draft.headers); status(`Reloaded template for ${templateScope()}.`); } });
    byId('operationsCockpit')?.addEventListener('click',(event)=>{
      const target = event.target.closest('[data-bank311-action]');
      if (!target || target.disabled) return;
      const action = target.dataset.bank311Action;
      const id = target.dataset.id;
      const importId = target.dataset.importId || id;
      const run = async()=>{
        if(action==='open'){ activeImportId=id; await fetchQueues(); byId('oc_bank311_review')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
        if(action==='discard'){ await discardImport(id); return; }
        if(action==='promote'){ await promoteImport(id); return; }
        if(action==='approve-row'){ await rowDecision(importId,id,'approve'); return; }
        if(action==='reject-row'){
          const reason=clean(prompt('Reason for rejecting this bank row:')||'');
          if(reason.length<5) throw new Error('A rejection reason of at least 5 characters is required.');
          await rowDecision(importId,id,'reject',{reason}); return;
        }
        if(action==='undo-row'){ await rowDecision(importId,id,'undo'); return; }
        if(action==='correct-row'){
          const row=reviewRows(importId).find((item)=>String(item.id)===String(id));
          if(!row) throw new Error('Bank row was not found in the current review set.');
          const transaction_date=clean(prompt('Transaction date (YYYY-MM-DD):',row.transaction_date||'')||'');
          if(!transaction_date) return;
          const description=clean(prompt('Description:',row.description||'')||'');
          if(!description) return;
          const amount=clean(prompt('Signed amount (debit negative, credit positive):',String(row.amount??''))||'');
          if(!amount) return;
          const reference=clean(prompt('Reference (optional):',row.reference||'')||'');
          await rowDecision(importId,id,'correct',{transaction_date,description,amount,reference}); return;
        }
      };
      run().catch((error)=>status(error?.message||'Bank review action failed.',true));
    });
    byId('operationsCockpit')?.addEventListener('click',(event)=>{
      if(event.target.closest('#oc_bank311_bulk_approve')) bulkDecision('approve').catch((error)=>status(error.message,true));
      if(event.target.closest('#oc_bank311_bulk_reject')) bulkDecision('reject').catch((error)=>status(error.message,true));
      if(event.target.closest('#oc_bank311_select_rejected')){
        const rejected = new Set(reviewRows(activeImportId).filter((row)=>row.row_status==='rejected').map((row)=>String(row.id)));
        document.querySelectorAll('#oc_bank311_review [data-bank311-row-select]').forEach((box)=>{ box.checked=rejected.has(String(box.value)); });
      }
    });
    fetchQueues().catch((error)=>status(error.message,true));
    return true;
  }

  const observer = new MutationObserver(()=>bindWorkbench());
  const start = () => {
    bindWorkbench();
    if (document.body) observer.observe(document.body,{childList:true,subtree:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  document.addEventListener('ywi:auth-changed',()=>setTimeout(()=>bindWorkbench(),0));
})();
