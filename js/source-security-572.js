/* YW572 — owner-only issuer registry readiness and replay admission boundary.
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
  const previous=window.YW571Disposition?.evaluate;
  if(typeof previous!=='function')
   return {code:'HOLD_MISSING_SOURCE_GATE',reason:'Original owner signed source gate not loaded.'};
  const prior=previous(source,scope,rows,owner,now);
  if(!['SOURCE_DISPOSITION_REVIEW_READY_SIGNER_HOLD',
   'SOURCE_STABILITY_REVIEW_SIGNER_HOLD'].includes(prior?.code))
   return {code:'HOLD_ORIGINAL_SOURCE',reason:'Independent signed original source and owner authorization must be rechecked.'};
  return {
   code:'SOURCE_READBACK_VERIFIED_REGISTRY_UNENROLLED_MASTER_HOLD',
   reason:'Original read-only owner source is current. No independently enrolled issuer registry, rotated key, durable replay admission, connected Master or customer-delivery receipt was established.',
   registered_issuers:0,independently_verified_custodians:0,
   replay_admission:'NOT_AUTHORIZED',master_connected:false,customer_delivery_verified:false,
   app_count:apps.length,source_only:true
  };
 }
 function clear(message){
  epoch++;
  const status=$('owner572Status'),details=$('owner572Result'),list=$('owner572Apps');
  if(status)status.textContent='HOLD — '+message;
  if(details)details.textContent='No independently enrolled public-key registry or replay admission proof.';
  if(list)list.replaceChildren();
  const pane=$('owner572Details');if(pane)pane.open=false;
 }
 function render(result){
  const status=$('owner572Status'),details=$('owner572Result'),list=$('owner572Apps');
  if(status)status.textContent=result.code+' — '+result.reason;
  if(details)details.textContent='Signer enrollment: UNVERIFIED. Rotation/grace/revocation: NOT ADMITTED. Replay custody: NOT AUTHORIZED. All three Master ACKs: HOLD. Customer delivery: HOLD. A browser readback cannot install issuer keys, rotate trust, record a disposition or insert a custody receipt.';
  if(list){
   list.replaceChildren();
   for(const [app,role] of apps){
    const item=document.createElement('li');
    item.textContent=app+' — '+role+' — independent issuer enrollment NOT ATTESTED; Master ACK HOLD';
    list.append(item);
   }
  }
 }
 async function refresh(){
  const checkEpoch=++epoch;const status=$('owner572Status');
  if(status)status.textContent='Verifying original signed owner source and zero-trust custody boundaries…';
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
  const status=$('owner572NavStatus');
  if(!status)return;
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
   document.documentElement.dataset.ywTheme!=='futuristic'||
   typeof window.YW571Disposition?.navigation!=='function'){
   status.textContent='HOLD — protected original navigation not authorized.';return;
  }
  window.YW571Disposition.navigation();
  status.textContent=($('owner571NavStatus')?.textContent||'').startsWith('LOCAL NAVIGATION CONTINUITY PASS')?
    'LOCAL NAVIGATION PASS — no cross-app permission, registry enrollment or custody admission granted.':
    'HOLD — original owner route permissions do not verify.';
 }
 function mount(){
  const parent=$('owner571');
  if(parent&&!$('owner572')){
   const container=document.createElement('section');
   container.id='owner572';container.className='panel567';
   container.style.minWidth='0';container.style.maxWidth='100%';container.style.overflowWrap='anywhere';
   const heading=document.createElement('h3');heading.textContent='YW572 · Independent issuer registry & replay custody';
   const note=document.createElement('p');note.textContent='Five-tier zero-trust original source review. This browser cannot enroll issuer keys, validate external custody signatures or admit replay receipts.';
   const button=document.createElement('button');button.id='owner572Refresh';
   button.className='secondary';button.type='button';button.textContent='Check issuer custody readiness';
   const status=document.createElement('p');status.id='owner572Status';status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — original signed issuer enrollment and replay custody not verified.';
   const details=document.createElement('details');details.id='owner572Details';details.className='yw567-drilldown';
   const summary=document.createElement('summary');
   summary.setAttribute('aria-label','Review original signer enrollment, replay custody and seven-app security boundaries');
   summary.textContent='Review seven-app issuer and custody boundaries';
   const result=document.createElement('p');result.id='owner572Result';
   result.textContent='No independently enrolled public-key registry or replay admission proof.';
   const list=document.createElement('ol');list.id='owner572Apps';
   details.append(summary,result,list);
   container.append(heading,note,button,status,details);parent.append(container);
   button.addEventListener('click',refresh);
   for(const name of ['owner567Company','owner567Case','owner567Receipt'])
    $(name)?.addEventListener('change',()=>clear('original company, case or receipt changed.'));
  }
  const command=$('yw565Command');
  if(command&&!$('owner572NavStatus')){
   const button=document.createElement('button');button.className='secondary';button.type='button';
   button.id='owner572NavCheck';button.textContent='Verify security-tier navigation';
   const status=document.createElement('p');status.id='owner572NavStatus';
   status.style.maxWidth='100%';status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — current original navigation not verified.';
   command.append(button,status);button.addEventListener('click',navigation);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{clear('owner session changed; source evidence cleared.');navigation();});
 document.addEventListener('yw:theme-changed',navigation);
 window.addEventListener('hashchange',navigation);
 window.YW572Security={check,navigation,apps};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();