/* YW595 independent real original-person pilot workflow. No simulated witness. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const node=(tag,body)=>{const n=document.createElement(tag);if(body!==undefined)n.textContent=String(body);return n;};
 const value=id=>$(id)?.value?.trim()||'';
 const getState=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,busy=false;
 const status=text=>{if($('yw595Status'))$('yw595Status').textContent=text;};
 const company=()=>{const v=value('yw595Company')||value('yw594Company')||value('yw593Company');if(!uuid(v))throw Error('Select a real authorized tenant company UUID');return v;};
 const id=name=>{const v=value(name);if(!uuid(v))throw Error('Original UUID required: '+name);return v;};
 const consent=name=>{if(!$(name)?.checked)throw Error('Confirm actual witnessed action: '+name);};
 async function auth(){
  const e=epoch,s=getState(),c=client();
  if(s.isAuthenticated!==true||!uuid(s.user?.id)||!c?.auth?.getUser||!c?.functions?.invoke)
   throw Error('Sign in using the actual enrolled original account');
  const verification=await c.auth.getUser();
  if(verification.error||verification.data?.user?.id!==s.user.id||e!==epoch||
   getState().user?.id!==s.user.id)throw Error('Authenticated original session changed');
  return {epoch:e,user:s.user.id,client:c};
 }
 async function call(ctx,action,data={}){
  if(navigator.onLine===false)throw Error('Original online signed receiver and private evidence required');
  const response=await ctx.client.functions.invoke('yw595-original-pilot-rotation-fleet',{body:{
   action,...data}});
  if(ctx.epoch!==epoch||getState().user?.id!==ctx.user)
   throw Error('Original account or workspace changed — private results withheld');
  if(response.error||!response.data||response.data.state==='HOLD')
   throw Error(response.data?.code||'Original authority, source proof or deployment HOLD');
  return response.data;
 }
 async function run(fn){
  if(busy)return;busy=true;const start=epoch;
  document.querySelectorAll('#yw595Panel button').forEach(b=>b.disabled=true);
  try{await fn(await auth());}catch(e){if(start===epoch)status('HOLD · '+(e?.message||'Unverified original evidence'));}
  finally{if(start===epoch){busy=false;
   document.querySelectorAll('#yw595Panel button').forEach(b=>b.disabled=false);}}
 }
 function input(parent,id,title,kind='text'){
  const label=node('label',title),f=node('input');
  f.id=id;f.type=kind;f.autocomplete='off';f.spellcheck=false;
  label.append(f);parent.append(label);
 }
 function check(parent,id,title){
  const label=node('label'),f=node('input');f.id=id;f.type='checkbox';
  label.className='yw595-ack';label.append(f,document.createTextNode(' '+title));
  parent.append(label);
 }
 function select(parent,id,title,choices){
  const label=node('label',title),field=node('select');field.id=id;
  for(const [key,text]of choices){const option=node('option',text);option.value=key;field.append(option);}
  label.append(field);parent.append(label);
 }
 function button(parent,title,fn){
  const b=node('button',title);b.type='button';b.addEventListener('click',()=>run(fn));parent.append(b);
 }
 function result(data){
  const out=$('yw595Result');out.replaceChildren();
  for(const [key,val]of Object.entries(data)){
   if(val===null||typeof val==='object')continue;
   const p=node('p');p.append(node('strong',key+': '),document.createTextNode(String(val)));out.append(p);
  }
 }
 function renderRows(title,rows,columns){
  const out=$('yw595Result');out.append(node('h4',title));
  if(!rows?.length){out.append(node('p','No verified original record. HOLD until real evidence is enrolled.'));return;}
  const table=node('table');table.className='yw595-table';
  const head=node('thead'),hr=node('tr');
  for(const [,label]of columns)hr.append(node('th',label));head.append(hr);table.append(head);
  const body=node('tbody');
  for(const item of rows){const tr=node('tr');
   for(const [key]of columns)tr.append(node('td',item[key]??'—'));
   tr.addEventListener('click',()=>{
    const mapping={ceremonyId:'yw595Ceremony',slotId:'yw595Slot',
     closureId:'yw595Closure',rotationId:'yw595Rotation',
     optinId:'yw595FirstOptin'};
    for(const [k,f]of Object.entries(mapping))if(uuid(item[k])&&$(f))$(f).value=item[k];
    if(uuid(item.contractRecordId)){
     const prior=$('yw595Prior'),candidate=$('yw595Candidate');
     if(!prior.value||prior.value===candidate.value)prior.value=item.contractRecordId;
     else if(prior.value!==item.contractRecordId)candidate.value=item.contractRecordId;
    }
   });body.append(tr);
  }
  table.append(body);out.append(table);
 }
 function queue(data){
  $('yw595Result').replaceChildren();
  renderRows('Verified original receiver contract record IDs (select old and new)',data.receiverContracts,
   [['contractRecordId','Database contract record UUID'],['contractId','Signed remote contract ID'],
    ['observedAt','Observed UTC'],['expiresAt','Signed contract expires']]);
  renderRows('Original scheduled human ceremony',data.ceremonies,
   [['ceremonyId','Ceremony'],['slotId','Original slot'],['closureId','Signed closure']]);
  renderRows('Signed Master receiver contract rotation custody (no secret change)',data.rotations,
   [['rotationId','Rotation'],['reviewSigned','Independent review'],['actualSecretRotated','Actual secret changed']]);
  renderRows('Actual tenant owner-opted independent review',data.fleetOptins,
   [['optinId','Opt-in'],['closureId','Verified ceremony']]);
 }
 function mount(){
  if($('yw595Panel')||!$('jobs'))return;
  const root=node('details');root.id='yw595Panel';root.className='yw595-panel';
  root.append(node('summary','YW595 · Supervised Original Device, Receiver Rotation Custody & Two-Tenant Review'));
  root.append(node('p','All actions require actual enrolled accounts and original evidence. '+
   'No remote key change, no simulated second company, no private photo disclosure. '+
   'Browser P-256 evidence is NOT original hardware attestation.'));
  const grid=node('div');grid.className='yw595-grid';
  input(grid,'yw595Company','Original company UUID');
  input(grid,'yw595Slot','YW593 approved original witness slot UUID');
  input(grid,'yw595Ceremony','Supervised ceremony intent UUID');
  input(grid,'yw595Certificate','YW594 independent human certificate UUID');
  input(grid,'yw595Closure','Verified original ceremony closure UUID');
  input(grid,'yw595Prior','Prior signed Master contract record UUID');
  input(grid,'yw595Candidate','New independently signed Master contract record UUID');
  input(grid,'yw595Rotation','Rotation custody proposal UUID');
  input(grid,'yw595FirstOptin','First real tenant owner opt-in UUID');
  input(grid,'yw595SecondOptin','Second DISTINCT real tenant owner opt-in UUID');
  select(grid,'yw595Reason','Receiver rotation custody reason',[
   ['PLANNED_ROTATION','Planned review'],
   ['RECEIVER_CONTRACT_CHANGE','Observed signed receiver contract changed'],
   ['EXPIRED_BASELINE_REVIEW','Old baseline expired: review only']]);
  root.append(grid);
  check(root,'yw595Briefing','As the original owner, I have supervised the real pilot briefing and approve this original field window');
  check(root,'yw595ClosureConsent','As the distinct original reviewer, I personally observed and reviewed genuine YW594 certified field evidence');
  check(root,'yw595RotationConsent','As the original owner, I authorize review-only receiver custody; no secret or live endpoint changes will happen');
  check(root,'yw595RotationReview','As the distinct reviewer, I checked both genuine signed contracts and authorize custody recording ONLY');
  check(root,'yw595FleetConsent','As the original owner, I consent to the separate private two-tenant human-evidence comparison');
  check(root,'yw595SysopConsent','As the independent platform administrator, I reviewed two different real companies and separate original reviewer chains');
  const actions=node('div');actions.className='yw595-actions';
  root.append(actions);
  button(actions,'Owner / reviewer: read original tenant queue',async c=>{
   queue(await call(c,'overview',{companyId:company()}));
   status('Tenant-only readback. No cross-tenant or private media disclosed.');});
  button(actions,'Owner: start supervised original-device pilot ceremony',async c=>{
   consent('yw595Briefing');
   result(await call(c,'begin-ceremony',{companyId:company(),slotId:id('yw595Slot'),confirmBriefing:true}));
   status('Original supervised ceremony opened; genuine distinct human certificate still required.');});
  button(actions,'Independent reviewer: close real human-certified field ceremony',async c=>{
   consent('yw595ClosureConsent');
   result(await call(c,'close-ceremony',{companyId:company(),
    ceremonyId:id('yw595Ceremony'),fieldCertificateId:id('yw595Certificate'),
    attestSupervision:true}));
   status('Verified actual human pilot ceremony. Hardware attestation remains FALSE.');});
  button(actions,'Owner: propose two genuine signed receiver contracts',async c=>{
   consent('yw595RotationConsent');
   result(await call(c,'propose-rotation',{companyId:company(),
    priorContractId:id('yw595Prior'),candidateContractId:id('yw595Candidate'),
    reason:value('yw595Reason'),confirmCustodyOnly:true}));
   status('Receiver rotation CUSTODY proposed; NO live receiver keys or endpoints changed.');});
  button(actions,'Independent reviewer: sign rotation custody only',async c=>{
   consent('yw595RotationReview');
   result(await call(c,'review-rotation',{companyId:company(),
    rotationId:id('yw595Rotation'),attestIndependentReview:true}));
   status('Independent receiver custody review signed. Actual secret rotation remains FALSE.');});
  button(actions,'Owner: explicitly opt in one real company for two-tenant review',async c=>{
   consent('yw595FleetConsent');
   result(await call(c,'optin-two-tenant-review',{companyId:company(),
    closureId:id('yw595Closure'),confirmFleetOptin:true}));
   status('Original owner opt-in signed; no cross-tenant review until second real company consents.');});
  button(actions,'Platform Sysop: view owner-consented original opt-ins',async c=>{
   const d=await call(c,'sysop-overview');
   $('yw595Result').replaceChildren();
   renderRows('Independently opted-in original tenants (Sysop only)',d.optins,
    [['companyId','Original company'],['optinId','Owner consent'],['signedAt','UTC']]);
   status('Only enrolled platform administrator may see this limited cross-tenant directory.');});
  button(actions,'Independent platform Sysop: certify two real tenants',async c=>{
   consent('yw595SysopConsent');
   const first=id('yw595FirstOptin'),second=id('yw595SecondOptin');
   if(first===second)throw Error('Two different original tenant opt-ins required');
   result(await call(c,'sysop-two-tenant-review',
    {firstOptinId:first,secondOptinId:second,confirmIndependentReview:true}));
   status('Human two-tenant evidence reviewed. No fleet-wide hardware certification inferred.');});
  const s=node('p','HOLD · no real approved dual-company original witness or signed receiver rotation yet');
  s.id='yw595Status';s.setAttribute('role','status');root.append(s);
  const results=node('div');results.id='yw595Result';root.append(results);
  $('jobs').append(root);
 }
 function clear(){
  epoch++;
  $('yw595Result')?.replaceChildren();
  for(const x of document.querySelectorAll('#yw595Panel input'))if(x.type==='checkbox')x.checked=false;else x.value='';
  status('HOLD · original auth/workspace changed; private YW595 context cleared.');
 }
 for(const name of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(name,clear);
 window.YW595SupervisedPilot=Object.freeze({build:'YW595',authority:'HOLD',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
