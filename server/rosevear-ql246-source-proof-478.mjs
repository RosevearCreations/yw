// YW Build 478: offline QL-246 signed-source metadata validation; not a connection.
import {createHash,createPublicKey,verify,timingSafeEqual} from 'node:crypto';
export const keys=['schema_version','source_system','repository','source_revision','challenge_id','challenge_sha256','business_id','tenant_id','environment','ci_run_url','allowed_methods','allowed_paths','negative_tests','gateway_audit_receipt_id','health_receipt_id','capabilities_receipt_id','registered_key_id','owner_authorization','connection_state','external_gateway_get_verified','durable_audit_verified','owner_identity_verified','issued_at','expires_at'];
export const denials=['nonce_replay_denied','stale_request_denied','cross_business_denied','cross_tenant_denied','revoked_key_denied','write_denied','dispatch_denied'];
export const paths=['/api/integration/v1/health','/api/integration/v1/capabilities'];
const matches=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
const required=(ok,code)=>{if(!ok)throw new Error('QL246_HOLD_'+code);};
const issued=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const pin=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function canonical(payload){
 required(payload&&typeof payload==='object'&&!Array.isArray(payload),'PAYLOAD');
 required(matches(Object.keys(payload),keys),'FIELD_ORDER');
 return keys.map(k=>JSON.stringify([k,payload[k]])).join('\n');
}
export function pending(){
 return {source_system:'yw',connection_state:'DISCONNECTED',owner_authorization:'NOT_GIVEN',
  signed_proof:'NOT_PROVISIONED',issued_tenant:'UNVERIFIED',independent_pin:'UNVERIFIED',
  seven_real_denials:'UNVERIFIED',external_gateway_get_verified:false,
  durable_audit_verified:false,owner_identity_verified:false,
  dispatch_enabled:false,field_release_enabled:false,approval:'HOLD'};
}
export function verifyPublic(packet,trust={}){
 required(packet&&typeof packet==='object'&&!Array.isArray(packet)
  &&matches(Object.keys(packet),['publicKeyPem','payload','signature']),'PACKET');
 const p=packet.payload,bytes=Buffer.from(canonical(p),'utf8');
 required(p.schema_version==='rosevear.integration.v1'&&p.source_system==='yw'
  &&p.repository==='RosevearCreations/yw'&&p.business_id==='yw'
  &&p.environment==='nonproduction','SOURCE');
 required(sha(p.source_revision)&&p.source_revision===trust.sourceRevision,'REVISION');
 required(/^https:\/\/github\.com\/RosevearCreations\/yw\/actions\/runs\/[1-9]\d*$/.test(p.ci_run_url)
  &&p.ci_run_url===trust.ciRunUrl,'CI');
 required(issued(p.challenge_id)&&p.challenge_id===trust.challengeId
  &&pin(p.challenge_sha256)&&p.challenge_sha256===trust.challengeSha256,'CHALLENGE');
 required(issued(p.tenant_id)&&p.tenant_id===trust.tenantId,'TENANT');
 required(JSON.stringify(p.allowed_methods)==='["GET"]'
  &&JSON.stringify(p.allowed_paths)===JSON.stringify(paths),'READ_ONLY');
 required(p.negative_tests&&matches(Object.keys(p.negative_tests),denials)
  &&denials.every(k=>p.negative_tests[k]===true),'SEVEN_DENIAL_CLAIMS');
 for(const k of ['gateway_audit_receipt_id','health_receipt_id','capabilities_receipt_id','registered_key_id'])
  required(p[k]===null||issued(p[k]),'RECEIPT_ID');
 required(p.owner_authorization==='NOT_GIVEN'&&p.connection_state==='DISCONNECTED'
  &&p.external_gateway_get_verified===false&&p.durable_audit_verified===false
  &&p.owner_identity_verified===false,'INTEGRATION_HOLD');
 required(Number.isSafeInteger(trust.now)&&Number.isSafeInteger(p.issued_at)
  &&Number.isSafeInteger(p.expires_at)&&p.issued_at<=trust.now
  &&p.expires_at>trust.now&&p.expires_at-p.issued_at<=3600000
  &&p.expires_at>p.issued_at&&trust.now-p.issued_at<=300000,'CLOCK');
 required(pin(trust.pinSha256),'INDEPENDENT_PIN');
 let pub;
 try{pub=createPublicKey(packet.publicKeyPem)}catch{throw new Error('QL246_HOLD_KEY_PARSE')}
 required(pub.asymmetricKeyType==='ed25519','ED25519');
 const actual=createHash('sha256').update(pub.export({format:'der',type:'spki'})).digest();
 required(timingSafeEqual(actual,Buffer.from(trust.pinSha256,'hex')),'PIN_MISMATCH');
 required(typeof packet.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(packet.signature),'SIG_ENCODING');
 const sig=Buffer.from(packet.signature,'base64url');
 required(sig.length===64&&verify(null,bytes,pub,sig),'SIGNATURE');
 // Even a cryptographically valid applicant packet is NOT independently witnessed source evidence.
 return {signature_matched:true,independent_real_world_proof:false,
  seven_denials_independently_observed:false,owner_pilot_authorized:false,
  connection_state:'DISCONNECTED',result:'SIGNATURE_MATCHED_REAL_PROOF_PENDING_HELD'};
}
