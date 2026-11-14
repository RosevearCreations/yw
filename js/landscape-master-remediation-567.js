/* YW567 original company owner reopened signed escalation and SLA remediation.
 * Original provider receipt / independent Master observation are separate facts.
 * Fail closed on missing migrations, owner identity or stale source evidence. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const sha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
 const opt=(v,t)=>{const x=document.createElement('option');x.value=v;x.textContent=t;return x;};
 const classifications=new Set(['NO_SOURCE_RECONCILIATION_HOLD','REOPEN_NEW_INDEPENDENT_SIGNED_RISK',
  'SOURCE_SLA_BREACH_REMEDIATION_REQUIRED','STALE_SIGNED_RECEIPT_RECHECK',
  'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD','FRESH_SIGNED_SOURCE_REMEDIATION_READY',
  'REOPEN_PENDING_INDEPENDENT_REMEDIATION','SOURCE_RECONCILIATION_MONITORING_HOLD']);
 let epoch=0,busy=false,ownerId=null,companies=[],cases=[],receipts=[],review=null;
 const owns=id=>companies.some(c=>c.id===id&&c.owner_user_id===ownerId);
 const status=s=>{$('owner567Status').textContent=s;};
 function nonce(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  return [...b].map(v=>v.toString(16).padStart(2,'0')).join('')
   .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
 }
 async function owner(){
  const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(s?.isAuthenticated!==true||!uuid(s.user?.id)||
    !sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Original authenticated company owner required');
  const user=await sb.auth.getUser();
  if(user.error||user.data?.user?.id!==s.user.id)
   throw Error('Original owner session changed');
  return {sb,id:s.user.id};
 }
 function format(s){
  if(!s)return 'not established';
  const d=new Date(s);return Number.isFinite(+d)?d.toLocaleString('en-CA'):'invalid source';
 }
 function reset(){
  review=null;receipts=[];$('owner567Receipt').replaceChildren(opt('','Choose signed provider receipt'));
  $('owner567Reopen').textContent='HOLD — original signed escalation history unavailable.';
  $('owner567Remediation').textContent='HOLD — independent remediation evidence unavailable.';
  $('owner567Action').value='';$('owner567Note').value='';$('owner567Attest').checked=false;controls();
 }
 function controls(){
  const v=review,a=$('owner567Action').value,n=$('owner567Note').value.trim();
  const valid=v?.company_scope_only===true&&v?.read_only===true&&
   v?.master_owner_acceptance===false&&v?.master_connected===false&&
   v?.recipient_delivery_independently_verified===false&&v?.customer_message_sent===false&&
   v?.source_only_not_continuous_uptime===true&&sha(v.canonical_sha256)&&
   owns(v.company_id)&&cases.some(c=>c.request_id===v.request_id&&c.case_version===v.case_version)&&
   receipts.some(r=>r.id===v.provider_verified_receipt_id);
  const allowed=a==='request_supervised_remediation_recheck'||
   a==='record_signed_source_reopen'&&uuid(v?.source_reconciliation_id)&&
    (v?.signed_risk_after_reconciliation===true||v?.source_sla_breached===true)&&
    v?.remediation_classification!=='SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'||
   a==='audit_signed_source_remediation'&&uuid(v?.source_reconciliation_id)&&
    v?.independent_source_remediation_ready===true;
  $('owner567Decide').disabled=busy||!valid||!allowed||n.length<15||n.length>500||
   !$('owner567Attest').checked;
 }
 async function casesLoad(run,sb){
  cases=[];reset();$('owner567Case').replaceChildren(opt('','Choose original recovery case'));
  const cid=$('owner567Company').value;if(!owns(cid))return;
  const r=await sb.from('ywi_landscape_recovery_cases_556')
   .select('company_id,request_id,case_version,state,updated_at')
   .eq('company_id',cid).order('updated_at',{ascending:false}).limit(50);
  if(r.error||!Array.isArray(r.data)||r.data.some(c=>c.company_id!==cid||!uuid(c.request_id)))
   throw Error(r.error?.message||'Original recovery source unavailable');
  if(run!==epoch||cid!==$('owner567Company').value)throw Error('Original scope changed');
  cases=r.data;
  for(const c of cases)$('owner567Case').append(opt(c.request_id,
   c.state+' · v'+c.case_version+' · '+c.request_id.slice(0,8)));
  status('Select a signed original provider receipt to inspect source remediation.');
 }
 async function receiptsLoad(){
  const run=++epoch;busy=true;reset();controls();
  try{
   const {id,sb}=await owner(),cid=$('owner567Company').value,rid=$('owner567Case').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid))
    throw Error('Original owner, company or case changed');
   const r=await sb.from('ywi_landscape_provider_verified_561')
    .select('id,company_id,request_id,case_version,provider_reported_state,verified_at')
    .eq('company_id',cid).eq('request_id',rid)
    .order('verified_at',{ascending:false}).limit(30);
   if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.company_id!==cid||
     x.request_id!==rid||!uuid(x.id)))throw Error(r.error?.message||'Provider signed source unavailable');
   if(run!==epoch||cid!==$('owner567Company').value||rid!==$('owner567Case').value)
    throw Error('Original source changed');
   receipts=r.data;
   for(const x of receipts)$('owner567Receipt').append(opt(x.id,
    x.provider_reported_state+' · v'+x.case_version+' · '+x.id.slice(0,8)));
   status('Select one exact provider-signed receipt; Master source admission is separate.');
  }catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function inspect(){
  const run=++epoch;review=null;busy=true;controls();
  try{
   const {id,sb}=await owner(),cid=$('owner567Company').value,
    rid=$('owner567Case').value,receipt=$('owner567Receipt').value;
   if(id!==ownerId||!owns(cid)||!cases.some(c=>c.request_id===rid)||
     !receipts.some(r=>r.id===receipt))throw Error('Original signed receipt scope changed');
   const r=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:cid,p_request_id:rid,p_provider_verified_receipt_id:receipt});
   const v=r.data;
   if(r.error||!v||v.company_id!==cid||v.request_id!==rid||
    v.provider_verified_receipt_id!==receipt||!Number.isSafeInteger(v.case_version)||
    !sha(v.canonical_sha256)||!classifications.has(v.remediation_classification)||
    !(v.source_reconciliation_id===null||uuid(v.source_reconciliation_id))||
    !(v.source_reopen_id===null||uuid(v.source_reopen_id))||
    !(v.master_observation_id===null||uuid(v.master_observation_id))||
    typeof v.signed_risk_after_reconciliation!=='boolean'||
    typeof v.source_sla_breached!=='boolean'||typeof v.source_receipt_stale!=='boolean'||
    typeof v.independent_source_remediation_ready!=='boolean'||
    typeof v.remediation_audit_current!=='boolean'||
    v.source_only_not_continuous_uptime!==true||
    v.company_scope_only!==true||v.read_only!==true||
    v.recipient_delivery_independently_verified!==false||
    v.customer_message_sent!==false||v.master_owner_acceptance!==false||
    v.master_connected!==false)
    throw Error(r.error?.message||'Original signed remediation review contract mismatch');
   if(run!==epoch||cid!==$('owner567Company').value||
    rid!==$('owner567Case').value||receipt!==$('owner567Receipt').value)
    throw Error('Original source changed');
   review=v;
   $('owner567Reopen').textContent='Original provider SHA-256 '+v.canonical_sha256+
    ' · reconciled source '+(v.source_reconciliation_id||'HOLD')+
    ' · signed risk after reconciliation '+(v.signed_risk_after_reconciliation?'YES':'NO')+
    ' · source SLA '+(v.source_sla_state||'HOLD')+
    ' (due '+format(v.source_sla_due_at)+')'+
    ' · '+v.remediation_classification;
   $('owner567Remediation').textContent='Original reopen '+(v.source_reopen_id||'HOLD')+
    ' · verified matching Master observation '+(v.master_observation_id||'HOLD')+
    ' · observed at '+format(v.master_observation_verified_at)+
    ' · independent signed remediation '+(v.independent_source_remediation_ready?'READY FOR OWNER AUDIT':'HOLD')+
    ' · existing source-only audit '+(v.remediation_audit_current?'CURRENT':'HOLD')+
    ' · Master owner acceptance HOLD.';
   status(v.remediation_audit_current?
    'Source remediation audit CURRENT. Customer delivery and Master CONNECTED remain unverified.':
    'HOLD: source-only remediation requires original owner and new signed evidence.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 async function decide(){
  controls();if($('owner567Decide').disabled||!review)return;
  const v=review,action=$('owner567Action').value,note=$('owner567Note').value.trim();
  const run=++epoch;busy=true;controls();status('Recording original-owner source-only decision…');
  try{
   const {id,sb}=await owner();
   if(id!==ownerId||v.company_id!==$('owner567Company').value||
    v.request_id!==$('owner567Case').value||
    v.provider_verified_receipt_id!==$('owner567Receipt').value)
    throw Error('Original signed source identity changed');
   const r=await sb.rpc('ywi_rpc_landscape_master_remediation_decide_567',{
    p_company_id:v.company_id,p_request_id:v.request_id,
    p_provider_verified_receipt_id:v.provider_verified_receipt_id,
    p_expected_case_version:v.case_version,
    p_expected_reconciliation_id:v.source_reconciliation_id,
    p_expected_observation_id:v.master_observation_id,
    p_action:action,p_note:note,p_idempotency_key:nonce(),p_owner_attested:true});
   const z=r.data;
   if(r.error||z?.status!=='SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD'||
    !uuid(z.audit_id)||z.master_owner_acceptance!==false)
    throw Error(r.error?.message||'Protected original owner source-only audit rejected');
   if(run!==epoch)throw Error('Original owner session changed');
   review=null;$('owner567Action').value='';$('owner567Note').value='';
   $('owner567Attest').checked=false;
   status('SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD · '+z.audit_id.slice(0,8)+
    '. Refresh original independently signed source; no Master or customer delivery authority.');
  }catch(e){if(run===epoch){review=null;status('HOLD: '+e.message+' Refresh signed source.');}}
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
   if(run!==epoch)throw Error('Owner session changed');
   ownerId=id;companies=r.data;
   const sel=$('owner567Company'),prior=sel.value;
   sel.replaceChildren(opt('','Choose original company'));
   for(const c of companies)sel.append(opt(c.id,c.name||c.id));
   if(companies.some(c=>c.id===prior))sel.value=prior;
   else if(companies.length===1)sel.value=companies[0].id;
   await casesLoad(run,sb);
  }catch(e){if(run===epoch){ownerId=null;companies=[];status('HOLD: '+e.message);}}
  finally{if(run===epoch){busy=false;controls();}}
 }
 function mount(){
  if(!$('settings')||$('owner567'))return;
  const p=document.createElement('details');p.id='owner567';p.className='admin-hub-detail';
  p.innerHTML=`<summary>Landscaping · Independent Reopen Monitoring &amp; Source SLA Remediation Audit (owner)</summary>
  <div class="admin-panel-block">
   <style>
    #owner567,#owner567 *{box-sizing:border-box}
    #owner567{max-width:100%;min-width:0;overflow-wrap:anywhere}
    #owner567 .grid567{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:12px 0}
    #owner567 :is(select,textarea){width:100%;min-width:0;max-width:100%}
    #owner567 .panel567{padding:14px;border-radius:13px;margin:12px 0;border:1px solid var(--line,#8593a8)}
    #owner567 button{min-height:44px;white-space:normal}
   </style>
   <p>Track a new genuinely signed discrepancy after original-owner source reconciliation, review recorded original-company SLA breaches and audit fresh independently signed remediation after reopen. None is customer delivery or Master acceptance.</p>
   <div class="grid567">
    <label>Original owned company<select id="owner567Company"></select></label>
    <label>Original recovery case<select id="owner567Case"></select></label>
    <label>Original signed provider receipt<select id="owner567Receipt"></select></label>
   </div>
   <button type="button" class="secondary" id="owner567Refresh">Refresh independent signed source evidence</button>
   <p role="status" aria-live="polite" id="owner567Status">HOLD: authenticate original company owner.</p>
   <section class="panel567"><h3>Escalation reopen &amp; original SLA status</h3>
    <p id="owner567Reopen">HOLD — original signed escalation history unavailable.</p></section>
   <section class="panel567"><h3>Independent remediation evidence</h3>
    <p id="owner567Remediation">HOLD — independent remediation evidence unavailable.</p></section>
   <section class="panel567"><h3>Original owner source-only action</h3>
    <label>Decision<select id="owner567Action">
     <option value="">Choose action</option>
     <option value="record_signed_source_reopen">Record genuine signed source reopen</option>
     <option value="audit_signed_source_remediation">Audit fresh independently signed remediation</option>
     <option value="request_supervised_remediation_recheck">Request supervised source remediation recheck</option>
    </select></label>
    <label>Owner reason (15–500 characters, no customer details)
     <textarea id="owner567Note" rows="3" maxlength="500"></textarea></label>
    <label><input type="checkbox" id="owner567Attest"> I personally checked the original company, reconciliation, provider receipt, signed Master observation and SLA before this source-only decision.</label>
    <button type="button" id="owner567Decide" disabled>Record original owner source-only audit</button>
   </section>
  </div>`;
  $('settings').append(p);
  $('owner567Company').replaceChildren(opt('','Choose original company'));
  $('owner567Case').replaceChildren(opt('','Choose original recovery case'));
  reset();
  $('owner567Refresh').addEventListener('click',()=>void refresh());
  $('owner567Company').addEventListener('change',async()=>{
   const run=++epoch;busy=true;controls();
   try{const {id,sb}=await owner();if(id!==ownerId)throw Error('Original owner changed');
    await casesLoad(run,sb);}
   catch(e){if(run===epoch){reset();status('HOLD: '+e.message);}}
   finally{if(run===epoch){busy=false;controls();}}
  });
  $('owner567Case').addEventListener('change',()=>void receiptsLoad());
  $('owner567Receipt').addEventListener('change',()=>void inspect());
  for(const [id,event] of [['owner567Action','change'],['owner567Note','input'],['owner567Attest','change']])
   $(id).addEventListener(event,controls);
  $('owner567Decide').addEventListener('click',()=>void decide());
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;ownerId=null;companies=[];cases=[];
   $('owner567Company').replaceChildren(opt('','Choose original company'));
   $('owner567Case').replaceChildren(opt('','Choose original recovery case'));
   reset();status('HOLD: owner session changed; protected original signed source cleared.');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
