// YW593: authenticated, tenant-scoped scheduling and independent review.
// All device and Master evidence stays default-HOLD until original sources exist.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const err=code=>{throw Object.assign(new Error(code),{code})};
const utf=x=>new TextEncoder().encode(x);
const hex=x=>Array.from(new Uint8Array(x),y=>y.toString(16).padStart(2,'0')).join('');
const sha=async x=>hex(await crypto.subtle.digest('SHA-256',utf(x)));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const env=k=>{const v=Deno.env.get(k);if(!v)err('YW593_SERVER_CONFIG_'+k+'_HOLD');return v;};
async function key(name){return crypto.subtle.importKey('raw',utf(env(name)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(name,msg){return hex(await crypto.subtle.sign('HMAC',await key(name),utf(msg)));}
async function verify(name,msg,sig){return typeof sig==='string'&&SHA.test(sig)&&
 crypto.subtle.verify('HMAC',await key(name),new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16))),utf(msg));}
async function service(path,method='GET',body){
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+path,{method,headers:{apikey:secret,authorization:'Bearer '+secret,
  ...(body?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)err('YW593_PRIVATE_SQL_OR_AUTHORITY_HOLD');
 return r.json();
}
async function select(table,cols,terms={},limit=25){
 const q=new URLSearchParams({select:cols,limit:String(limit)});
 for(const [k,v]of Object.entries(terms))q.set(k,'eq.'+v);
 return service('/rest/v1/'+table+'?'+q);
}
const rpc=(name,args)=>service('/rest/v1/rpc/'+name,'POST',args);
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))err('YW593_AUTH_REQUIRED');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:secret,authorization:bearer}});
 if(!r.ok)err('YW593_ORIGINAL_SESSION_INVALID');
 const actor=(await r.json()).id;
 if(!uuid(actor))err('YW593_ACTOR_UUID_REQUIRED');
 const active=await select('profiles','id,is_active',{id:actor},2);
 if(active.length!==1||active[0].is_active!==true)err('YW593_ACTIVE_AUTH_USER_REQUIRED');
 return actor;
}
async function context(company,actor){
 if(!uuid(company))err('YW593_COMPANY_UUID_REQUIRED');
 const companies=await select('ywi_companies','id,owner_user_id',{id:company},2);
 const pilots=await select('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',{company_id:company},2);
 if(companies.length!==1||pilots.length!==1||companies[0].owner_user_id!==pilots[0].owner_user_id)
  err('YW593_ORIGINAL_PILOT_SCOPE_HOLD');
 const p=pilots[0],owner=p.owner_user_id===actor,reviewer=p.reviewer_user_id===actor&&!owner;
 if(!owner&&!reviewer)err('YW593_REAL_OWNER_OR_DISTINCT_REVIEWER_ONLY');
 if(p.state!=='APPROVED'||Date.parse(p.expires_at)<=Date.now())
  err('YW593_APPROVED_UNEXPIRED_ORIGINAL_PILOT_REQUIRED');
 return {pilot:p,owner,reviewer};
}
async function attempt(company,id,pilot){
 if(!uuid(id))err('YW593_ORIGINAL_ATTEMPT_REQUIRED');
 const a=await select('ywi_591_photo_attempts',
  'id,company_id,work_order_id,uploaded_by,content_sha256,stored_sha256,state,lease_expires_at',
  {id,company_id:company},2);
 if(a.length!==1||a[0].work_order_id!==pilot.work_order_id)
  err('YW593_ORIGINAL_TENANT_ATTEMPT_HOLD');
 return a[0];
}
const reviewerMessage=(s,signedAt)=>canonical({schema:'rosevear.yw.witness-window-approval.v1',
 companyId:s.company_id,slotId:s.id,attemptId:s.attempt_id,
 ownerId:s.owner_user_id,reviewerId:s.reviewer_user_id,crewId:s.crew_user_id,
 startsAt:s.starts_at,endsAt:s.ends_at,signedAt});
async function approvalValid(s,a){
 if(!a||s.id!==a.slot_id||s.reviewer_user_id!==a.reviewer_user_id||s.company_id!==a.company_id)
  return false;
 const m=reviewerMessage(s,new Date(a.signed_at).toISOString());
 return await sha(m)===a.payload_sha256&&await verify('YW593_WITNESS_HMAC_KEY',m,a.server_hmac_sha256);
}
async function decisionValid(company,p,a,d){
 if(!p||!d||p.attempt_id!==a.id||d.attempt_id!==a.id||
  p.company_id!==company||d.company_id!==company||p.id!==d.proposal_id||
  p.reviewer_user_id!==d.reviewer_user_id||d.source_sha256!==a.content_sha256)
  return false;
 const msg=canonical({schema:'rosevear.yw.photo-retention-decision.v1',
  companyId:p.company_id,proposalId:p.id,attemptId:p.attempt_id,
  ownerId:p.owner_user_id,reviewerId:p.reviewer_user_id,action:p.action,
  reason:p.reason_code,retentionUntil:p.retention_until,
  sourceSha256:a.content_sha256,signedAt:new Date(d.signed_at).toISOString()});
 return await sha(msg)===d.decision_payload_sha256&&
  await verify('YW592_DECISION_HMAC_KEY',msg,d.server_hmac_sha256);
}
async function overview(company){
 const slots=await select('ywi_593_witness_slots',
  'id,company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at,proposed_at',
  {company_id:company});
 const approvals=await select('ywi_593_witness_approvals',
  'slot_id,company_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256',
  {company_id:company});
 const escalations=await select('ywi_593_expiry_escalations',
  'id,attempt_id,reason_code,escalated_at',{company_id:company});
 const contracts=await select('ywi_593_receiver_contracts',
  'id,company_id,request_nonce,contract_id,source_schema,ack_schema,receiver_signature,receiver_response_sha256,observed_at,expires_at',
  {company_id:company});
 return {state:'PRIVATE_RECOVERY_WITNESS_QUEUE',witnesses:await Promise.all(slots.map(async s=>({
  slotId:s.id,attemptId:s.attempt_id,startsAt:s.starts_at,endsAt:s.ends_at,
  independentReviewerVerified:await approvalValid(s,approvals.find(x=>x.slot_id===s.id)),
  physicalFieldWitnessCertified:false}))),
  escalations:escalations.map(x=>({attemptId:x.attempt_id,reasonCode:x.reason_code,
   escalatedAt:x.escalated_at,noAutomaticDeletion:true})),
  receiverContracts:contracts.map(x=>({contractId:x.contract_id,
   expiresAt:x.expires_at,receiverContractRecordOnly:true,
   notOriginalMasterSourceAck:true})),
  originalPhysicalWitnessCertified:false,noOtherTenantIdsDisclosed:true};
}
async function probeReceiver(company,actor){
 const url=new URL(env('YW592_MASTER_RECEIPT_URL'));
 const allowed=env('YW593_MASTER_ALLOWED_HOST').toLowerCase();
 if(url.protocol!=='https:'||url.hostname.toLowerCase()!==allowed||
  url.username||url.password||url.search||url.hash||url.port||
  allowed==='localhost'||allowed.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(allowed)||
  allowed.includes(':')||!allowed.includes('.'))
  err('YW593_EXPLICIT_PINNED_HTTPS_RECEIVER_REQUIRED');
 const nonce=crypto.randomUUID(),payload={schema:'rosevear.yw.receiver-contract-probe.v1',
  companyId:company,requestNonce:nonce,sourceApp:'yw',
  acceptedSourceSchemaRequired:'rosevear.yw.source-photo-telemetry.v1',
  acceptedAckSchemaRequired:'YW592-ACK',noSourceBytes:true,noPersonalDetails:true};
 const body=canonical(payload);
 const r=await fetch(url.toString(),{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
  headers:{'content-type':'application/json',
   'x-rosevear-yw-source-signature':await sign('YW592_TELEMETRY_SEND_KEY',body)},body});
 if(!r.ok)err('YW593_RECEIVER_CONTRACT_NOT_SUPPORTED');
 const response=await r.json();
 const {contractId,companyId,requestNonce,acceptedSourceSchema,acceptedAckSchema,signature}=response||{};
 if(companyId!==company||requestNonce!==nonce||
  !/^[A-Za-z0-9_-]{8,128}$/.test(contractId||'')||
  acceptedSourceSchema!=='rosevear.yw.source-photo-telemetry.v1'||
  acceptedAckSchema!=='YW592-ACK'||
  !await verify('YW592_MASTER_ACK_KEY',
   'YW593-CONTRACT|'+contractId+'|'+company+'|'+nonce+'|'+acceptedSourceSchema+'|'+acceptedAckSchema,
   signature))
  err('YW593_RECEIVER_CONTRACT_SIGNATURE_OR_SCHEMA_HOLD');
 return rpc('ywi_593_record_receiver_contract',{
  p_company_id:company,p_owner_user_id:actor,p_nonce:nonce,p_contract_id:contractId,
  p_response_sha256:await sha(canonical({contractId,companyId,requestNonce,
    acceptedSourceSchema,acceptedAckSchema})),p_receiver_signature:signature});
}
async function perform(data,actor){
 const company=data?.companyId,ctx=await context(company,actor),action=data?.action;
 if(action==='overview')return overview(company);
 if(action==='schedule'){
  if(!ctx.owner)err('YW593_ORIGINAL_OWNER_ONLY');
  const a=await attempt(company,data.attemptId,ctx.pilot);
  if(!uuid(data.crewUserId)||a.uploaded_by!==data.crewUserId)
   err('YW593_SAME_ORIGINAL_UPLOADER_REQUIRED');
  const start=Date.parse(data.startsAt),end=Date.parse(data.endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<Date.now()+1800000||
    start>Date.now()+14*86400000||end<=start+29*60000||end>start+3*3600000)
   err('YW593_BOUNDED_FUTURE_WITNESS_WINDOW_REQUIRED');
  return rpc('ywi_593_schedule_witness',{p_company_id:company,
   p_attempt_id:a.id,p_owner_user_id:actor,p_crew_user_id:data.crewUserId,
   p_starts_at:new Date(start).toISOString(),p_ends_at:new Date(end).toISOString()});
 }
 if(action==='approve-witness'){
  if(!ctx.reviewer||!uuid(data.slotId))err('YW593_DISTINCT_REVIEWER_ONLY');
  const slots=await select('ywi_593_witness_slots',
   'id,company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at',
   {id:data.slotId,company_id:company},2);
  if(slots.length!==1||slots[0].reviewer_user_id!==actor||
   Date.parse(slots[0].starts_at)<=Date.now())err('YW593_WITNESS_WINDOW_OR_SCOPE_HOLD');
  const signedAt=new Date().toISOString(),message=reviewerMessage(slots[0],signedAt);
  return rpc('ywi_593_approve_witness',{p_company_id:company,p_slot_id:data.slotId,
   p_reviewer_user_id:actor,p_signed_at:signedAt,
   p_payload_sha256:await sha(message),
   p_server_hmac:await sign('YW593_WITNESS_HMAC_KEY',message)});
 }
 if(action==='escalate-expiry'){
  if(!ctx.reviewer||!uuid(data.proposalId))err('YW593_INDEPENDENT_REVIEWER_ONLY');
  const a=await attempt(company,data.attemptId,ctx.pilot);
  const ps=await select('ywi_592_case_proposals',
   'id,company_id,attempt_id,owner_user_id,reviewer_user_id,action,reason_code,retention_until,review_expires_at',
   {id:data.proposalId,company_id:company},2);
  const ds=await select('ywi_592_case_decisions',
   'proposal_id,attempt_id,company_id,reviewer_user_id,source_sha256,signed_at,decision_payload_sha256,server_hmac_sha256',
   {proposal_id:data.proposalId,company_id:company},2);
  if(!await decisionValid(company,ps[0],a,ds[0])||ps[0].reviewer_user_id!==actor)
   err('YW593_SIGNED_592_DECISION_VERIFY_HOLD');
  const reason=data.reasonCode, due=reason==='LEASE_EXPIRED'&&ps[0].action==='EXPIRY_REVIEW'&&
    Date.parse(a.lease_expires_at)<=Date.now()||
   reason==='RETENTION_DUE'&&['RETAIN_30_DAYS','RETAIN_90_DAYS'].includes(ps[0].action)&&
    Date.parse(ps[0].retention_until)<=Date.now()||
   reason==='LEGAL_HOLD_REVIEW'&&ps[0].action==='LEGAL_HOLD_REVIEW';
  if(!due)err('YW593_NOT_DUE_FOR_ESCALATION');
  return rpc('ywi_593_escalate_expiry',{p_company_id:company,
   p_attempt_id:a.id,p_proposal_id:ps[0].id,
   p_reviewer_user_id:actor,p_reason_code:reason});
 }
 if(action==='probe-receiver-contract'){
  if(!ctx.owner)err('YW593_OWNER_RECEIVER_ENROLLMENT_REQUIRED');
  return probeReceiver(company,actor);
 }
 err('YW593_ACTION_UNKNOWN');
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const h={...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  ...h,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'}});
 const send=(v,status=200)=>Response.json(v,{status,headers:h});
 if(req.method!=='POST')return send({state:'HOLD',code:'YW593_POST_REQUIRED'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   err('YW593_JSON_REQUIRED');
  const raw=await req.text();if(raw.length>4096)err('YW593_REQUEST_TOO_LARGE');
  const actor=await auth(req),data=JSON.parse(raw);
  return send(await perform(data,actor));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW593_AUTH_OR_SOURCE_HOLD',
  noAutomaticDeletion:true,noCustomerNotice:true,noPrivatePhotoExposed:true,
  originalPhysicalWitnessCertified:false,masterAckCryptographicallyVerified:false},403);}
});
