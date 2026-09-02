/* File: js/finance-account-mapping-ui.js
   Schema 180 Finance accountant mapping readiness/review panel.
   Human review only: this client cannot enable posting execution, mutate providers,
   write Jobs state, or auto-select/auto-approve a chart account.
*/

'use strict';

(function () {
  const state = { payload:null, loading:false, mutating:false, error:'', loadedAt:0 };
  const byId=(id)=>document.getElementById(id);
  const esc=(value)=>window.YWIAPI?.escHtml?.(value)||String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

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

  function accountOptions(selected){
    const accounts=Array.isArray(state.payload?.accounts)?state.payload.accounts:[];
    return `<option value="">Select an active chart account…</option>${accounts.map((account)=>{
      const id=String(account?.id||'');
      const label=`${account?.account_number||'—'} — ${account?.account_name||'Unnamed account'} (${account?.account_type||'unknown'})`;
      return `<option value="${esc(id)}" ${id===String(selected||'')?'selected':''}>${esc(label)}</option>`;
    }).join('')}`;
  }

  function statusCard(label,value,note){
    return `<article class="finance-stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note||'')}</small></article>`;
  }

  function mappingAction(row){
    if(!canManage()) return '<small>Finance manage required for mapping decisions.</small>';
    return `<div class="finance-mapping-actions">
      <label><span>Chart account</span><select data-mapping-account="${esc(row.mapping_key)}">${accountOptions(row.account_id)}</select></label>
      <div class="finance-review-actions">
        <button type="button" data-mapping-review="review" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Save for review</button>
        <button type="button" data-mapping-review="approved" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Approve</button>
        <button type="button" data-mapping-review="rejected" data-mapping-key="${esc(row.mapping_key)}" ${state.mutating?'disabled':''}>Reject</button>
      </div>
    </div>`;
  }

  function render(){
    inject();
    const host=byId('financeMappingWorkspace');
    if(!host) return;
    if(!canView()){ host.innerHTML=''; return; }
    if(state.loading){ host.innerHTML='<section class="finance-list-card"><div class="finance-empty"><strong>Loading accountant mapping readiness…</strong></div></section>'; return; }
    if(state.error){ host.innerHTML=`<section class="finance-list-card"><div class="notice warning"><strong>Account mapping review unavailable.</strong><br>${esc(state.error)}</div><button id="financeMappingRefresh" type="button">Retry</button></section>`; byId('financeMappingRefresh')?.addEventListener('click',()=>load(true)); return; }
    if(!state.payload){ host.innerHTML='<section class="finance-list-card"><button id="financeMappingLoad" type="button">Load accountant mapping readiness</button></section>'; byId('financeMappingLoad')?.addEventListener('click',()=>load(true)); return; }

    const mappings=Array.isArray(state.payload.mappings)?state.payload.mappings:[];
    const readiness=state.payload.readiness||{};
    const executionOn=readiness.execution_release_enabled===true;
    const providerOn=readiness.provider_mutation_enabled===true;
    host.innerHTML=`<section class="finance-list-card">
      <div class="finance-list-heading"><div><h3>Accountant mapping review</h3><small>Human-controlled chart-of-accounts decisions for the Schema 176 posting prerequisite.</small></div><span>Schema 180</span></div>
      <div class="finance-stat-grid">
        ${statusCard('Mappings',String(readiness.mapping_count??mappings.length),'AR · service revenue · conditional sales tax')}
        ${statusCard('Approved',String(readiness.approved_count??0),'Explicit human approvals')}
        ${statusCard('Pending',String(readiness.pending_count??0),'Not an I.T. migration failure')}
        ${statusCard('Audit events',String(readiness.audit_event_count??0),'Immutable review history')}
      </div>
      <div class="finance-module-note"><strong>Schema 180 boundary:</strong> mapping review is a human accounting decision. Posting execution is <strong>${executionOn?'ENABLED':'OFF'}</strong>; provider/payment mutation is <strong>${providerOn?'ENABLED':'OFF'}</strong>. This panel cannot change either release control.</div>
      <div class="finance-module-note"><strong>${esc(readiness.mapping_readiness_status||'unknown')}</strong> — ${esc(readiness.readiness_message||'Mapping readiness has not been evaluated.')}</div>
      ${mappings.length?`<div class="table-wrap"><table class="finance-table"><thead><tr><th>Mapping</th><th>Current account</th><th>Review</th><th>Blocker / next action</th><th>Human action</th></tr></thead><tbody>${mappings.map((row)=>`<tr>
        <td data-label="Mapping"><strong>${esc(row.target_label||row.mapping_key)}</strong><br><small>${esc(row.mapping_key)}${row.conditional_for_zero_tax?' · conditional when tax > 0':''}</small></td>
        <td data-label="Current account">${row.account_id?`<strong>${esc(row.account_number||'—')} — ${esc(row.account_name||'')}</strong><br><small>${esc(row.account_type||'')} · ${row.account_is_active?'active':'inactive'}</small>`:'<strong>Not selected</strong>'}</td>
        <td data-label="Review"><strong>${esc(row.review_status||'review')}</strong><br><small>${row.reviewed_at?`Reviewed ${esc(new Date(row.reviewed_at).toLocaleString('en-CA'))}`:'No recorded Schema 180 review yet'}</small></td>
        <td data-label="Blocker / next action"><strong>${esc(row.blocker_code||'—')}</strong><br>${esc(row.blocker_message||'')}<br><small>${esc(row.action_hint||'')}</small></td>
        <td data-label="Human action">${mappingAction(row)}</td>
      </tr>`).join('')}</tbody></table></div>`:'<div class="finance-empty"><strong>No canonical posting mappings were returned.</strong><small>Do not manufacture mappings in the browser; investigate the server-owned accounting configuration.</small></div>'}
      <div class="finance-toolbar"><button id="financeMappingRefresh" type="button">Refresh mapping readiness</button><span>${canManage()?'Finance manage may record a human decision.':'Read-only mapping readiness.'}</span></div>
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

  document.addEventListener('DOMContentLoaded',()=>{ inject(); render(); if(active()) load(false); });
  document.addEventListener('ywi:route-shown',(event)=>{ if(event?.detail?.allowed==='finance'||active()) load(false); });
  document.addEventListener('ywi:auth-changed',()=>{ state.payload=null; state.loadedAt=0; state.error=''; render(); if(active()) load(true); });
  document.addEventListener('ywi:module-permissions-changed',()=>{ state.payload=null; state.loadedAt=0; render(); if(active()) load(true); });
  window.YWIFinanceMappingReview={load,render};
})();
