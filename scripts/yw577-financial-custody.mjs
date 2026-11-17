/* YW577 original financial source custody. Read-only verification against
 * server-attested originals, separately enrolled P-256 issuers and a caller-
 * supplied durable replay snapshot. Never performs a financial action. */
import {createHash,createPublicKey,verify} from 'node:crypto';
const U=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha=x=>createHash('sha256').update(x).digest('hex');
const S=Object.freeze([
 ['quote_accepted','finance.quote.accepted'],
 ['invoice_posted','finance.invoice.posted'],
 ['payment_settled','finance.provider.settled'],
 ['bank_reconciled','finance.bank.matched'],
 ['private_payroll_reviewed','finance.payroll.reviewed'],
 ['tax_remittance_reviewed','finance.tax.reviewed'],
 ['period_close_reviewed','finance.period.close']
]);
const F=Object.freeze({
 quote_accepted:['accepted','subtotal_cents','tax_cents','gross_cents','tax_rate_bp','period_id'],
 invoice_posted:['posted','subtotal_cents','tax_cents','gross_cents','period_id','debit_cents','credit_cents'],
 payment_settled:['settled','provider_event_id','capture_cents','fee_cents','currency','refund_count','dispute_count'],
 bank_reconciled:['matched','provider_event_id','net_cents','currency','unmatched_count'],
 private_payroll_reviewed:['reviewed','private_scope','timesheets_original','period_id','pay_run_executed'],
 tax_remittance_reviewed:['reviewed','period_id','taxable_cents','tax_cents','approved_rate_bp','filing_executed'],
 period_close_reviewed:['reviewed','period_id','independent_reviewer','debit_cents','credit_cents','locked']
});
const KEYS=['stage','company_id','customer_id','invoice_id','source_id','revision','nonce','previous_hash','issued_at','audience','issuer_id','key_id','protocol','currency','facts'];
export const YW577Stages=S;
export const YW577Canonical=x=>JSON.stringify(Object.fromEntries(KEYS.map(k=>[k,x?.[k]])));
export const YW577Hash=x=>sha(YW577Canonical(x));
export const YW577FactsHash=x=>sha(JSON.stringify(x?.facts));
const HOLD=(stage,reason)=>Object.freeze({state:'HOLD',stage,reason,verified:false,
 canInvoice:false,canCapture:false,canPost:false,canRunPayroll:false,canFileTax:false,
 masterAck:'HOLD',commsAck:'HOLD',icampAck:'HOLD'});
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000000;
const equal=(x,y)=>money(x)&&money(y)&&x===y;
const rate=x=>Number.isSafeInteger(x)&&x>=0&&x<=3000;
const tax=(x,bp)=>Number((BigInt(x)*BigInt(bp)+5000n)/10000n);
function factsOk(stage,f,prior){
 const keys=F[stage];
 if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).length!==keys.length||
   !keys.every(x=>Object.hasOwn(f,x)))return 'Missing or extra signed facts';
 const q=prior.quote_accepted?.facts,inv=prior.invoice_posted?.facts,p=prior.payment_settled?.facts;
 switch(stage){
 case 'quote_accepted':
  if(f.accepted!==true||!money(f.subtotal_cents)||f.subtotal_cents===0||
    !money(f.tax_cents)||!money(f.gross_cents)||!rate(f.tax_rate_bp)||!U.test(f.period_id||'')||
    f.tax_cents!==tax(f.subtotal_cents,f.tax_rate_bp)||
    !equal(f.gross_cents,f.subtotal_cents+f.tax_cents))
    return 'Invalid customer-accepted quote, cents or verified tax basis';
  return null;
 case 'invoice_posted':
  if(f.posted!==true||f.period_id!==q.period_id||
   !equal(f.subtotal_cents,q.subtotal_cents)||!equal(f.tax_cents,q.tax_cents)||
   !equal(f.gross_cents,q.gross_cents)||!equal(f.debit_cents,f.credit_cents)||
   !equal(f.debit_cents,q.gross_cents))
   return 'Original invoice/GL posting differs from accepted quote';
  return null;
 case 'payment_settled':
  if(f.settled!==true||!U.test(f.provider_event_id||'')||f.currency!=='CAD'||
   !equal(f.capture_cents,inv.gross_cents)||!money(f.fee_cents)||
   f.fee_cents>f.capture_cents||f.refund_count!==0||f.dispute_count!==0)
   return 'Provider charge unsettled, partially paid, refunded or disputed';
  return null;
 case 'bank_reconciled':
  if(f.matched!==true||f.provider_event_id!==p.provider_event_id||
   f.currency!=='CAD'||f.unmatched_count!==0||
   !equal(f.net_cents,p.capture_cents-p.fee_cents))
   return 'Independent bank deposit does not reconcile provider fees';
  return null;
 case 'private_payroll_reviewed':
  if(f.reviewed!==true||f.private_scope!==true||f.timesheets_original!==true||
   f.pay_run_executed!==false||f.period_id!==q.period_id)
   return 'Private payroll source/approved time unavailable';
  return null;
 case 'tax_remittance_reviewed':
  if(f.reviewed!==true||f.period_id!==q.period_id||
   !equal(f.taxable_cents,q.subtotal_cents)||!equal(f.tax_cents,q.tax_cents)||
   !rate(f.approved_rate_bp)||f.approved_rate_bp!==q.tax_rate_bp||f.filing_executed!==false)
   return 'Tax review disagrees with original approved rate, date or basis';
  return null;
 case 'period_close_reviewed':
  if(f.reviewed!==true||f.period_id!==q.period_id||
   f.independent_reviewer!==true||f.locked!==true||
   !equal(f.debit_cents,f.credit_cents)||!equal(f.debit_cents,inv.gross_cents))
   return 'Independent balanced original period close/lock not verified';
  return null;
 default:return 'Unknown financial stage';
 }
}
export function verifyFinancialCustody577({companyId,customerId,invoiceId,
 envelopes,originalSources,issuers,usedNonces=[]}={},now=Date.now()){
 if(![companyId,customerId,invoiceId].every(x=>U.test(x||''))||!Number.isFinite(now))
  return HOLD('','Original company, customer and invoice required');
 if(!Array.isArray(envelopes)||envelopes.length!==S.length||
    !Array.isArray(originalSources)||originalSources.length!==S.length||
    !issuers||typeof issuers!=='object'||Array.isArray(issuers)||!Array.isArray(usedNonces))
  return HOLD('','Complete signed original evidence chain required');
 const nonces=new Set(usedNonces),sources=new Set(),prior={};
 let previous='GENESIS';
 for(let i=0;i<S.length;i++){
  const [stage,cap]=S[i],e=envelopes[i],o=originalSources[i];
  if(!e||e.stage!==stage||e.company_id!==companyId||e.customer_id!==customerId||
    e.invoice_id!==invoiceId||e.audience!=='YW'||e.currency!=='CAD'||
    !['1.0','1.1'].includes(e.protocol)||!U.test(e.source_id||'')||
    !U.test(e.nonce||'')||!Number.isSafeInteger(e.revision)||e.revision<1||
    e.previous_hash!==previous||typeof e.key_id!=='string'||!e.key_id)
    return HOLD(stage,'Stage order, source revision or tenant envelope invalid');
  const when=Date.parse(e.issued_at);
  if(!Number.isFinite(when)||when>now+60000||now-when>4*3600000)
    return HOLD(stage,'Expired or future source envelope');
  if(nonces.has(e.nonce)||sources.has(e.source_id))
    return HOLD(stage,'Replay nonce or repeated financial source');
  nonces.add(e.nonce);sources.add(e.source_id);
  const captured=Date.parse(o?.captured_at);
  if(!o||o.trusted_server_source!==true||o.source_role!=='tenant_finance'||
    o.company_id!==companyId||o.customer_id!==customerId||o.invoice_id!==invoiceId||
    o.source_id!==e.source_id||o.revision!==e.revision||o.stage!==stage||
    o.state_verified!==true||o.revoked!==false||o.current_revision!==true||
    o.facts_hash!==YW577FactsHash(e)||!Number.isFinite(captured)||
    captured>now+60000||now-captured>5*60000)
    return HOLD(stage,'Fresh independent original source and custody proof missing');
  if(stage==='payment_settled'&&o.provider_api_verified!==true)
    return HOLD(stage,'Provider settlement must be verified via provider API');
  if(stage==='bank_reconciled'&&o.bank_source_verified!==true)
    return HOLD(stage,'Independent original bank match unavailable');
  if(stage==='private_payroll_reviewed'&&o.private_hr_scope_verified!==true)
    return HOLD(stage,'Private employee/payroll authority unavailable');
  if(stage==='tax_remittance_reviewed'&&o.tax_rate_source_verified!==true)
    return HOLD(stage,'Jurisdiction- and date-approved tax rate not sourced');
  const issuer=Object.hasOwn(issuers,e.issuer_id)?issuers[e.issuer_id]:null;
  if(!issuer||issuer.server_enrolled!==true||issuer.active!==true||
    issuer.revoked!==false||issuer.company_id!==companyId||
    issuer.audience!=='YW'||issuer.provider!=='YW'||issuer.key_id!==e.key_id||
    !Array.isArray(issuer.capabilities)||!issuer.capabilities.includes(cap)||
    !Number.isFinite(Date.parse(issuer.expires_at))||Date.parse(issuer.expires_at)<=now||
    typeof issuer.public_key_pem!=='string'||typeof e.signature!=='string')
   return HOLD(stage,'Issuer enrollment, capability or key rotation missing');
  try{
   const key=createPublicKey(issuer.public_key_pem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
      !verify('sha256',Buffer.from(YW577Canonical(e)),{key,dsaEncoding:'ieee-p1363'},
       Buffer.from(e.signature,'base64url')))
     return HOLD(stage,'Invalid original signed finance receipt');
  }catch{return HOLD(stage,'Invalid signed financial source encoding');}
  const error=factsOk(stage,e.facts,prior);
  if(error)return HOLD(stage,error);
  prior[stage]=e;previous=YW577Hash(e);
 }
 return Object.freeze({state:'ORIGINAL_EVIDENCE_SHAPE_REVIEW_ONLY',verified:true,
  companyId,invoiceId,receiptHash:previous,stages:S.length,
  canInvoice:false,canCapture:false,canPost:false,canRunPayroll:false,canFileTax:false,
  masterAck:'HOLD',commsAck:'HOLD',icampAck:'HOLD'});
}
