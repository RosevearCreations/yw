/* YW597: real original owner, distinct reviewer and sysop receiver operations.
 * Read-only probes only. Browser NEVER receives keys, photos, secret or cross-tenant info. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const valid=x=>typeof x==='string'&&UUID.test(x);
 const el=(tag,txt)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);return x;};
 const value=id=>$(id)?.value?.trim()||'';
 const state=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,busy=false;
 const setStatus=s=>{if($('yw597Status'))$('yw597Status').textContent=s;};
 const required=id=>{const v=value(id);if(!valid(v))throw Error('Real UUID required: '+id);return v;};
 const company=()=>{const v=value('yw597Company')||value('yw596Company');
  if(!valid(v))throw Error('Select the existing original authorized company UUID');return v;};
 const ack=id=>{if(!$(id)?.checked)throw Error('Explicit original-person consent required: '+id);};
 async function auth(){
  const e=epoch,s=state(),c=client();
  if(s.isAuthenticated!==true||!valid(s.user?.id)||!c?.auth?.getUser||!c?.functions?.invoke)
   throw Error('Sign in with an enrolled original company or platform account');
  const live=await c.auth.getUser();
  if(live.error||live.data?.user?.id!==s.user.id||e!==epoch||
   state().user?.id!==s.user.id)throw Error('Original authenticated session changed');
  return {e,user:s.user.id,c};
 }
 async function invoke(a,action,payload={}){
  if(navigator.onLine===false)throw Error('Active original network and real signed Master required');
  const r=await a.c.functions.invoke('yw597-cutover-rollback-health',
   {body:{action,...payload}});
  if(a.e!==epoch||state().user?.id!==a.user)throw Error('Session changed: private results withheld');
  if(r.error||!r.data||r.data.state==='HOLD')
   throw Error(r.data?.code||'Original receiver authority or signed proof HOLD');
  return r.data;
 }
 async function run(fn){
  if(busy)return;busy=true;const curr=epoch;
  document.querySelectorAll('#yw597Panel button').forEach(x=>x.disabled=true);
  try{await fn(await auth())}catch(e){if(curr===epoch)setStatus('HOLD · '+(e?.message||'Real private evidence unavailable'))}
  finally{if(curr===epoch){busy=false;
   document.querySelectorAll('#yw597Panel button').forEach(x=>x.disabled=false);}}
 }
 function input(parent,id,caption){
  const l=el('label',caption),v=el('input');v.id=id;v.autocomplete='off';v.spellcheck=false;l.append(v);parent.append(l);
 }
 function check(parent,id,caption){
  const l=el('label'),v=el('input');l.className='yw597-ack';
  v.type='checkbox';v.id=id;l.append(v,document.createTextNode(' '+caption));parent.append(l);
 }
 function button(parent,caption,fn){
  const b=el('button',caption);b.type='button';b.addEventListener('click',()=>run(fn));parent.append(b);
 }
 function info(data){
  const out=$('yw597Result');out.replaceChildren();
  for(const [k,v]of Object.entries(data))if(v!==null&&typeof v!=='object'){
   const p=el('p');p.append(el('strong',k+': '),document.createTextNode(String(v)));out.append(p);
  }
 }
 function table(title,rows,cols){
  const out=$('yw597Result');out.append(el('h4',title));
  if(!rows.length){out.append(el('p','No independently verified original record. Field acceptance remains HOLD.'));return;}
  const t=el('table');t.className='yw597-table';
  const head=el('thead'),tr=el('tr');
  cols.forEach(x=>tr.append(el('th',x[1])));head.append(tr);t.append(head);
  const body=el('tbody');
  for(const item of rows){const row=el('tr');cols.forEach(([k])=>row.append(el('td',item[k]??'—')));
   row.addEventListener('click',()=>{
    for(const [key,dest]of [['proofId','yw597Proof'],['canaryId','yw597Canary'],
     ['intentId','yw597Intent'],['rollbackProofId','yw597Rollback'],
     ['cutoverApprovalId','yw597Approval'],['enrollmentId','yw597Enrollment']])
     if(valid(item[key])&&$(dest))$(dest).value=item[key];
   });body.append(row);
  }
  t.append(body);out.append(t);
 }
 function displayQueue(data){
  $('yw597Result').replaceChildren();
  table('Original owner intent and independent human decision',data.intents,
   [['intentId','Cutover intent'],['rollbackProofId','Independent rollback readiness'],
    ['cutoverApprovalId','Manual cutover approval'],['expiresAt','Intent expires UTC']]);
  table('15-minute Master ACK evidence watch (passive)',data.health,
   [['enrollmentId','Watch ID'],['lastVerifiedAt','Last true signed ACK'],
    ['lastEvidenceState','Evidence state'],['expiresAt','Watch expiry']]);
  table('Stale/unverified evidence alerts',data.alerts,
   [['issueCode','Issue'],['detectedAt','Detected UTC'],['enrollmentId','Original watch']]);
 }
 function mount(){
  if($('yw597Panel')||!$('jobs'))return;
  const panel=el('details');panel.id='yw597Panel';panel.className='yw597-panel';
  panel.append(el('summary','YW597 · Manual Master Cutover Authority / Independent Rollback / 15-Minute ACK Watch'));
  panel.append(el('p','This feature authorizes, observes and detects stale evidence only. It does NOT rotate live keys or execute rollback. '+ 
   'Original Master must independently support both new signed read-only challenge protocols. '+ 
   'The database watches signed ACK freshness every 15 minutes; receiver probes are owner-initiated. '+ 
   'No customer actions, cross-company media, automatic operational claims, or hardware certification.'));
  const grid=el('div');grid.className='yw597-grid';panel.append(grid);
  for(const [id,label]of [
   ['yw597Company','Existing real company UUID'],
   ['yw597Proof','Original YW596 signed dual-key proof UUID'],
   ['yw597Canary','Original YW596 next-key source canary ACK UUID'],
   ['yw597Intent','Owner-signed cutover intent UUID'],
   ['yw597Rollback','Independent sysop rollback-readiness proof UUID'],
   ['yw597Approval','Reviewer-signed manual cutover approval UUID'],
   ['yw597Enrollment','Owner-enrolled 15-minute passive health watch UUID']
  ])input(grid,id,label);
  check(panel,'yw597OwnerConsent','I am the ORIGINAL owner authorizing review of this exact, genuinely signed YW596 ACK chain. No receiver key will be changed.');
  check(panel,'yw597SysopConsent','I am an independently enrolled platform sysop; I will run an original pinned HTTPS receiver rollback-READINESS challenge, not a real rollback.');
  check(panel,'yw597ReviewerConsent','I am the DISTINCT independent original reviewer; I sign MANUAL cutover authorization only after independently verified, recent rollback readiness.');
  check(panel,'yw597WatchConsent','As the original company owner, I consent to 7 days of 15-minute passive missing/stale Master ACK evidence checks.');
  check(panel,'yw597ProbeConsent','As the original owner, run a live READ-ONLY signed receiver health challenge. No key changes or source bytes.');
  const actions=el('div');actions.className='yw597-actions';panel.append(actions);
  button(actions,'Owner/reviewer: load private YW597 queue and alerts',async ctx=>{
   displayQueue(await invoke(ctx,'overview',{companyId:company()}));
   setStatus('Original tenant readback loaded. Continuous passive monitoring is separate from remote receiver probes.');});
  button(actions,'Owner: request manual receiver cutover review',async ctx=>{
   ack('yw597OwnerConsent');
   info(await invoke(ctx,'owner-begin-cutover',{companyId:company(),
    dualKeyProofId:required('yw597Proof'),canaryId:required('yw597Canary'),
    confirmOriginalOwnerIntent:true}));
   setStatus('Owner cutover intent stored; no remote cutover executed.');});
  button(actions,'Independent sysop: verify rollback readiness with real Master',async ctx=>{
   ack('yw597SysopConsent');
   info(await invoke(ctx,'sysop-rollback-readiness',{companyId:company(),
    intentId:required('yw597Intent'),confirmReadOnlyRollbackDrill:true}));
   setStatus('Rollback readiness only. Actual rollback not executed or independently attested.');});
  button(actions,'Different original reviewer: authorize MANUAL cutover (not executed)',async ctx=>{
   ack('yw597ReviewerConsent');
   info(await invoke(ctx,'reviewer-authorize-manual-cutover',{companyId:company(),
    intentId:required('yw597Intent'),rollbackProofId:required('yw597Rollback'),
    confirmIndependentManualAuthorization:true}));
   setStatus('Human authorization recorded. The receiver secret and live route remain unchanged.');});
  button(actions,'Owner: enroll 7-day recurring Master ACK freshness watch',async ctx=>{
   ack('yw597WatchConsent');
   info(await invoke(ctx,'owner-enroll-health-watch',{companyId:company(),
    approvalId:required('yw597Approval'),confirmWatchOnly:true}));
   setStatus('15-minute passive watcher enrolled. Active receiver probes remain separately owner initiated.');});
  button(actions,'Owner: actively verify both Master ACK signatures (read only)',async ctx=>{
   ack('yw597ProbeConsent');
   info(await invoke(ctx,'owner-probe-remote-health',{companyId:company(),
    enrollmentId:required('yw597Enrollment'),confirmReadOnlyProbe:true}));
   setStatus('Original signed old/new Master ACK readback verified and stored. No key rotation occurred.');});
  const status=el('p','HOLD · no original signed dual-key canary or authorized real receiver cutover evidence enrolled');
  status.id='yw597Status';status.setAttribute('role','status');panel.append(status);
  const out=el('div');out.id='yw597Result';panel.append(out);
  $('jobs').append(panel);
 }
 function clear(){
  epoch++;$('yw597Result')?.replaceChildren();
  for(const x of document.querySelectorAll('#yw597Panel input'))
   if(x.type==='checkbox')x.checked=false;else x.value='';
  setStatus('HOLD · original account/workspace changed; sensitive context cleared.');
 }
 for(const key of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(key,clear);
 window.YW597Cutover=Object.freeze({build:'YW597',action:'CUTOVER_NOT_EXECUTED',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
