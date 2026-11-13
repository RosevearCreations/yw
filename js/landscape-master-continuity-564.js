/* YW564 protected Master replay/SLA/renewal original owner workspace.
 * All decisions remain SOURCE-only and are fully server-authorized. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
 const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
 let epoch=0,busy=false,ownerId=null,companies=[],cases=[],receipts=[],review=null;
 const status=s=>{$('owner564Status').textContent=s;};
 const owns=id=>companies.some(c=>c.id===id&&c.owner_user_id===ownerId);
 async function owner(){
  const st=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(st?.isAuthenticated!==true||!uuid(st.user?.id)||
   !sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Authenticated original company owner required');
  const identity=await sb.auth.getUser();
  if(identity.error||identity.data?.user?.id!==st.user.id)
   throw Error('Original owner session changed');
  return {sb,id:st.user.id};
 }
 function nonce(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 }
 function clear(){
  review=null;receipts=[];
  $('owner564Receipt').replaceChildren(option('','Choose original signed provider receipt'));
  $('owner564Replay').textContent='HOLD — independently signed admission evidence required.';
  $('owner564SLA').textContent='HOLD — original owner SLA will appear from protected source records.';
  $('owner564Renewal').textContent='HOLD — source request alone is not independent renewal proof.';
  $('owner564Action').value='';$('owner564Note').value='';$('owner564Attest').checked=false;
  controls();
 }
 const discrep=new Set(['SIGNED_REPLAY_OR_ADMISSION_EXCEPTION','CROSS_PLANE_DISCREPANCY',
  'MISSING_INDEPENDENT_MASTER_RECEIPT','ORIGINAL_CLOSURE_OR_STALE_RECEIPT_HOLD']);
 function controls(){
  const v=review,action=$('owner564Action')?.value,note=$('owner564Note')?.value.trim()||'';
  const valid=v?.company_scope_only===true&&v?.read_only===true&&
   v?.master_owner_acceptance===false&&v?.master_connected===false&&
   v?.recipient_delivery_independently_verified===false&&
   v?.customer_message_sent===false&&sha(v?.canonical_sha256)&&
   owns(v.company_id)&&cases.some(c=>c.request_id===v.request_id&&
    c.case_version===v.case_version)&&
   receipts.some(r=>r.id===v.provider_verified_receipt_id);
  const allowed=action==='request_signed_cross_plane_renewal'&&
     (discrep.has(v?.continuity_classification)||v?.resolution_sla_state==='DUE_SOON'||
      v?.resolution_sla_state==='BREACHED'||
      v?.continuity_classification==='MATCHED_INDEPENDENT_SOURCE_CLAIM')||
    action==='acknowledge_resolution_sla_breach'&&
     v?.resolution_sla_state==='BREACHED'||
    action==='review_independently_renewed_source'&&
     v?.independent_renewal_evidence_current===true;
  $('owner564Decide').disabled=busy||!valid||!allowed||
   note.length<15||note.length>500||!$('owner564Attest').checked;
 }
 async function loadCases(run,sb){
  cases=[];clear();
  $('owner564Case').replaceChildren(option('','Choose original recovery case'));
  const cid=$('owner564Company').value;if(!owns(cid))return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
   .select('company_id,request_id,case_version,state,updated_at')
   .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.company_id!==cid||
    !uuid(c.request_id)))throw Error(r.error?.message||'Original recovery cases unavailable');
  if(run!==epoch||cid!==$('owner564Company').value)throw Error('Original source changed');
  cases=r.data;
  for(const c of cases)$('owner564Case').append(option(c.request_id,
   c.state+' · version '+c.case_version+' · '+c.request_id.slice(0,8)));
  status('Select an original signed provider receipt to inspect independently signed Master continuity.');
 }
 async function loadReceipts(){
  const run=++epoch;busy=true;clear();controls();
  try{
   const {id,sb}=await owner(),cid=$('owner564Company').value,rid=$('owner564Case').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid))
    throw Error('Original company/case mismatch');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',cid).eq('request_id',rid)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid||
     x.request_id!==rid||!uuid(x.id)))
    throw Error(r.error?.message||'Original signed provider receipt unavailable');
   if(run!==epoch||cid!==$('owner564Company').value||
     rid!==$('owner564Case').value)throw Error('Original receipt source changed');
   receipts=r.data;
   for(const x of receipts)$('owner564Receipt').append(option(x.id,
    x.provider_reported_state+' · version '+x.case_version+' · '+x.id.slice(0,8)));
   status(receipts.length+' original signed provider receipts found; Master evidence remains a separate gate.');
  }catch(e){if(run===epoch){clear();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner564Company').value,
    rid=$('owner564Case').value,receipt=$('owner564Receipt').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid)||
     !receipts.some(r=>r.id===receipt))throw Error('Original receipt owner changed');
   const response=await sb.rpc('ywi_rpc_landscape_master_continuity_review_564',{
    p_company_id:cid,p_request_id:rid,p_provider_verified_receipt_id:receipt});
   const v=response.data;
   const states=new Set(['WITHIN_TARGET','DUE_SOON','BREACHED','HOLD_NO_ORIGINAL_SOURCE']);
   const classes=new Set(['SOURCE_PILOT_HOLD','SIGNED_REPLAY_OR_ADMISSION_EXCEPTION',
    'MISSING_INDEPENDENT_MASTER_RECEIPT','CROSS_PLANE_DISCREPANCY',
    'ORIGINAL_CLOSURE_OR_STALE_RECEIPT_HOLD','MATCHED_INDEPENDENT_SOURCE_CLAIM']);
   if(response.error||!v||v.company_id!==cid||v.request_id!==rid||
    v.provider_verified_receipt_id!==receipt||!Number.isSafeInteger(v.case_version)||
    !sha(v.canonical_sha256)||!Number.isSafeInteger(v.signed_replay_exception_count)||
    v.signed_replay_exception_count<0||!states.has(v.resolution_sla_state)||
    !classes.has(v.continuity_classification)||
    !(v.master_observation_id===null||uuid(v.master_observation_id))||
    typeof v.independent_renewal_evidence_current!=='boolean'||
    v.company_scope_only!==true||v.read_only!==true||
    v.recipient_delivery_independently_verified!==false||
    v.customer_message_sent!==false||
    v.master_owner_acceptance!==false||v.master_connected!==false)
    throw Error(response.error?.message||'Protected original Master continuity contract mismatch');
   if(run!==epoch||cid!==$('owner564Company').value||
     rid!==$('owner564Case').value||receipt!==$('owner564Receipt').value)
    throw Error('Original owner/source changed');
   review=v;
   $('owner564Replay').textContent='Source SHA-256 '+v.canonical_sha256+
    ' · verified signed admission exceptions '+v.signed_replay_exception_count+
    ' · continuity '+v.continuity_classification+
    ' · Master owner acceptance HOLD.';
   const due=v.resolution_sla_due_at?new Date(v.resolution_sla_due_at).toLocaleString('en-CA'):null;
   $('owner564SLA').textContent='Original company resolution SLA '+v.resolution_sla_state+
    (due?' · due '+due:' · no source due date')+
    '. Unverified receipt, missing signer or expired proof remains HOLD.';
   $('owner564Renewal').textContent='Latest owner action '+v.last_owner_renewal_action+
    ' · independently renewed evidence '+(v.independent_renewal_evidence_current?'VERIFIED SOURCE MATCH':'HOLD')+
    '. Only a fresh independently signed Master observation counts; source owner review never establishes customer delivery or CONNECTED.';
   status(v.resolution_sla_state==='BREACHED'?'SLA BREACHED — original owner follow-up required.':
    'Original signed Master evidence reviewed; Master acceptance remains a separate protected owner gate.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner564Decide').disabled||!review)return;
  const v=review,action=$('owner564Action').value,note=$('owner564Note').value.trim();
  const run=++epoch;busy=true;controls();status('Recording original-owner immutable source decision…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner564Company').value||
    v.request_id!==$('owner564Case').value||
    v.provider_verified_receipt_id!==$('owner564Receipt').value)
    throw Error('Original source identity changed');
   const response=await sb.rpc('ywi_rpc_landscape_master_renewal_decide_564',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_provider_verified_receipt_id:v.provider_verified_receipt_id,
    p_expected_case_version:v.case_version,
    p_expected_master_observation_id:v.master_observation_id,
    p_action:action,p_note:note,p_idempotency_key:nonce(),p_owner_attested:true});
   const saved=response.data;
   if(response.error||!saved||
    saved.status!=='SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD'||
    !uuid(saved.action_id)||saved.master_owner_acceptance!==false)
    throw Error(response.error?.message||'Protected owner source renewal action rejected');
   if(run!==epoch)throw Error('Original owner session changed');
   review=null;$('owner564Action').value='';$('owner564Note').value='';
   $('owner564Attest').checked=false;
   status('SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD · '+saved.action_id.slice(0,8)+
    '. Refresh to inspect new independently signed evidence; Master CONNECTED remains HOLD.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message+' Refresh original source.');}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function refresh(){
  const run=++epoch;busy=true;ownerId=null;companies=[];cases=[];clear();controls();
  status('Verifying original company owner…');
  try{
   const {id,sb}=await owner();
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
    .eq('owner_user_id',id).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.owner_user_id!==id||!uuid(c.id)))
    throw Error(r.error?.message||'Original company ownership unavailable');
   if(run!==epoch)throw Error('Owner session changed');
   ownerId=id;companies=r.data;
   const sel=$('owner564Company'),prior=sel.value;
   sel.replaceChildren(option('','Choose owned company'));
   for(const c of companies)sel.append(option(c.id,c.name||c.id));
   if(companies.some(c=>c.id===prior))sel.value=prior;
   else if(companies.length===1)sel.value=companies[0].id;
   await loadCases(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!document.getElementById('settings')||$('owner564'))return;
  const panel=document.createElement('details');
  panel.id='owner564';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Protected Master Replay, SLA &amp; Evidence Renewal (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner564,#owner564 *{box-sizing:border-box}
    #owner564{width:100%;min-width:0;max-width:100%;overflow-wrap:anywhere}
    #owner564 .grid564{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;margin:12px 0}
    #owner564 select,#owner564 textarea{width:100%;min-width:0;max-width:100%}
    #owner564 .card564{padding:14px;border:1px solid var(--line,rgba(148,163,184,.3));border-radius:14px;margin:10px 0}
    #owner564 .card564 h3{margin-top:0}
    #owner564 button{min-height:44px;white-space:normal}
    #owner564 .statuses564{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
    #owner564 .statuses564>section{min-width:0;background:rgba(19,31,52,.31)}
   </style>
   <p>Monitor independently signed AI Data Platform receipt claims, original-company response SLAs and fresh cross-plane evidence. Original provider claim, signed Master observation, customer delivery and Master owner acceptance are separate states.</p>
   <div class="grid564">
     <label>Original owned company<select id="owner564Company"></select></label>
     <label>Original recovery case<select id="owner564Case"></select></label>
     <label>Original provider signed receipt<select id="owner564Receipt"></select></label>
   </div>
   <button type="button" class="secondary" id="owner564Refresh">Refresh protected source evidence</button>
   <p id="owner564Status" role="status" aria-live="polite">HOLD: authenticate original company owner.</p>
   <div class="statuses564">
    <section class="card564"><h3>Master replay &amp; admission monitoring</h3>
      <p id="owner564Replay">HOLD — independently signed admission evidence required.</p></section>
    <section class="card564"><h3>Original-company resolution SLA</h3>
      <p id="owner564SLA">HOLD — original owner SLA will appear from protected source records.</p></section>
    <section class="card564"><h3>Independent cross-plane renewal</h3>
      <p id="owner564Renewal">HOLD — source request alone is not independent renewal proof.</p></section>
   </div>
   <section class="card564"><h3>Original-owner immutable follow-up</h3>
    <p>Request a fresh signed Master receipt, acknowledge a genuine SLA breach, or review new independently verified source evidence. None of these actions sends customer communications or changes Master CONNECTED.</p>
    <label>Source action<select id="owner564Action">
      <option value="">Choose action</option>
      <option value="request_signed_cross_plane_renewal">Request independently signed cross-plane renewal</option>
      <option value="acknowledge_resolution_sla_breach">Acknowledge breached original-company SLA</option>
      <option value="review_independently_renewed_source">Review fresh independent renewal evidence</option>
    </select></label>
    <label>Owner reason (15–500 characters, no customer information)
      <textarea id="owner564Note" rows="3" maxlength="500"></textarea></label>
    <label><input type="checkbox" id="owner564Attest"> I personally checked this exact source case, signed receipt and Master continuity status.</label>
    <button type="button" id="owner564Decide" disabled>Record original source follow-up</button>
   </section>
  </div>`;
  $('settings').append(panel);
  $('owner564Company').replaceChildren(option('','Choose owned company'));
  $('owner564Case').replaceChildren(option('','Choose original recovery case'));
  clear();
  $('owner564Refresh').addEventListener('click',()=>void refresh());
  $('owner564Company').addEventListener('change',async()=>{
   const run=++epoch;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Owner changed');
    await loadCases(run,sb);}
   catch(e){if(run===epoch){clear();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner564Case').addEventListener('change',()=>void loadReceipts());
  $('owner564Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner564Action','change'],['owner564Note','input'],['owner564Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner564Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;ownerId=null;companies=[];cases=[];
   $('owner564Company').replaceChildren(option('','Choose owned company'));
   $('owner564Case').replaceChildren(option('','Choose original recovery case'));
   clear();status('HOLD: original owner session changed; evidence cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
