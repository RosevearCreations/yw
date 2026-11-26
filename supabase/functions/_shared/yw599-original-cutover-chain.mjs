// YW599 read-only original YW597/YW598 chain verifier, extracted from production YW598. No Deno.serve or mutation action registered.
import {verifyCutoverReadback} from './yw599-independent-recovery.mjs';
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
async function intent(company,id,allowExpired=false){
 if(!valid(id))err('YW597_ORIGINAL_CUTOVER_INTENT_ID_REQUIRED');
 const i=await one('ywi_597_cutover_intents',intentFields,{id,company_id:company},
  'YW597_REAL_OWNER_CUTOVER_INTENT_REQUIRED');
 if((!allowExpired&&Date.parse(i.expires_at)<=Date.now())||i.actual_key_changed!==false)
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

const rollbackFields='id,company_id,intent_id,auditor_user_id,challenge_nonce,prior_hmac,next_hmac,remote_response_sha256,observed_at,readiness_only,actual_rollback_performed';
async function verifyStoredRollback(company,i,id,allowStale=false){
 const rb=await one('ywi_597_rollback_proofs',rollbackFields,
  {company_id:company,id},'YW597_ORIGINAL_INDEPENDENT_ROLLBACK_PROOF_REQUIRED');
 const pr=await proof(company,i.proof_id);
 if(rb.intent_id!==i.id||rb.readiness_only!==true||rb.actual_rollback_performed!==false||
  (!allowStale&&Date.parse(rb.observed_at)<Date.now()-15*60000))
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

const approvalFields='id,company_id,intent_id,rollback_proof_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,approval_scope,actually_cut_over';
async function approval(company,id){
 if(!valid(id))err('YW597_ORIGINAL_APPROVAL_UUID_REQUIRED');
 const a=await one('ywi_597_cutover_approvals',approvalFields,
  {company_id:company,id},'YW597_INDEPENDENT_MANUAL_AUTHORIZATION_NOT_FOUND');
 const i=await intent(company,a.intent_id,true);
 const rb=await verifyStoredRollback(company,i,a.rollback_proof_id,true);
 const msg=approvalMessage(i,rb,a.reviewer_user_id,new Date(a.signed_at).toISOString());
 if(i.reviewer_user_id!==a.reviewer_user_id||
  a.approval_scope!=='MANUAL_CUTOVER_ALLOWED_NOT_EXECUTED'||a.actually_cut_over!==false||
  await sha(msg)!==a.payload_sha256||
  !await verify('YW597_CUTOVER_HMAC_KEY',msg,a.server_hmac_sha256))
  err('YW597_ORIGINAL_INDEPENDENT_CUTOVER_APPROVAL_SIGNATURE_HOLD');
 return {a,i,rb};
}

const stamp=x=>{const d=new Date(x);if(Number.isNaN(d.getTime()))err('YW598_INVALID_REMOTE_SIGNED_TIMESTAMP');return d.toISOString();};
function executionCommon(approvalId,company,nonce,oldId,newId,receiptId,executedAt){
 return [approvalId,company,nonce,oldId,newId,receiptId,executedAt,'NEXT_ACTIVE_OLD_ACCEPTED'].join('|');
}
function rollbackCommon(witnessId,company,nonce,oldId,newId,receiptId,rollbackAt){
 return [witnessId,company,nonce,oldId,newId,receiptId,rollbackAt,'OLD_ACTIVE_NEXT_AVAILABLE'].join('|');
}
function digestExec(x){return canon({schema:'rosevear.yw.receiver-execution-readback-ack.v1',
 companyId:x.companyId,approvalId:x.approvalId,requestNonce:x.requestNonce,
 priorContractId:x.priorContractId,candidateContractId:x.candidateContractId,
 receiptId:x.receiptId,executedAt:stamp(x.executedAt),
 receiverState:'NEXT_ACTIVE_OLD_ACCEPTED',executedExternally:true,
 oldKeyStillAccepted:true,noSourceBytes:true});}
function digestRollback(x){return canon({schema:'rosevear.yw.receiver-rollback-execution-readback-ack.v1',
 companyId:x.companyId,witnessId:x.witnessId,requestNonce:x.requestNonce,
 priorContractId:x.priorContractId,candidateContractId:x.candidateContractId,
 receiptId:x.receiptId,rollbackAt:stamp(x.rollbackAt),
 receiverState:'OLD_ACTIVE_NEXT_AVAILABLE',rollbackExecutedExternally:true,
 nextKeyStillAvailable:true,noSourceBytes:true});}
function receiptId(x){
 if(typeof x!=='string'||x.length<8||x.length>128||!/^[-a-zA-Z0-9_.:]+$/.test(x))
  err('YW598_RECEIVER_RECEIPT_ID_INVALID');return x;
}

const execFields='id,company_id,approval_id,auditor_user_id,request_nonce,remote_receipt_id,original_master_old_hmac,original_master_next_hmac,response_sha256,remote_executed_at,verified_at,receiver_claimed_state,actual_remote_execution_reported';
async function verifiedExecution(company,id){
 if(!valid(id))err('YW598_SIGNED_EXECUTION_UUID_REQUIRED');
 const ex=await one('ywi_598_execution_receipts',execFields,{company_id:company,id},
  'YW598_NO_ORIGINAL_EXECUTION_RECEIPT');
 const ap=await approval(company,ex.approval_id),pr=await proof(company,ap.i.proof_id);
 if(ex.receiver_claimed_state!=='NEXT_ACTIVE_OLD_ACCEPTED'||
  ex.actual_remote_execution_reported!==true||
  [ap.i.owner_user_id,ap.i.reviewer_user_id].includes(ex.auditor_user_id))
  err('YW598_EXTERNAL_EXECUTION_ACTOR_AND_STATE_MISMATCH');
 const msg=executionCommon(ap.a.id,company,ex.request_nonce,
  pr.rot.oldc.contract_id,pr.rot.newc.contract_id,ex.remote_receipt_id,
  stamp(ex.remote_executed_at));
 if(!await verify('YW592_MASTER_ACK_KEY','YW598-EXEC-OLD|'+msg,ex.original_master_old_hmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW598-EXEC-NEXT|'+msg,ex.original_master_next_hmac)||
  ex.response_sha256!==await sha(digestExec({companyId:company,
   approvalId:ap.a.id,requestNonce:ex.request_nonce,
   priorContractId:pr.rot.oldc.contract_id,candidateContractId:pr.rot.newc.contract_id,
   receiptId:ex.remote_receipt_id,executedAt:ex.remote_executed_at})))
  err('YW598_STORED_REMOTE_CUTOVER_SIGNED_RECEIPT_HOLD');
 return {ex,ap,pr};
}
function witnessMessage(ex,owner,when){
 return canon({schema:'rosevear.yw.original-owner-physical-cutover-witness.v1',
  companyId:ex.company_id,executionId:ex.id,
  remoteReceiptId:ex.remote_receipt_id,originalOwnerId:owner,
  masterAuditorId:ex.auditor_user_id,externalCutoverAt:stamp(ex.remote_executed_at),
  observedAt:when,physicallyPresentSelfAttested:true,hardwareAttested:false,
  actualRemoteSecretOperationExecutedBySource:false});
}

const witFields='id,company_id,execution_id,owner_user_id,observed_at,evidence_sha256,local_hmac_sha256,self_attested_physical_observation,hardware_attested';
async function verifiedWitness(company,id){
 if(!valid(id))err('YW598_OWNER_EXECUTION_WITNESS_UUID_REQUIRED');
 const w=await one('ywi_598_execution_witnesses',witFields,{company_id:company,id},
  'YW598_ORIGINAL_HUMAN_EXECUTION_WITNESS_REQUIRED');
 const ex=await verifiedExecution(company,w.execution_id);
 const msg=witnessMessage(ex.ex,w.owner_user_id,stamp(w.observed_at));
 if(w.owner_user_id!==ex.ap.i.owner_user_id||
  w.owner_user_id===ex.ex.auditor_user_id||
  w.self_attested_physical_observation!==true||w.hardware_attested!==false||
  w.evidence_sha256!==await sha(msg)||
  !await verify('YW597_CUTOVER_HMAC_KEY',msg,w.local_hmac_sha256))
  err('YW598_ORIGINAL_OWNER_HUMAN_WITNESS_HMAC_HOLD');
 return {w,...ex};
}

const rollback598Fields='id,company_id,witness_id,auditor_user_id,request_nonce,remote_receipt_id,old_master_hmac,next_master_hmac,response_sha256,observed_at,remote_rollback_reported,reviewer_not_yet_attested';
async function verifiedRollback(company,id){
 if(!valid(id))err('YW598_REMOTE_ROLLBACK_RECEIPT_UUID_REQUIRED');
 const rb=await one('ywi_598_rollback_receipts',rollback598Fields,
  {company_id:company,id},'YW598_REMOTE_SIGNED_ROLLBACK_RECEIPT_REQUIRED');
 const ww=await verifiedWitness(company,rb.witness_id);
 const msg=rollbackCommon(rb.witness_id,company,rb.request_nonce,
  ww.pr.rot.oldc.contract_id,ww.pr.rot.newc.contract_id,rb.remote_receipt_id,
  stamp(rb.observed_at));
 if(rb.remote_rollback_reported!==true||rb.reviewer_not_yet_attested!==true||
  [ww.w.owner_user_id,ww.ap.i.reviewer_user_id].includes(rb.auditor_user_id)||
  !await verify('YW592_MASTER_ACK_KEY','YW598-ROLLBACK-OLD|'+msg,rb.old_master_hmac)||
  !await verify('YW596_RECEIVER_NEXT_ACK_KEY','YW598-ROLLBACK-NEXT|'+msg,rb.next_master_hmac)||
  rb.response_sha256!==await sha(digestRollback({
   companyId:company,witnessId:rb.witness_id,requestNonce:rb.request_nonce,
   priorContractId:ww.pr.rot.oldc.contract_id,
   candidateContractId:ww.pr.rot.newc.contract_id,
   receiptId:rb.remote_receipt_id,rollbackAt:rb.observed_at})))
  err('YW598_STORED_REMOTE_SIGNED_ROLLBACK_OR_ACTOR_HOLD');
 return {rb,ww};
}
function rollbackWitnessMessage(rb,ww,reviewer,when){
 return canon({schema:'rosevear.yw.independent-human-physical-rollback-observation.v1',
  companyId:rb.company_id,rollbackRemoteReceiptRecordId:rb.id,
  originalOwnerWitnessId:ww.w.id,
  remoteReceiptId:rb.remote_receipt_id,
  rollbackMasterAuditorId:rb.auditor_user_id,
  independentReviewerId:reviewer,
  remoteRollbackAt:stamp(rb.observed_at),humanObservedAt:when,
  physicallyPresentSelfAttested:true,hardwareAttested:false});
}

export async function verifyOriginalDrill({companyId,ownerId,reviewerId,actorId,drillId,confirmed}){
 if(confirmed!==true||![companyId,ownerId,reviewerId,actorId,drillId].every(valid)||new Set([ownerId,reviewerId,actorId]).size!==3)err('YW599_INDEPENDENT_SYSOP_REQUIRED');
 const p=await one('profiles','id,role,is_active',{id:actorId},'YW599_ACTIVE_SYSOP_REQUIRED');
 await one('ywi_platform_administrators_489','user_id',{user_id:actorId},'YW599_CURATED_SYSOP_REQUIRED');
 if(p.role!=='admin'||p.is_active!==true)err('YW599_ACTIVE_SYSOP_REQUIRED');
 const d=await one('ywi_598_rollback_drills','*',{company_id:companyId,id:drillId},'YW599_ORIGINAL_DRILL_REQUIRED');
 const {rb,ww}=await verifiedRollback(companyId,d.rollback_receipt_id);
 const can=await canary(companyId,ww.ap.i.canary_id);
 if([ownerId,reviewerId,can.c.source_actor_id].includes(actorId)||ww.w.owner_user_id!==ownerId||ww.ap.i.reviewer_user_id!==reviewerId||d.reviewer_user_id!==reviewerId||d.witness_id!==ww.w.id||d.auditor_user_id!==rb.auditor_user_id||d.request_nonce!==rb.request_nonce||d.remote_receipt_id!==rb.remote_receipt_id||d.old_master_hmac!==rb.old_master_hmac||d.next_master_hmac!==rb.next_master_hmac||d.response_sha256!==rb.response_sha256||d.remote_rollback_executed!==true||d.reviewer_physically_witnessed!==true||d.hardware_attested!==false||d.receiver_reported_state!=='OLD_ACTIVE_NEXT_AVAILABLE'||Date.parse(d.observed_at)<Date.parse(rb.observed_at)||Date.parse(d.observed_at)>Date.parse(rb.observed_at)+1800000)err('YW599_ORIGINAL_DRILL_CHAIN_HOLD');
 const message=rollbackWitnessMessage(rb,ww,reviewerId,stamp(d.observed_at));
 if(await sha(message)!==d.reviewer_evidence_sha256||!await verify('YW597_CUTOVER_HMAC_KEY',message,d.reviewer_local_hmac))err('YW599_ORIGINAL_REVIEWER_SIGNATURE_HOLD');
 return {companyId,executionId:ww.ex.id,rollbackDrillId:d.id,sourceReceiptId:can.prior.master_receipt_id,ownerId,reviewerId,auditorId:actorId,oldContractId:ww.pr.rot.oldc.contract_id,nextContractId:ww.pr.rot.newc.contract_id};
}
export async function readVerifiedFinalCutover(args){
 const chain=await verifyOriginalDrill(args);
 const {companyId,executionId,rollbackDrillId,oldContractId,nextContractId}=chain;
 const challenge={companyId,executionId,rollbackDrillId,nonce:crypto.randomUUID(),oldContractId,nextContractId,issuedAt:new Date().toISOString()};
 const response=await remote({schema:'rosevear.yw.final-cutover-readback-request.v1',...challenge,readOnly:true,noRemoteMutation:true,noSourceBytes:true});
 const result=await verifyCutoverReadback({challenge,response,oldKey:env('YW592_MASTER_ACK_KEY'),nextKey:env('YW596_RECEIVER_NEXT_ACK_KEY')});
 // The external signed current state is a report, not physical presence or an operation performed here.
 return {state:result.state,...chain,challenge,payload:result.payload,oldSignature:result.oldSignature,nextSignature:result.nextSignature,verifiedAt:new Date().toISOString(),remoteMutationPerformed:false};
}
