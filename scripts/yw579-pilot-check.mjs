import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {inspectFinancialPilot579,canonicalYW579,hashYW579,YW579ReviewRoles} from './yw579-provider-pilot.mjs';
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const sha=x=>createHash('sha256').update(x).digest('hex');
const now=Date.parse('2026-11-17T16:00:00Z');
const companyId=uuid(1),invoiceId=uuid(2),periodId=uuid(3);
const keys=YW579ReviewRoles.map(()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'}));
const publicPem=x=>x.publicKey.export({type:'spki',format:'pem'});
function make(){
 const receipt={state:'SIGNED_REVIEW_PACKET_ONLY',sourceOnly:true,externallyActivated:false,
  approvalHash:sha('original YW578 review packet')};
 const enrollment={company_id:companyId,environment:'sandbox',production_live_enabled:false,
  original_provider_api_verified:true,owner_verified:true,revoked:false,
  provider_registration_id:uuid(10),provider_account_fingerprint:sha('provider account'),
  verified_at:'2026-11-17T15:59:00Z'};
 const settlement={company_id:companyId,invoice_id:invoiceId,period_id:periodId,
  provider_event_id:uuid(20),currency:'CAD',settled:true,
  original_provider_api_verified:true,independent_bank_api_verified:true,
  bank_match_final:false,refunds:0,disputes:0,capture_cents:11300,
  fee_cents:300,bank_net_cents:11000,provider_original_hash:sha('provider source'),
  bank_original_hash:sha('bank source'),observed_at:'2026-11-17T15:59:00Z'};
 const staging={environment:'staging',production_mutation_enabled:false,
  separate_project_verified:true,schema_parity_verified:true,
  backup_restore_verified:true,preview_only:true,
  project_ref:'stagingyw579ab',production_ref:'productionyw579',
  checked_at:'2026-11-17T15:59:00Z'};
 const sourceDigest=sha([receipt.approvalHash,enrollment.provider_account_fingerprint,
  settlement.provider_original_hash,settlement.bank_original_hash,staging.project_ref].join('|'));
 const options={companyId,invoiceId,periodId,enrollment,settlement,staging,
  approvals:[],issuers:{},usedNonces:[],yw578Receipt:receipt};
 const resign=()=>{
  for(let i=0;i<options.approvals.length;i++){
   const a=options.approvals[i];
   if(i)a.previous_hash=hashYW579(options.approvals[i-1]);
   a.signature=sign('sha256',Buffer.from(canonicalYW579(a)),
    {key:keys[i].privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  }
 };
 for(let i=0;i<3;i++){
  const role=YW579ReviewRoles[i],actorId=uuid(50+i),issuerId=uuid(70+i);
  const approval={role,company_id:companyId,invoice_id:invoiceId,period_id:periodId,
   actor_id:actorId,issuer_id:issuerId,key_id:'issuer-'+i,source_digest:sourceDigest,
   issued_at:'2026-11-17T15:58:00Z',expires_at:'2026-11-17T16:00:30Z',
   nonce:uuid(90+i),previous_hash:'GENESIS',decision:'staging_review_only',
   protocol:i%2?'1.0':'1.1'};
  options.approvals.push(approval);
  options.issuers[issuerId]={server_enrolled:true,active:true,revoked:false,
   company_id:companyId,actor_id:actorId,role,key_id:'issuer-'+i,
   audience:'YW',capability:'finance.staging.review.'+role,
   expires_at:'2026-11-17T16:00:30Z',public_key_pem:publicPem(keys[i])};
 }
 resign();return {options,resign};
}
const output=inspectFinancialPilot579(make().options,now);
assert.equal(output.state,'STAGING_SHAPE_REVIEW_ONLY');
assert.equal(output.reviewStages,3);
for(const key of ['originalProviderEnrolled','liveStagingAccepted','canCapture','canPost',
 'canTransfer','canPayPayroll','canFileTax','canClose','canNotify'])assert.equal(output[key],false,key);
for(const key of ['masterAck','commsAck','icampAck'])assert.equal(output[key],'HOLD');
let negative=0;
function reject(name,edit,resign=false){
 const b=make();edit(b.options);
 if(resign)b.resign();
 assert.equal(inspectFinancialPilot579(b.options,now).state,'HOLD',name);negative++;
}
reject('missing owner',x=>x.companyId='wrong');
reject('missing package',x=>x.enrollment=null);
reject('foreign enrollment',x=>x.enrollment.company_id=uuid(99));
reject('live enrollment false claim',x=>x.enrollment.environment='live');
reject('production finance enabled',x=>x.enrollment.production_live_enabled=true);
reject('fake provider api',x=>x.enrollment.original_provider_api_verified=false);
reject('expired provider source',x=>x.enrollment.verified_at='2026-11-17T15:00:00Z');
reject('revoked provider',x=>x.enrollment.revoked=true);
reject('unowned provider',x=>x.enrollment.owner_verified=false);
reject('foreign settlement',x=>x.settlement.company_id=uuid(99));
reject('wrong invoice',x=>x.settlement.invoice_id=uuid(99));
reject('duplicate event invalid id',x=>x.settlement.provider_event_id='invalid');
reject('unsettled charge',x=>x.settlement.settled=false);
reject('provider api not checked',x=>x.settlement.original_provider_api_verified=false);
reject('bank api not checked',x=>x.settlement.independent_bank_api_verified=false);
reject('fake bank final',x=>x.settlement.bank_match_final=true);
reject('partially refunded',x=>x.settlement.refunds=1);
reject('disputed',x=>x.settlement.disputes=1);
reject('bank fee mismatch',x=>x.settlement.bank_net_cents+=1);
reject('stale bank source',x=>x.settlement.observed_at='2026-11-17T15:45:00Z');
reject('production target',x=>x.staging.environment='production');
reject('same staging production project',x=>x.staging.project_ref=x.staging.production_ref);
reject('unsafe staging mutation',x=>x.staging.production_mutation_enabled=true);
reject('missing schema parity',x=>x.staging.schema_parity_verified=false);
reject('missing restore proof',x=>x.staging.backup_restore_verified=false);
reject('no independent staging project',x=>x.staging.separate_project_verified=false);
reject('wrong review decision',x=>x.approvals[0].decision='authorized_live',true);
reject('cross tenant reviewer',x=>x.approvals[1].company_id=uuid(99),true);
reject('wrong review source digest',x=>x.approvals[0].source_digest='a'.repeat(64),true);
reject('wrong reviewer role',x=>x.issuers[x.approvals[0].issuer_id].role='sysop');
reject('actor reused',x=>x.approvals[2].actor_id=x.approvals[1].actor_id,true);
reject('issuer reused',x=>x.approvals[2].issuer_id=x.approvals[1].issuer_id,true);
reject('nonce replay from ledger',x=>x.usedNonces=[x.approvals[1].nonce]);
reject('nonce duplicate',x=>x.approvals[2].nonce=x.approvals[1].nonce,true);
reject('tampered signature',x=>x.approvals[2].signature='tampered');
reject('revoked signer',x=>x.issuers[x.approvals[0].issuer_id].revoked=true);
reject('future approval',x=>x.approvals[1].issued_at='2026-11-17T16:10:00Z',true);
reject('expired signer',x=>x.issuers[x.approvals[2].issuer_id].expires_at='2026-11-17T15:59:00Z');
reject('out of order reviews',x=>x.approvals.reverse());
reject('unproven YW578',x=>x.yw578Receipt=null);
assert.ok(negative>=35);
console.log('YW579 sandbox enrollment, independent bank, staging and role-separated approvals PASS: '+negative+' negative cases. Production financial authority remains OFF.');
