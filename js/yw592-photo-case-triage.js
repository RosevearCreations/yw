/* YW592 — private triage and independent signed reviewer decisions.
 * All controls are current-session authenticated; never render raw photo bytes.
 * No local token, signature secret, private URL or customer information saved. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const session=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let generation=0,busy=false;
 function status(s){const n=$('yw592Status');if(n)n.textContent=s;}
 function field(grid,id,title,initial=''){
  const l=node('label',title),e=node('input');e.id=id;e.type='text';
  e.autocomplete='off';e.value=initial;l.append(e);grid.append(l);
 }
 function choice(grid,id,title,values){
  const l=node('label',title),s=node('select');s.id=id;
  for(const [value,text] of values){const o=node('option',text);o.value=value;s.append(o);}
  l.append(s);grid.append(l);
 }
 function button(parent,text,callback){
  const b=node('button',text);b.type='button';b.addEventListener('click',callback);parent.append(b);
 }
 function company(){const value=$('yw592Company')?.value.trim()||
  $('yw591Company')?.value.trim()||'';
  if(!uuid(value))throw Error('An original authorized company UUID is required');
  return value;
 }
 function attempt(){const value=$('yw592Attempt')?.value.trim()||
  $('yw591Attempt')?.value.trim()||'';
  if(!uuid(value))throw Error('Original private photo attempt UUID required');return value;
 }
 async function identity(){
  const epoch=generation,s=session(),c=client();
  if(s.isAuthenticated!==true||!uuid(s.user?.id)||!c?.functions?.invoke||!c?.auth?.getUser)
   throw Error('Sign in with an existing, active original user account');
  const verify=await c.auth.getUser();
  if(verify?.error||verify?.data?.user?.id!==s.user.id||
   generation!==epoch||session().user?.id!==s.user.id)
   throw Error('Original live Auth session changed');
  return {c,epoch,actor:s.user.id};
 }
 async function invoke(auth,data){
  if(navigator.onLine===false)throw Error('This action requires online original authority');
  const r=await auth.c.functions.invoke('yw592-photo-case-telemetry',{body:data});
  if(auth.epoch!==generation||session().user?.id!==auth.actor)
   throw Error('Account or workspace changed; private response hidden');
  if(r?.error||!r?.data||r.data.state==='HOLD')
   throw Error(r?.data?.code||'Live source custody or reviewer HOLD');
  return r.data;
 }
 async function run(task){
  if(busy)return;busy=true;const version=generation;
  document.querySelectorAll('#yw592Panel button').forEach(b=>b.disabled=true);
  try{const auth=await identity();await task(auth);}
  catch(e){if(version===generation)status('HOLD · '+(e?.message||'Original source unavailable'));}
  finally{if(version===generation){busy=false;
   document.querySelectorAll('#yw592Panel button').forEach(b=>b.disabled=false);}}
 }
 function renderSummary(data){
  const box=$('yw592Result');if(!box)return;box.replaceChildren();
  const fields=['state','proposalId','reviewExpiresAt','retentionUntil','attemptId',
   'receiptId','sourceByteReadbackVerified','masterAckCryptographicallyVerified',
   'independentApprovedTenantCount','originalPhysicalWitnessCertified',
   'noObjectDeletion','serverSigned','sourcePhotoNeverPublished'];
  for(const name of fields){if(!Object.hasOwn(data,name))continue;
   const p=node('p');p.append(node('strong',name+': '),document.createTextNode(String(data[name])));
   box.append(p);}
 }
 function cases(data){
  const box=$('yw592Result');if(!box)return;box.replaceChildren();
  const table=node('table');table.className='yw592-table';
  const head=node('thead'),tr=node('tr');
  for(const title of ['Original attempt','Source state','Triage','Decision','Retention date','Signature'])
   tr.append(node('th',title));
  head.append(tr);table.append(head);
  const body=node('tbody');
  for(const item of data.cases||[]){
   const row=node('tr');const vals=[item.attemptId,item.state,item.caseStatus,
    item.proposedAction||'—',item.retentionUntil||'—',
    item.serverSignatureVerified?'Cryptographically verified':'Not verified'];
   for(const v of vals)row.append(node('td',String(v)));
   row.addEventListener('click',()=>{if(uuid(item.attemptId))$('yw592Attempt').value=item.attemptId;
    if(uuid(item.proposalId))$('yw592Proposal').value=item.proposalId;});
   body.append(row);
  }
  table.append(body);box.append(table);
  if(!(data.cases||[]).length)box.append(node('p',
   'No original company photo attempts. We do not create demonstration records.'));
 }
 function mount(){
  const root=$('jobs');if(!root||$('yw592Panel'))return;
  const d=node('details');d.id='yw592Panel';d.className='yw592-case-panel';
  d.append(node('summary','YW592 · Private Photo Recovery Case Triage & Signed Retention'));
  d.append(node('p','Owner proposes; a distinct, current independent reviewer signs. '+
   'Expiry review never automatically deletes evidence. Master ACK requires a genuine responding receiver.'));
  const grid=node('div');grid.className='yw592-grid';d.append(grid);
  field(grid,'yw592Company','Original company UUID');
  field(grid,'yw592Attempt','Original photo attempt UUID');
  field(grid,'yw592Proposal','Existing owner proposal UUID');
  choice(grid,'yw592Decision','Owner retention / expiry request',[
   ['RETAIN_30_DAYS','Retain for 30 days (reviewed)'],
   ['RETAIN_90_DAYS','Retain for 90 days (reviewed)'],
   ['EXPIRY_REVIEW','Review expiry: no deletion'],
   ['LEGAL_HOLD_REVIEW','Escalate legal/evidence hold: no deletion']]);
  choice(grid,'yw592Reason','Original owner reason',[
   ['CUSTOMER_REQUEST','Customer request'],
   ['ACTIVE_INCIDENT','Active incident'],
   ['NORMAL_EXPIRY','Normal expiry'],
   ['SOURCE_INTEGRITY','Source integrity concern']]);
  const actions=node('div');actions.className='yw592-actions';d.append(actions);
  button(actions,'Owner/reviewer: load private case queue',()=>run(async a=>{
   const result=await invoke(a,{action:'triage',companyId:company()});cases(result);
   status('Source cases read for the original company; unsigned decisions remain pending.');}));
  button(actions,'Owner: propose retention / expiry decision',()=>run(async a=>{
   const result=await invoke(a,{action:'propose',companyId:company(),attemptId:attempt(),
    decision:$('yw592Decision').value,reason:$('yw592Reason').value});
   if(uuid(result.proposalId))$('yw592Proposal').value=result.proposalId;
   renderSummary(result);status('Original owner request recorded. Separate reviewer must sign.');}));
  button(actions,'Independent reviewer: sign source decision',()=>run(async a=>{
   const proposalId=$('yw592Proposal').value.trim();
   if(!uuid(proposalId)||!$('yw592ReviewConsent').checked)
    throw Error('Select original proposal and explicitly confirm independent reviewer check');
   const result=await invoke(a,{action:'sign',companyId:company(),proposalId});
   renderSummary(result);status('Signed server HMAC recorded; no object deleted. Reload cases to verify.');}));
  button(actions,'Original crew: send verified telemetry to Master',()=>run(async a=>{
   if(!$('yw592TelemetryConsent').checked)
    throw Error('Explicitly confirm original source, private metadata-only Master transfer');
   const result=await invoke(a,{action:'forward-telemetry',
    companyId:company(),attemptId:attempt()});
   renderSummary(result);status(result.masterAckCryptographicallyVerified?
    'Master source ACK signature verified and receipt stored.':
    'HOLD · independent Master receipt unconfirmed');}));
  button(actions,'Check independent second-tenant pilot readiness',()=>run(async a=>{
   const result=await invoke(a,{action:'field-readiness',companyId:company()});
   renderSummary(result);status('Physical field certification always requires separate real witnesses.');}));
  const check=(id,text)=>{const l=node('label'),inp=node('input');
   inp.type='checkbox';inp.id=id;l.append(inp,document.createTextNode(' '+text));d.append(l);};
  check('yw592ReviewConsent','I am the original distinct reviewer approving this retention/expiry proposal; no physical witness is implied');
  check('yw592TelemetryConsent','I am the original approved crew member; send only source-verified receipt metadata to the configured Master');
  const s=node('p','HOLD · requires existing approved original owner, reviewer and source records');
  s.id='yw592Status';s.setAttribute('role','status');d.append(s);
  const result=node('div');result.id='yw592Result';d.append(result);
  root.append(d);
 }
 function clear(){
  generation++;$('yw592Result')?.replaceChildren();
  for(const id of ['yw592Company','yw592Attempt','yw592Proposal']){
   const n=$(id);if(n)n.value='';}
  for(const id of ['yw592ReviewConsent','yw592TelemetryConsent']){
   const n=$(id);if(n)n.checked=false;}
  status('HOLD · original session or workspace changed; private case queue cleared.');
 }
 for(const name of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(name,clear);
 window.YW592PhotoCaseTriage=Object.freeze({clear,build:'YW592',defaultAuthority:'HOLD'});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();