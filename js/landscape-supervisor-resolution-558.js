/* YW558 — source-bound escalation resolution, reconfirmation gate and audit. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
 const stamp=x=>x?new Date(x).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'}):'not recorded';
 const nonce=()=>crypto.randomUUID();
 async function identity(){
  const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!validId(auth.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Original authenticated company owner required');
  const current=await sb.auth.getUser();
  if(current.error||current.data?.user?.id!==auth.user.id)throw Error('Authenticated user changed');
  return {id:auth.user.id,sb};
 }
 function mount(){
  if(!$('settings')||$('owner558'))return;
  const node=document.createElement('details');node.id='owner558';node.className='admin-hub-detail';
  node.innerHTML=`<summary>Landscaping · Supervisor Escalations, Customer Reconfirmation &amp; Dispatch Audit (owner)</summary>
   <div class="admin-panel-block"><style>
    #owner558,#owner558 label{min-width:0;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}
    #owner558 select,#owner558 textarea{width:100%;max-width:100%;box-sizing:border-box}
    #owner558 button{min-height:44px;white-space:normal}
    #owner558 .yw558-panel{border:1px solid var(--border,#8995a2);border-radius:12px;padding:12px;margin:12px 0}
    #owner558Timeline{list-style:decimal;padding-inline-start:24px;max-height:330px;overflow:auto}
    #owner558Timeline li{margin:0 0 8px;overflow-wrap:anywhere}
   </style>
   <p>Resolve the owner review of an independently escalated case, or request a <em>gate check</em> for customer reconfirmation after the original supervisor and Dispatch sources are clear. Only the original customer portal can record acceptance. No action in this panel schedules crews or sends messages.</p>
   <label>Owned landscaping company <select id="owner558Company"></select></label>
   <label>Original exception case <select id="owner558Case"></select></label>
   <button class="secondary" type="button" id="owner558Refresh">Refresh original audit timeline</button>
   <p id="owner558Status" role="status" aria-live="polite">Authenticate as a company owner to review.</p>
   <div class="yw558-panel"><h3>Original Dispatch and customer gate</h3>
    <p id="owner558Evidence">HOLD: source not reviewed.</p>
    <p id="owner558Customer">Customer response not verified.</p>
   </div>
   <div class="yw558-panel"><h3>Source-linked audit history</h3><ol id="owner558Timeline"><li>Refresh source first.</li></ol></div>
   <div class="yw558-panel"><h3>Owner resolution receipt</h3>
    <label>Action <select id="owner558Action"><option value="escalation_reviewed">Acknowledge supervisor escalation (remains HOLD)</option><option value="reconfirmation_requested">Check readiness for customer reconfirmation (no message sent)</option></select></label>
    <label>Owner resolution notes (10–500 characters) <textarea id="owner558Note" rows="3" maxlength="500" placeholder="Document original Dispatch corrective action and next owner handoff"></textarea></label>
    <label><input type="checkbox" id="owner558Attest"> We reviewed the original job, crew and customer gates. This does not authorize dispatch or impersonate customer acceptance.</label>
    <button type="button" class="secondary" id="owner558Record" disabled>Record owner resolution receipt</button>
    <p id="owner558Result" role="status" aria-live="polite">HOLD pending independent original-source review.</p>
   </div></div>`;
  $('settings').append(node);
  const company=$('owner558Company'),request=$('owner558Case'),status=$('owner558Status');
  let ownerId='',companies=[],cases=[],current=null,epoch=0,busy=false;
  function clear(){ownerId='';companies=[];cases=[];current=null;
   company.replaceChildren(option('','Verify owner first'));request.replaceChildren(option('','Select company and case'));
   $('owner558Evidence').textContent='HOLD: original Dispatch not yet reviewed.';
   $('owner558Customer').textContent='Customer response not verified.';
   $('owner558Timeline').replaceChildren();$('owner558Result').textContent='HOLD pending independent original-source review.';
   $('owner558Note').value='';$('owner558Attest').checked=false;controls();}
  function controls(){
   $('owner558Refresh').disabled=busy;
   const action=$('owner558Action').value;
   const kind=current?.supervisor_kind;
   const actionValid=action==='escalation_reviewed'
    ?kind==='escalated'
    :kind==='reviewed'&&current?.case_state==='replacement_pending_customer'
      &&current?.original_review_status==='ACKNOWLEDGED_REVIEW_ONLY'
      &&current?.customer_reconfirmation?.decision==='PENDING_ORIGINAL_PORTAL';
   $('owner558Record').disabled=busy||!actionValid||!current||
    !validId(current.current_dispatch_id)||!/^[0-9a-f]{32}$/.test(current.current_dispatch_signature||'')||
    !$('owner558Attest').checked||$('owner558Note').value.trim().length<10;
  }
  async function loadCases(run,sb,id){
   const cid=company.value,previous=request.value;cases=[];current=null;
   request.replaceChildren(option('','Choose original case'));
   if(!companies.some(c=>c.id===cid)||ownerId!==id)return;
   const r=await sb.from('ywi_landscape_recovery_cases_556')
    .select('company_id,request_id,case_version,state,reason,updated_at').eq('company_id',cid)
    .order('updated_at',{ascending:false}).limit(50);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid))
    throw Error(r.error?.message||'Company-scoped recovery source unavailable');
   if(run!==epoch||cid!==company.value)throw Error('Company changed');
   cases=r.data;
   cases.forEach(x=>request.append(option(x.request_id,`${x.state} · version ${x.case_version} · ${x.reason} · ${x.request_id.slice(0,8)}`)));
   if(cases.some(x=>x.request_id===previous))request.value=previous;
  }
  async function refreshOwner(){
   const run=++epoch;busy=true;current=null;controls();status.textContent='Checking original owner and recovery case identity…';
   try{const {id,sb}=await identity();const response=await sb.from('ywi_companies')
    .select('id,name,owner_user_id').eq('owner_user_id',id).limit(30);
    if(response.error||!Array.isArray(response.data)||response.data.some(x=>x.owner_user_id!==id||!validId(x.id)))
     throw Error(response.error?.message||'Owner identity or company link unverified');
    if(run!==epoch)throw Error('Session changed');ownerId=id;companies=response.data;
    const old=company.value;company.replaceChildren(option('','Choose owned company'));
    companies.forEach(c=>company.append(option(c.id,c.name||c.id)));
    if(companies.some(c=>c.id===old))company.value=old;
    if(!company.value&&companies.length===1)company.value=companies[0].id;
    await loadCases(run,sb,id);
    status.textContent=`${cases.length} original recovery cases. Select one to read immutable audit evidence.`;
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);request.replaceChildren(option('','HOLD'));}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function review(){
   const cid=company.value,rid=request.value;
   if(!companies.some(x=>x.id===cid)||!cases.some(x=>x.request_id===rid)||busy)return;
   const run=++epoch;busy=true;current=null;controls();status.textContent='Rechecking original Dispatch, supervisor receipt and customer portal…';
   try{const {id,sb}=await identity();if(id!==ownerId)throw Error('Owner session changed');
    const z=await sb.rpc('ywi_rpc_landscape_audit_timeline_558',{p_company_id:cid,p_request_id:rid});
    const d=z.data;if(z.error||!d||d.company_id!==cid||d.request_id!==rid||
     d.company_scope_only!==true||d.read_only!==true||d.dispatch_authorized!==false||
     d.customer_confirmation_authorized!==false||d.master_shell_connection_proven!==false||
     !Array.isArray(d.events)||d.events.length>500)
     throw Error(z.error?.message||'Company-scoped audit source not verified');
    if(run!==epoch||cid!==company.value||rid!==request.value)throw Error('Case changed');
    current=d;
    $('owner558Evidence').textContent=`Case version ${d.case_version} · ${d.case_state} · original Dispatch ${String(d.current_dispatch_id).slice(0,8)} · supervisor ${d.supervisor_kind||'missing'} · original review ${d.original_review_status||'HOLD'}.`;
    $('owner558Customer').textContent=`Original token-validated portal decision: ${d.customer_reconfirmation?.decision||'HOLD'} (never owner-entered).`;
    const timeline=$('owner558Timeline');timeline.replaceChildren();
    if(!d.events.length){const li=document.createElement('li');li.textContent='No immutable source events recorded.';timeline.append(li);}
    for(const event of d.events){const li=document.createElement('li');
     li.textContent=`${stamp(event.at)} · ${event.type||'source'} · ${event.action||'HOLD'} · case v${event.version} · receipt ${String(event.receipt_id||'unknown').slice(0,8)}`;
     timeline.append(li);}
    status.textContent='Read-only original audit refreshed. No crew or customer records changed.';
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);
    $('owner558Evidence').textContent='Original source unavailable; do not act on old evidence.';
    $('owner558Customer').textContent='HOLD: customer portal decision unverified.';
    $('owner558Timeline').replaceChildren();}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function record(){
   if(busy||$('owner558Record').disabled||!current)return;
   const snapshot=current,action=$('owner558Action').value,run=++epoch;
   busy=true;controls();$('owner558Result').textContent='Revalidating original Dispatch before owner resolution receipt…';
   try{const {id,sb}=await identity();if(id!==ownerId||snapshot.company_id!==company.value||
     snapshot.request_id!==request.value)throw Error('Owner or original case changed');
    const response=await sb.rpc('ywi_rpc_landscape_resolution_558',{
     p_company_id:snapshot.company_id,p_request_id:snapshot.request_id,
     p_expected_case_version:snapshot.case_version,
     p_expected_dispatch_signature:snapshot.current_dispatch_signature,
     p_action:action,p_note:$('owner558Note').value.trim(),
     p_idempotency_key:nonce(),p_owner_attested:true});
    const d=response.data;
    if(response.error||!d||!['ESCALATION_REVIEWED_HOLD','RECONFIRMATION_GATE_READY_ONLY'].includes(d.status)||
     d.case_version!==snapshot.case_version||d.customer_confirmed!==false||d.dispatch_authorized!==false)
     throw Error(response.error?.message||'Owner source resolution not verified');
    if(run!==epoch)throw Error('Owner session changed');
    $('owner558Result').textContent=`${d.status} · receipt ${String(d.receipt_id).slice(0,8)}. No customer accepted and no crew was released. Refresh audit for current state.`;
    $('owner558Attest').checked=false;$('owner558Note').value='';current=null;
   }catch(e){if(run===epoch){current=null;$('owner558Result').textContent='HOLD: '+(e.message||e)+' Refresh original Dispatch before retrying.';}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  company.addEventListener('change',()=>{const run=++epoch;current=null;controls();
   if(ownerId){const sb=window.YWI_SB||window._sb;
    void loadCases(run,sb,ownerId).then(()=>{status.textContent='Select a case to review.';})
     .catch(e=>{status.textContent='HOLD: '+e.message;});}});
  request.addEventListener('change',()=>void review());
  $('owner558Refresh').addEventListener('click',()=>void refreshOwner());
  $('owner558Action').addEventListener('change',controls);
  $('owner558Note').addEventListener('input',controls);
  $('owner558Attest').addEventListener('change',controls);
  $('owner558Record').addEventListener('click',()=>void record());
  document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();status.textContent='HOLD: owner session changed; previous evidence cleared.';});
  clear();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
