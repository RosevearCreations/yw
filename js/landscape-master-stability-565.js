/* YW565 — original-company signed receipt stability and source recovery efficacy.
 * Nothing here accepts Master runtime, proves customer delivery or reads other tenants.
 * One original owner, exact source receipt and protected RPC are mandatory. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const sha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
 const opt=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
 const classes=new Set(['HOLD_ORIGINAL_SOURCE_PILOT','HOLD_NO_INDEPENDENT_MASTER_RECEIPT',
  'OPEN_SIGNED_ADMISSION_OR_DISCREPANCY','STALE_INDEPENDENT_MASTER_RECEIPT',
  'HOLD_NO_VERIFIED_RENEWAL_RECOVERY','FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED',
  'SEVEN_DAY_OBSERVED_RECEIPT_SPAN','THIRTY_DAY_OBSERVED_RECEIPT_SPAN']);
 const good=new Set(['FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED',
  'SEVEN_DAY_OBSERVED_RECEIPT_SPAN','THIRTY_DAY_OBSERVED_RECEIPT_SPAN']);
 let epoch=0,busy=false,ownerId=null,companies=[],cases=[],receipts=[],review=null;
 const status=s=>{$('owner565Status').textContent=s;};
 const owns=id=>companies.some(c=>c.id===id&&c.owner_user_id===ownerId);
 function nonce(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(v=>v.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 }
 function reset(){
  review=null;receipts=[];
  $('owner565Receipt').replaceChildren(opt('','Choose original signed receipt'));
  $('owner565Source').textContent='HOLD — independently signed source observation not loaded.';
  $('owner565Horizons').replaceChildren();
  $('owner565Sla').textContent='HOLD — original company SLA evidence not loaded.';
  $('owner565Action').value='';$('owner565Note').value='';$('owner565Attest').checked=false;
  controls();
 }
 async function owner(){
  const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(s?.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Original authenticated company owner required');
  const u=await sb.auth.getUser();
  if(u.error||u.data?.user?.id!==s.user.id)throw Error('Owner session changed');
  return {id:s.user.id,sb};
 }
 function controls(){
  const v=review,a=$('owner565Action')?.value,n=$('owner565Note')?.value.trim()||'';
  const valid=v?.company_scope_only===true&&v?.read_only===true&&
   v?.master_owner_acceptance===false&&v?.master_connected===false&&
   v?.customer_message_sent===false&&v?.recipient_delivery_independently_verified===false&&
   v?.continuity_is_observational_not_uptime===true&&sha(v.canonical_sha256)&&
   owns(v.company_id)&&cases.some(c=>c.request_id===v.request_id&&c.case_version===v.case_version)&&
   receipts.some(r=>r.id===v.provider_verified_receipt_id);
  const allowed=a==='request_fresh_independent_witness'||
   a==='escalate_long_horizon_drift'&&!good.has(v?.stability_classification)||
   a==='review_signed_source_recovery'&&v?.source_recovery_evidence_effective===true;
  $('owner565Decide').disabled=busy||!valid||!allowed||n.length<15||n.length>500||
   !$('owner565Attest').checked;
 }
 function metrics(v){
  const area=$('owner565Horizons');area.replaceChildren();
  for(const [suffix,label] of [['24h','24-hour'],['7d','7-day'],['30d','30-day']]){
   const section=document.createElement('section');section.className='yw565-metric';
   const head=document.createElement('h4');head.textContent=label+' signed receipt window';
   const p=document.createElement('p');p.textContent='Matched source claims: '+v['matched_receipts_'+suffix]+
    ' · signed admission exceptions: '+v['signed_admission_exceptions_'+suffix]+
    ' · signed discrepancies: '+v['signed_discrepancies_'+suffix];
   section.append(head,p);area.append(section);
  }
 }
 async function casesLoad(run,sb){
  cases=[];reset();
  $('owner565Case').replaceChildren(opt('','Choose original recovery case'));
  const id=$('owner565Company').value;if(!owns(id))return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
   .select('company_id,request_id,case_version,state,updated_at')
   .eq('company_id',id).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==id||!uuid(x.request_id)))
   throw Error(r.error?.message||'Original recovery cases unavailable');
  if(run!==epoch||id!==$('owner565Company').value)throw Error('Original company changed');
  cases=r.data;
  for(const c of cases)$('owner565Case').append(opt(c.request_id,
   c.state+' · v'+c.case_version+' · '+c.request_id.slice(0,8)));
  status('Select the original signed provider receipt to inspect historical source observations.');
 }
 async function receiptsLoad(){
  const run=++epoch;busy=true;reset();controls();
  try{
   const {id,sb}=await owner(),cid=$('owner565Company').value,rid=$('owner565Case').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid))
    throw Error('Original owner, company or case changed');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',cid).eq('request_id',rid)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid||
      x.request_id!==rid||!uuid(x.id)))throw Error(r.error?.message||'Signed receipts unavailable');
   if(run!==epoch||cid!==$('owner565Company').value||rid!==$('owner565Case').value)
    throw Error('Original source changed');
   receipts=r.data;
   for(const c of receipts)$('owner565Receipt').append(opt(c.id,
    c.provider_reported_state+' · v'+c.case_version+' · '+c.id.slice(0,8)));
   status(receipts.length+' provider-signed receipts available. Master evidence is independently signed.');
  }catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner565Company').value,
    rid=$('owner565Case').value,rec=$('owner565Receipt').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid)||
    !receipts.some(c=>c.id===rec))throw Error('Original source identity changed');
   const result=await sb.rpc('ywi_rpc_landscape_master_stability_review_565',{
    p_company_id:cid,p_request_id:rid,p_provider_verified_receipt_id:rec});
   const v=result.data;
   const countKeys=['matched_receipts_24h','matched_receipts_7d','matched_receipts_30d',
    'signed_admission_exceptions_24h','signed_admission_exceptions_7d','signed_admission_exceptions_30d',
    'signed_discrepancies_24h','signed_discrepancies_7d','signed_discrepancies_30d'];
   if(result.error||!v||v.company_id!==cid||v.request_id!==rid||
    v.provider_verified_receipt_id!==rec||!Number.isSafeInteger(v.case_version)||
    !sha(v.canonical_sha256)||!classes.has(v.stability_classification)||
    !countKeys.every(k=>Number.isSafeInteger(v[k])&&v[k]>=0)||
    !(v.master_observation_id===null||uuid(v.master_observation_id))||
    typeof v.source_recovery_evidence_effective!=='boolean'||
    v.continuity_is_observational_not_uptime!==true||
    v.company_scope_only!==true||v.read_only!==true||
    v.recipient_delivery_independently_verified!==false||
    v.customer_message_sent!==false||v.master_owner_acceptance!==false||v.master_connected!==false)
    throw Error(result.error?.message||'Protected signed Master source contract failed');
   if(run!==epoch||cid!==$('owner565Company').value||
    rid!==$('owner565Case').value||rec!==$('owner565Receipt').value)
    throw Error('Original owner/source changed');
   review=v;
   $('owner565Source').textContent='Original provider SHA-256 '+v.canonical_sha256+
    ' · source recovery '+(v.source_recovery_evidence_effective?'OBSERVED':'HOLD')+
    ' · '+v.stability_classification+
    '. Historical observations are not continuous uptime or customer receipt proof. Master acceptance HOLD.';
   metrics(v);
   $('owner565Sla').textContent='Original-company source resolution SLA: '+
    (v.source_resolution_sla_state||'HOLD')+
    (v.source_resolution_sla_due_at?' · due '+new Date(v.source_resolution_sla_due_at).toLocaleString('en-CA'):'')+
    ' · latest owner review '+v.last_owner_stability_action+'.';
   status(v.source_recovery_evidence_effective?
    'Fresh independent signed source recovery observed. Master owner acceptance remains HOLD.':
    'HOLD: missing, stale or discrepant independent source renewal evidence.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner565Decide').disabled||!review)return;
  const v=review,a=$('owner565Action').value,n=$('owner565Note').value.trim();
  const run=++epoch;busy=true;controls();status('Recording original-owner source-only stability decision…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner565Company').value||
    v.request_id!==$('owner565Case').value||
    v.provider_verified_receipt_id!==$('owner565Receipt').value)
    throw Error('Original source changed');
   const result=await sb.rpc('ywi_rpc_landscape_master_stability_decide_565',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_provider_verified_receipt_id:v.provider_verified_receipt_id,
    p_expected_case_version:v.case_version,
    p_expected_observation_id:v.master_observation_id,
    p_action:a,p_note:n,p_idempotency_key:nonce(),p_owner_attested:true});
   const x=result.data;
   if(result.error||x?.status!=='SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD'||
      !uuid(x.action_id)||x.master_owner_acceptance!==false)
    throw Error(result.error?.message||'Source-only owner decision not accepted');
   if(run!==epoch)throw Error('Original owner session changed');
   review=null;$('owner565Action').value='';$('owner565Note').value='';
   $('owner565Attest').checked=false;
   status('SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD · '+x.action_id.slice(0,8)+
    '. Refresh to inspect independently signed source state.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function refresh(){
  const run=++epoch;busy=true;ownerId=null;companies=[];cases=[];reset();controls();
  status('Verifying original owner session…');
  try{
   const {id,sb}=await owner();
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id')
    .eq('owner_user_id',id).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.owner_user_id!==id||!uuid(c.id)))
    throw Error(r.error?.message||'Original owned companies unavailable');
   if(run!==epoch)throw Error('Owner changed');
   ownerId=id;companies=r.data;
   const sel=$('owner565Company'),prior=sel.value;
   sel.replaceChildren(opt('','Choose original company'));
   for(const c of companies)sel.append(opt(c.id,c.name||c.id));
   if(companies.some(c=>c.id===prior))sel.value=prior;
   else if(companies.length===1)sel.value=companies[0].id;
   await casesLoad(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!$('settings')||$('owner565'))return;
  const p=document.createElement('details');p.id='owner565';p.className='admin-hub-detail';
  p.innerHTML=`<summary>Landscaping · Signed Recovery Effectiveness &amp; Long-Horizon Receipt Stability (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner565,#owner565 *{box-sizing:border-box}
    #owner565{max-width:100%;min-width:0;overflow-wrap:anywhere}
    #owner565 .yw565-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:12px 0}
    #owner565 :is(select,textarea){width:100%;min-width:0;max-width:100%}
    #owner565 .yw565-card{border:1px solid var(--line,#8793a1);border-radius:13px;padding:14px;margin:12px 0}
    #owner565 .yw565-metric{min-width:0;padding:14px;border:1px solid var(--line,#8793a1);border-radius:13px}
    #owner565 .yw565-metric h4{margin:0 0 7px}
    #owner565 button{min-height:44px;white-space:normal}
   </style>
   <p>Independent signed AI Data Platform receipt observations—not continuous uptime, delivered customer communications, or accepted Master connection. All views are scoped to the authenticated original company owner.</p>
   <div class="yw565-grid">
    <label>Owned company<select id="owner565Company"></select></label>
    <label>Original recovery case<select id="owner565Case"></select></label>
    <label>Original signed provider receipt<select id="owner565Receipt"></select></label>
   </div>
   <button type="button" class="secondary" id="owner565Refresh">Refresh protected receipt evidence</button>
   <p role="status" aria-live="polite" id="owner565Status">HOLD: authenticate original company owner.</p>
   <section class="yw565-card"><h3>Independent signed source recovery</h3>
    <p id="owner565Source">HOLD — independently signed source observation not loaded.</p></section>
   <div class="yw565-grid" id="owner565Horizons" aria-label="24-hour, 7-day and 30-day signed receipt observations"></div>
   <section class="yw565-card"><h3>Original-company recovery SLA</h3>
    <p id="owner565Sla">HOLD — original company SLA evidence not loaded.</p></section>
   <section class="yw565-card"><h3>Owner-gated follow-up</h3>
    <p>Request a new independent witness, escalate actual drift, or review signed source recovery. None of these actions proves actual recipient delivery or opens the Master.</p>
    <label>Source action<select id="owner565Action">
      <option value="">Choose action</option>
      <option value="request_fresh_independent_witness">Request fresh independent signed witness</option>
      <option value="escalate_long_horizon_drift">Escalate source receipt drift</option>
      <option value="review_signed_source_recovery">Review actual signed source recovery</option>
    </select></label>
    <label>Owner reason (15–500 characters, no customer details)
     <textarea id="owner565Note" rows="3" maxlength="500"></textarea></label>
    <label><input type="checkbox" id="owner565Attest"> I personally reviewed this exact company, source receipt and signed Master evidence.</label>
    <button type="button" id="owner565Decide" disabled>Record source-only owner decision</button>
   </section>
  </div>`;
  $('settings').append(p);
  $('owner565Company').replaceChildren(opt('','Choose original company'));
  $('owner565Case').replaceChildren(opt('','Choose original recovery case'));
  reset();
  $('owner565Refresh').addEventListener('click',()=>void refresh());
  $('owner565Company').addEventListener('change',async()=>{
   const run=++epoch;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Owner changed');await casesLoad(run,sb);}
   catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner565Case').addEventListener('change',()=>void receiptsLoad());
  $('owner565Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner565Action','change'],['owner565Note','input'],['owner565Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner565Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;ownerId=null;companies=[];cases=[];
   $('owner565Company').replaceChildren(opt('','Choose original company'));
   $('owner565Case').replaceChildren(opt('','Choose original recovery case'));
   reset();status('HOLD: original owner session changed; source evidence cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
