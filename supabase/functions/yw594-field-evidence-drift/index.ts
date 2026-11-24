// YW594: original-crew browser cryptographic challenge + distinct human observation
// and independently signed reviewer certification. Browser != hardware attestation.
const ORIGINS=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const B64=/^[A-Za-z0-9_-]{43}$/;
const valid=x=>typeof x==='string'&&UUID.test(x);
const err=code=>{throw Object.assign(new Error(code),{code})};
const utf=s=>new TextEncoder().encode(s);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async x=>hex(await crypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const env=k=>{const v=Deno.env.get(k);if(!v)err('YW594_SERVER_CONFIG_'+k+'_HOLD');return v;};
async function key(name){return crypto.subtle.importKey('raw',utf(env(name)),
 {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(name,msg){return hex(await crypto.subtle.sign('HMAC',await key(name),utf(msg)));}
async function verify(name,msg,sig){return typeof sig==='string'&&SHA.test(sig)&&
 crypto.subtle.verify('HMAC',await key(name),new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16))),utf(msg));}
const rawB64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));
function publicKey(jwk){
 if(!jwk||typeof jwk!=='object'||Array.isArray(jwk)||jwk.kty!=='EC'||
   jwk.crv!=='P-256'||!B64.test(jwk.x||'')||!B64.test(jwk.y||''))err('YW594_ONLY_FRESH_P256_BROWSER_KEY');
 return {kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y};
}
async function deviceVerify(jwk,message,sig){
 const b=typeof sig==='string'?rawB64(sig):new Uint8Array();
 if(b.length!==64)return false;
 try{const k=await crypto.subtle.importKey('jwk',publicKey(jwk),
  {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,b,utf(message));
 }catch{return false;}
}
async function service(path,method='GET',body){
 const secret=env('SUPABASE_SERVICE_ROLE_KEY'),url=env('SUPABASE_URL')+path;
 const r=await fetch(url,{method,headers:{apikey:secret,authorization:'Bearer '+secret,
  ...(body?{'content-type':'application/json','prefer':'return=representation'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)err('YW594_PRIVATE_SQL_OR_AUTHORITY_HOLD');
 return r.json();
}
async function select(table,fields,terms={},limit=25){
 const q=new URLSearchParams({select:fields,limit:String(limit)});
 for(const [name,val]of Object.entries(terms))q.set(name,'eq.'+val);
 return service('/rest/v1/'+table+'?'+q);
}
async function single(table,fields,terms,code){
 const x=await select(table,fields,terms,2);
 if(x.length!==1)err(code);return x[0];
}
const rpc=(name,params)=>service('/rest/v1/rpc/'+name,'POST',params);
async function auth(req){
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_=-]+(?:\.[A-Za-z0-9_=-]+){2}$/.test(bearer))
  err('YW594_ORIGINAL_JWT_REQUIRED');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const res=await fetch(env('SUPABASE_URL')+'/auth/v1/user',
  {headers:{apikey:secret,authorization:bearer}});
 if(!res.ok)err('YW594_ORIGINAL_SESSION_REJECTED');
 const actor=(await res.json()).id;
 if(!valid(actor))err('YW594_ORIGINAL_ACCOUNT_REQUIRED');
 const profile=await select('profiles','id,is_active',{id:actor},2);
 if(profile.length!==1||profile[0].is_active!==true)err('YW594_ACTIVE_ACCOUNT_REQUIRED');
 return actor;
}
async function context(company,actor){
 if(!valid(company))err('YW594_COMPANY_ID_REQUIRED');
 const c=await single('ywi_companies','id,owner_user_id',{id:company},'YW594_COMPANY_NOT_FOUND');
 const p=await single('ywi_591_tenant_pilots',
  'company_id,owner_user_id,reviewer_user_id,work_order_id,state,expires_at',
  {company_id:company},'YW594_ORIGINAL_PILOT_NOT_FOUND');
 if(c.owner_user_id!==p.owner_user_id||p.state!=='APPROVED'||Date.parse(p.expires_at)<=Date.now())
  err('YW594_ORIGINAL_PILOT_NOT_APPROVED');
 const owner=p.owner_user_id===actor,reviewer=p.reviewer_user_id===actor&&!owner;
 const staff=await select('ywi_591_pilot_staff','user_id,role,state',
  {company_id:company,user_id:actor},4);
 const crew=!owner&&!reviewer&&staff.some(x=>x.role==='crew'&&x.state==='APPROVED');
 if(!owner&&!reviewer&&!crew)err('YW594_REAL_ORIGINAL_PILOT_PRINCIPAL_REQUIRED');
 return {pilot:p,owner,reviewer,crew};
}
async function slot(company,id,pilot){
 if(!valid(id))err('YW594_SLOT_UUID_REQUIRED');
 const s=await single('ywi_593_witness_slots',
  'id,company_id,attempt_id,owner_user_id,reviewer_user_id,crew_user_id,starts_at,ends_at',
  {id,company_id:company},'YW594_TENANT_SLOT_MISSING');
 if(s.owner_user_id!==pilot.owner_user_id||s.reviewer_user_id!==pilot.reviewer_user_id)
  err('YW594_ORIGINAL_APPROVAL_ACTORS_CHANGED');
 return s;
}
async function approved(s){
 const a=await single('ywi_593_witness_approvals',
  'slot_id,company_id,reviewer_user_id,signed_at,payload_sha256,server_hmac_sha256',
  {slot_id:s.id,company_id:s.company_id},'YW594_DISTINCT_SIGNED_WINDOW_REQUIRED');
 const msg=canonical({schema:'rosevear.yw.witness-window-approval.v1',
  companyId:s.company_id,slotId:s.id,attemptId:s.attempt_id,ownerId:s.owner_user_id,
  reviewerId:s.reviewer_user_id,crewId:s.crew_user_id,startsAt:s.starts_at,
  endsAt:s.ends_at,signedAt:a.signed_at});
 if(a.reviewer_user_id!==s.reviewer_user_id||await sha(msg)!==a.payload_sha256||
  !await verify('YW593_WITNESS_HMAC_KEY',msg,a.server_hmac_sha256))
  err('YW594_WINDOW_REVIEW_SIGNATURE_HOLD');
}
async function attempt(company,s,pilot){
 const a=await single('ywi_591_photo_attempts',
  'id,company_id,work_order_id,uploaded_by,content_sha256,stored_sha256,byte_count,object_key,state',
  {id:s.attempt_id,company_id:company},'YW594_ORIGINAL_ATTEMPT_MISSING');
 if(a.work_order_id!==pilot.work_order_id||a.uploaded_by!==s.crew_user_id||
  a.state!=='VERIFIED'||a.stored_sha256!==a.content_sha256||!SHA.test(a.content_sha256))
  err('YW594_ORIGINAL_BYTES_AND_CREW_NOT_VERIFIED');
 return a;
}
function challengeText(c){
 return canonical({schema:'rosevear.yw.attendance-challenge.v1',
  companyId:c.company_id,slotId:c.slot_id,attemptId:c.attempt_id,
  crewId:c.crew_user_id,challengeId:c.id,nonce:c.nonce,sourceSha256:c.source_sha256});
}
const proofFields='id,challenge_id,company_id,slot_id,crew_user_id,signed_at,challenge_message_sha256,key_fingerprint_sha256,public_jwk,device_signature_b64url,hardware_attested';
const challengeFields='id,company_id,slot_id,attempt_id,crew_user_id,nonce,source_sha256,issued_at,expires_at';
async function getProof(company,proofId){
 if(!valid(proofId))err('YW594_PROOF_UUID_REQUIRED');
 const pf=await single('ywi_594_attendance_proofs',proofFields,
  {id:proofId,company_id:company},'YW594_TENANT_PROOF_REQUIRED');
 const c=await single('ywi_594_attendance_challenges',challengeFields,
  {id:pf.challenge_id,company_id:company},'YW594_ORIGINAL_CHALLENGE_REQUIRED');
 if(pf.slot_id!==c.slot_id||pf.crew_user_id!==c.crew_user_id||
  Date.parse(pf.signed_at)>Date.parse(c.expires_at)||pf.hardware_attested!==false||
  await sha(challengeText(c))!==pf.challenge_message_sha256||
  await sha(canonical(publicKey(pf.public_jwk)))!==pf.key_fingerprint_sha256||
  !await deviceVerify(pf.public_jwk,challengeText(c),pf.device_signature_b64url))
  err('YW594_STORED_BROWSER_CHALLENGE_SIGNATURE_HOLD');
 return {pf,c};
}
function ownerText(o,pf,c){
 return canonical({schema:'rosevear.yw.human-owner-observation.v1',
  companyId:o.company_id,slotId:o.slot_id,proofId:pf.id,
  challengeId:c.id,crewId:pf.crew_user_id,ownerId:o.owner_user_id,
  sourceSha256:c.source_sha256,observedAt:o.observed_at,
  coPresenceAttested:true,hardwareAttested:false});
}
async function ownerValid(company,pf,c,s){
 const o=await single('ywi_594_owner_observations',
  'id,company_id,slot_id,proof_id,owner_user_id,observed_at,co_presence_attested,payload_sha256,server_hmac_sha256',
  {proof_id:pf.id,company_id:company},'YW594_ORIGINAL_OWNER_OBSERVATION_REQUIRED');
 const msg=ownerText(o,pf,c);
 if(o.owner_user_id!==s.owner_user_id||o.slot_id!==s.id||!o.co_presence_attested||
  await sha(msg)!==o.payload_sha256||
  !await verify('YW594_HUMAN_EVIDENCE_HMAC_KEY',msg,o.server_hmac_sha256))
  err('YW594_OWNER_HUMAN_OBSERVATION_SIGNATURE_HOLD');
 return o;
}
function contractText(c){
 return 'YW593-CONTRACT|'+c.contract_id+'|'+c.company_id+'|'+c.request_nonce+
  '|'+c.source_schema+'|'+c.ack_schema;
}
async function contractValid(c,company){
 if(!c||c.company_id!==company||c.source_schema!=='rosevear.yw.source-photo-telemetry.v1'||
  c.ack_schema!=='YW592-ACK'||Date.parse(c.expires_at)<=Date.now()||
  !await verify('YW592_MASTER_ACK_KEY',contractText(c),c.receiver_signature)||
  c.receiver_response_sha256!==await sha(canonical({contractId:c.contract_id,companyId:company,
   requestNonce:c.request_nonce,acceptedSourceSchema:c.source_schema,acceptedAckSchema:c.ack_schema})))
  err('YW594_ORIGINAL_RECEIVER_BASELINE_SIGNATURE_HOLD');
 return c;
}
function driftText(x){
 return canonical({schema:'rosevear.yw.receiver-drift-observation.v1',
  companyId:x.company_id,baselineContractId:x.baseline_contract_id,
  ownerId:x.owner_user_id,nonce:x.request_nonce,finding:x.finding,
  responseSha256:x.response_sha256,observedAt:x.observed_at,
  locallySignedOnly:true,notRemoteMasterReceipt:true});
}
async function driftValid(d,contract,company){
 if(!d||d.baseline_contract_id!==contract.id||d.company_id!==company||
  d.owner_user_id!==contract.owner_user_id||d.finding!=='MATCH'||
  Date.parse(d.observed_at)<Date.parse(contract.observed_at)||
  Date.parse(d.observed_at)<Date.now()-60*60*1000||
  await sha(driftText(d))!==d.payload_sha256||
  !await verify('YW594_DRIFT_HMAC_KEY',driftText(d),d.local_hmac_sha256))
  err('YW594_RECENT_MATCHING_SIGNED_RECEIVER_PROBE_REQUIRED');
}
async function ackValid(company,a){
 const x=await single('ywi_592_master_receipts',
  'id,company_id,attempt_id,device_actor_id,master_receipt_id,request_nonce,source_sha256,payload_sha256,master_ack_hmac_sha256,received_at',
  {company_id:company,attempt_id:a.id},'YW594_GENUINE_MASTER_ACK_REQUIRED');
 if(x.source_sha256!==a.content_sha256||x.device_actor_id!==a.uploaded_by||
  !await verify('YW592_MASTER_ACK_KEY',
   'YW592-ACK|'+x.master_receipt_id+'|'+x.request_nonce+'|'+x.payload_sha256,
   x.master_ack_hmac_sha256))
  err('YW594_GENUINE_MASTER_ACK_SIGNATURE_HOLD');
 return x;
}
async function originalBytes(a){
 const parts=(a.object_key||'').split('/');
 if(parts.length!==3||parts.some(x=>!x||x==='..'))err('YW594_PRIVATE_STORAGE_KEY_HOLD');
 const secret=env('SUPABASE_SERVICE_ROLE_KEY');
 const res=await fetch(env('SUPABASE_URL')+'/storage/v1/object/authenticated/'+
  encodeURIComponent('ywi-private-device-evidence-589')+'/'+parts.map(encodeURIComponent).join('/'),
  {headers:{apikey:secret,authorization:'Bearer '+secret}});
 if(!res.ok)err('YW594_SOURCE_PRIVATE_BYTES_UNAVAILABLE');
 const bytes=await res.arrayBuffer();
 if(bytes.byteLength!==a.byte_count||await sha(bytes)!==a.content_sha256)
  err('YW594_SOURCE_BYTE_DIGEST_MISMATCH');
}
async function issue(data,actor,company,ctx){
 if(!ctx.crew)err('YW594_ONLY_ORIGINAL_CREW_MAY_CHALLENGE');
 const s=await slot(company,data.slotId,ctx.pilot);
 if(s.crew_user_id!==actor||Date.now()<Date.parse(s.starts_at)||
  Date.now()>Date.parse(s.ends_at))err('YW594_REAL_ORIGINAL_CREW_WINDOW_REQUIRED');
 await approved(s);
 const a=await attempt(company,s,ctx.pilot);
 const result=await rpc('ywi_594_issue_attendance',
  {p_company_id:company,p_slot_id:s.id,p_crew_user_id:actor,p_nonce:crypto.randomUUID()});
 const challenge=await single('ywi_594_attendance_challenges',challengeFields,
  {id:result.challengeId,company_id:company},'YW594_CHALLENGE_NOT_DURABLY_STORED');
 if(challenge.crew_user_id!==actor||challenge.attempt_id!==a.id||
  Date.parse(challenge.expires_at)<=Date.now())err('YW594_CHALLENGE_NOT_CURRENT');
 return {state:result.state,challengeId:challenge.id,
  message:challengeText(challenge),expiresAt:challenge.expires_at,
  hardwareAttested:false,physicalAttendanceCertified:false};
}
async function attend(data,actor,company,ctx){
 if(!ctx.crew||!valid(data.challengeId))err('YW594_ORIGINAL_CREW_ONLY');
 const c=await single('ywi_594_attendance_challenges',challengeFields,
  {id:data.challengeId,company_id:company},'YW594_CHALLENGE_NOT_FOUND');
 const s=await slot(company,c.slot_id,ctx.pilot);
 await approved(s);
 if(c.crew_user_id!==actor||s.crew_user_id!==actor||c.attempt_id!==s.attempt_id||
  Date.now()>Date.parse(c.expires_at)||Date.now()>Date.parse(s.ends_at))
  err('YW594_CHALLENGE_EXPIRED_OR_WRONG_CREW');
 const a=await attempt(company,s,ctx.pilot);
 if(c.source_sha256!==a.content_sha256)err('YW594_CHALLENGE_SOURCE_CHANGED');
 const jwk=publicKey(data.publicJwk),message=challengeText(c);
 if(!await deviceVerify(jwk,message,data.signature))
  err('YW594_P256_BROWSER_CHALLENGE_NOT_VERIFIED');
 const fingerprint=await sha(canonical(jwk)),signedAt=new Date().toISOString();
 return rpc('ywi_594_record_attendance',{
  p_company_id:company,p_challenge_id:c.id,p_crew_user_id:actor,p_signed_at:signedAt,
  p_message_sha256:await sha(message),p_fingerprint_sha256:fingerprint,
  p_jwk:jwk,p_signature:data.signature});
}
async function observe(data,actor,company,ctx){
 if(!ctx.owner||data.attestCoPresence!==true)err('YW594_ORIGINAL_OWNER_COPRESENCE_CONFIRMATION_REQUIRED');
 const {pf,c}=await getProof(company,data.proofId);
 const s=await slot(company,pf.slot_id,ctx.pilot);
 await approved(s);await attempt(company,s,ctx.pilot);
 if(s.owner_user_id!==actor||Date.now()<Date.parse(s.starts_at)||
  Date.now()>Date.parse(s.ends_at)+15*60000)
  err('YW594_OWNER_OBSERVATION_WINDOW_EXPIRED');
 const o={company_id:company,slot_id:s.id,owner_user_id:actor,
  observed_at:new Date().toISOString()},msg=ownerText(o,pf,c);
 return rpc('ywi_594_owner_observe',{p_company_id:company,p_proof_id:pf.id,
  p_owner_user_id:actor,p_observed_at:o.observed_at,
  p_payload_sha256:await sha(msg),
  p_server_hmac:await sign('YW594_HUMAN_EVIDENCE_HMAC_KEY',msg)});
}
function receiverUrl(){
 const url=new URL(env('YW592_MASTER_RECEIPT_URL'));
 const host=env('YW593_MASTER_ALLOWED_HOST').toLowerCase();
 if(url.protocol!=='https:'||url.hostname.toLowerCase()!==host||url.username||
  url.password||url.port||url.search||url.hash||host==='localhost'||
  host.endsWith('.local')||host.includes(':')||!host.includes('.')||
  /^\d+\.\d+\.\d+\.\d+$/.test(host))
  err('YW594_PINNED_HTTPS_RECEIVER_REQUIRED');
 return url;
}
async function probe(data,actor,company,ctx){
 if(!ctx.owner)err('YW594_OWNER_ONLY');
 const contract=(await select('ywi_593_receiver_contracts',
  'id,company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,receiver_response_sha256,receiver_signature,observed_at,expires_at',
  {company_id:company},25)).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at))[0];
 await contractValid(contract,company);
 if(contract.owner_user_id!==actor)err('YW594_ORIGINAL_CONTRACT_OWNER_REQUIRED');
 const url=receiverUrl(),nonce=crypto.randomUUID();
 const body=canonical({schema:'rosevear.yw.receiver-contract-probe.v1',
  companyId:company,requestNonce:nonce,sourceApp:'yw',
  acceptedSourceSchemaRequired:'rosevear.yw.source-photo-telemetry.v1',
  acceptedAckSchemaRequired:'YW592-ACK',noSourceBytes:true,noPersonalDetails:true});
 const sendSig=await sign('YW592_TELEMETRY_SEND_KEY',body);
 // Confirm our local drift key is enrolled BEFORE treating a remote failure as an alert.
 await key('YW594_DRIFT_HMAC_KEY');
 let finding='UNAVAILABLE_HOLD',responseSha=await sha('YW594_UNAVAILABLE_HOLD');
 try{
  const res=await fetch(url.toString(),{method:'POST',redirect:'error',
   signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json',
    'x-rosevear-yw-source-signature':sendSig},body});
  if(res.ok){
   const reply=await res.text();
   if(reply.length<=4096){
    let ans;
    try{ans=JSON.parse(reply);}catch{ans=null;}
    const {contractId,companyId,requestNonce,acceptedSourceSchema,acceptedAckSchema,signature}=ans||{};
    if(companyId===company&&requestNonce===nonce&&
     /^[A-Za-z0-9_-]{8,128}$/.test(contractId||'')&&
     acceptedSourceSchema==='rosevear.yw.source-photo-telemetry.v1'&&
     acceptedAckSchema==='YW592-ACK'&&
     await verify('YW592_MASTER_ACK_KEY',
      'YW593-CONTRACT|'+contractId+'|'+company+'|'+nonce+'|'+acceptedSourceSchema+'|'+acceptedAckSchema,
      signature)){
      finding=contractId===contract.contract_id?'MATCH':'VERIFIED_CONTRACT_CHANGED';
      responseSha=await sha(canonical({contractId,companyId,requestNonce,
       acceptedSourceSchema,acceptedAckSchema}));
    }else {finding='UNVERIFIED_RESPONSE_HOLD';responseSha=await sha('YW594_UNVERIFIED_RESPONSE_HOLD');}
   }else{finding='UNVERIFIED_RESPONSE_HOLD';responseSha=await sha('YW594_UNVERIFIED_RESPONSE_HOLD');}
  }
 }catch{/* Network failure is a locally signed HOLD, never proof of remote contract drift. */}
 const event={company_id:company,baseline_contract_id:contract.id,owner_user_id:actor,
  request_nonce:nonce,finding,response_sha256:responseSha,observed_at:new Date().toISOString()};
 const msg=driftText(event);
 return rpc('ywi_594_record_receiver_drift',{p_company_id:company,p_contract_id:contract.id,
  p_owner_user_id:actor,p_nonce:nonce,p_finding:finding,p_response_sha256:responseSha,
  p_observed_at:event.observed_at,p_payload_sha256:await sha(msg),
  p_local_hmac:await sign('YW594_DRIFT_HMAC_KEY',msg)});
}
async function certify(data,actor,company,ctx){
 if(!ctx.reviewer||data.attestInPerson!==true)
  err('YW594_DISTINCT_IN_PERSON_REVIEWER_CONFIRMATION_REQUIRED');
 const {pf,c}=await getProof(company,data.proofId);
 const s=await slot(company,pf.slot_id,ctx.pilot);
 await approved(s);
 if(s.reviewer_user_id!==actor||Date.now()>Date.parse(s.ends_at)+24*3600000)
  err('YW594_ORIGINAL_REVIEWER_OR_FIELD_WINDOW_HOLD');
 const a=await attempt(company,s,ctx.pilot);
 if(c.source_sha256!==a.content_sha256)err('YW594_ORIGINAL_CHALLENGE_DIGEST_CHANGED');
 const owner=await ownerValid(company,pf,c,s);
 const ack=await ackValid(company,a);
 const contract=(await select('ywi_593_receiver_contracts',
  'id,company_id,owner_user_id,request_nonce,contract_id,source_schema,ack_schema,receiver_response_sha256,receiver_signature,observed_at,expires_at',
  {company_id:company},25)).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at))[0];
 await contractValid(contract,company);
 const last=(await select('ywi_594_receiver_drift_alerts',
  'id,company_id,baseline_contract_id,owner_user_id,request_nonce,finding,response_sha256,observed_at,payload_sha256,local_hmac_sha256',
  {company_id:company},25)).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at))[0];
 await driftValid(last,contract,company);
 await originalBytes(a);
 const certifiedAt=new Date().toISOString(),body=canonical({
  schema:'rosevear.yw.independent-human-field-certificate.v1',
  companyId:company,slotId:s.id,proofId:pf.id,
  observationId:owner.id,ownerId:owner.owner_user_id,crewId:s.crew_user_id,
  reviewerId:actor,masterReceiptId:ack.id,receiverContractId:contract.id,
  driftObservationId:last.id,sourceSha256:a.content_sha256,
  crewDeviceKeySha256:pf.key_fingerprint_sha256,certifiedAt,
  humanFieldAttested:true,hardwareAttested:false});
 return rpc('ywi_594_certify_field',{p_company_id:company,p_proof_id:pf.id,
  p_observation_id:owner.id,p_reviewer_user_id:actor,p_master_receipt_id:ack.id,
  p_receiver_contract_id:contract.id,p_receiver_drift_id:last.id,
  p_source_sha256:a.content_sha256,p_certified_at:certifiedAt,
  p_payload_sha256:await sha(body),
  p_server_hmac:await sign('YW594_HUMAN_EVIDENCE_HMAC_KEY',body)});
}
async function overview(company,ctx){
 if(!ctx.owner&&!ctx.reviewer)err('YW594_ORIGINAL_OWNER_OR_REVIEWER_ONLY');
 const challenges=await select('ywi_594_attendance_challenges','id,slot_id,attempt_id,issued_at,expires_at',
  {company_id:company});
 const proofs=await select('ywi_594_attendance_proofs',
  'id,slot_id,challenge_id,signed_at,hardware_attested',{company_id:company});
 const obs=await select('ywi_594_owner_observations',
  'id,proof_id,slot_id,observed_at',{company_id:company});
 const certs=await select('ywi_594_field_certificates',
  'id,slot_id,proof_id,certified_at,human_field_attested,hardware_attested',
  {company_id:company});
 const alerts=await select('ywi_594_receiver_drift_alerts',
  'id,baseline_contract_id,finding,observed_at',{company_id:company});
 return {state:'TENANT_ORIGINAL_FIELD_EVIDENCE_READBACK',
  attendance:proofs.map(x=>({proofId:x.id,slotId:x.slot_id,
   signedAt:x.signed_at,ownerObservationId:obs.find(o=>o.proof_id===x.id)?.id||null,
   independentCertificateId:certs.find(c=>c.proof_id===x.id)?.id||null,
   hardwareAttested:false})),
  challenges:challenges.map(x=>({slotId:x.slot_id,expiresAt:x.expires_at,
   challengeId:x.id,expired:Date.parse(x.expires_at)<=Date.now()})),
  receiverDrift:alerts.map(x=>({alertId:x.id,finding:x.finding,observedAt:x.observed_at})),
  humanCertifiedCaseCount:certs.length,independentRealDeviceHardwareAttested:false,
  noOtherTenantDetails:true,notTwoTenantFleetCertified:true};
}
async function perform(data,actor){
 const company=data?.companyId,ctx=await context(company,actor);
 switch(data?.action){
  case 'overview':return overview(company,ctx);
  case 'issue-attendance':return issue(data,actor,company,ctx);
  case 'submit-attendance':return attend(data,actor,company,ctx);
  case 'owner-observe':return observe(data,actor,company,ctx);
  case 'check-contract-drift':return probe(data,actor,company,ctx);
  case 'reviewer-certify':return certify(data,actor,company,ctx);
  default:err('YW594_ACTION_NOT_RECOGNIZED');
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
 if(req.method!=='POST')return send({state:'HOLD',code:'YW594_POST_ONLY'},405);
 try{
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))
   err('YW594_JSON_REQUIRED');
  const raw=await req.text();if(raw.length>4096)err('YW594_REQUEST_TOO_LARGE');
  const actor=await auth(req);
  return send(await perform(JSON.parse(raw),actor));
 }catch(e){return send({state:'HOLD',code:e?.code||'YW594_ORIGINAL_SOURCE_OR_AUTHORITY_HOLD',
  hardwareAttested:false,physicalAttendanceCertified:false,
  noAutomaticDeletion:true,noExternalNotification:true,noFinanceMutation:true},403);}
});
