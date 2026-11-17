/* YW579: independent settlement pilot acceptance contract.
 * An original provider API connection, bank feed, staging database and durable
 * replay ledger MUST be verified on a trusted server. A caller-supplied packet,
 * even if all review signatures validate, NEVER authorizes a financial action. */
import {createHash,createPublicKey,verify} from 'node:crypto';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha=/^[a-f0-9]{64}$/i;
const hash=x=>createHash('sha256').update(x).digest('hex');
const roles=['company_owner','staging_dba','independent_accountant'];
const keys=['role','company_id','invoice_id','period_id','actor_id','issuer_id','key_id',
 'source_digest','issued_at','expires_at','nonce','previous_hash','decision','protocol'];
export const YW579ReviewRoles=Object.freeze(roles);
export const canonicalYW579=x=>JSON.stringify(Object.fromEntries(keys.map(k=>[k,x?.[k]])));
export const hashYW579=x=>hash(canonicalYW579(x)+'.'+x.signature);
const deny=(reason,step='')=>Object.freeze({state:'HOLD',reason,step,
 originalProviderEnrolled:false,liveStagingAccepted:false,canCapture:false,
 canPost:false,canTransfer:false,canPayPayroll:false,canFileTax:false,
 canClose:false,canNotify:false,masterAck:'HOLD',commsAck:'HOLD',icampAck:'HOLD'});
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000000;
const recent=(date,now,maxAge)=>{const n=Date.parse(date);return Number.isFinite(n)&&n<=now+60000&&now-n<=maxAge;};
export function inspectFinancialPilot579({
 companyId,invoiceId,periodId,enrollment,settlement,staging,approvals,
 issuers,usedNonces=[],yw578Receipt=null
}={},now=Date.now()){
 if(![companyId,invoiceId,periodId].every(x=>uuid.test(x||''))||!Number.isFinite(now))
  return deny('Original company, invoice and accounting period required');
 if(!enrollment||!settlement||!staging||!Array.isArray(approvals)||approvals.length!==3||
    !issuers||typeof issuers!=='object'||Array.isArray(issuers)||
    !Array.isArray(usedNonces))
  return deny('Independent provider, bank, staging and owner/DBA/accountant evidence required');
 if(yw578Receipt?.state!=='SIGNED_REVIEW_PACKET_ONLY'||
    yw578Receipt.sourceOnly!==true||yw578Receipt.externallyActivated!==false||
    !sha.test(yw578Receipt.approvalHash||''))
  return deny('Original YW578 signed review-packet provenance required','YW578');
 if(enrollment.company_id!==companyId||enrollment.environment!=='sandbox'||
    enrollment.production_live_enabled!==false||
    enrollment.original_provider_api_verified!==true||
    enrollment.owner_verified!==true||enrollment.revoked!==false||
    !uuid.test(enrollment.provider_registration_id||'')||
    !sha.test(enrollment.provider_account_fingerprint||'')||
    !recent(enrollment.verified_at,now,5*60000))
  return deny('Independent original sandbox provider enrollment not verified','enrollment');
 if(settlement.company_id!==companyId||settlement.invoice_id!==invoiceId||
    settlement.period_id!==periodId||!uuid.test(settlement.provider_event_id||'')||
    settlement.currency!=='CAD'||settlement.settled!==true||
    settlement.original_provider_api_verified!==true||
    settlement.independent_bank_api_verified!==true||
    settlement.bank_match_final===true||settlement.refunds!==0||settlement.disputes!==0||
    !money(settlement.capture_cents)||settlement.capture_cents===0||
    !money(settlement.fee_cents)||settlement.fee_cents>settlement.capture_cents||
    !money(settlement.bank_net_cents)||settlement.bank_net_cents!==settlement.capture_cents-settlement.fee_cents||
    !sha.test(settlement.provider_original_hash||'')||
    !sha.test(settlement.bank_original_hash||'')||
    !recent(settlement.observed_at,now,5*60000))
  return deny('Independent original settlement, reconciliation or refund/dispute state invalid','settlement');
 // bank_match_final is explicitly false: sandbox comparison only, not a posted match.
 if(staging.environment!=='staging'||staging.production_mutation_enabled!==false||
    staging.separate_project_verified!==true||staging.schema_parity_verified!==true||
    staging.backup_restore_verified!==true||staging.preview_only!==true||
    typeof staging.project_ref!=='string'||typeof staging.production_ref!=='string'||
    !/^[a-z0-9]{12,30}$/.test(staging.project_ref)||
    !/^[a-z0-9]{12,30}$/.test(staging.production_ref)||
    staging.project_ref===staging.production_ref||
    !recent(staging.checked_at,now,5*60000))
  return deny('Verified isolated staging, exact schema parity and restoration evidence required','staging');
 const sourceDigest=hash([yw578Receipt.approvalHash,enrollment.provider_account_fingerprint,
  settlement.provider_original_hash,settlement.bank_original_hash,staging.project_ref].join('|'));
 const used=new Set(usedNonces),actors=new Set(),enrolled=new Set();
 let previous='GENESIS';
 for(let i=0;i<roles.length;i++){
  const step=roles[i],a=approvals[i];
  if(!a||a.role!==step||a.company_id!==companyId||
     a.invoice_id!==invoiceId||a.period_id!==periodId||
     !uuid.test(a.actor_id||'')||!uuid.test(a.issuer_id||'')||
     !uuid.test(a.nonce||'')||!['1.0','1.1'].includes(a.protocol)||
     a.decision!=='staging_review_only'||a.source_digest!==sourceDigest||
     a.previous_hash!==previous||typeof a.signature!=='string')
    return deny('Review stage order, tenant, source hash or operation scope invalid',step);
  if(used.has(a.nonce)||actors.has(a.actor_id)||enrolled.has(a.issuer_id))
    return deny('Approval replay, duplicate reviewer or issuer reuse',step);
  used.add(a.nonce);actors.add(a.actor_id);enrolled.add(a.issuer_id);
  if(!recent(a.issued_at,now,10*60000)||
     !recent(a.expires_at,now,0)||Date.parse(a.expires_at)<=now||
     Date.parse(a.expires_at)-Date.parse(a.issued_at)>20*60000)
    return deny('Expired, future or stale independent review',step);
  const k=Object.hasOwn(issuers,a.issuer_id)?issuers[a.issuer_id]:null;
  if(!k||k.server_enrolled!==true||k.active!==true||k.revoked!==false||
     k.company_id!==companyId||k.actor_id!==a.actor_id||
     k.role!==step||k.key_id!==a.key_id||
     k.audience!=='YW'||k.capability!=='finance.staging.review.'+step||
     !recent(k.expires_at,now,0)||Date.parse(k.expires_at)<=now||
     typeof k.public_key_pem!=='string')
    return deny('Current original role-separated issuer enrollment missing',step);
  try{
   const key=createPublicKey(k.public_key_pem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
      !verify('sha256',Buffer.from(canonicalYW579(a)),
       {key,dsaEncoding:'ieee-p1363'},Buffer.from(a.signature,'base64url')))
    return deny('Invalid original P-256 review signature',step);
  }catch{return deny('Invalid original review key/encoding',step);}
  previous=hashYW579(a);
 }
 return Object.freeze({...deny('Source-shaped sandbox packet passed review. Original provider/DBA activation remains HOLD.'),
  state:'STAGING_SHAPE_REVIEW_ONLY',reviewHash:previous,
  sourceDigest,reviewStages:roles.length,
  liveStagingAccepted:false,originalProviderEnrolled:false});
}
