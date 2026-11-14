/* YW568 — original-owner, source-only resolution / SLA recovery verification.
 * No customer notifications, Master acceptance, data writes or synthetic proof. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 const safeDate=s=>{const d=s?Date.parse(s):NaN;return Number.isFinite(d)?d:null;};
 let epoch=0;
 const hold=reason=>({code:'HOLD_UNVERIFIED_SOURCE',reason});
 function evaluate(v,scope){
  if(!v||!scope||v.company_id!==scope.company||v.request_id!==scope.request||
    v.provider_verified_receipt_id!==scope.receipt||!uuid(v.company_id)||
    !uuid(v.request_id)||!uuid(v.provider_verified_receipt_id)||
    !Number.isSafeInteger(v.case_version)||v.case_version<1||!sha(v.canonical_sha256))
   return hold('Original company/case/provider receipt or signed source hash mismatch.');
  if(v.company_scope_only!==true||v.read_only!==true||
    v.source_only_not_continuous_uptime!==true||
    v.master_owner_acceptance!==false||v.master_connected!==false||
    v.customer_message_sent!==false||v.recipient_delivery_independently_verified!==false)
   return hold('Source-only, tenant or Master authority contract mismatch.');
  if(!uuid(v.source_reconciliation_id))
   return hold('Original owner reconciliation has not been signed.');
  if(typeof v.source_receipt_stale!=='boolean'||typeof v.signed_risk_after_reconciliation!=='boolean'||
    typeof v.source_sla_breached!=='boolean'||typeof v.remediation_audit_current!=='boolean'||
    typeof v.independent_source_remediation_ready!=='boolean')
   return hold('Signed source / SLA fields unavailable.');
  if(v.signed_risk_after_reconciliation)
   return {code:'REOPEN_REQUIRED',reason:'New independently signed risk after owner reconciliation; resolution cannot be claimed.'};
  if(v.source_receipt_stale||!uuid(v.master_observation_id)||
    safeDate(v.master_observation_verified_at)===null)
   return hold('Independent source observation is missing or stale.');
  if(v.source_sla_breached||v.source_sla_state!=='WITHIN_TARGET')
   return {code:'SLA_RECOVERY_HOLD',reason:'Original source SLA has not been independently confirmed within target.'};
  if(v.remediation_audit_current){
   if(!uuid(v.source_reopen_id)||!uuid(v.latest_source_remediation_audit_id)||
     v.remediation_classification!=='SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'||
     safeDate(v.source_reopened_at)===null||
     safeDate(v.master_observation_verified_at)<=safeDate(v.source_reopened_at))
    return hold('Current owner audit lacks a signed post-reopen independent observation.');
   return {code:'SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD',
    reason:'Owner source-only audit is current; original SLA within target and independent post-reopen observation verified. Master CONNECTED, uptime and customer delivery remain HOLD.'};
  }
  if(v.independent_source_remediation_ready&&uuid(v.source_reopen_id))
   return {code:'OWNER_AUDIT_REQUIRED',reason:'Fresh independent remediation appears ready; original owner audit has not been recorded.'};
  return hold('Source reopen resolution or independent remediation evidence is not current.');
 }
 function setStatus(message){const el=$('owner568Status');if(el)el.textContent=message;}
 function reset(){epoch++;setStatus('HOLD — select an original signed receipt and refresh verification.');}
 async function refresh(){
  const run=++epoch;
  setStatus('Checking authenticated original source and independent evidence…');
  try{
   const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   const company=$('owner567Company')?.value,request=$('owner567Case')?.value,
    receipt=$('owner567Receipt')?.value;
   if(state?.isAuthenticated!==true||!uuid(state.user?.id)||
     !uuid(company)||!uuid(request)||!uuid(receipt)||
     !sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Original authenticated company/case/provider receipt is required');
   const auth=await sb.auth.getUser();
   if(auth.error||auth.data?.user?.id!==state.user.id)throw Error('Original owner session changed');
   const owned=await sb.from('ywi_companies').select('id,owner_user_id')
    .eq('owner_user_id',state.user.id).eq('id',company).limit(1);
   if(owned.error||owned.data?.length!==1||owned.data[0]?.id!==company||
      owned.data[0]?.owner_user_id!==state.user.id)
    throw Error('Original company ownership not independently verified');
   const response=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   if(response.error)throw Error('Signed source review unavailable');
   if(run!==epoch||company!==$('owner567Company')?.value||
     request!==$('owner567Case')?.value||receipt!==$('owner567Receipt')?.value)
    return;
   const result=evaluate(response.data,{company,request,receipt});
   setStatus(result.code+' — '+result.reason);
  }catch(e){if(run===epoch)setStatus('HOLD — '+e.message);}
 }
 function auditNavigation(){
  const el=$('owner568NavStatus'),root=$('yw565Command');
  if(!el)return;
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
    document.documentElement.dataset.ywTheme!=='futuristic'||!root||root.hidden||
    typeof window.YWNavigationAcceptance566?.isOffered!=='function'){
   el.textContent='HOLD — authenticated Futuristic command route acceptance unavailable.';
   return;
  }
  const groups=[...root.querySelectorAll('.yw567-drilldown')];
  if(!groups.length){el.textContent='HOLD — native module drilldowns unavailable.';return;}
  let checked=0,failed=0;
  for(const d of groups){
   const summary=d.querySelector('summary');
   if(d.tagName!=='DETAILS'||!summary||!summary.getAttribute('aria-label'))failed++;
   for(const a of d.querySelectorAll('a[data-yw567-route]')){
    const route=a.dataset.yw567Route;
    const offered=window.YWNavigationAcceptance566.isOffered(route)===true;
    const hidden=a.closest('li')?.hidden===true;
    if(offered===hidden)failed++;
    if(offered)checked++;
   }
  }
  el.textContent=failed?
   'ACCESSIBILITY REGRESSION HOLD — '+failed+' route/summary mismatches; no authorization implied.':
   'LOCAL NAVIGATION CHECK PASS — '+checked+' offered routes with native keyboard summaries; real module access remains role-gated.';
 }
 function mount(){
  const root=$('owner567'),command=$('yw565Command');
  if(root&&!$('owner568')){
   const section=document.createElement('section');section.id='owner568';section.className='panel567';
   const heading=document.createElement('h3');heading.textContent='YW568 · Independent resolution and SLA recovery';
   const description=document.createElement('p');
   description.textContent='Read-only verification of the selected original company/case/signed provider receipt. No Master CONNECTED or customer delivery claim.';
   const button=document.createElement('button');button.id='owner568Refresh';button.type='button';
   button.className='secondary';button.textContent='Verify source resolution and SLA recovery';
   const result=document.createElement('p');result.id='owner568Status';
   result.setAttribute('role','status');result.setAttribute('aria-live','polite');
   result.textContent='HOLD — select an original signed receipt and refresh verification.';
   section.append(heading,description,button,result);
   root.querySelector('.admin-panel-block')?.append(section);
   button.addEventListener('click',refresh);
   for(const id of ['owner567Company','owner567Case','owner567Receipt']){
    $(id)?.addEventListener('change',reset);
   }
  }
  if(command&&!$('owner568NavStatus')){
   const p=document.createElement('p');p.id='owner568NavStatus';
   p.setAttribute('role','status');p.setAttribute('aria-live','polite');
   p.textContent='HOLD — command accessibility not yet checked.';
   const button=document.createElement('button');button.id='owner568NavCheck';
   button.type='button';button.className='secondary';
   button.textContent='Check accessible module routes';
   button.addEventListener('click',auditNavigation);
   command.append(button,p);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{reset();auditNavigation();});
 document.addEventListener('yw:theme-changed',auditNavigation);
 window.addEventListener('hashchange',auditNavigation);
 window.YW568Resolution={evaluate,auditNavigation};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();