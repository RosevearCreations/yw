/* File: js/staging-acceptance-ui.js
   Build 186 Admin > I.T. staging acceptance evidence add-on.
   Reads the canonical Schema 186 staging acceptance view through a JWT-protected Admin/manage endpoint.
   Human signoff records evidence only; it never closes a scorecard rail automatically.
*/

'use strict';

(function () {
  const state={ payload:null,loading:false,bound:false,observer:null };
  const esc=(value)=>window.YWIAPI?.escHtml?.(value) || String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const auth=()=>window.YWI_AUTH?.getState?.() || {};
  const isAdmin=()=>String(auth().role || '').toLowerCase()==='admin';
  const cleanStatus=(value)=>String(value || 'pending').trim().toLowerCase();
  function statusClass(value){
    const status=cleanStatus(value);
    if(/accepted|approved|passed|green|complete/.test(status))return 'passed';
    if(/failed|rejected|red|stale|error/.test(status))return 'error';
    if(/awaiting|pending|progress|amber|review|unknown/.test(status))return 'warning';
    return 'unknown';
  }
  function chip(value){return `<span class="it-readiness-status ${statusClass(value)}">${esc(String(value || 'pending').replaceAll('_',' '))}</span>`;}
  function shortSha(value){const text=String(value || '');return text ? text.slice(0,12) : 'not run';}

  function panelHost(){
    const grid=document.querySelector('#itReadinessWorkspace .it-readiness-grid');
    if(!grid)return null;
    let host=document.getElementById('stagingAcceptancePanel');
    if(!host){
      host=document.createElement('section');
      host.id='stagingAcceptancePanel';
      host.className='it-readiness-panel';
      grid.prepend(host);
    }
    return host;
  }

  function render(){
    const host=panelHost();
    if(!host)return false;
    if(!isAdmin()){
      host.innerHTML='<div class="it-readiness-error">Admin manage access is required for staging acceptance evidence.</div>';
      return true;
    }
    if(state.loading){host.innerHTML='<div class="it-readiness-loading">Loading staging acceptance evidence…</div>';return true;}
    if(!state.payload){
      host.innerHTML='<span class="it-readiness-kicker">Acceptance</span><h3>Staging acceptance evidence</h3><p>Automated proof is evidence only. Human-required rails stay open until explicit review.</p><button id="stagingAcceptanceLoad" type="button">Load staging acceptance</button>';
      document.getElementById('stagingAcceptanceLoad')?.addEventListener('click',()=>load(true));
      return true;
    }

    const summary=state.payload.summary || {};
    const rows=Array.isArray(state.payload.staging_acceptance)?state.payload.staging_acceptance:[];
    const assertions=Array.isArray(state.payload.security_assertions)?state.payload.security_assertions:[];
    const failedAssertions=assertions.filter((row)=>cleanStatus(row?.assertion_status)!=='passed');
    const rowHtml=rows.length ? rows.map((row)=>{
      const status=row.staging_acceptance_status || 'pending';
      const canSign=row.run_status==='passed' && row.requires_human===true && row.human_signoff_status==='pending' && row.run_id;
      return `<div class="it-readiness-row staging-acceptance-row">
        <div>
          <strong>${esc(row.rail_title || row.rail_key || 'Staging rail')}</strong>
          <small>${esc(row.rail_key || '')} · source ${esc(shortSha(row.source_sha))} · schema ${esc(row.schema_version || '—')} · ${Number(row.result_count||0)} evidence row(s)</small>
          <small>${esc(row.resolution_note || row.next_action_hint || '')}</small>
          ${row.fixture_set_id?`<small>Fixture ${esc(String(row.fixture_status || 'unknown').replaceAll('_',' '))}${row.fixture_label?` · ${esc(row.fixture_label)}`:''}</small>`:''}
          ${canSign?`<div class="it-readiness-actions"><button type="button" data-staging-signoff="approved" data-run-id="${esc(row.run_id)}">Approve evidence</button><button type="button" class="secondary" data-staging-signoff="rejected" data-run-id="${esc(row.run_id)}">Reject evidence</button></div>`:''}
        </div>
        ${chip(status)}
      </div>`;
    }).join('') : '<div class="it-readiness-empty">No open staging-acceptance rails were returned.</div>';

    host.innerHTML=`
      <span class="it-readiness-kicker">Acceptance control plane</span>
      <h3>Staging acceptance evidence</h3>
      <p>Dedicated staging only · ${Number(summary.rail_count||0)} open rail(s) · ${Number(summary.awaiting_human_count||0)} awaiting human signoff · ${Number(summary.failed_count||0)} failed/rejected/stale · ${Number(summary.assertion_failures||0)} security assertion failure(s).</p>
      <p><strong>No automatic rail closure:</strong> automated/runtime/browser results and human signoff are evidence. Scorecard completion remains a separate deliberate release action.</p>
      ${failedAssertions.length?`<div class="it-readiness-error">${failedAssertions.map((row)=>esc(`${row.assertion_key}: ${row.assertion_detail || 'failed'}`)).join('<br>')}</div>`:''}
      <div class="it-readiness-list">${rowHtml}</div>
      <div class="it-readiness-actions"><button id="stagingAcceptanceRefresh" type="button" class="secondary">Refresh staging evidence</button></div>`;

    document.getElementById('stagingAcceptanceRefresh')?.addEventListener('click',()=>load(true));
    host.querySelectorAll('[data-staging-signoff]').forEach((button)=>button.addEventListener('click',async()=>{
      const decision=button.getAttribute('data-staging-signoff');
      const runId=button.getAttribute('data-run-id');
      if(!runId || !decision)return;
      const actionWord=decision==='approved'?'approve':'reject';
      if(!window.confirm(`Explicitly ${actionWord} this staging acceptance evidence? This records human review but does not close the scorecard rail.`))return;
      const note=window.prompt(`Optional ${actionWord} note for the staging evidence:`) || '';
      button.disabled=true;
      try{
        const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{
          method:'POST',body:{ action:'signoff',run_id:runId,decision,note },requireAuth:true,timeoutMs:45000
        });
        if(!payload?.ok)throw new Error(payload?.error || 'Staging signoff failed.');
        state.payload=payload.status;
        render();
      }catch(err){
        window.alert(err?.message || 'Unable to record staging acceptance signoff.');
        button.disabled=false;
      }
    }));
    return true;
  }

  async function load(force=false){
    if(!isAdmin() || state.loading)return;
    if(state.payload && !force){render();return;}
    state.loading=true;render();
    try{
      const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{
        method:'POST',body:{ action:'status' },requireAuth:true,timeoutMs:45000
      });
      if(!payload)throw new Error('Staging acceptance endpoint returned no data.');
      state.payload=payload;
    }catch(err){
      state.payload={
        summary:{rail_count:0,awaiting_human_count:0,failed_count:1,assertion_failures:1,business_rail_auto_close:false},
        staging_acceptance:[],
        security_assertions:[{assertion_key:'staging_acceptance_endpoint',assertion_status:'failed',assertion_detail:err?.message || 'Unable to load staging acceptance evidence.'}]
      };
    }finally{state.loading=false;render();}
  }

  function bind(){
    if(state.bound)return;
    state.bound=true;
    const ensure=()=>{
      if(panelHost() && isAdmin() && !state.payload && !state.loading)load(false);
    };
    document.addEventListener('ywi:module-runtime-ready',()=>setTimeout(ensure,0));
    document.addEventListener('ywi:auth-changed',()=>setTimeout(ensure,0));
    document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,0));
    const workspace=document.getElementById('itReadinessWorkspace');
    if(workspace){
      state.observer=new MutationObserver(()=>{ if(!document.getElementById('stagingAcceptancePanel'))setTimeout(()=>{render();},0); });
      state.observer.observe(workspace,{childList:true,subtree:true});
    }
    setTimeout(ensure,0);
  }

  bind();
  window.YWIStagingAcceptance=Object.freeze({ load,render });
})();
