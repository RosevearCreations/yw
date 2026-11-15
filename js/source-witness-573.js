/* YW573 — owner-only original disposition closure-witness and SLA renewal readiness.
 * Do not load signer keys into the browser: governance enrollment and durable
 * custody are independent server-side operations only. */
(()=>{
 'use strict';
 const $=name=>document.getElementById(name);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 let epoch=0;
 const apps=[
  ['ai-data-platform','MASTER'],['rosevear-ai-hub','MASTER'],['rosevear-comms-hub','MASTER'],
  ['iCamp','PRODUCT SHELL'],['YW','PRODUCT SHELL'],
  ['devilndove','INTERNAL COMPANY'],['rosiedazzlers','INTERNAL COMPANY']
 ];
 function check(source,scope,rows,owner,now=Date.now()){
  const previous=window.YW572Security?.check;
  if(typeof previous!=='function')
   return {code:'HOLD_MISSING_SOURCE_GATE',reason:'Original owner signed source gate not loaded.'};
  const prior=previous(source,scope,rows,owner,now);
  if(prior?.code!=='SOURCE_READBACK_VERIFIED_REGISTRY_UNENROLLED_MASTER_HOLD')
   return {code:'HOLD_ORIGINAL_SOURCE',reason:'Independent signed original source and owner authorization must be rechecked.'};
  return {
   code:'SOURCE_READBACK_VERIFIED_WITNESS_QUORUM_PENDING_MASTER_HOLD',
   reason:'Original source owner readback is current; no genuine independent owner+custodian witness quorum, PostgreSQL original disposition admission or signed SLA renewal outcome is established.',
   signed_witnesses_admitted:0,original_dispositions_durably_custodied:0,
   disposition_admission:'NOT_AUTHORIZED',sla_outcome:'NOT_ESTABLISHED',master_connected:false,customer_delivery_verified:false,
   app_count:apps.length,source_only:true
  };
 }
 function clear(message){
  epoch++;
  const status=$('owner573Status'),details=$('owner573Result'),list=$('owner573Apps');
  if(status)status.textContent='HOLD — '+message;
  if(details)details.textContent='No independently verified original disposition witness, database ledger or SLA outcome receipt.';
  if(list)list.replaceChildren();
  const pane=$('owner573Details');if(pane)pane.open=false;
 }
 function render(result){
  const status=$('owner573Status'),details=$('owner573Result'),list=$('owner573Apps');
  if(status)status.textContent=result.code+' — '+result.reason;
  if(details)details.textContent='Closure witness quorum: NOT VERIFIED. Durable original disposition: NOT AUTHORIZED. Signed SLA recovery outcome: NOT ESTABLISHED. All three Master ACKs: HOLD. Customer delivery: HOLD. The browser cannot sign receipts, change custody, activate receiver, send to Devil n Dove or Rosie Dazzlers, or claim Master CONNECTED.';
  if(list){
   list.replaceChildren();
   for(const [app,role] of apps){
    const item=document.createElement('li');
    item.textContent=app+' — '+role+' — original signer and independent closure witness NOT ATTESTED; Master ACK HOLD';
    list.append(item);
   }
  }
 }
 async function refresh(){
  const checkEpoch=++epoch;const status=$('owner573Status');
  if(status)status.textContent='Checking original owner signed source without authorizing witness signatures, SLA results or three-Master messages…';
  try{
   const owner=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   const company=$('owner567Company')?.value,request=$('owner567Case')?.value,
    receipt=$('owner567Receipt')?.value;
   if(owner?.isAuthenticated!==true||!uuid(owner.user?.id)||!uuid(company)||
      !uuid(request)||!uuid(receipt)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Authenticated original owner and source case are required.');
   const user=await sb.auth.getUser();
   if(user.error||user.data?.user?.id!==owner.user.id)
    throw Error('Original owner session identity is unavailable.');
   const owned=await sb.from('ywi_companies').select('id,owner_user_id')
    .eq('owner_user_id',owner.user.id).eq('id',company).limit(1);
   if(owned.error||owned.data?.length!==1||owned.data[0].id!==company||
      owned.data[0].owner_user_id!==owner.user.id)
    throw Error('Original company tenant RLS authorization failed.');
   const src=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   if(src.error||!src.data)throw Error('Independent original source unavailable.');
   const events=await sb.from('ywi_landscape_master_remediation_audits_567')
    .select('id,idempotency_key,company_id,request_id,case_version,provider_verified_receipt_id,owner_user_id,action,anchor_master_observation_id,recorded_at')
    .eq('company_id',company).eq('request_id',request)
    .eq('provider_verified_receipt_id',receipt)
    .eq('case_version',src.data.case_version)
    .order('recorded_at',{ascending:false}).limit(101);
   if(events.error||!Array.isArray(events.data))
    throw Error('Original RLS-protected owner ledger unavailable.');
   if(checkEpoch!==epoch||company!==$('owner567Company')?.value||
    request!==$('owner567Case')?.value||receipt!==$('owner567Receipt')?.value||
    window.YWI_AUTH?.getState?.()?.user?.id!==owner.user.id)return;
   render(check(src.data,{company,request,receipt},events.data,owner.user.id));
  }catch(e){if(checkEpoch===epoch)clear(e.message||'Independent source review is unavailable.');}
 }
 function navigation(){
  const status=$('owner573NavStatus');
  if(!status)return;
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
   document.documentElement.dataset.ywTheme!=='futuristic'||
   typeof window.YW572Security?.navigation!=='function'){
   status.textContent='HOLD — protected original navigation not authorized.';return;
  }
  window.YW572Security.navigation();
  status.textContent=($('owner572NavStatus')?.textContent||'').startsWith('LOCAL NAVIGATION PASS')?
    'LOCAL NAVIGATION PASS — no cross-app permission, registry enrollment or custody admission granted.':
    'HOLD — original owner route permissions do not verify.';
 }
 function mount(){
  const parent=$('owner572');
  if(parent&&!$('owner573')){
   const container=document.createElement('section');
   container.id='owner573';container.className='panel567';
   container.style.minWidth='0';container.style.maxWidth='100%';container.style.overflowWrap='anywhere';
   const heading=document.createElement('h3');heading.textContent='YW573 · Signed closure witnesses & source SLA outcomes';
   const note=document.createElement('p');note.textContent='Original owner read-only source review. Independent closure witness signatures and durable source-disposition ledger require protected server-side custodians. Seven-app Master theme and transport cannot be modified by this panel.';
   const button=document.createElement('button');button.id='owner573Refresh';
   button.className='secondary';button.type='button';button.textContent='Check closure-witness and renewal readiness';
   const status=document.createElement('p');status.id='owner573Status';status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — independent original disposition witnesses and signed SLA outcome not verified.';
   const details=document.createElement('details');details.id='owner573Details';details.className='yw567-drilldown';
   const summary=document.createElement('summary');
   summary.setAttribute('aria-label','Review original two-witness quorum, signed SLA outcomes and ordered seven-app security handoff');
   summary.textContent='Review seven-app witness and SLA custody boundaries';
   const result=document.createElement('p');result.id='owner573Result';
   result.textContent='No independently verified original disposition witness, database ledger or SLA outcome receipt.';
   const list=document.createElement('ol');list.id='owner573Apps';
   details.append(summary,result,list);
   container.append(heading,note,button,status,details);parent.append(container);
   button.addEventListener('click',refresh);
   for(const name of ['owner567Company','owner567Case','owner567Receipt'])
    $(name)?.addEventListener('change',()=>clear('original company, case or receipt changed.'));
  }
  const command=$('yw565Command');
  if(command&&!$('owner573NavStatus')){
   const button=document.createElement('button');button.className='secondary';button.type='button';
   button.id='owner573NavCheck';button.textContent='Verify witness security navigation';
   const status=document.createElement('p');status.id='owner573NavStatus';
   status.style.maxWidth='100%';status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — current original navigation not verified.';
   command.append(button,status);button.addEventListener('click',navigation);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{clear('owner session changed; source evidence cleared.');navigation();});
 document.addEventListener('yw:theme-changed',navigation);
 window.addEventListener('hashchange',navigation);
 window.YW573Witness={check,navigation,apps};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();