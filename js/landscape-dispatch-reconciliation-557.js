/* YW557 — original Dispatch capacity truth, exception aging, supervisor receipt. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 const option=(value,title)=>{const node=document.createElement('option');node.value=value;node.textContent=title;return node;};
 const key=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 const when=value=>value?new Date(value).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'}):'unknown';
 async function identity(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!validId(state.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Original authenticated account required');
  const current=await sb.auth.getUser();
  if(current.error||current.data?.user?.id!==state.user.id)throw Error('Session or user changed');
  return {id:state.user.id,sb};
 }
 function mount(){
  if(!$('crew')||!$('settings')||$('owner557'))return;
  const owner=document.createElement('details');owner.id='owner557';owner.className='admin-hub-detail';
  owner.innerHTML=`<summary>Landscaping · Original Dispatch Capacity, Exception Aging &amp; Supervisor Acknowledgements (owner)</summary>
   <div class="admin-panel-block"><style>
    #owner557,#supervisor557,#owner557 label,#supervisor557 label{min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}
    #owner557 select,#supervisor557 select,#supervisor557 textarea{width:100%;max-width:100%;box-sizing:border-box}
    #owner557 button,#supervisor557 button{min-height:44px;white-space:normal}
    #owner557 .yw557-card,#supervisor557 .yw557-card{border:1px solid var(--border,#8b98a6);border-radius:12px;padding:12px;margin:10px 0}
   </style>
   <p>Compare a YW556 exception against the original 435 Dispatch allocation and the advisory 553 owner capacity plan. <strong>This review never schedules a crew, closes an exception, or confirms the customer.</strong></p>
   <label>Owned company <select id="owner557Company"></select></label>
   <label>Open/closed recovery case <select id="owner557Case"></select></label>
   <button id="owner557Refresh" class="secondary" type="button">Refresh original capacity and aging evidence</button>
   <p id="owner557Status" role="status" aria-live="polite">Sign in as company owner for the original-source review.</p>
   <div class="yw557-card"><h3>Current source reconciliation</h3>
    <p id="owner557Aging">No original recovery case selected.</p>
    <p id="owner557Capacity">Capacity evidence not checked.</p>
    <p id="owner557Supervisor">Supervisor acknowledgement not checked.</p>
    <p id="owner557Reasons">HOLD pending a fresh read.</p>
   </div><p>Only a separately authenticated original assigned supervisor can acknowledge the current Dispatch receipt. Its acknowledgement is not proof of customer acceptance, dispatch release, or Master Shell connectivity.</p></div>`;
  $('settings').append(owner);
  const supervisor=document.createElement('details');supervisor.id='supervisor557';supervisor.className='admin-hub-detail';
  supervisor.innerHTML=`<summary>Original Dispatch · Supervisor Exception Review &amp; Acknowledgement</summary>
   <div class="admin-panel-block"><p>Sign in as the supervisor actually assigned in original Dispatch. No company owner can sign on your behalf. Acknowledgement is a receipt of review, <strong>not</strong> authorization to schedule or tell the customer a new time.</p>
    <button id="supervisor557Refresh" class="secondary" type="button">Refresh my original Dispatch assignments</button>
    <label>Assigned recovery case <select id="supervisor557Case"></select></label>
    <p id="supervisor557Original">No original assigned exception loaded.</p>
    <label>Decision <select id="supervisor557Kind"><option value="reviewed">Reviewed original Dispatch</option><option value="escalated">Escalate conflict/capacity for owner</option></select></label>
    <label>Review details (10–500 characters) <textarea id="supervisor557Note" rows="3" maxlength="500" placeholder="What did we check in original Dispatch?"></textarea></label>
    <label><input type="checkbox" id="supervisor557Attest"> I have personally reviewed the current original Dispatch receipt; this does not authorize crew changes or customer messaging.</label>
    <button id="supervisor557Ack" class="secondary" type="button" disabled>Record my supervisor review</button>
    <p id="supervisor557Status" role="status" aria-live="polite">Sign in as an original assigned supervisor to begin.</p>
   </div>`;
  $('crew').append(supervisor);
  const company=$('owner557Company'),request=$('owner557Case'),assigned=$('supervisor557Case');
  const ownerStatus=$('owner557Status'),supervisorStatus=$('supervisor557Status');
  let ownerId='',companies=[],cases=[],supervisorCases=[],supervisorId='',epoch=0,busy=false;
  function clear(){ownerId='';supervisorId='';companies=[];cases=[];supervisorCases=[];
   company.replaceChildren(option('','Owner login required'));request.replaceChildren(option('','Refresh owner recovery cases'));
   assigned.replaceChildren(option('','Refresh assigned cases'));
   $('owner557Aging').textContent='No original recovery case selected.';
   $('owner557Capacity').textContent='Capacity evidence not checked.';
   $('owner557Supervisor').textContent='Supervisor acknowledgement not checked.';
   $('owner557Reasons').textContent='HOLD: fresh original-source review needed.';
   $('supervisor557Original').textContent='No original assigned exception loaded.';
   $('supervisor557Attest').checked=false;$('supervisor557Note').value='';controls();}
  function controls(){
   $('owner557Refresh').disabled=busy;
   const current=supervisorCases.find(x=>x.request_id===assigned.value);
   $('supervisor557Refresh').disabled=busy;
   $('supervisor557Ack').disabled=busy||!current||!validId(current.dispatch_id)||
    !/^[0-9a-f]{32}$/.test(current.dispatch_signature||'')||!$('supervisor557Attest').checked||
    $('supervisor557Note').value.trim().length<10;
  }
  function showAssignment(){const row=supervisorCases.find(x=>x.request_id===assigned.value);
   $('supervisor557Original').textContent=row?`Case ${row.request_id.slice(0,8)}, version ${row.case_version} · ${row.reason} · ${row.schedule_status} (${when(row.scheduled_start)}–${when(row.scheduled_end)}) · Original receipt ${row.dispatch_id.slice(0,8)}. Refresh if the original Dispatch assignment changes.`:'Select a current original Dispatch receipt.';
   controls();}
  async function refreshOwner(){const run=++epoch;busy=true;controls();ownerStatus.textContent='Reading original owner and company-scoped cases…';
   try{const {id,sb}=await identity();const c=await sb.from('ywi_companies').select('id,name,owner_user_id').eq('owner_user_id',id).limit(30);
    if(c.error||!Array.isArray(c.data)||c.data.some(x=>x.owner_user_id!==id||!validId(x.id)))throw Error(c.error?.message||'Company owner link unverified');
    if(run!==epoch)throw Error('Session changed');ownerId=id;companies=c.data;
    const previous=company.value;company.replaceChildren(option('','Choose owned company'));
    companies.forEach(x=>company.append(option(x.id,x.name||x.id)));if(companies.some(x=>x.id===previous))company.value=previous;
    if(!company.value&&companies.length===1)company.value=companies[0].id;
    await loadCases(run,sb,id);ownerStatus.textContent=`Owner verified. ${cases.length} recovery cases available; select one to reconcile original Dispatch.`;
   }catch(e){if(run===epoch){cases=[];request.replaceChildren(option('','HOLD'));ownerStatus.textContent='HOLD: '+(e.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function loadCases(run,sb,id){const cid=company.value,previous=request.value;cases=[];request.replaceChildren(option('','Select a recovery case'));
   if(!companies.some(x=>x.id===cid)||id!==ownerId)return;
   const z=await sb.from('ywi_landscape_recovery_cases_556').select('company_id,request_id,case_version,state,reason,updated_at').eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
   if(z.error||!Array.isArray(z.data)||z.data.some(x=>x.company_id!==cid))throw Error(z.error?.message||'Cross-company recovery response');
   if(run!==epoch||company.value!==cid)throw Error('Owner company changed');cases=z.data;
   cases.forEach(x=>request.append(option(x.request_id,`${x.state} · ${x.reason} · ${when(x.updated_at)} · ${x.request_id.slice(0,8)}`)));
   if(cases.some(x=>x.request_id===previous))request.value=previous;
  }
  async function review(){const cid=company.value,rid=request.value;if(!cases.some(x=>x.request_id===rid)||!companies.some(x=>x.id===cid)||busy)return;
   busy=true;controls();ownerStatus.textContent='Checking YW553 and original 435 Dispatch against current YW556 case…';
   const run=++epoch;
   try{const {id,sb}=await identity();if(id!==ownerId)throw Error('Owner session changed');
    const z=await sb.rpc('ywi_rpc_landscape_recovery_review_557',{p_company_id:cid,p_request_id:rid});const d=z.data;
    if(z.error||!d||d.company_id!==cid||d.request_id!==rid||d.read_only!==true||
      d.original_source_authority!==true||d.dispatch_authorized!==false||d.customer_confirmation_authorized!==false)
      throw Error(z.error?.message||'Source-side review not verified');
    if(run!==epoch||company.value!==cid||request.value!==rid)throw Error('Original selection changed');
    const cap=d.capacity||{};
    $('owner557Aging').textContent=`${d.aging_band} · ${d.recovery_age_minutes} minutes since case change · version ${d.case_version} · current state ${d.case_state}`;
    $('owner557Capacity').textContent=`Original Dispatch ${String(d.current_dispatch_id).slice(0,8)} · schedule ${cap.schedule_state||'HOLD'} · declared owner minutes ${cap.declared_crew_minutes??'unknown'} · original allocated minutes ${cap.scheduled_minutes??'unknown'} · advisory headroom ${cap.remaining_minutes_advisory??'unknown'} · ${cap.capacity_state||'HOLD'}. Advisory only.`;
    $('owner557Supervisor').textContent=d.acknowledgement?`Current supervisor: ${d.acknowledgement.kind} at ${when(d.acknowledgement.recorded_at)} · receipt ${String(d.acknowledgement.receipt_id).slice(0,8)} (not crew release).`:'HOLD: independently authenticated current supervisor acknowledgement missing or stale.';
    $('owner557Reasons').textContent=(d.reasons||[]).join(' · ')||'All source evidence still needs owner release outside this panel.';
    ownerStatus.textContent=`${d.status}: fresh original Dispatch and 553 source review. No operational records were written.`;
   }catch(e){if(run===epoch){ownerStatus.textContent='HOLD: '+(e.message||e);$('owner557Capacity').textContent='Unverified source; no crew availability claimed.';}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function refreshSupervisor(){busy=true;controls();const run=++epoch;supervisorStatus.textContent='Checking exact original supervisor assignments…';
   try{const {id,sb}=await identity();const z=await sb.rpc('ywi_rpc_landscape_supervisor_queue_557');
    if(z.error||z.data?.read_only!==true||z.data?.dispatch_authorized!==false||!Array.isArray(z.data?.cases)||z.data.cases.length>30)
     throw Error(z.error?.message||'Supervisor source identity unverified');
    if(run!==epoch)throw Error('Account changed');supervisorId=id;supervisorCases=z.data.cases;
    assigned.replaceChildren(option('','Choose assigned original exception'));
    supervisorCases.forEach(x=>assigned.append(option(x.request_id,`${x.state} · ${x.reason} · ${when(x.updated_at)} · ${x.request_id.slice(0,8)}`)));
    showAssignment();supervisorStatus.textContent=`${supervisorCases.length} current original assignments for the authenticated supervisor. Review only.`;
   }catch(e){if(run===epoch){supervisorCases=[];assigned.replaceChildren(option('','HOLD'));supervisorStatus.textContent='HOLD: '+(e.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function acknowledge(){const row=supervisorCases.find(x=>x.request_id===assigned.value);if(!row||busy||!$('supervisor557Attest').checked)return;
   busy=true;controls();supervisorStatus.textContent='Rechecking original Dispatch and recording the supervisor receipt…';const run=++epoch;
   try{const {id,sb}=await identity();if(id!==supervisorId)throw Error('Supervisor sign-in changed');
    const z=await sb.rpc('ywi_rpc_landscape_supervisor_ack_557',{
     p_company_id:row.company_id,p_request_id:row.request_id,p_expected_case_version:row.case_version,
     p_dispatch_id:row.dispatch_id,p_expected_dispatch_signature:row.dispatch_signature,
     p_acknowledgement:$('supervisor557Kind').value,p_note:$('supervisor557Note').value.trim(),p_idempotency_key:key()});
    if(z.error||z.data?.status!=='RECORDED'||z.data?.case_version!==row.case_version||z.data?.dispatch_authorized!==false)
     throw Error(z.error?.message||'Original supervisor receipt not verified');
    if(run!==epoch)throw Error('Account changed');supervisorStatus.textContent=`Supervisor ${$('supervisor557Kind').value} receipt recorded for case version ${row.case_version}. Original Dispatch unchanged. Owner must recheck capacity.`;
    $('supervisor557Attest').checked=false;$('supervisor557Note').value='';
   }catch(e){if(run===epoch)supervisorStatus.textContent='HOLD / NOT VERIFIED: '+(e.message||e)+' Refresh original Dispatch before retrying.';}
   finally{if(run===epoch){busy=false;controls();}}
  }
  company.addEventListener('change',()=>{const run=++epoch;const state=window.YWI_SB||window._sb;
   if(ownerId&&state)void loadCases(run,state,ownerId).then(()=>{ownerStatus.textContent='Choose a case to reconcile.';}).catch(e=>{ownerStatus.textContent='HOLD: '+e.message;});});
  request.addEventListener('change',()=>void review());
  assigned.addEventListener('change',showAssignment);
  $('supervisor557Note').addEventListener('input',controls);
  $('supervisor557Attest').addEventListener('change',controls);
  $('owner557Refresh').addEventListener('click',()=>void refreshOwner());
  $('supervisor557Refresh').addEventListener('click',()=>void refreshSupervisor());
  $('supervisor557Ack').addEventListener('click',()=>void acknowledge());
  document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();ownerStatus.textContent='HOLD: owner session changed';supervisorStatus.textContent='HOLD: supervisor session changed';});
  clear();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
