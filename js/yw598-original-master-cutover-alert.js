/* YW598 — original evidence only: remote Master cutover & rollback receipt,
 * separate real human witness, signed source health-alert handoff. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const valid=x=>typeof x==='string'&&UUID.test(x);
 const elt=(type,txt)=>{const x=document.createElement(type);if(txt!==undefined)x.textContent=String(txt);return x;};
 const value=id=>$(id)?.value?.trim()||'';
 const state=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,busy=false;
 const status=text=>{if($('yw598Status'))$('yw598Status').textContent=text;};
 const company=()=>{const x=value('yw598Company')||value('yw597Company');
  if(!valid(x))throw Error('Original authorized company UUID required');return x;};
 const required=id=>{const x=value(id);if(!valid(x))throw Error('Actual source UUID required: '+id);return x;};
 const consent=id=>{if(!$(id)?.checked)throw Error('Explicit original real-person confirmation required: '+id);};
 async function auth(){
  const e=epoch,s=state(),sb=client();
  if(s.isAuthenticated!==true||!valid(s.user?.id)||!sb?.auth?.getUser||!sb?.functions?.invoke)
   throw Error('Sign in to the actual original authorized company or platform account');
  const z=await sb.auth.getUser();
  if(z.error||z.data?.user?.id!==s.user.id||e!==epoch||state().user?.id!==s.user.id)
   throw Error('Original signed-in user changed');
  return {e,user:s.user.id,sb};
 }
 async function invoke(ctx,action,payload){
  if(navigator.onLine===false)throw Error('Online original Master receiver needed');
  const r=await ctx.sb.functions.invoke('yw598-original-cutover-rollback-alert',
   {body:{action,...payload}});
  if(ctx.e!==epoch||state().user?.id!==ctx.user)
   throw Error('Original actor session changed; private evidence withheld');
  if(r.error||!r.data||r.data.state==='HOLD')
   throw Error(r.data?.code||'Original human authority or signed Master HOLD');
  return r.data;
 }
 async function run(callback){
  if(busy)return;busy=true;const start=epoch;
  document.querySelectorAll('#yw598Panel button').forEach(b=>b.disabled=true);
  try{await callback(await auth())}
  catch(e){if(start===epoch)status('HOLD · '+(e?.message||'Genuine source unavailable'))}
  finally{if(epoch===start){busy=false;
   document.querySelectorAll('#yw598Panel button').forEach(b=>b.disabled=false);}}
 }
 function input(parent,id,label){
  const l=elt('label',label),i=elt('input');i.id=id;i.autocomplete='off';i.spellcheck=false;l.append(i);parent.append(l);
 }
 function check(parent,id,label){
  const l=elt('label'),i=elt('input');i.id=id;i.type='checkbox';
  l.className='yw598-ack';l.append(i,document.createTextNode(' '+label));parent.append(l);
 }
 function button(parent,label,fn){
  const b=elt('button',label);b.type='button';b.addEventListener('click',()=>run(fn));parent.append(b);
 }
 function out(obj){
  const parent=$('yw598Result');parent.replaceChildren();
  for(const [k,v]of Object.entries(obj))
   if(v!==null&&typeof v!=='object'){
    const p=elt('p');p.append(elt('strong',k+': '),document.createTextNode(String(v)));parent.append(p);
   }
 }
 function table(title,rows,columns){
  const parent=$('yw598Result');parent.append(elt('h4',title));
  if(!rows.length){parent.append(elt('p','No real signed original record. HOLD until independently witnessed.'));return;}
  const t=elt('table');t.className='yw598-table';
  const h=elt('thead'),r=elt('tr');columns.forEach(x=>r.append(elt('th',x[1])));h.append(r);t.append(h);
  const body=elt('tbody');
  for(const item of rows){
   const tr=elt('tr');for(const [k]of columns)tr.append(elt('td',item[k]??'—'));
   tr.addEventListener('click',()=>{
    for(const [k,id]of [['approvalId','yw598Approval'],['executionId','yw598Execution'],
     ['witnessId','yw598Witness'],['rollbackReceiptId','yw598RollbackReceipt'],
     ['alertId','yw598Alert'],['consentId','yw598Consent']])
     if(valid(item[k])&&$(id))$(id).value=item[k];
   });body.append(tr);
  }
  t.append(body);parent.append(t);
 }
 function queue(data){
  $('yw598Result').replaceChildren();
  table('Signed external Master execution and owner human witness',data.execution,
   [['executionId','Remote execution record'],['approvalId','Original authorization'],
    ['witnessId','Original owner observation']]);
  table('Externally signed rollback and independent reviewer witness',data.rollback,
   [['rollbackReceiptId','Remote rollback record'],['witnessId','Prior owner witness'],
    ['humanRollbackDrillId','Different human reviewer observation']]);
  table('Original owner-approved pinned Master alert handoff',data.alertConsents,
   [['consentId','Real original opt-in'],['signedAt','Signed at UTC']]);
  table('True recorded Master health alerts and signed delivery',data.realAlerts,
   [['alertId','Actual pg_cron alert'],['issueCode','Issue'],['delivered','Master signed delivered']]);
 }
 function mount(){
  if($('yw598Panel')||!$('jobs'))return;
  const panel=elt('details');panel.id='yw598Panel';panel.className='yw598-panel';
  panel.append(elt('summary','YW598 · Real Master Cutover Witness / External Rollback Drill / Signed Health Alert Delivery'));
  panel.append(elt('p',
   'Real Master operator performs cutover/rollback OUTSIDE Yard Workers. '+
   'This panel only retrieves independently signed remote execution proof and separate original human witness. '+
   'Signed health alerts can be sent to the original pinned Master only on explicit owner approval. '+
   'If that Master is unreachable, delivery HOLDS. No automatic remote key changes or customer notices.'));
  const grid=elt('div');grid.className='yw598-grid';panel.append(grid);
  for(const [id,label]of [
   ['yw598Company','Original company UUID'],
   ['yw598Approval','Original YW597 independently signed manual cutover approval UUID'],
   ['yw598Execution','Original Master signed external execution receipt UUID'],
   ['yw598Witness','Original owner physical execution witness UUID'],
   ['yw598RollbackReceipt','Independent Master signed rollback-execution receipt UUID'],
   ['yw598Consent','Original company owner alert-handoff consent UUID'],
   ['yw598Alert','Real YW597 signed Master ACK health alert UUID']
  ])input(grid,id,label);
  check(panel,'yw598MasterExecutionConsent','I am the independent enrolled platform admin. The actual original Master operator has ALREADY performed an externally authorized cutover; read back signed proof only.');
  check(panel,'yw598OwnerPhysicalExecution','As the original owner, I PERSONALLY observed this actual external Master cutover in its approved window; not a simulated/test event.');
  check(panel,'yw598RollbackMasterConsent','I am an independent enrolled platform admin. The original Master operator has ALREADY performed a REAL rollback drill externally; read back its signed proof only.');
  check(panel,'yw598ReviewerRollback','As the DIFFERENT original reviewer, I PERSONALLY witnessed the actual external physical rollback drill and independently confirm what happened.');
  check(panel,'yw598OwnerAlertConsent','As original owner I explicitly opt in to REDACTED Master health-alert handoff through our already pinned HTTPS Master; not email, SMS or customer messages.');
  check(panel,'yw598SendAlertConsent','As original owner I authorize ONE specific real scheduled pg_cron health alert to be sent to our signed pinned Master endpoint now.');
  const actions=elt('div');actions.className='yw598-actions';panel.append(actions);
  button(actions,'Owner/reviewer: show our private real execution and alert queue',async ctx=>{
   queue(await invoke(ctx,'overview',{companyId:company()}));
   status('Original signed tenant-only readback. Hardware/device identity not independently attested.');});
  button(actions,'Independent platform sysop: read ORIGINAL external Master cutover proof',async ctx=>{
   consent('yw598MasterExecutionConsent');
   out(await invoke(ctx,'sysop-read-execution',{companyId:company(),
    approvalId:required('yw598Approval'),confirmExternallyPerformed:true}));
   status('External Master reported signed execution; still requires separate real owner witness.');});
  button(actions,'Original owner: attest PERSONALLY witnessed Master execution',async ctx=>{
   consent('yw598OwnerPhysicalExecution');
   out(await invoke(ctx,'owner-witness-execution',{companyId:company(),
    executionId:required('yw598Execution'),
    confirmPersonallyObservedActualCutover:true}));
   status('Original owner human observation recorded; not independent hardware attestation.');});
  button(actions,'Independent platform sysop: read ORIGINAL external rollback execution',async ctx=>{
   consent('yw598RollbackMasterConsent');
   out(await invoke(ctx,'sysop-read-rollback',{companyId:company(),
    witnessId:required('yw598Witness'),
    confirmExternalPhysicalRollbackAlreadyDone:true}));
   status('Externally signed rollback receipt recorded; different original reviewer must witness.');});
  button(actions,'Original DIFFERENT reviewer: attest personally witnessed rollback',async ctx=>{
   consent('yw598ReviewerRollback');
   out(await invoke(ctx,'reviewer-witness-rollback',{companyId:company(),
    rollbackReceiptId:required('yw598RollbackReceipt'),
    confirmReviewerPersonallyWitnessedRollback:true}));
   status('Signed remote rollback + independent human reviewer observation recorded.');});
  button(actions,'Original owner: explicitly authorize private pinned-Master alerts',async ctx=>{
   consent('yw598OwnerAlertConsent');
   out(await invoke(ctx,'owner-alert-consent',{companyId:company(),
    confirmRedactedPinnedMasterOnly:true}));
   status('Private original Master handoff consent recorded; no alert sent yet.');});
  button(actions,'Original owner: send ONE verified Master ACK alert and confirm signed receipt',async ctx=>{
   consent('yw598SendAlertConsent');
   out(await invoke(ctx,'owner-deliver-health-alert',{companyId:company(),
    consentId:required('yw598Consent'),alertId:required('yw598Alert'),
    confirmDeliverToOriginalMasterOnly:true}));
   status('Original pinned Master signed delivery receipt verified. No customer notification inferred.');});
  const st=elt('p','HOLD · original Master execution/rollback, signed source alert and real distinct human witnesses not yet enrolled');
  st.id='yw598Status';st.setAttribute('role','status');panel.append(st);
  const data=elt('div');data.id='yw598Result';panel.append(data);
  $('jobs').append(panel);
 }
 function clear(){
  epoch++;
  $('yw598Result')?.replaceChildren();
  for(const x of document.querySelectorAll('#yw598Panel input'))if(x.type==='checkbox')x.checked=false;else x.value='';
  status('HOLD · original authenticated account/workspace changed; private proof cleared.');
 }
 for(const key of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(key,clear);
 window.YW598OriginalMaster=Object.freeze({build:'YW598',execution:'EXTERNAL_ONLY',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
