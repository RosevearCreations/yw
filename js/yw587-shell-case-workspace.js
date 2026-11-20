/* YW587 -- opt-in demonstrator in the verified vendor Shell AND owner tenant.
 * No production incident, stored image, customer contact or finance write.
 * Source acknowledgement is not a genuine telemetry or storage receipt.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const e=(tag,copy)=>{const n=document.createElement(tag);if(copy!==undefined)n.textContent=copy;return n;};
 const active=()=>window.YWI_AUTH?.getState?.()||{};
 const nav=()=>window.YW579Navigation?.snapshot?.()||{};
 const sb=()=>window.YWI_SB||window._sb;
 const sysop=()=>active().isAuthenticated===true&&
  window.YWIDualWorkspace?.isSysopVerified?.()===true&&
  (location.hash==='#sysop'||document.documentElement.dataset.ywSurface==='platform');
 const owner=()=>active().isAuthenticated===true&&nav().verified===true&&
  nav().companyId===window.YW587RosevearFixture?.companyId&&
  window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&
  document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
 let epoch=0;
 function reset(message='HOLD: verify authorized product Shell or Rosevear Landscaping owner session.'){
  epoch++;
  for(const id of ['yw587ShellOutput','yw587TenantOutput']){
   const el=$(id);if(el)el.replaceChildren();
  }
  for(const id of ['yw587ShellStatus','yw587TenantStatus']){
   const node=$(id);if(node)node.textContent=message;
  }
 }
 async function authority(surface){
  const actor=active().user?.id,token=epoch,client=sb();
  if(!actor||!client?.auth?.getUser||!client?.rpc||!client?.from)
   throw Error('Current authenticated authority unavailable');
  if(surface==='shell'&&!sysop()||surface==='tenant'&&!owner())
   throw Error('Authorized current workspace required');
  const auth=await client.auth.getUser();
  if(token!==epoch||auth.error||auth.data?.user?.id!==actor)
   throw Error('Current server-side authentication changed');
  if(surface==='shell'){
   const r=await client.rpc('ywi_is_platform_administrator_489');
   if(token!==epoch||!sysop()||r.error||r.data!==true)
    throw Error('Independent platform administrator membership unavailable');
  }else{
   const c=await client.from('ywi_companies').select('id,name,owner_user_id')
    .eq('id',window.YW587RosevearFixture.companyId).limit(2);
   if(token!==epoch||!owner()||c.error||c.data?.length!==1||
      c.data[0].owner_user_id!==actor||c.data[0].name!=='Rosevear Landscaping')
    throw Error('Original Rosevear Landscaping owner link unavailable');
  }
  return {actor,token};
 }
 const labels=Object.freeze({
  crew_photo_pending:'Crew: photo pending after reconnect',
  dispatcher_case_opened:'Dispatcher: local case, owner and next update',
  shell_incident_ack:'Shell: redacted technical incident accepted',
  shell_fault_diagnosed:'Support: compare device and attachment timing',
  support_retry_requested:'Support: retry the SAME attachment identifier',
  private_photo_receipt:'Storage worker: fixture-only private hash/receipt',
  crew_photo_visible:'Crew: one original photo visible in fixture',
  dispatcher_recovery_confirmed:'Dispatcher: job and invoice count unchanged',
  shell_incident_closed:'Shell: close only after dispatcher confirmation'
 });
 function render(surface,context){
  const host=$(surface==='shell'?'yw587ShellOutput':'yw587TenantOutput');
  if(!host)return;
  host.replaceChildren();
  const fixture=window.YW587RosevearFixture?.make?.();
  const engine=window.YW587PhotoSupport;
  if(!fixture||!engine)throw Error('Versioned rehearsal engine not loaded');
  const result=engine.inspect(fixture.events,fixture.caseRef,{now:Date.now()});
  if(result.state!=='REHEARSAL_CLOSED')throw Error('Rehearsal custody checks did not pass');
  const h=e('h4','TEST ONLY · original company/client/property links verified in production');
  const p=e('p','Original job: NOT CREATED · Original photo: NOT UPLOADED · No customer billing or support notification.');
  const ul=e('ol');ul.className='yw587-timeline';
  fixture.events.forEach((item,i)=>{
   const li=e('li');
   const title=e('strong',(i+1)+'. '+labels[item.kind]);const t=e('small',item.at+' · '+item.role);
   li.append(title,t);ul.append(li);
  });
  const metric=e('dl');metric.className='yw587-metrics';
  const data=[['Verified synthetic steps',result.stepsVerified],
   ['Synthetic retry failures',result.failureAttempts],
   ['Affected fixture devices',result.affectedDevices],
   ['Synthetic closure seconds',result.restoreSeconds],
   ['Duplicate photo objects prevented',result.photoCount===1?'Test passed':'HOLD'],
   ['Invoice count changed','No (fixture)'],
   ['Live crew/storage ACK','UNKNOWN'],
   ['Live Master receiver ACK','UNKNOWN']];
  for(const [key,value] of data){
   const dt=e('dt',key),dd=e('dd',String(value));metric.append(dt,dd);
  }
  host.append(h,p,ul,metric);
  if(surface==='shell'){
   const receipt=engine.redactedShellReceipt(result);
   const pre=e('pre',JSON.stringify(receipt,null,2));pre.className='yw587-redacted';host.append(pre);
  }
  const warning=e('p','REHEARSAL PASS is NOT production acceptance. Missing: a real original job, storage bytes and hash, device receipt, dispatcher confirmation, signed Master ACK.');
  warning.className='yw587-warning';host.append(warning);
 }
 async function run(surface){
  const status=$(surface==='shell'?'yw587ShellStatus':'yw587TenantStatus');
  if(status)status.textContent='Verifying current '+(surface==='shell'?'platform Sysop':'Rosevear Landscaping owner')+' and original data boundary…';
  const token=epoch;
  try{
   const auth=await authority(surface);
   if(token!==epoch||auth.token!==epoch)return;
   render(surface,auth);
   if(status)status.textContent='Synthetic support cycle PASS · actual field-photo and Master telemetry acceptance remain HOLD.';
  }catch(err){if(token===epoch){
   if(status)status.textContent='HOLD · '+(err?.message||'Independent authorization not found');
  }}
 }
 function makePanel(hostId,kind){
  const host=$(hostId);
  if(!host||$(kind==='shell'?'yw587ShellPanel':'yw587TenantPanel'))return;
  const panel=e('details');panel.id=kind==='shell'?'yw587ShellPanel':'yw587TenantPanel';
  panel.className='yw587-case-panel';
  const title=e('summary',kind==='shell'?
   'YW587 Shell · Missing-Photo Technical Incident & Recovery Trace':
   'YW587 Rosevear Landscaping · Crew/Dispatcher Missing-Photo Rehearsal');
  const info=e('p','Source of Value YW09/YW10 · Shell Review missing-photo case. Synthetic job/photo ONLY. Current original CRM test customer/property do exist, but no original job or photo receipt exists.');
  const btn=e('button','Run isolated nine-stage missing-photo rehearsal');
  btn.type='button';btn.addEventListener('click',()=>run(kind));
  const state=e('p','HOLD · Authorized owner/operator and independent original-job/photo storage required.');
  state.id=kind==='shell'?'yw587ShellStatus':'yw587TenantStatus';
  state.setAttribute('role','status');
  const out=e('div');out.id=kind==='shell'?'yw587ShellOutput':'yw587TenantOutput';
  out.setAttribute('aria-live','polite');
  panel.append(title,info,btn,state,out);host.append(panel);
 }
 function mount(){
  makePanel('yw584Sysop','shell');
  makePanel('yw584Tenant','tenant');reset();
 }
 for(const type of ['ywi:auth-changed','ywi:workspace-authority-changed',
  'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
    document.addEventListener(type,()=>reset());
 document.addEventListener('change',ev=>{if(ev.target?.id==='yw579CompanySelect')reset();});
 window.addEventListener('hashchange',()=>reset());
 window.YW587ShellCase=Object.freeze({reset,inspect:()=>({
  state:'REHEARSAL_SOURCE_ONLY',realPhotoStorage:false,
  realCustomerPortalEnrolled:false,realMasterAcknowledgement:false})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
