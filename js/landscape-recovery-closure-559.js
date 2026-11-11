/* YW559 — source-linked recovery closure and owner follow-up evidence. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const option=(id,label)=>{const e=document.createElement('option');e.value=id;e.textContent=label;return e;};
 const stamp=x=>x?new Date(x).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'}):'not recorded';
 const nonce=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),
  n=>n.toString(16).padStart(2,'0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 async function identity(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!validId(state.user?.id)||
   !sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Original authenticated company owner required');
  const current=await sb.auth.getUser();
  if(current.error||current.data?.user?.id!==state.user.id)
   throw Error('Owner identity changed; sign in again');
  return {id:state.user.id,sb};
 }
 function mount(){
  if(!$('settings')||$('owner559'))return;
  const wrapper=document.createElement('details');
  wrapper.id='owner559';wrapper.className='admin-hub-detail';
  wrapper.innerHTML=`<summary>Landscaping · Dispatch Recovery Closure &amp; Follow-Up Evidence (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner559,#owner559 *{box-sizing:border-box}
    #owner559{min-width:0;max-width:100%;overflow-wrap:anywhere}
    #owner559 select,#owner559 textarea{width:100%;max-width:100%;min-width:0}
    #owner559 button{min-height:44px;white-space:normal}
    #owner559 .yw559-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;margin:12px 0}
    #owner559 .yw559-card{border:1px solid var(--border,#8491a0);border-radius:12px;padding:14px;min-width:0}
    #owner559 .yw559-card h3{font-size:1rem;margin:0 0 9px}
    #owner559 .yw559-hold{border-inline-start:4px solid #b77815;padding:9px 12px}
    #owner559Timeline{list-style:decimal;padding-inline-start:23px;max-height:320px;overflow:auto}
    #owner559Timeline li{padding:3px 0 7px;overflow-wrap:anywhere}
   </style>
   <p>Review a closure already completed by the original YW556 recovery flow. Verify the genuine customer portal and supervisor receipts, then record separate owner review and follow-up <em>intent</em> evidence. This panel cannot close a case, send a message, approve customer consent, or dispatch a crew.</p>
   <div class="yw559-grid">
    <label>Owned landscaping company <select id="owner559Company"></select></label>
    <label>Original recovery case <select id="owner559Case"></select></label>
   </div>
   <button type="button" class="secondary" id="owner559Refresh">Refresh original closure evidence</button>
   <p id="owner559Status" role="status" aria-live="polite">Authenticate as the company owner to begin.</p>
   <div class="yw559-grid">
    <section class="yw559-card"><h3>Original dispatch closure</h3><p id="owner559Closure">HOLD: original 556 close proof not loaded.</p></section>
    <section class="yw559-card"><h3>Customer portal evidence</h3><p id="owner559Customer">HOLD: no verified customer receipt.</p></section>
    <section class="yw559-card"><h3>Supervisor outcome</h3><p id="owner559Supervisor">HOLD: original 557 supervisor acknowledgement not reviewed.</p></section>
   </div>
   <div class="yw559-card">
    <h3>Company-scoped source timeline</h3>
    <ol id="owner559Timeline"><li>Select a case and refresh the source.</li></ol>
   </div>
   <div class="yw559-card">
    <h3>Owner review receipt</h3>
    <label>Next action <select id="owner559Action">
     <option value="closure_reviewed">Review original verified closure</option>
     <option value="supervisor_outcome_reviewed">Review supervisor outcome</option>
     <option value="customer_followup_requested">Request customer follow-up review (does not send)</option>
    </select></label>
    <label>Owner notes, 10–500 characters; exclude customer contact details
     <textarea id="owner559Note" rows="3" maxlength="500" placeholder="Describe the source-linked outcome and handoff without customer details"></textarea>
    </label>
    <label><input type="checkbox" id="owner559Attest"> We checked the original closure, supervisor, and customer receipt. We are not authorizing dispatch or customer messaging.</label>
    <button type="button" class="secondary" id="owner559Record" disabled>Record owner review evidence</button>
    <p id="owner559Result" role="status" aria-live="polite">HOLD until original closure evidence is independently verified.</p>
   </div>
   <p class="yw559-hold">Master Shell / Comms Hub customer follow-up delivery: HOLD until independently authorized and receipted. No communication is sent by this build.</p>
  </div>`;
  $('settings').append(wrapper);
  const company=$('owner559Company'),request=$('owner559Case'),status=$('owner559Status');
  let ownerId='',companies=[],cases=[],current=null,epoch=0,busy=false;
  function controls(){
   $('owner559Refresh').disabled=busy;
   const events=current?.events||[];
   const has=action=>events.some(x=>x.action===action);
   const action=$('owner559Action').value;
   const eligible=current?.closure_ready===true&&
    (action==='closure_reviewed'&&!has(action)||
     action==='supervisor_outcome_reviewed'&&has('closure_reviewed')&&!has(action)||
     action==='customer_followup_requested'&&has('closure_reviewed')&&
      has('supervisor_outcome_reviewed')&&!has(action));
   const note=$('owner559Note').value.trim();
   $('owner559Record').disabled=busy||!eligible||!validId(current?.current_dispatch_id)||
    !/^[a-f0-9]{32}$/.test(current?.current_dispatch_signature||'')||
    note.length<10||note.length>500||note.includes('@')||
    !$('owner559Attest').checked;
  }
  function clear(){
   ownerId='';companies=[];cases=[];current=null;
   company.replaceChildren(option('','Authenticate owner'));
   request.replaceChildren(option('','Select original case'));
   $('owner559Closure').textContent='HOLD: original closure not loaded.';
   $('owner559Customer').textContent='HOLD: portal receipt unavailable.';
   $('owner559Supervisor').textContent='HOLD: supervisor acknowledgement unavailable.';
   $('owner559Timeline').replaceChildren();
   $('owner559Note').value='';$('owner559Attest').checked=false;
   $('owner559Result').textContent='HOLD pending original closure verification.';
   controls();
  }
  async function loadCases(run,sb,id){
   const cid=company.value,prior=request.value;
   current=null;cases=[];request.replaceChildren(option('','Select original case'));
   if(!companies.some(x=>x.id===cid)||id!==ownerId)return;
   const r=await sb.from('ywi_landscape_recovery_cases_556')
    .select('company_id,request_id,case_version,state,reason,updated_at')
    .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid))
    throw Error(r.error?.message||'Original owned-company case source unavailable');
   if(run!==epoch||cid!==company.value)throw Error('Company changed');
   cases=r.data;
   for(const c of cases)request.append(option(c.request_id,
    `${c.state} · v${c.case_version} · ${c.reason} · ${c.request_id.slice(0,8)}`));
   if(cases.some(x=>x.request_id===prior))request.value=prior;
  }
  async function refreshOwner(){
   const run=++epoch;busy=true;current=null;controls();
   status.textContent='Verifying company ownership and the original recovery queue…';
   try{const {id,sb}=await identity();
    const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
     .eq('owner_user_id',id).limit(30);
    if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.owner_user_id!==id||!validId(x.id)))
     throw Error(r.error?.message||'Owned-company identity mismatch');
    if(run!==epoch)throw Error('Owner session changed');
    ownerId=id;companies=r.data;const old=company.value;
    company.replaceChildren(option('','Choose owned company'));
    for(const c of companies)company.append(option(c.id,c.name||c.id));
    if(companies.some(x=>x.id===old))company.value=old;
    if(!company.value&&companies.length===1)company.value=companies[0].id;
    await loadCases(run,sb,id);
    status.textContent=`${cases.length} original recovery cases. Select one to review closure receipts.`;
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function review(){
   const cid=company.value,rid=request.value;
   if(busy||!companies.some(x=>x.id===cid)||!cases.some(x=>x.request_id===rid))return;
   const run=++epoch;busy=true;current=null;controls();
   status.textContent='Rechecking original 556 closure, token-validated customer response and 557 supervisor signature…';
   try{const {id,sb}=await identity();
    if(id!==ownerId)throw Error('Owner identity changed');
    const r=await sb.rpc('ywi_rpc_landscape_closure_review_559',
     {p_company_id:cid,p_request_id:rid});
    const d=r.data;
    if(r.error||!d||d.company_id!==cid||d.request_id!==rid||
     d.company_scope_only!==true||d.read_only!==true||
     d.customer_message_sent!==false||d.dispatch_authorized!==false||
     d.master_shell_connection_proven!==false||d.owner_acceptance_in_master!==false||
     !Array.isArray(d.events)||d.events.length>100)
     throw Error(r.error?.message||'Read-only source evidence was not verified');
    if(run!==epoch||cid!==company.value||rid!==request.value)throw Error('Case or owner changed');
    current=d;
    $('owner559Closure').textContent=`Case v${d.case_version} · ${d.case_state} · ${d.source_gate} · original close audit ${String(d.original_close_audit_id||'HOLD').slice(0,12)}.`;
    $('owner559Customer').textContent=`Original portal decision ${d.original_customer_decision}; receipt ${String(d.original_customer_receipt_id||'HOLD').slice(0,8)} · ${stamp(d.original_customer_recorded_at)}. No customer details displayed.`;
    $('owner559Supervisor').textContent=`Original supervisor receipt ${String(d.original_supervisor_receipt_id||'HOLD').slice(0,8)} · current Dispatch ${String(d.current_dispatch_id||'HOLD').slice(0,8)}. This screen records owner review only.`;
    const list=$('owner559Timeline');list.replaceChildren();
    if(!d.events.length){const li=document.createElement('li');li.textContent='No YW559 owner outcome receipts yet.';list.append(li);}
    for(const x of d.events){const li=document.createElement('li');
     li.textContent=`${stamp(x.at)} · ${x.action||'HOLD'} · case v${x.case_version} · receipt ${String(x.receipt_id||'missing').slice(0,8)}`;
     list.append(li);}
    status.textContent=d.closure_ready===true
     ?'Original closure receipts source-linked. Select the next permitted owner review action.'
     :'HOLD: original closure, supervisor or customer response is not verified.';
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);
    $('owner559Closure').textContent='HOLD: original source unavailable.';
    $('owner559Customer').textContent='HOLD: no verified original portal receipt.';
    $('owner559Supervisor').textContent='HOLD: original supervisor receipt unavailable.';
    $('owner559Timeline').replaceChildren();}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function record(){
   if(busy||$('owner559Record').disabled||!current)return;
   const snapshot=current,action=$('owner559Action').value,run=++epoch;
   busy=true;controls();$('owner559Result').textContent='Revalidating exact original closure and immutable receipts…';
   try{const {id,sb}=await identity();if(id!==ownerId||
     company.value!==snapshot.company_id||request.value!==snapshot.request_id)
     throw Error('Owner or original source case changed');
    const r=await sb.rpc('ywi_rpc_landscape_closure_record_559',{
     p_company_id:snapshot.company_id,p_request_id:snapshot.request_id,
     p_expected_case_version:snapshot.case_version,
     p_expected_dispatch_signature:snapshot.current_dispatch_signature,
     p_action:action,p_note:$('owner559Note').value.trim(),
     p_idempotency_key:nonce(),p_owner_attested:true
    });
    const d=r.data;
    if(r.error||!d||!['CLOSURE_REVIEWED_SOURCE_LINKED','SUPERVISOR_OUTCOME_REVIEWED',
     'FOLLOWUP_REVIEW_INTENT_ONLY'].includes(d.status)||
     d.customer_message_sent!==false||d.dispatch_authorized!==false||
     d.owner_acceptance_in_master!==false)
     throw Error(r.error?.message||'Owner review receipt cannot be verified');
    if(run!==epoch)throw Error('Session changed');
    $('owner559Result').textContent=`${d.status} · receipt ${String(d.receipt_id).slice(0,8)}. No message sent. Refresh original evidence.`;
    current=null;$('owner559Note').value='';$('owner559Attest').checked=false;
   }catch(e){if(run===epoch){current=null;$('owner559Result').textContent=
    'HOLD: '+(e.message||e)+' Refresh original evidence before retrying.';}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  company.addEventListener('change',()=>{const run=++epoch;current=null;controls();
   if(ownerId){const sb=window.YWI_SB||window._sb;
    void loadCases(run,sb,ownerId).then(()=>{status.textContent='Select an original case to review.';})
     .catch(e=>{status.textContent='HOLD: '+e.message;});}});
  request.addEventListener('change',()=>void review());
  $('owner559Refresh').addEventListener('click',()=>void refreshOwner());
  $('owner559Action').addEventListener('change',controls);
  $('owner559Note').addEventListener('input',controls);
  $('owner559Attest').addEventListener('change',controls);
  $('owner559Record').addEventListener('click',()=>void record());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;clear();status.textContent='HOLD: owner session changed; source evidence cleared.';});
  clear();
 }
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
