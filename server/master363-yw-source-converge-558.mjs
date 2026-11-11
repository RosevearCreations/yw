// MASTER363-YW: canonical, no-PII source health receipt for independent intake.
// Signing proves key possession, not original custodian identity or owner consent.
import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';

const SHA=/^[a-f0-9]{40}$/;
const HASH=/^[a-f0-9]{64}$/;
const SIG=/^[A-Za-z0-9_-]{86}$/;
const keys=['schema','sourceId','repository','tenantBoundary','sourceRevision',
 'manifestSha256','health','connection','ownerAccepted','issuedAt','expiresAt','nonce'];
const fail=(ok,code)=>{if(!ok)throw Error('MASTER363_YW_HOLD_'+code);};
export const SOURCE_SCHEMA='rosevear.master363.yw.source-health.v1';
export function canonicalSource(value){
 if(Array.isArray(value))return '['+value.map(canonicalSource).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>
  JSON.stringify(k)+':'+canonicalSource(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function sourcePayload({sourceRevision,manifestSha256,nonce,now=Date.now()}={}){
 fail(SHA.test(sourceRevision||''),'REVISION');
 fail(HASH.test(manifestSha256||''),'MANIFEST_DIGEST');
 fail(HASH.test(nonce||''),'NONCE');
 fail(Number.isSafeInteger(now),'TIME');
 return Object.freeze({schema:SOURCE_SCHEMA,sourceId:'yw',repository:'RosevearCreations/yw',
  tenantBoundary:'platform_shell',sourceRevision,manifestSha256,
  health:'source_code_published_runtime_unverified',connection:'HOLD',ownerAccepted:false,
  issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+90000).toISOString(),nonce});
}
export function signSourcePayload({payload,encryptedPrivateKeyPem,passphrase,expectedPublicPin}={}){
 fail(typeof encryptedPrivateKeyPem==='string'&&encryptedPrivateKeyPem.includes('ENCRYPTED PRIVATE KEY'),
  'ENCRYPTED_SOURCE_KEY_REQUIRED');
 fail(typeof passphrase==='string'&&passphrase.length>=24,'PRIVATE_PASSPHRASE');
 fail(HASH.test(expectedPublicPin||''),'TRUSTED_OUT_OF_BAND_PIN_REQUIRED');
 const key=createPrivateKey({key:encryptedPrivateKeyPem,format:'pem',passphrase});
 fail(key.asymmetricKeyType==='ed25519','ED25519_REQUIRED');
 const publicKey=createPublicKey(key);
 const pin=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
 fail(pin===expectedPublicPin,'SOURCE_PIN_MISMATCH');
 const signature=sign(null,Buffer.from(canonicalSource(payload)),key).toString('base64url');
 return Object.freeze({payload,signature,sourcePublicKeyPem:publicKey.export({type:'spki',format:'pem'}),
  sourcePublicSpkiSha256:pin,independentEnrollment:'REQUIRES_CONTROLLER_VERIFICATION',
  ownerAcceptance:'NOT_GIVEN',connection:'HOLD'});
}
export function verifySourcePacket(packet,{trustedPublicPin,sourceRevision,manifestSha256,
 now=Date.now()}={}){
 const p=packet?.payload;
 fail(p&&Object.keys(p).length===keys.length&&Object.keys(p).every(k=>keys.includes(k)),
  'EXACT_FIELDS');
 fail(p.schema===SOURCE_SCHEMA&&p.sourceId==='yw'&&p.repository==='RosevearCreations/yw'&&
  p.tenantBoundary==='platform_shell'&&p.sourceRevision===sourceRevision&&SHA.test(sourceRevision||'')&&
  p.manifestSha256===manifestSha256&&HASH.test(manifestSha256||''),'SOURCE_OR_REVISION');
 fail(p.health==='source_code_published_runtime_unverified'&&p.connection==='HOLD'&&
  p.ownerAccepted===false&&HASH.test(p.nonce||''),'NO_FAKE_ACCEPTANCE');
 const start=Date.parse(p.issuedAt),end=Date.parse(p.expiresAt);
 fail(Number.isSafeInteger(now)&&Number.isFinite(start)&&Number.isFinite(end)&&
  p.issuedAt===new Date(start).toISOString()&&p.expiresAt===new Date(end).toISOString()&&
  start<=now+5000&&end>now&&end-start<=90000,'RECEIPT_FRESHNESS');
 fail(HASH.test(trustedPublicPin||'')&&packet.sourcePublicSpkiSha256===trustedPublicPin,
  'INDEPENDENT_SOURCE_PIN');
 const key=createPublicKey(packet.sourcePublicKeyPem);
 fail(key.asymmetricKeyType==='ed25519','SOURCE_ALGORITHM');
 const digest=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
 fail(digest===trustedPublicPin&&SIG.test(packet.signature||'')&&
  verify(null,Buffer.from(canonicalSource(p)),key,Buffer.from(packet.signature,'base64url')),
  'SIGNATURE');
 return Object.freeze({signature:'VALID_FOR_TRUSTED_PIN',sourceRevision,
  manifestSha256,tenantBoundary:'platform_shell',
  independentSignerEnrollment:'MUST_BE_AUTHENTICATED_OUT_OF_BAND',
  ownerAccepted:false,connection:'HOLD'});
}
