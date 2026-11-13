/* YW566 original company deterministic signed-source risk watch.
 * No probabilistic claims, no customer send, no Master owner authorization. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
 const opt=(value,name)=>{const o=document.createElement('option');o.value=value;o.textContent=name;return o;};
 const classes=new Set(['HOLD_NO_SIGNED_SOURCE','SOURCE_SIGNED_RISK_ACTIVE',
 'SOURCE_SLA_BREACHED','SOURCE_SLA_DUE_SOON','SOURCE_RECEIPT_STALE',
 'SOURCE_SIGNED_RISK_WATCH','SOURCE_RENEWAL_RECOVERY_WATCH',
 'SOURCE_STABLE_OBSERVATION_WATCH']);
 let epoch=0,busy=false,ownerId=null,companies=[],cases=[],receipts=[],review=null;
 const owns=x=>companies.some(c=>c.id===x&&c.owner_user_id===ownerId);
 const status=x=>{$('owner566Status').textContent=x;};
 const nonce=()=>{
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(v=>v.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 };
 async function owner(){
  const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(s?.isAuthenticated!==true||!uuid(s.user?.id)||
    !sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Original authenticated company owner required');
  const user=await sb.auth.getUser();
  if(user.error||user.data?.user?.id!==s.user.id)
   throw Error('Original owner session changed');
  return {id:s.user.id,sb};
 }
 function reset(){
  review=null;receipts=[];
  $('owner566Receipt').replaceChildren(opt('','Choose original signed receipt'));
  $('owner566Risk').textContent='HOLD — source forecast evidence unavailable.';
  $('owner566Escalation').textContent='HOLD — escalation outcome requires original signed source.';
  $('owner566Action').value='';$('owner566Note').value='';$('owner566Attest').checked=false;
  controls();
 }
 function controls(){
  const v=review,a=$('owner566Action').value,n=$('owner566Note').value.trim();
  const valid=v?.company_scope_only===true&&v?.read_only===true&&
   v?.master_owner_acceptance===false&&v?.master_connected===false&&
   v?.recipient_delivery_independently_verified===false&&
   v?.customer_message_sent===false&&
   v?.forecast_is_deterministic_watch_not_prediction===true&&
   v?.forecast_horizon_hours===24&&sha(v.canonical_sha256)&&
   owns(v.company_id)&&cases.some(c=>c.request_id===v.request_id&&
    c.case_version===v.case_version)&&
   receipts.some(r=>r.id===v.provider_verified_receipt_id);
  const allowed=a==='request_supervised_source_followup'||
   a==='record_source_escalation_open'&&
    uuid(v?.source_escalation_id)&&v?.source_escalation_outcome==='SOURCE_ONLY_OPEN'||
   a==='reconcile_signed_source_recovery'&&
    uuid(v?.source_escalation_id)&&
    v?.post_escalation_signed_evidence_current===true&&
    v?.source_recovery_effective_after_escalation===true&&
    v?.source_escalation_outcome==='SOURCE_ONLY_OPEN';
  $('owner566Decide').disabled=busy||!valid||!allowed||n.length<15||n.length>500||
   !$('owner566Attest').checked;
 }
 async function casesLoad(run,sb){
  cases=[];reset();
  $('owner566Case').replaceChildren(opt('','Choose original recovery case'));
  const cid=$('owner566Company').value;if(!owns(cid))return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
   .select('company_id,request_id,case_version,state,updated_at')
   .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid||!uuid(x.request_id)))
   throw Error(r.error?.message||'Original recovery cases missing');
  if(run!==epoch||cid!==$('owner566Company').value)throw Error('Owner scope changed');
  cases=r.data;
  for(const c of cases)$('owner566Case').append(opt(c.request_id,
   c.state+' · v'+c.case_version+' · '+c.request_id.slice(0,8)));
  status('Select the exact original signed provider receipt.');
 }
 async function receiptsLoad(){
  const run=++epoch;busy=true;reset();controls();
  try{
   const {id,sb}=await owner(),cid=$('owner566Company').value,rid=$('owner566Case').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid))
    throw Error('Original company or case changed');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',cid).eq('request_id',rid)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.company_id!==cid||
     c.request_id!==rid||!uuid(c.id)))throw Error(r.error?.message||'Signed receipt not available');
   if(run!==epoch||cid!==$('owner566Company').value||rid!==$('owner566Case').value)
    throw Error('Original case changed');
   receipts=r.data;
   for(const r of receipts)$('owner566Receipt').append(opt(r.id,
    r.provider_reported_state+' · v'+r.case_version+' · '+r.id.slice(0,8)));
   status('Original signed receipts available. Inspect the independent Master risk watch.');
  }catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function format(t){
  if(!t)return 'not established';
  const d=new Date(t);return Number.isFinite(+d)?d.toLocaleString('en-CA'):'invalid source';
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner566Company').value,
    rid=$('owner566Case').value,rec=$('owner566Receipt').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid)||
     !receipts.some(r=>r.id===rec))throw Error('Original signed source changed');
   const r=await sb.rpc('ywi_rpc_landscape_master_drift_forecast_review_566',{
    p_company_id:cid,p_request_id:rid,p_provider_verified_receipt_id:rec});
   const v=r.data;
   if(r.error||!v||v.company_id!==cid||v.request_id!==rid||
    v.provider_verified_receipt_id!==rec||!Number.isSafeInteger(v.case_version)||
    !sha(v.canonical_sha256)||!classes.has(v.forecast_classification)||
    !Number.isSafeInteger(v.signed_risk_events_24h)||v.signed_risk_events_24h<0||
    !Number.isSafeInteger(v.signed_risk_events_7d)||v.signed_risk_events_7d<0||
    !(v.master_observation_id===null||uuid(v.master_observation_id))||
    !(v.source_escalation_id===null||uuid(v.source_escalation_id))||
    typeof v.post_escalation_signed_evidence_current!=='boolean'||
    typeof v.source_recovery_effective_after_escalation!=='boolean'||
    !['SOURCE_ONLY_OPEN','SOURCE_RECOVERY_RECONCILED_MASTER_HOLD'].includes(v.source_escalation_outcome)||
    v.forecast_is_deterministic_watch_not_prediction!==true||
    v.forecast_horizon_hours!==24||v.company_scope_only!==true||v.read_only!==true||
    v.recipient_delivery_independently_verified!==false||
    v.customer_message_sent!==false||v.master_owner_acceptance!==false||
    v.master_connected!==false)
    throw Error(r.error?.message||'Protected source forecast contract mismatch');
   if(run!==epoch||cid!==$('owner566Company').value||
    rid!==$('owner566Case').value||rec!==$('owner566Receipt').value)
    throw Error('Original source changed');
   review=v;
   $('owner566Risk').textContent='Original receipt SHA-256 '+v.canonical_sha256+
    ' · observed signed risks 24h '+v.signed_risk_events_24h+
    ' / 7d '+v.signed_risk_events_7d+
    ' · deterministic watch '+v.forecast_classification+
    ' · next source recheck '+format(v.next_evidence_recheck_by)+
    ' · source SLA '+(v.source_resolution_sla_state||'HOLD')+
    '. This is not a probability of future failure.';
   $('owner566Escalation').textContent='Original owner escalation '+
    (v.source_escalation_id||'HOLD_NO_OWNER_ESCALATION')+
    ' · new signed evidence after escalation '+
    (v.post_escalation_signed_evidence_current?'OBSERVED':'HOLD')+
    ' · source recovery '+(v.source_recovery_effective_after_escalation?'OBSERVED':'HOLD')+
    ' · source outcome '+v.source_escalation_outcome+
    ' · Master owner acceptance HOLD.';
   status(v.source_recovery_effective_after_escalation?
    'Independent signed source recovery observed. Master owner acceptance remains HOLD.':
    'HOLD: check original signed receipt, source escalation and independent recovery evidence.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner566Decide').disabled||!review)return;
  const v=review,action=$('owner566Action').value,note=$('owner566Note').value.trim();
  const run=++epoch;busy=true;controls();status('Recording original-owner source-only outcome…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner566Company').value||
    v.request_id!==$('owner566Case').value||
    v.provider_verified_receipt_id!==$('owner566Receipt').value)
    throw Error('Original signed source changed');
   const r=await sb.rpc('ywi_rpc_landscape_master_escalation_outcome_decide_566',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_provider_verified_receipt_id:v.provider_verified_receipt_id,
    p_expected_case_version:v.case_version,
    p_expected_master_observation_id:v.master_observation_id,
    p_expected_source_escalation_id:v.source_escalation_id,
    p_action:action,p_note:note,p_idempotency_key:nonce(),p_owner_attested:true});
   const z=r.data;
   if(r.error||z?.status!=='SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD'||
     !uuid(z.outcome_id)||z.master_owner_acceptance!==false)
    throw Error(r.error?.message||'Owner-only source reconciliation rejected');
   if(run!==epoch)throw Error('Original owner changed');
   review=null;$('owner566Action').value='';$('owner566Note').value='';
   $('owner566Attest').checked=false;
   status('SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD · '+z.outcome_id.slice(0,8)+
    '. Recheck independent signed source; no customer delivery or Master activation.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message+' Refresh original evidence.');}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function refresh(){
  const run=++epoch;busy=true;ownerId=null;companies=[];cases=[];reset();controls();
  status('Verifying original company owner…');
  try{
   const {id,sb}=await owner();
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
    .eq('owner_user_id',id).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.owner_user_id!==id||!uuid(c.id)))
    throw Error(r.error?.message||'Original company ownership unavailable');
   if(run!==epoch)throw Error('Original owner changed');
   ownerId=id;companies=r.data;
   const select=$('owner566Company'),prior=select.value;
   select.replaceChildren(opt('','Choose owned company'));
   for(const c of companies)select.append(opt(c.id,c.name||c.id));
   if(companies.some(c=>c.id===prior))select.value=prior;
   else if(companies.length===1)select.value=companies[0].id;
   await casesLoad(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!$('settings')||$('owner566'))return;
  const p=document.createElement('details');p.id='owner566';p.className='admin-hub-detail';
  p.innerHTML=`<summary>Landscaping · Source Drift Watch &amp; Owner Escalation Outcome (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner566,#owner566 *{box-sizing:border-box}
    #owner566{max-width:100%;min-width:0;overflow-wrap:anywhere}
    #owner566 .grid566{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:12px 0}
    #owner566 :is(select,textarea){width:100%;min-width:0;max-width:100%}
    #owner566 .panel566{padding:14px;border-radius:13px;margin:12px 0;border:1px solid var(--line,#8593a8)}
    #owner566 button{min-height:44px;white-space:normal}
   </style>
   <p>Deterministic evidence-watch from original signed Master receipt observations. This is not a future-failure probability or proof of ongoing uptime, customer delivery or Master CONNECTED.</p>
   <div class="grid566">
    <label>Original owned company<select id="owner566Company"></select></label>
    <label>Original recovery case<select id="owner566Case"></select></label>
    <label>Original signed provider receipt<select id="owner566Receipt"></select></label>
   </div>
   <button type="button" class="secondary" id="owner566Refresh">Refresh original source risk evidence</button>
   <p id="owner566Status" role="status" aria-live="polite">HOLD: authenticate original company owner.</p>
   <section class="panel566"><h3>24-hour drift watch &amp; source SLA</h3>
    <p id="owner566Risk">HOLD — source forecast evidence unavailable.</p></section>
   <section class="panel566"><h3>Independent escalation outcome</h3>
    <p id="owner566Escalation">HOLD — escalation outcome requires original signed source.</p></section>
   <section class="panel566"><h3>Original owner action</h3>
    <p>Request supervised follow-up, record a presently open original escalation, or reconcile source recovery only when independently signed evidence was admitted AFTER that escalation. No action accepts the Master.</p>
    <label>Decision<select id="owner566Action">
     <option value="">Choose source action</option>
     <option value="request_supervised_source_followup">Request supervised source follow-up</option>
     <option value="record_source_escalation_open">Record original source escalation open</option>
     <option value="reconcile_signed_source_recovery">Reconcile signed source recovery</option>
    </select></label>
    <label>Owner reason (15–500 characters; no customer details)
     <textarea id="owner566Note" rows="3" maxlength="500"></textarea></label>
    <label><input type="checkbox" id="owner566Attest"> I personally reviewed this exact original case, escalation and independent signed receipt.</label>
    <button type="button" id="owner566Decide" disabled>Record source-only owner outcome</button>
   </section>
  </div>`;
  $('settings').append(p);
  $('owner566Company').replaceChildren(opt('','Choose original company'));
  $('owner566Case').replaceChildren(opt('','Choose original recovery case'));
  reset();
  $('owner566Refresh').addEventListener('click',()=>void refresh());
  $('owner566Company').addEventListener('change',async()=>{
   const run=++epoch;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Original owner changed');
    await casesLoad(run,sb);}
   catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner566Case').addEventListener('change',()=>void receiptsLoad());
  $('owner566Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner566Action','change'],['owner566Note','input'],['owner566Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner566Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;ownerId=null;companies=[];cases=[];
   $('owner566Company').replaceChildren(opt('','Choose original company'));
   $('owner566Case').replaceChildren(opt('','Choose original recovery case'));
   reset();status('HOLD: original owner session changed; protected source evidence cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
