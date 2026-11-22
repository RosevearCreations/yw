/* YW589 — genuine authenticated original-device capture and dispatcher review.
 * All authority is checked again by the independent Supabase Edge function.
 * Client-side camera/checkboxes are evidence INPUT, not certification. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const auth=()=>window.YWI_AUTH?.getState?.()||{};
 const sb=()=>window.YWI_SB||window._sb;
 const where=()=>document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
 let epoch=0,busy=false,requestId='',oldFile=null,previewUrl=null,previewKey='';
 const message=(value)=>{const n=$('yw589Status');if(n)n.textContent=value;};
 const okUser=()=>auth().isAuthenticated===true&&UUID.test(auth().user?.id||'')&&where()&&
  (window.YWISecurity?.canViewModule?.('jobs',auth().role||'employee','view')!==false);
 function reset(){
  epoch++;busy=false;requestId='';oldFile=null;previewKey='';
  if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
  const photo=$('yw589PhotoPreview');if(photo){photo.hidden=true;photo.removeAttribute('src');}
  const field=$('yw589Photo');if(field)field.value='';
  const consent=$('yw589Consent');if(consent)consent.checked=false;
  const attest=$('yw589DispatcherAttest');if(attest)attest.checked=false;
  for(const name of ['yw589Readiness','yw589Capture','yw589Check','yw589Review','yw589Confirm']){
   const n=$(name);if(n)n.disabled=false;
  }
  message('HOLD · authenticated original work order, approved pilot, real private photo, and different dispatcher required.');
 }
 function job(){const s=$('yw589Job')?.value.trim()||'';if(!UUID.test(s))throw Error('Enter the original authorized job UUID');return s;}
 function photoId(){const s=$('yw589Receipt')?.value.trim()||'';if(!UUID.test(s))throw Error('Enter verified original photo receipt UUID');return s;}
 async function actor(){
  const actorId=auth().user?.id,client=sb(),run=epoch;
  if(!okUser()||!client?.auth?.getUser||!client?.functions?.invoke)
    throw Error('Current signed-in Jobs user and secure server API required');
  const r=await client.auth.getUser();
  if(r.error||r.data?.user?.id!==actorId||epoch!==run||!okUser())
    throw Error('Authenticated Jobs session changed');
  return {client,actorId,run};
 }
 async function invoke(client,data){
  const r=await client.functions.invoke('yw589-original-device-photo',{body:data});
  if(r.error)throw Error('Secure original-device service unavailable or refused request');
  if(!r.data||r.data.state==='HOLD')throw Error(r.data?.code||'Server held original-source authorization');
  return r.data;
 }
 const setBusy=(value)=>{busy=value;for(const id of ['yw589Readiness','yw589Capture','yw589Check','yw589Review','yw589Confirm']){
  const x=$(id);if(x)x.disabled=value;
 }};
 const safe=(a)=>epoch===a.run&&auth().user?.id===a.actorId&&okUser();
 const show=(d)=>{const box=$('yw589Outcome');if(!box)return;box.replaceChildren();
  for(const [title,value] of Object.entries(d).filter(([name])=>[
   'state','approvedJobId','photoId','photoCount','serverHashVerified',
   'byteCount','dispatcherSigned','captureAllowed','externalWitnessStillRequired'
  ].includes(name))){
   const p=el('p');const strong=el('strong',title+': ');p.append(strong,document.createTextNode(String(value)));box.append(p);
  }
 };
 async function readiness(){
  if(busy)return;setBusy(true);const run=epoch;try{
   const a=await actor(),data=await invoke(a.client,{action:'readiness',jobId:job()});
   if(!safe(a)||run!==epoch)return;
   show(data);message(data.captureAllowed?
    'Original authenticated job and service accepted. Capture one private photo with documentation consent.':
    'HOLD · original job already has a photo; use status or dispatcher review.');
  }catch(e){if(run===epoch)message('HOLD · '+(e?.message||'Original job not ready'));}
  finally{if(run===epoch)setBusy(false);}
 }
 function chosen(){
  const f=$('yw589File')?.files?.[0];
  if(!f||f.size<16||f.size>10485760||!['image/jpeg','image/png','image/webp'].includes(f.type))
   throw Error('Choose a JPEG/PNG/WebP image from the original device, 16 bytes–10 MB');
  if(f!==oldFile){oldFile=f;requestId=crypto.randomUUID();}
  return f;
 }
 async function capture(){
  if(busy)return;setBusy(true);const run=epoch;
  try{
   if($('yw589Consent')?.checked!==true)throw Error('Original job documentation consent must be checked');
   const f=chosen(),a=await actor(),hash=Array.from(
     new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer())),
     b=>b.toString(16).padStart(2,'0')).join('');
   if(!safe(a)||run!==epoch)throw Error('User/job changed during device photo hashing');
   const body=new FormData();
   for(const [key,value] of Object.entries({action:'capture',jobId:job(),
     requestId,deviceSha256:hash,consent:'true',consentScope:'original_job_documentation'}))
    body.set(key,value);
   body.set('photo',f,f.name);
   message('Uploading original photo privately, then verifying stored bytes on the server…');
   const d=await invoke(a.client,body);
   if(!safe(a)||run!==epoch)return;
   show(d);if(d.photoId)$('yw589Receipt').value=d.photoId;
   message('Private SHA-256 server download verified. Original dispatcher sign-off remains required.');
  }catch(e){if(run===epoch)message('HOLD · '+(e?.message||'Private photo upload refused')+
   '. Retain original file/request ID; do not create a duplicate job.');}
  finally{if(run===epoch)setBusy(false);}
 }
 async function status(){
  if(busy)return;setBusy(true);const run=epoch;
  try{const a=await actor(),d=await invoke(a.client,{action:'status',jobId:job()});
   if(!safe(a)||run!==epoch)return;
   show(d);message(d.state.replaceAll('_',' ')+' · external original-device witness is not automatically certified.');
  }catch(e){if(run===epoch)message('HOLD · '+(e?.message||'Status unavailable'));}
  finally{if(run===epoch)setBusy(false);}
 }
 async function review(){
  if(busy)return;setBusy(true);const run=epoch;
  try{
   const jobId=job(),photo=photoId(),a=await actor();
   // Returning image/* from an authenticated Edge function yields a Blob.
   // The private bytes are never added to Shell telemetry or local storage.
   const r=await a.client.functions.invoke('yw589-original-device-photo',{
    body:{action:'review',jobId,photoId:photo}});
   if(r.error||!(r.data instanceof Blob)||!['image/jpeg','image/png','image/webp'].includes(r.data.type))
    throw Error('Original private photo could not be independently opened by this dispatcher');
   if(!safe(a)||run!==epoch)return;
   if(previewUrl)URL.revokeObjectURL(previewUrl);
   previewUrl=URL.createObjectURL(r.data);
   const img=$('yw589PhotoPreview');img.src=previewUrl;img.hidden=false;
   previewKey=jobId+':'+photo+':'+a.actorId;
   message('Original private photo opened under dispatcher authority. Review it, then explicitly confirm.');
  }catch(e){if(run===epoch){previewKey='';message('HOLD · '+(e?.message||'Photo review refused'));}}
  finally{if(run===epoch)setBusy(false);}
 }
 async function confirm(){
  if(busy)return;setBusy(true);const run=epoch;
  try{
   const a=await actor(),jobId=job(),photo=photoId();
   if($('yw589DispatcherAttest')?.checked!==true||previewKey!==jobId+':'+photo+':'+a.actorId)
    throw Error('Different authenticated dispatcher must first open and review private photo on this device');
   const d=await invoke(a.client,{action:'confirm',jobId,photoId:photo,
    dispatcherConfirmed:true,reviewedPrivatePhotoOnOriginalDevice:true});
   if(!safe(a)||run!==epoch)return;
   show(d);message('Original dispatcher sign-off recorded; independent field witness and Shell case closure remain separate.');
  }catch(e){if(run===epoch)message('HOLD · '+(e?.message||'Dispatcher confirmation not accepted'));}
  finally{if(run===epoch)setBusy(false);}
 }
 function mount(){
  const host=$('jobs');if(!host||$('yw589DevicePanel'))return;
  const section=el('section');section.className='yw589-pilot';section.id='yw589DevicePanel';
  section.append(el('h3','YW589 · Original-device photo and dispatcher field review'),
   el('p','TEST ONLY · Rosevear Landscaping. Uses an original authorized work order and separate authenticated crew/dispatcher. The product Shell never receives photo bytes or customer finances.'));
  const form=el('div');form.className='yw589-form';
  const field=(title,id,type='text')=>{const label=el('label',title),input=el('input');
   input.id=id;input.type=type;label.append(input);form.append(label);return input;};
  const j=field('Original Rosevear work order UUID','yw589Job');
  j.placeholder='Existing work order, not a new job';j.maxLength=36;
  const check=el('button','Check original-job authority');check.type='button';check.id='yw589Readiness';
  check.addEventListener('click',readiness);form.append(check);
  const file=field('Take photo on this device or choose an existing photo','yw589File','file');
  file.accept='image/jpeg,image/png,image/webp';file.setAttribute('capture','environment');
  file.addEventListener('change',()=>{requestId='';oldFile=null;});
  const consent=el('label');const c=el('input');c.id='yw589Consent';c.type='checkbox';
  consent.append(c,document.createTextNode(' Document this original job only. No public/customer/marketing sharing.'));form.append(consent);
  const send=el('button','Upload privately and verify server hash');send.type='button';send.id='yw589Capture';
  send.addEventListener('click',capture);form.append(send);
  const load=el('button','Read original receipt status');load.type='button';load.id='yw589Check';
  load.addEventListener('click',status);form.append(load);
  const receipt=field('Private photo receipt UUID for independent dispatcher','yw589Receipt');
  receipt.maxLength=36;receipt.placeholder='Verified photo ID from crew';
  const reviewButton=el('button','Dispatcher: securely open original photo');
  reviewButton.type='button';reviewButton.id='yw589Review';reviewButton.addEventListener('click',review);
  form.append(reviewButton);
  const img=el('img');img.id='yw589PhotoPreview';img.hidden=true;img.alt='Private job photo for authorized dispatcher review';
  img.style.maxWidth='100%';form.append(img);
  const dispatcher=el('label'),d=el('input');d.type='checkbox';d.id='yw589DispatcherAttest';
  dispatcher.append(d,document.createTextNode(' I reviewed the private original photo on this authenticated device and confirm the same work order.'));form.append(dispatcher);
  const confirmButton=el('button','Dispatcher: record independent confirmation');
  confirmButton.type='button';confirmButton.id='yw589Confirm';
  confirmButton.addEventListener('click',confirm);form.append(confirmButton);
  section.append(form);
  const status=el('p','HOLD · original authorization and device evidence required.');
  status.id='yw589Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  section.append(status);const out=el('div');out.id='yw589Outcome';section.append(out);
  host.append(section);reset();
 }
 for(const ev of ['ywi:auth-changed','ywi:workspace-authority-changed',
   'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(ev,reset);
 window.addEventListener('hashchange',()=>{if(location.hash==='#sysop')reset();});
 window.YW589DevicePilot=Object.freeze({reset,state:()=>({captureServerVerifiedOnly:true,
  externalOriginalDeviceWitnessPending:true,masterAckVerified:false})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
