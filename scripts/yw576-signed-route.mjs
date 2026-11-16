/* YW576 deterministic signed ORIGINAL source progression.
 * This function NEVER queries databases, changes Jobs/Dispatch, sends Comms,
 * accepts payments, or vouches for an original source on its own.
 * Pass independently server-verified source rows and registered issuer keys.
 * Do not call this in a browser or treat synthetic test signatures as authority. */
import {createPublicKey,createHash,verify} from 'node:crypto';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const STAGES=Object.freeze([
 ['booking_approved','booking.approve'],
 ['quote_customer_accepted','quote.customer.accepted'],
 ['canonical_job_created','jobs.original.create'],
 ['crew_dispatch_verified','dispatch.original.verify'],
 ['route_workability_rechecked','route.original.safe']
]);
const FIELDS=Object.freeze(['stage','company_id','customer_id','property_id','source_id','source_revision',
 'previous_hash','nonce','issued_at','audience','issuer_id','protocol','original_verified']);
const HOLD=(reason)=>Object.freeze({status:'HOLD',verified:false,reason,canDispatch:false,canBill:false,
  canNotify:false,masterAck:'HOLD',icampAck:'HOLD',commsAck:'HOLD'});
const canonical=(e)=>JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,e?.[k]])));
const digest=(e)=>createHash('sha256').update(canonical(e)).digest('hex');
export function verifySignedJourney576({companyId,customerId,propertyId,envelopes,issuers,originalSources,
 usedNonces=[]}={},now=Date.now()){
 if(![companyId,customerId,propertyId].every(x=>ID.test(x||'')))return HOLD('Missing original tenant, customer or property identity');
 if(!Array.isArray(envelopes)||envelopes.length!==STAGES.length||!Array.isArray(originalSources)||
   !issuers||typeof issuers!=='object'||!Array.isArray(usedNonces)||!Number.isFinite(now))
   return HOLD('Complete original, server-verified evidence is required');
 const nonces=new Set(usedNonces),sources=new Set();
 let previous='GENESIS';
 for(let i=0;i<STAGES.length;i++){
  const e=envelopes[i],step=STAGES[i],registered=issuers[e?.issuer_id],original=originalSources[i];
  if(!e||e.stage!==step[0]||e.company_id!==companyId||e.customer_id!==customerId||
    e.property_id!==propertyId||e.audience!=='YW'||!['1.0','1.1'].includes(e.protocol)||
    e.original_verified!==true||e.previous_hash!==previous||!ID.test(e.source_id||'')||
    !ID.test(e.nonce||'')||!Number.isSafeInteger(e.source_revision)||e.source_revision<1)
    return HOLD('Stage order, tenant, version, audience or original chain invalid: '+step[0]);
  const timestamp=Date.parse(e.issued_at);
  if(!Number.isFinite(timestamp)||timestamp>now+60_000||now-timestamp>4*3600_000)
   return HOLD('Stale or future-dated source: '+step[0]);
  if(nonces.has(e.nonce)||sources.has(e.source_id))
   return HOLD('Replay or duplicated original source');
  nonces.add(e.nonce);sources.add(e.source_id);
  if(!original||original.trusted_server_source!==true||original.company_id!==companyId||
   original.customer_id!==customerId||original.property_id!==propertyId||
   original.source_id!==e.source_id||original.source_revision!==e.source_revision||
   original.stage!==step[0]||original.state_verified!==true||original.revoked===true)
   return HOLD('Independent original source status unavailable: '+step[0]);
  if(!registered||registered.server_enrolled!==true||registered.active!==true||
     registered.company_id!==companyId||registered.audience!=='YW'||registered.provider!=='YW'||
     !Array.isArray(registered.capabilities)||!registered.capabilities.includes(step[1])||
     Date.parse(registered.expires_at)<=now||typeof registered.public_key_pem!=='string')
   return HOLD('Issuer not independently enrolled for exact stage: '+step[0]);
  try{
   const pub=createPublicKey(registered.public_key_pem);
   if(pub.asymmetricKeyType!=='ec'||pub.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
     typeof e.signature!=='string'||!verify('sha256',Buffer.from(canonical(e)),{
       key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(e.signature,'base64url')))
     return HOLD('Invalid signed issuer evidence: '+step[0]);
  }catch{return HOLD('Malformed or invalid signed source: '+step[0]);}
  previous=digest(e);
 }
 return Object.freeze({status:'SOURCE_CHAIN_VERIFIED_ONLY',verified:true,receipt_hash:previous,
  company_id:companyId,stage:STAGES.at(-1)[0],canDispatch:false,canBill:false,canNotify:false,
  masterAck:'HOLD',icampAck:'HOLD',commsAck:'HOLD'});
}
export const YW576Stages=STAGES;
export const YW576Canonical=canonical;
export const YW576Hash=digest;
