/* File: js/staging-acceptance-ui.js
   Build 187 Admin > I.T. staging acceptance scenario/evidence add-on.
   The catalog is read through a JWT-protected Admin/manage endpoint.
   Human case evidence, finalization, and signoff are explicit; none closes a scorecard rail automatically.
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
    if(/accepted|approved|passed|green|complete|satisfied|source_ready/.test(status))return 'passed';
    if(/failed|rejected|red|stale|error|blocked/.test(status))return 'error';
    if(/awaiting|pending|progress|amber|review|required|not_run|runtime|human/.test(status))return 'warning';
    return 'unknown';
  }
  function chip(value){return `<span class="it-readiness-status ${statusClass(value)}">${esc(String(value || 'pending').replaceAll('_',' '))}</span>`;}
  function shortSha(value){const text=String(value || '');return text ? text.slice(0,12) : 'not run';}

  function panelHost(){
    const grid=document.querySelector('#itReadinessWorkspace .it-readiness-grid');
    if(!grid)return null;
    let host=document.getElementById('stagingAcceptancePanel');
    if(!host){host=document.createElement('section');host.id='stagingAcceptancePanel';host.className='it-readiness-panel';grid.prepend(host);}
    return host;
  }

  function groupScenarios(rows){
    const groups=new Map();
    for(const row of rows){
      const key=row.rail_key || 'unknown';
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    return groups;
  }

  function scenarioRows(group){
    return group.map((row)=>{
      const canRecord=row.human_action_required===true && row.run_id && row.run_status==='started';
      const prerequisites=Array.isArray(row.prerequisites)?row.prerequisites:[];
      return `<div class="it-readiness-row staging-scenario-row">
        <div>
          <strong>${esc(row.case_title || row.case_key)}</strong>
          <small>${esc(row.case_key || '')} · ${esc(row.verification_mode || '')} · ${row.is_blocking?'blocking':'non-blocking'}</small>
          <small>${esc(row.case_description || '')}</small>
          <small><strong>Expected:</strong> ${esc(row.expected_outcome || '')}</small>
          <small><strong>Prerequisite truth:</strong> ${esc(String(row.prerequisite_truth || 'unknown').replaceAll('_',' '))}${prerequisites.length?` · ${esc(prerequisites.map((item)=>item?.key||item?.kind||'').filter(Boolean).join(', '))}`:''}</small>
          ${row.observed_outcome?`<small><strong>Observed:</strong> ${esc(row.observed_outcome)}</small>`:''}
          ${canRecord?`<div class="it-readiness-actions"><button type="button" data-staging-case="passed" data-run-id="${esc(row.run_id)}" data-case-key="${esc(row.case_key)}">Pass evidence</button><button type="button" class="secondary" data-staging-case="failed" data-run-id="${esc(row.run_id)}" data-case-key="${esc(row.case_key)}">Fail evidence</button></div>`:''}
        </div>${chip(row.evidence_status || 'not_run')}
      </div>`;
    }).join('');
  }

  function render(){
    const host=panelHost();
    if(!host)return false;
    if(!isAdmin()){host.innerHTML='<div class="it-readiness-error">Admin manage access is required for staging acceptance evidence.</div>';return true;}
    if(state.loading){host.innerHTML='<div class="it-readiness-loading">Loading staging acceptance evidence…</div>';return true;}
    if(!state.payload){
      host.innerHTML='<span class="it-readiness-kicker">Acceptance</span><h3>Staging acceptance evidence</h3><p>Catalog cases stay pending until their evidence is explicit.</p><button id="stagingAcceptanceLoad" type="button">Load staging acceptance</button>';
      document.getElementById('stagingAcceptanceLoad')?.addEventListener('click',()=>load(true));return true;
    }

    const summary=state.payload.summary || {};
    const rows=Array.isArray(state.payload.staging_acceptance)?state.payload.staging_acceptance:[];
    const scenarios=Array.isArray(state.payload.scenario_plan)?state.payload.scenario_plan:[];
    const assertions=[...(Array.isArray(state.payload.security_assertions)?state.payload.security_assertions:[]),...(Array.isArray(state.payload.catalog_assertions)?state.payload.catalog_assertions:[])];
    const failedAssertions=assertions.filter((row)=>cleanStatus(row?.assertion_status)!=='passed');
    const rowByRail=new Map(rows.map((row)=>[row.rail_key,row]));
    const groups=groupScenarios(scenarios);

    const railHtml=groups.size ? [...groups.entries()].map(([railKey,group])=>{
      const rail=rowByRail.get(railKey) || group[0] || {};
      const pending=group.filter((row)=>row.evidence_status==='pending_evidence').length;
      const failed=group.filter((row)=>row.evidence_status==='failed').length;
      const passed=group.filter((row)=>row.evidence_status==='passed').length;
      const runStarted=rail.run_status==='started' || group.some((row)=>row.run_status==='started');
      const runId=rail.run_id || group.find((row)=>row.run_id)?.run_id;
      const canFinalize=runStarted && runId && pending===0;
      const canSign=rail.run_status==='passed' && rail.requires_human===true && rail.human_signoff_status==='pending' && rail.run_id;
      return `<div class="staging-acceptance-rail">
        <div class="it-readiness-row staging-acceptance-row"><div>
          <strong>${esc(rail.rail_title || railKey)}</strong>
          <small>${esc(railKey)} · source ${esc(shortSha(rail.source_sha))} · schema ${esc(rail.schema_version || '—')} · ${group.length} catalog case(s)</small>
          <small>${passed} passed · ${pending} pending · ${failed} failed · human signoff ${esc(rail.human_signoff_status || 'not started')}</small>
          <small>${esc(rail.resolution_note || rail.next_action_hint || '')}</small>
          ${canFinalize?`<div class="it-readiness-actions"><button type="button" data-staging-finalize="${esc(runId)}">Finalize evidence run</button></div>`:''}
          ${canSign?`<div class="it-readiness-actions"><button type="button" data-staging-signoff="approved" data-run-id="${esc(rail.run_id)}">Approve evidence</button><button type="button" class="secondary" data-staging-signoff="rejected" data-run-id="${esc(rail.run_id)}">Reject evidence</button></div>`:''}
        </div>${chip(rail.staging_acceptance_status || (runStarted?'collecting_evidence':'not_run'))}</div>
        <div class="it-readiness-list staging-scenario-list">${scenarioRows(group)}</div>
      </div>`;
    }).join('') : '<div class="it-readiness-empty">No open staging-acceptance scenario catalog was returned.</div>';

    host.innerHTML=`
      <span class="it-readiness-kicker">Acceptance control plane</span>
      <h3>Staging acceptance evidence</h3>
      <p>Dedicated staging only · ${Number(summary.rail_count||0)} open rail(s) · ${Number(summary.scenario_count||0)} catalog case(s) · ${Number(summary.pending_evidence_count||0)} pending evidence · ${Number(summary.human_action_count||0)} human action(s) · ${Number(summary.assertion_failures||0)} assertion failure(s).</p>
      <p><strong>No automatic rail closure:</strong> runner results, human case evidence, finalization, and signoff are evidence only. Scorecard completion remains a separate deliberate release action.</p>
      ${failedAssertions.length?`<div class="it-readiness-error">${failedAssertions.map((row)=>esc(`${row.assertion_key}: ${row.assertion_detail || 'failed'}`)).join('<br>')}</div>`:''}
      <div class="it-readiness-list">${railHtml}</div>
      <div class="it-readiness-actions"><button id="stagingAcceptanceRefresh" type="button" class="secondary">Refresh staging evidence</button></div>`;

    document.getElementById('stagingAcceptanceRefresh')?.addEventListener('click',()=>load(true));
    host.querySelectorAll('[data-staging-case]').forEach((button)=>button.addEventListener('click',async()=>{
      const decision=button.getAttribute('data-staging-case');const runId=button.getAttribute('data-run-id');const caseKey=button.getAttribute('data-case-key');
      if(!runId||!caseKey||!decision)return;
      if(!window.confirm(`Mark ${caseKey} as ${decision}? This records human staging evidence and does not close the scorecard rail.`))return;
      const note=window.prompt('Describe the observed staging evidence. Avoid secrets or real customer data:') || '';
      if(!note.trim()){window.alert('A brief observed-evidence note is required for human staging cases.');return;}
      button.disabled=true;
      try{
        const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{method:'POST',body:{action:'record_case',run_id:runId,case_key:caseKey,decision,note},requireAuth:true,timeoutMs:45000});
        if(!payload?.ok)throw new Error(payload?.error || 'Staging case evidence failed.');state.payload=payload.status;render();
      }catch(err){window.alert(err?.message || 'Unable to record staging case evidence.');button.disabled=false;}
    }));
    host.querySelectorAll('[data-staging-finalize]').forEach((button)=>button.addEventListener('click',async()=>{
      const runId=button.getAttribute('data-staging-finalize');if(!runId)return;
      if(!window.confirm('Finalize this evidence run now? Finalization fails closed if any catalog case is still pending. It does not close the scorecard rail.'))return;
      button.disabled=true;
      try{
        const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{method:'POST',body:{action:'finalize',run_id:runId},requireAuth:true,timeoutMs:45000});
        if(!payload?.ok)throw new Error(payload?.error || 'Staging evidence finalization failed.');state.payload=payload.status;render();
      }catch(err){window.alert(err?.message || 'Unable to finalize staging evidence.');button.disabled=false;}
    }));
    host.querySelectorAll('[data-staging-signoff]').forEach((button)=>button.addEventListener('click',async()=>{
      const decision=button.getAttribute('data-staging-signoff');const runId=button.getAttribute('data-run-id');if(!runId||!decision)return;
      const actionWord=decision==='approved'?'approve':'reject';
      if(!window.confirm(`Explicitly ${actionWord} this finalized staging acceptance evidence? This records human review but does not close the scorecard rail.`))return;
      const note=window.prompt(`Optional ${actionWord} note for the staging evidence:`) || '';
      button.disabled=true;
      try{
        const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{method:'POST',body:{action:'signoff',run_id:runId,decision,note},requireAuth:true,timeoutMs:45000});
        if(!payload?.ok)throw new Error(payload?.error || 'Staging signoff failed.');state.payload=payload.status;render();
      }catch(err){window.alert(err?.message || 'Unable to record staging acceptance signoff.');button.disabled=false;}
    }));
    return true;
  }

  async function load(force=false){
    if(!isAdmin()||state.loading)return;if(state.payload&&!force){render();return;}state.loading=true;render();
    try{
      const payload=await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance',{method:'POST',body:{action:'status'},requireAuth:true,timeoutMs:45000});
      if(!payload)throw new Error('Staging acceptance endpoint returned no data.');state.payload=payload;
    }catch(err){state.payload={summary:{rail_count:0,scenario_count:0,pending_evidence_count:0,human_action_count:0,assertion_failures:1,business_rail_auto_close:false},staging_acceptance:[],scenario_plan:[],security_assertions:[{assertion_key:'staging_acceptance_endpoint',assertion_status:'failed',assertion_detail:err?.message || 'Unable to load staging acceptance evidence.'}],catalog_assertions:[]};}
    finally{state.loading=false;render();}
  }

  function bind(){
    if(state.bound)return;state.bound=true;
    const ensure=()=>{if(panelHost()&&isAdmin()&&!state.payload&&!state.loading)load(false);};
    document.addEventListener('ywi:module-runtime-ready',()=>setTimeout(ensure,0));document.addEventListener('ywi:auth-changed',()=>setTimeout(ensure,0));document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,0));
    const workspace=document.getElementById('itReadinessWorkspace');
    if(workspace){state.observer=new MutationObserver(()=>{if(!document.getElementById('stagingAcceptancePanel'))setTimeout(()=>render(),0);});state.observer.observe(workspace,{childList:true,subtree:true});}
    setTimeout(ensure,0);
  }
  bind();window.YWIStagingAcceptance=Object.freeze({load,render});
})();
