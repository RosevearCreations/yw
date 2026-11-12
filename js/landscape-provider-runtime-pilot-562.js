/* YW562 original provider runtime pilot. Original company owner SOURCE decision
 * only; no customer send, signer enrollment, or Master owner acceptance. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const uuid = x => typeof x === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const hash = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
 const option = (value,text) => {const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
 let epoch=0, busy=false, ownerId=null, companies=[],cases=[],receipts=[],review=null;
 async function owner(){
  const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(s?.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Authenticated original company owner required');
  const v=await sb.auth.getUser();
  if(v.error||v.data?.user?.id!==s.user.id)throw Error('Original owner session changed');
  return {id:s.user.id,sb};
 }
 function nonce(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 }
 function resetEvidence(){
  review=null;receipts=[];
  $('owner562Receipt').replaceChildren(option('','Choose verified provider receipt'));
  $('owner562Source').textContent='HOLD — select exact original signed receipt.';
  $('owner562Master').textContent='HOLD — independent AI Data Platform Master acceptance is required.';
  $('owner562Decision').value='';$('owner562Note').value='';$('owner562Attest').checked=false;
  controls();
 }
 function controls(){
  const action=$('owner562Decision')?.value, note=$('owner562Note')?.value.trim()||'';
  const valid=review?.company_scope_only===true && review?.read_only===true &&
   review?.provider_signature_verified===true &&
   review?.recipient_delivery_independently_verified===false &&
   review?.master_owner_acceptance===false && review?.master_connected===false &&
   review?.source_owner_decision==='HOLD' &&
   companySelected() && cases.some(x=>x.request_id===review.request_id) &&
   receipts.some(x=>x.id===review.verified_receipt_id);
  $('owner562Decide').disabled=busy||!valid||note.length<15||note.length>500||
   !$('owner562Attest').checked||
   !(action==='reject_source_pilot'||
     (action==='approve_for_master_review'&&review.source_pilot_ready===true));
 }
 function companySelected(){
  return companies.some(x=>x.id===$('owner562Company').value&&x.owner_user_id===ownerId);
 }
 function status(t){$('owner562Status').textContent=t;}
 async function loadCases(run,sb){
  resetEvidence();cases=[];
  $('owner562Case').replaceChildren(option('','Choose original recovery case'));
  const cid=$('owner562Company').value;
  if(!companySelected())return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
    .select('company_id,request_id,case_version,state,updated_at')
    .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid))
   throw Error(r.error?.message||'Original company cases unavailable');
  if(run!==epoch||cid!==$('owner562Company').value)throw Error('Owner company changed');
  cases=r.data;
  for(const v of cases)$('owner562Case').append(option(v.request_id,
   v.state+' · v'+v.case_version+' · '+v.request_id.slice(0,8)));
  status('Select original recovery case; runtime proof must be authentic.');
 }
 async function loadReceipts(){
  const run=++epoch;resetEvidence();busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner562Company').value,
    rid=$('owner562Case').value;
   if(id!==ownerId||!companySelected()||!cases.some(x=>x.request_id===rid))
    throw Error('Original owner/company/case mismatch');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',cid).eq('request_id',rid)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid||x.request_id!==rid||!uuid(x.id)))
    throw Error(r.error?.message||'Signed provider receipt history unavailable');
   if(run!==epoch||cid!==$('owner562Company').value||rid!==$('owner562Case').value)
    throw Error('Original source changed');
   receipts=r.data;
   for(const v of receipts)$('owner562Receipt').append(option(v.id,
     v.provider_reported_state+' · v'+v.case_version+' · '+v.id.slice(0,8)));
   status(receipts.length+' verified provider receipts. Select the exact original receipt.');
  }catch(e){if(run===epoch){resetEvidence();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner562Company').value,
    rid=$('owner562Case').value,receiptId=$('owner562Receipt').value;
   if(id!==ownerId||!companySelected()||!cases.some(x=>x.request_id===rid)||
      !receipts.some(x=>x.id===receiptId))throw Error('Original source identity changed');
   const r=await sb.rpc('ywi_rpc_landscape_provider_pilot_review_562',{
    p_company_id:cid,p_request_id:rid,p_verified_receipt_id:receiptId});
   const v=r.data;
   if(r.error||!v||v.company_id!==cid||v.request_id!==rid||
      v.verified_receipt_id!==receiptId||!Number.isSafeInteger(v.case_version)||
      !hash(v.canonical_sha256)||!hash(v.signature_sha256)||
      v.company_scope_only!==true||v.read_only!==true||
      v.provider_signature_verified!==true||
      v.recipient_delivery_independently_verified!==false||
      v.master_owner_acceptance!==false||v.master_connected!==false||
      typeof v.source_pilot_ready!=='boolean')
    throw Error(r.error?.message||'Exact receipt/owner HOLD contract mismatch');
   if(run!==epoch||cid!==$('owner562Company').value||rid!==$('owner562Case').value||
     receiptId!==$('owner562Receipt').value)throw Error('Original signed receipt changed');
   review=v;
   $('owner562Source').textContent='Original case v'+v.case_version+
    ' · provider '+v.provider_state+' · exact canonical SHA-256 '+v.canonical_sha256+
    ' · original supervisor '+(v.original_supervisor_verified?'VERIFIED':'HOLD')+
    ' · original customer closure '+(v.original_closure_verified?'VERIFIED':'HOLD')+
    ' · source pilot '+v.pilot_gate+'.';
   $('owner562Master').textContent='HOLD — signed provider report is not recipient delivery. '+
    'Only AI Data Platform may independently admit exact-UID/hash source evidence and record '+
    'a separate explicit Master owner acceptance. No connected state is implied.';
   status(v.source_pilot_ready?'READY for source-owner pilot decision; Master remains HOLD.':
    'HOLD: signed current receipt, recent runtime admission and original supervisor/customer closure required.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner562Decide').disabled||!review)return;
  const v=review,action=$('owner562Decision').value,note=$('owner562Note').value.trim();
  const run=++epoch;busy=true;controls();status('Recording immutable owner source pilot decision…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner562Company').value||
     v.request_id!==$('owner562Case').value||v.verified_receipt_id!==$('owner562Receipt').value)
    throw Error('Original owner, case or signed receipt changed');
   const r=await sb.rpc('ywi_rpc_landscape_provider_pilot_decide_562',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_verified_receipt_id:v.verified_receipt_id,p_expected_case_version:v.case_version,
    p_source_decision:action,p_owner_note:note,
    p_idempotency_key:nonce(),p_owner_attested:true});
   const result=r.data;
   if(r.error||!result||result.status!=='SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD'||
     !uuid(result.decision_id)||result.master_owner_acceptance!==false)
    throw Error(r.error?.message||'Original owner source pilot not admitted');
   if(run!==epoch)throw Error('Owner session changed');
   status('SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD · decision '+result.decision_id.slice(0,8)+
    '. Independent Master owner acceptance remains HOLD.');
   review=null;$('owner562Decision').value='';$('owner562Note').value='';
   $('owner562Attest').checked=false;
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message+' Refresh exact source evidence.');}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function refresh(){
  const run=++epoch;busy=true;ownerId=null;companies=[];cases=[];resetEvidence();controls();
  status('Checking original authenticated company owner…');
  try{
   const {id,sb}=await owner();
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
    .eq('owner_user_id',id).limit(30);
   if(r.error||!Array.isArray(r.data)||
     r.data.some(x=>x.owner_user_id!==id||!uuid(x.id)))
    throw Error(r.error?.message||'Original owner company boundary mismatch');
   if(run!==epoch)throw Error('Original owner changed');
   ownerId=id;companies=r.data;
   const select=$('owner562Company'),prior=select.value;
   select.replaceChildren(option('','Choose company'));
   for(const c of companies)select.append(option(c.id,c.name||c.id));
   if(companies.some(c=>c.id===prior))select.value=prior;
   else if(companies.length===1)select.value=companies[0].id;
   await loadCases(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!$('settings')||$('owner562'))return;
  const el=document.createElement('details');el.id='owner562';el.className='admin-hub-detail';
  el.innerHTML=`<summary>Landscaping · Original Provider Runtime Pilot &amp; Master Acceptance Gate (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner562,#owner562 *{box-sizing:border-box}
    #owner562{max-width:100%;overflow-wrap:anywhere}
    #owner562 .grid562{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px;margin:12px 0}
    #owner562 select,#owner562 textarea{width:100%;min-width:0;max-width:100%}
    #owner562 .card562{border:1px solid var(--border,#8995a1);border-radius:12px;padding:14px;margin:10px 0}
    #owner562 button{min-height:44px;white-space:normal}
   </style>
   <p>Original provider runtime proof must come from an independently pinned signer and the protected YW561 receiver. A provider's signed “delivered” claim does not prove receipt by the customer. The Master decides acceptance independently.</p>
   <div class="grid562">
    <label>Owned company<select id="owner562Company"></select></label>
    <label>Original case<select id="owner562Case"></select></label>
    <label>Verified signed receipt<select id="owner562Receipt"></select></label>
   </div>
   <button type="button" class="secondary" id="owner562Refresh">Refresh original evidence</button>
   <p role="status" aria-live="polite" id="owner562Status">HOLD: authenticate original company owner.</p>
   <section class="card562"><h3>Signed delivery correlation (source-only)</h3>
    <p id="owner562Source">HOLD — select exact original signed receipt.</p></section>
   <section class="card562"><h3>AI Data Platform Master owner acceptance</h3>
    <p id="owner562Master">HOLD — independent Master acceptance is required.</p></section>
   <section class="card562"><h3>Owner source pilot decision</h3>
    <p>Approve only the exact fresh signed provider evidence and verified original closure for independent Master review; this does not accept it in Master. Rejecting holds the source pilot.</p>
    <label>Decision<select id="owner562Decision"><option value="">Choose</option>
     <option value="approve_for_master_review">Approve source evidence for independent Master review</option>
     <option value="reject_source_pilot">Reject source pilot evidence</option></select></label>
    <label>Reason (15–500 characters; no customer details)<textarea id="owner562Note" rows="3" maxlength="500"></textarea></label>
    <label><input id="owner562Attest" type="checkbox"> I personally reviewed this exact original signed receipt and source case.</label>
    <button type="button" id="owner562Decide" disabled>Record source-only decision</button>
   </section>
  </div>`;
  $('settings').append(el);
  $('owner562Company').replaceChildren(option('','Choose company'));
  $('owner562Case').replaceChildren(option('','Choose original recovery case'));
  resetEvidence();
  $('owner562Refresh').addEventListener('click',()=>void refresh());
  $('owner562Company').addEventListener('change',async()=>{
   const run=++epoch;review=null;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Owner changed');
    await loadCases(run,sb);}
   catch(e){if(run===epoch){resetEvidence();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner562Case').addEventListener('change',()=>void loadReceipts());
  $('owner562Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner562Decision','change'],['owner562Note','input'],['owner562Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner562Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;ownerId=null;companies=[];cases=[];busy=false;
   $('owner562Company').replaceChildren(option('','Choose company'));
   $('owner562Case').replaceChildren(option('','Choose original recovery case'));
   resetEvidence();status('HOLD: original owner session changed; source evidence cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();