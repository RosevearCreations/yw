// YW592 — separate opt-in source service. Server-only custody, no photo URLs,
// account creation, client messaging, accounting, automatic deletion or invented ACK.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const BUCKET='ywi-private-device-evidence-589';
const valid=x=>typeof x==='string'&&UUID.test(x);
const reject=code=>{throw Object.assign(new Error(code),{code})};
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const utf=s=>new TextEncoder().encode(s);
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',typeof s==='string'?utf(s):s));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
function env(name){const v=Deno.env.get(name);if(!v)reject('YW592_MISSING_SERVER_'+name);return v;}
function apiKey(){return env('SUPABASE_SERVICE_ROLE_KEY');}
async function service(path,method='GET',body){
 const url=env('SUPABASE_URL')+path;
 const r=await fetch(url,{method,headers:{apikey:apiKey(),authorization:'Bearer '+apiKey(),
  ...(body?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)reject('YW592_SOURCE_SQL_OR_AUTHORITY_HOLD');
 return r.json();
}
async function select(table,cols,terms={},limit=30){
 const q=new URLSearchParams({select:cols,limit:String(limit)});
 for(const [name,value] of Object.entries(terms))q.set(name,'eq.'+value);
 return service('/rest/v1/'+table+'?'+q);
}
async function rpc(name,params){return service('/rest/v1/rpc/'+name,'POST',params);}
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))
  reject('YW592_AUTH_REQUIRED');
 const response=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:apiKey(),authorization:bearer}});
 if(!response.ok)reject('YW592_USER_SESSION_REJECTED');
 const user=await response.json();
 if(!valid(user?.id))reject('YW592_USER_ID_REQUIRED');
 const profile=await select('profiles','id,is_active',{id:user.id},2);
 if(profile.length!==1||profile[0].is_active!==true)reject('YW592_ACTIVE_ACCOUNT_REQUIRED');
 return user.id;
}
async function context(company,user){
 if(!valid(company))reject('YW592_COMPANY_UUID_REQUIRED');
 const companies=await select('ywi_companies','id,owner_user_id',{id:company},2);
 const pilots=await select('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',{company_id:company},2);
 if(companies.length!==1||pilots.length!==1||
  companies[0].owner_user_id!==pilots[0].owner_user_id)
  reject('YW592_ORIGINAL_COMPANY_PILOT_REQUIRED');
 const pilot=pilots[0],staff=await select('ywi_591_pilot_staff','user_id,role,state',
  {company_id:company,user_id:user},4);
 const owner=companies[0].owner_user_id===user;
 const reviewer=pilot.reviewer_user_id===user&&!owner;
 const crew=staff.some(x=>x.role==='crew'&&x.state==='APPROVED');
 const dispatcher=staff.some(x=>x.role==='dispatcher'&&x.state==='APPROVED');
 if(!owner&&!reviewer&&!crew&&!dispatcher)reject('YW592_NOT_CURRENT_PILOT_PARTICIPANT');
 return {pilot,owner,reviewer,crew,dispatcher};
}
function approved(ctx){
 if(ctx.pilot.state!=='APPROVED'||Date.parse(ctx.pilot.expires_at)<=Date.now())
  reject('YW592_APPROVED_UNEXPIRED_ORIGINAL_PILOT_REQUIRED');
}
async function attempt(company,id){
 if(!valid(id))reject('YW592_ORIGINAL_ATTEMPT_UUID_REQUIRED');
 const list=await select('ywi_591_photo_attempts',
  'id,company_id,work_order_id,uploaded_by,content_sha256,stored_sha256,byte_count,object_key,state,lease_expires_at,reserved_at,verified_at',
  {id,company_id:company},2);
 if(list.length!==1||list[0].company_id!==company)reject('YW592_ATTEMPT_NOT_IN_TENANT');
 return list[0];
}
async function hmacKey(name){return crypto.subtle.importKey('raw',utf(env(name)),
 {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(name,msg){return hex(await crypto.subtle.sign('HMAC',await hmacKey(name),utf(msg)));}
async function verify(name,msg,sig){
 if(typeof sig!=='string'||!SHA.test(sig))return false;
 return crypto.subtle.verify('HMAC',await hmacKey(name),
  new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16))),utf(msg));
}
async function detail(company,proposalId){
 if(!valid(proposalId))reject('YW592_PROPOSAL_UUID_REQUIRED');
 const proposals=await select('ywi_592_case_proposals',
  'id,company_id,attempt_id,owner_user_id,reviewer_user_id,action,reason_code,retention_until,review_expires_at',
  {id:proposalId,company_id:company},2);
 if(proposals.length!==1)reject('YW592_TENANT_PROPOSAL_NOT_FOUND');
 return proposals[0];
}
function decisionMessage(p,a,signedAt){
 return canonical({schema:'rosevear.yw.photo-retention-decision.v1',
  companyId:p.company_id,proposalId:p.id,attemptId:p.attempt_id,
  ownerId:p.owner_user_id,reviewerId:p.reviewer_user_id,
  action:p.action,reason:p.reason_code,retentionUntil:p.retention_until,
  sourceSha256:a.content_sha256,signedAt});
}
async function cases(company){
 const all=await select('ywi_591_photo_attempts',
  'id,company_id,work_order_id,state,lease_expires_at,reserved_at,content_sha256',
  {company_id:company},25);
 const proposals=await select('ywi_592_case_proposals',
  'id,company_id,attempt_id,action,reason_code,retention_until,review_expires_at',
  {company_id:company},25);
 const decisions=await select('ywi_592_case_decisions',
  'proposal_id,attempt_id,source_sha256,signed_at,decision_payload_sha256,server_hmac_sha256',
  {company_id:company},25);
 return Promise.all(all.map(async a=>{
  const p=proposals.find(x=>x.attempt_id===a.id),d=decisions.find(x=>x.attempt_id===a.id);
  let verifiedSignature=false;
  if(d&&p){
   const source=await attempt(company,a.id);
   // Fetch original actors to verify original human roles, never trust a UI badge.
   const full=await detail(company,p.id);
   const body=decisionMessage(full,source,d.signed_at);
   verifiedSignature=d.source_sha256===source.content_sha256&&
    await digest(body)===d.decision_payload_sha256&&
    await verify('YW592_DECISION_HMAC_KEY',body,d.server_hmac_sha256);
  }
  return {attemptId:a.id,state:a.state,leaseExpiresAt:a.lease_expires_at,
   caseStatus:d?(verifiedSignature?'SIGNED_VERIFIED':'SIGNATURE_HOLD'):
    p?'INDEPENDENT_REVIEW_PENDING':Date.parse(a.lease_expires_at)<=Date.now()?
    'LEASE_EXPIRED_TRIAGE':'NEW_TRIAGE',proposalId:p?.id||null,
   proposedAction:p?.action||null,retentionUntil:p?.retention_until||null,
   serverSignatureVerified:verifiedSignature,
   privateObjectNeverAutoDeleted:true};
 }));
}
async function storageRead(key){
 const prefix=key.split('/');
 if(prefix.length!==3||prefix.some(x=>!x||x==='..'))reject('YW592_PRIVATE_SOURCE_KEY_HOLD');
 const r=await fetch(env('SUPABASE_URL')+'/storage/v1/object/authenticated/'+
 encodeURIComponent(BUCKET)+'/'+prefix.map(encodeURIComponent).join('/'),
 {headers:{apikey:apiKey(),authorization:'Bearer '+apiKey()}});
 if(!r.ok)reject('YW592_PRIVATE_SOURCE_BYTES_UNAVAILABLE');
 return r.arrayBuffer();
}
async function forward(company,ctx,user,attemptId){
 approved(ctx);
 if(!ctx.crew)reject('YW592_ORIGINAL_CREW_REQUIRED');
 const a=await attempt(company,attemptId);
 if(a.work_order_id!==ctx.pilot.work_order_id||a.uploaded_by!==user||
  a.state!=='VERIFIED'||a.stored_sha256!==a.content_sha256)
  reject('YW592_ORIGINAL_SOURCE_VERIFIED_RECEIPT_REQUIRED');
 const bytes=await storageRead(a.object_key);
 if(bytes.byteLength!==a.byte_count||await digest(bytes)!==a.content_sha256)
  reject('YW592_PRIVATE_BYTES_DIGEST_MISMATCH');
 const endpoint=new URL(env('YW592_MASTER_RECEIPT_URL'));
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||
  endpoint.search||endpoint.hash||endpoint.hostname==='localhost'||
  /^\d+\.\d+\.\d+\.\d+$/.test(endpoint.hostname)||
  endpoint.hostname.endsWith('.local'))
  reject('YW592_MASTER_RECEIVER_URL_NOT_TRUSTED');
 const nonce=crypto.randomUUID(),observedAt=new Date().toISOString();
 const payload={schema:'rosevear.yw.source-photo-telemetry.v1',
  sourceApp:'yw',companyId:company,attemptId:a.id,originalJobId:a.work_order_id,
  requestNonce:nonce,deviceActorId:user,originalDeviceHardwareAttested:false,
  sourcePhotoSha256:a.content_sha256,sourceByteCount:a.byte_count,observedAt,
  noPersonalDetails:true,noPrivatePhotoBytes:true,noFinanceMutation:true};
 const body=canonical(payload),sourceSig=await sign('YW592_TELEMETRY_SEND_KEY',body);
 const resp=await fetch(endpoint.toString(),{method:'POST',redirect:'error',
  signal:AbortSignal.timeout(5000),headers:{
   'content-type':'application/json','x-rosevear-yw-source-signature':sourceSig},
  body});
 if(!resp.ok)reject('YW592_MASTER_RECEIVER_DID_NOT_ACCEPT');
 const received=await resp.json();
 const payloadSha=await digest(body);
 if(received?.nonce!==nonce||received?.sourceDigest!==payloadSha||
  !/^[A-Za-z0-9_-]{8,128}$/.test(received?.receiptId||'')||
  !await verify('YW592_MASTER_ACK_KEY',
   'YW592-ACK|'+received.receiptId+'|'+nonce+'|'+payloadSha,
   received.ackSignature))
  reject('YW592_MASTER_ACK_CRYPTO_NOT_VERIFIED');
 const stored=await rpc('ywi_592_record_master_receipt',{
  p_company_id:company,p_attempt_id:a.id,p_actor_id:user,
  p_receipt_id:received.receiptId,p_nonce:nonce,
  p_source_sha256:a.content_sha256,p_payload_sha256:payloadSha,
  p_ack_hmac:received.ackSignature});
 return {state:stored.state,sourceByteReadbackVerified:true,
  masterAckCryptographicallyVerified:true,receiptId:stored.receiptId,
  originalDeviceHardwareAttested:false,sourcePhotoNeverPublished:true};
}
async function perform(data,user){
 const action=data?.action,company=data?.companyId;
 const ctx=await context(company,user);
 if(action==='triage'){
  if(!ctx.owner&&!ctx.reviewer)reject('YW592_OWNER_REVIEWER_ONLY');
  return {state:'PRIVATE_CASE_TRIAGE',cases:await cases(company),
   fieldCertification:false,masterDurableAckInferred:false};
 }
 if(action==='propose'){
  approved(ctx);if(!ctx.owner)reject('YW592_REAL_OWNER_REQUIRED');
  const a=await attempt(company,data.attemptId);
  if(a.work_order_id!==ctx.pilot.work_order_id)reject('YW592_WRONG_ORIGINAL_JOB');
  return rpc('ywi_592_propose_case',{p_company_id:company,
   p_attempt_id:a.id,p_owner_user_id:user,
   p_action:data.decision,p_reason_code:data.reason});
 }
 if(action==='sign'){
  approved(ctx);if(!ctx.reviewer)reject('YW592_DISTINCT_REVIEWER_REQUIRED');
  const p=await detail(company,data.proposalId),a=await attempt(company,p.attempt_id);
  if(p.reviewer_user_id!==user||p.owner_user_id===user||
   Date.parse(p.review_expires_at)<=Date.now()||
   a.work_order_id!==ctx.pilot.work_order_id)
   reject('YW592_INDEPENDENT_REVIEW_SOURCE_HOLD');
  const signedAt=new Date().toISOString(),body=decisionMessage(p,a,signedAt);
  return rpc('ywi_592_sign_decision',{
   p_company_id:company,p_proposal_id:p.id,p_reviewer_user_id:user,
   p_signed_at:signedAt,p_source_sha256:a.content_sha256,
   p_payload_sha256:await digest(body),
   p_server_hmac:await sign('YW592_DECISION_HMAC_KEY',body)});
 }
 if(action==='forward-telemetry')
  return forward(company,ctx,user,data.attemptId);
 if(action==='field-readiness'){
  if(!ctx.owner&&!ctx.reviewer)reject('YW592_OWNER_REVIEWER_ONLY');
  const pilots=await select('ywi_591_tenant_pilots',
   'company_id,owner_user_id,reviewer_user_id,state,expires_at',{},200);
  const ack=await select('ywi_592_master_receipts','company_id,attempt_id',{},200);
  const active=new Set(pilots.filter(p=>p.state==='APPROVED'&&
   p.owner_user_id!==p.reviewer_user_id&&Date.parse(p.expires_at)>Date.now()&&
   ack.some(r=>r.company_id===p.company_id)).map(p=>p.company_id));
  return {state:active.size>=2?'TWO_TENANT_SOURCE_RECEIPT_READINESS':'HOLD_SECOND_ORIGINAL_TENANT',
   independentApprovedTenantCount:active.size,originalPhysicalWitnessCertified:false,
   thirdPartyMasterReceiptVerifiedOnlyWhenStored:true,
   noOtherTenantIdentifiersDisclosed:true};
 }
 reject('YW592_ACTION_UNKNOWN');
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const h={...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  ...h,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'}});
 const send=(data,status=200)=>Response.json(data,{status,headers:h});
 if(req.method!=='POST')return send({state:'HOLD',code:'YW592_POST_REQUIRED'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   reject('YW592_JSON_REQUIRED');
  const raw=await req.text();if(raw.length>4096)reject('YW592_REQUEST_TOO_LARGE');
  const user=await auth(req),data=JSON.parse(raw);
  return send(await perform(data,user));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW592_SOURCE_OR_AUTHORITY_HOLD',
  noAutomaticDeletion:true,noPublicPhoto:true,noFinanceMutation:true,
  originalPhysicalWitnessCertified:false,masterAckCryptographicallyVerified:false},403);}
});