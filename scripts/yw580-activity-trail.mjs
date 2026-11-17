/* YW580 shared activity / evidence lineage: signature-bearing REVIEW packets only.
 * Source APIs must independently verify originals before any claim is trusted. */
import {createHash,createPublicKey,verify} from 'node:crypto';
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/i;
const allowed=new Set(['estimate_review','job_authorized','schedule_review','resource_allocation',
 'photo_evidence','job_completion','maintenance_review','invoice_review','accounting_review']);
const canonicalKeys=['event_id','company_id','customer_id','property_id','job_id',
 'service_key','event_type','source_id','source_revision','source_digest',
 'evidence_digest','consent_verified','retention_checked','actor_id',
 'captured_at','previous_hash','issuer_id','key_id','protocol'];
export const canonicalEvent580=x=>JSON.stringify(Object.fromEntries(canonicalKeys.map(k=>[k,x?.[k]])));
export const eventHash580=x=>createHash('sha256').update(canonicalEvent580(x)+'.'+x.signature).digest('hex');
const hold=reason=>Object.freeze({state:'HOLD',reason,canCreate:false,canLink:false,canPost:false,canDispatch:false,
 canPay:false,canPublish:false,persisted:false,masterAck:'HOLD',commsAck:'HOLD'});
export function inspectActivityTrail580({companyId,customerId,propertyId,jobId,
 serviceKey,events,issuers,usedEventIds=[]}={},now=Date.now()){
 if(![companyId,customerId,propertyId,jobId].every(x=>id.test(x||''))||
    !['landscape','construction','water_parks','snow_removal','snow_plowing','septic',
      'arboriculture','ponds','skateparks'].includes(serviceKey)||!Number.isFinite(now)||
    !Array.isArray(events)||events.length<2||events.length>100||
    !Array.isArray(usedEventIds)||!issuers||typeof issuers!=='object'||Array.isArray(issuers))
  return hold('Original tenant/customer/property/job, service and complete event packet required');
 let prior='GENESIS',revision=0,photoCount=0;
 const seen=new Set(usedEventIds), sources=new Set();
 for(const e of events){
  if(!e||!id.test(e.event_id||'')||!id.test(e.source_id||'')||
     !id.test(e.actor_id||'')||!id.test(e.issuer_id||'')||
     !allowed.has(e.event_type)||e.company_id!==companyId||
     e.customer_id!==customerId||e.property_id!==propertyId||
     e.job_id!==jobId||e.service_key!==serviceKey||
     !Number.isSafeInteger(e.source_revision)||e.source_revision<=0||
     !digest.test(e.source_digest||'')||
     e.previous_hash!==prior||!['1.0','1.1'].includes(e.protocol)||
     typeof e.signature!=='string'||!e.signature)
   return hold('Cross-company, source revision, identity or hash-chain mismatch');
  if(seen.has(e.event_id)||sources.has(e.source_id+':'+e.source_revision))
   return hold('Repeated source event or replay');
  seen.add(e.event_id);sources.add(e.source_id+':'+e.source_revision);
  const date=Date.parse(e.captured_at);
  if(!Number.isFinite(date)||date>now+60000||now-date>7*86400000||
     e.source_revision<revision)
   return hold('Stale or reordered original source observation');
  revision=e.source_revision;
  if(e.event_type==='photo_evidence'){
   if(!digest.test(e.evidence_digest||'')||e.consent_verified!==true||
      e.retention_checked!==true)
    return hold('Photo requires privacy/consent and content digest');
   photoCount++;
  }else if(e.evidence_digest!==null) return hold('Non-photo cannot smuggle a photo evidence digest');
  const issuer=Object.hasOwn(issuers,e.issuer_id)?issuers[e.issuer_id]:null;
  if(!issuer||issuer.server_enrolled!==true||issuer.revoked!==false||
     issuer.company_id!==companyId||issuer.actor_id!==e.actor_id||
     issuer.key_id!==e.key_id||issuer.audience!=='YW'||
     !Array.isArray(issuer.capabilities)||!issuer.capabilities.includes('service.activity.review')||
     typeof issuer.public_key_pem!=='string'||!Number.isFinite(Date.parse(issuer.expires_at))||Date.parse(issuer.expires_at)<=now)
   return hold('Original role-bound source issuer not verified');
  try{
   const key=createPublicKey(issuer.public_key_pem);
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
      !verify('sha256',Buffer.from(canonicalEvent580(e)),{key,dsaEncoding:'ieee-p1363'},
       Buffer.from(e.signature,'base64url')))
    return hold('P-256 source signature mismatch');
  }catch{return hold('Invalid event issuer public key/signature');}
  prior=eventHash580(e);
 }
 if(!photoCount)return hold('Original photo evidence trail missing');
 return Object.freeze({...hold('Signed activity review only: no independent live original source, consent authority or durable ledger validation'),
  state:'SOURCE_SHAPE_REVIEW_ONLY',reviewHash:prior,eventsReviewed:events.length,photosReviewed:photoCount,
  canLink:false,persisted:false});
}
