/* YW578: financial activation evidence admission. Verification of a caller-provided
 * receipt packet is NOT validation against a live issuer/provider/bank/CRA. No writes. */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { verifyFinancialCustody577 } from './yw577-financial-custody.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest=/^[a-f0-9]{64}$/i;
const hash=x=>createHash('sha256').update(x).digest('hex');
const phases=Object.freeze([
  ['provider_settlement','finance.activation.provider.review','finance_reviewer'],
  ['private_payroll','finance.activation.payroll.review','payroll_approver'],
  ['tax_remittance','finance.activation.tax.review','tax_approver'],
  ['independent_close','finance.activation.close.review','independent_accountant']
]);
const fields=['phase','company_id','invoice_id','period_id','actor_id','issuer_id','key_id',
 'nonce','issued_at','expires_at','previous_hash','custody_hash','decision',
 'source_revision','source_digest','protocol'];
export const YW578Phases=phases;
export const approvalCanonical578=a=>JSON.stringify(Object.fromEntries(fields.map(k=>[k,a?.[k]])));
export const approvalHash578=a=>hash(approvalCanonical578(a)+'.'+a.signature);
const blocked=(phase,reason)=>Object.freeze({
 state:'HOLD',phase,reason,sourceOnly:true,externallyActivated:false,
 canCapture:false,canPost:false,canPayPayroll:false,canFileTax:false,
 canClosePeriod:false,canNotify:false,masterAck:'HOLD',commsAck:'HOLD',
 icampAck:'HOLD'
});
/* Source records here are only shape-bound inputs. The trusted backend must
 * fetch them independently with RLS + provider/bank API custody, never from UI.
 * A client-provided trust flag is never sufficient for a live authorization. */
export function evaluateActivationReadiness578({
 companyId,customerId,invoiceId,periodId,custody,approvals,sources,issuers,
 usedNonces=[],durableLedgerProof=null,stagingAuthority=null
}={},now=Date.now()){
 if(![companyId,customerId,invoiceId,periodId].every(x=>uuid.test(x||''))||
    !Number.isFinite(now)) return blocked('','Missing original company/customer/invoice/period identity');
 if(!Array.isArray(approvals)||approvals.length!==4||
    !Array.isArray(sources)||sources.length!==4||!issuers||
    typeof issuers!=='object'||Array.isArray(issuers)||
    !Array.isArray(usedNonces)) return blocked('','Four independent finance reviews and sources required');
 if(!custody||typeof custody!=='object'||Array.isArray(custody))
  return blocked('custody','Original signed YW577 custody packet required');
 const original=verifyFinancialCustody577(custody,now);
 if(original.state!=='ORIGINAL_EVIDENCE_SHAPE_REVIEW_ONLY'||original.companyId!==companyId||
    original.invoiceId!==invoiceId||custody?.customerId!==customerId||
    custody?.envelopes?.[0]?.facts?.period_id!==periodId)
  return blocked('custody','Original YW577 signed quote-to-close chain unavailable');
 const used=new Set(usedNonces),actors=new Set(),sourceIds=new Set();
 let previous='GENESIS';
 for(let i=0;i<phases.length;i++){
  const [phase,capability,role]=phases[i],a=approvals[i],s=sources[i];
  if(!a||a.phase!==phase||a.company_id!==companyId||
     a.invoice_id!==invoiceId||a.period_id!==periodId||
     !uuid.test(a.actor_id||'')||!uuid.test(a.nonce||'')||
     !uuid.test(a.issuer_id||'')||!uuid.test(s?.source_id||'')||
     !['1.0','1.1'].includes(a.protocol)||a.decision!=='reviewed'||
     a.custody_hash!==original.receiptHash||a.previous_hash!==previous||
     !Number.isSafeInteger(a.source_revision)||a.source_revision<1||
     !digest.test(a.source_digest||'')||typeof a.signature!=='string')
   return blocked(phase,'Incorrect staged approval, source revision or original receipt binding');
  if(used.has(a.nonce)||actors.has(a.actor_id)||sourceIds.has(s.source_id))
   return blocked(phase,'Replayed approval or approval reviewer/source reused');
  used.add(a.nonce);actors.add(a.actor_id);sourceIds.add(s.source_id);
  const issued=Date.parse(a.issued_at),expires=Date.parse(a.expires_at);
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||
     issued>now+60000||now-issued>15*60000||expires<=now||
     expires-issued>30*60000)
   return blocked(phase,'Approval must be current and short-lived');
  const observed=Date.parse(s?.observed_at);
  if(s?.company_id!==companyId||s.invoice_id!==invoiceId||
     s.period_id!==periodId||s.phase!==phase||
     s.trusted_server_source!==true||s.current_revision!==true||
     s.revoked!==false||s.authority_checked!==true||
     s.revision!==a.source_revision||s.digest!==a.source_digest||
     !Number.isFinite(observed)||observed>now+60000||
     now-observed>5*60000)
   return blocked(phase,'Independent current source proof missing or changed');
  if(phase==='provider_settlement'&&
     (s.provider_api_verified!==true||s.bank_api_verified!==true||
      s.no_refund_or_dispute!==true||s.exact_net_verified!==true))
   return blocked(phase,'Original provider settlement and bank match not independently verified');
  if(phase==='private_payroll'&&
     (s.private_hr_scope_verified!==true||s.timesheet_approved!==true||
      s.executed!==false))
   return blocked(phase,'Company-private payroll and approved time review incomplete');
  if(phase==='tax_remittance'&&
     (s.jurisdiction_rate_verified!==true||s.period_basis_verified!==true||
      s.executed!==false))
   return blocked(phase,'Original jurisdiction/date tax basis and approval incomplete');
  if(phase==='independent_close'&&
     (s.balanced_gl_verified!==true||s.independent_period_lock_verified!==true||
      s.executed!==false))
   return blocked(phase,'Independent balanced period close approval incomplete');
  const issuer=Object.hasOwn(issuers,a.issuer_id)?issuers[a.issuer_id]:null;
  if(!issuer||issuer.server_enrolled!==true||issuer.active!==true||
     issuer.revoked!==false||issuer.company_id!==companyId||
     issuer.actor_id!==a.actor_id||issuer.role!==role||
     issuer.key_id!==a.key_id||issuer.audience!=='YW'||
     !Array.isArray(issuer.capabilities)||
     !issuer.capabilities.includes(capability)||
     !Number.isFinite(Date.parse(issuer.expires_at))||
     Date.parse(issuer.expires_at)<=now||
     typeof issuer.public_key_pem!=='string')
   return blocked(phase,'Independently enrolled role-bound approver/key missing');
  try{
   const key=createPublicKey(issuer.public_key_pem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
      !verify('sha256',Buffer.from(approvalCanonical578(a)),
       {key,dsaEncoding:'ieee-p1363'},Buffer.from(a.signature,'base64url')))
    return blocked(phase,'Approval signature invalid');
  }catch{return blocked(phase,'Approval signature/key encoding invalid');}
  previous=approvalHash578(a);
 }
 /* These are proposal packet controls, not trustworthy external runtime receipts.
  * No path returns authorization to bill, settle, pay, remit, notify or close. */
 if(durableLedgerProof?.registered!==true||stagingAuthority?.isolatedVerified!==true||
    stagingAuthority?.schemaParityVerified!==true)
   return blocked('activation','Independent durable replay ledger and isolated staging attestation missing');
 return Object.freeze({...blocked('','Source packet verified for independent review only'),
  state:'SIGNED_REVIEW_PACKET_ONLY',reason:'Approval signatures checked; no live provider or production authority granted',
  approvalHash:previous,reviewStages:4});
}
