// YW596 genuine original signed old/new Master receiver proof and two-tenant
// human audit. This function never changes any secret, endpoint, field booking,
// device identity, or private photo storage.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const valid=x=>typeof x==='string'&&UUID.test(x);
const err=code=>{throw Object.assign(new Error(code),{code})};
const utf=x=>new TextEncoder().encode(x);
const hex=x=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join('');
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const sha=async x=>hex(await crypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x));
const env=k=>{const x=Deno.env.get(k);if(!x)err('YW596_SERVER_SECRET_'+k+'_HOLD');return x;};
async function key(name){return crypto.subtle.importKey('raw',utf(env(name)),
 {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(name,msg){return hex(await crypto.subtle.sign('HMAC',await key(name),utf(msg)));}
async function verify(name,msg,sig){
 if(typeof sig!=='string'||!SHA.test(sig))return false;
 return crypto.subtle.verify('HMAC',await key(name),
  new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16))),utf(msg));
}
async function service(path,method='GET',data){
 const k=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+path,{method,headers:{
  apikey:k,authorization:'Bearer '+k,
  ...(data?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})});
 if(!response.ok)err('YW596_PRIVATE_SOURCE_SQL_OR_AUTHORITY_HOLD');
 return response.json();
}
async function select(table,cols,terms={},limit=25){
 const q=new URLSearchParams({select:cols,limit:String(limit)});
 for(const [k,v]of Object.entries(terms))q.set(k,'eq.'+v);
 return service('/rest/v1/'+table+'?'+q);
}
async function one(table,cols,terms,code){
 const result=await select(table,cols,terms,2);
 if(result.length!==1)err(code);return result[0];
}
const rpc=(fn,data)=>service('/rest/v1/rpc/'+fn,'POST',data);
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))
  err('YW596_CURRENT_ORIGINAL_JWT_REQUIRED');
 const k=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:k,authorization:bearer}});
 if(!response.ok)err('YW596_AUTH_SESSION_REVOKED_OR_MISSING');
 const user=(await response.json()).id;
 if(!valid(user))err('YW596_REAL_USER_ID_REQUIRED');
 const profile=await one('profiles','id,role,is_active',{id:user},
  'YW596_ORIGINAL_ACTIVE_PROFILE_REQUIRED');
 if(profile.is_active!==true)err('YW596_INACTIVE_ACCOUNT_HOLD');
 return {user,profile};
}
async function admin(actor){
 if(actor.profile.role!=='admin')err('YW596_PLATFORM_ADMIN_ROLE_HOLD');
 const entries=await select('ywi_platform_administrators_489','user_id',
  {user_id:actor.user},2);
 if(entries.length!==1)err('YW596_ENROLLED_PLATFORM_SYSOP_REQUIRED');
}
async function tenant(id,actor){
 if(!valid(id))err('YW596_COMPANY_UUID_REQUIRED');
 const c=await one('ywi_companies','id,owner_user_id',{id},
  'YW596_NO_REAL_COMPANY');
 const p=await one('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',
  {company_id:id},'YW596_APPROVED_ORIGINAL_TENANT_PILOT_REQUIRED');
 if(c.owner_user_id!==p.owner_user_id||p.state!=='APPROVED'||
  Date.parse(p.expires_at)<=Date.now())err('YW596_UNENROLLED_OR_EXPIRED_REAL_PILOT_HOLD');
 const owner=actor.user===p.owner_user_id,reviewer=actor.user===p.reviewer_user_id&&!owner;
 const staff=await select('ywi_591_pilot_staff','user_id,role,state',
  {company_id:id,user_id:actor.user},5);
 const crew=!owner&&!reviewer&&staff.some(x=>x.role==='crew'&&x.state==='APPROVED');
 if(!owner&&!reviewer&&!crew)err('YW596_TENANT_ORIGINAL_ACTOR_NOT_AUTHORIZED');
 return {p,owner,reviewer,crew};
}
async function originalAttempt(company,id,pilot){
 if(!valid(id))err('YW596_ORIGINAL_ATTEMPT_UUID_REQUIRED');
 const a=await one('ywi_591_photo_attempts',
  'id,company_id,work_order_id,uploaded_by,state,content_sha256,stored_sha256,byte_count,object_key',
  {id,company_id:company},'YW596_REAL_SOURCE_ATTEMPT_MISSING');
 if(a.work_order_id!==pilot.work_order_id||a.state!=='VERIFIED'||
  a.stored_sha256!==a.content_sha256||!SHA.test(a.content_sha256))
  err('YW596_ORIGINAL_PRIVATE_SOURCE_NOT_VERIFIED');
 return a;
}
async function originalBytes(a){
 const chunks=(a.object_key||'').split('/');
 if(chunks.length!==3||chunks.some(x=>!x||x==='..'))
  err('YW596_BAD_ORIGINAL_STORAGE_KEY_HOLD');
 const key=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+'/storage/v1/object/authenticated/'+
  encodeURIComponent('ywi-private-device-evidence-589')+'/'+chunks.map(encodeURIComponent).join('/'),
  {headers:{apikey:key,authorization:'Bearer '+key}});
 if(!response.ok)err('YW596_PRIVATE_OBJECT_READ_UNAVAILABLE');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==a.byte_count||await sha(bytes)!==a.content_sha256)
  err('YW596_ORIGINAL_PRIVATE_OBJECT_SHA256_MISMATCH');
}
const contractFields='id,company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,receiver_response_sha256,receiver_signature,observed_at,expires_at';
async function contract(company,id,allowExpired){
 if(!valid(id))err('YW596_CONTRACT_RECORD_UUID_REQUIRED');
 const c=await one('ywi_593_receiver_contracts',contractFields,
  {id,company_id:company},'YW596_ORIGINAL_SIGNED_RECEIVER_CONTRACT_REQUIRED');
 if(c.source_schema!=='rosevear.yw.source-photo-telemetry.v1'||
  c.ack_schema!=='YW592-ACK'||!allowExpired&&Date.parse(c.expires_at)<=Date.now())
  err('YW596_RECEIVER_VERSION_OR_EXPIRY_HOLD');
 const msg='YW593-CONTRACT|'+c.contract_id+'|'+company+'|'+c.request_nonce+
  '|'+c.source_schema+'|'+c.ack_schema;
 if(!await verify('YW592_MASTER_ACK_KEY',msg,c.receiver_signature)||
  c.receiver_response_sha256!==await sha(canon({contractId:c.contract_id,companyId:company,
   requestNonce:c.request_nonce,acceptedSourceSchema:c.source_schema,
   acceptedAckSchema:c.ack_schema})))
  err('YW596_ORIGINAL_SIGNED_MASTER_CONTRACT_INVALID');
 return c;
}
const rotationFields='id,company_id,prior_contract_id,candidate_contract_id,owner_user_id,reviewer_user_id,reason,custody_only,proposed_at';
async function rotation(company,id){
 if(!valid(id))err('YW596_ROTATION_UUID_REQUIRED');
 const r=await one('ywi_595_rotation_proposals',rotationFields,
  {id,company_id:company},'YW596_YW595_APPROVED_CUSTODY_ROTATION_REQUIRED');
 if(r.custody_only!==true||r.owner_user_id===r.reviewer_user_id)
  err('YW596_595_INDEPENDENT_ROTATION_AUTHORITY_HOLD');
 const oldc=await contract(company,r.prior_contract_id,true);
 const newc=await contract(company,r.candidate_contract_id,false);
 if(oldc.id===newc.id||oldc.contract_id===newc.contract_id||
  r.owner_user_id!==oldc.owner_user_id||r.owner_user_id!==newc.owner_user_id||
  Date.parse(newc.observed_at)<=Date.parse(oldc.observed_at))
  err('YW596_TWO_INDEPENDENT_REAL_SIGNED_CONTRACTS_REQUIRED');
 const signoff=await one('ywi_595_rotation_signoffs',
  'id,company_id,proposal_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,actual_secret_rotated',
  {company_id:company,proposal_id:r.id},'YW596_SEPARATE_REVIEWER_ROTATION_SIGNOFF_REQUIRED');
 const msg=canon({schema:'rosevear.yw.receiver-rotation-custody.v1',
  companyId:company,rotationId:r.id,ownerId:r.owner_user_id,
  reviewerId:r.reviewer_user_id,priorContractRecordId:oldc.id,
  candidateContractRecordId:newc.id,priorContractId:oldc.contract_id,
  candidateContractId:newc.contract_id,priorReceiverHmac:oldc.receiver_signature,
  candidateReceiverHmac:newc.receiver_signature,reason:r.reason,
  proposedAt:r.proposed_at,signedAt:new Date(signoff.signed_at).toISOString(),
  actualSecretRotated:false,remoteEndpointChanged:false});
 if(signoff.reviewer_user_id!==r.reviewer_user_id||signoff.actual_secret_rotated!==false||
  await sha(msg)!==signoff.payload_sha256||
  !await verify('YW595_ROTATION_HMAC_KEY',msg,signoff.server_hmac_sha256))
  err('YW596_YW595_ROTATION_CUSTODY_SIGNATURE_INVALID');
 return {r,oldc,newc,signoff};
}
function pinnedUrl(){
 const url=new URL(env('YW592_MASTER_RECEIPT_URL'));
 const host=env('YW593_MASTER_ALLOWED_HOST').toLowerCase();
 if(url.protocol!=='https:'||url.hostname.toLowerCase()!==host||url.port||
  url.username||url.password||url.search||url.hash||
  host==='localhost'||host.endsWith('.local')||!host.includes('.')||
  host.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(host))
  err('YW596_EXPLICIT_PINNED_MASTER_HTTPS_REQUIRED');
 return url.toString();
}
async function remote(company,body){
 const data=canon(body);
 const response=await fetch(pinnedUrl(),{method:'POST',redirect:'error',
  signal:AbortSignal.timeout(5000),headers:{
   'content-type':'application/json','x-rosevear-yw-source-signature':
    await sign('YW592_TELEMETRY_SEND_KEY',data)},body:data});
 if(!response.ok)err('YW596_GENUINE_RECEIVER_PROTOCOL_UNAVAILABLE');
 const text=await response.text();
 if(text.length>4096)err('YW596_OVERSIZED_OR_UNTRUSTED_REMOTE_REPLY');
 let json;try{json=JSON.parse(text);}catch{err('YW596_INVALID_REMOTE_JSON_HOLD');}
 return json;
}
async function verifyDual(probe,company,rotation,nonce){
 if(!probe||probe.schema!=='rosevear.yw.receiver-dual-key-probe-ack.v1'||
  probe.companyId!==company||probe.rotationId!==rotation.r.id||
  probe.requestNonce!==nonce||probe.priorContractId!==rotation.oldc.contract_id||
  probe.candidateContractId!==rotation.newc.contract_id||
  probe.acceptedAckSchema!=='YW592-ACK'||
  typeof probe.oldHmac!=='string'||typeof probe.nextHmac!=='string')
  err('YW596_RECEIVER_NEW_PROTOCOL_OR_NONCE_HOLD');
 const common=rotation.r.id+'|'+company+'|'+nonce+'|'+rotation.oldc.contract_id+
  '|'+rotation.newc.contract_id+'|YW592-ACK';
 if(!await verify('YW592_MASTER_ACK_KEY','YW596-ROTATE-OLD|'+common,probe.oldHmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW596-ROTATE-NEXT|'+common,probe.nextHmac))
  err('YW596_INDEPENDENT_OLD_AND_NEXT_RECEIVER_HMAC_HOLD');
 return await sha(canon({schema:probe.schema,companyId:probe.companyId,
  rotationId:probe.rotationId,requestNonce:probe.requestNonce,
  priorContractId:probe.priorContractId,candidateContractId:probe.candidateContractId,
  acceptedAckSchema:probe.acceptedAckSchema}));
}
async function dualProof(company,actor,ctx,data){
 if(!ctx.owner||data.confirmPassiveKeyDrill!==true)
  err('YW596_EXPLICIT_ORIGINAL_OWNER_NONMUTATING_ROTATION_REVIEW_REQUIRED');
 const rot=await rotation(company,data.rotationId);
 if(rot.r.owner_user_id!==actor.user||rot.r.reviewer_user_id!==ctx.p.reviewer_user_id)
  err('YW596_ORIGINAL_APPROVED_OWNER_AND_DISTINCT_REVIEWER_REQUIRED');
 await key('YW596_RECEIVER_NEXT_ACK_KEY');
 const nonce=crypto.randomUUID();
 const response=await remote(company,{schema:'rosevear.yw.receiver-dual-key-probe.v1',
  companyId:company,rotationId:rot.r.id,requestNonce:nonce,
  priorContractId:rot.oldc.contract_id,candidateContractId:rot.newc.contract_id,
  acceptedAckSchemaRequired:'YW592-ACK',
  noSourceBytes:true,noRemoteMutation:true});
 const verifiedDigest=await verifyDual(response,company,rot,nonce);
 return rpc('ywi_596_record_dual_key_proof',{
  p_company_id:company,p_rotation_id:rot.r.id,p_signoff_id:rot.signoff.id,
  p_owner_user_id:actor.user,p_nonce:nonce,p_response_sha256:verifiedDigest,
  p_old_hmac:response.oldHmac,p_next_hmac:response.nextHmac,
  p_received_at:new Date().toISOString()});
}
const proofFields='id,company_id,rotation_id,signoff_id,owner_user_id,request_nonce,response_sha256,old_receiver_hmac,next_receiver_hmac,received_at,actual_secret_rotated,observed_state';
async function proof(company,id){
 if(!valid(id))err('YW596_DUAL_KEY_PROOF_UUID_REQUIRED');
 const p=await one('ywi_596_rotation_proofs',proofFields,
  {id,company_id:company},'YW596_REAL_DUAL_RECEIVER_HANDSHAKE_REQUIRED');
 const r=await rotation(company,p.rotation_id);
 if(p.owner_user_id!==r.r.owner_user_id||p.signoff_id!==r.signoff.id||
  p.actual_secret_rotated!==false||p.observed_state!=='DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY')
  err('YW596_ORIGINAL_SIGNED_DUAL_KEY_CHAIN_HOLD');
 const common=r.r.id+'|'+company+'|'+p.request_nonce+'|'+r.oldc.contract_id+
  '|'+r.newc.contract_id+'|YW592-ACK';
 if(!await verify('YW592_MASTER_ACK_KEY','YW596-ROTATE-OLD|'+common,p.old_receiver_hmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW596-ROTATE-NEXT|'+common,p.next_receiver_hmac))
  err('YW596_STORED_TWO_KEY_REMOTE_PROOF_INVALID');
 return {p,r};
}
const oldAckFields='id,company_id,attempt_id,device_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,master_ack_hmac_sha256,received_at';
async function oldAck(company,id,actorId){
 const old=await one('ywi_592_master_receipts',oldAckFields,
  {id,company_id:company},'YW596_ORIGINAL_PRIOR_KEY_MASTER_ACK_REQUIRED');
 if(old.device_actor_id!==actorId||
  !await verify('YW592_MASTER_ACK_KEY',
  'YW592-ACK|'+old.master_receipt_id+'|'+old.request_nonce+'|'+old.payload_sha256,
  old.master_ack_hmac_sha256))
  err('YW596_PRIOR_GENUINE_MASTER_ACK_SIGNATURE_HOLD');
 return old;
}
const canaryFields='id,company_id,rotation_proof_id,prior_ack_id,next_attempt_id,source_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,next_ack_hmac,acknowledged_at,no_private_object_transferred';
function canaryBody(company,pr,a,nonce){
 return {schema:'rosevear.yw.receiver-next-source-canary.v1',
  companyId:company,rotationId:pr.r.r.id,requestNonce:nonce,
  sourceApp:'yw',sourceActorId:a.uploaded_by,attemptId:a.id,
  sourceSha256:a.content_sha256,acceptedAckSchemaRequired:'YW596-NEXT-ACK',
  noSourceBytes:true,noCustomerDetails:true};
}
function nextAckMessage(receiptId,company,attempt,nonce,sourceHash,payloadHash){
 return 'YW596-NEXT-ACK|'+receiptId+'|'+company+'|'+attempt+'|'+nonce+'|'+sourceHash+'|'+payloadHash;
}
async function canary(company,actor,ctx,data){
 if(!ctx.crew||data.confirmOriginalDevice!==true)
  err('YW596_ORIGINAL_APPROVED_CREW_CONFIRMATION_REQUIRED');
 const pr=await proof(company,data.rotationProofId);
 if(pr.r.r.reviewer_user_id!==ctx.p.reviewer_user_id)
  err('YW596_INDEPENDENT_REVIEWER_CHANGED');
 if(!valid(data.priorAckId))err('YW596_PRIOR_ACK_UUID_REQUIRED');
 const old=await oldAck(company,data.priorAckId,actor.user);
 const a=await originalAttempt(company,data.nextAttemptId,ctx.p);
 const oldAttempt=await originalAttempt(company,old.attempt_id,ctx.p);
 if(oldAttempt.id===a.id||a.uploaded_by!==actor.user||
  oldAttempt.content_sha256!==old.source_sha256||
  oldAttempt.content_sha256===a.content_sha256||
  Date.parse(old.received_at)>=Date.now())
  err('YW596_TWO_INDEPENDENT_ORIGINAL_ATTEMPTS_AND_PRIOR_ACK_REQUIRED');
 await originalBytes(a);
 const nonce=crypto.randomUUID(),request=canaryBody(company,pr,a,nonce);
 const body=canon(request),payloadSha=await sha(body),response=await remote(company,request);
 const receiptId=response?.receiptId;
 if(response?.schema!=='rosevear.yw.receiver-next-source-canary-ack.v1'||
  response?.companyId!==company||response?.attemptId!==a.id||
  response?.requestNonce!==nonce||response?.sourceSha256!==a.content_sha256||
  response?.payloadSha256!==payloadSha||typeof receiptId!=='string'||
  receiptId.length<8||receiptId.length>128||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY',
   nextAckMessage(receiptId,company,a.id,nonce,a.content_sha256,payloadSha),response.nextAckHmac))
  err('YW596_INDEPENDENT_NEXT_KEY_ACK_SCHEMA_OR_SIGNATURE_HOLD');
 return rpc('ywi_596_record_next_canary',{
  p_company_id:company,p_proof_id:pr.p.id,p_prior_ack_id:old.id,
  p_next_attempt_id:a.id,p_actor_id:actor.user,p_receipt_id:receiptId,
  p_nonce:nonce,p_source_sha256:a.content_sha256,p_payload_sha256:payloadSha,
  p_ack_hmac:response.nextAckHmac,p_acknowledged_at:new Date().toISOString()});
}
async function confirmedCanary(company,id){
 if(!valid(id))err('YW596_NEXT_KEY_CANARY_UUID_REQUIRED');
 const c=await one('ywi_596_canary_acks',canaryFields,
  {id,company_id:company},'YW596_GENUINE_NEXT_KEY_ACK_NOT_FOUND');
 const old=await oldAck(company,c.prior_ack_id,c.source_actor_id);
 const attempt=await one('ywi_591_photo_attempts',
  'id,company_id,uploaded_by,content_sha256,stored_sha256,state',
  {id:c.next_attempt_id,company_id:company},'YW596_NEXT_CANARY_ORIGINAL_ATTEMPT_MISSING');
 const prev=await proof(company,c.rotation_proof_id);
 const request=canaryBody(company,prev,{...attempt,uploaded_by:c.source_actor_id},c.request_nonce);
 if(c.no_private_object_transferred!==true||old.attempt_id===attempt.id||
  old.source_sha256===c.source_sha256||attempt.content_sha256!==c.source_sha256||
  attempt.uploaded_by!==c.source_actor_id||attempt.stored_sha256!==attempt.content_sha256||
  attempt.state!=='VERIFIED'||c.payload_sha256!==await sha(canon(request))||
  Date.parse(c.acknowledged_at)<=Date.parse(old.received_at)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY',
   nextAckMessage(c.master_receipt_id,company,attempt.id,c.request_nonce,
    c.source_sha256,c.payload_sha256),c.next_ack_hmac))
  err('YW596_STORED_NEXT_KEY_ACK_CONTINUITY_INVALID');
 return {c,old,attempt};
}
const slotFields='id,company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at';
async function originalSlot(company,id,pilot){
 if(!valid(id))err('YW596_REAL_ORIGINAL_SLOT_UUID_REQUIRED');
 const s=await one('ywi_593_witness_slots',slotFields,
  {id,company_id:company},'YW596_REAL_WITNESS_SLOT_REQUIRED');
 const approval=await one('ywi_593_witness_approvals',
  'slot_id,company_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256',
  {slot_id:s.id,company_id:company},'YW596_SIGNED_ORIGINAL_WINDOW_APPROVAL_REQUIRED');
 const msg=canon({schema:'rosevear.yw.witness-window-approval.v1',
  companyId:company,slotId:s.id,attemptId:s.attempt_id,
  ownerId:s.owner_user_id,reviewerId:s.reviewer_user_id,crewId:s.crew_user_id,
  startsAt:s.starts_at,endsAt:s.ends_at,signedAt:new Date(approval.signed_at).toISOString()});
 if(s.owner_user_id!==pilot.owner_user_id||s.reviewer_user_id!==pilot.reviewer_user_id||
  approval.reviewer_user_id!==s.reviewer_user_id||
  await sha(msg)!==approval.payload_sha256||
  !await verify('YW593_WITNESS_HMAC_KEY',msg,approval.server_hmac_sha256))
  err('YW596_ORIGINAL_INDEPENDENT_WITNESS_WINDOW_SIGNATURE_INVALID');
 return s;
}
async function fleetOptin(company,id){
 if(!valid(id))err('YW596_YW595_FLEET_OPTIN_UUID_REQUIRED');
 const o=await one('ywi_595_fleet_optins',
  'id,company_id,ceremony_closure_id,owner_user_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,opt_in_consent',
  {id,company_id:company},'YW596_REAL_OWNER_SIGNED_CEREMONY_OPTIN_REQUIRED');
 const closed=await one('ywi_595_ceremony_closures',
  'id,company_id,intent_id,field_certificate_id,master_receipt_id,reviewer_user_id,source_sha256,closed_at,evidence_sha256,server_hmac_sha256',
  {id:o.ceremony_closure_id,company_id:company},'YW596_REAL_CLOSED_SUPERVISED_CEREMONY_REQUIRED');
 const intent=await one('ywi_595_ceremony_intents',
  'id,company_id,slot_id,owner_user_id,reviewer_user_id,crew_user_id,source_sha256,briefing_consent',
  {id:closed.intent_id,company_id:company},'YW596_ORIGINAL_THREE_HUMAN_FIELD_INTENT_REQUIRED');
 const cert=await one('ywi_594_field_certificates',
  'id,company_id,slot_id,source_sha256,master_receipt_id,reviewer_user_id,human_field_attested,hardware_attested',
  {id:closed.field_certificate_id,company_id:company},'YW596_INDEPENDENT_HUMAN_CERTIFICATE_REQUIRED');
 const ownerMsg=canon({schema:'rosevear.yw.independent-two-tenant-optin.v1',
  companyId:company,closureId:o.ceremony_closure_id,
  originalOwnerId:o.owner_user_id,originalReviewerId:o.reviewer_user_id,
  sourceSha256:closed.source_sha256,signedAt:new Date(o.signed_at).toISOString(),
  tenantOwnerConsents:true,sharePrivatePhoto:false});
 if(o.opt_in_consent!==true||o.owner_user_id!==intent.owner_user_id||
  o.reviewer_user_id!==intent.reviewer_user_id||closed.reviewer_user_id!==intent.reviewer_user_id||
  cert.slot_id!==intent.slot_id||cert.master_receipt_id!==closed.master_receipt_id||
  cert.source_sha256!==closed.source_sha256||cert.human_field_attested!==true||
  cert.hardware_attested!==false||await sha(ownerMsg)!==o.payload_sha256||
  !await verify('YW595_FLEET_HMAC_KEY',ownerMsg,o.server_hmac_sha256))
  err('YW596_REAL_SIGNED_595_OPTIN_OR_CERTIFICATE_CHAIN_INVALID');
 return {o,closed,intent,cert};
}
const consentFields='id,company_id,optin_id,slot_id,owner_user_id,signed_at,payload_sha256,server_hmac_sha256,explicit_schedule_consent';
function consentMsg(x,slot){
 return canon({schema:'rosevear.yw.owner-specific-cross-tenant-window-consent.v1',
  companyId:x.company_id,optinId:x.optin_id,slotId:x.slot_id,
  ownerId:x.owner_user_id,startsAt:slot.starts_at,endsAt:slot.ends_at,
  signedAt:new Date(x.signed_at).toISOString(),explicitConsent:true,
  sharePhotos:false,shareContactDetails:false});
}
async function consentValid(id){
 if(!valid(id))err('YW596_SIGNED_SCHEDULE_CONSENT_ID_REQUIRED');
 const x=await one('ywi_596_slot_consents',consentFields,
  {id},'YW596_SPECIFIC_ORIGINAL_OWNER_WINDOW_CONSENT_REQUIRED');
 const origin=await fleetOptin(x.company_id,x.optin_id);
 const profile=await one('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,state,expires_at',
  {company_id:x.company_id},'YW596_INDEPENDENT_ORIGINAL_PILOT_REQUIRED');
 if(profile.state!=='APPROVED'||Date.parse(profile.expires_at)<=Date.now()||
  origin.o.owner_user_id!==x.owner_user_id||
  origin.o.reviewer_user_id!==profile.reviewer_user_id)
  err('YW596_REAL_ORIGINAL_COMPANY_NO_LONGER_APPROVED');
 const s=await originalSlot(x.company_id,x.slot_id,profile);
 if(x.explicit_schedule_consent!==true||s.owner_user_id!==x.owner_user_id||
  await sha(consentMsg(x,s))!==x.payload_sha256||
  !await verify('YW596_SCHEDULE_HMAC_KEY',consentMsg(x,s),x.server_hmac_sha256))
  err('YW596_EXPLICIT_SIGNED_OWNER_WINDOW_AUTHORITY_HOLD');
 return {x,s,optin:origin};
}
async function consentSlot(company,actor,ctx,data){
 if(!ctx.owner||data.explicitConsent!==true)
  err('YW596_ORIGINAL_OWNER_SPECIFIC_WINDOW_CONSENT_REQUIRED');
 const opt=await fleetOptin(company,data.optinId);
 const slot=await originalSlot(company,data.slotId,ctx.p);
 if(opt.o.owner_user_id!==actor.user||slot.owner_user_id!==actor.user||
  Date.parse(slot.starts_at)<=Date.now()+30*60000)
  err('YW596_SIGNED_FUTURE_ORIGINAL_OWNER_WINDOW_HOLD');
 const signedAt=new Date().toISOString();
 const record={company_id:company,optin_id:opt.o.id,slot_id:slot.id,
  owner_user_id:actor.user,signed_at:signedAt},msg=consentMsg(record,slot);
 return rpc('ywi_596_consent_slot',{p_company_id:company,p_optin_id:opt.o.id,
  p_slot_id:slot.id,p_owner_user_id:actor.user,p_signed_at:signedAt,
  p_payload_sha256:await sha(msg),p_server_hmac:await sign('YW596_SCHEDULE_HMAC_KEY',msg)});
}
function pairMsg(a,b,coordinator){
 return canon({schema:'rosevear.yw.two-owner-consented-real-device-schedule.v1',
  companyAId:a.x.company_id,companyBId:b.x.company_id,
  consentAId:a.x.id,consentBId:b.x.id,
  slotAId:a.s.id,slotBId:b.s.id,
  startA:a.s.starts_at,endA:a.s.ends_at,
  startB:b.s.starts_at,endB:b.s.ends_at,
  coordinatorId:coordinator,
  noCrossTenantContactShared:true,notFieldCertification:true});
}
async function schedule(actor,data){
 await admin(actor);
 if(data.confirmIndependentScheduling!==true)
  err('YW596_PLATFORM_COORDINATOR_EXPLICIT_REVIEW_REQUIRED');
 const a=await consentValid(data.consentAId),b=await consentValid(data.consentBId);
 if(a.x.company_id>=b.x.company_id||
  new Set([a.x.owner_user_id,b.x.owner_user_id,a.s.reviewer_user_id,
   b.s.reviewer_user_id,actor.user]).size!==5||
  Date.parse(a.s.starts_at)<=Date.now()||Date.parse(b.s.starts_at)<=Date.now()||
  !(Date.parse(a.s.ends_at)<=Date.parse(b.s.starts_at)||
   Date.parse(b.s.ends_at)<=Date.parse(a.s.starts_at)))
  err('YW596_TWO_DISTINCT_NONOVERLAPPING_OWNER_CONSENTED_SLOTS_REQUIRED');
 const msg=pairMsg(a,b,actor.user);
 return rpc('ywi_596_schedule_cross_tenant',{p_consent_a_id:a.x.id,
  p_consent_b_id:b.x.id,p_coordinator_user_id:actor.user,
  p_payload_sha256:await sha(msg),p_server_hmac:await sign('YW596_SCHEDULE_HMAC_KEY',msg)});
}
const pairFields='id,company_a_id,company_b_id,consent_a_id,consent_b_id,coordinator_user_id,scheduled_at,schedule_sha256,server_hmac_sha256,status';
async function pair(id){
 if(!valid(id))err('YW596_PAIR_UUID_REQUIRED');
 const p=await one('ywi_596_cross_tenant_pilots',pairFields,
  {id},'YW596_TWO_OWNER_SIGNED_PAIR_REQUIRED');
 const a=await consentValid(p.consent_a_id),b=await consentValid(p.consent_b_id);
 const msg=pairMsg(a,b,p.coordinator_user_id);
 if(p.company_a_id!==a.x.company_id||p.company_b_id!==b.x.company_id||
  a.x.company_id>=b.x.company_id||
  p.status!=='TWO_REAL_TENANTS_SCHEDULED_NOT_AUDITED'||
  await sha(msg)!==p.schedule_sha256||
  !await verify('YW596_SCHEDULE_HMAC_KEY',msg,p.server_hmac_sha256))
  err('YW596_ORIGINAL_SIGNED_INDEPENDENT_PAIR_INVALID');
 return {p,a,b};
}
function auditMsg(pr,a,b,auditor,date){
 return canon({schema:'rosevear.yw.independent-two-tenant-master-ack-continuity.v1',
  pairId:pr.p.id,companyAId:pr.p.company_a_id,companyBId:pr.p.company_b_id,
  coordinatorId:pr.p.coordinator_user_id,auditorId:auditor,
  canaryAId:a.c.id,canaryBId:b.c.id,
  priorMasterAckAId:a.old.id,priorMasterAckBId:b.old.id,
  nextAckDigestA:shaText(a.c.next_ack_hmac),nextAckDigestB:shaText(b.c.next_ack_hmac),
  auditedAt:new Date(date).toISOString(),originalSourceDigestOnly:true,
  hardwareAttested:false});
}
function shaText(x){return x;}
async function audit(actor,data){
 await admin(actor);
 if(data.confirmIndependentAudit!==true)
  err('YW596_DISTINCT_REAL_PLATFORM_AUDITOR_CONSENT_REQUIRED');
 const pr=await pair(data.pairId),a=await confirmedCanary(pr.p.company_a_id,data.canaryAId),
 b=await confirmedCanary(pr.p.company_b_id,data.canaryBId);
 const forbidden=new Set([pr.p.coordinator_user_id,pr.a.x.owner_user_id,
  pr.b.x.owner_user_id,pr.a.s.reviewer_user_id,pr.b.s.reviewer_user_id,
  a.c.source_actor_id,b.c.source_actor_id]);
 if(forbidden.has(actor.user)||a.c.company_id===b.c.company_id||
  Date.parse(a.c.acknowledged_at)<=Date.parse(pr.p.scheduled_at)||
  Date.parse(b.c.acknowledged_at)<=Date.parse(pr.p.scheduled_at))
  err('YW596_SECOND_INDEPENDENT_SYSOP_AND_TWO_ORIGINAL_ACK_CHAINS_REQUIRED');
 const signedAt=new Date().toISOString(),msg=auditMsg(pr,a,b,actor.user,signedAt);
 return rpc('ywi_596_independent_audit',{p_pair_id:pr.p.id,p_canary_a_id:a.c.id,
  p_canary_b_id:b.c.id,p_auditor_user_id:actor.user,p_signed_at:signedAt,
  p_payload_sha256:await sha(msg),p_server_hmac:await sign('YW596_AUDIT_HMAC_KEY',msg)});
}
async function ownerOverview(company,ctx){
 if(!ctx.owner&&!ctx.reviewer)err('YW596_ORIGINAL_OWNER_REVIEWER_QUEUE_ONLY');
 const rotations=await select('ywi_595_rotation_proposals',
  'id,reason,proposed_at',{company_id:company});
 const proofs=await select('ywi_596_rotation_proofs',
  'id,rotation_id,received_at,actual_secret_rotated',{company_id:company});
 const canaries=await select('ywi_596_canary_acks',
  'id,rotation_proof_id,prior_ack_id,acknowledged_at',{company_id:company});
 const consents=await select('ywi_596_slot_consents',
  'id,slot_id,optin_id,signed_at',{company_id:company});
 return {state:'PRIVATE_ORIGINAL_RECEIVER_CONTINUITY_QUEUE',
  rotations:rotations.map(x=>({rotationId:x.id,
   dualKeyProofId:proofs.find(y=>y.rotation_id===x.id)?.id||null})),
  canaries:canaries.map(x=>({canaryId:x.id,rotationProofId:x.rotation_proof_id,
   priorAckId:x.prior_ack_id,acknowledgedAt:x.acknowledged_at})),
  slotConsents:consents.map(x=>({slotConsentId:x.id,slotId:x.slot_id,
   optinId:x.optin_id,signedAt:x.signed_at})),
  privatePhotoPublished:false,remoteSecretRotated:false,
  originalHardwareAttested:false,crossTenantAuditApproved:false};
}
async function sysopOverview(actor){
 await admin(actor);
 const consent=await select('ywi_596_slot_consents',
  'id,company_id,slot_id,signed_at',{},100);
 const pairs=await select('ywi_596_cross_tenant_pilots',
  'id,company_a_id,company_b_id,scheduled_at',{},100);
 const audits=await select('ywi_596_independent_continuity_audits','id,pair_id,audited_at',{},100);
 return {state:'REDACTED_PLATFORM_OWNER_CONSENT_COORDINATION',
  slotConsents:consent.map(x=>({consentId:x.id,companyId:x.company_id,
   signedAt:x.signed_at})),
  pairs:pairs.map(x=>({pairId:x.id,companyAId:x.company_a_id,
   companyBId:x.company_b_id,scheduledAt:x.scheduled_at})),
  independentReviews:audits.length,noPrivatePhotoOrAddressDisclosed:true};
}
async function perform(data,actor){
 switch(data?.action){
  case 'sysop-overview':return sysopOverview(actor);
  case 'coordinate-two-tenant-windows':return schedule(actor,data);
  case 'independent-two-tenant-audit':return audit(actor,data);
 }
 const company=data?.companyId,ctx=await tenant(company,actor);
 switch(data?.action){
  case 'overview':return ownerOverview(company,ctx);
  case 'verify-dual-key-receiver':return dualProof(company,actor,ctx,data);
  case 'original-next-key-canary':return canary(company,actor,ctx,data);
  case 'owner-consent-specific-window':return consentSlot(company,actor,ctx,data);
  default:err('YW596_UNKNOWN_OR_UNENROLLED_ORIGINAL_ACTION');
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
 const send=(data,status=200)=>Response.json(data,{status,headers:h});
 if(req.method!=='POST')return send({state:'HOLD',code:'YW596_POST_ONLY'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   err('YW596_JSON_ONLY');
  const raw=await req.text();if(raw.length>4096)err('YW596_REQUEST_TOO_LARGE');
  return send(await perform(JSON.parse(raw),await auth(req)));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW596_REAL_SOURCE_OR_AUTHORITY_HOLD',
  noFakeACK:true,noAutomaticSecretRotation:true,noPrivatePhotoTransferred:true,
  independentTwoTenantReview:false,hardwareAttested:false},403);}
});
