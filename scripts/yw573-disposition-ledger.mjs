/* YW573 — server-only independent two-witness source disposition and SLA renewal receipts.
 * NO built-in trust roots, private keys, production migration or Master acceptance.
 * Independent PostgreSQL source custody and disposition ledger must exist for admission. */
import {createHash,createPublicKey,verify as verifySignature,timingSafeEqual} from 'node:crypto';
import {canonical571,fingerprint571,verifyRenewalPair571} from './yw571-evidence-contract.mjs';
import {verifyRegistry572,verifyEnvelope572} from './yw572-issuer-registry.mjs';

const sha=/^[a-f0-9]{64}$/,git=/^[a-f0-9]{40}$/,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bounded=s=>typeof s==='string'&&s.length<64&&Number.isFinite(Date.parse(s))?Date.parse(s):NaN;
const fail=(code,reason)=>({ok:false,code,reason,master_connected:false,closure_authorized:false,customer_delivery_verified:false});
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&sha.test(a)&&sha.test(b)&&
 timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const hash=obj=>createHash('sha256').update(canonical571(obj),'utf8').digest('hex');
const decode=s=>{if(typeof s!=='string'||s.length>1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return null;
 const b=Buffer.from(s,'base64');return b.length&&b.toString('base64')===s?b:null;};
function independentlyPinned(approval,root,payload) {
 try{
  if(!approval||!root||typeof root.public_key_pem!=='string'||!sha.test(root.trusted_spki_sha256)||
    approval.witness_id!==root.witness_id||!root.witness_id)return false;
  if(!eq(fingerprint571(root.public_key_pem),root.trusted_spki_sha256))return false;
  const sig=decode(approval.signature_base64);
  return sig!==null&&Boolean(verifySignature('sha256',
    Buffer.from(canonical571(payload),'utf8'),createPublicKey(root.public_key_pem),sig));
 }catch{return false;}
}
/** Verify dual independently pinned source-only witness dispositions, not authorizing a closure. */
export function verifyClosureWitness573(witness,sourceEnvelope,registry,roots,trust,now=Date.now()){
 if(!witness||!sourceEnvelope||!registry||!roots||!trust||!Number.isFinite(now))
  return fail('HOLD_NO_WITNESS_EVIDENCE','Original reviewer evidence and two independent custody roots required.');
 const source=verifyEnvelope572(sourceEnvelope,registry,roots,trust,now);
 if(!source.ok)return fail('HOLD_ORIGINAL_SOURCE_NOT_SIGNED',source.reason||source.code);
 const reg=verifyRegistry572(registry,roots,now);
 if(!reg.ok)return fail('HOLD_UNENROLLED_REGISTRY','Original seven-app governed registry is not independently verified.');
 const p=witness.payload,a=witness.approvals,original=sourceEnvelope.payload;
 if(!p||!Array.isArray(a)||a.length!==2||!uuid.test(p.witness_receipt_id||'')||
    p.contract_version!=='yw573.original-disposition-witness.v1'||
    p.app_id!=='YW'||p.tenant_boundary!=='company'||p.source_role!=='platform_shell'||
    p.company_id!==original.company_id||p.request_id!==original.request_id||
    p.provider_verified_receipt_id!==original.provider_verified_receipt_id||
    p.owner_audit_id!==original.owner_audit_id||
    p.master_observation_id!==original.master_observation_id||
    p.disposition_id!==original.disposition_id||p.nonce!==original.nonce||
    p.signed_source_sha256!==source.payload_sha256||
    p.registry_sha256!==reg.registry_sha256||
    p.source_revision!==original.source_revision||!git.test(p.source_revision||'')||
    p.disposition!==original.disposition||
    !['RETAIN_HOLD','REOPEN_REQUIRED','SOURCE_ONLY_REVIEWED'].includes(p.disposition)||
    p.master_connected!==false||p.closure_authorized!==false||
    p.customer_delivery_verified!==false||p.owner_acceptance!==false)
  return fail('HOLD_WITNESS_SCOPE','Quorum must match the exact original signed source-only reviewer case and never elevate closure authority.');
 const issued=bounded(p.issued_at),expiry=bounded(p.expires_at);
 if(!Number.isFinite(issued)||!Number.isFinite(expiry)||issued>now+120000||
    issued<bounded(original.issued_at)||expiry<=now||expiry-issued>4*3600000)
  return fail('HOLD_WITNESS_FRESHNESS','Witness receipt must follow original source issuance and expire within four hours.');
 if(!roots.owner||!roots.independent_custodian||
    roots.owner.witness_id===roots.independent_custodian.witness_id||
    eq(roots.owner.trusted_spki_sha256,roots.independent_custodian.trusted_spki_sha256))
  return fail('HOLD_WITNESS_NOT_INDEPENDENT','Owner and custodian witnesses need separate independently pinned keys and identities.');
 const roles=new Map(a.map(x=>[x.role,x]));
 if(roles.size!==2||!roles.has('owner')||!roles.has('independent_custodian')||
   !independentlyPinned(roles.get('owner'),roots.owner,p)||
   !independentlyPinned(roles.get('independent_custodian'),roots.independent_custodian,p))
  return fail('HOLD_WITNESS_SIGNATURE','Both independently pinned human governance witness signatures must verify on the identical canonical source-only disposition.');
 return {ok:true,code:'TWO_SIGNED_WITNESSES_VERIFIED_LEDGER_PENDING_MASTER_HOLD',
  witness_sha256:hash(p),payload_sha256:source.payload_sha256,
  registry_sha256:reg.registry_sha256,company_id:original.company_id,
  request_id:original.request_id,provider_verified_receipt_id:original.provider_verified_receipt_id,
  disposition_id:original.disposition_id,witness_receipt_id:p.witness_receipt_id,
  source_revision:original.source_revision,issued_at:p.issued_at,
  master_connected:false,closure_authorized:false,customer_delivery_verified:false};
}
/** Both historical and renewed signed observations are independently verified against YW572 + YW571. */
export function verifySlaRenewalReceipt573(previous,current,registry,roots,previousTrust,currentTrust,now=Date.now()){
 const a=verifyEnvelope572(previous,registry,roots,previousTrust,now);
 const b=verifyEnvelope572(current,registry,roots,currentTrust,now);
 if(!a.ok||!b.ok)return fail('HOLD_RENEWAL_SIGNATURE','Both signed source observations require independently enrolled current registry and tenant scope.');
 const pair=verifyRenewalPair571(previous,current,previousTrust,currentTrust,now);
 if(!pair.ok)return fail('HOLD_RENEWAL_ORDER',pair.reason||pair.message);
 const first=previous.payload,second=current.payload;
 if(first.company_id!==second.company_id||first.source_revision!==second.source_revision||
    first.provider_verified_receipt_id!==second.provider_verified_receipt_id||
    first.registry_version!==second.registry_version||
    first.audience!==second.audience||a.registry_sha256!==b.registry_sha256)
  return fail('HOLD_RENEWAL_PROVENANCE','Previous and current SLA evidence do not share the original protected scope.');
 return {ok:true,code:'TWO_SOURCE_SIGNED_SLA_OBSERVATIONS_VERIFIED_MASTER_HOLD',
   previous_source_sha256:a.payload_sha256,current_source_sha256:b.payload_sha256,
   registry_sha256:a.registry_sha256,source_revision:a.source_revision,
   company_id:first.company_id,delta_minutes:pair.delta_minutes,
   sla_recovery_rate:null,sla_effectiveness_not_established:true,
   master_connected:false,closure_authorized:false,customer_delivery_verified:false};
}
/** Independent durable source custody and original signed witness quorum; no in-browser verdict. */
export async function admitDisposition573(witness,source,registry,roots,trust,store,now=Date.now()){
 const verified=verifyClosureWitness573(witness,source,registry,roots,trust,now);
 if(!verified.ok)return verified;
 if(!store||store.kind!=='postgres-disposition-unique-ledger-573'||
   typeof store.verifySourceAndClaimIfAbsent!=='function')
  return fail('HOLD_NO_DURABLE_DISPOSITION','Server-only private PostgreSQL unique ledger and original YW572 custody readback required.');
 try{
  const d=await store.verifySourceAndClaimIfAbsent(verified);
  if(d?.status==='INSERTED'&&d.witness_sha256===verified.witness_sha256&&
     d.source_payload_sha256===verified.payload_sha256)
   return {...verified,code:'SIGNED_DISPOSITION_LEDGER_ADMITTED_MASTER_HOLD',durable_source_only:true};
  if(d?.status==='REPLAY')return fail('HOLD_WITNESS_REPLAY','Witness quorum already recorded for this owner case.');
  if(d?.status==='SOURCE_NOT_CUSTODIED')return fail('HOLD_SOURCE_CUSTODY_ABSENT','Original independent YW572 receipt custody is not genuinely present.');
  return fail('HOLD_LEDGER_AMBIGUOUS','Atomic source/disposition custody was not independently verified.');
 }catch{return fail('HOLD_LEDGER_UNAVAILABLE','Private original disposition ledger is unavailable.');}
}
export class PostgresDisposition573{
 kind='postgres-disposition-unique-ledger-573';
 constructor(db){if(!db||typeof db.query!=='function'||typeof db.connect!=='function')
   throw Error('Dedicated server-only transactional PostgreSQL driver required');this.db=db;}
 async verifySourceAndClaimIfAbsent(r){
  const client=await this.db.connect();if(!client||typeof client.query!=='function'||typeof client.release!=='function')
   throw Error('Dedicated transactional PostgreSQL client missing');
  try{
   await client.query('begin');
   const original=await client.query(
    'select payload_sha256 from ywi_security_572.replay_custody where app_id=$1 and tenant_id=$2 and payload_sha256=$3 for share',
    ['YW',r.company_id,r.payload_sha256]);
   if(original?.rowCount!==1||original.rows?.length!==1||
     original.rows[0]?.payload_sha256!==r.payload_sha256){
    await client.query('rollback');return {status:'SOURCE_NOT_CUSTODIED'};
   }
   const insert=await client.query(
    'insert into ywi_security_573.original_disposition (app_id,tenant_id,request_id,provider_receipt_id,disposition_id,witness_receipt_id,source_payload_sha256,witness_sha256,registry_sha256,source_revision) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict do nothing returning witness_sha256,source_payload_sha256',
    ['YW',r.company_id,r.request_id,r.provider_verified_receipt_id,r.disposition_id,
     r.witness_receipt_id,r.payload_sha256,r.witness_sha256,r.registry_sha256,r.source_revision]);
   if(insert?.rowCount===1&&insert.rows?.length===1&&
      insert.rows[0]?.witness_sha256===r.witness_sha256&&
      insert.rows[0]?.source_payload_sha256===r.payload_sha256){
    await client.query('commit');return {status:'INSERTED',witness_sha256:r.witness_sha256,
      source_payload_sha256:r.payload_sha256};
   }
   await client.query('rollback');return {status:insert?.rowCount===0?'REPLAY':'UNVERIFIED'};
  }catch(error){try{await client.query('rollback');}catch{}throw error;}
  finally{client.release();}
 }
}
