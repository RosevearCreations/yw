/* File: js/finance-account-mapping-ui.js
   Schema 180 human accountant mapping review, Schema 181 read-only observability,
   Schema 183 structural chart-account decision support, and Build 314 posting-preview integration.
   Human review only: this client cannot enable posting execution, mutate providers,
   write Jobs state, or auto-select/auto-approve a chart account.
*/

'use strict';

(function () {
  const state = { payload:null, loading:false, mutating:false, error:'', loadedAt:0 };
  const byId=(id)=>document.getElementById(id);
  const esc=(value)=>window.YWIAPI?.escHtml?.(value)||String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(value)=>String(value||'unknown').replaceAll('_',' ').toLowerCase();

  function auth(){ return window.YWI_AUTH?.getState?.()||{}; }
  function canView(){ return window.YWISecurity?.canViewModule?.('finance',auth().role||'employee','view')===true; }
  function canManage(){ return window.YWISecurity?.canViewModule?.('finance',auth().role||'employee','manage')===true; }
  function active(){ return byId('finance')?.classList.contains('active')===true; }

  function inject(){
    const section=byId('finance');
    const financeHost=byId('financeWorkspace');
    if(!section||!financeHost||byId('financeMappingWorkspace')) return;
    const host=document.createElement('div');
    host.id='financeMappingWorkspace';
    host.className='finance-mapping-workspace';
    financeHost.insertAdjacentElement('afterend',host);
  }

  function decisionRows(mappingKey){
    const rows=Array.isArray(state.payload?.decision_support)?state.payload.decision_support:[];
    return rows.filter((row)=>String(row?.mapping_key||'')===String(mappingKey||''))
      .sort((a,b)=>Number(a?.decision_rank??999)-Number(b?.decision_rank??999)||String(a?.candidate_account_number||'').localeCompare(String(b?.candidate_account_number||'')));
  }

  function selectedDecision(mappingKey,accountId){
    return decisionRows(mappingKey).find((row)=>String(row?.candidate_account_id||'')===String(accountId||''))||null;
  }

  function accountOptions(mappingKey,selected){
    const support=decisionRows(mappingKey);
    if(support.length){
      return `<option value="">Select an active chart account…</option>${support.map((row)=>{
        const id=String(row?.candidate_account_id||'');
        const badge=row?.approval_eligible===true?'compatible':'type mismatch';
        const current=row?.is_current_selection===true?' · current':'';
        const text=`${row?.candidate_account_number||'—'} — ${row?.candidate_account_name||'Unnamed account'} (${row?.candidate_account_type||'unknown'} · ${badge}${current})`;
        return `<option value="${esc(id)}" ${id===String(selected||'')?'selected':''}>${esc(text)}</option>`;
      }).join('')}`;
    }
    const accounts=Array.isArray(state.payload?.accounts)?state.payload.accounts:[];
    return `<option value="">Select an active chart account…</option>${accounts.map((account)=>{
      const id=String(account?.id||'');
      const text=`${account?.account_number||'—'} — ${account?.account_name||'Unnamed account'} (${account?.account_type||'unknown'})`;
      return `<option value="${esc(id)}" ${id===String(selected||'')?'selected':''}>${esc(text)}</option>`;
    }).join('')}`;
  }

  function statusCard(title,value,note){
    return `<article class="finance-stat-card"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(note||'')}</small></article>`;
  }

  function mappingAction(row){
    if(!canManage()) return '<small>Finance manage required for mapping decisions.</small>';
    const support=selectedDecision(row.mapping_key,row.account_id);
    const expected=support?.expected_account_type||decisionRows(row.mapping_key)[0]?.expected_account_type||'unknown';
    return `<div class="finance-mapping-actions">
      <label><span>Chart account</span><select data-mapping-account="${esc(row.mapping_key)}">${accountOptions(row.mapping_key,row.account_id)}</select></label>
      <small>Expected account type: <strong>${esc(expected)}</strong>. Type-mismatch choices may be reviewed/rejected, but the database will not approve them.</small>
      <div class="finance-review-actions">
        <button type="button" data-mapping-review="review" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Reclassify for review</button>
        <button type="button" data-mapping-review="approved" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Approve</button>
        <button type="button" data-mapping-review="rejected" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Reject</button>
      </div>
    </div>`;
  }

  function observationCell(obs){
    if(!obs) return '<strong>Not evaluated</strong><br><small>Refresh mapping observability.</small>';
    const age=Number(obs.review_age_days||0);
    return `<strong>${esc(label(obs.review_age_code))}</strong><br><small>${age} day(s) from the current human-review age anchor</small>`;
  }

  function driftCell(obs){
    if(!obs) return '<strong>Not evaluated</strong>';
    const technical=obs.technical_drift===true;
    const preflightIssue=obs.preflight_reconciliation_issue===true;
    return `<strong>${technical?'Technical drift':'Drift: '+esc(label(obs.drift_code))}</strong><br>
      <small>Preflight: ${esc(label(obs.preflight_reconciliation_code))}${Number(obs.preflight_sample_count||0)===0?' · no generated pair sample':''}</small><br>
      <small>${esc(obs.observability_action_hint||'')}</small>${preflightIssue?'<br><strong>Preflight reconciliation issue</strong>':''}`;
  }

  function decisionCell(row){
    if(!canManage()) return '<strong>Human decision required</strong><br><small>Finance manage can compare active chart-account candidates.</small>';
    const current=selectedDecision(row.mapping_key,row.account_id);
    const rows=decisionRows(row.mapping_key);
    const eligible=rows.filter((item)=>item?.approval_eligible===true).length;
    if(!current) return `<strong>Decision support unavailable</strong><br><small>${eligible} compatible active candidate(s) returned.</small>`;
    return `<strong>${esc(label(current.compatibility_code))}</strong><br>
      <small>Expected ${esc(current.expected_account_type||'unknown')} · ${eligible} compatible active candidate(s)</small><br>
      <small>${esc(current.decision_support_message||'')}</small>`;
  }

  function money(value){
    const n=Number(value||0);
    return Number.isFinite(n)?new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n):'—';
  }

  function mappingByKey(key){
    const rows=Array.isArray(state.payload?.mappings)?state.payload.mappings:[];
    return rows.find((row)=>String(row?.mapping_key||'')===String(key||''))||null;
  }

  function postingPreviewPanel(){
    const previews=Array.isArray(state.payload?.posting_previews)?state.payload.posting_previews:[];
    if(!previews.length){
      return `<section class="finance-list-card"><div class="finance-list-heading"><div><h3>Posting preview</h3><small>Schema 176 read-only proposed entries before posting can ever occur.</small></div><span>0 candidates</span></div><div class="finance-empty"><strong>No posting candidate pairs are available.</strong><small>Preview remains read-only; no browser action can manufacture a posting candidate.</small></div></section>`;
    }
    const cards=previews.slice(0,12).map((row)=>{
      const journal=row?.journal_plan||{};
      const invoice=row?.invoice_plan||{};
      const mapped=invoice?.mapped_fields||{};
      const entries=Array.isArray(journal?.proposed_entries)?journal.proposed_entries:[];
      const blockers=Array.isArray(row?.blockers)?row.blockers:[];
      const tax=Number(mapped?.tax_total||0);
      const entryRows=entries.map((entry)=>{
        const mapping=mappingByKey(entry?.account_mapping_key);
        const account=mapping?.account_id?`${mapping.account_number||'—'} — ${mapping.account_name||''}`:'UNMAPPED';
        const decision=mapping?.mapping_approved===true?'approved':String(mapping?.review_status||'review required');
        return `<tr>
          <td data-label="Line">${esc(entry?.line??'—')}</td>
          <td data-label="Mapping"><strong>${esc(mapping?.target_label||entry?.account_mapping_key||'—')}</strong><br><small>${esc(entry?.account_mapping_key||'')}</small></td>
          <td data-label="Mapped account"><strong>${esc(account)}</strong><br><small>${esc(decision)}</small></td>
          <td data-label="Debit">${money(entry?.debit_amount)}</td>
          <td data-label="Credit">${money(entry?.credit_amount)}</td>
        </tr>`;
      }).join('');
      return `<article class="finance-list-card" data-posting-preview="${esc(row?.intake_id||row?.finance_intake_id||'')}">
        <div class="finance-list-heading"><div><h4>Source transaction ${esc(row?.job_code||row?.work_order_number||row?.intake_id||row?.finance_intake_id||'candidate')}</h4><small>Canonical Finance intake → invoice candidate → journal candidate</small></div><span>${esc(row?.preflight_status||'unknown')}</span></div>
        <div class="finance-stat-grid">
          ${statusCard('Debit total',money(journal?.debit_total),'Proposed only')}
          ${statusCard('Credit total',money(journal?.credit_total),journal?.is_balanced===true?'Balanced':'Balance check required')}
          ${statusCard('Tax treatment',tax>0?`Sales tax payable ${money(tax)}`:'Zero-tax transaction',tax>0?'Tax mapping required':'No tax line proposed')}
          ${statusCard('Blockers',String(blockers.length),blockers.length?'Must be resolved before any release':'No preflight blockers')}
        </div>
        ${entryRows?`<div class="table-wrap"><table class="finance-table"><thead><tr><th>Line</th><th>Mapping</th><th>Mapped account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${entryRows}</tbody></table></div>`:'<div class="finance-empty"><strong>No proposed entries returned.</strong></div>'}
        <div class="finance-module-note"><strong>Evidence:</strong> intake ${esc(row?.intake_id||row?.finance_intake_id||'—')} · posting approval ${esc(row?.posting_approval_id||journal?.posting_approval_id||invoice?.posting_approval_id||'not approved')} · idempotency ${esc(journal?.idempotency_key||invoice?.idempotency_key||'not available')}.</div>
        ${blockers.length?`<div class="finance-module-note"><strong>Preflight blockers:</strong> ${blockers.map((b)=>esc(b?.code||b?.message||'unknown')).join(' · ')}</div>`:''}
        <div class="finance-module-note"><strong>Execution boundary:</strong> this is a read-only posting preview. Posting execution and provider/payment mutation remain OFF.</div>
      </article>`;
    }).join('');
    return `<section class="finance-list-card" id="financePostingPreviewWorkbench"><div class="finance-list-heading"><div><h3>Account Mapping &amp; Posting Preview</h3><small>Build 314 shows source transaction, proposed debit/credit entries, mapped accounts, tax treatment and evidence before posting.</small></div><span>${previews.length} candidate${previews.length===1?'':'s'}</span></div>${cards}</section>`;
  }

  function decisionAuditPanel(){
    const audit=Array.isArray(state.payload?.decision_audit)?state.payload.decision_audit:[];
    return `<section class="finance-list-card" id="financeMappingDecisionAudit"><div class="finance-list-heading"><div><h3>Preview-to-decision audit trail</h3><small>Immutable Schema 180 mapping decisions supporting the current posting preview.</small></div><span>${audit.length} event${audit.length===1?'':'s'}</span></div>
      ${audit.length?`<div class="table-wrap"><table class="finance-table"><thead><tr><th>When</th><th>Mapping</th><th>Decision</th><th>Account change</th><th>Reason / evidence</th></tr></thead><tbody>${audit.slice(0,50).map((row)=>`<tr>
        <td data-label="When">${esc(row?.reviewed_at?new Date(row.reviewed_at).toLocaleString('en-CA'):'—')}</td>
        <td data-label="Mapping"><strong>${esc(row?.mapping_key||'—')}</strong></td>
        <td data-label="Decision">${esc(row?.prior_review_status||'—')} → <strong>${esc(row?.new_review_status||'—')}</strong></td>
        <td data-label="Account change"><small>${esc(row?.prior_account_id||'none')} → ${esc(row?.new_account_id||'none')}</small></td>
        <td data-label="Reason / evidence">${esc(row?.review_reason||'—')}<br><small>audit ${esc(row?.id||'—')} · actor ${esc(row?.reviewed_by_profile_id||'—')}</small></td>
      </tr>`).join('')}</tbody></table></div>`:'<div class="finance-empty"><strong>No mapping decisions have been recorded yet.</strong><small>Approve, reject or reclassify remains a human Finance-manage action.</small></div>'}
    </section>`;
  }

  function render(){
    inject();
    const host=byId('financeMappingWorkspace');
    if(!host) return;
    if(!canView()){ host.innerHTML=''; return; }
    if(state.loading){ host.innerHTML='<section class="finance-list-card"><div class="finance-empty"><strong>Loading accountant mapping readiness…</strong></div></section>'; return; }
    if(state.error){ host.innerHTML=`<section class="finance-list-card"><div class="notice warning"><strong>Account mapping review unavailable.</strong><br>${esc(state.error)}</div><button id="financeMappingRefresh" type="button">Retry</button></section>`; byId('financeMappingRefresh')?.addEventListener('click',()=>load(true)); return; }
    if(!state.payload){ host.innerHTML='<section class="finance-list-card"><div class="finance-list-heading"><div><h3>Accountant mapping review</h3><small>Deep mapping, observability, and decision-support reads are loaded only when you request them.</small></div><span>On demand</span></div><button id="financeMappingLoad" type="button">Load accountant mapping readiness</button></section>'; byId('financeMappingLoad')?.addEventListener('click',()=>load(true)); return; }

    const mappings=Array.isArray(state.payload.mappings)?state.payload.mappings:[];
    const observations=Array.isArray(state.payload.observability)?state.payload.observability:[];
    const obsByKey=Object.fromEntries(observations.map((row)=>[String(row?.mapping_key||''),row]));
    const readiness=state.payload.readiness||{};
    const observabilityReadiness=state.payload.observability_readiness||{};
    const decisionReadiness=state.payload.decision_support_readiness||{};
    const executionOn=readiness.execution_release_enabled===true||observabilityReadiness.execution_release_enabled===true||decisionReadiness.execution_release_enabled===true;
    const providerOn=readiness.provider_mutation_enabled===true||observabilityReadiness.provider_mutation_enabled===true||decisionReadiness.provider_mutation_enabled===true;
    host.innerHTML=`<section class="finance-list-card">
      <div class="finance-list-heading"><div><h3>Accountant mapping review</h3><small>Human-controlled chart-of-accounts decisions for the Schema 176 posting prerequisite.</small></div><span>Schema 183</span></div>
      <div class="finance-stat-grid">
        ${statusCard('Mappings',String(readiness.mapping_count??mappings.length),'AR · service revenue · conditional sales tax')}
        ${statusCard('Approved',String(readiness.approved_count??0),'Explicit human approvals')}
        ${statusCard('Pending',String(readiness.pending_count??0),'Human decision queue; not an I.T. migration failure')}
        ${statusCard('Audit events',String(readiness.audit_event_count??0),'Immutable human-review history')}
      </div>
      <div class="finance-module-note"><strong>Schema 180–183 boundary:</strong> mapping review is a human accounting decision. Posting execution is <strong>${executionOn?'ENABLED':'OFF'}</strong>; provider/payment mutation is <strong>${providerOn?'ENABLED':'OFF'}</strong>. This panel cannot change either release control.</div>
      <div class="finance-module-note"><strong>${esc(readiness.mapping_readiness_status||'unknown')}</strong> — ${esc(readiness.readiness_message||'Mapping readiness has not been evaluated.')}</div>

      <div class="finance-list-heading"><div><h3>Mapping decision support</h3><small>Read-only structural comparison of active chart accounts. Build 183 never auto-selects or auto-approves an account.</small></div><span>${esc(decisionReadiness.mapping_decision_support_status||'unknown')}</span></div>
      <div class="finance-stat-grid">
        ${statusCard('Compatible candidates',String(decisionReadiness.eligible_candidate_count??0),'Active accounts matching each mapping’s structural type')}
        ${statusCard('Type mismatches',String(decisionReadiness.type_mismatch_candidate_count??0),'Visible for comparison; approval is blocked')}
        ${statusCard('Current incompatibilities',String(decisionReadiness.current_selection_incompatible_count??0),'Must remain zero')}
        ${statusCard('Mappings without candidates',String(decisionReadiness.mapping_without_eligible_candidate_count??0),'Must remain zero')}
      </div>
      <div class="finance-module-note"><strong>${esc(decisionReadiness.mapping_decision_support_status||'unknown')}</strong> — ${esc(decisionReadiness.decision_support_message||'Mapping decision support has not been evaluated.')}</div>

      <div class="finance-list-heading"><div><h3>Mapping observability</h3><small>Read-only human-review aging, technical drift, and generated-pair preflight reconciliation. Build 181 never changes the mapping decision.</small></div><span>${esc(observabilityReadiness.mapping_observability_status||'unknown')}</span></div>
      <div class="finance-stat-grid">
        ${statusCard('Stale human reviews',String(observabilityReadiness.stale_review_count??0),'Pending ≥ 30 days')}
        ${statusCard('Technical drift',String(observabilityReadiness.technical_drift_count??0),'Mapping/account/audit contradictions')}
        ${statusCard('Preflight issues',String(observabilityReadiness.preflight_reconciliation_issue_count??0),'Canonical mapping vs generated-pair preflight')}
        ${statusCard('No live sample',String(observabilityReadiness.no_generated_pair_sample_count??0),'Neutral when no generated pair exercises a mapping')}
      </div>
      <div class="finance-module-note"><strong>${esc(observabilityReadiness.mapping_observability_status||'unknown')}</strong> — ${esc(observabilityReadiness.observability_message||'Mapping observability has not been evaluated.')}</div>

      ${postingPreviewPanel()}
      ${decisionAuditPanel()}

      ${mappings.length?`<div class="table-wrap"><table class="finance-table"><thead><tr><th>Mapping</th><th>Current account</th><th>Review</th><th>Decision support</th><th>Human review age</th><th>Drift / preflight</th><th>Blocker / next action</th><th>Human action</th></tr></thead><tbody>${mappings.map((row)=>{
        const obs=obsByKey[String(row.mapping_key||'')];
        return `<tr>
        <td data-label="Mapping"><strong>${esc(row.target_label||row.mapping_key)}</strong><br><small>${esc(row.mapping_key)}${row.conditional_for_zero_tax?' · conditional when tax > 0':''}</small></td>
        <td data-label="Current account">${row.account_id?`<strong>${esc(row.account_number||'—')} — ${esc(row.account_name||'')}</strong><br><small>${esc(row.account_type||'')} · ${row.account_is_active?'active':'inactive'}</small>`:'<strong>Not selected</strong>'}</td>
        <td data-label="Review"><strong>${esc(row.review_status||'review')}</strong><br><small>${row.reviewed_at?`Reviewed ${esc(new Date(row.reviewed_at).toLocaleString('en-CA'))}`:'No recorded Schema 180 review yet'}</small></td>
        <td data-label="Decision support">${decisionCell(row)}</td>
        <td data-label="Human review age">${observationCell(obs)}</td>
        <td data-label="Drift / preflight">${driftCell(obs)}</td>
        <td data-label="Blocker / next action"><strong>${esc(row.blocker_code||'—')}</strong><br>${esc(row.blocker_message||'')}<br><small>${esc(row.action_hint||'')}</small></td>
        <td data-label="Human action">${mappingAction(row)}</td>
      </tr>`;}).join('')}</tbody></table></div>`:'<div class="finance-empty"><strong>No canonical posting mappings were returned.</strong><small>Do not manufacture mappings in the browser; investigate the server-owned accounting configuration.</small></div>'}
      <div class="finance-toolbar"><button id="financeMappingRefresh" type="button">Refresh mapping readiness</button><span>${canManage()?'Finance manage may record a human decision.':'Read-only mapping readiness, decision support, and observability.'}</span></div>
    </section>`;
    byId('financeMappingRefresh')?.addEventListener('click',()=>load(true));
    bindActions();
  }

  function bindActions(){
    document.querySelectorAll('[data-mapping-review]').forEach((button)=>button.addEventListener('click',async()=>{
      if(!canManage()||state.mutating) return;
      const mappingKey=String(button.dataset.mappingKey||'');
      const reviewStatus=String(button.dataset.mappingReview||'');
      const select=document.querySelector(`[data-mapping-account="${CSS.escape(mappingKey)}"]`);
      const accountId=String(select?.value||'');
      if(reviewStatus==='approved'&&!accountId){ window.alert('Select an active chart account before approving this mapping.'); return; }
      if(reviewStatus==='approved'){
        const support=selectedDecision(mappingKey,accountId);
        if(support && support.approval_eligible !== false && support.approval_eligible !== true){ window.alert('Refresh mapping decision support before approving this account.'); return; }
        if(support?.approval_eligible===false){ window.alert(`Selected account is not structurally compatible with ${mappingKey}. Expected account type: ${support.expected_account_type||'unknown'}.`); return; }
      }
      const reason=window.prompt(`Reason for marking ${mappingKey} as ${reviewStatus}:`,'')||'';
      if(reason.trim().length<5) return;
      if(reviewStatus==='approved'&&!window.confirm('Approve this exact chart-account mapping? This records a human accounting decision but does not enable posting execution.')) return;
      await mutate({action:'review_mapping',mapping_key:mappingKey,account_id:accountId||null,review_status:reviewStatus,reason:reason.trim()});
    }));
  }

  async function mutate(body){
    state.mutating=true; state.error=''; render();
    try{
      const result=await window.YWIAPI?.jsonFetch?.('finance-account-mapping-review',{method:'POST',body,requireAuth:true,timeoutMs:30000});
      if(!result?.ok) throw new Error(result?.error||'Finance mapping review failed.');
      state.payload=null;
      await load(true);
    }catch(err){ state.error=err?.message||'Finance mapping review failed.'; }
    finally{ state.mutating=false; render(); }
  }

  async function load(force=false){
    inject();
    if(!canView()||state.loading) return;
    if(!force&&state.payload&&Date.now()-state.loadedAt<30000){ render(); return; }
    state.loading=true; state.error=''; render();
    try{
      const payload=await window.YWIAPI?.jsonFetch?.('finance-account-mapping-review',{method:'POST',body:{action:'list'},requireAuth:true,timeoutMs:30000});
      if(!payload?.ok) throw new Error(payload?.error||'Finance mapping readiness returned no data.');
      state.payload=payload; state.loadedAt=Date.now();
    }catch(err){ state.payload=null; state.error=err?.message||'Finance mapping readiness could not load.'; }
    finally{ state.loading=false; render(); }
  }

  // Build 228: deep mapping/observability/decision-support reads are intentionally manual.
  // Route, auth, and permission changes render the control but never fan out the heavy read automatically.
  document.addEventListener('DOMContentLoaded',()=>{ inject(); render(); });
  document.addEventListener('ywi:route-shown',(event)=>{ if(event?.detail?.allowed==='finance'||active()) { inject(); render(); } });
  document.addEventListener('ywi:auth-changed',()=>{ state.payload=null; state.loadedAt=0; state.error=''; inject(); render(); });
  document.addEventListener('ywi:module-permissions-changed',()=>{ state.payload=null; state.loadedAt=0; state.error=''; inject(); render(); });
  window.YWIFinanceMappingReview={load,render};
})();