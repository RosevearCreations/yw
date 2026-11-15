/* YW571 — source-only original-owner disposition readiness and SLA renewal evidence watch.
 * The browser NEVER signs, accepts an arbitrary issuer, records a closure, or asserts
 * real Master ACK. Actual external signatures require the server-side pinned-key gate. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 const when=v=>{const n=typeof v==='string'?Date.parse(v):NaN;return Number.isFinite(n)?n:null;};
 const apps=[
  ['ai-data-platform','Master intelligence'],['rosevear-ai-hub','Original-host Master'],
  ['rosevear-comms-hub','Comms Master'],['iCamp','Campground product shell'],
  ['YW','Landscape product shell'],['devilndove','Commerce company'],
  ['rosiedazzlers','Detailing company']
 ];
 const hold=(message)=>({
  code:'HOLD_SOURCE_OR_DISPOSITION_UNVERIFIED',reason:message,
  renewal_effectiveness:'NOT_ESTABLISHED',signed_disposition:'NO_INDEPENDENT_SIGNATURE_ADMITTED',
  closure_authorized:false,master_connected:false,customer_delivery_verified:false,
  observation_age_hours:null,days_to_sla_deadline:null,security_tiers:tiers()
 });
 let epoch=0;
 function tiers(){return [
  {name:'Tenant / original owner',status:'OWNER_RLS_REQUIRED'},
  {name:'Independent signature / pinned issuer',status:'SIGNATURE_NOT_ADMITTED'},
  {name:'Source SLA / renewal',status:'TWO_SIGNED_OBSERVATIONS_REQUIRED'},
  {name:'Three-Master durable replay and ACK',status:'MASTER_ACK_HOLD'},
  {name:'Customer delivery and production write authority',status:'DELIVERY_HOLD'}
 ];}
 function evaluate(source,scope,rows,owner,now=Date.now()){
  const fn=window.YW570Assurance?.evaluate;
  if(typeof fn!=='function'||!source||!scope||!uuid(owner)||!Number.isFinite(now))
   return hold('Original independently verified signed source and authenticated owner missing.');
  const evidence=fn(source,scope,rows,owner,now);
  if(!evidence||!evidence.metrics||
   !['RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD','SIGNED_SOURCE_STABILITY_WATCH_MASTER_HOLD'].includes(evidence.code))
   return hold('YW570 signed source or original SLA recovery is not currently verified; no closure disposition allowed.');
  const observed=when(source.master_observation_verified_at),checked=when(source.checked_at);
  const due=source.source_sla_due_at==null?null:when(source.source_sla_due_at);
  if(observed===null||checked===null||now-observed>24*3600000||now-checked>300000||
   observed>now+120000||checked>now+120000||source.source_sla_due_at!=null&&due===null)
   return hold('Original independent signed observation or current-source readback is expired or malformed.');
  if(source.source_sla_state!=='WITHIN_TARGET'||source.source_sla_breached!==false||
    source.master_connected!==false||source.master_owner_acceptance!==false||
    source.customer_message_sent!==false||source.recipient_delivery_independently_verified!==false)
   return hold('Original signed source SLA or Master/customer authority boundary is not currently safe.');
  const age=(now-observed)/3600000;
  const urgent=age>=18||due!==null&&due-now<=4*3600000;
  const reviewReady=evidence.code==='RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD';
  const status=urgent?'SIGNED_RENEWAL_AND_DISPOSITION_RECHECK_HOLD':
               reviewReady?'SOURCE_DISPOSITION_REVIEW_READY_SIGNER_HOLD':
                           'SOURCE_STABILITY_REVIEW_SIGNER_HOLD';
  return {
   code:status,reason:urgent?
    'Current source observation is approaching expiry or the original SLA deadline is near. Independent renewal, disposition signature and owner approval are pending.':
    reviewReady?
    'Original recurrence appears ready for independent signed source-only disposition intake. No genuine signer receipt, closure authority or Master ACK is admitted.':
    'Original SLA currently within target; independent two-observation renewal-effectiveness and signed disposition remain unproven.',
   observation_age_hours:Math.max(0,Math.floor(age)),
   days_to_sla_deadline:due===null?null:Math.max(0,Math.round((due-now)/86400000*100)/100),
   renewal_effectiveness:'NOT_ESTABLISHED',
   signed_disposition:'NO_INDEPENDENT_SIGNATURE_ADMITTED',
   closure_authorized:false,master_connected:false,customer_delivery_verified:false,
   security_tiers:tiers(),origin:evidence.code
  };
 }
 function clear(reason){
  epoch++;
  const status=$('owner571Status'),audit=$('owner571Audit'),appList=$('owner571Apps');
  if(status)status.textContent='HOLD — '+reason;
  if(audit)audit.textContent='No trusted disposition, SLA renewal pair or Master ACK admitted.';
  if(appList)appList.replaceChildren();
  const d=$('owner571Details');if(d)d.open=false;
 }
 function render(v){
  const status=$('owner571Status'),audit=$('owner571Audit'),appList=$('owner571Apps');
  if(status)status.textContent=v.code+' — '+v.reason;
  if(audit)audit.textContent='Evidence age: '+(v.observation_age_hours===null?'unverified':v.observation_age_hours+'h')+
   ' · SLA deadline: '+(v.days_to_sla_deadline===null?'unknown':v.days_to_sla_deadline+' days')+
   ' · Historical renewal effectiveness: NOT_ESTABLISHED; two separate original signed observations required'+
   ' · Signature: NO_INDEPENDENT_SIGNATURE_ADMITTED'+
   ' · Closure: withheld · Master CONNECTED: HOLD · Customer delivery: HOLD.';
  if(appList){
   appList.replaceChildren();
   for(const [id,description] of apps){
    const li=document.createElement('li');li.textContent=id+' — '+description+
     ' — ACK NOT ATTESTED; no cross-app credentials or live transport authority inferred.';
    appList.append(li);
   }
  }
 }
 async function refresh(){
  const run=++epoch;
  const status=$('owner571Status');
  if(status)status.textContent='Checking original signed source, independent owner and bounded remediation history…';
  try{
   const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   const company=$('owner567Company')?.value,request=$('owner567Case')?.value,
    receipt=$('owner567Receipt')?.value;
   if(auth?.isAuthenticated!==true||!uuid(auth.user?.id)||!uuid(company)||
    !uuid(request)||!uuid(receipt)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Original authenticated owner and selected signed source are required.');
   const who=await sb.auth.getUser();
   if(who.error||who.data?.user?.id!==auth.user.id)
    throw Error('Original authenticated owner identity changed.');
   const owned=await sb.from('ywi_companies').select('id,owner_user_id')
    .eq('owner_user_id',auth.user.id).eq('id',company).limit(1);
   if(owned.error||owned.data?.length!==1||owned.data[0]?.id!==company||
    owned.data[0]?.owner_user_id!==auth.user.id)
    throw Error('Original company ownership is not independently verified.');
   const review=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   if(review.error||!review.data)throw Error('Original signed source review unavailable.');
   const history=await sb.from('ywi_landscape_master_remediation_audits_567')
    .select('id,idempotency_key,company_id,request_id,case_version,provider_verified_receipt_id,owner_user_id,action,anchor_master_observation_id,recorded_at')
    .eq('company_id',company).eq('request_id',request).eq('provider_verified_receipt_id',receipt)
    .eq('case_version',review.data.case_version).order('recorded_at',{ascending:false}).limit(101);
   if(history.error||!Array.isArray(history.data))
    throw Error('Original owner-RLS append-only source history unavailable.');
   if(run!==epoch||company!==$('owner567Company')?.value||request!==$('owner567Case')?.value||
      receipt!==$('owner567Receipt')?.value||window.YWI_AUTH?.getState?.()?.user?.id!==auth.user.id)
    return;
   render(evaluate(review.data,{company,request,receipt},history.data,auth.user.id));
  }catch(error){if(run===epoch)clear(error.message||'Original independently signed readback unavailable.');}
 }
 function navigation(){
  const el=$('owner571NavStatus');if(!el)return;
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
   document.documentElement.dataset.ywTheme!=='futuristic'||
   typeof window.YW570Assurance?.navigation!=='function'){
   el.textContent='HOLD — role-gated Futuristic command is not authenticated.';return;
  }
  window.YW570Assurance.navigation();
  const result=$('owner570MobileStatus')?.textContent||'';
  el.textContent=result.startsWith('LOCAL MULTI-DEVICE NAV CHECK PASS')?
   'LOCAL NAVIGATION CONTINUITY PASS — prior owner role-gated check completed; cross-app actions remain unavailable.':
   'HOLD — original mobile navigation or role gate did not verify.';
 }
 function mount(){
  const parent=$('owner570');
  if(parent&&!$('owner571')){
   const panel=document.createElement('section');panel.id='owner571';panel.className='panel567';
   panel.style.minWidth='0';panel.style.maxWidth='100%';panel.style.overflowWrap='anywhere';
   const h=document.createElement('h3');h.textContent='YW571 · Independent disposition & seven-app security';
   const desc=document.createElement('p');
   desc.textContent='Read-only original source verification; signed external receipts require independently pinned verifier, never a browser trust toggle.';
   const button=document.createElement('button');button.type='button';button.className='secondary';
   button.id='owner571Refresh';button.textContent='Check source disposition and security handoff';
   const status=document.createElement('p');status.id='owner571Status';
   status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — no original independent signer admission or owner acceptance.';
   const detail=document.createElement('details');detail.id='owner571Details';
   detail.className='yw567-drilldown';
   const sum=document.createElement('summary');sum.setAttribute('aria-label','Review signed disposition, renewal and seven-app security tiers');
   sum.textContent='Review source authority and seven-app handoff';
   const audit=document.createElement('p');audit.id='owner571Audit';
   audit.style.overflowWrap='anywhere';
   audit.textContent='No trusted disposition, SLA renewal pair or Master ACK admitted.';
   const list=document.createElement('ol');list.id='owner571Apps';
   list.style.overflowWrap='anywhere';
   detail.append(sum,audit,list);panel.append(h,desc,button,status,detail);
   parent.append(panel);button.addEventListener('click',refresh);
   for(const id of ['owner567Company','owner567Case','owner567Receipt'])
    $(id)?.addEventListener('change',()=>clear('Original company, case or receipt changed.'));
  }
  const command=$('yw565Command');
  if(command&&!$('owner571NavStatus')){
   const button=document.createElement('button');button.id='owner571NavCheck';
   button.className='secondary';button.type='button';button.textContent='Check protected navigation continuity';
   const status=document.createElement('p');status.id='owner571NavStatus';
   status.style.maxWidth='100%';status.style.overflowWrap='anywhere';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — local role-gated command continuity not checked.';
   command.append(button,status);button.addEventListener('click',navigation);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{clear('Owner session revoked; retained evidence cleared.');navigation();});
 document.addEventListener('yw:theme-changed',navigation);
 window.addEventListener('hashchange',navigation);
 window.YW571Disposition={evaluate,navigation,apps};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();