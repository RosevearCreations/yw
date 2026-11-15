/* YW570 — independently anchored long-horizon recurrence exception review and SLA-evidence aging.
 * Owner-only readback, no closure mutation, Master admission, customer delivery or fabricated evidence. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const moment=s=>{const t=typeof s==='string'&&s?Date.parse(s):NaN;return Number.isFinite(t)?t:null;};
 const day=86400000,hour=3600000;
 const hold=(reason)=>({code:'HOLD_UNVERIFIED_SOURCE',reason,alerts:[],metrics:null,closure_authorized:false});
 let epoch=0;
 function evaluate(source,scope,rows,owner,now=Date.now()){
  const fn=window.YW569Recurrence?.evaluate;
  if(typeof fn!=='function'||!Number.isFinite(now))return hold('Original YW569 independent retention verification missing.');
  const retained=fn(source,scope,rows,owner,now);
  if(!retained||!retained.metrics||retained.code==='HOLD_UNVERIFIED_RETENTION')
   return hold('Original owner signed retention evidence missing, stale, truncated or unauthorized.');
  const metric=retained.metrics,at=moment(source.master_observation_verified_at);
  const checked=moment(source.checked_at),reopened=moment(source.source_reopened_at);
  if(at===null||checked===null||at>now+120000||at<now-day||checked>now+120000||now-checked>300000)
   return hold('Independently verified original observation is stale, missing, or future dated.');
  if(source.master_connected!==false||source.master_owner_acceptance!==false||
   source.customer_message_sent!==false||source.recipient_delivery_independently_verified!==false||
   metric.master_connected!==false||metric.continuous_uptime_verified!==false||
   metric.recipient_delivery_verified!==false)
   return hold('Source-only permissions or original Master/customer hold boundary changed.');
  const alerts=[];
  const ageHours=(now-at)/hour;
  if(ageHours>=18) alerts.push({code:'SIGNED_EVIDENCE_AGING',severity:'warning',
   message:'Original independently verified source observation is '+Math.floor(ageHours)+' hours old; renew before 24-hour source validity expires.'});
  const due=source.source_sla_due_at==null?null:moment(source.source_sla_due_at);
  if(source.source_sla_due_at!=null&&due===null)return hold('Invalid original signed source SLA deadline.');
  if(due!==null){
   if(due<=now)alerts.push({code:'SLA_DEADLINE_REACHED',severity:'hold',
    message:'Original SLA due time is reached; independently reconcile current SLA state.'});
   else if(due-now<=4*hour)alerts.push({code:'SLA_DEADLINE_APPROACHING',severity:'warning',
    message:'Original source SLA due in '+Math.ceil((due-now)/60000)+' minutes; current source readback required.'});
  }
  const audits=rows.filter(r=>r.action==='audit_signed_source_remediation');
  const reopens=rows.filter(r=>r.action==='record_signed_source_reopen');
  const latestAudit=audits[0]||null,latestReopen=reopens[0]||null;
  const latestAuditTime=latestAudit?moment(latestAudit.recorded_at):null;
  const latestReopenTime=latestReopen?moment(latestReopen.recorded_at):null;
  if(latestReopen&&(!latestAudit||latestAuditTime===null||latestAuditTime<=latestReopenTime))
   alerts.push({code:'RECURRENCE_EXCEPTION_OPEN',severity:'hold',
    message:'A recorded original-source reopen has no newer independently anchored owner remediation audit.'});
  const recent=metric.reopened_90d;
  if(recent>=2)alerts.push({code:'LONG_HORIZON_REOPEN_PATTERN',severity:'review',
   message:'Multiple original owner reopen actions in 90 days; investigate recurrence, not a measured incident rate.'});
  if(!['SOURCE_RECOVERY_OBSERVED_MASTER_HOLD','REPEAT_REOPEN_REVIEW_MASTER_HOLD'].includes(retained.code))
   return {code:retained.code,reason:'A current signed source HOLD cannot be closed from older retained actions: '+retained.reason,
    alerts,metrics:metric,closure_authorized:false};
  if(metric.independently_verified_current_audit!==true||
   source.remediation_audit_current!==true||!latestAudit||
   latestAudit.id!==source.latest_source_remediation_audit_id||
   !uuid(latestAudit.anchor_master_observation_id)||
   latestAudit.anchor_master_observation_id!==source.master_observation_id||
   (reopened!==null&&(latestAuditTime<=reopened||at<=reopened))||
   (latestReopenTime!==null&&latestAuditTime<=latestReopenTime))
   return {code:'RECURRENCE_EXCEPTION_OPEN',reason:'A genuine newer original owner audit, after the current independent post-reopen observation, is required.',
    alerts,metrics:metric,closure_authorized:false};
  if(source.source_sla_state!=='WITHIN_TARGET'||source.source_sla_breached===true||
   due!==null&&due<=now)
   return {code:'SLA_RECOVERY_EVIDENCE_HOLD',
    reason:'Original source SLA is not verified within deadline. Historic action counts do not establish recovery.',
    alerts,metrics:metric,closure_authorized:false};
  const reviewReady=recent>=2||retained.code==='REPEAT_REOPEN_REVIEW_MASTER_HOLD';
  return {code:reviewReady?'RECURRENCE_CLOSURE_REVIEW_READY_MASTER_HOLD':
                        'SIGNED_SOURCE_STABILITY_WATCH_MASTER_HOLD',
   reason:reviewReady?
    'Latest original source audit postdates all retained reopens and is independently anchored; an authorized human must still decide recurrence closure. No closure or Master acceptance was written.':
    'Current source recovery is independently observed; continue original signed evidence aging and long-horizon recurrence watch. No Master CONNECTED or delivery claim.',
   alerts,metrics:metric,closure_authorized:false};
 }
 function clear(reason){
  epoch++;
  const el=$('owner570Status'),alerts=$('owner570Alerts'),details=$('owner570Evidence');
  if(el)el.textContent='HOLD — '+reason;
  if(alerts)alerts.replaceChildren();
  if(details)details.textContent='No independently verified original evidence loaded.';
  const d=$('owner570Details');if(d)d.open=false;
 }
 function render(v,source){
  const el=$('owner570Status'),alerts=$('owner570Alerts'),details=$('owner570Evidence');
  if(el)el.textContent=v.code+' — '+v.reason;
  if(!alerts||!details)return;
  alerts.replaceChildren();
  for(const a of v.alerts){
   const li=document.createElement('li');li.textContent=a.code+' — '+a.message;alerts.append(li);
  }
  if(!v.alerts.length){const li=document.createElement('li');li.textContent='No additional signed source aging alert on this readback.';alerts.append(li);}
  details.textContent=v.metrics?
   'Original owner 90-day reopen actions: '+v.metrics.reopened_90d+
   ' · Original 30-day owner audits: '+v.metrics.audited_30d+
   ' · Current signed source SLA: '+v.metrics.latest_source_sla_state+
   ' · Signed observation: '+(source.master_observation_verified_at||'unverified')+
   '. Closure authorization: withheld. This is not continuous uptime, historical recovery-rate evidence or Master CONNECTED.':
   'No complete original retention or source assurance available.';
 }
 async function refresh(){
  const run=++epoch;
  const el=$('owner570Status');if(el)el.textContent='Re-reading independent original source and owner ledger…';
  try{
   const authState=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   const company=$('owner567Company')?.value,request=$('owner567Case')?.value,receipt=$('owner567Receipt')?.value;
   if(authState?.isAuthenticated!==true||!uuid(authState.user?.id)||!uuid(company)||
      !uuid(request)||!uuid(receipt)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Authenticated original company, recovery case and provider receipt required.');
   const current=await sb.auth.getUser();
   if(current.error||current.data?.user?.id!==authState.user.id)throw Error('Authenticated original owner changed.');
   const own=await sb.from('ywi_companies').select('id,owner_user_id')
    .eq('owner_user_id',authState.user.id).eq('id',company).limit(1);
   if(own.error||own.data?.length!==1||own.data[0]?.id!==company||
      own.data[0]?.owner_user_id!==authState.user.id)throw Error('Original company ownership not verified.');
   const review=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   if(review.error||!review.data)throw Error('Original source receipt review unavailable.');
   const history=await sb.from('ywi_landscape_master_remediation_audits_567')
    .select('id,idempotency_key,company_id,request_id,case_version,provider_verified_receipt_id,owner_user_id,action,anchor_master_observation_id,recorded_at')
    .eq('company_id',company).eq('request_id',request)
    .eq('provider_verified_receipt_id',receipt)
    .eq('case_version',review.data.case_version)
    .order('recorded_at',{ascending:false}).limit(101);
   if(history.error||!Array.isArray(history.data))throw Error('Original RLS-protected remediation ledger unavailable.');
   if(run!==epoch||company!==$('owner567Company')?.value||
    request!==$('owner567Case')?.value||receipt!==$('owner567Receipt')?.value||
    window.YWI_AUTH?.getState?.()?.user?.id!==authState.user.id)return;
   render(evaluate(review.data,{company,request,receipt},history.data,authState.user.id),review.data);
  }catch(e){if(run===epoch)clear(e.message||'Independent source unavailable.');}
 }
 function navigation(){
  const el=$('owner570MobileStatus'),root=$('yw565Command');if(!el)return;
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
   document.documentElement.dataset.ywTheme!=='futuristic'||!root||root.hidden||
   typeof window.YW569Recurrence?.auditContinuity!=='function'){
   el.textContent='HOLD — no authenticated Futuristic role-gated navigation session.';return;
  }
  window.YW569Recurrence.auditContinuity();
  const result=$('owner569MobileStatus')?.textContent||'';
  const groups=[...root.querySelectorAll('details.yw567-drilldown')];
  let focusFail=false, offered=0;
  for(const d of groups){
   const summary=d.querySelector('summary');
   if(!summary||!summary.getAttribute('aria-label')||summary.tabIndex<-1)focusFail=true;
   for(const a of d.querySelectorAll('a[data-yw567-route]')){
    const isOffered=window.YWNavigationAcceptance566?.isOffered?.(a.dataset.yw567Route)===true;
    const hidden=a.closest('li')?.hidden===true;
    if(isOffered===hidden)focusFail=true;
    if(isOffered)offered++;
   }
  }
  el.textContent=!focusFail&&offered>0&&result.startsWith('LOCAL CONTINUITY PASS')?
   'LOCAL MULTI-DEVICE NAV CHECK PASS — accessible native summaries and '+offered+' role-authorized routes. Device breakpoints require protected browser regression.':
   'HOLD — keyboard summary, route permissions or role-gated mobile navigation did not verify.';
 }
 function mount(){
  const parent=$('owner569');
  if(parent&&!$('owner570')){
   const panel=document.createElement('section');panel.id='owner570';panel.className='panel567';
   panel.style.minWidth='0';panel.style.maxWidth='100%';panel.style.overflowWrap='anywhere';
   const h=document.createElement('h3');h.textContent='YW570 · Recurrence closure review & SLA aging';
   const note=document.createElement('p');
   note.textContent='Read-only long-horizon source evidence; review readiness is not closure approval, Master CONNECTED or customer delivery.';
   const button=document.createElement('button');button.id='owner570Refresh';
   button.type='button';button.className='secondary';button.textContent='Check source aging and recurrence exception';
   const status=document.createElement('p');status.id='owner570Status';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — request original signed source and owner retention review.';
   const details=document.createElement('details');details.id='owner570Details';
   details.className='yw567-drilldown';
   const summary=document.createElement('summary');
   summary.textContent='Review original aging alerts and closure evidence';
   summary.setAttribute('aria-label','Review original signed source evidence aging and recurrence closure readiness');
   const alerts=document.createElement('ul');alerts.id='owner570Alerts';
   const evidence=document.createElement('p');evidence.id='owner570Evidence';
   evidence.textContent='No independently verified original evidence loaded.';
   details.append(summary,alerts,evidence);panel.append(h,note,button,status,details);
   parent.append(panel);button.addEventListener('click',refresh);
   for(const id of ['owner567Company','owner567Case','owner567Receipt'])
    $(id)?.addEventListener('change',()=>clear('original company, case or receipt changed.'));
  }
  const root=$('yw565Command');
  if(root&&!$('owner570MobileStatus')){
   const button=document.createElement('button');button.type='button';
   button.className='secondary';button.id='owner570NavCheck';
   button.textContent='Verify mobile command navigation stability';
   const p=document.createElement('p');p.id='owner570MobileStatus';
   p.style.minWidth='0';p.style.maxWidth='100%';p.style.overflowWrap='anywhere';
   p.setAttribute('role','status');p.setAttribute('aria-live','polite');
   p.textContent='HOLD — mobile route continuity not independently checked.';
   root.append(button,p);button.addEventListener('click',navigation);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{clear('owner session changed; original evidence cleared.');navigation();});
 document.addEventListener('yw:theme-changed',navigation);
 window.addEventListener('hashchange',navigation);
 window.YW570Assurance={evaluate,navigation};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();