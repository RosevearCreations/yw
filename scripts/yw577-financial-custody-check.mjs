import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyFinancialCustody577,YW577Stages,YW577Canonical,YW577Hash,YW577FactsHash} from './yw577-financial-custody.mjs';
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-16T23:00:00Z');
const companyId=id(1),customerId=id(2),invoiceId=id(3),periodId=id(4),eventId=id(5),issuerId=id(50);
const kp=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const public_key_pem=kp.publicKey.export({type:'spki',format:'pem'});
const facts=[
 {accepted:true,subtotal_cents:10000,tax_cents:1300,gross_cents:11300,tax_rate_bp:1300,period_id:periodId},
 {posted:true,subtotal_cents:10000,tax_cents:1300,gross_cents:11300,period_id:periodId,debit_cents:11300,credit_cents:11300},
 {settled:true,provider_event_id:eventId,capture_cents:11300,fee_cents:300,currency:'CAD',refund_count:0,dispute_count:0},
 {matched:true,provider_event_id:eventId,net_cents:11000,currency:'CAD',unmatched_count:0},
 {reviewed:true,private_scope:true,timesheets_original:true,period_id:periodId,pay_run_executed:false},
 {reviewed:true,period_id:periodId,taxable_cents:10000,tax_cents:1300,approved_rate_bp:1300,filing_executed:false},
 {reviewed:true,period_id:periodId,independent_reviewer:true,debit_cents:11300,credit_cents:11300,locked:true}
];
const make=()=>{
 const issuers={[issuerId]:{server_enrolled:true,active:true,revoked:false,
  company_id:companyId,audience:'YW',provider:'YW',key_id:'approved-p256-2026-11',
  capabilities:YW577Stages.map(x=>x[1]),expires_at:'2026-11-17T03:00:00Z',public_key_pem}};
 const envelopes=[],originalSources=[];
 for(let i=0;i<YW577Stages.length;i++){
  const e={stage:YW577Stages[i][0],company_id:companyId,customer_id:customerId,invoice_id:invoiceId,
   source_id:id(100+i),revision:1,nonce:id(200+i),previous_hash:'GENESIS',issued_at:'2026-11-16T22:30:00Z',
   audience:'YW',issuer_id:issuerId,key_id:'approved-p256-2026-11',
   protocol:i%2?'1.0':'1.1',currency:'CAD',facts:{...facts[i]}};
  envelopes.push(e);
  originalSources.push({trusted_server_source:true,source_role:'tenant_finance',
   company_id:companyId,customer_id:customerId,invoice_id:invoiceId,source_id:e.source_id,
   revision:e.revision,stage:e.stage,state_verified:true,revoked:false,current_revision:true,
   captured_at:'2026-11-16T22:59:00Z',facts_hash:'',
   provider_api_verified:i===2,bank_source_verified:i===3,private_hr_scope_verified:i===4,
   tax_rate_source_verified:i===5});
 }
 const resign=()=>{
  for(let i=0;i<envelopes.length;i++){
   const e=envelopes[i];if(i)e.previous_hash=YW577Hash(envelopes[i-1]);
   originalSources[i].facts_hash=YW577FactsHash(e);
   e.signature=sign('sha256',Buffer.from(YW577Canonical(e)),
    {key:kp.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  }
 };
 resign();return {companyId,customerId,invoiceId,envelopes,originalSources,issuers,resign};
};
const ready=make(),out=verifyFinancialCustody577(ready,now);
assert.equal(out.state,'ORIGINAL_EVIDENCE_SHAPE_REVIEW_ONLY');
for(const k of ['canInvoice','canCapture','canPost','canRunPayroll','canFileTax'])assert.equal(out[k],false);
for(const k of ['masterAck','commsAck','icampAck'])assert.equal(out[k],'HOLD');
let count=0;const reject=(label,change,reattest=false)=>{
 const b=make();change(b);if(reattest)b.resign();
 const result=verifyFinancialCustody577(b,now);
 assert.equal(result.state,'HOLD',label);count++;
};
reject('cross tenant',x=>x.envelopes[2].company_id=id(9));
reject('foreign original',x=>x.originalSources[0].company_id=id(9));
reject('wrong invoice',x=>x.envelopes[4].invoice_id=id(9));
reject('missing last stage',x=>x.envelopes.pop());
reject('reversed evidence',x=>x.envelopes.reverse());
reject('replay nonce',x=>x.envelopes[2].nonce=x.envelopes[1].nonce,true);
reject('replay from ledger',x=>x.usedNonces=[x.envelopes[0].nonce]);
reject('old original snapshot',x=>x.originalSources[3].captured_at='2026-11-16T20:00:00Z');
reject('future signed time',x=>x.envelopes[0].issued_at='2026-11-17T00:00:00Z');
reject('revoked source',x=>x.originalSources[1].revoked=true);
reject('unapproved issuer',x=>x.envelopes[1].issuer_id=id(9));
reject('expired issuer',x=>x.issuers[issuerId].expires_at='2026-11-16T22:00:00Z');
reject('no original stage capability',x=>x.issuers[issuerId].capabilities=['finance.quote.accepted']);
reject('tampered signature',x=>x.envelopes[1].signature='invalid');
reject('wrong protocol',x=>x.envelopes[4].protocol='2.0',true);
reject('unaccepted quote',x=>x.envelopes[0].facts.accepted=false,true);
reject('quote tax miscomputed',x=>x.envelopes[0].facts.tax_cents=1200,true);
reject('posted amount drift',x=>x.envelopes[1].facts.gross_cents=11200,true);
reject('GL out of balance',x=>x.envelopes[1].facts.credit_cents=11200,true);
reject('partial provider settlement',x=>x.envelopes[2].facts.capture_cents=9000,true);
reject('chargeback/refund',x=>x.envelopes[2].facts.refund_count=1,true);
reject('provider API absent',x=>x.originalSources[2].provider_api_verified=false);
reject('fee greater than capture',x=>x.envelopes[2].facts.fee_cents=20000,true);
reject('unverified bank',x=>x.originalSources[3].bank_source_verified=false);
reject('unmatched deposit',x=>x.envelopes[3].facts.net_cents=11001,true);
reject('wrong provider match',x=>x.envelopes[3].facts.provider_event_id=id(16),true);
reject('payroll PII privacy fail',x=>x.envelopes[4].facts.private_scope=false,true);
reject('cannot claim payroll run',x=>x.envelopes[4].facts.pay_run_executed=true,true);
reject('missing trusted tax rate',x=>x.originalSources[5].tax_rate_source_verified=false);
reject('tax rate mismatch',x=>x.envelopes[5].facts.approved_rate_bp=1200,true);
reject('cannot claim CRA filing',x=>x.envelopes[5].facts.filing_executed=true,true);
reject('unlocked close',x=>x.envelopes[6].facts.locked=false,true);
reject('unreviewed close',x=>x.envelopes[6].facts.independent_reviewer=false,true);
reject('extra signed provider field',x=>x.envelopes[2].facts.bank_account='PRIVATE',true);
assert.ok(count>=30);
console.log('YW577 signed financial custody stages PASS, '+count+' negative tenant/provider/bank/payroll/tax/period and replay cases PASS');
