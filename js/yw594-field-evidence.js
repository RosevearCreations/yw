/* YW594 browser: P-256 transient crew proof, owner co-presence, independent review.
 * No token, private key, photo bytes or identities persisted to disk. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),uuid=x=>typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
 const value=id=>$(id)?.value.trim()||'';
 const identity=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let generation=0,busy=false,issued=null;
 const setStatus=s=>{if($('yw594Status'))$('yw594Status').textContent=s;};
 const company=()=>{const v=value('yw594Company')||value('yw593Company')||value('yw592Company');
  if(!uuid(v))throw Error('Select a real original company UUID');return v;};
 const required=id=>{const v=value(id);if(!uuid(v))throw Error('Valid original UUID required: '+id);return v;};
 const check=id=>{if(!$(id)?.checked)throw Error('Explicit human confirmation required: '+id);};
 function field(root,id,title){const label=node('label',title),input=node('input');
  input.id=id;input.type='text';input.autocomplete='off';input.spellcheck=false;
  label.append(input);root.append(label);}
 function checkbox(root,id,title){const label=node('label'),input=node('input');
  input.type='checkbox';input.id=id;label.append(input,document.createTextNode(' '+title));
  root.append(label);}
 async function authorized(){
  const epoch=generation,s=identity(),sb=client();
  if(s.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.functions?.invoke)
   throw Error('Existing original active account login required');
  const verification=await sb.auth.getUser();
  if(verification.error||verification.data?.user?.id!==s.user.id||generation!==epoch||
   identity().user?.id!==s.user.id)throw Error('Original user session changed');
  return {epoch,actor:s.user.id,sb};
 }
 async function invoke(a,body){
  if(navigator.onLine===false)throw Error('Original online server receipt required');
  const r=await a.sb.functions.invoke('yw594-field-evidence-drift',{body});
  if(a.epoch!==generation||identity().user?.id!==a.actor)
   throw Error('Original user/workspace changed; evidence withheld');
  if(r.error||!r.data||r.data.state==='HOLD')throw Error(r.data?.code||'Original authority or source HOLD');
  return r.data;
 }
 async function run(fn){
  if(busy)return;busy=true;const start=generation;
  document.querySelectorAll('#yw594Panel button').forEach(b=>b.disabled=true);
  try{await fn(await authorized());}
  catch(e){if(generation===start)setStatus('HOLD · '+(e?.message||'Unknown original source error'));}
  finally{if(generation===start){busy=false;
   document.querySelectorAll('#yw594Panel button').forEach(b=>b.disabled=false);}}
 }
 function button(root,label,fn){const b=node('button',label);b.type='button';
  b.addEventListener('click',()=>run(fn));root.append(b);}
 function summary(data){
  const out=$('yw594Result');if(!out)return;out.replaceChildren();
  for(const [key,val]of Object.entries(data)){
   if(val===null||typeof val==='object')continue;
   if(['message','nonce','signature','token'].includes(key))continue;
   const line=node('p');line.append(node('strong',key+': '),document.createTextNode(String(val)));
   out.append(line);
  }
 }
 function queue(data){
  const out=$('yw594Result');if(!out)return;out.replaceChildren();
  function table(title,rows,columns){
   out.append(node('h4',title));
   if(!rows.length){out.append(node('p','No original enrolled evidence; no demo receipt is created.'));return;}
   const tbl=node('table');tbl.className='yw594-table';
   const h=node('thead'),tr=node('tr');for(const [,heading]of columns)tr.append(node('th',heading));
   h.append(tr);tbl.append(h);const body=node('tbody');
   for(const item of rows){const r=node('tr');for(const [key]of columns)
    r.append(node('td',item[key]===null?'—':String(item[key]??'—')));
    r.addEventListener('click',()=>{if(uuid(item.proofId))$('yw594Proof').value=item.proofId;
     if(uuid(item.slotId))$('yw594Slot').value=item.slotId;});
    body.append(r);
   }
   tbl.append(body);out.append(tbl);
  }
  table('Original crew browser challenge and owner observation',data.attendance||[],
   [['slotId','Window'],['proofId','Proof'],['signedAt','Crew signed'],
    ['ownerObservationId','Owner co-presence'],['independentCertificateId','Independent certificate']]);
  table('Current signed receiver observations (not Master ACKs)',data.receiverDrift||[],
   [['finding','Result'],['observedAt','Observed UTC'],['alertId','Record ID']]);
  const p=node('p','Physical hardware is not attested by these browser receipts. '+
   'Human certification requires separate owner and reviewer observations and original Master ACK.');
  out.append(p);
 }
 async function crewProof(a){
  if(!issued||issued.actor!==a.actor||issued.company!==company()||
   Date.now()>=Date.parse(issued.expiresAt))throw Error('Issue a fresh original crew challenge on this same session');
  if(!window.crypto?.subtle)throw Error('Browser P-256 WebCrypto unavailable');
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const publicJwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  const raw=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,
   new TextEncoder().encode(issued.message));
  const signature=btoa(String.fromCharCode(...new Uint8Array(raw)))
   .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const result=await invoke(a,{action:'submit-attendance',companyId:company(),
   challengeId:issued.challengeId,publicJwk,signature});
  issued=null;if(uuid(result.proofId))$('yw594Proof').value=result.proofId;
  summary(result);setStatus('Original crew P-256 browser signature verified. NOT hardware attested or field certified.');
 }
 function mount(){
  if($('yw594Panel')||!$('jobs'))return;
  const root=node('details');root.id='yw594Panel';root.className='yw594-panel';
  root.append(node('summary','YW594 · Original Field Attendance, Independent Certificate & Receiver Drift'));
  root.append(node('p','Three independent real human accounts: original crew signs an 8-minute browser challenge '+
   'during the approved field window, owner records actual co-presence, and distinct reviewer certifies only '+
   'after live original photo bytes, Master ACK, and signed receiver compatibility are reverified. '+
   'Browser cryptography does NOT establish hardware identity.'));
  const grid=node('div');grid.className='yw594-grid';
  field(grid,'yw594Company','Original company UUID');
  field(grid,'yw594Slot','YW593 approved witness window UUID');
  field(grid,'yw594Proof','Crew attendance proof UUID');
  root.append(grid);
  checkbox(root,'yw594OwnerConfirm','As the original owner, I personally observed the crew and original device during this witness window');
  checkbox(root,'yw594ReviewerConfirm','As the independent reviewer, I personally witnessed the original crew/device and approve human field certification; this is not hardware attestation');
  checkbox(root,'yw594DriftConfirm','As the original owner, I authorize this live pinned receiver contract check');
  const actions=node('div');actions.className='yw594-actions';root.append(actions);
  button(actions,'Owner / reviewer: read private evidence queue',async a=>{
   const result=await invoke(a,{action:'overview',companyId:company()});
   queue(result);setStatus('Tenant-scoped evidence read; no other tenant or private photo exposed.');});
  button(actions,'Original crew: issue eight-minute device-session challenge',async a=>{
   const c=company(),result=await invoke(a,{action:'issue-attendance',companyId:c,
    slotId:required('yw594Slot')});
   issued={actor:a.actor,company:c,challengeId:result.challengeId,message:result.message,
    expiresAt:result.expiresAt};summary(result);
   setStatus('Temporary browser-only challenge issued. Sign on this original active crew session.');});
  button(actions,'Original crew: sign attendance on this device',crewProof);
  button(actions,'Owner: attest observed real crew / device co-presence',async a=>{
   check('yw594OwnerConfirm');
   const result=await invoke(a,{action:'owner-observe',companyId:company(),
    proofId:required('yw594Proof'),attestCoPresence:true});
   summary(result);setStatus('Owner observation recorded; independent reviewer remains required.');});
  button(actions,'Owner: check signed Master receiver contract drift',async a=>{
   check('yw594DriftConfirm');
   const result=await invoke(a,{action:'check-contract-drift',companyId:company()});
   summary(result);setStatus(result.finding==='MATCH'?
    'Signed latest receiver contract matches original baseline; NOT a Master ACK.':
    'HOLD · signed local receiver anomaly requires owner investigation.');});
  button(actions,'Independent reviewer: certify human-attested field evidence',async a=>{
   check('yw594ReviewerConfirm');
   const result=await invoke(a,{action:'reviewer-certify',companyId:company(),
    proofId:required('yw594Proof'),attestInPerson:true});
   summary(result);setStatus('Independent HUMAN field certificate recorded; hardware not attested.');});
  const s=node('p','HOLD · original enrolled pilot, field window, separate real actors, private bytes and signed receiver required');
  s.id='yw594Status';s.setAttribute('role','status');root.append(s);
  const out=node('div');out.id='yw594Result';root.append(out);
  $('jobs').append(root);
 }
 function clear(){
  generation++;issued=null;
  $('yw594Result')?.replaceChildren();
  for(const id of ['yw594Company','yw594Slot','yw594Proof'])if($(id))$(id).value='';
  for(const id of ['yw594OwnerConfirm','yw594ReviewerConfirm','yw594DriftConfirm'])
   if($(id))$(id).checked=false;
  setStatus('HOLD · original auth/workspace changed; browser challenge and private UI cleared.');
 }
 for(const n of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(n,clear);
 window.YW594FieldEvidence=Object.freeze({build:'YW594',defaultAuthority:'HOLD',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
