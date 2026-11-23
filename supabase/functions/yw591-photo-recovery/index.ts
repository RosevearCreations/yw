// YW591 — tenant-bound private original photo transfer service.
// JWT verified by Supabase AND /auth/v1/user; service role is SERVER ONLY.
// Original YW589/YW590 routes remain unchanged and continue to be scoped to
// Rosevear original pilot. YW591 is a separately opt-in multi-tenant facility.
// No fake users, service activations, work orders, payments, notifications,
// public image URLs or physical witness self-certification.
const BUCKET='ywi-private-device-evidence-589';
const MAX=10485760;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const id=x=>typeof x==='string'&&UUID.test(x);
const sha=x=>typeof x==='string'&&SHA.test(x);
const hex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async b=>hex(await crypto.subtle.digest('SHA-256',b));
const hold=code=>Object.assign(new Error(code),{code});
const kind=t=>t==='image/jpeg'?'jpg':t==='image/png'?'png':t==='image/webp'?'webp':null;
function magic(t,b){const a=new Uint8Array(b);return t==='image/jpeg'?
 a[0]===255&&a[1]===216&&a[2]===255:t==='image/png'?
 [137,80,78,71,13,10,26,10].every((v,i)=>a[i]===v):
 t==='image/webp'&&String.fromCharCode(...a.slice(0,4))==='RIFF'&&
 String.fromCharCode(...a.slice(8,12))==='WEBP';}
function secrets(){
 const root=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!root||!key)throw hold('YW591_SERVER_CONFIGURATION_HOLD');
 return {root,key};
}
function authHeaders(jwt){
 const {key}=secrets();return {'apikey':key,'authorization':'Bearer '+(jwt||key)};
}
async function api(path,{method='GET',body,extra={},jwt,raw=false}={}){
 const {root}=secrets();const res=await fetch(root+path,{method,
  headers:{...authHeaders(jwt),...extra},body});
 if(!res.ok)throw hold('YW591_DEPENDENCY_OR_SOURCE_HOLD');
 return raw?res.arrayBuffer():res.json();
}
function qsSelect(table,cols,terms={},limit=3){
 const q=new URLSearchParams();q.set('select',cols);
 for(const [k,v] of Object.entries(terms))q.set(k,'eq.'+String(v));
 q.set('limit',String(limit));
 return api('/rest/v1/'+table+'?'+q.toString());
}
function rpc(name,body){
 return api('/rest/v1/rpc/'+name,{method:'POST',
  extra:{'Content-Type':'application/json','Prefer':'return=representation'},
  body:JSON.stringify(body)});
}
async function actorFor(req){
 const s=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(s))
  throw hold('YW591_AUTH_REQUIRED');
 const user=await api('/auth/v1/user',{jwt:s.slice(7)});
 if(!id(user?.id))throw hold('YW591_AUTH_REQUIRED');
 const rows=await qsSelect('profiles','id,is_active,role',{id:user.id},2);
 if(rows.length!==1||rows[0].is_active!==true)throw hold('YW591_ACTIVE_PROFILE_REQUIRED');
 return {id:user.id,role:rows[0].role};
}
async function companyContext(company,actor){
 if(!id(company))throw hold('YW591_COMPANY_SCOPE_REQUIRED');
 const rows=await qsSelect('ywi_companies','id,owner_user_id',{id:company},2);
 if(rows.length!==1)throw hold('YW591_COMPANY_UNAVAILABLE');
 const owner=rows[0].owner_user_id;
 const pilot=await qsSelect('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,client_id,client_site_id,work_order_id,state,expires_at,approved_at',
  {company_id:company},2);
 if(pilot.length>1)throw hold('YW591_PILOT_AMBIGUOUS');
 const grant=pilot[0];
 const staff=await qsSelect('ywi_591_pilot_staff','user_id,role,state',
  {company_id:company,user_id:actor.id},3);
 const isOwner=owner===actor.id;
 const isReviewer=grant?.reviewer_user_id===actor.id&&actor.id!==owner;
 const isCrew=staff.some(s=>s.role==='crew'&&s.state==='APPROVED');
 const isDispatcher=staff.some(s=>s.role==='dispatcher'&&s.state==='APPROVED');
 if(!isOwner&&!isReviewer&&!isCrew&&!isDispatcher)
  throw hold('YW591_NOT_A_COMPANY_PILOT_ACTOR');
 if(grant&&grant.owner_user_id!==owner)
  throw hold('YW591_ORIGINAL_OWNER_MISMATCH');
 return {owner,grant,isOwner,isReviewer,isCrew,isDispatcher};
}
async function authorized(company,job,actor,role){
 if(!id(job))throw hold('YW591_ORIGINAL_JOB_REQUIRED');
 const context=await companyContext(company,actor);
 if(context.grant?.state!=='APPROVED'||
   !Number.isFinite(Date.parse(context.grant.expires_at))||
   Date.parse(context.grant.expires_at)<=Date.now()||
   context.grant.work_order_id!==job)
  throw hold('YW591_OWNER_REVIEWER_APPROVAL_EXPIRED_OR_MISSING');
 if(role==='crew'&&!context.isCrew)throw hold('YW591_APPROVED_CREW_REQUIRED');
 if(role==='dispatcher'&&!context.isDispatcher)throw hold('YW591_APPROVED_DISPATCHER_REQUIRED');
 if(role==='reviewer'&&!context.isReviewer)throw hold('YW591_INDEPENDENT_REVIEWER_REQUIRED');
 return context;
}
function storageKey(company,job,requestId,mime){
 return company+'/'+job+'/'+requestId+'.'+kind(mime);
}
function encoded(key){return key.split('/').map(encodeURIComponent).join('/');}
async function storageRead(key){
 const {root}=secrets();const res=await fetch(root+'/storage/v1/object/authenticated/'+
  encodeURIComponent(BUCKET)+'/'+encoded(key),{headers:authHeaders()});
 if(res.status===404)return null;
 if(!res.ok)throw hold('YW591_PRIVATE_STORAGE_READ_HOLD');
 return res.arrayBuffer();
}
async function storageWrite(key,bytes,mime){
 const {root}=secrets();
 const res=await fetch(root+'/storage/v1/object/'+encodeURIComponent(BUCKET)+'/'+
   encoded(key),{method:'POST',
   headers:{...authHeaders(),'Content-Type':mime,'x-upsert':'false','Cache-Control':'no-store'},
   body:new Uint8Array(bytes)});
 if(res.status===409)return 'CONCURRENT_PRESENT';
 if(!res.ok)throw hold('YW591_PRIVATE_STORAGE_WRITE_HOLD');
 return 'STORED';
}
function publicResult(state,other={}){
 return {state,source:'YW591',serverVerified:false,
  tenantIsolationEnforced:true,offlineBytesOnServer:false,
  liveHardwareDeviceCertified:false,masterDurableAck:false,
  financeMutation:false,customerNotification:false,...other};
}
async function originalAttempt(company,job,request){
 const rows=await qsSelect('ywi_591_photo_attempts',
  'id,company_id,work_order_id,request_id,uploaded_by,state,object_key,content_sha256,byte_count,content_type,lease_expires_at,stored_sha256',
  {company_id:company,work_order_id:job,request_id:request},2);
 if(rows.length!==1)throw hold('YW591_ORIGINAL_RESERVATION_MISSING');
 return rows[0];
}
async function perform(action,data,actor,file){
 const company=String(data?.companyId||'');
 if(action==='pilot-propose'){
  if(!id(company)||!id(data?.clientId)||!id(data?.siteId)||
    !id(data?.jobId)||!id(data?.reviewerUserId))
   throw hold('YW591_ORIGINAL_OWNER_PILOT_FIELDS_REQUIRED');
  const original=await qsSelect('ywi_companies','owner_user_id',{id:company},2);
  if(original.length!==1||original[0].owner_user_id!==actor.id)
   throw hold('YW591_ONLY_REAL_COMPANY_OWNER_MAY_PROPOSE');
  const result=await rpc('ywi_591_pilot_action',{
   p_company_id:company,p_actor_user_id:actor.id,p_action:'propose',
   p_client_id:data.clientId,p_site_id:data.siteId,p_work_order_id:data.jobId,
   p_reviewer_user_id:data.reviewerUserId});
  return publicResult(result.state,{reviewerActionRequired:true,expiresWithinDays:7});
 }
 if(['pilot-approve','pilot-revoke','staff-nominate','staff-approve','staff-revoke'].includes(action)){
  const ctx=await companyContext(company,actor);
  const isStaffAction=action.startsWith('staff-');
  if((action==='pilot-approve'||action==='staff-approve')&&!ctx.isReviewer)
   throw hold('YW591_DIFFERENT_REAL_REVIEWER_REQUIRED');
  if((action==='staff-nominate')&&!ctx.isOwner)
   throw hold('YW591_REAL_COMPANY_OWNER_REQUIRED');
  if((action==='pilot-revoke'||action==='staff-revoke')&&
    !ctx.isOwner&&!ctx.isReviewer)
   throw hold('YW591_REVOCATION_AUTHORITY_HOLD');
  if(isStaffAction&&(!id(data?.staffUserId)||!['crew','dispatcher'].includes(data?.staffRole)))
   throw hold('YW591_REAL_EXISTING_STAFF_ID_AND_ROLE_REQUIRED');
  const result=await rpc('ywi_591_pilot_action',{
   p_company_id:company,p_actor_user_id:actor.id,
   p_action:action==='pilot-approve'?'approve':
    action==='pilot-revoke'?'revoke':
    action==='staff-nominate'?'nominate-staff':
    action==='staff-approve'?'approve-staff':'revoke-staff',
   p_staff_user_id:isStaffAction?data.staffUserId:null,
   p_staff_role:isStaffAction?data.staffRole:null
  });
  return publicResult(result.state,{staffOrPilotReviewed:true,
   captureAllowed:result.state==='STAFF_APPROVED'});
 }
 if(action==='pilot-status'){
  const ctx=await companyContext(company,actor);
  const grant=ctx.grant;
  return publicResult(grant?.state||'NOT_PROPOSED',{
   companyBound:company,role:ctx.isOwner?'owner':ctx.isReviewer?'reviewer':
    ctx.isCrew?'crew':'dispatcher',
   pilotApproved:grant?.state==='APPROVED'&&Date.parse(grant.expires_at)>Date.now(),
   realStaffApprovalRequired:true,oneOriginalJobPerPilot:true
  });
 }
 const job=String(data?.jobId||'');
 if(action==='capture'||action==='resume'){
  await authorized(company,job,actor,'crew');
  const requestId=String(data?.requestId||'');
  if(!id(requestId))throw hold('YW591_REQUEST_UUID_REQUIRED');
  let attempt,mime,bytes,deviceSha;
  if(action==='capture'){
   if(data?.consent!==true||data?.consentScope!=='private_original_job'||
    !file||!(file instanceof File)||file.size<16||file.size>MAX||!kind(file.type))
    throw hold('YW591_PRIVATE_PHOTO_EXPLICIT_CONSENT_REQUIRED');
   bytes=await file.arrayBuffer();mime=file.type;
   if(!magic(mime,bytes))throw hold('YW591_IMAGE_MAGIC_REJECTED');
   deviceSha=await hash(bytes);
   if(!sha(data?.deviceSha256)||data.deviceSha256!==deviceSha)
    throw hold('YW591_CLIENT_SERVER_HASH_MISMATCH');
   const key=storageKey(company,job,requestId,mime);
   const reserved=await rpc('ywi_591_reserve_attempt',{
    p_company_id:company,p_work_order_id:job,p_actor_user_id:actor.id,
    p_request_id:requestId,p_content_sha256:deviceSha,
    p_byte_count:bytes.byteLength,p_content_type:mime,p_object_key:key});
   if(!id(reserved.attemptId))throw hold('YW591_DATABASE_RESERVATION_UNCONFIRMED');
   attempt=await originalAttempt(company,job,requestId);
   if(attempt.id!==reserved.attemptId||attempt.uploaded_by!==actor.id||
      attempt.content_sha256!==deviceSha||attempt.byte_count!==bytes.byteLength||
      attempt.content_type!==mime||attempt.object_key!==key)
    throw hold('YW591_CROSS_TENANT_ORIGINAL_ATTEMPT_MISMATCH');
  }else{
   attempt=await originalAttempt(company,job,requestId);
   if(attempt.uploaded_by!==actor.id||attempt.company_id!==company||
      attempt.work_order_id!==job)
    throw hold('YW591_ONLY_ORIGINAL_CREW_MAY_RECONCILE');
   mime=attempt.content_type;deviceSha=attempt.content_sha256;
  }
  if(attempt.state==='QUARANTINED')throw hold('YW591_QUARANTINED_REVIEW_ONLY');
  if(attempt.state==='RESERVED'&&Date.parse(attempt.lease_expires_at)<=Date.now())
   throw hold('YW591_RESERVATION_EXPIRED_SUPERVISED_REVIEW_REQUIRED');
  let stored=await storageRead(attempt.object_key),recovered=stored!==null;
  if(stored===null){
   if(action==='resume')
    return publicResult('PRIVATE_OBJECT_MISSING_RETRY_ORIGINAL_ENCRYPTED_PHOTO',{
      requestId:attempt.request_id,verified:false});
   await storageWrite(attempt.object_key,bytes,mime);
   stored=await storageRead(attempt.object_key);
   if(stored===null)throw hold('YW591_OBJECT_PENDING_PRIVATE_READBACK');
   recovered=false;
  }
  const observed=await hash(stored);
  if(observed!==deviceSha||stored.byteLength!==attempt.byte_count)
   throw hold('YW591_STORED_BYTES_MISMATCH_INDEPENDENT_QUARANTINE_REQUIRED');
  if(action==='capture'&&bytes&&await hash(bytes)!==observed)
   throw hold('YW591_ORIGINAL_DEVICE_FILE_CHANGED');
  const final=await rpc('ywi_591_finalize_attempt',{
   p_company_id:company,p_work_order_id:job,p_attempt_id:attempt.id,
   p_actor_user_id:actor.id,p_server_sha256:observed,
   p_recovered:recovered&&attempt.state!=='VERIFIED'
  });
  if(final?.state!=='VERIFIED')throw hold('YW591_IMMUTABLE_SERVER_RECEIPT_NOT_CONFIRMED');
  return publicResult(recovered?'PRIVATE_ORPHAN_OBJECT_RECONCILED':'PRIVATE_NEW_OBJECT_VERIFIED',{
   attemptId:attempt.id,companyBound:company,approvedJobId:job,
   requestId:attempt.request_id,serverVerified:true,
   recoveredAfterRetry:recovered,verifiedByteCount:stored.byteLength,
   idempotentReplay:attempt.state==='VERIFIED'
  });
 }
 if(action==='transfer-status'){
  const ctx=await authorized(company,job,actor,'participant');
  const rows=await qsSelect('ywi_591_photo_attempts',
   'id,state,request_id,lease_expires_at,recovered_after_retry',
   {company_id:company,work_order_id:job},2);
  return publicResult(rows[0]?.state||'NO_TRANSFER_RESERVED',{
   companyBound:company,originalAttemptCount:rows.length,
   resumableByOriginalCrew:rows[0]?.state==='RESERVED'&&ctx.isCrew,
   confirmedReceipt:rows[0]?.state==='VERIFIED',
   orphanReconciliationNeedsCurrentOriginalCrew:true,
   expiresAt:rows[0]?.lease_expires_at||null
  });
 }
 if(action==='dispatcher-preview'){
  await authorized(company,job,actor,'dispatcher');
  if(!id(data?.attemptId))throw hold('YW591_ORIGINAL_RECEIPT_ID_REQUIRED');
  const rows=await qsSelect('ywi_591_photo_attempts',
   'id,company_id,work_order_id,state,object_key,content_sha256,byte_count,content_type,uploaded_by',
   {company_id:company,work_order_id:job,id:data.attemptId},2);
  if(rows.length!==1||rows[0].state!=='VERIFIED'||rows[0].uploaded_by===actor.id)
   throw hold('YW591_APPROVED_DISTINCT_DISPATCHER_REQUIRED');
  const dataBytes=await storageRead(rows[0].object_key);
  if(!dataBytes||dataBytes.byteLength!==rows[0].byte_count||
    await hash(dataBytes)!==rows[0].content_sha256)
   throw hold('YW591_PRIVATE_DISPATCHER_REVIEW_HASH_MISMATCH');
  return new Response(dataBytes,{status:200,headers:{
   'Content-Type':rows[0].content_type,'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff'}});
 }
 if(action==='quarantine'){
  await authorized(company,job,actor,'reviewer');
  if(!id(data?.attemptId))throw hold('YW591_REVIEWER_ORIGINAL_ATTEMPT_ID_REQUIRED');
  const rows=await qsSelect('ywi_591_photo_attempts',
   'id,state,object_key,content_sha256',
   {company_id:company,work_order_id:job,id:data.attemptId},2);
  if(rows.length!==1||rows[0].state!=='RESERVED')
   throw hold('YW591_QUARANTINE_ONLY_RESERVED_OBJECTS');
  const bytes=await storageRead(rows[0].object_key);
  if(!bytes)throw hold('YW591_NO_STORED_OBJECT_FOR_QUARANTINE');
  const observed=await hash(bytes);
  if(observed===rows[0].content_sha256)
   throw hold('YW591_OBJECT_MATCHES_NO_QUARANTINE_ALLOWED');
  const result=await rpc('ywi_591_quarantine_attempt',{
   p_company_id:company,p_work_order_id:job,p_attempt_id:data.attemptId,
   p_reviewer_user_id:actor.id,p_observed_sha256:observed});
  return publicResult(result.state,{humanReviewerRecorded:true,
   sourceObjectRetained:true,requiresSupervisedInvestigation:true});
 }
 throw hold('YW591_ACTION_UNKNOWN');
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const common={...cors,'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  ...common,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'}});
 const send=(data,status=200)=>Response.json(data,{status,headers:common});
 if(req.method!=='POST')return send({state:'HOLD',code:'POST_REQUIRED'},405);
 try{
  const actor=await actorFor(req);
  const type=req.headers.get('content-type')||'';
  if(!type.startsWith('application/json')&&!type.startsWith('multipart/form-data'))
   throw hold('YW591_CONTENT_TYPE_REQUIRED');
  let data={},action='',file=null;
  if(type.startsWith('multipart/form-data')){
   const form=await req.formData();action=String(form.get('action')||'');
   file=form.get('photo');
   data={companyId:form.get('companyId'),jobId:form.get('jobId'),
    requestId:form.get('requestId'),deviceSha256:form.get('deviceSha256'),
    consent:form.get('consent')==='true',consentScope:form.get('consentScope')};
  }else{data=await req.json();action=data?.action;}
  const result=await perform(action,data,actor,file);
  if(result instanceof Response)return new Response(result.body,{
   status:result.status,headers:{...common,
    'Content-Type':result.headers.get('Content-Type')||'application/octet-stream'}});
  return send(result);
 }catch(error){
  return send({state:'HOLD',code:typeof error?.code==='string'?error.code:
    'YW591_DEPENDENCY_OR_AUTHORITY_HOLD',
   tenantIsolationEnforced:true,noFinanceMutation:true,noPublicPhoto:true,
   physicalWitnessCertified:false},403);
 }
});
