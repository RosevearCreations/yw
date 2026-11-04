/** QL-335 source-owned shell protocol. No tenant/company credential is implied. */
import {createHash,createPublicKey,verify} from 'node:crypto';

export const SHELL_ID='yw';
export const SOURCE_APP_ID='yard-workers';
export const CONTRACT='rosevear.shell.nonproduction.v1';
export const PATHS=Object.freeze(['/api/integration/v1/shell/health',
  '/api/integration/v1/shell/capabilities']);
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE=/^[A-Za-z0-9_-]{43}$/;
const B64=/^[A-Za-z0-9_-]{86}$/;
const fields=['status','shell_id','source_app_id','contract','environment','method','path',
  'issuer','audience','scope','nonce','issued_at','expires_at','manifest_sha256',
  'owner_receipt_sha256','source_owner_receipt_sha256','workload_id'];
function canonical(v){
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
const sha=v=>createHash('sha256').update(v).digest('hex');
const fail=(code,httpStatus=403)=>Object.freeze({code,httpStatus,status:'HOLD',
  authenticated:false,connected:false,tenantDataIncluded:false,
  commandsEnabled:false,eventsEnabled:false});
const exact=o=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===fields.length&&Object.keys(o).every(k=>fields.includes(k));

/** Inject trusted source-owned DB/KMS context, not a browser-supplied identity.
 * claimNonce must be a durable, atomic, cross-region insert-if-absent.
 * signWithSourceKms must attest a real, authorized source-managed key handle.
 */
export async function verifySourceShellGet({method,path,query,headers={},runtime,nowMs=Date.now(),
  trust,claimNonce,signWithSourceKms}={}){
  if(runtime!=='nonproduction'||method!=='GET'||!PATHS.includes(path)||
    query&&Object.keys(query).length)return fail('SHELL_METHOD_OR_ENVIRONMENT_DENIED',405);
  if(!trust||trust.originalSourceOwnerTest!==true||trust.originalMasterOwnerTest!==true||
    trust.verifiedWorkload!==true||trust.verifiedIssuer!==true||
    trust.manifestVerified!==true||trust.keyHandleActive!==true||trust.pinnedOriginVerified!==true||
    typeof claimNonce!=='function'||typeof signWithSourceKms!=='function')
    return fail('SHELL_TEST_AUTHORITY_UNAVAILABLE',503);
  const encoded=headers['x-rosevear-shell-envelope'];
  if(typeof encoded!=='string'||encoded.length>8192||!/^[A-Za-z0-9_-]+$/.test(encoded))
    return fail('SHELL_CHALLENGE_MISSING');
  let envelope;
  try{envelope=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}
  catch{return fail('SHELL_ENVELOPE_INVALID');}
  const c=envelope?.challenge;
  if(!exact(c)||c.contract!==CONTRACT||c.status!=='SHELL_TEST_CHALLENGE'||
    c.shell_id!==SHELL_ID||c.source_app_id!==SOURCE_APP_ID||c.audience!==SOURCE_APP_ID||
    c.issuer!=='ai-data-platform'||c.scope!==(path.endsWith('/health')?'read_shell_health':'read_shell_capabilities')||c.environment!=='nonproduction'||
    c.method!=='GET'||c.path!==path||!NONCE.test(c.nonce??'')||
    !Number.isSafeInteger(c.issued_at)||!Number.isSafeInteger(c.expires_at)||
    c.expires_at<=nowMs||c.expires_at<=c.issued_at||c.expires_at-c.issued_at>120_000||c.issued_at>nowMs+15_000||
    !SHA.test(c.manifest_sha256??'')||c.manifest_sha256!==trust.manifestSha256||
    c.owner_receipt_sha256!==trust.ownerReceiptSha256||
    c.source_owner_receipt_sha256!==trust.sourceOwnerReceiptSha256||
    !UUID.test(c.workload_id??'')||c.workload_id!==trust.workloadId||
    !B64.test(envelope.signature??'')||envelope.keyId!==trust.brokerKeyId)
    return fail('SHELL_SCOPE_OR_ORIGINAL_APPROVAL_DENIED');
  try{
    const brokerKey=createPublicKey(trust.pinnedBrokerPublicKeyPem);
    if(brokerKey.asymmetricKeyType!=='ed25519'||
      !verify(null,Buffer.from(canonical(c)),brokerKey,Buffer.from(envelope.signature,'base64url')))
      return fail('SHELL_BROKER_SIGNATURE_INVALID');
    const challengeSha256=sha(canonical(c));
    if(await claimNonce({shellId:SHELL_ID,nonceSha256:sha(c.nonce),challengeSha256,
      expiresAt:c.expires_at})!==true)return fail('SHELL_REPLAY_OR_NONCE_STORE_UNAVAILABLE',409);
    const receipt={contract:CONTRACT,shell_id:SHELL_ID,source_app_id:SOURCE_APP_ID,
      environment:'nonproduction',status:'AUTHENTICATED_READONLY_TEST_HELD',
      capabilities_enabled:false,tenant_data_included:false,source_issuer:SOURCE_APP_ID,
      challenge_sha256:challengeSha256,nonce_sha256:sha(c.nonce),
      answered_at:nowMs,expires_at:c.expires_at};
    const result=await signWithSourceKms(Buffer.from(canonical(receipt)));
    if(result?.attested!==true||!B64.test(result.signature??'')||
      !/^[A-Za-z0-9_-]{12,100}$/.test(result.keyId??''))
      return fail('SHELL_SOURCE_KEY_UNATTESTED',503);
    return {code:'SIGNED_TEST_ONLY',httpStatus:200,status:'HOLD',authenticated:true,
      connected:false,tenantDataIncluded:false,commandsEnabled:false,eventsEnabled:false,
      envelope:{receipt,signature:result.signature,keyId:result.keyId}};
  }catch{return fail('SHELL_SOURCE_KMS_OR_NONCE_UNAVAILABLE',503);}
}
