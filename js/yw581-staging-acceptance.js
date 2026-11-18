/* YW581 staged service acceptance and private photo candidate.
 * Verification is read-only; uploads require original server-side YW422, Jobs,
 * YW581 staging reviewer custody and Supabase Storage RLS. No auto-activation. */
(()=>{'use strict';
const KEYS=Object.freeze(['landscape','snow_removal','snow_plowing','septic','arboriculture',
 'construction','water_parks','ponds','skateparks']);
const LABEL=Object.freeze({landscape:'Lawn & Grounds',snow_removal:'Snow Removal',
 snow_plowing:'Snow Plowing',septic:'Septic',arboriculture:'Arboriculture',
 construction:'Construction',water_parks:'Aquatic Facilities',ponds:'Custom Ponds',
 skateparks:'Skateparks'});
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const company=()=>window.YW579Navigation?.snapshot?.()||{};
const isPlatform=()=>document.documentElement.dataset.ywSurface==='platform'||location.hash==='#sysop';
const allowed=()=>auth().isAuthenticated===true&&uuid(auth().user?.id)&&!isPlatform()&&
  window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&
  company().verified===true&&uuid(company().companyId)&&
  window.YWISecurity?.canViewModule?.('jobs',auth().role||'employee','view')===true;
const empty=()=>({state:'HOLD',rows:[],photoRecords:0,accepted:0,productionActivation:false});
function inspect(source,companyId,now=Date.now()){
 const result=empty(),timestamp=Date.parse(source?.captured_at);
 if(!uuid(companyId)||source?.company_id!==companyId||
  source?.owner_guard!=='ywi_422_assert_owner'||source?.source!=='YW581_STAGING_ONLY'||
  source?.synthetic!==false||source?.mutation_authorized!==false||
  source?.production_activation_authorized!==false||
  source?.financial_activation_authorized!==false||
  source?.customer_messaging_authorized!==false||
  source?.digest_independently_verified!==false||
  !Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>240000||
  !Number.isSafeInteger(source.photo_records)||source.photo_records<0||
  !Array.isArray(source.services)||source.services.length!==9||
  new Set(source.services.map(s=>s.key)).size!==9||
  source.services.some(s=>!KEYS.includes(s.key)||typeof s.enabled!=='boolean'||
    typeof s.registry_present!=='boolean'||typeof s.staging_accepted!=='boolean'||
    s.new_work_authorized!==false))return result;
 const rows=KEYS.map(key=>{
  const s=source.services.find(x=>x.key===key);
  return {key,label:LABEL[key],registryPresent:s.registry_present,enabled:s.enabled,
    stagingAccepted:s.staging_accepted,readyForEvidence:s.registry_present&&
    s.enabled&&s.staging_accepted};
 });
 return Object.freeze({state:'OWNER_STAGING_REVIEW_ONLY',rows,photoRecords:source.photo_records,
   accepted:rows.filter(x=>x.stagingAccepted&&x.registryPresent).length,
   productionActivation:false,canActivate:false,canCreateJob:false,
   canApproveFinance:false,canSend:false,capturedAt:source.captured_at});
}
let epoch=0,current=null,busy=false;
const $=id=>document.getElementById(id);
function status(s){const n=$('yw581Status');if(n)n.textContent=s;}
function clear(){
 epoch++;current=null;const host=$('yw581Rows');host?.replaceChildren();
 const form=$('yw581Upload');if(form){form.reset();form.hidden=true;}
 status('HOLD: original company and independent staging acceptance have not been verified.');
}
function render(){
 const host=$('yw581Rows');if(!host)return;
 host.replaceChildren();
 if(!allowed()||current?.state!=='OWNER_STAGING_REVIEW_ONLY')return;
 const list=el('ul');list.className='yw581-service-list';
 for(const r of current.rows){
  const item=el('li');const name=el('strong',r.label);
  const state=el('span',!r.registryPresent?'Registry missing':
   !r.stagingAccepted?'Staging acceptance missing':
   r.enabled?'Staging accepted · service ON':'Staging accepted · service OFF');
  item.dataset.yw581Key=r.key;item.append(name,state);list.append(item);
 }
 host.append(list);
 const note=el('p','Original private photo metadata records: '+current.photoRecords+
  '. Independently verified file hashes: NOT ATTESTED. No production service or finance activation.');
 host.append(note);
 const form=$('yw581Upload');
 if(form)form.hidden=!current.rows.some(r=>r.readyForEvidence);
}
async function verify(){
 const run=++epoch,companyId=company().companyId,actor=auth().user?.id;
 current=null;$('yw581Rows')?.replaceChildren();
 if(!allowed()){clear();return;}
 const sb=window.YWI_SB||window._sb;
 if(!sb?.rpc||!sb?.auth?.getUser){status('HOLD: original Supabase enrollment unavailable.');return;}
 status('Checking signed-in owner and original staged service acceptance…');
 try{
  const identity=await sb.auth.getUser();
  if(run!==epoch||!allowed()||company().companyId!==companyId||auth().user?.id!==actor)return;
  if(identity.error||identity.data?.user?.id!==actor)throw Error('Owner session changed');
  const response=await sb.rpc('ywi_rpc_staging_acceptance_581',{p_company_id:companyId});
  if(run!==epoch||company().companyId!==companyId||auth().user?.id!==actor)return;
  if(response.error||!response.data)throw Error('Staging migration not independently enrolled');
  const checked=inspect(response.data,companyId);
  if(checked.state!=='OWNER_STAGING_REVIEW_ONLY')throw Error('Nine-service snapshot failed source validation');
  current=checked;render();
  status('Read-only staging review: '+checked.accepted+
    '/9 services have unexpired acceptance receipts. This does NOT activate production.');
 }catch(e){if(run===epoch){current=null;render();status('HOLD: '+(e?.message||'Original staging proof unavailable'));}}
}
function field(host,title,id,type='text'){
 const wrap=el('label',title);const input=el('input');
 input.id=id;input.type=type;if(type==='text')input.maxLength=36;
 wrap.append(input);host.append(wrap);return input;
}
async function upload(e){
 e.preventDefault();
 if(busy||!allowed()||current?.state!=='OWNER_STAGING_REVIEW_ONLY'||
   !current.rows.some(r=>r.readyForEvidence))return;
 const ids=['yw581Client','yw581Property','yw581Job'].map(id=>$(id)?.value?.trim());
 const [clientId,siteId,jobId]=ids;
 const file=$('yw581Photo')?.files?.[0],consent=$('yw581Consent')?.checked;
 if(!ids.every(uuid)||!file||!consent||file.size<1||file.size>10485760||
    !['image/jpeg','image/png','image/webp'].includes(file.type)){
  status('HOLD: enter existing original UUIDs, choose an image under 10 MB and confirm documentation consent.');
  return;
 }
 const actor=auth().user?.id,companyId=company().companyId,run=epoch;
 const sb=window.YWI_SB||window._sb;
 if(!sb?.storage?.from||!sb?.rpc||!sb?.auth?.getUser||!crypto?.subtle||!crypto?.randomUUID){
  status('HOLD: secure storage or cryptographic hashing unavailable.');return;
 }
 busy=true;const button=$('yw581Submit');if(button)button.disabled=true;
 let stored=false;
 try{
  const verifyUser=await sb.auth.getUser();
  if(verifyUser.error||verifyUser.data?.user?.id!==actor||run!==epoch||
     !allowed()||company().companyId!==companyId)throw Error('Owner/tenant session changed');
  const hex=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),
   x=>x.toString(16).padStart(2,'0')).join('');
  const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
  const path=companyId+'/'+jobId+'/'+crypto.randomUUID()+'.'+ext;
  const requestId=crypto.randomUUID();
  status('Uploading to original tenant/job private storage. Do not refresh…');
  const storage=sb.storage.from('ywi-private-job-photos-581');
  const put=await storage.upload(path,file,{contentType:file.type,upsert:false,cacheControl:'0'});
  if(put.error)throw Error('Private storage upload refused: '+put.error.message);
  stored=true;
  if(run!==epoch||!allowed()||auth().user?.id!==actor||company().companyId!==companyId)
   throw Error('Session changed after upload; object requires supervised orphan reconciliation');
  const receipt=await sb.rpc('ywi_rpc_record_photo_581',{
   p_company_id:companyId,p_client_id:clientId,p_site_id:siteId,p_job_id:jobId,
   p_request_id:requestId,p_path:path,p_reported_sha256:hex,p_media_type:file.type,
   p_consent:true,p_retained_until:new Date(Date.now()+365*86400000).toISOString()});
  if(receipt.error||receipt.data?.company_id!==companyId||receipt.data?.job_id!==jobId||
    receipt.data?.storage_recorded!==true||receipt.data?.content_hash_independently_verified!==false||
    receipt.data?.new_work_authorized!==false||receipt.data?.financial_activation!==false)
    throw Error('Uploaded object not yet recorded under original job');
  status('Private object and immutable original job metadata recorded. Client SHA-256 is reported, not independently verified; no public link or message sent.');
  $('yw581Photo').value='';
  await verify();
 }catch(err){status('HOLD: '+(err?.message||'Secure upload failed')+
    (stored?' · Possible private orphan: request supervised cleanup; no automatic delete.':''));}
 finally{busy=false;if(button)button.disabled=false;}
}
function mount(){
 const section=$('settings');if(!section||$('yw581Panel'))return;
 const panel=el('details');panel.id='yw581Panel';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='YW581 · Nine-service staging and photo evidence';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.append(el('summary','YW581 · Nine-Service Staging Acceptance & Private Job Photos'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Independent staging-only review, original company/customer/property/job linkage and private photo evidence. No automatic service entitlement, booking, payout, or customer contact.'));
 const verifyButton=el('button','Review original staging acceptance');verifyButton.type='button';
 verifyButton.className='secondary';verifyButton.addEventListener('click',verify);body.append(verifyButton);
 const message=el('p','HOLD: staging source not independently verified.');message.id='yw581Status';
 message.setAttribute('role','status');message.setAttribute('aria-live','polite');body.append(message);
 const rows=el('div');rows.id='yw581Rows';body.append(rows);
 const form=el('form');form.id='yw581Upload';form.hidden=true;
 form.append(el('p','Accepted staging services only: enter UUIDs from the original customer/property/job record. The server validates each relationship and entitlement.'));
 field(form,'Original customer UUID','yw581Client');
 field(form,'Original property UUID','yw581Property');
 field(form,'Original work order UUID','yw581Job');
 const photo=field(form,'Private job photo','yw581Photo','file');photo.accept='image/jpeg,image/png,image/webp';
 const label=el('label');const checkbox=el('input');checkbox.id='yw581Consent';
 checkbox.type='checkbox';label.append(checkbox,document.createTextNode(
  ' I confirm authorization to retain this photo as job documentation; no marketing or automated sharing.'));
 form.append(label);
 const submit=el('button','Upload to private staging storage');submit.id='yw581Submit';
 submit.type='submit';form.append(submit);form.addEventListener('submit',upload);body.append(form);
 panel.append(body);section.append(panel);
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed',
   'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,clear);
 $('yw579CompanySelect')?.addEventListener('change',clear);
 window.addEventListener('hashchange',()=>{if(isPlatform())clear();});
}
window.YW581Acceptance=Object.freeze({keys:KEYS,inspect,verify,clear,
 snapshot:()=>({state:current?.state||'HOLD',accepted:current?.accepted||0,productionActivation:false})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
