/* YW561 — provider signature admission, original reopened case supervision,
 * owner-attested source decision. Never a customer-send or Master acceptance UI. */
(() => { 'use strict';
 const $ = id => document.getElementById(id);
 const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const option = (id, label) => { const e = document.createElement('option');e.value=id;e.textContent=label;return e; };
 const newNonce = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 };
 async function owner() {
  const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Original authenticated company owner required');
  const session=await sb.auth.getUser();
  if(session.error||session.data?.user?.id!==a.user.id)throw Error('Original owner session changed');
  return {id:a.user.id,sb};
 }
 function mount(){
  if(!$('settings')||$('owner561'))return;
  const d=document.createElement('details');d.id='owner561';d.className='admin-hub-detail';
  d.innerHTML=`<summary>Landscaping · Verified Provider Receipts &amp; Reopen Supervision (owner)</summary>
   <div class="admin-panel-block">
    <style>
     #owner561,#owner561 *{box-sizing:border-box}
     #owner561{max-width:100%;min-width:0;overflow-wrap:anywhere}
     #owner561 select,#owner561 textarea{max-width:100%;min-width:0;width:100%}
     #owner561 button{min-height:44px;white-space:normal}
     #owner561 .yw561-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px;margin:12px 0}
     #owner561 .yw561-card{border:1px solid var(--border,#8593a2);border-radius:12px;padding:14px;min-width:0}
     #owner561 .yw561-card h3{font-size:1rem;margin:0 0 10px}
     #owner561 .yw561-hold{padding:10px 13px;border-inline-start:4px solid #a56518}
     #owner561 li{padding:4px 0}
    </style>
    <p>Separate cryptographic provider-signature verification from a provider's delivery claim. A signed <em>delivered</em> report still does not establish recipient delivery or AI Data Platform approval. The original YW557 supervisor must independently acknowledge each reopened recovery cycle.</p>
    <div class="yw561-grid"><label>Owned company <select id="owner561Company"></select></label>
     <label>Original recovery case <select id="owner561Case"></select></label></div>
    <button type="button" class="secondary" id="owner561Refresh">Refresh verified original evidence</button>
    <p id="owner561Status" role="status" aria-live="polite">HOLD: authenticate company owner.</p>
    <div class="yw561-grid">
     <section class="yw561-card"><h3>Independent provider signatures</h3><p id="owner561Provider">HOLD: no independently signed receipt.</p>
      <ol id="owner561ProviderHistory"></ol></section>
     <section class="yw561-card"><h3>Original supervisor and customer</h3><p id="owner561Supervisor">HOLD: original reopen and fresh supervisor proof required.</p></section>
     <section class="yw561-card"><h3>Master delivery acceptance</h3><p id="owner561Master">HOLD: independent Master admission is separate.</p></section>
    </div>
    <section class="yw561-card"><h3>Owner review of original reopened case</h3>
     <p>Record a protected owner decision only. “Continuity reviewed” requires original YW556 closure, current YW557 signer and actual customer reconfirmation evidence. “Escalate exception” preserves an open case for a new recovery cycle.</p>
     <label>Decision <select id="owner561Decision">
      <option value="">Choose action</option><option value="continuity_reviewed">Continuity reviewed (only when source ready)</option>
      <option value="exception_escalated">Escalate original open exception</option></select></label>
     <label>Reason, 10–500 characters (no customer details)
      <textarea id="owner561Note" rows="3" maxlength="500" placeholder="Explain what original supervisor or recovery evidence was checked"></textarea></label>
     <label><input type="checkbox" id="owner561Attest"> We reviewed the original case evidence; this does not authorize customer delivery or Master acceptance.</label>
     <button type="button" class="secondary" id="owner561Decide" disabled>Record original owner review</button>
     <p id="owner561Result" role="status" aria-live="polite">HOLD until original source review.</p>
    </section>
    <p class="yw561-hold">Master shell receives only aggregate, privacy-safe evidence. Original company cases stay in their own tenant. Provider signer custody, installation, durable replay and independent Master acceptance must be independently observed; no key is enrolled here.</p>
   </div>`;
  $('settings').append(d);
  const company=$('owner561Company'),request=$('owner561Case'),status=$('owner561Status');
  let ownerId='',companies=[],cases=[],review=null,busy=false,epoch=0;
  function controls(){
   $('owner561Refresh').disabled=busy;
   const action=$('owner561Decision').value,note=$('owner561Note').value.trim();
   const ready=action==='continuity_reviewed'&&review?.supervision_gate==='READY_OWNER_REVIEW'&&
    review?.case_state==='closed_verified'&&review?.closure_source_verified===true&&
    review?.fresh_original_supervisor_verified===true;
   const escalate=action==='exception_escalated'&&review?.case_state==='exception_open';
   $('owner561Decide').disabled=busy||(!ready&&!escalate)||
    review?.company_scope_only!==true||review?.read_only!==true||
    !Number.isInteger(review?.case_version)||!Number.isInteger(review?.reopened_version)||
    !uuid(review?.company_id)||!uuid(review?.request_id)||
    note.length<10||note.length>500||note.includes('@')||!$('owner561Attest').checked;
  }
  function clear(){
   ownerId='';companies=[];cases=[];review=null;
   company.replaceChildren(option('','Authenticate owner'));
   request.replaceChildren(option('','Select original case'));
   $('owner561ProviderHistory').replaceChildren();
   $('owner561Provider').textContent='HOLD: no independently signed receipt.';
   $('owner561Supervisor').textContent='HOLD: original supervisor evidence unavailable.';
   $('owner561Master').textContent='HOLD: not independently Master-accepted.';
   $('owner561Decision').value='';$('owner561Note').value='';$('owner561Attest').checked=false;
   $('owner561Result').textContent='HOLD pending original evidence.';controls();
  }
  async function loadCases(run,sb,id){
   const cid=company.value;cases=[];review=null;
   request.replaceChildren(option('','Choose original case'));
   if(!companies.some(x=>x.id===cid)||id!==ownerId)return;
   const r=await sb.from('ywi_landscape_recovery_cases_556')
    .select('company_id,request_id,case_version,state,updated_at')
    .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid))
    throw Error(r.error?.message||'Original company cases unavailable');
   if(run!==epoch||cid!==company.value)throw Error('Owner company changed');
   cases=r.data;
   for(const c of cases)request.append(option(c.request_id,
    `${c.state} · v${c.case_version} · ${c.request_id.slice(0,8)}`));
  }
  async function refresh(){
   const run=++epoch;busy=true;review=null;controls();
   status.textContent='Checking authenticated original company owner…';
   try{const {id,sb}=await owner();
    const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
     .eq('owner_user_id',id).limit(30);
    if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.owner_user_id!==id||!uuid(x.id)))
     throw Error(r.error?.message||'Owned-company boundary mismatch');
    if(run!==epoch)throw Error('Owner session changed');
    const previous=company.value;ownerId=id;companies=r.data;
    company.replaceChildren(option('','Choose owned company'));
    for(const c of companies)company.append(option(c.id,c.name||c.id));
    if(companies.some(c=>c.id===previous))company.value=previous;
    if(!company.value&&companies.length===1)company.value=companies[0].id;
    await loadCases(run,sb,id);
    status.textContent=`${cases.length} original recovery cases available for protected source review.`;
   }catch(e){if(run===epoch){clear();status.textContent='HOLD: '+(e.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function inspect(){
   const cid=company.value,rid=request.value;
   if(busy||!companies.some(c=>c.id===cid)||!cases.some(c=>c.request_id===rid))return;
   const run=++epoch;busy=true;review=null;controls();
   status.textContent='Verifying independent receipt and original case supervision…';
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Owner changed');
    const r=await sb.rpc('ywi_rpc_landscape_reopen_review_561',
     {p_company_id:cid,p_request_id:rid});const v=r.data;
    if(r.error||!v||v.company_id!==cid||v.request_id!==rid||
       v.company_scope_only!==true||v.read_only!==true||
       v.customer_delivery_independently_verified!==false||
       v.customer_message_sent!==false||v.master_delivery_accepted!==false||
       v.master_connection_proven!==false||!Array.isArray(v.provider_signed_receipts)||
       v.provider_signed_receipts.length>20||v.provider_signed_receipts.some(x=>
        x.signature_verified!==true||x.replay_committed!==true||
        x.customer_delivery_independently_verified!==false))
     throw Error(r.error?.message||'Missing original protected source HOLD assurances');
    if(run!==epoch||cid!==company.value||rid!==request.value)throw Error('Original case changed');
    review=v;
    $('owner561Provider').textContent=`${v.provider_signed_receipts.length} independently Ed25519-verified provider reports; all reported delivery is still recipient-unverified.`;
    const history=$('owner561ProviderHistory');history.replaceChildren();
    if(!v.provider_signed_receipts.length){const li=document.createElement('li');
     li.textContent='HOLD: independent receiver has admitted no signed provider receipts.';history.append(li);}
    for(const receipt of v.provider_signed_receipts){const li=document.createElement('li');
     li.textContent=`Provider reported ${receipt.provider_state} · signature verified · nonce committed · receipt ${String(receipt.receipt_id).slice(0,8)} · recipient delivery HOLD`;
     history.append(li);}
    $('owner561Supervisor').textContent=`Original case ${v.case_state} v${v.case_version}. Reopen v${v.reopened_version||'HOLD'}. Fresh original YW557 supervisor: ${v.fresh_original_supervisor_verified?'VERIFIED':'HOLD'}. Customer reconfirmation and closure: ${v.closure_source_verified?'VERIFIED':'HOLD'}. Owner decision: ${v.owner_decision}.`;
    $('owner561Master').textContent='HOLD — no automatic Master delivery acceptance, connection, or customer-message authorization.';
    status.textContent=`Protected gate: ${v.supervision_gate}. Select an owner decision only when its original source conditions are met.`;
   }catch(e){if(run===epoch){review=null;status.textContent='HOLD: '+(e.message||e);
    $('owner561ProviderHistory').replaceChildren();}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function decide(){
   if(busy||$('owner561Decide').disabled||!review)return;
   const v=review,action=$('owner561Decision').value,note=$('owner561Note').value.trim();
   const run=++epoch;busy=true;controls();
   $('owner561Result').textContent='Recording attested original owner decision…';
   try{const {id,sb}=await owner();
    if(id!==ownerId||company.value!==v.company_id||request.value!==v.request_id)
     throw Error('Owner/company/case changed');
    const r=await sb.rpc('ywi_rpc_landscape_supervision_decide_561',{
     p_company_id:v.company_id,p_request_id:v.request_id,
     p_expected_case_version:v.case_version,p_decision:action,p_note:note,
     p_idempotency_key:newNonce(),p_owner_attested:true });
    const receipt=r.data;
    if(r.error||!receipt||receipt.status!=='ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD'||
       !uuid(receipt.receipt_id)||receipt.master_delivery_accepted!==false)
     throw Error(r.error?.message||'Original source decision not admitted');
    if(run!==epoch)throw Error('Owner session changed');
    $('owner561Result').textContent=`ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD · ${receipt.receipt_id.slice(0,8)}. Master delivery acceptance remains HOLD.`;
    review=null;$('owner561Decision').value='';$('owner561Note').value='';$('owner561Attest').checked=false;
   }catch(e){if(run===epoch){review=null;$('owner561Result').textContent=
    'HOLD: '+(e.message||e)+' Refresh original source.';}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  company.addEventListener('change',()=>{const run=++epoch;review=null;controls();
   if(ownerId){const sb=window.YWI_SB||window._sb;void loadCases(run,sb,ownerId)
    .then(()=>{status.textContent='Choose an original case.';})
    .catch(e=>{status.textContent='HOLD: '+e.message;});}});
  request.addEventListener('change',()=>void inspect());
  $('owner561Refresh').addEventListener('click',()=>void refresh());
  $('owner561Decision').addEventListener('change',controls);
  $('owner561Note').addEventListener('input',controls);
  $('owner561Attest').addEventListener('change',controls);
  $('owner561Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;clear();status.textContent='HOLD: original owner session changed; protected evidence cleared.';});
  clear();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
