/* YW588 — authenticated original Rosevear TEST ONLY photo-pilot review.
 * Read original records with current owner and RLS. Never uploads, mutates,
 * signs evidence, closes a case or reads company customers from the vendor Shell. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
 const evidence=()=>window.YW588Evidence;
 const session=()=>window.YWI_AUTH?.getState?.()||{};
 const nav=()=>window.YW579Navigation?.snapshot?.()||{};
 const sb=()=>window.YWI_SB||window._sb;
 const sysop=()=>session().isAuthenticated===true&&
  window.YWIDualWorkspace?.isSysopVerified?.()===true&&location.hash==='#sysop';
 const owner=()=>session().isAuthenticated===true&&nav().verified===true&&
  nav().companyId===evidence()?.companyId&&
  window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&
  document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
 let epoch=0;
 function clear(){
  epoch++;
  for(const id of ['yw588ShellResult','yw588TenantResult'])$(id)?.replaceChildren();
  for(const id of ['yw588ShellStatus','yw588TenantStatus']){
   const el=$(id);if(el)el.textContent='HOLD · current original authority and independently witnessed receipts required.';
  }
 }
 async function current(kind){
  const user=session().user?.id,run=epoch,client=sb();
  if(!user||!client?.auth?.getUser||!client?.rpc||!client?.from||
     (kind==='shell'?!sysop():!owner()))throw Error('Current authorized Shell/tenant session required');
  const v=await client.auth.getUser();
  if(run!==epoch||v.error||v.data?.user?.id!==user||
     (kind==='shell'?!sysop():!owner()))throw Error('Current original authentication changed');
  if(kind==='shell'){
   const r=await client.rpc('ywi_is_platform_administrator_489');
   if(run!==epoch||r.error||r.data!==true||!sysop())throw Error('Platform administrator server membership not verified');
  }else{
   const r=await client.from('ywi_companies').select('id,name,owner_user_id')
    .eq('id',evidence().companyId).limit(2);
   if(run!==epoch||r.error||r.data?.length!==1||r.data[0]?.owner_user_id!==user||
      r.data[0]?.name!=='Rosevear Landscaping'||!owner())
    throw Error('Original Rosevear Landscaping company owner/RLS not verified');
  }
  return {client,run,user};
 }
 const add=(host,label,value)=>{const p=node('p');const b=node('strong',label+': ');p.append(b,document.createTextNode(String(value)));host.append(p);};
 async function tenant(){
  const s=$('yw588TenantStatus'),out=$('yw588TenantResult');if(!s||!out)return;
  out.replaceChildren();s.textContent='Checking original company/client/property/jobs through authenticated YW422…';
  const run=epoch;
  try{
   const {client}=await current('tenant');
   const res=await client.rpc('ywi_rpc_customer_history_422',{
    p_company_id:evidence().companyId,p_client_id:evidence().clientId});
   if(run!==epoch||!owner()||res.error)throw Error('Original YW422 customer history unavailable');
   const review=evidence().originalHistory(res.data);
   add(out,'Rosevear Landscaping test pilot','Original CRM readback · no customer PII rendered');
   add(out,'Original work order',review.state==='ORIGINAL_JOB_READBACK'?'1 authorized original record':'0 independently verified');
   if(review.state!=='ORIGINAL_JOB_READBACK'){
    s.textContent='HOLD · '+review.reason+'. No service is enabled or billable by this review.';
    return;
   }
   // Metadata only. Both tables must exist and original RLS must authorize them.
   const ph=await client.from('ywi_581_job_photo_evidence').select(
    'id,company_id,job_id,reported_sha256,consent_scope,consent_recorded,hash_server_verified')
    .eq('company_id',evidence().companyId).eq('job_id',review.jobId).limit(3);
   if(run!==epoch||!owner()||ph.error)throw Error('Private YW581 photo ledger not enrolled or inaccessible');
   if(ph.data?.length!==1){
    add(out,'Private original photo records',ph.data?.length??'Unknown');
    s.textContent='HOLD · original job exists but exactly one original private photo has not been verified.';
    return;
   }
   const item=ph.data[0];
   const integrity=await client.from('ywi_582_photo_integrity_receipts').select(
    'photo_id,company_id,job_id,observed_sha256,reported_sha256,observed_bytes,verified_match,independent_receipt_ref')
    .eq('company_id',evidence().companyId).eq('job_id',review.jobId).limit(3);
   if(run!==epoch||!owner()||integrity.error)throw Error('Independent byte-read receipt table not enrolled or accessible');
   const match=integrity.data?.length===1&&
    integrity.data[0].photo_id===item.id&&integrity.data[0].company_id===evidence().companyId&&
    integrity.data[0].job_id===review.jobId&&integrity.data[0].verified_match===true&&
    integrity.data[0].observed_sha256===item.reported_sha256&&
    Number(integrity.data[0].observed_bytes)>15;
   add(out,'Private photo records',1);
   add(out,'Independent server hash-read receipt',match?'Matching candidate — requires custodian confirmation':'Not verified');
   add(out,'Real crew device / dispatcher confirmation','Not independently attested here');
   add(out,'Platform Shell case closure','Not independently attested here');
   s.textContent='HOLD · private-photo metadata is not proof of actual original device and dispatcher case closure.';
  }catch(err){
   if(run===epoch){out.replaceChildren();s.textContent='HOLD · '+(err?.message||'Original data unavailable');}
  }
 }
 async function shell(){
  const s=$('yw588ShellStatus'),out=$('yw588ShellResult');if(!s||!out)return;
  out.replaceChildren();s.textContent='Checking authenticated platform operator and redacted technical case receiver…';
  const run=epoch;
  try{
   const {client}=await current('shell');
   // This RPC is deliberately NOT deployed in production until its independent
   // redaction, runtime source proof and authority migration are accepted.
   const response=await client.rpc('ywi_rpc_shell_photo_summary_588');
   if(run!==epoch||!sysop()||response.error)throw Error('Independently verified read-only Shell summary is not enrolled');
   const summary=evidence().shellReceipt(response.data);
   if(summary.state==='HOLD')throw Error(summary.reason);
   add(out,'Open technical cases',summary.openCount);
   add(out,'Tenant-confirmed technical closures',summary.closedCount);
   add(out,'Customer/photos/tenant finance','Not transferred to vendor Shell');
   s.textContent='Read-only redacted source summary. Master telemetry ACK still requires independent verification.';
  }catch(err){if(run===epoch){out.replaceChildren();s.textContent='HOLD · '+(err?.message||'Redacted incident source unavailable');}}
 }
 function panel(hostId,type){
  const host=$(hostId),id=type==='shell'?'yw588ShellPanel':'yw588TenantPanel';
  if(!host||$(id))return;
  const d=node('details');d.id=id;d.className='yw588-pilot';
  d.append(node('summary',type==='shell'?
   'YW588 · Platform technical incident — live evidence gate':
   'YW588 · Rosevear Landscaping original job / private photo pilot'));
  const p=node('p',type==='shell'?
   'Technical, redacted counts only. The Shell cannot read tenant customers, original photo bytes or invoices.':
   'TEST ONLY. Verify original company-linked work order and private-photo readback. No upload, job, payment or customer notice is created.');
  const btn=node('button',type==='shell'?'Inspect trusted Shell support receipts':'Inspect original pilot records');
  btn.type='button';btn.className='secondary';btn.addEventListener('click',type==='shell'?shell:tenant);
  const status=node('p','HOLD · current original authority and independently witnessed receipts required.');
  status.id=type==='shell'?'yw588ShellStatus':'yw588TenantStatus';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const out=node('div');out.id=type==='shell'?'yw588ShellResult':'yw588TenantResult';
  d.append(p,btn,status,out);host.append(d);
 }
 function mount(){panel('yw584Sysop','shell');panel('yw584Tenant','tenant');clear();}
 for(const ev of ['ywi:auth-changed','ywi:workspace-authority-changed',
  'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(ev,clear);
 document.addEventListener('change',e=>{if(e.target?.id==='yw579CompanySelect')clear();});
 window.addEventListener('hashchange',clear);
 window.YW588Pilot=Object.freeze({clear,inspectTenant:tenant,inspectShell:shell,
  state:()=>({productionLiveAcceptance:false,autoUpload:false,autoClose:false})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
