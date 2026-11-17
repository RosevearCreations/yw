import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {YW577Stages,YW577Canonical,YW577Hash,YW577FactsHash} from './yw577-financial-custody.mjs';
import {evaluateActivationReadiness578,YW578Phases,approvalCanonical578,approvalHash578} from './yw578-financial-activation.mjs';
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-17T14:30:00Z');
const companyId=id(1),customerId=id(2),invoiceId=id(3),periodId=id(4);
const providerEvent=id(5);
const facts=[
 {accepted:true,subtotal_cents:10000,tax_cents:1300,gross_cents:11300,tax_rate_bp:1300,period_id:periodId},
 {posted:true,subtotal_cents:10000,tax_cents:1300,gross_cents:11300,period_id:periodId,debit_cents:11300,credit_cents:11300},
 {settled:true,provider_event_id:providerEvent,capture_cents:11300,fee_cents:300,currency:'CAD',refund_count:0,dispute_count:0},
 {matched:true,provider_event_id:providerEvent,net_cents:11000,currency:'CAD',unmatched_count:0},
 {reviewed:true,private_scope:true,timesheets_original:true,period_id:periodId,pay_run_executed:false},
 {reviewed:true,period_id:periodId,taxable_cents:10000,tax_cents:1300,approved_rate_bp:1300,filing_executed:false},
 {reviewed:true,period_id:periodId,independent_reviewer:true,debit_cents:11300,credit_cents:11300,locked:true}
];
const custodyKey=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const approvalKeys=YW578Phases.map(()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'}));
const pub=kp=>kp.publicKey.export({type:'spki',format:'pem'});
function make(){
 const custody={companyId,customerId,invoiceId,envelopes:[],originalSources:[],issuers:{}};
 const custIssuer=id(20);
 custody.issuers[custIssuer]={server_enrolled:true,active:true,revoked:false,
  company_id:companyId,audience:'YW',provider:'YW',key_id:'custody-578',
  capabilities:YW577Stages.map(v=>v[1]),expires_at:'2026-11-17T16:00:00Z',
  public_key_pem:pub(custodyKey)};
 const resignCustody=()=>{
  for(let i=0;i<custody.envelopes.length;i++){
   const e=custody.envelopes[i],o=custody.originalSources[i];
   if(i)e.previous_hash=YW577Hash(custody.envelopes[i-1]);
   o.facts_hash=YW577FactsHash(e);
   e.signature=sign('sha256',Buffer.from(YW577Canonical(e)),
    {key:custodyKey.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  }
 };
 for(let i=0;i<7;i++){
  const e={stage:YW577Stages[i][0],company_id:companyId,customer_id:customerId,
   invoice_id:invoiceId,source_id:id(100+i),revision:1,nonce:id(200+i),
   previous_hash:'GENESIS',issued_at:'2026-11-17T14:25:00Z',audience:'YW',
   issuer_id:custIssuer,key_id:'custody-578',protocol:i%2?'1.0':'1.1',
   currency:'CAD',facts:{...facts[i]}};
  custody.envelopes.push(e);
  custody.originalSources.push({trusted_server_source:true,source_role:'tenant_finance',
   company_id:companyId,customer_id:customerId,invoice_id:invoiceId,
   source_id:e.source_id,revision:1,stage:e.stage,state_verified:true,
   revoked:false,current_revision:true,captured_at:'2026-11-17T14:29:00Z',
   facts_hash:'',provider_api_verified:i===2,bank_source_verified:i===3,
   private_hr_scope_verified:i===4,tax_rate_source_verified:i===5});
 }
 resignCustody();
 const custodyHash=YW577Hash(custody.envelopes.at(-1));
 const options={companyId,customerId,invoiceId,periodId,custody,approvals:[],
  sources:[],issuers:{},usedNonces:[],durableLedgerProof:{registered:true},
  stagingAuthority:{isolatedVerified:true,schemaParityVerified:true}};
 const resign=()=>{
  for(let i=0;i<options.approvals.length;i++){
   const a=options.approvals[i];
   if(i)a.previous_hash=approvalHash578(options.approvals[i-1]);
   a.signature=sign('sha256',Buffer.from(approvalCanonical578(a)),
    {key:approvalKeys[i].privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  }
 };
 for(let i=0;i<4;i++){
  const [phase,cap,role]=YW578Phases[i],actor=id(300+i),issuer=id(400+i);
  const source={source_id:id(500+i),company_id:companyId,invoice_id:invoiceId,
   period_id:periodId,phase,trusted_server_source:true,current_revision:true,
   revoked:false,authority_checked:true,revision:1,
   digest:createHash('sha256').update('original-phase-'+i).digest('hex'),
   observed_at:'2026-11-17T14:29:00Z',
   provider_api_verified:i===0,bank_api_verified:i===0,
   no_refund_or_dispute:i===0,exact_net_verified:i===0,
   private_hr_scope_verified:i===1,timesheet_approved:i===1,
   jurisdiction_rate_verified:i===2,period_basis_verified:i===2,
   balanced_gl_verified:i===3,independent_period_lock_verified:i===3,
   executed:false};
  options.sources.push(source);
  const a={phase,company_id:companyId,invoice_id:invoiceId,period_id:periodId,
   actor_id:actor,issuer_id:issuer,key_id:'review-'+i,nonce:id(600+i),
   issued_at:'2026-11-17T14:28:00Z',expires_at:'2026-11-17T14:44:00Z',
   previous_hash:'GENESIS',custody_hash:custodyHash,decision:'reviewed',
   source_revision:1,source_digest:source.digest,protocol:i%2?'1.0':'1.1'};
  options.approvals.push(a);
  options.issuers[issuer]={server_enrolled:true,active:true,revoked:false,
   company_id:companyId,actor_id:actor,role,key_id:'review-'+i,
   audience:'YW',capabilities:[cap],expires_at:'2026-11-17T16:00:00Z',
   public_key_pem:pub(approvalKeys[i])};
 }
 resign();return {options,resign,resignCustody};
}
const ok=make().options;
const receipt=evaluateActivationReadiness578(ok,now);
assert.equal(receipt.state,'SIGNED_REVIEW_PACKET_ONLY');
assert.equal(receipt.reviewStages,4);
assert.equal(receipt.sourceOnly,true);
assert.equal(receipt.externallyActivated,false);
for(const k of ['canCapture','canPost','canPayPayroll','canFileTax','canClosePeriod','canNotify'])assert.equal(receipt[k],false,k);
for(const k of ['masterAck','commsAck','icampAck'])assert.equal(receipt[k],'HOLD',k);
let cases=0;
function reject(name,change,resign=false){
 const packet=make();change(packet.options,packet);
 if(resign)packet.resign();
 const out=evaluateActivationReadiness578(packet.options,now);
 assert.equal(out.state,'HOLD',name);cases++;
}
reject('missing custody',x=>x.custody=null);
reject('other customer',x=>x.customerId=id(901));
reject('other invoice',x=>x.approvals[0].invoice_id=id(901));
reject('cross-tenant signed approval',x=>x.approvals[2].company_id=id(902),true);
reject('foreign server receipt',x=>x.sources[1].company_id=id(902));
reject('wrong period',x=>x.sources[3].period_id=id(903));
reject('revoked custody source',x=>x.custody.originalSources[2].revoked=true);
reject('partially settled provider',x=>x.custody.envelopes[2].facts.capture_cents=9000);
reject('missing provider API',x=>x.sources[0].provider_api_verified=false);
reject('missing bank API',x=>x.sources[0].bank_api_verified=false);
reject('refunded settlement',x=>x.sources[0].no_refund_or_dispute=false);
reject('wrong provider net',x=>x.sources[0].exact_net_verified=false);
reject('private HR denied',x=>x.sources[1].private_hr_scope_verified=false);
reject('missing approved time',x=>x.sources[1].timesheet_approved=false);
reject('pretend payroll executed',x=>x.sources[1].executed=true);
reject('tax rate not official',x=>x.sources[2].jurisdiction_rate_verified=false);
reject('tax taxable basis wrong',x=>x.sources[2].period_basis_verified=false);
reject('pretend tax filed',x=>x.sources[2].executed=true);
reject('unbalanced GL',x=>x.sources[3].balanced_gl_verified=false);
reject('unlocked period',x=>x.sources[3].independent_period_lock_verified=false);
reject('pretend close executed',x=>x.sources[3].executed=true);
reject('stale observed source',x=>x.sources[0].observed_at='2026-11-17T13:00:00Z');
reject('replay from ledger',x=>x.usedNonces=[x.approvals[1].nonce]);
reject('duplicate approver',x=>x.approvals[2].actor_id=x.approvals[1].actor_id,true);
reject('duplicate source',x=>x.sources[2].source_id=x.sources[1].source_id);
reject('approval out of order',x=>x.approvals.reverse());
reject('stale issued approval',x=>x.approvals[1].issued_at='2026-11-17T13:00:00Z',true);
reject('future issued approval',x=>x.approvals[1].issued_at='2026-11-17T16:00:00Z',true);
reject('expired approval',x=>x.approvals[2].expires_at='2026-11-17T14:25:00Z',true);
reject('unapproved decision',x=>x.approvals[0].decision='auto_approved',true);
reject('wrong source digest',x=>x.approvals[0].source_digest='a'.repeat(64),true);
reject('stale revision',x=>x.sources[3].revision=2);
reject('invalid signature',x=>x.approvals[2].signature='tampered');
reject('revoked issuer',x=>x.issuers[x.approvals[2].issuer_id].revoked=true);
reject('wrong approval role',x=>x.issuers[x.approvals[1].issuer_id].role='sysop');
reject('missing capability',x=>x.issuers[x.approvals[3].issuer_id].capabilities=[]);
reject('wrong public key',x=>x.issuers[x.approvals[0].issuer_id].public_key_pem=pub(approvalKeys[1]));
reject('unsupported protocol',x=>x.approvals[3].protocol='2.0',true);
reject('duplicate nonce',x=>x.approvals[3].nonce=x.approvals[2].nonce,true);
reject('missing durable ledger',x=>x.durableLedgerProof={registered:false});
reject('staging not isolated',x=>x.stagingAuthority.isolatedVerified=false);
reject('schema mismatch',x=>x.stagingAuthority.schemaParityVerified=false);
assert.ok(cases>=40);
console.log('YW578 four role-separated signed review stages PASS; '+cases+' negative provider, bank, payroll, tax, audit, replay and tenant tests PASS. Live execution OFF.');
