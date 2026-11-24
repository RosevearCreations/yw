/* YW596: authenticated original source two-key drill and owner-consented calendar.
 * No remote key or endpoint mutations, no private source bytes in client. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const idRegex=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const valid=x=>typeof x==='string'&&idRegex.test(x);
 const n=(type,t)=>{const e=document.createElement(type);if(t!==undefined)e.textContent=String(t);return e;};
 const value=id=>$(id)?.value?.trim()||'';
 const state=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,busy=false;
 const status=s=>{if($('yw596Status'))$('yw596Status').textContent=s;};
 const company=()=>{const x=value('yw596Company')||value('yw595Company');if(!valid(x))throw Error('Real original company UUID is required');return x;};
 const required=id=>{const x=value(id);if(!valid(x))throw Error('Provide verified UUID in '+id);return x;};
 const consent=id=>{if(!$(id)?.checked)throw Error('Explicit original human authorization required: '+id);};
 async function auth(){
  const e=epoch,s=state(),sb=client();
  if(s.isAuthenticated!==true||!valid(s.user?.id)||!sb?.auth?.getUser||!sb?.functions?.invoke)
   throw Error('Sign in with the actual authorized original company or platform account');
  const v=await sb.auth.getUser();
  if(v.error||v.data?.user?.id!==s.user.id||epoch!==e||state().user?.id!==s.user.id)
   throw Error('Original Auth session changed');
  return {e,sb,user:s.user.id};
 }
 async function call(ctx,action,data={}){
  if(navigator.onLine===false)throw Error('Online original Master receiver required');
  const r=await ctx.sb.functions.invoke('yw596-receiver-rotation-continuity',
   {body:{action,...data}});
  if(ctx.e!==epoch||state().user?.id!==ctx.user)
   throw Error('Original actor/workspace changed; private results withheld');
  if(r.error||!r.data||r.data.state==='HOLD')
   throw Error(r.data?.code||'Original signed receiver or real actor HOLD');
  return r.data;
 }
 async function run(fn){
  if(busy)return;busy=true;const start=epoch;
  document.querySelectorAll('#yw596Panel button').forEach(x=>x.disabled=true);
  try{await fn(await auth());}
  catch(e){if(epoch===start)status('HOLD · '+(e?.message||'Original source unavailable'));}
  finally{if(epoch===start){busy=false;
   document.querySelectorAll('#yw596Panel button').forEach(x=>x.disabled=false);}}
 }
 function input(parent,id,label){
  const l=n('label',label),v=n('input');v.type='text';v.id=id;v.spellcheck=false;
  v.autocomplete='off';l.append(v);parent.append(l);
 }
 function check(parent,id,caption){
  const l=n('label'),v=n('input');v.type='checkbox';v.id=id;
  l.className='yw596-ack';l.append(v,document.createTextNode(' '+caption));parent.append(l);
 }
 function button(parent,title,fn){
  const v=n('button',title);v.type='button';v.addEventListener('click',()=>run(fn));
  parent.append(v);
 }
 function result(data){
  $('yw596Result').replaceChildren();
  for(const [k,v]of Object.entries(data)){
   if(v===null||typeof v==='object')continue;
   const p=n('p');p.append(n('strong',k+': '),document.createTextNode(String(v)));
   $('yw596Result').append(p);
  }
 }
 function table(title,rows,cols){
  const root=$('yw596Result');root.append(n('h4',title));
  if(!rows?.length){root.append(n('p','No enrolled original record; no synthetic evidence created.'));return;}
  const t=n('table');t.className='yw596-table';
  const thead=n('thead'),hr=n('tr');
  cols.forEach(c=>hr.append(n('th',c[1])));thead.append(hr);t.append(thead);
  const body=n('tbody');
  for(const item of rows){
   const tr=n('tr');cols.forEach(([k])=>tr.append(n('td',item[k]??'—')));
   tr.addEventListener('click',()=>{
    for(const [prop,target] of [
     ['rotationId','yw596Rotation'],['dualKeyProofId','yw596Proof'],
     ['canaryId','yw596CanaryA'],['priorAckId','yw596PriorAck'],
     ['optinId','yw596Optin'],['slotId','yw596Slot'],
     ['pairId','yw596Pair']]){
     if(valid(item[prop])&&$(target))$(target).value=item[prop];
    }
    if(valid(item.consentId)){
     const a=$('yw596ConsentA'),b=$('yw596ConsentB');
     if(!a.value)a.value=item.consentId;
     else if(item.consentId!==a.value)b.value=item.consentId;
    }
   });
   body.append(tr);
  }
  t.append(body);root.append(t);
 }
 function ownerQueue(data){
  $('yw596Result').replaceChildren();
  table('Owner approved YW595 rotations and genuine dual-key proof',data.rotations,
   [['rotationId','Signed custody'],['dualKeyProofId','Old+next key proof']]);
  table('Original source canary ACKs',data.canaries,
   [['canaryId','Next ACK'],['priorAckId','Old Master ACK'],['acknowledgedAt','Verified UTC']]);
  table('Owner specific next-window consent',data.slotConsents,
   [['slotConsentId','Consent'],['slotId','Window'],['signedAt','UTC']]);
 }
 function sysopQueue(data){
  $('yw596Result').replaceChildren();
  table('Real original owner-consented scheduling windows',data.slotConsents,
   [['companyId','Original company'],['consentId','Signed owner consent'],['signedAt','UTC']]);
  table('Separate original-tenant schedules (Sysop only)',data.pairs,
   [['pairId','Coordination ID'],['scheduledAt','UTC']]);
 }
 function mount(){
  if($('yw596Panel')||!$('jobs'))return;
  const root=n('details');root.id='yw596Panel';root.className='yw596-panel';
  root.append(n('summary','YW596 · Dual-Key Master Receiver Drill / Independent ACK / Two-Tenant Pilot Scheduler'));
  root.append(n('p','Owner probes an independently controlled old/new-key Master endpoint without changing its configuration. '+
   'Original crew obtains a separate genuine next-key ACK on a different private source digest. '+
   'Each business owner consents to one exact future witness window. A distinct Sysop coordinates; another Sysop audits. '+
   'No private photos, remote secret changes, or hardware identity certifications.'));
  const fields=n('div');fields.className='yw596-grid';root.append(fields);
  for(const [id,label] of [
   ['yw596Company','Original tenant company UUID'],
   ['yw596Rotation','YW595 independently reviewed rotation UUID'],
   ['yw596Proof','Verified original dual-key rotation proof UUID'],
   ['yw596PriorAck','Original prior-key YW592 Master receipt record UUID'],
   ['yw596NewAttempt','Different original YW591 device/private-photo attempt UUID'],
   ['yw596Optin','Original YW595 company owner-opt-in UUID'],
   ['yw596Slot','Original signed future YW593 witness slot UUID'],
   ['yw596ConsentA','FIRST owner consent record UUID (lower company UUID)'],
   ['yw596ConsentB','SECOND owner consent record UUID (higher company UUID)'],
   ['yw596Pair','Two-real-company scheduling record UUID'],
   ['yw596CanaryA','First company genuine new-key ACK UUID'],
   ['yw596CanaryB','Second company genuine new-key ACK UUID']
  ])input(fields,id,label);
  check(root,'yw596RotationConsent','I am the real original owner authorizing a read-only, dual-key receiver protocol challenge. I understand the production secret will NOT change.');
  check(root,'yw596CrewConsent','I am the actual enrolled original crew member on the device used for this source; send a signed DIGEST-ONLY canary, NOT the original private photo.');
  check(root,'yw596SlotConsent','As the original owner I consent to this exact previously approved future witness window being compared with a separate, consenting original tenant.');
  check(root,'yw596CoordinatorConsent','As the enrolled platform coordinator, I reviewed two distinct businesses, separate owners and non-overlapping original witness windows.');
  check(root,'yw596AuditConsent','As the SECOND independent platform auditor, distinct from both tenant crews, owners, reviewers and first coordinator, I explicitly reviewed two genuine signed old/new Master ACK chains.');
  const acts=n('div');acts.className='yw596-actions';root.append(acts);
  button(acts,'Owner / reviewer: read private signed ACK queue',async c=>{
   ownerQueue(await call(c,'overview',{companyId:company()}));
   status('Original company queue read; no remote secret or photo altered.');});
  button(acts,'Original owner: check receiver OLD and NEXT key without rotating',async c=>{
   consent('yw596RotationConsent');
   result(await call(c,'verify-dual-key-receiver',{companyId:company(),
    rotationId:required('yw596Rotation'),confirmPassiveKeyDrill:true}));
   status('Dual-key receiver challenge verified; actual secret rotation still unproven and not performed.');});
  button(acts,'Original crew: obtain genuine next-key Master digest ACK',async c=>{
   consent('yw596CrewConsent');
   result(await call(c,'original-next-key-canary',{companyId:company(),
    rotationProofId:required('yw596Proof'),priorAckId:required('yw596PriorAck'),
    nextAttemptId:required('yw596NewAttempt'),confirmOriginalDevice:true}));
   status('A distinct original source digest received a signed next-key ACK; private photo not sent.');});
  button(acts,'Original owner: sign consent for this specific witness window',async c=>{
   consent('yw596SlotConsent');
   result(await call(c,'owner-consent-specific-window',{companyId:company(),
    optinId:required('yw596Optin'),slotId:required('yw596Slot'),
    explicitConsent:true}));
   status('Original owner signed specific future-window consent; no cross-tenant scheduling implied yet.');});
  button(acts,'Platform coordinator: load original consent directory',async c=>{
   sysopQueue(await call(c,'sysop-overview'));
   status('Enrolled platform coordinator only; no client/contact/private photos shared.');});
  button(acts,'Platform coordinator: schedule two real nonoverlapping windows',async c=>{
   consent('yw596CoordinatorConsent');
   result(await call(c,'coordinate-two-tenant-windows',{
    consentAId:required('yw596ConsentA'),consentBId:required('yw596ConsentB'),
    confirmIndependentScheduling:true}));
   status('Owner-consented scheduling recorded; this is NOT an actual field witness or Master certification.');});
  button(acts,'SECOND independent Sysop: sign two-tenant Master ACK continuity audit',async c=>{
   consent('yw596AuditConsent');
   result(await call(c,'independent-two-tenant-audit',{
    pairId:required('yw596Pair'),canaryAId:required('yw596CanaryA'),
    canaryBId:required('yw596CanaryB'),confirmIndependentAudit:true}));
   status('Independent two-company original source digest ACK chains audited; hardware NOT certified.');});
  const statusNode=n('p','HOLD · original approved pilots, two signed Master key epochs, two real tenants and distinct platform auditors required');
  statusNode.id='yw596Status';statusNode.setAttribute('role','status');root.append(statusNode);
  const data=n('div');data.id='yw596Result';root.append(data);
  $('jobs').append(root);
 }
 function clear(){
  epoch++;$('yw596Result')?.replaceChildren();
  document.querySelectorAll('#yw596Panel input').forEach(e=>{
   if(e.type==='checkbox')e.checked=false;else e.value='';});
  status('HOLD · original account/workspace changed; private YW596 state cleared.');
 }
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(event,clear);
 window.YW596ReceiverContinuity=Object.freeze({build:'YW596',defaultAuthority:'HOLD',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
