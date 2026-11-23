/* YW590 — physical device ceremony and independently signed technical Shell.
 * Original source read via protected Edge; no client-side impersonated approvals. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const e=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const auth=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,pending=false,reviewHash='',previewBinding='',previewUrl='';
 const buttonIds=['yw590Check','yw590Issue','yw590Preview','yw590Witness',
  'yw590ShellSummary','yw590Close'];
 const status=(surface,msg)=>{const n=$(surface==='shell'?'yw590ShellStatus':'yw590TenantStatus');if(n)n.textContent=msg;};
 const display=(id,result)=>{
  const out=$(id);if(!out)return;out.replaceChildren();
  const allowed=new Set(['state','originalPhotoCount','dispatcherSigned','humanWitnessRecorded',
   'zeroInvoicesAtReadback','financePointInTimeZero','caseOpened','open','closed','total',
   'pointInTimeFinanceIsolation','masterAckVerified','masterDurableAckVerified',
   'machineHardwareAttestation','machineDeviceAttested']);
  for(const [k,v] of Object.entries(result||{})){
   if(!allowed.has(k))continue;
   const p=e('p');p.append(e('strong',k+': '),document.createTextNode(String(v)));out.append(p);
  }
 };
 function clear(){
  epoch++;pending=false;reviewHash='';previewBinding='';
  if(previewUrl&&URL?.revokeObjectURL)URL.revokeObjectURL(previewUrl);
  previewUrl='';
  const img=$('yw590PrivatePreview');if(img){img.hidden=true;img.removeAttribute('src');}
  for(const id of ['yw590ChallengeCode','yw590IssuedChallenge']){const x=$(id);if(x)x.textContent='';}
  for(const id of ['yw590SawDevice','yw590Examined','yw590SysopConfirm','yw590NoNotice']){
   const x=$(id);if(x)x.checked=false;
  }
  for(const id of buttonIds){const x=$(id);if(x)x.disabled=false;}
  for(const id of ['yw590TenantOutput','yw590ShellOutput'])$(id)?.replaceChildren();
  status('tenant','HOLD · real original crew, dispatcher, owner/reviewer and work order required.');
  status('shell','HOLD · only independently observed and source-verified technical cases may close.');
 }
 function allowed(surface){
  const st=auth(),shell=surface==='shell';
  return st.isAuthenticated===true&&uuid(st.user?.id)&&
   (shell?(location.hash==='#sysop'&&
     window.YWIDualWorkspace?.isSysopVerified?.()===true):
    (location.hash!=='#sysop'&&
     document.documentElement.dataset.ywSurface!=='platform'));
 }
 async function verify(surface){
  const run=epoch,id=auth().user?.id,sb=client();
  if(!allowed(surface)||!sb?.functions?.invoke||!sb?.auth?.getUser)
   throw Error('Current original authenticated '+surface+' account required');
  const u=await sb.auth.getUser();
  if(u.error||u.data?.user?.id!==id||epoch!==run||!allowed(surface))
   throw Error('Session changed; previous acceptance void');
  return {sb,id,run,surface};
 }
 const safe=a=>epoch===a.run&&auth().user?.id===a.id&&allowed(a.surface);
 const job=surface=>{const id=$(surface==='shell'?'yw590ShellJob':'yw590Job')?.value.trim()||'';
  if(!uuid(id))throw Error('Enter an existing original work-order UUID');return id;};
 const photo=surface=>{const id=$(surface==='shell'?'yw590ShellPhoto':'yw590Photo')?.value.trim()||'';
  if(!uuid(id))throw Error('Enter the original private photo receipt UUID');return id;};
 async function call(a,body){
  const x=await a.sb.functions.invoke('yw589-original-device-photo',{body});
  if(x.error)throw Error('Original live service rejected this action or source authority is unavailable');
  if(x.data?.state==='HOLD')throw Error(x.data.code||'Source acceptance HOLD');
  if(!safe(a))throw Error('Authentication or active workspace changed during request');
  return x.data;
 }
 async function execute(surface,fn){
  if(pending)return;
  pending=true;const run=epoch;
  for(const id of buttonIds){const x=$(id);if(x)x.disabled=true;}
  try{const a=await verify(surface);if(!safe(a))throw Error('Session no longer current');await fn(a);}
  catch(err){if(run===epoch)status(surface,'HOLD · '+(err?.message||'Live receipt unavailable'));}
  finally{if(run===epoch){pending=false;for(const id of buttonIds){const x=$(id);if(x)x.disabled=false;}}}
 }
 const bytesToHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
 const sha256=async buffer=>bytesToHex(await crypto.subtle.digest('SHA-256',buffer));
 function updatePhoto(result){if(uuid(result?.originalPhotoId))$('yw590Photo').value=result.originalPhotoId;}
 const check=()=>execute('tenant',async a=>{
  const result=await call(a,{action:'590:readiness',jobId:job('tenant')});
  updatePhoto(result);display('yw590TenantOutput',result);
  status('tenant','Original source readback complete. Human observed device and technical Shell closure are separately gated.');
 });
 const challenge=()=>execute('tenant',async a=>{
  const result=await call(a,{action:'590:crew-challenge',jobId:job('tenant'),photoId:photo('tenant')});
  const id=$('yw590IssuedChallenge'),code=$('yw590ChallengeCode');
  if(id)id.textContent=result.challengeId||'';
  if(code)code.textContent=result.challengeCode||'';
  status('tenant','Original crew challenge issued for 10 minutes. Show the code directly on the crew device to a DIFFERENT real reviewer; do not publish it.');
 });
 const preview=()=>execute('tenant',async a=>{
  const jobId=job('tenant'),photoId=photo('tenant');
  const result=await call(a,{action:'590:witness-preview',jobId,photoId});
  if(!(result instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(result.type))
   throw Error('Original private photo not available to independent reviewer');
  const observed=await sha256(await result.arrayBuffer());
  if(!safe(a))throw Error('Reviewer session changed');
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  previewUrl=URL.createObjectURL(result);
  const img=$('yw590PrivatePreview');if(img){img.src=previewUrl;img.hidden=false;}
  reviewHash=observed;
  previewBinding=a.id+':'+jobId+':'+photoId;
  status('tenant','Authenticated reviewer opened the private bytes and calculated SHA-256. Compare against the original crew device before attesting.');
 });
 const witness=()=>execute('tenant',async a=>{
  const jobId=job('tenant'),photoId=photo('tenant');
  if(previewBinding!==a.id+':'+jobId+':'+photoId||!reviewHash||
     $('yw590SawDevice')?.checked!==true||$('yw590Examined')?.checked!==true)
   throw Error('Independent reviewer must preview the exact private photo and actually observe the original crew device');
  const challengeId=$('yw590ChallengeInput')?.value.trim();
  const challengeCode=$('yw590CodeInput')?.value.trim().toLowerCase();
  if(!uuid(challengeId)||!/^[a-f0-9]{32}$/.test(challengeCode))
   throw Error('Enter the original crew device challenge ID and 32-hex-character code');
  const result=await call(a,{action:'590:witness',jobId,photoId,challengeId,challengeCode,
   observedSha256:reviewHash,sawOriginalCrewDevice:true,reviewedPrivatePhoto:true});
  display('yw590TenantOutput',result);
  status('tenant','Human observation statement registered with original hashes and dispatcher receipt; independent platform Sysop must still close the technical case. Hardware device attestation is not implied.');
 });
 const shellSummary=()=>execute('shell',async a=>{
  const result=await call(a,{action:'590:shell-summary'});
  display('yw590ShellOutput',result);
  status('shell','Read-only redacted technical counters verified. No customer, photo bytes or company finances enter the Shell.');
 });
 const close=()=>execute('shell',async a=>{
  const jobId=job('shell'),photoId=photo('shell');
  if($('yw590SysopConfirm')?.checked!==true||$('yw590NoNotice')?.checked!==true)
   throw Error('Independent Sysop must explicitly verify technical incident recovery and unchanged customer notification status');
  const result=await call(a,{action:'590:close',jobId,photoId,confirmTechnicalRecovery:true,confirmNoCustomerNotice:true});
  display('yw590ShellOutput',result);
  status('shell','Original technical case CLOSED with live source-hash and zero-invoice snapshot. No customer data, financial postings, Master ACK or machine device attestation was created.');
 });
 function field(host,label,id,placeholder=''){
  const outer=e('label',label),inp=e('input');inp.id=id;inp.type='text';inp.placeholder=placeholder;
  inp.autocomplete='off';outer.append(inp);host.append(outer);return inp;
 }
 function boxField(host,text,id){const l=e('label'),b=e('input');b.type='checkbox';b.id=id;l.append(b,document.createTextNode(' '+text));host.append(l);return b;}
 function btn(host,text,id,action){const b=e('button',text);b.id=id;b.type='button';b.addEventListener('click',action);host.append(b);}
 function tenant(){
  const host=$('jobs');if(!host||$('yw590Panel'))return;
  const d=e('details');d.id='yw590Panel';d.className='yw590-evidence';
  d.append(e('summary','YW590 · Real original device witness & dispatcher-certified recovery'));
  d.append(e('p','Rosevear Landscaping TEST ONLY. Requires YW589 real private photo + separate original dispatcher, active owner-approved witness and independently signed-in crew. No demo click certifies hardware.'));
  const form=e('div');form.className='yw590-grid';
  field(form,'Existing original work order UUID','yw590Job','Rosevear approved zero-charge job');
  field(form,'YW589 private photo receipt UUID','yw590Photo','Original private photo ID');
  btn(form,'Read original recovery state','yw590Check',check);
  btn(form,'Crew: generate 10-minute device challenge','yw590Issue',challenge);
  const secret=e('p','Crew only · challenge: ');secret.append(e('code'));secret.lastChild.id='yw590ChallengeCode';form.append(secret);
  const label=e('p','Challenge ID: ');label.append(e('code'));label.lastChild.id='yw590IssuedChallenge';form.append(label);
  btn(form,'Independent reviewer: privately inspect stored photo','yw590Preview',preview);
  const img=e('img');img.id='yw590PrivatePreview';img.alt='Private original job photograph for authorized reviewer';img.hidden=true;form.append(img);
  field(form,'Challenge ID observed on original crew device','yw590ChallengeInput','Original 10-minute challenge UUID');
  field(form,'Challenge code observed on original crew device','yw590CodeInput','32 hex characters, shown by crew');
  boxField(form,'I personally observed the real original crew device, not a screenshot or mock','yw590SawDevice');
  boxField(form,'I examined the authenticated private job photo on my separate reviewer device','yw590Examined');
  btn(form,'Reviewer: record live human device-witness claim','yw590Witness',witness);
  d.append(form);
  const s=e('p','HOLD · authorized original crew, separate dispatcher and human reviewer required.');s.id='yw590TenantStatus';s.setAttribute('role','status');d.append(s);
  const o=e('div');o.id='yw590TenantOutput';d.append(o);host.append(d);
 }
 function shell(){
  const host=$('yw584Sysop')||$('sysop');if(!host||$('yw590ShellPanel'))return;
  const d=e('details');d.id='yw590ShellPanel';d.className='yw590-evidence';
  d.append(e('summary','YW590 · Original photo technical case & financial-isolation closure'));
  d.append(e('p','Platform operator only. Redacted case counts, independently source-verified technical close. Cannot view customer/private photo/invoices or create payment entries.'));
  const form=e('div');form.className='yw590-grid';
  btn(form,'Read redacted live technical case counts','yw590ShellSummary',shellSummary);
  field(form,'Original authorized job UUID (case handoff)','yw590ShellJob');
  field(form,'Original private photo receipt UUID (case handoff)','yw590ShellPhoto');
  boxField(form,'I independently reviewed the original crew/dispatcher/witness recovery','yw590SysopConfirm');
  boxField(form,'The work order remains zero charge and no customer notification was sent','yw590NoNotice');
  btn(form,'Close original source-verified technical case','yw590Close',close);
  d.append(form);
  const s=e('p','HOLD · independent source receipts required.');s.id='yw590ShellStatus';s.setAttribute('role','status');d.append(s);
  const out=e('div');out.id='yw590ShellOutput';d.append(out);host.append(d);
 }
 function mount(){tenant();shell();clear();}
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed',
  'ywi:company-service-offering-changed','ywi:module-permissions-changed'])
  document.addEventListener(event,clear);
 window.addEventListener('hashchange',clear);
 window.YW590FieldAcceptance=Object.freeze({clear,state:()=>({
  machineHardwareAttestation:false,masterAckVerified:false,financialWrites:false,
  realHumanWitnessRequiresOriginalIndependentAuth:true})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
