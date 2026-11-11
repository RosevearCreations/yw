// MASTER363-YW -> AI Data Platform Build 364 exact signed receipt contract.
// This module never enrolls a signer, proves custodian identity, or grants owner consent.
import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';

export const BUILD364_SCHEMA='rosevear.ai-data-platform.source-convergence-receipt.v1';
const SHA=/^[a-f0-9]{40}$/;
const HASH=/^[a-f0-9]{64}$/;
const NONCE=/^[a-f0-9]{32,128}$/;
const hold=(condition,code)=>{if(!condition)throw Error('MASTER363_YW_HOLD_'+code);};
const exactIso=(value)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&
  value===new Date(Date.parse(value)).toISOString();

// Property order is deliberate: it must match the controller's canonical payload.
export function canonicalBuild364Payload(receipt){
 return JSON.stringify({
  schema:receipt.schema,receiptVersion:receipt.receiptVersion,
  handoffToken:receipt.handoffToken,sourceId:receipt.sourceId,
  sourceAppId:receipt.sourceAppId,repository:receipt.repository,
  sourceRevision:receipt.sourceRevision,manifestRevision:receipt.manifestRevision,
  keyId:receipt.keyId,issuedAt:receipt.issuedAt,nonce:receipt.nonce,
  health:{state:receipt.health.state,revision:receipt.health.revision,
   observedAt:receipt.health.observedAt,sourceRuntime:receipt.health.sourceRuntime}
 });
}

export function build364Payload({sourceRevision,manifestRevision=sourceRevision,keyId,
 health,nonce,now=Date.now(),tenantBoundary='platform_shell'}={}){
 hold(tenantBoundary==='platform_shell','TENANT_BOUNDARY');
 hold(SHA.test(sourceRevision||'')&&manifestRevision===sourceRevision,'PRODUCTION_REVISION');
 hold(typeof keyId==='string'&&/^[A-Za-z0-9._:-]{4,128}$/.test(keyId),'KEY_ID');
 hold(NONCE.test(nonce||''),'NONCE');
 hold(Number.isSafeInteger(now)&&Number.isFinite(now),'TIME');
 hold(health&&health.state==='HEALTHY'&&health.revision===sourceRevision,
  'REAL_HEALTH_OBSERVATION_REQUIRED');
 hold(typeof health.sourceRuntime==='string'&&health.sourceRuntime.trim().length>=6&&
  health.sourceRuntime.length<=256&&!/^(mock|test|synthetic|unknown|none|placeholder)/i.test(health.sourceRuntime),
  'RUNTIME_IDENTITY_REQUIRED');
 hold(exactIso(health.observedAt)&&Date.parse(health.observedAt)<=now&&
  now-Date.parse(health.observedAt)<=15*60*1000,'FRESH_OBSERVATION');
 return Object.freeze({schema:BUILD364_SCHEMA,receiptVersion:1,
  handoffToken:'MASTER363-YW-SOURCE-CONVERGE',sourceId:'yw',
  sourceAppId:'yard-workers',repository:'RosevearCreations/yw',
  sourceRevision,manifestRevision,keyId,issuedAt:new Date(now).toISOString(),nonce,
  health:{state:'HEALTHY',revision:sourceRevision,
   observedAt:health.observedAt,sourceRuntime:health.sourceRuntime}});
}

export function signBuild364Receipt({payload,encryptedPrivateKeyPem,passphrase,
 expectedPublicPin}={}){
 hold(payload&&payload.schema===BUILD364_SCHEMA&&
  payload.sourceId==='yw'&&payload.handoffToken==='MASTER363-YW-SOURCE-CONVERGE'&&
  payload.sourceRevision===payload.health?.revision&&
  payload.sourceRevision===payload.manifestRevision,'SOURCE_BINDING');
 hold(typeof encryptedPrivateKeyPem==='string'&&
  encryptedPrivateKeyPem.includes('ENCRYPTED PRIVATE KEY'),'ENCRYPTED_SOURCE_KEY_REQUIRED');
 hold(typeof passphrase==='string'&&passphrase.length>=24,'PRIVATE_PASSPHRASE');
 hold(HASH.test(expectedPublicPin||''),'INDEPENDENT_PIN_REQUIRED');
 const privateKey=createPrivateKey({key:encryptedPrivateKeyPem,format:'pem',passphrase});
 hold(privateKey.asymmetricKeyType==='ed25519','ED25519_REQUIRED');
 const publicKey=createPublicKey(privateKey);
 const digest=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
 hold(digest===expectedPublicPin,'INDEPENDENT_PIN_MISMATCH');
 const signatureBase64=sign(null,Buffer.from(canonicalBuild364Payload(payload),'utf8'),privateKey)
  .toString('base64');
 return Object.freeze({...payload,signatureBase64});
}

// Source-side crypto verification is NOT independent signer enrollment or acceptance.
export function verifyBuild364Receipt(receipt,{trustedKeyId,trustedPublicKeyPem,
 sourceRevision,now=Date.now()}={}){
 const payload=build364Payload({sourceRevision,manifestRevision:receipt?.manifestRevision,
  keyId:receipt?.keyId,health:receipt?.health,nonce:receipt?.nonce,
  now:Date.parse(receipt?.issuedAt),tenantBoundary:'platform_shell'});
 hold(exactIso(receipt?.issuedAt)&&Date.parse(receipt.issuedAt)<=now&&
  now-Date.parse(receipt.issuedAt)<=15*60*1000,'RECEIPT_FRESHNESS');
 hold(receipt.keyId===trustedKeyId&&typeof trustedPublicKeyPem==='string',
  'INDEPENDENT_SIGNER_ENROLLMENT');
 hold(receipt.schema===payload.schema&&receipt.receiptVersion===1&&
  receipt.handoffToken===payload.handoffToken&&receipt.sourceId===payload.sourceId&&
  receipt.sourceAppId===payload.sourceAppId&&receipt.repository===payload.repository&&
  receipt.sourceRevision===payload.sourceRevision&&receipt.manifestRevision===payload.manifestRevision,
  'IDENTITY_BINDING');
 const key=createPublicKey(trustedPublicKeyPem);
 hold(key.asymmetricKeyType==='ed25519'&&
  typeof receipt.signatureBase64==='string'&&
  /^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64)&&
  verify(null,Buffer.from(canonicalBuild364Payload(payload),'utf8'),key,
   Buffer.from(receipt.signatureBase64,'base64')),'SIGNATURE');
 return Object.freeze({signature:'VALID_FOR_INDEPENDENTLY_SUPPLIED_KEY',
  sourceRevision,tenantBoundary:'platform_shell',
  independentSignerEnrollment:'MUST_BE_CHECKED_BY_CONTROLLER',
  ownerAccepted:false,connection:'HOLD'});
}
