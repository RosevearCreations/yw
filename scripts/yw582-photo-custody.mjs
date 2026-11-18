// YW582: offline/read-only, independently pinned staging and photo verification.
// This module never connects to Supabase, alters data, signs receipts or deletes objects.
import {createHash, createPublicKey, verify} from 'node:crypto';

export const SERVICE_KEYS_582=Object.freeze([
 'landscape','snow_removal','snow_plowing','septic','arboriculture',
 'construction','water_parks','ponds','skateparks'
]);
const uuid=value=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const sha=value=>createHash('sha256').update(value).digest('hex');
const cleanRef=value=>typeof value==='string'&&/^[a-z0-9_-]{6,48}$/.test(value);
const hold=(reason)=>Object.freeze({state:'HOLD',reason,stagingMigrationAccepted:false,
 productionActivation:false,photoReadAllowed:false,retentionDeleteAllowed:false});
const canonical=value=>JSON.stringify(value,(_,v)=>{
 if(v&&typeof v==='object'&&!Array.isArray(v))
  return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)));
 return v;
});
function signatureOk(payload,proof,trust){
 if(!proof||!trust||!uuid(proof.actor_id)||!trust.actor_id||
   proof.actor_id!==trust.actor_id||proof.key_id!==trust.key_id||
   !/^[a-zA-Z0-9_-]{16,512}$/.test(proof.signature||'')||
   typeof trust.public_key_pem!=='string')return false;
 try{
  const key=createPublicKey(trust.public_key_pem);
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
  return verify('sha256',Buffer.from(canonical(payload)),{
   key,dsaEncoding:'ieee-p1363'
  },Buffer.from(proof.signature,'base64url'));
 }catch{return false;}
}

/**
 * Independently pinned, separately signed, non-production staging REVIEW.
 * Passing signatures proves a packet was signed by configured pins; it does
 * NOT independently prove that migrations, restore or RLS tests ran.
 * The pins/production ID are injected out of band; never include trusted keys
 * in the repository or the browser.
 */
export function inspectStagingReview582(packet,{
 expectedStagingProjectRef,productionProjectRef,
 expectedSourceSha,expectedMigrationDigest,
 trustedOwner,trustedReviewer,now=Date.now()
}={}){
 const p=packet?.payload;
 if(!p||!cleanRef(expectedStagingProjectRef)||!cleanRef(productionProjectRef)||
    expectedStagingProjectRef===productionProjectRef||
    p.project_ref!==expectedStagingProjectRef||p.project_ref===productionProjectRef||
    p.environment!=='staging')return hold('Dedicated non-production project not independently pinned');
 if(!/^[0-9a-f]{40}$/.test(expectedSourceSha||'')||p.source_revision!==expectedSourceSha||
    !hex64(expectedMigrationDigest)||p.migration_digest!==expectedMigrationDigest)
  return hold('Exact source or migration digest did not match independent expected value');
 const measured=packet?.measurements;
 if(!measured||measured.project_ref!==p.project_ref||
    measured.source_revision!==p.source_revision||
    measured.migration_digest!==p.migration_digest||
    measured.schema_parity!==true||measured.isolated_project!==true||
    measured.backup_restore_proven!==true||
    measured.production_unmodified!==true||
    measured.bucket_private!==true||
    measured.owner_rls_denials!==true||
    measured.cross_company_denied!==true||
    measured.jobs_revocation_denied!==true||
    measured.consent_denied!==true||
    measured.expiry_denied!==true||
    measured.allowed_module_count!==9||
    measured.photo_replay_denied!==true||
    measured.media_size_type_denied!==true)
  return hold('Measured staging prerequisites or negative checks missing');
 const issued=Date.parse(p.issued_at),expiry=Date.parse(p.expires_at);
 if(!Number.isFinite(issued)||!Number.isFinite(expiry)||!Number.isFinite(now)||
    issued>now+60000||expiry<=now||expiry>issued+4*3600000)
  return hold('Independent review packet time window invalid');
 if(!trustedOwner||!trustedReviewer||trustedOwner.actor_id===trustedReviewer.actor_id||
    trustedOwner.key_id===trustedReviewer.key_id||
    packet.owner?.actor_id===packet.reviewer?.actor_id)
  return hold('Two independent pinned reviewers are required');
 const signed={payload:p,measurements:measured};
 if(!signatureOk(signed,packet.owner,trustedOwner)||
    !signatureOk(signed,packet.reviewer,trustedReviewer))
  return hold('Independent signature or key fingerprint validation failed');
 return Object.freeze({state:'SIGNED_STAGING_REVIEW_PACKET_ONLY',
  projectRef:p.project_ref,serviceCount:9,sourceRevision:p.source_revision,
  migrationDigest:p.migration_digest,reviewedAt:p.issued_at,
  requiresLiveDatabaseReadback:true,stagingMigrationAccepted:false,
  productionActivation:false,photoReadAllowed:false,retentionDeleteAllowed:false});
}

const imageMagic=(bytes,mime)=>{
 if(mime==='image/jpeg')return bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&
  bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
 if(mime==='image/png')return bytes.length>=8&&
  bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/webp')return bytes.length>=12&&
  bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 return false;
};
export function inspectPrivatePhoto582({bytes,record,storage}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>10485760||
  storage?.bucket!=='ywi-private-job-photos-581'||storage?.public!==false||
  record?.consent_scope!=='job_documentation'||record?.consent_recorded!==true||
  !uuid(record?.company_id)||!uuid(record?.job_id)||!uuid(record?.client_id)||
  !uuid(record?.client_site_id)||!SERVICE_KEYS_582.includes(record?.service_key)||
  !hex64(record?.reported_sha256)||!record?.private_object_key||
  !['image/jpeg','image/png','image/webp'].includes(record?.media_type)||
  record.private_object_key!==storage?.path||
  !new RegExp('^'+record.company_id+'/'+record.job_id+
   '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp)$','i')
   .test(record.private_object_key)||
  !imageMagic(bytes,record.media_type))
  return hold('Invalid private object, original-job identity, consent or media envelope');
 const observed=sha(bytes),matched=observed===record.reported_sha256;
 if(!matched)return hold('SHA-256 does not match original reported file digest');
 return Object.freeze({state:'BYTE_HASH_MATCH_LOCAL_ONLY',
  companyId:record.company_id,jobId:record.job_id,sourceDigest:observed,
  length:bytes.length,requiresIndependentServerCustody:true,
  databaseReceiptWritten:false,productionActivation:false,
  photoReadAllowed:false,retentionDeleteAllowed:false});
}

export function planRetention582(records,{now=Date.now()}={}){
 if(!Array.isArray(records)||records.length>500||!Number.isFinite(now))
  return hold('Retention review input invalid or unbounded');
 const review=[],seen=new Set();
 for(const row of records){
  if(!uuid(row?.id)||!uuid(row?.company_id)||!uuid(row?.job_id)||
    !row?.private_object_key||seen.has(row.id)||row.bucket!=='ywi-private-job-photos-581')
   return hold('Foreign, missing or repeated retention identity');
  seen.add(row.id);
  const expiry=Date.parse(row.retained_until);
  if(!Number.isFinite(expiry))return hold('Retention expiry unavailable');
  const reason=row.legal_hold===true?'LEGAL_HOLD':
    row.active_dispute===true?'DISPUTE_HOLD':
    row.integrity_verified!==true?'INTEGRITY_NOT_ATTESTED':
    expiry>now?'NOT_DUE':'REVIEW_EXPIRED';
  review.push(Object.freeze({id:row.id,companyId:row.company_id,reason,
   reviewRequired:reason==='REVIEW_EXPIRED'}));
 }
 return Object.freeze({state:'RETENTION_REVIEW_PLAN_ONLY',
  records:review,reviewCount:review.filter(x=>x.reviewRequired).length,
  autoDelete:false,retentionDeleteAllowed:false,requiresSeparateCustodianApproval:true});
}
