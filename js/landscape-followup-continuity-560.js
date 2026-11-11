/* YW560 — protected provider-claim receipts, owner-controlled original reopen, supervisor continuity. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const opt=(id,caption)=>{const e=document.createElement('option');e.value=id;e.textContent=caption;return e;};
 const stamp=x=>x?new Date(x).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'}):'not recorded';
 const nonce=()=>crypto.randomUUID();
 async function source(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!uuid(state.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Authenticated company owner required');
  const v=await sb.auth.getUser();
  if(v.error||v.data?.user?.id!==state.user.id)
   throw Error('Original owner session changed');
  return {id:state.user.id,sb};
 }
 function mount(){
  if(!$('settings')||$('owner560'))return;
  const d=document.createElement('details');d.id='owner560';d.className='admin-hub-detail';
  d.innerHTML=`<summary>Landscaping · Customer Follow-Up Receipts &amp; Reopen Continuity (owner)</summary>
   <div class="admin-panel-block">
    <style>
     #owner560,#owner560 *{box-sizing:border-box}
     #owner560{min-width:0;max-width:100%;overflow-wrap:anywhere}
     #owner560 select,#owner560 textarea{width:100%;min-width:0;max-width:100%}
     #owner560 button{min-height:44px;white-space:normal}
     #owner560 .yw560-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px;margin:12px 0}
     #owner560 .yw560-card{border:1px solid var(--border,#8593a2);border-radius:12px;padding:14px;min-width:0}
     #owner560 .yw560-card h3{font-size:1rem;margin:0 0 9px}
     #owner560 .yw560-hold{border-inline-start:4px solid #a56518;padding:10px 13px}
     #owner560 .yw560-history{padding-inline-start:24px;max-height:300px;overflow:auto}
     #owner560 .yw560-history li{padding:4px 0 7px}
    </style>
    <p>Review original YW556/YW559 closure and follow-up intent alongside provider-reported transport metadata. A provider claim is <strong>not independently verified delivery</strong>. Reopening calls the original owner-gated YW556 recovery procedure and requires a fresh independent YW557 supervisor acknowledgement.</p>
    <div class="yw560-grid">
     <label>Owned company <select id="owner560Company"></select></label>
     <label>Original recovery case <select id="owner560Case"></select></label>
    </div>
    <button type="button" class="secondary" id="owner560Refresh">Refresh original evidence</button>
    <p id="owner560Status" role="status" aria-live="polite">Sign in as company owner to begin.</p>
    <div class="yw560-grid">
     <section class="yw560-card"><h3>Original recovery</h3><p id="owner560CaseProof">HOLD: select an original case.</p></section>
     <section class="yw560-card"><h3>Protected provider reports</h3><p id="owner560Transport">HOLD: no provider receipt imported.</p></section>
     <section class="yw560-card"><h3>Supervisor continuity</h3><p id="owner560Supervisor">HOLD: no fresh original supervisor acknowledgement.</p></section>
    </div>
    <div class="yw560-grid">
     <section class="yw560-card"><h3>Provider claim timeline (not delivery proof)</h3>
      <ol id="owner560ProviderHistory" class="yw560-history"></ol></section>
     <section class="yw560-card"><h3>Original reopen audit timeline</h3>
      <ol id="owner560ReopenHistory" class="yw560-history"></ol></section>
    </div>
    <section class="yw560-card">
     <h3>Reopen original recovery exception</h3>
     <p>This explicitly changes the original YW556 recovery case from <em>closed_verified</em> to <em>exception_open</em>. It does not change Jobs, Dispatch assignments, customer confirmation or communications.</p>
     <label>Original exception reason <select id="owner560Reason">
      <option value="">Choose reason</option><option value="crew_unavailable">Crew unavailable</option>
      <option value="schedule_conflict">Schedule conflict</option><option value="weather">Weather</option>
      <option value="equipment">Equipment</option><option value="access">Property access</option>
      <option value="other">Other exception</option>
     </select></label>
     <label>Owner explanation, 10–500 characters, no customer details
      <textarea rows="3" maxlength="500" id="owner560Note" placeholder="Describe why the verified case needs a new original recovery cycle"></textarea>
     </label>
     <label><input type="checkbox" id="owner560Attest"> We authorize reopening the original case and understand fresh supervisor and customer acceptance gates will be required.</label>
     <button type="button" class="secondary" id="owner560Reopen" disabled>Reopen original recovery case</button>
     <p id="owner560Result" role="status" aria-live="polite">HOLD until original source evidence is verified.</p>
    </section>
    <p class="yw560-hold">AI Data Platform / Comms Hub: independent source signer, signed health receipt, durable replay verification, actual provider delivery and owner acceptance remain HOLD unless separately verified. This screen cannot send a customer message.</p>
   </div>`;
  $('settings').append(d);
  const company=$('owner560Company'),request=$('owner560Case'),status=$('owner560Status');
  let ownerId='',companies=[],cases=[],current=null,epoch=0,busy=false;
  function controls(){
   $('owner560Refresh').disabled=busy;
   const note=$('owner560Note').value.trim();
   $('owner560Reopen').disabled=busy||current?.reopen_eligible!==true||
    current?.read_only!==true||current?.company_scope_only!==true||
    !uuid(current?.followup_intent_id)||!uuid(current?.current_dispatch_id)||
    !/^[a-f0-9]{32}$/.test(current?.current_dispatch_signature||'')||
    !['crew_unavailable','schedule_conflict','weather','equipment','access','other'].includes($('owner560Reason').value)||
    note.length<10||note.length>500||note.includes('@')||!$('owner560Attest').checked;
  }
  function clear(){
   ownerId='';companies=[];cases=[];current=null;
   company.replaceChildren(opt('','Authenticate owner'));
   request.replaceChildren(opt('','Select original case'));
   $('owner560CaseProof').textContent='HOLD: original source unavailable.';
   $('owner560Transport').textContent='HOLD: provider receipts not independently verified.';
   $('owner560Supervisor').textContent='HOLD: fresh original supervisor acknowledgement required.';
   $('owner560ProviderHistory').replaceChildren();$('owner560ReopenHistory').replaceChildren();
   $('owner560Reason').value='';$('owner560Note').value='';$('owner560Attest').checked=false;
   $('owner560Result').textContent='HOLD pending original source verification.';
   controls();
  }
  async function loadCases(run,sb,id){
   const cid=company.value,previous=request.value;current=null;cases=[];
   request.replaceChildren(opt('','Select original case'));
   if(!companies.some(x=>x.id===cid)||id!==ownerId)return;
   const r=await sb.from('ywi_landscape_recovery_cases_556')
    .select('company_id,request_id,case_version,state,reason,updated_at')
    .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid))
    throw Error(r.error?.message||'Original owned-company recovery source unavailable');
   if(run!==epoch||cid!==company.value)throw Error('Owner or company changed');
   cases=r.data;
   for(const c of cases)request.append(opt(c.request_id,
    `${c.state} · v${c.case_version} · ${c.reason} · ${c.request_id.slice(0,8)}`));
   if(cases.some(x=>x.request_id===previous))request.value=previous;
  }
  async function refreshOwner(){
   const run=++epoch;busy=true;current=null;controls();
   status.textContent='Authenticating original company owner and recovery source…';
   try{const {id,sb}=await source();
    const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
     .eq('owner_user_id',id).limit(30);
    if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.owner_user_id!==id||!uuid(x.id)))
     throw Error(r.error?.message||'Owner-company scope mismatch');
    if(run!==epoch)throw Error('Owner session changed');
    ownerId=id;companies=r.data;const old=company.value;
    company.replaceChildren(opt('','Choose owned company'));
    for(const c of companies)company.append(opt(c.id,c.name||c.id));
    if(companies.some(x=>x.id===old))company.value=old;
    if(!company.value&&companies.length===1)company.value=companies[0].id;
    await loadCases(run,sb,id);
    status.textContent=`${cases.length} original cases. Select one to inspect protected follow-up evidence.`;
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  function history(id,items,render,empty){
   const ul=$(id);ul.replaceChildren();
   if(!items.length){const li=document.createElement('li');li.textContent=empty;ul.append(li);}
   for(const item of items){const li=document.createElement('li');li.textContent=render(item);ul.append(li);}
  }
  async function review(){
   const cid=company.value,rid=request.value;
   if(busy||!companies.some(x=>x.id===cid)||!cases.some(x=>x.request_id===rid))return;
   const run=++epoch;busy=true;current=null;controls();
   status.textContent='Rechecking original owner scope, provider report claims and supervisor source…';
   try{const {id,sb}=await source();if(id!==ownerId)throw Error('Owner identity changed');
    const r=await sb.rpc('ywi_rpc_landscape_continuity_review_560',
     {p_company_id:cid,p_request_id:rid});
    const v=r.data;
    if(r.error||!v||v.company_id!==cid||v.request_id!==rid||
     v.company_scope_only!==true||v.read_only!==true||
     v.delivery_independently_verified!==false||
     v.customer_message_sent_verified!==false||
     v.customer_contact_authorized!==false||v.dispatch_authorized!==false||
     v.master_shell_connection_proven!==false||v.owner_acceptance_in_master!==false||
     !Array.isArray(v.provider_reports)||v.provider_reports.length>20||
     !Array.isArray(v.reopen_events)||v.reopen_events.length>20)
     throw Error(r.error?.message||'Protected source proof and all HOLD flags required');
    if(run!==epoch||cid!==company.value||rid!==request.value)throw Error('Case or company changed');
    current=v;
    $('owner560CaseProof').textContent=`Original YW556 case v${v.case_version} · ${v.case_state}. Follow-up intent ${String(v.followup_intent_id||'HOLD').slice(0,8)}. Reopen eligible: ${v.reopen_eligible===true?'yes':'no'}.`;
    $('owner560Transport').textContent=`${v.provider_reports.length} protected provider reports. All delivery claims remain MASTER_UNVERIFIED; no customer messaging is authorized here.`;
    $('owner560Supervisor').textContent=`${v.supervisor_continuity}. Original YW557 fresh acknowledgement: ${v.fresh_supervisor_acknowledged===true?'present':'HOLD'}.`;
    history('owner560ProviderHistory',v.provider_reports,
     x=>`${stamp(x.provider_reported_at)} · provider-reported ${x.provider_reported_state} · ${String(x.receipt_id||'HOLD').slice(0,8)} · NOT independently delivered`,
     'No authenticated provider reports imported.');
    history('owner560ReopenHistory',v.reopen_events,
     x=>`${stamp(x.recorded_at)} · case v${x.original_closed_version} → v${x.reopened_version} · original audit ${x.original_reopen_audit_id} · ${x.reason}`,
     'No linked original YW556 reopen events.');
    status.textContent=v.reopen_eligible===true
     ?'Original closed case and follow-up intent linked. Owner may explicitly reopen with new attestation.'
     :'HOLD for reopen: case not closed, changed, or prior follow-up intent absent.';
   }catch(e){if(run===epoch){current=null;status.textContent='HOLD: '+(e.message||e);
    $('owner560CaseProof').textContent='HOLD: original source unavailable.';
    $('owner560Transport').textContent='HOLD: no verified delivery evidence.';
    $('owner560Supervisor').textContent='HOLD: independent supervisor source unavailable.';
    $('owner560ProviderHistory').replaceChildren();$('owner560ReopenHistory').replaceChildren();}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function reopen(){
   if(busy||$('owner560Reopen').disabled||!current)return;
   const c=current,run=++epoch;busy=true;controls();
   $('owner560Result').textContent='Verifying original YW556 source and owner attestation…';
   try{const {id,sb}=await source();if(id!==ownerId||
     company.value!==c.company_id||request.value!==c.request_id)
     throw Error('Owner/company/case changed');
    const r=await sb.rpc('ywi_rpc_landscape_reopen_560',{
     p_company_id:c.company_id,p_request_id:c.request_id,
     p_expected_closed_version:c.case_version,
     p_expected_dispatch_signature:c.current_dispatch_signature,
     p_reason:$('owner560Reason').value,p_note:$('owner560Note').value.trim(),
     p_idempotency_key:nonce(),p_owner_attested:true
    });
    const v=r.data;
    if(r.error||!v||v.status!=='ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD'||
     v.dispatch_authorized!==false||v.customer_message_sent_verified!==false||
     !uuid(v.receipt_id)||v.reopened_version!==c.case_version+1)
     throw Error(r.error?.message||'Original YW556 reopen audit not verified');
    if(run!==epoch)throw Error('Owner session changed');
    $('owner560Result').textContent=`ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD · receipt ${v.receipt_id.slice(0,8)} · v${v.reopened_version}. Fresh independent supervisor acknowledgement required. Refresh original source.`;
    current=null;$('owner560Reason').value='';$('owner560Note').value='';$('owner560Attest').checked=false;
   }catch(e){if(run===epoch){current=null;$('owner560Result').textContent=
    'HOLD: '+(e.message||e)+' Refresh source before retrying.';}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  company.addEventListener('change',()=>{const run=++epoch;current=null;controls();
   if(ownerId){const sb=window.YWI_SB||window._sb;
    void loadCases(run,sb,ownerId).then(()=>{status.textContent='Select original recovery case.';})
     .catch(e=>{status.textContent='HOLD: '+e.message;});}});
  request.addEventListener('change',()=>void review());
  $('owner560Refresh').addEventListener('click',()=>void refreshOwner());
  $('owner560Reason').addEventListener('change',controls);
  $('owner560Note').addEventListener('input',controls);
  $('owner560Attest').addEventListener('change',controls);
  $('owner560Reopen').addEventListener('click',()=>void reopen());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;clear();status.textContent='HOLD: owner session changed; protected evidence cleared.';});
  clear();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
