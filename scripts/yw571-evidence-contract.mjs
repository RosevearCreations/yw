// YW571 independent signed disposition receipt gate and seven-app handoff verifier.
// This module handles untrusted bytes. Only a separately entrusted issuer SPKI fingerprint
// can authorize a signature; an unsigned browser/client verdict is NEVER sufficient.
import {createHash,createPublicKey,verify as cryptoVerify,timingSafeEqual} from 'node:crypto';

export const APPS_571=Object.freeze([
 ['ai-data-platform','master'],['rosevear-ai-hub','master'],
 ['rosevear-comms-hub','master'],['iCamp','platform_shell'],
 ['YW','platform_shell'],['devilndove','internal_company'],
 ['rosiedazzlers','internal_company']
]);
const reUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reSHA=/^[a-f0-9]{64}$/;
const hex=s=>typeof s==='string'&&reSHA.test(s);
const uuid=s=>typeof s==='string'&&reUUID.test(s);
const ms=s=>typeof s==='string'&&s.length<64&&Number.isFinite(Date.parse(s))?Date.parse(s):NaN;
const fail=(code,message)=>({ok:false,code,message,connected:false,closure_authorized:false,customer_delivery_verified:false});
const protect=key=>key==='__proto__'||key==='constructor'||key==='prototype';
export function canonical571(value,depth=0){
 if(depth>24)throw Error('Canonical evidence nesting too deep');
 if(value===null)return 'null';
 if(typeof value==='string')return JSON.stringify(value);
 if(typeof value==='boolean')return String(value);
 if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
 if(Array.isArray(value)){
  if(value.length>512)throw Error('Canonical evidence array too long');
  return '['+value.map(v=>canonical571(v,depth+1)).join(',')+']';
 }
 if(typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
  const keys=Object.keys(value).sort();
  if(keys.length>80||keys.some(protect))throw Error('Canonical evidence has forbidden keys');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical571(value[k],depth+1)).join(',')+'}';
 }
 throw Error('Unsupported canonical evidence value');
}
export function sha256Text(text){return createHash('sha256').update(text,'utf8').digest('hex');}
export function fingerprint571(pem){
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')
  throw Error('Only independently pinned ECDSA P-256 issuer keys are supported');
 return createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
}
export function verifyDisposition571(envelope,trust,now=Date.now()){
 if(!envelope||typeof envelope!=='object'||!trust||!Number.isFinite(now))
  return fail('HOLD_MISSING_AUTHORITY','Independent receipt/trust context missing.');
 const {payload,signature_base64,public_key_pem}=envelope;
 if(!payload||typeof payload!=='object'||typeof signature_base64!=='string'||typeof public_key_pem!=='string')
  return fail('HOLD_MISSING_SIGNED_RECEIPT','Original signed payload and independent public key required.');
 if(!hex(trust.trusted_spki_sha256)||!hex(trust.source_sha256)||!hex(trust.main_sha256)||!uuid(trust.company_id)||
    !uuid(trust.request_id)||!uuid(trust.provider_receipt_id)||!uuid(trust.owner_audit_id)||
    !uuid(trust.master_observation_id)||typeof trust.issuer!=='string'||!trust.issuer)
  return fail('HOLD_UNTRUSTED_SIGNER','An externally enrolled issuer key pin and original source scope are required.');
 const version='yw571.disposition.v1',allowed=['RETAIN_HOLD','REOPEN_REQUIRED','SOURCE_ONLY_REVIEWED'];
 if(payload.contract_version!==version||payload.source_app!=='YW'||payload.issuer!==trust.issuer||
   !allowed.includes(payload.disposition)||!uuid(payload.disposition_id)||!uuid(payload.nonce)||
   !uuid(payload.company_id)||payload.company_id!==trust.company_id||
   payload.request_id!==trust.request_id||payload.provider_verified_receipt_id!==trust.provider_receipt_id||
   !Number.isSafeInteger(payload.case_version)||payload.case_version<1||
   payload.owner_audit_id!==trust.owner_audit_id||
   payload.master_observation_id!==trust.master_observation_id||
   payload.canonical_sha256!==trust.source_sha256||
   payload.source_revision!==trust.main_sha256||
   payload.tenant_boundary!=='company'||payload.master_connected!==false||
   payload.master_owner_acceptance!==false||payload.customer_message_sent!==false||
   payload.closure_authorized!==false)
  return fail('HOLD_DISPOSITION_SCOPE','Original source, tenant, signer, source revision, or authority boundary mismatch.');
 const observed=ms(payload.source_observed_at),issued=ms(payload.issued_at),expires=ms(payload.expires_at);
 if(!Number.isFinite(observed)||!Number.isFinite(issued)||!Number.isFinite(expires)||
    issued>now+120000||observed>issued||observed>now+120000||
    now-observed>24*3600000||issued-observed>24*3600000||
    now-issued>24*3600000||expires<=now||expires-issued>24*3600000||
    issued<now-24*3600000)
  return fail('HOLD_EXPIRED_DISPOSITION','Signer, original-source observation, or bounded expiry is stale.');
 let serialized,signature,actual;
 try{
  serialized=canonical571(payload);
  if(Buffer.byteLength(serialized,'utf8')>16384)throw Error('Receipt too large');
  signature=Buffer.from(signature_base64,'base64');
  if(!signature.length||signature.toString('base64')!==signature_base64)throw Error('Invalid signature encoding');
  actual=fingerprint571(public_key_pem);
 }catch{return fail('HOLD_MALFORMED_SIGNATURE','Canonical payload, signature or public key invalid.');}
 if(actual!==trust.trusted_spki_sha256||!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(trust.trusted_spki_sha256,'hex')))
  return fail('HOLD_UNTRUSTED_SIGNER','Issuer public-key fingerprint is not the independently enrolled value.');
 let verified=false;
 try{verified=cryptoVerify('sha256',Buffer.from(serialized,'utf8'),
  createPublicKey(public_key_pem),signature);}catch{return fail('HOLD_INVALID_SIGNATURE','Cryptographic verification failed.');}
 if(!verified)return fail('HOLD_INVALID_SIGNATURE','Signed disposition does not bind the current canonical source.');
 return {ok:true,code:'SIGNATURE_VERIFIED_SOURCE_ONLY_MASTER_HOLD',
  message:'Exact source-only reviewer disposition signature verifies against independently pinned issuer. No closure, Master CONNECTED or delivery acceptance.',
  disposition:payload.disposition,issuer_fingerprint:actual,source_revision:payload.source_revision,
  signed_payload_sha256:sha256Text(serialized),
  connected:false,closure_authorized:false,customer_delivery_verified:false};
}
export function verifyHandoffShape571(packet){
 if(!packet||packet.contract_version!=='rosevear.handoff.v1'||!Array.isArray(packet.apps)||
  packet.apps.length!==APPS_571.length||
  packet.transport_state!=='NOT_CONNECTED_BY_THIS_PACKET'||packet.master_connected!==false||
  packet.customer_delivery_verified!==false)
  return fail('HOLD_HANDOFF_SHAPE','Seven-app handoff must remain explicitly non-authoritative.');
 for(let i=0;i<APPS_571.length;i++){
  const [id,role]=APPS_571[i],a=packet.apps[i];
  if(!a||a.id!==id||a.role!==role||a.receipt_state!=='NOT_ATTESTED'||
   a.master_ack_state!=='HOLD'||a.customer_delivery_verified!==false||
   a.shared_secret_embedded!==false)
   return fail('HOLD_HANDOFF_ORDER','An app role, attestation or expected processing order was altered.');
 }
 const shell=packet.apps[4];
 if(shell.source_role!=='platform_shell'||shell.tenant_boundary!=='platform_shell'||
  shell.master_connected!==false||!/^([a-f0-9]{40}|UNSET_AFTER_RELEASE)$/.test(shell.production_sha))
  return fail('HOLD_YW_PRODUCT_BOUNDARY','YW PRODUCT shell revision and tenant boundary required.');
 return {ok:true,code:'SOURCE_HANDOFF_SHAPE_VALID_NOT_CONNECTED',
  message:'Order and security/tenant boundaries match. This packet is NOT an independently signed seven-app ACK.',
  connected:false,closure_authorized:false,customer_delivery_verified:false};
}

export function verifyRenewalPair571(previous,current,priorTrust,currentTrust,now=Date.now()){
 const before=verifyDisposition571(previous,priorTrust,now);
 const after=verifyDisposition571(current,currentTrust,now);
 if(!before.ok||!after.ok)
  return fail('HOLD_RENEWAL_SOURCE_NOT_SIGNED','Both independent source observations require verified P-256 signatures and registered issuer pins.');
 const a=previous.payload,b=current.payload;
 const prev=ms(a.source_observed_at),next=ms(b.source_observed_at);
 if(a.disposition_id===b.disposition_id||a.nonce===b.nonce||
  !Number.isFinite(prev)||!Number.isFinite(next)||next-prev<60000||
  a.master_observation_id===b.master_observation_id||
  a.company_id!==b.company_id||a.request_id!==b.request_id||
  a.provider_verified_receipt_id!==b.provider_verified_receipt_id||
  a.source_revision!==b.source_revision||a.canonical_sha256!==b.canonical_sha256||
  b.disposition!=='SOURCE_ONLY_REVIEWED')
  return fail('HOLD_RENEWAL_CHAIN','Two distinct ordered original signed observations, receipt nonces and identical source scope are mandatory.');
 return {ok:true,code:'TWO_SIGNED_SOURCE_OBSERVATIONS_VERIFIED_MASTER_HOLD',
  message:'Two ordered signed source observations verified against separately enrolled trust pins. This does not prove historical SLA recovery effectiveness, customer delivery, durable replay admission or Master CONNECTED.',
  delta_minutes:Math.floor((next-prev)/60000),historical_recovery_rate:null,
  connected:false,closure_authorized:false,customer_delivery_verified:false};
}
