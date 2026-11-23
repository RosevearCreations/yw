// YW589 — secure original-device photo upload, full server-side byte re-read,
// and independent dispatcher field review. NEVER provisions staff/tenant roles,
// enables service, creates work orders, invoices customers or closes Shell cases.
// Single Rosevear Landscaping TEST ONLY original customer/site; reusable
// multi-tenant expansion requires separate authorization and migration.
const COMPANY='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
const CLIENT='58700000-0000-4587-8587-000000000001';
const SITE='58700000-0000-4587-8587-000000000002';
const BUCKET='ywi-private-device-evidence-589';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/i;
const MAX=10485760;
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const uuid=v=>typeof v==='string'&&UUID.test(v);
const sha=v=>typeof v==='string'&&SHA.test(v);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
const matchMagic=(type,a)=>type==='image/jpeg'?
 (a[0]===255&&a[1]===216&&a[2]===255):
 type==='image/png'?
 ([137,80,78,71,13,10,26,10].every((x,i)=>a[i]===x)):
 type==='image/webp'?
 (String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP'):false;
const ext=type=>type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp';
const deny=(code,detail)=>Object.assign(new Error(code),{code,detail});
const SECRET=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const URL_ROOT=()=>Deno.env.get('SUPABASE_URL');
function headers(jwt){
 const secret=SECRET();
 if(!secret||!URL_ROOT())throw deny('SERVER_CONFIGURATION_HOLD');
 return {'apikey':secret,'authorization':'Bearer '+(jwt||secret)};
}
async function request(path,{method='GET',body,extra={},asJson=true,jwt}={}){
 const res=await fetch(URL_ROOT()+path,{
  method,headers:{...headers(jwt),...extra},body
 });
 if(!res.ok)throw deny('DEPENDENCY_OR_SOURCE_REJECTED');
 return asJson?res.json():res.arrayBuffer();
}
const escaped=s=>encodeURIComponent(s);
function select(table,cols,terms,limit=3){
 const qs=new URLSearchParams();qs.set('select',cols);
 Object.entries(terms).forEach(([k,v])=>qs.set(k,'eq.'+String(v)));
 qs.set('limit',String(limit));
 return request('/rest/v1/'+table+'?'+qs.toString());
}
async function insert(table,fields){
 const rows=await request('/rest/v1/'+table,{
  method:'POST',extra:{'Content-Type':'application/json','Prefer':'return=representation'},
  body:JSON.stringify(fields)
 });
 if(!Array.isArray(rows)||rows.length!==1)throw deny('IMMUTABLE_RECEIPT_NOT_WRITTEN');
 return rows[0];
}
async function getActor(req){
 const raw=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(raw))
  throw deny('AUTH_REQUIRED');
 const user=await request('/auth/v1/user',{jwt:raw.slice(7)});
 if(!uuid(user?.id))throw deny('AUTH_REQUIRED');
 const [p]=await select('profiles','id,role,is_active',{id:user.id},2);
 if(!p?.is_active)throw deny('ACTIVE_PROFILE_REQUIRED');
 return {userId:user.id,role:p.role};
}
async function guard(kind,actor,jobId){
 if(!uuid(jobId))throw deny('ORIGINAL_JOB_REQUIRED');
 const [grant]=await select('ywi_589_pilot_authorizations',
 'company_id,client_id,client_site_id,owner_user_id,independent_reviewer_id,approved,approved_at,expires_at',{company_id:COMPANY},2);
 if(!grant?.approved||grant.client_id!==CLIENT||grant.client_site_id!==SITE||
    grant.owner_user_id===grant.independent_reviewer_id||
    !grant.approved_at||!Number.isFinite(Date.parse(grant.approved_at))||
    Date.parse(grant.approved_at)>Date.now()||Date.parse(grant.expires_at)<=Date.now())
   throw deny('TWO_PARTY_PILOT_APPROVAL_HOLD');
 const [company]=await select('ywi_companies','id,owner_user_id',{id:COMPANY},2);
 if(!company||company.owner_user_id!==grant.owner_user_id)
   throw deny('ORIGINAL_COMPANY_OWNER_HOLD');
 const [staff]=await select('ywi_589_pilot_staff','user_id,role,enabled,expires_at,independently_reviewed_by',{
   company_id:COMPANY,user_id:actor.userId,role:kind
 },2);
 if(!staff?.enabled||staff.independently_reviewed_by===actor.userId||
    Date.parse(staff.expires_at)<=Date.now())
   throw deny('INDEPENDENT_CREW_OR_DISPATCHER_ENROLLMENT_HOLD');
 const [enabled]=await select('ywi_company_service_modules','company_id,module_key,enabled',{
   company_id:COMPANY,module_key:'landscape'},2);
 if(enabled?.enabled!==true)throw deny('ORIGINAL_SERVICE_ENTITLEMENT_OFF');
 const [client]=await select('ywi_company_client_links_422','company_id,client_id',{
   company_id:COMPANY,client_id:CLIENT},2);
 const [site]=await select('ywi_company_site_links_422','company_id,client_id,client_site_id',{
   company_id:COMPANY,client_id:CLIENT,client_site_id:SITE},2);
 if(!client||!site)throw deny('ORIGINAL_CUSTOMER_PROPERTY_LINK_HOLD');
 const orders=await select('work_orders',
 'id,company_id,client_id,client_site_id,service_module_key,status,total_amount,subtotal,tax_total,completion_ready_for_accounting',
 {company_id:COMPANY,client_id:CLIENT,client_site_id:SITE},3);
 if(orders.length!==1||orders[0].id!==jobId||orders[0].service_module_key!=='landscape'||
  !['draft','scheduled','in_progress','open'].includes(orders[0].status)||
  Number(orders[0].total_amount)!==0||Number(orders[0].subtotal)!==0||
  Number(orders[0].tax_total)!==0||orders[0].completion_ready_for_accounting!==false)
  throw deny('ORIGINAL_ZERO_CHARGE_WORK_ORDER_HOLD');
 // Real schema: postings point to invoice_candidate_id, NOT work_order_id.
 // Block all original work-order candidates and A/R invoices (which include
 // posted invoice linkage), rather than relying on a nonexistent column.
 const candidates=await select('job_invoice_candidates','id',{work_order_id:jobId},2);
 const invoices=await select('ar_invoices','id',{work_order_id:jobId},2);
 if(candidates.length||invoices.length)throw deny('ORIGINAL_JOB_FINANCE_ISOLATION_HOLD');
 return orders[0];
}
async function storedFile(key){
 return request('/storage/v1/object/authenticated/'+escaped(BUCKET)+'/'+
  key.split('/').map(escaped).join('/'),{asJson:false});
}
async function uploadFile(key,bytes,mime){
 const res=await fetch(URL_ROOT()+'/storage/v1/object/'+escaped(BUCKET)+'/'+
  key.split('/').map(escaped).join('/'),{
  method:'POST',headers:{...headers(),
   'Content-Type':mime,'Cache-Control':'no-store','x-upsert':'false'},
  body:new Uint8Array(bytes)
 });
 if(!res.ok)throw deny('PRIVATE_STORAGE_UPLOAD_REJECTED');
}
function output(state,extra={}){
 return {state,companyBound:COMPANY,verifiedOriginalRecord:state!=='HOLD',
  liveFieldCertified:false,customerNotification:false,financeMutation:false,
  shellIncidentAutoClosed:false,...extra};
}
async function perform(action,data,actor,file){
 if(action==='summary'){
  if(actor.role!=='admin')throw deny('SYSOP_MEMBERSHIP_HOLD');
  const admin=await select('ywi_platform_administrators_489','user_id',{user_id:actor.userId},2);
  if(admin.length!==1)throw deny('SYSOP_MEMBERSHIP_HOLD');
  const receipts=await select('ywi_589_photo_receipts','id',{company_id:COMPANY},1000);
  const certs=await select('ywi_589_dispatcher_certifications','id',{company_id:COMPANY},1000);
  return {state:'REDACTED_ORIGINAL_RECEIPT_COUNTS_ONLY',photoReceiptCount:receipts.length,
   dispatcherConfirmationCount:certs.length,
   customerDetailsIncluded:false,privatePhotoIncluded:false,tenantFinanceIncluded:false,
   masterDurableAckVerified:false,liveFieldCertified:false};
 }
 if(!['readiness','capture','status','review','confirm'].includes(action))throw deny('UNKNOWN_ACTION');
 const jobId=String(data?.jobId||'');
 if(action==='status'){
  try{await guard('crew',actor,jobId);}catch(_){await guard('dispatcher',actor,jobId);}
 }else await guard(action==='confirm'||action==='review'?'dispatcher':'crew',actor,jobId);
 const receipts=await select('ywi_589_photo_receipts',
 'id,request_id,company_id,work_order_id,uploaded_by,stored_bucket,object_key,content_type,observed_sha256,byte_count,server_download_hash_match',
 {company_id:COMPANY,work_order_id:jobId},2);
 if(action==='readiness'){
  return output('ORIGINAL_DEVICE_CAPTURE_AUTHORIZED',{
   approvedJobId:jobId,existingPhotoCount:receipts.length,
   captureAllowed:receipts.length===0});
 }
 if(action==='status'){
  if(!receipts.length)return output('AWAITING_ORIGINAL_DEVICE_PHOTO',{approvedJobId:jobId,photoCount:0});
  const certifications=await select('ywi_589_dispatcher_certifications','id,photo_id,confirmed_at,witness_state',
   {company_id:COMPANY,photo_id:receipts[0].id},2);
  return output(certifications.length?
   'DISPATCHER_CERTIFICATION_CAPTURED_EXTERNAL_WITNESS_PENDING':'PRIVATE_BYTES_INDEPENDENTLY_VERIFIED_DISPATCHER_PENDING',{
   approvedJobId:jobId,photoCount:receipts.length,dispatcherSigned:certifications.length===1,
   serverVerifiedHash:receipts[0].server_download_hash_match===true});
 }
 if(action==='review'){
  const photo=receipts[0];
  if(receipts.length!==1||!uuid(data?.photoId)||photo?.id!==data.photoId||
     photo.uploaded_by===actor.userId)throw deny('DISPATCHER_PRIVATE_REVIEW_HOLD');
  const bytes=await storedFile(photo.object_key);
  if(await digest(bytes)!==photo.observed_sha256||bytes.byteLength!==photo.byte_count)
   throw deny('DISPATCHER_PRIVATE_REVIEW_HASH_MISMATCH');
  return new Response(bytes,{status:200,headers:{
   'Content-Type':photo.content_type,'Cache-Control':'no-store, max-age=0',
   'X-Content-Type-Options':'nosniff'}});
 }
 if(action==='capture'){
  const requestId=String(data?.requestId||'');
  if(!uuid(requestId)||data?.consent!==true||data?.consentScope!=='original_job_documentation'||
     !file||!(file instanceof File)||file.size<16||file.size>MAX||
     !['image/jpeg','image/png','image/webp'].includes(file.type))
   throw deny('CAMERA_FILE_CONSENT_OR_REQUEST_HOLD');
  const bytes=await file.arrayBuffer(),typed=new Uint8Array(bytes);
  if(!matchMagic(file.type,typed))throw deny('PHOTO_CONTENT_SIGNATURE_HOLD');
  const sourceHash=await digest(bytes);
  if(!sha(data?.deviceSha256)||sourceHash!==data.deviceSha256)
   throw deny('DEVICE_VS_SERVER_HASH_MISMATCH');
  if(receipts.length){
   const same=receipts.length===1&&receipts[0].request_id===requestId&&
    receipts[0].uploaded_by===actor.userId&&receipts[0].observed_sha256===sourceHash;
   if(!same)throw deny('ORIGINAL_JOB_ALREADY_HAS_DIFFERENT_PHOTO');
   const originalBytes=await storedFile(receipts[0].object_key);
   if(await digest(originalBytes)!==sourceHash)throw deny('ORIGINAL_STORAGE_REPLAY_HASH_MISMATCH');
   return output('PRIVATE_PHOTO_VERIFIED_IDEMPOTENT_REPLAY',{
    photoId:receipts[0].id,serverHashVerified:true,byteCount:receipts[0].byte_count});
  }
  const path=COMPANY+'/'+jobId+'/'+requestId+'.'+ext(file.type);
  await uploadFile(path,bytes,file.type);
  // Actual private download back from Storage; device/client SHA alone is
  // never an independently verified proof of the stored bytes.
  const back=await storedFile(path),downloadedHash=await digest(back);
  if(downloadedHash!==sourceHash||back.byteLength!==file.size)
   throw deny('STORAGE_BYTES_MISMATCH_QUARANTINE_ORPHAN');
  let row;
  try{
   row=await insert('ywi_589_photo_receipts',{
    id:crypto.randomUUID(),company_id:COMPANY,client_id:CLIENT,client_site_id:SITE,
    work_order_id:jobId,request_id:requestId,uploaded_by:actor.userId,
    stored_bucket:BUCKET,object_key:path,content_type:file.type,
    observed_sha256:downloadedHash,device_client_hash_sha256:sourceHash,
    byte_count:back.byteLength,server_download_hash_match:true,
    consent_scope:'original_job_documentation'
   });
  }catch(_){throw deny('PHOTO_STORED_BUT_LEDGER_NOT_RECORDED_ORPHAN_REVIEW');}
  return output('PRIVATE_PHOTO_BYTES_READ_BACK_AND_VERIFIED',{
   photoId:row.id,serverHashVerified:true,byteCount:back.byteLength,
   dispatcherSigned:false});
 }
 if(receipts.length!==1||!uuid(data?.photoId)||receipts[0].id!==data.photoId||
  data?.dispatcherConfirmed!==true||data?.reviewedPrivatePhotoOnOriginalDevice!==true)
  throw deny('ORIGINAL_DISPATCHER_REVIEW_NOT_AUTHORIZED');
 if(receipts[0].uploaded_by===actor.userId)
  throw deny('DISPATCHER_MUST_BE_DIFFERENT_ACTOR');
 const bytes=await storedFile(receipts[0].object_key);
 if(await digest(bytes)!==receipts[0].observed_sha256||
   bytes.byteLength!==receipts[0].byte_count)
  throw deny('DISPATCHER_STORAGE_BYTES_CHANGED');
 const existing=await select('ywi_589_dispatcher_certifications','id,dispatcher_user_id,photo_id',
 {photo_id:receipts[0].id,company_id:COMPANY},2);
 if(existing.length){
  if(existing.length!==1||existing[0].dispatcher_user_id!==actor.userId)
   throw deny('DISPATCHER_CERTIFICATION_ALREADY_EXISTS');
  return output('ORIGINAL_DISPATCHER_SIGNOFF_IDEMPOTENT_REPLAY',{dispatcherSigned:true});
 }
 await insert('ywi_589_dispatcher_certifications',{
  photo_id:receipts[0].id,company_id:COMPANY,work_order_id:jobId,
  dispatcher_user_id:actor.userId,source_photo_sha256:receipts[0].observed_sha256,
  original_job_count:1,original_photo_count:1,invoice_count_before:0,invoice_count_after:0,
  dispatcher_reviewed_private_photo:true,device_attestation_recorded:true
 });
 return output('ORIGINAL_DISPATCHER_SIGNOFF_RECORDED_EXTERNAL_WITNESS_PENDING',{
  dispatcherSigned:true,externalWitnessStillRequired:true});
}

// YW590: actual two-device live ceremony. A trusted server-side challenge
// binds an original authenticated uploader to a DIFFERENT real reviewer.
// Private image is re-downloaded and SHA-256 checked before every witness or
// source Shell closure. Human visual observation is a sworn human claim,
// NOT hardware/OS device attestation or Master durable telemetry ACK.
const now590=()=>Date.now();
async function eligible590(actor,jobId,role){
 if(!uuid(jobId))throw deny('ORIGINAL_JOB_UUID_HOLD');
 const [g]=await select('ywi_589_pilot_authorizations',
  'company_id,client_id,client_site_id,owner_user_id,independent_reviewer_id,approved,approved_at,expires_at',
  {company_id:COMPANY},2);
 if(!g?.approved||g.client_id!==CLIENT||g.client_site_id!==SITE||
    g.owner_user_id===g.independent_reviewer_id||!Number.isFinite(Date.parse(g.approved_at))||
    Date.parse(g.approved_at)>now590()||Date.parse(g.expires_at)<=now590())
  throw deny('YW590_INDEPENDENT_PILOT_APPROVAL_HOLD');
 const [c]=await select('ywi_companies','id,owner_user_id',{id:COMPANY},2);
 if(!c||c.owner_user_id!==g.owner_user_id)throw deny('ORIGINAL_OWNER_MISMATCH');
 const candidates=await select('job_invoice_candidates','id',{work_order_id:jobId},2);
 const invoices=await select('ar_invoices','id',{work_order_id:jobId},2);
 if(candidates.length||invoices.length)throw deny('YW590_FINANCE_ZERO_ISOLATION_HOLD');
 const jobs=await select('work_orders',
  'id,company_id,client_id,client_site_id,status,service_module_key,total_amount,subtotal,tax_total,completion_ready_for_accounting',
  {company_id:COMPANY,client_id:CLIENT,client_site_id:SITE},3);
 if(jobs.length!==1||jobs[0].id!==jobId||jobs[0].service_module_key!=='landscape'||
    !['draft','scheduled','in_progress','open'].includes(jobs[0].status)||
    Number(jobs[0].total_amount)!==0||Number(jobs[0].subtotal)!==0||
    Number(jobs[0].tax_total)!==0||jobs[0].completion_ready_for_accounting!==false)
  throw deny('YW590_SINGLE_ZERO_CHARGE_ORIGINAL_JOB_HOLD');
 const [module]=await select('ywi_company_service_modules','enabled',
  {company_id:COMPANY,module_key:'landscape'},2);
 if(module?.enabled!==true)throw deny('YW590_ORIGINAL_ENTITLEMENT_DISABLED');
 const [linkedClient]=await select('ywi_company_client_links_422','client_id',
  {company_id:COMPANY,client_id:CLIENT},2);
 const [linkedSite]=await select('ywi_company_site_links_422','client_site_id',
  {company_id:COMPANY,client_id:CLIENT,client_site_id:SITE},2);
 if(!linkedClient||!linkedSite)throw deny('YW590_ORIGINAL_CLIENT_SITE_LINK_HOLD');
 const [p]=await select('ywi_589_photo_receipts',
  'id,company_id,client_id,client_site_id,work_order_id,uploaded_by,stored_bucket,object_key,observed_sha256,byte_count,server_download_hash_match',
  {company_id:COMPANY,work_order_id:jobId},2);
 if(!p||p.work_order_id!==jobId||p.client_id!==CLIENT||p.client_site_id!==SITE||
    p.stored_bucket!==BUCKET||p.server_download_hash_match!==true||
    !sha(p.observed_sha256)||p.byte_count<16||p.byte_count>MAX)
  throw deny('YW590_ORIGINAL_PRIVATE_PHOTO_HOLD');
 const certs=await select('ywi_589_dispatcher_certifications',
  'id,company_id,work_order_id,photo_id,dispatcher_user_id,source_photo_sha256,witness_state',
  {company_id:COMPANY,work_order_id:jobId,photo_id:p.id},2);
 if(certs.length!==1||certs[0].dispatcher_user_id===p.uploaded_by||
    certs[0].source_photo_sha256!==p.observed_sha256||
    certs[0].witness_state!=='ORIGINAL_DISPATCHER_CONFIRMATION_INDEPENDENT_WITNESS_PENDING')
  throw deny('YW590_AUTHENTIC_DISPATCHER_CERT_HOLD');
 const cert=certs[0];
 if(role==='reviewer'&&
   (actor.userId!==g.independent_reviewer_id||
    actor.userId===p.uploaded_by||actor.userId===cert.dispatcher_user_id||
    actor.userId===g.owner_user_id))
  throw deny('YW590_DIFFERENT_ACTIVE_HUMAN_REVIEWER_REQUIRED');
 if(role==='crew'&&actor.userId!==p.uploaded_by)throw deny('YW590_ORIGINAL_CREW_ONLY');
 if(role==='participant'&&![
   g.owner_user_id,g.independent_reviewer_id,p.uploaded_by,cert.dispatcher_user_id
 ].includes(actor.userId))throw deny('YW590_PARTICIPANT_SCOPE_HOLD');
 return {grant:g,photo:p,cert};
}
async function bytes590(photo){
 const bytes=await storedFile(photo.object_key);
 if(bytes.byteLength!==photo.byte_count||await digest(bytes)!==photo.observed_sha256)
   throw deny('YW590_PRIVATE_STORAGE_BYTES_CHANGED');
 return bytes;
}
async function sysop590(actor){
 if(actor.role!=='admin')throw deny('YW590_SYSOP_ONLY');
 const members=await select('ywi_platform_administrators_489','user_id',{user_id:actor.userId},2);
 if(members.length!==1)throw deny('YW590_ORIGINAL_PLATFORM_ADMIN_MEMBERSHIP_HOLD');
}
async function rpc590(name,params){
 return request('/rest/v1/rpc/'+name,{
  method:'POST',extra:{'Content-Type':'application/json','Prefer':'return=representation'},
  body:JSON.stringify(params)});
}
async function perform590(action,data,actor){
 if(action==='590:shell-summary'){
  await sysop590(actor);
  const rows=await select('ywi_590_shell_case_closures','id,state',{company_id:COMPANY},1000);
  return {state:'REDACTED_TECHNICAL_COUNTS_ONLY',source:'yw590',total:rows.length,
   open:rows.filter(x=>x.state==='AWAITING_INDEPENDENT_SYSOP').length,
   closed:rows.filter(x=>x.state==='ORIGINAL_CASE_CLOSED').length,
   noCustomerPII:true,noPrivatePhoto:true,noTenantFinance:true,
   masterDurableAckVerified:false,livePhysicalDeviceMachineVerified:false};
 }
 const jobId=String(data?.jobId||'');
 const role=action==='590:crew-challenge'?'crew':
   (action==='590:witness-preview'||action==='590:witness')?'reviewer':
    action==='590:close'?'sysop':'participant';
 if(!['590:readiness','590:crew-challenge','590:witness-preview',
  '590:witness','590:close'].includes(action))throw deny('YW590_UNRECOGNIZED_ACTION');
 if(role==='crew')await guard('crew',actor,jobId);
 if(role==='sysop')await sysop590(actor);
 const ctx=await eligible590(actor,jobId,role==='sysop'?'none':role);
 if(uuid(data?.photoId)&&ctx.photo.id!==data.photoId)throw deny('YW590_ORIGINAL_PHOTO_SCOPE_MISMATCH');
 if(action==='590:readiness'){
  const caseRows=await select('ywi_590_shell_case_closures','state',
   {company_id:COMPANY,work_order_id:jobId,photo_id:ctx.photo.id},2);
  const witnesses=await select('ywi_590_original_field_witnesses','id',
   {company_id:COMPANY,work_order_id:jobId,photo_id:ctx.photo.id},2);
  return {state:caseRows[0]?.state||'AWAITING_INDEPENDENT_ORIGINAL_DEVICE_WITNESS',
   originalPhotoCount:1,dispatcherSigned:true,originalPhotoId:ctx.photo.id,
   humanWitnessRecorded:witnesses.length===1,
   zeroInvoicesAtReadback:true,financialWrites:false,customerNotifications:false,
   machineDeviceAttested:false,masterAckVerified:false};
 }
 if(action==='590:crew-challenge'){
  const prior=await select('ywi_590_crew_challenges','id',
   {company_id:COMPANY,work_order_id:jobId,photo_id:ctx.photo.id},6);
  if(prior.length>=3)throw deny('YW590_CREW_CHALLENGE_LIMIT_THREE_PER_PHOTO');
  const witness=await select('ywi_590_original_field_witnesses','id',
   {company_id:COMPANY,photo_id:ctx.photo.id},2);
  if(witness.length)throw deny('YW590_ALREADY_HUMAN_WITNESSED');
  await bytes590(ctx.photo);
  const token=hex(crypto.getRandomValues(new Uint8Array(16)));
  const row=await insert('ywi_590_crew_challenges',{
   id:crypto.randomUUID(),company_id:COMPANY,work_order_id:jobId,
   photo_id:ctx.photo.id,crew_user_id:actor.userId,
   challenge_sha256:await digest(new TextEncoder().encode(token)),
   expires_at:new Date(now590()+10*60000).toISOString()
  });
  return {state:'CREW_ORIGINAL_DEVICE_CHALLENGE_ISSUED',
   challengeId:row.id,challengeCode:token,expiresAt:row.expires_at,
   showOnlyOnOriginalCrewDevice:true,doNotShareViaPublicLink:true,
   machineDeviceAttested:false,masterAckVerified:false};
 }
 if(action==='590:witness-preview'){
  const bytes=await bytes590(ctx.photo);
  return new Response(bytes,{status:200,headers:{
   'Content-Type':ctx.photo.object_key.endsWith('.png')?'image/png':
    ctx.photo.object_key.endsWith('.webp')?'image/webp':'image/jpeg',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
  }});
 }
 if(action==='590:witness'){
  if(data?.reviewedPrivatePhoto!==true||data?.sawOriginalCrewDevice!==true||
     !uuid(data?.challengeId)||!uuid(data?.photoId)||
     !/^[a-f0-9]{32}$/.test(String(data?.challengeCode||''))||
     !sha(data?.observedSha256))throw deny('YW590_HUMAN_PHYSICAL_REVIEW_AND_CODE_HOLD');
  if(ctx.photo.id!==data.photoId)throw deny('YW590_WITNESS_PHOTO_MISMATCH');
  if(data.observedSha256!==ctx.photo.observed_sha256)
    throw deny('YW590_WITNESS_IMAGE_HASH_MISMATCH');
  const [challenge]=await select('ywi_590_crew_challenges',
   'id,photo_id,work_order_id,company_id,crew_user_id,challenge_sha256,expires_at',
   {id:data.challengeId,company_id:COMPANY,work_order_id:jobId,photo_id:ctx.photo.id},2);
  if(!challenge||challenge.crew_user_id!==ctx.photo.uploaded_by||
    Date.parse(challenge.expires_at)<=now590()||
    await digest(new TextEncoder().encode(data.challengeCode))!==challenge.challenge_sha256)
    throw deny('YW590_ORIGINAL_CREW_DEVICE_CHALLENGE_INVALID_OR_EXPIRED');
  await bytes590(ctx.photo);
  const d=await rpc590('ywi_590_record_original_witness',{
   p_company_id:COMPANY,p_work_order_id:jobId,p_photo_id:ctx.photo.id,
   p_challenge_id:challenge.id,p_witness_user_id:actor.userId,
   p_observed_sha256:ctx.photo.observed_sha256
  });
  if(!d||d.state!=='AWAITING_INDEPENDENT_SYSOP')
    throw deny('YW590_ATOMIC_WITNESS_RECEIPT_UNCONFIRMED');
  return {state:'HUMAN_DEVICE_WITNESS_RECORDED_AWAITING_SYSOP',
   humanAttestationRecorded:true,privateBytesIndependentlyRead:true,
   financePointInTimeZero:true,caseOpened:true,
   machineHardwareAttestation:false,masterDurableAckVerified:false};
 }
 // Platform Sysop closure remains technically separate from three actual
 // company actors (uploader, dispatcher and human reviewer).
 if(!uuid(data?.photoId)||data.photoId!==ctx.photo.id||
    data?.confirmTechnicalRecovery!==true||data?.confirmNoCustomerNotice!==true)
  throw deny('YW590_SYSOP_EXPLICIT_TECHNICAL_CLOSURE_REQUIRED');
 if([ctx.photo.uploaded_by,ctx.cert.dispatcher_user_id,
   ctx.grant.independent_reviewer_id].includes(actor.userId))
  throw deny('YW590_DISTINCT_TECHNICAL_SYSOP_REQUIRED');
 const witnesses=await select('ywi_590_original_field_witnesses',
  'id,witness_user_id,observed_sha256',
  {company_id:COMPANY,work_order_id:jobId,photo_id:ctx.photo.id},2);
 if(witnesses.length!==1||witnesses[0].witness_user_id!==ctx.grant.independent_reviewer_id||
    witnesses[0].observed_sha256!==ctx.photo.observed_sha256)
  throw deny('YW590_INDEPENDENT_FIELD_WITNESS_MISSING');
 await bytes590(ctx.photo);
 const d=await rpc590('ywi_590_close_original_technical_case',{
  p_company_id:COMPANY,p_work_order_id:jobId,p_photo_id:ctx.photo.id,
  p_sysop_user_id:actor.userId,p_sha256:ctx.photo.observed_sha256
 });
 if(!d||d.state!=='ORIGINAL_CASE_CLOSED')
  throw deny('YW590_ATOMIC_CASE_CLOSURE_UNCONFIRMED');
 return {state:'ORIGINAL_CASE_CLOSED',pointInTimeFinanceIsolation:true,
  noCandidateInvoices:true,noARInvoices:true,noCustomerNotifications:true,
  redactedShellOnly:true,masterDurableAckVerified:false,
  machineHardwareAttestation:false};
}

Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const common={...cors,'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  ...common,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'}});
 const send=(body,status=200)=>Response.json(body,{status,headers:common});
 if(req.method!=='POST')return send({state:'HOLD',code:'POST_REQUIRED'},405);
 try{
  const actor=await getActor(req);
  const type=req.headers.get('content-type')||'';
  if(!type.startsWith('application/json')&&!type.startsWith('multipart/form-data'))
   throw deny('BAD_CONTENT_TYPE');
  let action,data,file;
  if(type.startsWith('multipart/form-data')){
   const form=await req.formData();
   action=String(form.get('action')||'');
   file=form.get('photo');
   data={jobId:form.get('jobId'),requestId:form.get('requestId'),
    deviceSha256:form.get('deviceSha256'),
    consent:form.get('consent')==='true',consentScope:form.get('consentScope')};
  }else{data=await req.json();action=data?.action;}
  const result=typeof action==='string'&&action.startsWith('590:')?
   await perform590(action,data,actor):await perform(action,data,actor,file);
  if(result instanceof Response)return new Response(result.body,{
   status:result.status,headers:{...common,'Content-Type':result.headers.get('Content-Type')||'application/octet-stream'}});
  return send(result);
 }catch(err){
  const code=typeof err?.code==='string'?err.code:'DEPENDENCY_OR_AUTHORITY_HOLD';
  return send({state:'HOLD',code,liveFieldCertified:false,
   noCustomerNotification:true,noFinancialMutation:true},code==='AUTH_REQUIRED'?401:403);
 }
});
