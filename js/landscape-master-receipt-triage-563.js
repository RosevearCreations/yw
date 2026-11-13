/* YW563 owner-only signed Master observation discrepancy triage.
 * All writes are original SOURCE follow-up decisions, never customer sends,
 * independent Master owner acceptance, or cross-company connections. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
 const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
 let epoch=0,busy=false,ownerId=null,companies=[],cases=[],receipts=[],review=null;
 const status=s=>{$('owner563Status').textContent=s;};
 function owns(cid){return companies.some(c=>c.id===cid&&c.owner_user_id===ownerId);}
 async function owner(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!uuid(state.user?.id)||
    !sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Original authenticated company owner required');
  const session=await sb.auth.getUser();
  if(session.error||session.data?.user?.id!==state.user.id)
   throw Error('Original owner session changed');
  return {id:state.user.id,sb};
 }
 function nonce(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  return [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 }
 function evidenceClear(){
  review=null;receipts=[];
  $('owner563Receipt').replaceChildren(option('','Choose original signed provider receipt'));
  $('owner563Comparison').textContent='HOLD — no independently admitted Master receipt selected.';
  $('owner563Closure').textContent='HOLD — original source closure, current signed Master receipt and owner attestation required.';
  $('owner563Action').value='';$('owner563Note').value='';$('owner563Attest').checked=false;
  controls();
 }
 function controls(){
  const v=review,action=$('owner563Action')?.value,note=$('owner563Note')?.value.trim()||'';
  const valid=v?.company_scope_only===true&&v?.read_only===true&&
   v?.recipient_delivery_independently_verified===false&&
   v?.customer_message_sent===false&&
   v?.master_owner_acceptance===false&&v?.master_connected===false&&
   owns(v.company_id)&&cases.some(c=>c.request_id===v.request_id&&c.case_version===v.case_version)&&
   receipts.some(r=>r.id===v.provider_verified_receipt_id);
  const discrepancy=['HASH_MISMATCH','MASTER_DISCREPANCY','MASTER_REJECTED'];
  const allowed=action==='request_master_recheck'&&
    (v?.latest_owner_action!=='approve_source_followup_closure'||
     v?.master_comparison!=='MATCHED_RECEIPT_CLAIM')||
   action==='escalate_receipt_discrepancy'&&
    uuid(v?.master_observation_id)&&discrepancy.includes(v?.master_comparison)||
   action==='approve_source_followup_closure'&&v?.source_followup_closure_ready===true&&
    v?.master_comparison==='MATCHED_RECEIPT_CLAIM'&&
    v?.latest_owner_action!=='approve_source_followup_closure';
  $('owner563Decide').disabled=busy||!valid||!allowed||
   note.length<15||note.length>500||!$('owner563Attest').checked;
 }
 async function loadCases(run,sb){
  cases=[];evidenceClear();
  $('owner563Case').replaceChildren(option('','Choose original recovery case'));
  const company=$('owner563Company').value;
  if(!owns(company))return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
   .select('company_id,request_id,case_version,state,updated_at')
   .eq('company_id',company).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.company_id!==company||!uuid(c.request_id)))
   throw Error(r.error?.message||'Original cases unavailable');
  if(run!==epoch||company!==$('owner563Company').value)throw Error('Original company changed');
  cases=r.data;
  for(const c of cases)$('owner563Case').append(option(c.request_id,
   c.state+' · v'+c.case_version+' · '+c.request_id.slice(0,8)));
  status('Choose a case and the original signed provider receipt to inspect Master correlation.');
 }
 async function loadReceipts(){
  const run=++epoch;busy=true;evidenceClear();controls();
  try{
   const {id,sb}=await owner();
   const company=$('owner563Company').value,request=$('owner563Case').value;
   if(id!==ownerId||!owns(company)||!cases.some(c=>c.request_id===request))
    throw Error('Original owner/company/case changed');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',company).eq('request_id',request)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==company||
     x.request_id!==request||!uuid(x.id)))throw Error(r.error?.message||'Independent receipts missing');
   if(run!==epoch||company!==$('owner563Company').value||
      request!==$('owner563Case').value)throw Error('Original source changed');
   receipts=r.data;
   for(const item of receipts)$('owner563Receipt').append(option(item.id,
    item.provider_reported_state+' · v'+item.case_version+' · '+item.id.slice(0,8)));
   status(receipts.length+' independently signed provider claims found. Master receipt and customer delivery remain separate.');
  }catch(e){if(run===epoch){evidenceClear();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),company=$('owner563Company').value,
    request=$('owner563Case').value,receipt=$('owner563Receipt').value;
   if(id!==ownerId||!owns(company)||!cases.some(c=>c.request_id===request)||
     !receipts.some(r=>r.id===receipt))throw Error('Original source identity changed');
   const response=await sb.rpc('ywi_rpc_landscape_master_receipt_review_563',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   const v=response.data;
   if(response.error||!v||v.company_id!==company||v.request_id!==request||
     v.provider_verified_receipt_id!==receipt||!Number.isSafeInteger(v.case_version)||
     !sha(v.canonical_sha256)||v.company_scope_only!==true||v.read_only!==true||
     v.recipient_delivery_independently_verified!==false||
     v.customer_message_sent!==false||v.master_owner_acceptance!==false||
     v.master_connected!==false||typeof v.source_followup_closure_ready!=='boolean'||
     !(v.master_observation_id===null||uuid(v.master_observation_id))||
     !['HOLD_NO_INDEPENDENT_MASTER_RECEIPT','MATCHED_RECEIPT_CLAIM',
       'HASH_MISMATCH','MASTER_DISCREPANCY','MASTER_REJECTED'].includes(v.master_comparison))
    throw Error(response.error?.message||'Protected Master receipt contract failed');
   if(run!==epoch||company!==$('owner563Company').value||
     request!==$('owner563Case').value||receipt!==$('owner563Receipt').value)
    throw Error('Original source changed');
   review=v;
   $('owner563Comparison').textContent='Original case v'+v.case_version+
    ' · source receipt hash '+v.canonical_sha256+
    ' · source pilot owner approved '+(v.source_pilot_approved?'YES':'HOLD')+
    ' · Master observation '+v.master_comparison+
    (v.controller_revision?' · controller revision '+v.controller_revision:'')+
    ' · Master owner acceptance HOLD.';
   $('owner563Closure').textContent='Source follow-up: '+v.source_followup_gate+
    '. A matching signed Master observation is not proof of customer receipt. '+
    'This owner decision never sends customer messages or accepts Master connection.';
   status(v.source_followup_closure_ready
    ?'READY for original-company source follow-up owner closure only. Independent Master acceptance still HOLD.'
    :'HOLD: inspect Master receipt discrepancy, request a recheck or escalate as appropriate.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner563Decide').disabled||!review)return;
  const v=review,action=$('owner563Action').value,note=$('owner563Note').value.trim();
  const run=++epoch;busy=true;controls();
  status('Recording authenticated original owner follow-up decision…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner563Company').value||
     v.request_id!==$('owner563Case').value||
     v.provider_verified_receipt_id!==$('owner563Receipt').value)
    throw Error('Original source identity changed');
   const result=await sb.rpc('ywi_rpc_landscape_followup_decide_563',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_provider_verified_receipt_id:v.provider_verified_receipt_id,
    p_expected_case_version:v.case_version,
    p_master_observation_id:v.master_observation_id,
    p_action:action,p_note:note,p_idempotency_key:nonce(),p_owner_attested:true,
   });
   const saved=result.data;
   if(result.error||!saved||
     saved.status!=='SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD'||
     !uuid(saved.decision_id)||saved.master_owner_acceptance!==false)
    throw Error(result.error?.message||'Source follow-up owner decision not accepted');
   if(run!==epoch)throw Error('Original owner session changed');
   review=null;$('owner563Action').value='';$('owner563Note').value='';
   $('owner563Attest').checked=false;
   status('SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD · '+saved.decision_id.slice(0,8)+
    '. Refresh to verify original source. Customer delivery and Master owner acceptance remain HOLD.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message+' Refresh exact signed source.');}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function refresh(){
  const run=++epoch;busy=true;ownerId=null;companies=[];cases=[];evidenceClear();controls();
  status('Checking original authenticated company owner…');
  try{
   const {id,sb}=await owner();
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
    .eq('owner_user_id',id).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.owner_user_id!==id||!uuid(x.id)))
    throw Error(r.error?.message||'Original owner company mismatch');
   if(run!==epoch)throw Error('Original owner session changed');
   ownerId=id;companies=r.data;
   const sel=$('owner563Company'),old=sel.value;
   sel.replaceChildren(option('','Choose owned company'));
   for(const c of companies)sel.append(option(c.id,c.name||c.id));
   if(companies.some(c=>c.id===old))sel.value=old;
   else if(companies.length===1)sel.value=companies[0].id;
   await loadCases(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!$('settings')||$('owner563'))return;
  const panel=document.createElement('details');panel.id='owner563';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Independent Master Receipt Ledger &amp; Follow-Up Triage (owner)</summary>
   <div class="admin-panel-block">
    <style>
     #owner563,#owner563 *{box-sizing:border-box}
     #owner563{max-width:100%;min-width:0;overflow-wrap:anywhere}
     #owner563 .grid563{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:12px 0}
     #owner563 select,#owner563 textarea{width:100%;min-width:0;max-width:100%}
     #owner563 .card563{border:1px solid var(--border,#8995a1);border-radius:12px;padding:14px;margin:10px 0}
     #owner563 button{min-height:44px;white-space:normal}
    </style>
    <p>A signed Master receipt observation confirms only that an independent controller signer issued a claim.
    It does not establish recipient delivery, CONNECTED, or Master owner acceptance. This workspace records original-company SOURCE follow-up decisions only.</p>
    <div class="grid563">
      <label>Owned company<select id="owner563Company"></select></label>
      <label>Original recovery case<select id="owner563Case"></select></label>
      <label>Original independently signed provider receipt<select id="owner563Receipt"></select></label>
    </div>
    <button type="button" class="secondary" id="owner563Refresh">Refresh original receipt history</button>
    <p id="owner563Status" role="status" aria-live="polite">HOLD: authenticate original owner.</p>
    <section class="card563"><h3>Independent Master observation &amp; hash comparison</h3>
      <p id="owner563Comparison">HOLD — no independently admitted Master receipt selected.</p></section>
    <section class="card563"><h3>Discrepancy and follow-up closure gate</h3>
      <p id="owner563Closure">HOLD — original source closure, current signed Master receipt and owner attestation required.</p></section>
    <section class="card563"><h3>Explicit original-company owner decision</h3>
      <p>Request a fresh Master receipt, escalate an independently verified discrepancy or approve SOURCE follow-up closure only against fresh, exact matching source evidence. This does not send a message or close any Master gate.</p>
      <label>Decision<select id="owner563Action">
       <option value="">Choose original owner action</option>
       <option value="request_master_recheck">Request independent Master receipt recheck</option>
       <option value="escalate_receipt_discrepancy">Escalate signed receipt discrepancy</option>
       <option value="approve_source_followup_closure">Approve source-only follow-up closure</option>
      </select></label>
      <label>Reason (15–500 characters; no customer details)
       <textarea id="owner563Note" rows="3" maxlength="500"></textarea></label>
      <label><input type="checkbox" id="owner563Attest"> I personally reviewed this exact original signed provider receipt and Master claim.</label>
      <button type="button" id="owner563Decide" disabled>Record source follow-up decision</button>
    </section>
   </div>`;
  $('settings').append(panel);
  $('owner563Company').replaceChildren(option('','Choose owned company'));
  $('owner563Case').replaceChildren(option('','Choose original recovery case'));
  evidenceClear();
  $('owner563Refresh').addEventListener('click',()=>void refresh());
  $('owner563Company').addEventListener('change',async()=>{
   const run=++epoch;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Owner changed');
    await loadCases(run,sb);}
   catch(e){if(run===epoch){evidenceClear();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner563Case').addEventListener('change',()=>void loadReceipts());
  $('owner563Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner563Action','change'],['owner563Note','input'],['owner563Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner563Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;ownerId=null;companies=[];cases=[];
   $('owner563Company').replaceChildren(option('','Choose owned company'));
   $('owner563Case').replaceChildren(option('','Choose original recovery case'));
   evidenceClear();
   status('HOLD: original owner session changed; independent receipt evidence cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();