/* YW569 — bounded original-source recurrence history and SLA recovery evidence.
 * Read only: derives a trend from the existing YW567 append-only owner ledger,
 * not from fabricated samples, browser storage, or unverified Master state. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
 const timestamp=s=>{const n=typeof s==='string'&&s?Date.parse(s):NaN;return Number.isFinite(n)?n:null;};
 const actions=new Set(['record_signed_source_reopen','audit_signed_source_remediation','request_supervised_remediation_recheck']);
 const hold=(reason)=>({code:'HOLD_UNVERIFIED_RETENTION',reason,events:[],metrics:null});
 let epoch=0;
 const inDays=(date,now,days)=>date>=now-days*86400000;
 function evaluate(source,scope,rows,ownerId,now=Date.now()){
  if(!source||!scope||!uuid(ownerId)||!Array.isArray(rows)||!Number.isFinite(now))
   return hold('Original authenticated owner, source evidence or ledger unavailable.');
  const base=window.YW568Resolution?.evaluate?.(source,scope);
  if(!base||!['SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD','REOPEN_REQUIRED','SLA_RECOVERY_HOLD','OWNER_AUDIT_REQUIRED','HOLD_UNVERIFIED_SOURCE'].includes(base.code))
   return hold('Independent YW568 source classification is absent.');
  if(source.company_id!==scope.company||source.request_id!==scope.request||
   source.provider_verified_receipt_id!==scope.receipt||!sha(source.canonical_sha256)||
   !Number.isSafeInteger(source.case_version)||source.case_version<1||
   source.company_scope_only!==true||source.read_only!==true||
   source.master_connected!==false||source.master_owner_acceptance!==false||
   source.customer_message_sent!==false||
   source.recipient_delivery_independently_verified!==false)
   return hold('Source authority or exact company/case/receipt changed.');
  const checked=timestamp(source.checked_at);
  if(checked===null||checked>now+120000||now-checked>300000)
   return hold('A fresh original-source server observation is required.');
  if(rows.length===0||rows.length>100)
   return hold(rows.length>100?'History exceeds bounded read; complete retention requires an authorized paginated source review.':'No original append-only remediation history is available.');
  const ids=new Set(),idempotency=new Set(),events=[];
  let prev=Infinity;
  for(const row of rows){
   const at=timestamp(row?.recorded_at);
   if(!uuid(row?.id)||!uuid(row?.idempotency_key)||!actions.has(row?.action)||
    row.company_id!==scope.company||row.request_id!==scope.request||
    row.provider_verified_receipt_id!==scope.receipt||row.case_version!==source.case_version||
    row.owner_user_id!==ownerId||at===null||at>now+120000||at>prev||
    ids.has(row.id)||idempotency.has(row.idempotency_key))
    return hold('Original signed ledger order, provenance, scope, timestamps or idempotency did not validate.');
   prev=at;ids.add(row.id);idempotency.add(row.idempotency_key);
   events.push({id:row.id,action:row.action,at,recorded_at:row.recorded_at});
  }
  const latestReopen=source.source_reopen_id;
  const latestAudit=source.latest_source_remediation_audit_id;
  const reopenRow=latestReopen?rows.find(r=>r.id===latestReopen&&r.action==='record_signed_source_reopen'):null;
  const auditRow=latestAudit?rows.find(r=>r.id===latestAudit&&r.action==='audit_signed_source_remediation'):null;
  if((latestReopen&&!reopenRow)||(latestAudit&&!auditRow))
   return hold('The exact current reopened/audited source receipt is absent from retained history.');
  if(auditRow&&source.remediation_audit_current===true){
   if(!uuid(auditRow.anchor_master_observation_id)||
    auditRow.anchor_master_observation_id!==source.master_observation_id||
    (reopenRow&&timestamp(auditRow.recorded_at)<=timestamp(reopenRow.recorded_at)))
    return hold('Current owner audit is not anchored to the independent post-reopen observation.');
  }
  const count=(action,days)=>events.filter(e=>e.action===action&&inDays(e.at,now,days)).length;
  const metrics={
   retained:events.length,window_days:90,
   reopened_7d:count('record_signed_source_reopen',7),
   reopened_30d:count('record_signed_source_reopen',30),
   reopened_90d:count('record_signed_source_reopen',90),
   audited_30d:count('audit_signed_source_remediation',30),
   rechecks_30d:count('request_supervised_remediation_recheck',30),
   latest_source_sla_state:source.source_sla_state||'UNKNOWN',
   independently_verified_current_audit:base.code==='SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD'&&Boolean(auditRow),
   historical_sla_recovery_percentage:null,
   continuous_uptime_verified:false,
   master_connected:false,
   recipient_delivery_verified:false
  };
  if(base.code!=='SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD')
   return {code:base.code,reason:'Current independent source is not verified as recovered; history is read-only and cannot override source HOLD. '+base.reason,events:events.slice(0,12),metrics};
  if(metrics.reopened_30d>=2)
   return {code:'REPEAT_REOPEN_REVIEW_MASTER_HOLD',
    reason:'Multiple original-owner reopen actions occurred within 30 days. Investigate signed source recurrence; current SLA is within target but historical SLA recovery percentages are not proven. Master CONNECTED remains HOLD.',
    events:events.slice(0,12),metrics};
  return {code:'SOURCE_RECOVERY_OBSERVED_MASTER_HOLD',
   reason:'Latest original owner audit is anchored to a fresh independent observation and the current source SLA is within target. Historical SLA effectiveness or continuous uptime is not established. Master CONNECTED remains HOLD.',
   events:events.slice(0,12),metrics};
 }
 function clear(reason){
  epoch++;
  const status=$('owner569Status'),list=$('owner569Events'),summary=$('owner569Metrics');
  if(status)status.textContent='HOLD — '+reason;
  if(list)list.replaceChildren();
  if(summary)summary.textContent='No authenticated original-source recurrence evidence loaded.';
  const detail=$('owner569Details');if(detail)detail.open=false;
 }
 function display(result){
  const status=$('owner569Status'),list=$('owner569Events'),summary=$('owner569Metrics');
  if(status)status.textContent=result.code+' — '+result.reason;
  if(!list||!summary)return;
  list.replaceChildren();
  const m=result.metrics;
  if(!m){summary.textContent='No verified retention trend available.';return;}
  summary.textContent='Original owner actions retained: '+m.retained+
   ' · Reopens in 7/30/90 days: '+m.reopened_7d+'/'+m.reopened_30d+'/'+m.reopened_90d+
   ' · Audits in 30 days: '+m.audited_30d+
   ' · Supervised rechecks in 30 days: '+m.rechecks_30d+
   ' · Current source SLA: '+m.latest_source_sla_state+
   '. Counts are owner actions, not independent historical uptime or a recovery success percentage.';
  for(const event of result.events){
   const li=document.createElement('li');const time=document.createElement('time');
   time.dateTime=event.recorded_at;
   time.textContent=new Date(event.at).toISOString().replace('T',' ').slice(0,16)+' UTC';
   const action=document.createElement('span');action.textContent=' — '+event.action.replaceAll('_',' ');
   li.append(time,action);list.append(li);
  }
 }
 async function refresh(){
  const run=++epoch;
  const status=$('owner569Status');if(status)status.textContent='Checking original owner ledger and latest independent source…';
  try{
   const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb,
    company=$('owner567Company')?.value,request=$('owner567Case')?.value,
    receipt=$('owner567Receipt')?.value;
   if(state?.isAuthenticated!==true||!uuid(state.user?.id)||
    !uuid(company)||!uuid(request)||!uuid(receipt)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)
    throw Error('Original signed company/case/receipt and authenticated owner are required.');
   const auth=await sb.auth.getUser();
   if(auth.error||auth.data?.user?.id!==state.user.id)
    throw Error('Authenticated original owner session could not be confirmed.');
   const owned=await sb.from('ywi_companies').select('id,owner_user_id')
    .eq('owner_user_id',state.user.id).eq('id',company).limit(1);
   if(owned.error||owned.data?.length!==1||owned.data[0]?.owner_user_id!==state.user.id||
    owned.data[0]?.id!==company)
    throw Error('Original company ownership was not independently confirmed.');
   const source=await sb.rpc('ywi_rpc_landscape_master_remediation_review_567',{
    p_company_id:company,p_request_id:request,p_provider_verified_receipt_id:receipt});
   if(source.error||!source.data)throw Error('Original signed source review is unavailable.');
   const history=await sb.from('ywi_landscape_master_remediation_audits_567')
    .select('id,idempotency_key,company_id,request_id,case_version,provider_verified_receipt_id,owner_user_id,action,anchor_master_observation_id,recorded_at')
    .eq('company_id',company).eq('request_id',request)
    .eq('provider_verified_receipt_id',receipt)
    .eq('case_version',source.data.case_version)
    .order('recorded_at',{ascending:false}).limit(101);
   if(history.error||!Array.isArray(history.data))
    throw Error('Original append-only remediation history is not available under owner RLS.');
   if(run!==epoch||company!==$('owner567Company')?.value||
    request!==$('owner567Case')?.value||receipt!==$('owner567Receipt')?.value||
    window.YWI_AUTH?.getState?.()?.user?.id!==state.user.id)
    return;
   display(evaluate(source.data,{company,request,receipt},history.data,state.user.id));
  }catch(e){if(run===epoch)clear(e.message||'Source review unavailable.');}
 }
 function auditContinuity(){
  const el=$('owner569MobileStatus');if(!el)return;
  const command=$('yw565Command');
  if(window.YWI_AUTH?.getState?.()?.isAuthenticated!==true||
   document.documentElement.dataset.ywTheme!=='futuristic'||!command||command.hidden||
   typeof window.YW568Resolution?.auditNavigation!=='function'){
   el.textContent='HOLD — authenticated Futuristic command/navigation unavailable.';return;
  }
  window.YW568Resolution.auditNavigation();
  const result=$('owner568NavStatus')?.textContent||'';
  const details=[...command.querySelectorAll('details.yw567-drilldown')];
  const valid=details.length>0&&details.every(d=>{
   const s=d.querySelector('summary');
   return s&&s.getAttribute('aria-label')&&d.querySelectorAll('a[data-yw567-route]').length>0;
  });
  el.textContent=result.startsWith('LOCAL NAVIGATION CHECK PASS')&&valid?
   'LOCAL CONTINUITY PASS — native keyboard summaries and current authorized routes; all device viewports still require regression checks.':
   'HOLD — missing accessible drilldown or currently accepted module routes.';
 }
 function mount(){
  const parent=$('owner568');
  if(parent&&!$('owner569')){
   const section=document.createElement('section');section.id='owner569';section.className='panel567';
   const h=document.createElement('h3');h.textContent='YW569 · Source recurrence and SLA recovery history';
   const explain=document.createElement('p');
   explain.textContent='Read-only original owner action retention; historical SLA recovery percentages cannot be inferred from source action counts.';
   const btn=document.createElement('button');btn.id='owner569Refresh';btn.type='button';
   btn.className='secondary';btn.textContent='Check original recurrence history';
   const status=document.createElement('p');status.id='owner569Status';
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   status.textContent='HOLD — select an original case and request a source review.';
   const detail=document.createElement('details');detail.id='owner569Details';
   detail.className='yw567-drilldown';
   const summary=document.createElement('summary');
   summary.textContent='Review owner actions and signed source scope';
   summary.setAttribute('aria-label','Review retained original owner actions and recurrence evidence');
   const metrics=document.createElement('p');metrics.id='owner569Metrics';
   metrics.textContent='No authenticated original-source recurrence evidence loaded.';
   const list=document.createElement('ol');list.id='owner569Events';
   detail.append(summary,metrics,list);section.append(h,explain,btn,status,detail);
   parent.append(section);btn.addEventListener('click',refresh);
   for(const id of ['owner567Company','owner567Case','owner567Receipt'])
    $(id)?.addEventListener('change',()=>clear('original scope changed; verify again.'));
  }
  const command=$('yw565Command');
  if(command&&!$('owner569MobileStatus')){
   const btn=document.createElement('button');btn.id='owner569NavCheck';btn.type='button';
   btn.className='secondary';btn.textContent='Check drilldown continuity';
   const result=document.createElement('p');result.id='owner569MobileStatus';
   result.setAttribute('role','status');result.setAttribute('aria-live','polite');
   result.textContent='HOLD — local mobile command continuity not checked.';
   command.append(btn,result);btn.addEventListener('click',auditContinuity);
  }
 }
 document.addEventListener('ywi:auth-changed',()=>{clear('owner session changed; retained history cleared.');auditContinuity();});
 document.addEventListener('yw:theme-changed',auditContinuity);
 window.addEventListener('hashchange',auditContinuity);
 window.YW569Recurrence={evaluate,auditContinuity};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();