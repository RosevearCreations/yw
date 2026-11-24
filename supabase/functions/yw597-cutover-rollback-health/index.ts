// YW597: signed original-person manual cutover custody, independent read-only
// rollback-readiness challenge and continuous passive Master ACK evidence watchdog.
// NEVER switches/retires actual receiver keys, sends source bytes or claims remote execution.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const valid=x=>typeof x==='string'&&UUID.test(x);
const err=code=>{throw Object.assign(new Error(code),{code})};
const utf=s=>new TextEncoder().encode(s);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const sha=async x=>hex(await crypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x));
const env=k=>{const v=Deno.env.get(k);if(!v)err('YW597_PRIVATE_SERVER_CONFIG_'+k+'_HOLD');return v;};
async function key(n){return crypto.subtle.importKey('raw',utf(env(n)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(n,msg){return hex(await crypto.subtle.sign('HMAC',await key(n),utf(msg)));}
async function verify(n,msg,sig){return typeof sig==='string'&&SHA.test(sig)&&
 crypto.subtle.verify('HMAC',await key(n),new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16))),utf(msg));}
async function service(path,method='GET',data){
 const k=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+path,{method,headers:{apikey:k,authorization:'Bearer '+k,
  ...(data?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})});
 if(!r.ok)err('YW597_ORIGINAL_PRIVATE_DB_OR_AUTHORITY_HOLD');
 return r.json();
}
async function select(table,cols,filters={},limit=25){
 const q=new URLSearchParams({select:cols,limit:String(limit)});
 for(const [k,v] of Object.entries(filters))q.set(k,'eq.'+v);
 return service('/rest/v1/'+table+'?'+q);
}
async function one(table,cols,filters,code){
 const a=await select(table,cols,filters,2);
 if(a.length!==1)err(code);return a[0];
}
const rpc=(fn,data)=>service('/rest/v1/rpc/'+fn,'POST',data);
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))
  err('YW597_ORIGINAL_JWT_REQUIRED');
 const k=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:k,authorization:bearer}});
 if(!r.ok)err('YW597_ORIGINAL_SESSION_INVALID');
 const user=(await r.json()).id;
 if(!valid(user))err('YW597_ACTUAL_AUTH_USER_REQUIRED');
 const profile=await one('profiles','id,role,is_active',{id:user},
  'YW597_CURRENT_ACTIVE_PROFILE_REQUIRED');
 if(profile.is_active!==true)err('YW597_ACCOUNT_INACTIVE');
 return {user,profile};
}
async function admin(actor){
 if(actor.profile.role!=='admin')err('YW597_REAL_PLATFORM_ADMIN_ROLE_REQUIRED');
 const x=await select('ywi_platform_administrators_489','user_id',{user_id:actor.user},2);
 if(x.length!==1)err('YW597_PLATFORM_SYSOP_REGISTRY_ENROLMENT_REQUIRED');
}
async function tenant(company,actor){
 if(!valid(company))err('YW597_COMPANY_ID_REQUIRED');
 const c=await one('ywi_companies','id,owner_user_id',{id:company},
  'YW597_REAL_ORIGINAL_COMPANY_MISSING');
 const p=await one('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',
  {company_id:company},'YW597_ORIGINAL_FIELD_PILOT_NOT_ENROLLED');
 if(p.owner_user_id!==c.owner_user_id||p.state!=='APPROVED'||Date.parse(p.expires_at)<=Date.now())
  err('YW597_ORIGINAL_APPROVED_UNEXPIRED_PILOT_REQUIRED');
 const owner=p.owner_user_id===actor.user,reviewer=p.reviewer_user_id===actor.user&&!owner;
 if(!owner&&!reviewer)err('YW597_TENANT_OWNER_OR_INDEPENDENT_REVIEWER_ONLY');
 return {p,owner,reviewer};
}
const rotationFields='id,company_id,prior_contract_id,candidate_contract_id,owner_user_id,reviewer_user_id,reason,custody_only,proposed_at';
const contractFields='id,company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,receiver_response_sha256,receiver_signature,observed_at,expires_at';
async function contract(company,id,allowExpired){
 const c=await one('ywi_593_receiver_contracts',contractFields,{company_id:company,id},
  'YW597_SIGNED_MASTER_RECEIVER_CONTRACT_REQUIRED');
 if(c.source_schema!=='rosevear.yw.source-photo-telemetry.v1'||c.ack_schema!=='YW592-ACK'||
  !allowExpired&&Date.parse(c.expires_at)<=Date.now())
  err('YW597_SIGNED_ORIGINAL_MASTER_CONTRACT_VERSION_HOLD');
 const msg='YW593-CONTRACT|'+c.contract_id+'|'+company+'|'+c.request_nonce+
  '|'+c.source_schema+'|'+c.ack_schema;
 if(!await verify('YW592_MASTER_ACK_KEY',msg,c.receiver_signature)||
  await sha(canon({contractId:c.contract_id,companyId:company,
   requestNonce:c.request_nonce,acceptedSourceSchema:c.source_schema,
   acceptedAckSchema:c.ack_schema}))!==c.receiver_response_sha256)
  err('YW597_RECEIVER_CONTRACT_AUTHENTICITY_HOLD');
 return c;
}
async function rotation(company,id){
 if(!valid(id))err('YW597_SIGNED_ROTATION_UUID_REQUIRED');
 const r=await one('ywi_595_rotation_proposals',rotationFields,{id,company_id:company},
  'YW597_YW595_REAL_ROTATION_NOT_FOUND');
 if(r.custody_only!==true||r.owner_user_id===r.reviewer_user_id)
  err('YW597_TWO_DISTINCT_REAL_ROTATION_PRINCIPALS_REQUIRED');
 const oldc=await contract(company,r.prior_contract_id,true);
 const newc=await contract(company,r.candidate_contract_id,false);
 if(oldc.contract_id===newc.contract_id||oldc.owner_user_id!==r.owner_user_id||
  newc.owner_user_id!==r.owner_user_id)err('YW597_REAL_OLD_AND_NEXT_MASTER_CONTRACTS_REQUIRED');
 const a=await one('ywi_595_rotation_signoffs',
  'id,company_id,proposal_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,actual_secret_rotated',
  {proposal_id:r.id,company_id:company},'YW597_ORIGINAL_REVIEWER_ROTATION_SIGNOFF_REQUIRED');
 const msg=canon({schema:'rosevear.yw.receiver-rotation-custody.v1',
  companyId:company,rotationId:r.id,ownerId:r.owner_user_id,
  reviewerId:r.reviewer_user_id,priorContractRecordId:oldc.id,
  candidateContractRecordId:newc.id,priorContractId:oldc.contract_id,
  candidateContractId:newc.contract_id,priorReceiverHmac:oldc.receiver_signature,
  candidateReceiverHmac:newc.receiver_signature,reason:r.reason,
  proposedAt:r.proposed_at,signedAt:new Date(a.signed_at).toISOString(),
  actualSecretRotated:false,remoteEndpointChanged:false});
 if(a.actual_secret_rotated!==false||a.reviewer_user_id!==r.reviewer_user_id||
  await sha(msg)!==a.payload_sha256||
  !await verify('YW595_ROTATION_HMAC_KEY',msg,a.server_hmac_sha256))
  err('YW597_INDEPENDENT_YW595_ROTATION_SIGNATURE_HOLD');
 return {r,oldc,newc,signoff:a};
}
const proofFields='id,company_id,rotation_id,signoff_id,owner_user_id,request_nonce,response_sha256,old_receiver_hmac,next_receiver_hmac,received_at,actual_secret_rotated,observed_state';
async function proof(company,id){
 if(!valid(id))err('YW597_ORIGINAL_DUAL_KEY_PROOF_UUID_REQUIRED');
 const p=await one('ywi_596_rotation_proofs',proofFields,{id,company_id:company},
  'YW597_GENUINE_DUAL_RECEIVER_PROOF_MISSING');
 const rot=await rotation(company,p.rotation_id);
 if(p.owner_user_id!==rot.r.owner_user_id||p.signoff_id!==rot.signoff.id||
  p.observed_state!=='DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY'||p.actual_secret_rotated!==false)
  err('YW597_DUAL_KEY_PROOF_BINDING_HOLD');
 const common=rot.r.id+'|'+company+'|'+p.request_nonce+'|'+rot.oldc.contract_id+
  '|'+rot.newc.contract_id+'|YW592-ACK';
 if(!await verify('YW592_MASTER_ACK_KEY','YW596-ROTATE-OLD|'+common,p.old_receiver_hmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW596-ROTATE-NEXT|'+common,p.next_receiver_hmac)||
  p.response_sha256!==await sha(canon({schema:'rosevear.yw.receiver-dual-key-probe-ack.v1',
   companyId:company,rotationId:rot.r.id,requestNonce:p.request_nonce,
   priorContractId:rot.oldc.contract_id,candidateContractId:rot.newc.contract_id,
   acceptedAckSchema:'YW592-ACK'})))
  err('YW597_CRYPTOGRAPHIC_OLD_AND_NEXT_MASTER_PROOF_HOLD');
 return {p,rot};
}
const canaryFields='id,company_id,rotation_proof_id,prior_ack_id,next_attempt_id,source_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,next_ack_hmac,acknowledged_at,no_private_object_transferred';
async function canary(company,id){
 if(!valid(id))err('YW597_REAL_SOURCE_CANARY_ID_REQUIRED');
 const c=await one('ywi_596_canary_acks',canaryFields,{id,company_id:company},
  'YW597_ORIGINAL_NEXT_ACK_REQUIRED');
 const pp=await proof(company,c.rotation_proof_id);
 const prior=await one('ywi_592_master_receipts',
  'id,company_id,attempt_id,device_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,master_ack_hmac_sha256,received_at',
  {company_id:company,id:c.prior_ack_id},'YW597_REAL_PREVIOUS_MASTER_RECEIPT_REQUIRED');
 const next=await one('ywi_591_photo_attempts',
  'id,company_id,uploaded_by,state,content_sha256,stored_sha256',
  {company_id:company,id:c.next_attempt_id},'YW597_ORIGINAL_NEXT_SOURCE_ATTEMPT_REQUIRED');
 if(prior.device_actor_id!==c.source_actor_id||c.source_actor_id!==next.uploaded_by||
  prior.attempt_id===next.id||prior.source_sha256===c.source_sha256||
  next.content_sha256!==c.source_sha256||next.stored_sha256!==next.content_sha256||
  next.state!=='VERIFIED'||c.no_private_object_transferred!==true||
  Date.parse(c.acknowledged_at)<=Date.parse(prior.received_at)||
  Date.parse(c.acknowledged_at)<Date.parse(pp.p.received_at)||
  !await verify('YW592_MASTER_ACK_KEY',
   'YW592-ACK|'+prior.master_receipt_id+'|'+prior.request_nonce+'|'+prior.payload_sha256,
   prior.master_ack_hmac_sha256))
  err('YW597_VERIFIED_ORIGINAL_OLD_AND_NEXT_SOURCE_CONTINUITY_HOLD');
 const req={schema:'rosevear.yw.receiver-next-source-canary.v1',companyId:company,
  rotationId:pp.rot.r.id,requestNonce:c.request_nonce,sourceApp:'yw',
  sourceActorId:c.source_actor_id,attemptId:next.id,sourceSha256:c.source_sha256,
  acceptedAckSchemaRequired:'YW596-NEXT-ACK',noSourceBytes:true,noCustomerDetails:true};
 const message='YW596-NEXT-ACK|'+c.master_receipt_id+'|'+company+'|'+next.id+
  '|'+c.request_nonce+'|'+c.source_sha256+'|'+c.payload_sha256;
 if(await sha(canon(req))!==c.payload_sha256||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY',message,c.next_ack_hmac))
  err('YW597_INDEPENDENT_NEW_KEY_SOURCE_RECEIPT_SIGNATURE_HOLD');
 return {c,pp,prior};
}
const intentFields='id,company_id,proof_id,canary_id,owner_user_id,reviewer_user_id,consent_at,expires_at,actual_key_changed';
async function intent(company,id){
 if(!valid(id))err('YW597_ORIGINAL_CUTOVER_INTENT_ID_REQUIRED');
 const i=await one('ywi_597_cutover_intents',intentFields,{id,company_id:company},
  'YW597_REAL_OWNER_CUTOVER_INTENT_REQUIRED');
 if(Date.parse(i.expires_at)<=Date.now()||i.actual_key_changed!==false)
  err('YW597_CUTOVER_INTENT_EXPIRED_OR_EXECUTED_HOLD');
 return i;
}
function pinned(){
 const u=new URL(env('YW592_MASTER_RECEIPT_URL'));
 const hostname=env('YW593_MASTER_ALLOWED_HOST').toLowerCase();
 if(u.protocol!=='https:'||u.hostname.toLowerCase()!==hostname||u.port||
  u.username||u.password||u.search||u.hash||!hostname.includes('.')||
  hostname==='localhost'||hostname.endsWith('.local')||hostname.includes(':')||
  /^\d+\.\d+\.\d+\.\d+$/.test(hostname))
  err('YW597_ORIGINAL_PINNED_HTTPS_MASTER_ONLY');
 return u.toString();
}
async function remote(body){
 const payload=canon(body);
 const r=await fetch(pinned(),{method:'POST',redirect:'error',
  signal:AbortSignal.timeout(5000),headers:{
   'content-type':'application/json',
   'x-rosevear-yw-source-signature':await sign('YW592_TELEMETRY_SEND_KEY',payload)},
  body:payload});
 if(!r.ok)err('YW597_ORIGINAL_MASTER_RECEIVER_RESPONSE_HOLD');
 const text=await r.text();
 if(text.length>4096)err('YW597_OVERSIZED_RECEIVER_RESPONSE_HOLD');
 try{return JSON.parse(text)}catch{err('YW597_UNVERIFIABLE_RECEIVER_RESPONSE_HOLD')}
}
function rollbackMsg(i,rot,nonce){
 return i.id+'|'+i.company_id+'|'+nonce+'|'+rot.oldc.contract_id+
  '|'+rot.newc.contract_id+'|YW592-ACK';
}
async function verifyRollback(response,i,rot,nonce){
 if(response?.schema!=='rosevear.yw.receiver-rollback-readiness-ack.v1'||
  response.companyId!==i.company_id||response.intentId!==i.id||
  response.requestNonce!==nonce||
  response.priorContractId!==rot.oldc.contract_id||
  response.candidateContractId!==rot.newc.contract_id||
  response.acceptedAckSchema!=='YW592-ACK'||
  response.previousKeyAccepted!==true||response.candidateKeyAccepted!==true||
  response.rollbackExecutionPerformed!==false)
  err('YW597_RECEIVER_READINESS_PROTOCOL_OR_NONCE_HOLD');
 const msg=rollbackMsg(i,rot,nonce);
 if(!await verify('YW592_MASTER_ACK_KEY','YW597-ROLLBACK-OLD|'+msg,response.oldHmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW597-ROLLBACK-NEXT|'+msg,response.nextHmac))
  err('YW597_UNVERIFIED_CRYPTOGRAPHIC_ROLLBACK_READINESS_HOLD');
 return await sha(canon({schema:response.schema,companyId:response.companyId,
  intentId:response.intentId,requestNonce:response.requestNonce,
  priorContractId:response.priorContractId,candidateContractId:response.candidateContractId,
  acceptedAckSchema:response.acceptedAckSchema,
  previousKeyAccepted:true,candidateKeyAccepted:true,rollbackExecutionPerformed:false}));
}
async function begin(company,actor,ctx,data){
 if(!ctx.owner||data.confirmOriginalOwnerIntent!==true)
  err('YW597_ORIGINAL_OWNER_EXPLICIT_CUTOVER_REQUEST_REQUIRED');
 const pr=await proof(company,data.dualKeyProofId);
 const c=await canary(company,data.canaryId);
 if(pr.p.id!==c.pp.p.id||c.c.acknowledged_at<Date.now()-72*3600000||
  pr.rot.r.owner_user_id!==actor.user||
  pr.rot.r.reviewer_user_id!==ctx.p.reviewer_user_id)
  err('YW597_SAME_REAL_FRESH_ORIGINAL_MASTER_ACK_CHAIN_REQUIRED');
 return rpc('ywi_597_begin_cutover',{p_company_id:company,
  p_proof_id:pr.p.id,p_canary_id:c.c.id,p_owner_user_id:actor.user});
}
async function rollback(company,actor,data){
 await admin(actor);
 const i=await intent(company,data.intentId);
 const cp=await canary(company,i.canary_id);
 const pr=await proof(company,i.proof_id);
 if(cp.pp.p.id!==pr.p.id||i.owner_user_id!==pr.rot.r.owner_user_id||
  i.reviewer_user_id!==pr.rot.r.reviewer_user_id||
  [i.owner_user_id,i.reviewer_user_id,cp.c.source_actor_id].includes(actor.user)||
  data.confirmReadOnlyRollbackDrill!==true)
  err('YW597_DISTINCT_SYSOP_AND_EXPLICIT_READONLY_ROLLBACK_PROOF_REQUIRED');
 const nonce=crypto.randomUUID();
 const response=await remote({schema:'rosevear.yw.receiver-rollback-readiness.v1',
  companyId:company,intentId:i.id,requestNonce:nonce,
  priorContractId:pr.rot.oldc.contract_id,candidateContractId:pr.rot.newc.contract_id,
  acceptedAckSchemaRequired:'YW592-ACK',readOnly:true,noRemoteMutation:true,noSourceBytes:true});
 const responseSha=await verifyRollback(response,i,pr.rot,nonce);
 return rpc('ywi_597_record_rollback',{p_company_id:company,p_intent_id:i.id,
  p_auditor_user_id:actor.user,p_nonce:nonce,p_old_hmac:response.oldHmac,
  p_next_hmac:response.nextHmac,p_response_sha256:responseSha,
  p_observed_at:new Date().toISOString()});
}
const rollbackFields='id,company_id,intent_id,auditor_user_id,challenge_nonce,prior_hmac,next_hmac,remote_response_sha256,observed_at,readiness_only,actual_rollback_performed';
async function verifyStoredRollback(company,i,id){
 const rb=await one('ywi_597_rollback_proofs',rollbackFields,
  {company_id:company,id},'YW597_ORIGINAL_INDEPENDENT_ROLLBACK_PROOF_REQUIRED');
 const pr=await proof(company,i.proof_id);
 if(rb.intent_id!==i.id||rb.readiness_only!==true||rb.actual_rollback_performed!==false||
  Date.parse(rb.observed_at)<Date.now()-15*60000)
  err('YW597_RECENT_READONLY_ROLLBACK_READINESS_ONLY_REQUIRED');
 const msg=rollbackMsg(i,pr.rot,rb.challenge_nonce);
 if(!await verify('YW592_MASTER_ACK_KEY','YW597-ROLLBACK-OLD|'+msg,rb.prior_hmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW597-ROLLBACK-NEXT|'+msg,rb.next_hmac)||
  rb.remote_response_sha256!==await sha(canon({schema:'rosevear.yw.receiver-rollback-readiness-ack.v1',
   companyId:company,intentId:i.id,requestNonce:rb.challenge_nonce,
   priorContractId:pr.rot.oldc.contract_id,candidateContractId:pr.rot.newc.contract_id,
   acceptedAckSchema:'YW592-ACK',previousKeyAccepted:true,candidateKeyAccepted:true,
   rollbackExecutionPerformed:false})))
  err('YW597_CRYPTOGRAPHICALLY_INVALID_REMOTE_ROLLBACK_READINESS_HOLD');
 return rb;
}
function approvalMessage(i,rb,reviewer,signedAt){
 return canon({schema:'rosevear.yw.independently-authorized-manual-cutover.v1',
  companyId:i.company_id,intentId:i.id,rollbackProofId:rb.id,
  ownerId:i.owner_user_id,reviewerId:reviewer,platformAuditorId:rb.auditor_user_id,
  originalProofId:i.proof_id,originalCanaryId:i.canary_id,
  signedAt,scope:'MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED',
  receiverSecretChanged:false,originalMasterRevoked:false,rollbackExecuted:false});
}
async function approve(company,actor,ctx,data){
 if(!ctx.reviewer||data.confirmIndependentManualAuthorization!==true)
  err('YW597_DISTINCT_REVIEWER_EXPLICIT_MANUAL_AUTHORIZATION_REQUIRED');
 const i=await intent(company,data.intentId);
 const rb=await verifyStoredRollback(company,i,data.rollbackProofId);
 if(i.reviewer_user_id!==actor.user||
  [i.owner_user_id,i.reviewer_user_id].includes(rb.auditor_user_id))
  err('YW597_SEPARATE_CURRENT_REVIEWER_AND_INDEPENDENT_PLATFORM_AUDITOR_REQUIRED');
 const signedAt=new Date().toISOString(),message=approvalMessage(i,rb,actor.user,signedAt);
 return rpc('ywi_597_authorize_cutover',{p_company_id:company,p_intent_id:i.id,
  p_rollback_proof_id:rb.id,p_reviewer_user_id:actor.user,p_signed_at:signedAt,
  p_payload_sha256:await sha(message),
  p_server_hmac:await sign('YW597_CUTOVER_HMAC_KEY',message)});
}
const approvalFields='id,company_id,intent_id,rollback_proof_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,approval_scope,actually_cut_over';
async function approval(company,id){
 if(!valid(id))err('YW597_ORIGINAL_APPROVAL_UUID_REQUIRED');
 const a=await one('ywi_597_cutover_approvals',approvalFields,
  {company_id:company,id},'YW597_INDEPENDENT_MANUAL_AUTHORIZATION_NOT_FOUND');
 const i=await intent(company,a.intent_id);
 const rb=await verifyStoredRollback(company,i,a.rollback_proof_id);
 const msg=approvalMessage(i,rb,a.reviewer_user_id,new Date(a.signed_at).toISOString());
 if(i.reviewer_user_id!==a.reviewer_user_id||
  a.approval_scope!=='MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED'||a.actually_cut_over!==false||
  await sha(msg)!==a.payload_sha256||
  !await verify('YW597_CUTOVER_HMAC_KEY',msg,a.server_hmac_sha256))
  err('YW597_ORIGINAL_INDEPENDENT_CUTOVER_APPROVAL_SIGNATURE_HOLD');
 return {a,i,rb};
}
async function enroll(company,actor,ctx,data){
 if(!ctx.owner||data.confirmWatchOnly!==true)
  err('YW597_ORIGINAL_OWNER_EXPLICIT_PASSIVE_MONITOR_CONSENT_REQUIRED');
 const a=await approval(company,data.approvalId);
 if(a.i.owner_user_id!==actor.user)err('YW597_WATCH_CANNOT_BE_ENROLLED_BY_NONOWNER');
 return rpc('ywi_597_enroll_health',{p_company_id:company,
  p_approval_id:a.a.id,p_owner_user_id:actor.user});
}
const watchFields='id,company_id,approval_id,owner_user_id,started_at,expires_at,sample_period_minutes,passive_monitor_only';
async function watch(company,id){
 if(!valid(id))err('YW597_ENROLLED_HEALTH_WATCH_UUID_REQUIRED');
 const e=await one('ywi_597_health_enrollments',watchFields,
  {id,company_id:company},'YW597_REAL_MONITOR_ENROLLMENT_REQUIRED');
 if(e.passive_monitor_only!==true||e.sample_period_minutes!==15||Date.parse(e.expires_at)<=Date.now())
  err('YW597_HEALTH_WATCH_NOT_ACTIVE');
 return e;
}
function healthMsg(e,nonce,oldc,newc){
 return e.id+'|'+e.company_id+'|'+nonce+'|'+oldc.contract_id+
  '|'+newc.contract_id+'|YW592-ACK';
}
function healthEvent(e,nonce,when,remoteDigest,state){
 return canon({schema:'rosevear.yw.signed-master-health-sample.v1',
  companyId:e.company_id,enrollmentId:e.id,ownerId:e.owner_user_id,
  nonce,observedAt:when,remoteResponseSha256:remoteDigest,
  state,actualSecretChanged:false,noAutomaticKeyAction:true});
}
async function health(company,actor,ctx,data){
 if(!ctx.owner||data.confirmReadOnlyProbe!==true)
  err('YW597_REAL_OWNER_READONLY_HEALTH_PROBE_CONFIRMATION_REQUIRED');
 const e=await watch(company,data.enrollmentId);
 if(e.owner_user_id!==actor.user)err('YW597_ORIGINAL_ENROLLED_OWNER_ONLY');
 const a=await approval(company,e.approval_id);
 const pr=await proof(company,a.i.proof_id);
 if(a.i.owner_user_id!==actor.user||pr.rot.r.reviewer_user_id!==ctx.p.reviewer_user_id)
  err('YW597_STALE_ORIGINAL_INDEPENDENT_PILOT_AUTHORITY_HOLD');
 const nonce=crypto.randomUUID();
 const res=await remote({schema:'rosevear.yw.receiver-health-probe.v1',
  companyId:company,enrollmentId:e.id,requestNonce:nonce,
  priorContractId:pr.rot.oldc.contract_id,candidateContractId:pr.rot.newc.contract_id,
  acceptedAckSchemaRequired:'YW592-ACK',readOnly:true,noSourceBytes:true});
 if(res?.schema!=='rosevear.yw.receiver-health-probe-ack.v1'||
  res.companyId!==company||res.enrollmentId!==e.id||res.requestNonce!==nonce||
  res.priorContractId!==pr.rot.oldc.contract_id||
  res.candidateContractId!==pr.rot.newc.contract_id||
  res.acceptedAckSchema!=='YW592-ACK'||res.noKeyChange!==true)
  err('YW597_RECEIVER_LIVE_HEALTH_PROTOCOL_OR_NONCE_HOLD');
 const msg=healthMsg(e,nonce,pr.rot.oldc,pr.rot.newc);
 if(!await verify('YW592_MASTER_ACK_KEY','YW597-HEALTH-OLD|'+msg,res.oldHmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW597-HEALTH-NEXT|'+msg,res.nextHmac))
  err('YW597_TWO_KEY_MASTER_ACK_HEALTH_SIGNATURE_HOLD');
 const remoteHash=await sha(canon({schema:res.schema,companyId:res.companyId,
  enrollmentId:res.enrollmentId,requestNonce:res.requestNonce,
  priorContractId:res.priorContractId,candidateContractId:res.candidateContractId,
  acceptedAckSchema:'YW592-ACK',noKeyChange:true}));
 const observed=new Date().toISOString(),state='SIGNED_OLD_AND_NEXT_MATCH';
 const localEvent=healthEvent(e,nonce,observed,remoteHash,state);
 return rpc('ywi_597_record_health',{p_company_id:company,p_enrollment_id:e.id,
  p_actor_user_id:actor.user,p_nonce:nonce,p_old_hmac:res.oldHmac,p_next_hmac:res.nextHmac,
  p_remote_sha256:remoteHash,p_verified_at:observed,p_receiver_state:state,
  p_event_sha256:await sha(localEvent),
  p_event_hmac:await sign('YW597_HEALTH_HMAC_KEY',localEvent)});
}
async function overview(company,actor,ctx){
 if(!ctx.owner&&!ctx.reviewer)err('YW597_ORIGINAL_TENANT_ROLE_REQUIRED');
 const intents=await select('ywi_597_cutover_intents',
  'id,proof_id,canary_id,consent_at,expires_at',{company_id:company});
 const rollbacks=await select('ywi_597_rollback_proofs','id,intent_id,observed_at,readiness_only',
  {company_id:company});
 const approvals=await select('ywi_597_cutover_approvals','id,intent_id,rollback_proof_id,signed_at,approval_scope',
  {company_id:company});
 const enrolled=await select('ywi_597_health_enrollments','id,approval_id,started_at,expires_at',
  {company_id:company});
 const samples=await select('ywi_597_health_samples','id,enrollment_id,verified_at,receiver_state',
  {company_id:company});
 const alerts=await select('ywi_597_health_alerts','id,enrollment_id,issue_code,detected_at',
  {company_id:company});
 return {state:'TENANT_PRIVATE_MASTER_HEALTH_READBACK',
  intents:intents.map(x=>({intentId:x.id,proofId:x.proof_id,
   canaryId:x.canary_id,rollbackProofId:rollbacks.find(z=>z.intent_id===x.id)?.id||null,
   cutoverApprovalId:approvals.find(z=>z.intent_id===x.id)?.id||null,expiresAt:x.expires_at})),
  health:enrolled.map(x=>({enrollmentId:x.id,approvalId:x.approval_id,
   lastVerifiedAt:samples.filter(s=>s.enrollment_id===x.id&&s.receiver_state==='SIGNED_OLD_AND_NEXT_MATCH')
    .sort((a,b)=>Date.parse(b.verified_at)-Date.parse(a.verified_at))[0]?.verified_at||null,
   lastEvidenceState:samples.filter(s=>s.enrollment_id===x.id)
    .sort((a,b)=>Date.parse(b.verified_at)-Date.parse(a.verified_at))[0]?.receiver_state||'NO_ORIGINAL_HEALTH_SAMPLE',
   expiresAt:x.expires_at})),
  alerts:alerts.map(x=>({issueCode:x.issue_code,detectedAt:x.detected_at,
   enrollmentId:x.enrollment_id})),automatedSampleProbesActive:false,
  cronEvidenceScanMinutes:15,actualCutoverObserved:false,
  remoteSecretRotationAttested:false};
}
async function perform(data,actor){
 if(data?.action==='sysop-rollback-readiness'){
  if(!valid(data.companyId))err('YW597_REAL_COMPANY_REQUIRED');
  return rollback(data.companyId,actor,data);
 }
 const company=data?.companyId,ctx=await tenant(company,actor);
 switch(data?.action){
  case 'overview':return overview(company,actor,ctx);
  case 'owner-begin-cutover':return begin(company,actor,ctx,data);
  case 'reviewer-authorize-manual-cutover':return approve(company,actor,ctx,data);
  case 'owner-enroll-health-watch':return enroll(company,actor,ctx,data);
  case 'owner-probe-remote-health':return health(company,actor,ctx,data);
  default:err('YW597_UNKNOWN_ORIGINAL_CUTOVER_OR_WATCH_ACTION');
 }
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const h={...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  ...h,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'}});
 const send=(v,s=200)=>Response.json(v,{status:s,headers:h});
 if(req.method!=='POST')return send({state:'HOLD',code:'YW597_POST_ONLY'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   err('YW597_JSON_REQUIRED');
  const txt=await req.text();if(txt.length>4096)err('YW597_OVERSIZED_REQUEST_HOLD');
  const actor=await auth(req);
  return send(await perform(JSON.parse(txt),actor));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW597_ORIGINAL_SOURCE_OR_INDEPENDENT_AUTHORITY_HOLD',
  automaticKeyRotation:false,actualRollbackPerformed:false,
  remoteMasterHealthCertified:false,noPrivateObjectShared:true,noCustomerWrites:true},403)}
});
