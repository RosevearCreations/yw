/* YW591: explicit opt-in, AES-GCM encrypted original-file continuity.
   No plaintext photos, access tokens, service keys or customer notes in
   IndexedDB. Key is non-extractable and stored only in same-origin IDB.
   No unattended auto-send, customer notification, or offline Auth bypass. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const make=(tag,s)=>{const x=document.createElement(tag);if(s!==undefined)x.textContent=s;return x;};
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9]{12}$/i.test(x);
 const hex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
 const hash=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
 const state=()=>window.YWI_AUTH?.getState?.()||{};
 const sb=()=>window.YWI_SB||window._sb;
 let generation=0,busy=false,dbPromise=null;
 const timeout=24*60*60*1000,dbName='yw591-private-encrypted-photo-v1';
 const out=x=>{const el=$('yw591Result');if(!el)return;el.replaceChildren();
  const safe=['state','serverVerified','requestId','verifiedByteCount','recoveredAfterRetry',
   'idempotentReplay','companyBound','originalAttemptCount','resumableByOriginalCrew',
   'confirmedReceipt','pilotApproved','role','reviewerActionRequired',
   'realStaffApprovalRequired','offlineBytesOnServer','sourceObjectRetained'];
  for(const k of safe){if(Object.hasOwn(x||{},k)){const p=make('p');p.append(make('b',k+': '),document.createTextNode(String(x[k])));el.append(p);}}
 };
 function message(text){const e=$('yw591Status');if(e)e.textContent=text;}
 const actor=()=>state().user?.id;
 async function verified(){
  const epoch=generation,auth=state(),client=sb();
  if(auth.isAuthenticated!==true||!uuid(auth.user?.id)||
    !client?.functions?.invoke||!client?.auth?.getUser)
   throw Error('Sign in with the genuine original owner, reviewer or crew account');
  const r=await client.auth.getUser();
  if(r?.error||r?.data?.user?.id!==auth.user.id||
    epoch!==generation||state().user?.id!==auth.user.id||
    state().isAuthenticated!==true)
   throw Error('Current user session changed; nothing sent');
  return {epoch,id:auth.user.id,client};
 }
 async function invoke(a,data){
  if(navigator.onLine===false)throw Error('Offline: encrypted local queue only; live authority unavailable');
  const r=await a.client.functions.invoke('yw591-photo-recovery',{body:data});
  if(a.epoch!==generation||actor()!==a.id)throw Error('Session changed after request');
  if(r?.error||!r?.data||r.data.state==='HOLD')
   throw Error(r?.data?.code||'Live source approval, entitlement or private receipt HOLD');
  return r.data;
 }
 function get(ids){const names={companyId:'yw591Company',jobId:'yw591Job',
  clientId:'yw591Client',siteId:'yw591Site',reviewerUserId:'yw591Reviewer',
  staffUserId:'yw591Staff',requestId:'yw591Request'};
  const data={};for(const k of ids){data[k]=$(names[k])?.value.trim()||'';if(!uuid(data[k]))
    throw Error('An existing, authorized '+k+' UUID is required');}return data;
 }
 async function run(f){
  if(busy)return;busy=true;
  for(const b of document.querySelectorAll('#yw591Panel button'))b.disabled=true;
  const v=generation;
  try{const a=await verified();await f(a);}
  catch(err){if(v===generation)message('HOLD · '+(err?.message||'Original proof unavailable'));}
  finally{if(v===generation){busy=false;for(const b of document.querySelectorAll('#yw591Panel button'))b.disabled=false;}}
 }
 function controls(){
  const e=$('yw591Panel');if(!e)return;
  for(const [title,id,value] of [
   ['Original company UUID','yw591Company',''],['Original zero-charge work order UUID','yw591Job',''],
   ['Existing client UUID','yw591Client',''],['Existing client-site UUID','yw591Site',''],
   ['Independent reviewer existing Auth UUID','yw591Reviewer',''],
   ['Existing staff Auth UUID','yw591Staff',''],['Original transfer request UUID','yw591Request','']]){
   const l=make('label',title),v=make('input');v.id=id;v.type='text';v.autocomplete='off';v.value=value;
   l.append(v);e.querySelector('.yw591-grid').append(l);
  }
 }
 async function openDB(){
  if(!('indexedDB'in window)||!crypto?.subtle||!window.isSecureContext)
   throw Error('Encrypted offline storage requires secure browser IndexedDB and WebCrypto');
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const r=indexedDB.open(dbName,1);
   r.onupgradeneeded=()=>{
    const d=r.result;if(!d.objectStoreNames.contains('secure'))
     d.createObjectStore('secure',{keyPath:'id'});
   };
   r.onsuccess=()=>resolve(r.result);
   r.onerror=()=>reject(Error('Private device storage unavailable'));
  });
  return dbPromise;
 }
 async function dbRead(key){
  const db=await openDB();return new Promise((resolve,reject)=>{
   const tx=db.transaction('secure','readonly');
   const q=tx.objectStore('secure').get(key);
   q.onsuccess=()=>resolve(q.result?.value||null);
   q.onerror=()=>reject(Error('Encrypted record read failed'));
  });
 }
 async function dbWrite(key,value){
  const db=await openDB();return new Promise((resolve,reject)=>{
   const tx=db.transaction('secure','readwrite');
   tx.objectStore('secure').put({id:key,value});
   tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Encrypted device save failed'));
  });
 }
 async function dbDelete(key){
  const db=await openDB();return new Promise((resolve,reject)=>{
   const tx=db.transaction('secure','readwrite');
   tx.objectStore('secure').delete(key);
   tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Device evidence purge failed'));
  });
 }
 async function clearPending(){
  try{await dbDelete('pending');await dbDelete('key');}catch(_){
   // Device may be inaccessible; refuse to claim successful purge.
   message('HOLD · Verify private device storage clearance in browser settings');
  }
 }
 async function keyForDevice(){
  let key=await dbRead('key');
  if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
   await dbWrite('key',key);}return key;
 }
 async function queueEncrypted(file,meta,auth){
  if(file.size>10485760||file.size<16||
    !['image/png','image/jpeg','image/webp'].includes(file.type))
   throw Error('Only one original JPEG, PNG or WebP up to 10 MB');
  const b=await file.arrayBuffer(),digest=await hash(b);
  const current=await dbRead('pending');
  if(current)throw Error('Clear or deliver the previous encrypted file before a second one');
  const key=await keyForDevice(),nonce=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,b);
  await dbWrite('pending',{actorId:auth.id,companyId:meta.companyId,jobId:meta.jobId,
   requestId:meta.requestId,sha256:digest,mime:file.type,nonce:Array.from(nonce),
   ciphertext:encrypted,createdAt:Date.now()});
  return digest;
 }
 async function readEncrypted(meta,auth){
  const rec=await dbRead('pending');
  if(!rec)throw Error('No locally encrypted original photo is waiting');
  if(rec.actorId!==auth.id||rec.companyId!==meta.companyId||
    rec.jobId!==meta.jobId||rec.requestId!==meta.requestId)
   throw Error('Pending encrypted photo belongs to a different real account or job');
  if(Date.now()-rec.createdAt>timeout||rec.createdAt>Date.now()+60000){
   await clearPending();throw Error('Offline photo expired; capture a new consented image');}
  const key=await dbRead('key');if(!key)throw Error('Device encryption key missing; cannot recover photo');
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(rec.nonce)},
   key,rec.ciphertext);
  if(await hash(bytes)!==rec.sha256)
   throw Error('Decrypted offline photo hash mismatch: transfer prohibited');
  return {file:new File([bytes],'original-private.'+(rec.mime==='image/png'?'png':
   rec.mime==='image/webp'?'webp':'jpg'),{type:rec.mime}),sha:rec.sha256};
 }
 function originalForm(meta,file,digest){
  const form=new FormData();const values={...meta,action:'capture',
   deviceSha256:digest,consent:'true',consentScope:'private_original_job'};
  for(const [k,v] of Object.entries(values))form.set(k,String(v));
  form.set('photo',file);return form;
 }
 async function upload(file,meta,a,digest){
  const received=await invoke(a,originalForm(meta,file,digest));
  if(received.serverVerified!==true)
   throw Error('Server did not confirm downloaded private source bytes');
  await clearPending();out(received);
  message('Verified private server hash and immutable original receipt. No public URL or customer notification.');
 }
 async function beginCapture(){
  await run(async a=>{
   const meta=get(['companyId','jobId','requestId']),file=$('yw591File')?.files?.[0];
   if(!file||$('yw591Consent')?.checked!==true)
    throw Error('Choose an original image and explicitly consent to private documentation');
   if(file.size>10485760||file.size<16||!['image/jpeg','image/png','image/webp'].includes(file.type))
    throw Error('Only JPEG/PNG/WebP private images up to 10 MB');
   if(!crypto?.subtle||!window.isSecureContext)throw Error('Secure browser hashing required');
   const optIn=$('yw591Offline')?.checked===true;
   if(navigator.onLine===false&&!optIn)throw Error('Offline. Opt in to encrypted device storage before capturing');
   if(optIn){const d=await queueEncrypted(file,meta,a);
    if(navigator.onLine===false){message('Offline: consented private photo encrypted on this device. Reconnect and press Send encrypted pending.');return;}
    await upload(file,meta,a,d);return;}
   const d=await hash(await file.arrayBuffer());await upload(file,meta,a,d);
  });
 }
 async function sendPending(){
  await run(async a=>{
   const meta=get(['companyId','jobId','requestId']);
   const item=await readEncrypted(meta,a);
   if($('yw591Consent')?.checked!==true)throw Error('Reconfirm photo consent before network transfer');
   await upload(item.file,meta,a,item.sha);
  });
 }
 async function requestRecovery(){
  await run(async a=>{const x=get(['companyId','jobId','requestId']);
   const r=await invoke(a,{action:'resume',...x});
   if(r.serverVerified)await clearPending();
   out(r);message(r.serverVerified?'Original private Storage object reconciled with immutable receipt.':
    'Original private object not on server; use the still encrypted offline file to retry.');});
 }
 async function act(action,ids=[]){
  await run(async a=>{const data=get(['companyId',...ids]);
   const r=await invoke(a,{action,...data});
   out(r);message('Live source response: '+r.state+
    '. Independent approval and owner/tenant boundaries remain enforced.');});
 }
 function labelCheck(container,id,text){
  const l=make('label');const inp=make('input');inp.id=id;inp.type='checkbox';
  l.append(inp,document.createTextNode(' '+text));container.append(l);
 }
 function button(container,id,text,handler){
  const b=make('button',text);b.id=id;b.type='button';b.addEventListener('click',handler);container.append(b);
 }
 function mount(){
  const jobs=$('jobs');if(!jobs||$('yw591Panel'))return;
  const d=make('details');d.id='yw591Panel';d.className='yw591-recovery';
  d.append(make('summary','YW591 · Encrypted Offline Photo, Safe Retry & Owner-Approved Pilot'));
  d.append(make('p','One real zero-charge original work order per opted-in company. Existing user UUIDs only; separate owner, reviewer and crew. Existing YW589/YW590 Rosevear pilot remains unchanged.'));
  const grid=make('div');grid.className='yw591-grid';d.append(grid);jobs.append(d);controls();
  const role=make('label','Staff role');const select=make('select');select.id='yw591StaffRole';
  for(const name of ['crew','dispatcher']){const o=make('option',name);o.value=name;select.append(o);}
  role.append(select);grid.append(role);
  const fileLabel=make('label','Consent-based original photo');
  const file=make('input');file.id='yw591File';file.type='file';
  file.accept='image/jpeg,image/png,image/webp';file.setAttribute('capture','environment');
  fileLabel.append(file);grid.append(fileLabel);
  labelCheck(grid,'yw591Consent','I consent to private original-job documentation on this existing work order');
  labelCheck(grid,'yw591Offline','Opt in: save this photo encrypted on this device for manual offline retry (maximum 24 hours)');
  const actions=make('div');actions.className='yw591-actions';d.append(actions);
  button(actions,'yw591StatusBtn','Check my pilot role/status',()=>act('pilot-status'));
  button(actions,'yw591Propose','Owner: propose original pilot',()=>act('pilot-propose',['clientId','siteId','jobId','reviewerUserId']));
  button(actions,'yw591Approve','Different reviewer: approve pilot',()=>act('pilot-approve'));
  button(actions,'yw591Revoke','Owner/reviewer: revoke pilot',()=>act('pilot-revoke'));
  button(actions,'yw591Nominate','Owner: nominate real staff',()=>act('staff-nominate',['staffUserId']));
  button(actions,'yw591StaffApprove','Reviewer: approve nominated staff',()=>act('staff-approve',['staffUserId']));
  button(actions,'yw591StaffRevoke','Owner/reviewer: revoke staff',()=>act('staff-revoke',['staffUserId']));
  button(actions,'yw591Capture','Capture/upload consented private image',beginCapture);
  button(actions,'yw591Send','Send encrypted pending after reconnect',sendPending);
  button(actions,'yw591Reconcile','Recheck original server object / recover orphan',requestRecovery);
  button(actions,'yw591Clear','Discard encrypted offline file',()=>run(async()=>{await clearPending();message('Device-local pending photo purged; no server photo deleted.');}));
  for(const id of ['yw591Nominate','yw591StaffApprove','yw591StaffRevoke']){
   $(id)?.addEventListener('click',()=>{}); // role appended by action handler below
  }
  const s=make('p','HOLD · original owner/reviewer and zero-charge job required.');s.id='yw591Status';s.setAttribute('role','status');d.append(s);
  const result=make('div');result.id='yw591Result';d.append(result);
 }
 // Actual role value is included only for staff operations, never client authority.
 const previousAct=act;
 act=async function(action,ids=[]){
  if(action.startsWith('staff-')){
   await run(async a=>{const data=get(['companyId',...ids]);
    data.staffRole=$('yw591StaffRole')?.value;
    const r=await invoke(a,{action,...data});out(r);
    message('Live original staff authority: '+r.state);});
  }else await previousAct(action,ids);
 };
 function clear(){
  generation++;
  const img=$('yw591File');if(img)img.value='';
  for(const id of ['yw591Consent','yw591Offline']){const x=$(id);if(x)x.checked=false;}
  $('yw591Result')?.replaceChildren();
  // A logout MUST delete the offline encrypted bytes and encryption key.
  clearPending();
  message('Current session revoked: encrypted offline transfer cleared or requires browser clearance.');
 }
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(event,clear);
 window.addEventListener('offline',()=>message('Offline: the pending photo stays only encrypted on this device until explicitly sent.'));
 window.addEventListener('online',()=>message('Online again. Verify the original account then manually send encrypted pending or reconcile a stored object.'));
 window.YW591PrivateContinuity=Object.freeze({clear,description:
  'opt-in AES-GCM 256 device-local, 24-hour expiry, manual authenticated retry; no background network send'});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
