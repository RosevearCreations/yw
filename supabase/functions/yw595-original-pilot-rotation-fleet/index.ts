// YW595: signed source-bound original-device ceremony, receiver rotation
// custody (never remote key mutation), and distinct original two-tenant review.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const valid=x=>typeof x==='string'&&UUID.test(x);
const err=code=>{throw Object.assign(new Error(code),{code})};
const utf=s=>new TextEncoder().encode(s);
const hex=x=>Array.from(new Uint8Array(x),y=>y.toString(16).padStart(2,'0')).join('');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const sha=async x=>hex(await crypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x));
const env=k=>{const v=Deno.env.get(k);if(!v)err('YW595_PRIVATE_SECRET_'+k+'_HOLD');return v;};
async function key(name){return crypto.subtle.importKey('raw',utf(env(name)),
 {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(name,message){return hex(await crypto.subtle.sign('HMAC',await key(name),utf(message)));}
async function verify(name,message,sig){
 if(typeof sig!=='string'||!SHA.test(sig))return false;
 return crypto.subtle.verify('HMAC',await key(name),
  new Uint8Array(sig.match(/../g).map(v=>parseInt(v,16))),utf(message));
}
async function service(path,method='GET',body){
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+path,{method,headers:{
  apikey:secret,authorization:'Bearer '+secret,
  ...(body?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)err('YW595_PRIVATE_ORIGINAL_SOURCE_SQL_HOLD');
 return response.json();
}
async function select(table,fields,terms={},limit=25){
 const q=new URLSearchParams({select:fields,limit:String(limit)});
 for(const [k,v] of Object.entries(terms))q.set(k,'eq.'+v);
 return service('/rest/v1/'+table+'?'+q);
}
async function one(table,fields,terms,code){
 const result=await select(table,fields,terms,2);
 if(result.length!==1)err(code);return result[0];
}
const rpc=(name,params)=>service('/rest/v1/rpc/'+name,'POST',params);
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))
  err('YW595_REAL_ORIGINAL_SESSION_REQUIRED');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:secret,authorization:bearer}});
 if(!response.ok)err('YW595_CURRENT_AUTH_SESSION_INVALID');
 const user=(await response.json()).id;
 if(!valid(user))err('YW595_USER_UUID_REQUIRED');
 const profile=await one('profiles','id,role,is_active',{id:user},
  'YW595_CURRENT_ACTIVE_PROFILE_REQUIRED');
 if(profile.is_active!==true)err('YW595_ACTIVE_USER_ONLY');
 return {user,profile};
}
async function admin(actor){
 if(actor.profile.role!=='admin')err('YW595_PLATFORM_ADMIN_ROLE_REQUIRED');
 const admins=await select('ywi_platform_administrators_489','user_id',
  {user_id:actor.user},2);
 if(admins.length!==1)err('YW595_EXPLICIT_PLATFORM_SYSOP_ENROLLMENT_REQUIRED');
}
async function tenant(company,actor){
 if(!valid(company))err('YW595_ORIGINAL_COMPANY_UUID_REQUIRED');
 const c=await one('ywi_companies','id,owner_user_id',{id:company},
  'YW595_UNKNOWN_ORIGINAL_COMPANY');
 const p=await one('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',
  {company_id:company},'YW595_ORIGINAL_PILOT_REQUIRED');
 if(c.owner_user_id!==p.owner_user_id||p.state!=='APPROVED'||
  Date.parse(p.expires_at)<=Date.now())err('YW595_APPROVED_ACTIVE_ORIGINAL_PILOT_REQUIRED');
 const owner=p.owner_user_id===actor.user,reviewer=p.reviewer_user_id===actor.user&&!owner;
 if(!owner&&!reviewer)err('YW595_TENANT_ORIGINAL_OWNER_OR_REVIEWER_ONLY');
 return {p,owner,reviewer};
}
const slotFields='id,company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at';
async function slot(company,id,p){
 if(!valid(id))err('YW595_ORIGINAL_SLOT_UUID_REQUIRED');
 const s=await one('ywi_593_witness_slots',slotFields,{id,company_id:company},
  'YW595_ORIGINAL_TENANT_SLOT_REQUIRED');
 if(s.owner_user_id!==p.owner_user_id||s.reviewer_user_id!==p.reviewer_user_id||
  new Set([s.owner_user_id,s.reviewer_user_id,s.crew_user_id]).size!==3)
  err('YW595_DISTINCT_ORIGINAL_FIELD_ACTORS_REQUIRED');
 return s;
}
async function approval(s){
 const a=await one('ywi_593_witness_approvals',
  'company_id,slot_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256',
  {company_id:s.company_id,slot_id:s.id},'YW595_SIGNED_ORIGINAL_WINDOW_REQUIRED');
 const msg=canonical({schema:'rosevear.yw.witness-window-approval.v1',
  companyId:s.company_id,slotId:s.id,attemptId:s.attempt_id,
  ownerId:s.owner_user_id,reviewerId:s.reviewer_user_id,crewId:s.crew_user_id,
  startsAt:s.starts_at,endsAt:s.ends_at,signedAt:a.signed_at});
 if(a.reviewer_user_id!==s.reviewer_user_id||await sha(msg)!==a.payload_sha256||
  !await verify('YW593_WITNESS_HMAC_KEY',msg,a.server_hmac_sha256))
  err('YW595_SIGNED_ORIGINAL_WINDOW_SIGNATURE_HOLD');
}
async function attempt(s,p){
 const a=await one('ywi_591_photo_attempts',
  'id,company_id,work_order_id,uploaded_by,state,content_sha256,stored_sha256,byte_count,object_key',
  {id:s.attempt_id,company_id:s.company_id},'YW595_REAL_ORIGINAL_ATTEMPT_REQUIRED');
 if(a.work_order_id!==p.work_order_id||a.uploaded_by!==s.crew_user_id||
  a.state!=='VERIFIED'||a.stored_sha256!==a.content_sha256||
  !SHA.test(a.content_sha256))err('YW595_REAL_VERIFIED_SOURCE_BYTES_REQUIRED');
 return a;
}
async function readBytes(a){
 const parts=(a.object_key||'').split('/');
 if(parts.length!==3||parts.some(x=>!x||x==='..'))
  err('YW595_PRIVATE_STORAGE_PATH_HOLD');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const response=await fetch(env('SUPABASE_URL')+'/storage/v1/object/authenticated/'+
  encodeURIComponent('ywi-private-device-evidence-589')+'/'+parts.map(encodeURIComponent).join('/'),
  {headers:{apikey:secret,authorization:'Bearer '+secret}});
 if(!response.ok)err('YW595_SOURCE_PRIVATE_BYTES_MISSING');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==a.byte_count||await sha(bytes)!==a.content_sha256)
  err('YW595_ORIGINAL_BYTE_SHA256_MISMATCH');
}
const contractFields='id,company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,receiver_response_sha256,receiver_signature,observed_at,expires_at';
async function contract(company,id,{allowExpired=false}={}){
 if(!valid(id))err('YW595_ORIGINAL_RECEIVER_CONTRACT_ID_REQUIRED');
 const c=await one('ywi_593_receiver_contracts',contractFields,
  {id,company_id:company},'YW595_ORIGINAL_RECEIVER_CONTRACT_REQUIRED');
 if(c.source_schema!=='rosevear.yw.source-photo-telemetry.v1'||
  c.ack_schema!=='YW592-ACK'||!allowExpired&&Date.parse(c.expires_at)<=Date.now())
  err('YW595_SOURCE_CONTRACT_VERSION_OR_EXPIRY_HOLD');
 const msg='YW593-CONTRACT|'+c.contract_id+'|'+c.company_id+'|'+c.request_nonce+
  '|'+c.source_schema+'|'+c.ack_schema;
 if(!await verify('YW592_MASTER_ACK_KEY',msg,c.receiver_signature)||
  await sha(canonical({contractId:c.contract_id,companyId:company,
   requestNonce:c.request_nonce,acceptedSourceSchema:c.source_schema,
   acceptedAckSchema:c.ack_schema}))!==c.receiver_response_sha256)
  err('YW595_GENUINE_SIGNED_MASTER_RECEIVER_CONTRACT_HOLD');
 return c;
}
const certFields='id,company_id,slot_id,proof_id,owner_observation_id,reviewer_user_id,master_receipt_id,receiver_contract_id,receiver_drift_id,source_sha256,certified_at,human_field_attested,hardware_attested,payload_sha256,server_hmac_sha256';
async function certificate(company,id,ctx){
 if(!valid(id))err('YW595_FIELD_CERTIFICATE_ID_REQUIRED');
 const c=await one('ywi_594_field_certificates',certFields,
  {id,company_id:company},'YW595_ORIGINAL_FIELD_CERTIFICATE_MISSING');
 const s=await slot(company,c.slot_id,ctx.p);
 await approval(s);
 const a=await attempt(s,ctx.p);
 const pf=await one('ywi_594_attendance_proofs',
  'id,company_id,slot_id,crew_user_id,key_fingerprint_sha256,hardware_attested',
  {id:c.proof_id,company_id:company},'YW595_SIGNED_ORIGINAL_CREW_PROOF_REQUIRED');
 const ob=await one('ywi_594_owner_observations',
  'id,company_id,slot_id,owner_user_id,co_presence_attested',
  {id:c.owner_observation_id,company_id:company},'YW595_REAL_OWNER_OBSERVATION_REQUIRED');
 const ack=await one('ywi_592_master_receipts',
  'id,company_id,attempt_id,device_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,master_ack_hmac_sha256,received_at',
  {id:c.master_receipt_id,company_id:company},
  'YW595_ORIGINAL_MASTER_RECEIVER_ACK_REQUIRED');
 const rc=await contract(company,c.receiver_contract_id,{allowExpired:true});
 const dr=await one('ywi_594_receiver_drift_alerts',
  'id,company_id,baseline_contract_id,owner_user_id,request_nonce,finding,response_sha256,observed_at,payload_sha256,local_hmac_sha256',
  {id:c.receiver_drift_id,company_id:company},'YW595_SIGNED_ORIGINAL_DRIFT_RECORD_REQUIRED');
 if(c.human_field_attested!==true||c.hardware_attested!==false||
  c.reviewer_user_id!==s.reviewer_user_id||
  pf.slot_id!==s.id||pf.crew_user_id!==s.crew_user_id||
  pf.hardware_attested!==false||ob.slot_id!==s.id||
  ob.owner_user_id!==s.owner_user_id||ob.co_presence_attested!==true||
  c.source_sha256!==a.content_sha256||
  ack.attempt_id!==a.id||ack.device_actor_id!==a.uploaded_by||
  ack.source_sha256!==a.content_sha256||rc.owner_user_id!==s.owner_user_id||
  dr.baseline_contract_id!==rc.id||dr.finding!=='MATCH'||
  Date.parse(dr.observed_at)>Date.parse(c.certified_at)||
  Date.parse(rc.expires_at)<=Date.parse(c.certified_at))
  err('YW595_ORIGINAL_CROSS_SOURCE_CERTIFICATE_BINDING_HOLD');
 const ackMsg='YW592-ACK|'+ack.master_receipt_id+'|'+ack.request_nonce+'|'+ack.payload_sha256;
 if(!await verify('YW592_MASTER_ACK_KEY',ackMsg,ack.master_ack_hmac_sha256))
  err('YW595_ORIGINAL_GENUINE_MASTER_ACK_SIGNATURE_HOLD');
 const drMsg=canonical({schema:'rosevear.yw.receiver-drift-observation.v1',
  companyId:company,baselineContractId:rc.id,ownerId:rc.owner_user_id,
  nonce:dr.request_nonce,finding:dr.finding,responseSha256:dr.response_sha256,
  observedAt:dr.observed_at,locallySignedOnly:true,notRemoteMasterReceipt:true});
 if(await sha(drMsg)!==dr.payload_sha256||
  !await verify('YW594_DRIFT_HMAC_KEY',drMsg,dr.local_hmac_sha256))
  err('YW595_ORIGINAL_LIVE_DRIFT_SIGNATURE_HOLD');
 const msg=canonical({schema:'rosevear.yw.independent-human-field-certificate.v1',
  companyId:company,slotId:s.id,proofId:pf.id,observationId:ob.id,
  ownerId:s.owner_user_id,crewId:s.crew_user_id,reviewerId:s.reviewer_user_id,
  masterReceiptId:ack.id,receiverContractId:rc.id,driftObservationId:dr.id,
  sourceSha256:a.content_sha256,crewDeviceKeySha256:pf.key_fingerprint_sha256,
  certifiedAt:c.certified_at,humanFieldAttested:true,hardwareAttested:false});
 if(await sha(msg)!==c.payload_sha256||
  !await verify('YW594_HUMAN_EVIDENCE_HMAC_KEY',msg,c.server_hmac_sha256))
  err('YW595_INDEPENDENT_HUMAN_CERTIFICATE_SIGNATURE_HOLD');
 return {c,s,a,ack,rc};
}
async function intent(company,id){
 if(!valid(id))err('YW595_CEREMONY_UUID_REQUIRED');
 return one('ywi_595_ceremony_intents',
  'id,company_id,slot_id,owner_user_id,reviewer_user_id,crew_user_id,source_sha256,briefing_consent,proposed_at',
  {id,company_id:company},'YW595_ORIGINAL_CEREMONY_INTENT_REQUIRED');
}
function closureMsg(c,cert){
 return canonical({schema:'rosevear.yw.supervised-original-device-ceremony.v1',
  companyId:c.company_id,ceremonyId:c.id,slotId:c.slot_id,
  ownerId:c.owner_user_id,reviewerId:c.reviewer_user_id,crewId:c.crew_user_id,
  sourceSha256:c.source_sha256,fieldCertificateId:cert.c.id,
  genuineMasterReceiptId:cert.ack.id,closedAt:cert.closedAt,
  humanFieldAttested:true,hardwareAttested:false});
}
const closureFields='id,company_id,intent_id,field_certificate_id,master_receipt_id,reviewer_user_id,source_sha256,closed_at,evidence_sha256,server_hmac_sha256';
async function closure(company,id,ctx){
 if(!valid(id))err('YW595_CEREMONY_CLOSURE_ID_REQUIRED');
 const c=await one('ywi_595_ceremony_closures',closureFields,
  {id,company_id:company},'YW595_CEREMONY_CLOSURE_NOT_FOUND');
 const i=await intent(company,c.intent_id);
 const cert=await certificate(company,c.field_certificate_id,ctx);
 if(cert.s.id!==i.slot_id||cert.ack.id!==c.master_receipt_id||
  cert.c.reviewer_user_id!==c.reviewer_user_id||i.reviewer_user_id!==c.reviewer_user_id||
  cert.a.content_sha256!==c.source_sha256||cert.a.content_sha256!==i.source_sha256)
  err('YW595_CLOSURE_CERTIFICATE_OR_SOURCE_CONFLICT');
 const msg=closureMsg(i,{...cert,closedAt:c.closed_at});
 if(await sha(msg)!==c.evidence_sha256||
  !await verify('YW595_CEREMONY_HMAC_KEY',msg,c.server_hmac_sha256))
  err('YW595_ORIGINAL_CEREMONY_CLOSURE_SIGNATURE_HOLD');
 return {c,i,cert};
}
async function begin(company,actor,ctx,data){
 if(!ctx.owner||data.confirmBriefing!==true)
  err('YW595_REAL_OWNER_SUPERVISED_BRIEFING_CONSENT_REQUIRED');
 const s=await slot(company,data.slotId,ctx.p);
 if(s.owner_user_id!==actor.user||Date.now()>Date.parse(s.ends_at))
  err('YW595_ORIGINAL_FIELD_WINDOW_ALREADY_ENDED');
 await approval(s);
 const a=await attempt(s,ctx.p);
 return rpc('ywi_595_begin_ceremony',{p_company_id:company,
  p_slot_id:s.id,p_owner_user_id:actor.user,p_source_sha256:a.content_sha256});
}
async function close(company,actor,ctx,data){
 if(!ctx.reviewer||data.attestSupervision!==true)
  err('YW595_DISTINCT_ORIGINAL_SUPERVISOR_ATTESTATION_REQUIRED');
 const i=await intent(company,data.ceremonyId);
 const cert=await certificate(company,data.fieldCertificateId,ctx);
 if(i.reviewer_user_id!==actor.user||i.slot_id!==cert.s.id||
  i.source_sha256!==cert.a.content_sha256||i.crew_user_id!==cert.s.crew_user_id||
  i.owner_user_id!==cert.s.owner_user_id||Date.now()>Date.parse(cert.c.certified_at)+72*3600000)
  err('YW595_ORIGINAL_FIELD_CEREMONY_CERTIFICATE_SCOPE_HOLD');
 await readBytes(cert.a);
 const closedAt=new Date().toISOString();
 const msg=closureMsg(i,{...cert,closedAt});
 return rpc('ywi_595_close_ceremony',{p_company_id:company,p_intent_id:i.id,
  p_certificate_id:cert.c.id,p_reviewer_user_id:actor.user,p_signed_at:closedAt,
  p_payload_sha256:await sha(msg),
  p_server_hmac:await sign('YW595_CEREMONY_HMAC_KEY',msg)});
}
const rotationFields='id,company_id,prior_contract_id,candidate_contract_id,owner_user_id,reviewer_user_id,reason,custody_only,proposed_at';
async function rotation(company,id){
 if(!valid(id))err('YW595_ROTATION_UUID_REQUIRED');
 return one('ywi_595_rotation_proposals',rotationFields,
  {id,company_id:company},'YW595_ORIGINAL_ROTATION_PROPOSAL_REQUIRED');
}
function rotationMsg(r,oldc,newc,signedAt){
 return canonical({schema:'rosevear.yw.receiver-rotation-custody.v1',
  companyId:r.company_id,rotationId:r.id,
  ownerId:r.owner_user_id,reviewerId:r.reviewer_user_id,
  priorContractRecordId:oldc.id,candidateContractRecordId:newc.id,
  priorContractId:oldc.contract_id,candidateContractId:newc.contract_id,
  priorReceiverHmac:oldc.receiver_signature,candidateReceiverHmac:newc.receiver_signature,
  reason:r.reason,proposedAt:r.proposed_at,signedAt,
  actualSecretRotated:false,remoteEndpointChanged:false});
}
async function propose(company,actor,ctx,data){
 if(!ctx.owner||data.confirmCustodyOnly!==true)
  err('YW595_EXPLICIT_OWNER_CUSTODY_ONLY_CONSENT_REQUIRED');
 const oldc=await contract(company,data.priorContractId,{allowExpired:true});
 const newc=await contract(company,data.candidateContractId);
 if(oldc.id===newc.id||oldc.owner_user_id!==actor.user||
  newc.owner_user_id!==actor.user||oldc.contract_id===newc.contract_id||
  Date.parse(newc.observed_at)<=Date.parse(oldc.observed_at))
  err('YW595_TWO_SEPARATE_REAL_SIGNED_MASTER_CONTRACTS_REQUIRED');
 const reason=data.reason;
 if(!['PLANNED_ROTATION','RECEIVER_CONTRACT_CHANGE','EXPIRED_BASELINE_REVIEW'].includes(reason))
  err('YW595_EXPLICIT_ROTATION_REASON_REQUIRED');
 return rpc('ywi_595_propose_rotation',{p_company_id:company,
  p_prior_contract_id:oldc.id,p_candidate_contract_id:newc.id,
  p_owner_user_id:actor.user,p_reason:reason});
}
async function approveRotation(company,actor,ctx,data){
 if(!ctx.reviewer||data.attestIndependentReview!==true)
  err('YW595_DISTINCT_REVIEWER_ROTATION_CUSTODY_REQUIRED');
 const r=await rotation(company,data.rotationId);
 if(r.reviewer_user_id!==actor.user||Date.now()>Date.parse(r.proposed_at)+24*3600000)
  err('YW595_ORIGINAL_ROTATION_CUSTODY_REVIEW_EXPIRED');
 const oldc=await contract(company,r.prior_contract_id,{allowExpired:true});
 const newc=await contract(company,r.candidate_contract_id);
 if(r.owner_user_id!==ctx.p.owner_user_id||r.custody_only!==true||
  oldc.owner_user_id!==r.owner_user_id||newc.owner_user_id!==r.owner_user_id||
  oldc.contract_id===newc.contract_id||Date.parse(newc.observed_at)<=Date.parse(oldc.observed_at))
  err('YW595_SIGNED_CUSTODY_REVIEW_CONFLICT');
 const signedAt=new Date().toISOString(),msg=rotationMsg(r,oldc,newc,signedAt);
 return rpc('ywi_595_approve_rotation',{p_company_id:company,p_rotation_id:r.id,
  p_reviewer_user_id:actor.user,p_signed_at:signedAt,p_payload_sha256:await sha(msg),
  p_server_hmac:await sign('YW595_ROTATION_HMAC_KEY',msg)});
}
const optinFields='id,company_id,ceremony_closure_id,owner_user_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256,opt_in_consent';
function optinMsg(o,close){
 return canonical({schema:'rosevear.yw.independent-two-tenant-optin.v1',
  companyId:o.company_id,closureId:o.ceremony_closure_id,
  originalOwnerId:o.owner_user_id,originalReviewerId:o.reviewer_user_id,
  sourceSha256:close.c.source_sha256,signedAt:o.signed_at,
  tenantOwnerConsents:true,sharePrivatePhoto:false});
}
async function opted(company,id){
 const o=await one('ywi_595_fleet_optins',optinFields,
  {id,company_id:company},'YW595_ORIGINAL_TENANT_OPTIN_NOT_FOUND');
 const c=await one('ywi_595_ceremony_closures',closureFields,
  {id:o.ceremony_closure_id,company_id:company},'YW595_OPTIN_CEREMONY_CLOSURE_REQUIRED');
 const msg=optinMsg(o,{c});
 if(o.opt_in_consent!==true||o.reviewer_user_id!==c.reviewer_user_id||
  await sha(msg)!==o.payload_sha256||
  !await verify('YW595_FLEET_HMAC_KEY',msg,o.server_hmac_sha256))
  err('YW595_REAL_OWNER_FLEET_OPTIN_SIGNATURE_HOLD');
 return {o,c};
}
async function optin(company,actor,ctx,data){
 if(!ctx.owner||data.confirmFleetOptin!==true)
  err('YW595_EXPLICIT_ORIGINAL_OWNER_FLEET_OPTIN_REQUIRED');
 const close=await closure(company,data.closureId,ctx);
 if(close.i.owner_user_id!==actor.user)
  err('YW595_FLEET_OWNER_CEREMONY_CONFLICT');
 const signedAt=new Date().toISOString(),
  o={company_id:company,ceremony_closure_id:close.c.id,owner_user_id:actor.user,
   reviewer_user_id:close.i.reviewer_user_id,signed_at:signedAt};
 const msg=optinMsg(o,close);
 return rpc('ywi_595_optin_fleet',{p_company_id:company,p_closure_id:close.c.id,
  p_owner_user_id:actor.user,p_signed_at:signedAt,p_payload_sha256:await sha(msg),
  p_server_hmac:await sign('YW595_FLEET_HMAC_KEY',msg)});
}
function fleetMsg(a,b,sysop,signedAt){
 return canonical({schema:'rosevear.yw.two-distinct-original-tenant-human-review.v1',
  firstCompanyId:a.o.company_id,secondCompanyId:b.o.company_id,
  firstOptinId:a.o.id,secondOptinId:b.o.id,
  firstCeremonyClosureId:a.c.id,secondCeremonyClosureId:b.c.id,
  firstEvidenceDigest:a.c.evidence_sha256,secondEvidenceDigest:b.c.evidence_sha256,
  platformSysopId:sysop,observedAt:signedAt,reviewScope:'TWO_ORIGINAL_TENANT_HUMAN_EVIDENCE',
  hardwareAttested:false,noPrivateMediaTransferred:true});
}
async function fleetReview(actor,data){
 await admin(actor);
 if(!valid(data.firstOptinId)||!valid(data.secondOptinId)||
  data.firstOptinId===data.secondOptinId||data.confirmIndependentReview!==true)
  err('YW595_TWO_EXPLICIT_REAL_OPTINS_AND_SYSOP_REVIEW_REQUIRED');
 // Discover company through service-only readback: never expose other-tenant details to owners.
 const aa=await one('ywi_595_fleet_optins',optinFields,
  {id:data.firstOptinId},'YW595_FIRST_ORIGINAL_OPTIN_REQUIRED');
 const bb=await one('ywi_595_fleet_optins',optinFields,
  {id:data.secondOptinId},'YW595_SECOND_ORIGINAL_OPTIN_REQUIRED');
 if(aa.company_id>=bb.company_id||aa.owner_user_id===bb.owner_user_id||
  aa.reviewer_user_id===bb.reviewer_user_id||
  new Set([aa.owner_user_id,aa.reviewer_user_id,bb.owner_user_id,
   bb.reviewer_user_id,actor.user]).size!==5)
  err('YW595_TWO_INDEPENDENT_COMPANIES_OWNERS_REVIEWERS_REQUIRED');
 const a=await opted(aa.company_id,aa.id),b=await opted(bb.company_id,bb.id);
 // Revalidate original current independently enrolled pilot and signed complete certificates.
 for(const item of [a,b]){
  const state=await tenant(item.o.company_id,{user:item.o.owner_user_id,profile:{role:'owner'}});
  const closed=await closure(item.o.company_id,item.c.id,state);
  if(closed.i.owner_user_id!==item.o.owner_user_id||
    closed.i.reviewer_user_id!==item.o.reviewer_user_id)
   err('YW595_ORIGINAL_TENANT_HUMAN_CHARTER_CONFLICT');
 }
 const at=new Date().toISOString(),message=fleetMsg(a,b,actor.user,at);
 return rpc('ywi_595_review_fleet',{p_optin_a_id:a.o.id,p_optin_b_id:b.o.id,
  p_sysop_user_id:actor.user,p_signed_at:at,p_payload_sha256:await sha(message),
  p_server_hmac:await sign('YW595_FLEET_HMAC_KEY',message)});
}
async function overview(company,ctx){
 const intents=await select('ywi_595_ceremony_intents',
  'id,slot_id,proposed_at,source_sha256',{company_id:company});
 const closes=await select('ywi_595_ceremony_closures',
  'id,intent_id,field_certificate_id,closed_at',{company_id:company});
 const rotations=await select('ywi_595_rotation_proposals',
  'id,prior_contract_id,candidate_contract_id,reason,proposed_at',{company_id:company});
 const signoffs=await select('ywi_595_rotation_signoffs',
  'id,proposal_id,signed_at,actual_secret_rotated',{company_id:company});
 const optins=await select('ywi_595_fleet_optins',
  'id,ceremony_closure_id,signed_at',{company_id:company});
 const contracts=await select('ywi_593_receiver_contracts',
  'id,contract_id,observed_at,expires_at',{company_id:company});
 return {state:'ORIGINAL_TENANT_SUPERVISED_SOURCE_QUEUE',
  receiverContracts:contracts.map(x=>({contractRecordId:x.id,contractId:x.contract_id,
   observedAt:x.observed_at,expiresAt:x.expires_at})),
  ceremonies:intents.map(x=>({
  ceremonyId:x.id,slotId:x.slot_id,
  closureId:closes.find(c=>c.intent_id===x.id)?.id||null,proposedAt:x.proposed_at})),
  rotations:rotations.map(x=>({rotationId:x.id,
   priorContractRecordId:x.prior_contract_id,candidateContractRecordId:x.candidate_contract_id,
   reviewSigned:!!signoffs.find(z=>z.proposal_id===x.id),actualSecretRotated:false})),
  fleetOptins:optins.map(x=>({optinId:x.id,closureId:x.ceremony_closure_id})),
  twoTenantReviewCertified:false,privateMediaShared:false,hardwareAttested:false};
}
async function sysopOverview(actor){
 await admin(actor);
 const all=await select('ywi_595_fleet_optins','id,company_id,signed_at',{},100);
 const reviews=await select('ywi_595_fleet_reviews','id,created_at',{},100);
 return {state:'INDEPENDENT_PLATFORM_FLEET_OPTIN_DIRECTORY',
  independentlyOptedInCompanies:all.length,
  optins:all.map(x=>({optinId:x.id,companyId:x.company_id,signedAt:x.signed_at})),
  completedHumanEvidenceReviews:reviews.length,privatePhotoDataExposed:false,
  noAutomaticCrossTenantContact:true};
}
async function perform(data,actor){
 const action=data?.action;
 if(action==='sysop-overview')return sysopOverview(actor);
 if(action==='sysop-two-tenant-review')return fleetReview(actor,data);
 const company=data?.companyId,ctx=await tenant(company,actor);
 switch(action){
  case 'overview':return overview(company,ctx);
  case 'begin-ceremony':return begin(company,actor,ctx,data);
  case 'close-ceremony':return close(company,actor,ctx,data);
  case 'propose-rotation':return propose(company,actor,ctx,data);
  case 'review-rotation':return approveRotation(company,actor,ctx,data);
  case 'optin-two-tenant-review':return optin(company,actor,ctx,data);
  default:err('YW595_UNKNOWN_ORIGINAL_SOURCE_OPERATION');
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
 const send=(obj,status=200)=>Response.json(obj,{status,headers:h});
 if(req.method!=='POST')return send({state:'HOLD',code:'YW595_POST_REQUIRED'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   err('YW595_JSON_REQUIRED');
  const raw=await req.text();if(raw.length>4096)err('YW595_REQUEST_TOO_LARGE');
  const actor=await auth(req);
  return send(await perform(JSON.parse(raw),actor));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW595_ORIGINAL_AUTHORITY_OR_SIGNED_SOURCE_HOLD',
  noSyntheticPilot:true,hardwareAttested:false,sourcePhotoExposed:false,
  actualSecretRotated:false,tenantCountCertified:0,noAutomaticActions:true},403);}
});
