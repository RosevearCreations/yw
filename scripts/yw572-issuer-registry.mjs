/* YW572 — independently attested seven-app issuer registry and key rotation.
 * Server-side only. Trust roots arrive separately from the manifest and remain
 * unauthenticated until owner/custodian enrollment outside this repository.
 * All successful results remain SOURCE_ONLY_MASTER_HOLD. */
import {createHash,createPublicKey,verify as verifySignature,timingSafeEqual} from 'node:crypto';
import {APPS_571,canonical571,fingerprint571,verifyDisposition571} from './yw571-evidence-contract.mjs';

const sha=/^[a-f0-9]{64}$/,git=/^[a-f0-9]{40}$/,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=/^[a-z0-9][a-z0-9._:-]{2,119}$/;
const roles=['owner','independent_custodian'];
const appRole=new Map(APPS_571);
const failure=(code,reason)=>({ok:false,code,reason,master_connected:false,closure_authorized:false,customer_delivery_verified:false});
const date=s=>typeof s==='string'&&s.length<64&&Number.isFinite(Date.parse(s))?Date.parse(s):NaN;
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&sha.test(a)&&sha.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const decode=s=>{
 if(typeof s!=='string'||s.length>1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return null;
 const b=Buffer.from(s,'base64');
 return b.length>0&&b.toString('base64')===s?b:null;
};
function verifies(payload,approval,root){
 if(!root||typeof root.public_key_pem!=='string'||!sha.test(root.trusted_spki_sha256))return false;
 try{
  const fingerprint=fingerprint571(root.public_key_pem);
  return eq(fingerprint,root.trusted_spki_sha256)&&
   Boolean(verifySignature('sha256',Buffer.from(canonical571(payload)),createPublicKey(root.public_key_pem),decode(approval.signature_base64)));
 }catch{return false;}
}
export function verifyRegistry572(manifest,independentRoots,now=Date.now()){
 if(!Number.isFinite(now)||!manifest||!independentRoots)
  return failure('HOLD_NO_INDEPENDENT_REGISTRY','Independent root enrollment and signed registry required.');
 const payload=manifest.payload,approvals=manifest.approvals;
 if(!payload||!Array.isArray(approvals)||approvals.length!==2||
    payload.contract_version!=='rosevear.issuer-registry.v1'||!uuid.test(payload.registry_id)||
    !Number.isSafeInteger(payload.version)||payload.version<1||!Array.isArray(payload.issuers)||
    payload.issuers.length<7||payload.issuers.length>40)
  return failure('HOLD_REGISTRY_SHAPE','Signed registry header, version, apps or approvals invalid.');
 const issued=date(payload.issued_at),expires=date(payload.expires_at);
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now+120000||
  expires<=now||expires-issued>30*86400000||expires<=issued)
  return failure('HOLD_REGISTRY_EXPIRED','Issuer registry is stale or has invalid bounded validity.');
 let length;
 try{length=Buffer.byteLength(canonical571(payload),'utf8');}catch{return failure('HOLD_REGISTRY_CANONICAL','Invalid registry canonical representation.');}
 if(length>75000)return failure('HOLD_REGISTRY_SIZE','Issuer registry exceeds allowed signature envelope.');
 const roots=new Set();
 for(const role of roles){
  const root=independentRoots[role];
  const approval=approvals.find(a=>a?.role===role);
  if(!approval||!root||!id.test(approval.witness_id||'')||
     !id.test(root.witness_id||'')||approval.witness_id!==root.witness_id||
     !verifies(payload,approval,root))
   return failure('HOLD_GOVERNANCE_QUORUM','Two separate original owner and custodian signing approvals are required.');
  if(roots.has(root.trusted_spki_sha256))return failure('HOLD_SHARED_GOVERNANCE_KEY','Governance witnesses cannot share signing keys.');
  roots.add(root.trusted_spki_sha256);
 }
 if(approvals.some(a=>!roles.includes(a.role)))return failure('HOLD_GOVERNANCE_ROLE','Unexpected governance approval role.');
 const keyIds=new Set(),pins=new Set(),seenApps=new Set();
 for(const issuer of payload.issuers){
  const role=appRole.get(issuer.app_id);
  if(!role||issuer.app_role!==role||!id.test(issuer.issuer_id||'')||
    !id.test(issuer.key_id||'')||!id.test(issuer.audience||'')||
    !['active','grace','revoked'].includes(issuer.status)||!sha.test(issuer.spki_sha256)||
    typeof issuer.public_key_pem!=='string'||issuer.public_key_pem.length>1500||
    issuer.tenant_boundary!==(role==='master'?'master':role==='platform_shell'?'platform_shell':'internal_company'))
    return failure('HOLD_ISSUER_SCOPE','Issuer app role, tenant security boundary, audience or key shape invalid.');
  const scoped=issuer.app_id+'|'+issuer.issuer_id+'|'+issuer.key_id;
  if(keyIds.has(scoped)||pins.has(issuer.spki_sha256))
   return failure('HOLD_DUPLICATE_ISSUER','Registry repeats issuer key or shares a public key across applications.');
  keyIds.add(scoped);pins.add(issuer.spki_sha256);seenApps.add(issuer.app_id);
  const validFrom=date(issuer.valid_from),validUntil=date(issuer.valid_until);
  const rotated=issuer.rotated_at==null?NaN:date(issuer.rotated_at);
  const grace=issuer.grace_until==null?NaN:date(issuer.grace_until);
  if(!Number.isFinite(validFrom)||!Number.isFinite(validUntil)||validUntil<=validFrom||
    (issuer.status==='grace'&&(!Number.isFinite(rotated)||!Number.isFinite(grace)||
    grace<rotated||grace-rotated>48*3600000))||
    (issuer.status==='active'&&(issuer.rotated_at!=null||issuer.grace_until!=null)))
   return failure('HOLD_ISSUER_WINDOW','Issuer not-before, expiry or max-48h grace window invalid.');
  try{if(!eq(fingerprint571(issuer.public_key_pem),issuer.spki_sha256))
   return failure('HOLD_ISSUER_PIN','Issuer public key is not the independently governed SPKI pin.');}
  catch{return failure('HOLD_ISSUER_PIN','Issuer key is not a valid supported P-256 public key.');}
 }
 if(seenApps.size!==APPS_571.length||APPS_571.some(([name])=>!seenApps.has(name)))
  return failure('HOLD_MISSING_APP','All seven application identities must be represented.');
 return {ok:true,code:'TWO_WITNESS_REGISTRY_VERIFIED_MASTER_HOLD',version:payload.version,
  registry_id:payload.registry_id,registry_sha256:createHash('sha256').update(canonical571(payload)).digest('hex'),
  master_connected:false,closure_authorized:false,customer_delivery_verified:false};
}
export function verifyRotation572(previous,next,roots,now=Date.now()){
 const a=verifyRegistry572(previous,roots,now),b=verifyRegistry572(next,roots,now);
 if(!a.ok||!b.ok)return failure('HOLD_ROTATION_AUTHORITY','Both registry generations require independent governance quorum.');
 if(previous.payload.registry_id!==next.payload.registry_id||
  next.payload.version!==previous.payload.version+1||
  date(next.payload.issued_at)<=date(previous.payload.issued_at))
  return failure('HOLD_ROTATION_VERSION','Rotation is not a monotonic registry generation.');
 const before=new Map(previous.payload.issuers.map(x=>[x.app_id+'|'+x.issuer_id+'|'+x.key_id,x]));
 const after=new Map(next.payload.issuers.map(x=>[x.app_id+'|'+x.issuer_id+'|'+x.key_id,x]));
 for(const [identity,old] of before){
  const current=after.get(identity);
  if(!current)return failure('HOLD_KEY_HISTORY','Key history may not disappear without a revoked record.');
  if(old.status==='revoked'&&current.status!=='revoked')
   return failure('HOLD_KEY_RESURRECTION','Revoked key cannot return.');
  if(old.status==='grace'&&current.status==='active')
   return failure('HOLD_GRACE_RESURRECTION','Rotated key cannot become active.');
  if(old.status==='active'&&current.status==='grace'&&
     date(current.rotated_at)<date(next.payload.issued_at)-120000)
   return failure('HOLD_ROTATION_BACKDATED','Grace admission cannot predate independently approved rotation.');
 }
 return {ok:true,code:'ROTATION_GOVERNANCE_VERIFIED_NO_KEY_ENROLLMENT',
  registry_sha256:b.registry_sha256,master_connected:false,closure_authorized:false,customer_delivery_verified:false};
}
export function verifyEnvelope572(envelope,registry,roots,trust,now=Date.now()){
 const checked=verifyRegistry572(registry,roots,now);
 if(!checked.ok)return checked;
 const p=envelope?.payload;
 if(!p||p.source_app!=='YW'||!id.test(p.signer_key_id||'')||!id.test(p.audience||'')||
  p.registry_version!==registry.payload.version||p.tenant_boundary!=='company')
  return failure('HOLD_ENVELOPE_AUDIENCE','Envelope audience, signed key ID and registry generation are not verified.');
 const matching=registry.payload.issuers.filter(x=>x.app_id==='YW'&&x.issuer_id===p.issuer&&x.key_id===p.signer_key_id&&x.audience===p.audience);
 if(matching.length!==1)return failure('HOLD_NO_ENROLLED_ISSUER','No independently enrolled signer matches original app, key and audience.');
 const issuer=matching[0],issued=date(p.issued_at);
 if(issuer.status==='revoked'||!Number.isFinite(issued)||issued<date(issuer.valid_from)||
  issued>date(issuer.valid_until)||now>date(issuer.valid_until)||
  (issuer.status==='grace'&&(now>date(issuer.grace_until)||issued>date(issuer.rotated_at))))
  return failure('HOLD_REVOKED_OR_EXPIRED_ISSUER','Revoked, expired or post-rotation key cannot be admitted.');
 if(!trust||trust.issuer!==issuer.issuer_id||trust.main_sha256!==p.source_revision||
    trust.company_id!==p.company_id)
  return failure('HOLD_ORIGINAL_SOURCE_SCOPE','Independent original owner/source trust does not match issuer and tenant.');
 const result=verifyDisposition571(envelope,{...trust,trusted_spki_sha256:issuer.spki_sha256},now);
 if(!result.ok)return failure(result.code,result.message);
 return {ok:true,code:'PINNED_ENVELOPE_VERIFIED_CUSTODY_NOT_ADMITTED',
  app_id:issuer.app_id,issuer_id:issuer.issuer_id,key_id:issuer.key_id,
  registry_sha256:checked.registry_sha256,payload_sha256:result.signed_payload_sha256,
  original_tenant_id:p.company_id,nonce:p.nonce,disposition_id:p.disposition_id,
  source_revision:p.source_revision,issued_at:p.issued_at,
  master_connected:false,closure_authorized:false,customer_delivery_verified:false};
}
export async function admitEnvelope572(envelope,registry,roots,trust,store,now=Date.now()){
 const validated=verifyEnvelope572(envelope,registry,roots,trust,now);
 if(!validated.ok)return validated;
 if(!store||store.kind!=='postgres-unique-constraint-custody-v1'||typeof store.claimIfAbsent!=='function')
  return failure('HOLD_NO_DURABLE_CUSTODY','A database-enforced atomic unique ledger is required; memory and browser storage cannot admit receipts.');
 try{
  const decision=await store.claimIfAbsent(validated);
  if(decision?.status==='INSERTED'&&decision?.receipt_sha256===validated.payload_sha256)
   return {ok:true,code:'SOURCE_RECEIPT_DURABLY_CUSTODIED_MASTER_HOLD',
    registry_sha256:validated.registry_sha256,payload_sha256:validated.payload_sha256,
    master_connected:false,closure_authorized:false,customer_delivery_verified:false};
  if(decision?.status==='REPLAY')
   return failure('HOLD_REPLAY','Duplicate nonce/disposition was already admitted.');
  return failure('HOLD_CUSTODY_UNVERIFIED','No verifiable atomic custody insertion was returned.');
 }catch{return failure('HOLD_CUSTODY_UNAVAILABLE','Independent durable custody is unavailable; no admission occurred.');}
}
export class PostgresCustody572 {
 kind='postgres-unique-constraint-custody-v1';
 constructor(db){if(!db||typeof db.query!=='function')throw Error('Server-only authenticated PostgreSQL query interface required');this.db=db;}
 async claimIfAbsent(receipt){
  const sql="insert into ywi_security_572.replay_custody (app_id,tenant_id,issuer_id,key_id,nonce,disposition_id,payload_sha256,registry_sha256,source_revision) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning payload_sha256";
  const args=[receipt.app_id,receipt.original_tenant_id,receipt.issuer_id,receipt.key_id,
   receipt.nonce,receipt.disposition_id,receipt.payload_sha256,receipt.registry_sha256,receipt.source_revision];
  const response=await this.db.query(sql,args);
  if(response?.rowCount===1&&response.rows?.length===1&&
     response.rows[0]?.payload_sha256===receipt.payload_sha256)
   return {status:'INSERTED',receipt_sha256:receipt.payload_sha256};
  if(response?.rowCount===0)return {status:'REPLAY'};
  return {status:'UNAVAILABLE'};
 }
}
