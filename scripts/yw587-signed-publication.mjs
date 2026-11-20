/* YW587 — pinned-key two-person owner publication authorizations.
 * P-256 ECDSA proof is NOT a deployment trigger. No key material, passwords,
 * uploaded photos, invoices or customer records are stored in this module.
 * Trusted owner/reviewer keys must be obtained via independent enrollment,
 * not accepted from an untrusted request packet.
 */
import {createPublicKey,verify as verifySignature,createHash} from 'node:crypto';
const validUuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const fail=reason=>Object.freeze({state:'HOLD',reason,approvedForProduction:false,published:false,customerFinancialAuthority:false});
export function publicationCanonical587(p){
 if(!p||!validUuid(p.tenantId)||!validUuid(p.ownerId)||!validUuid(p.reviewerId)||
    p.ownerId===p.reviewerId||!sha(p.siteContentSha256)||!sha(p.sourceRevisionSha256)||
    !/^[a-z0-9][a-z0-9-]{2,49}$/.test(p.siteSlug||'')||
    !['standard','futuristic','angular','forest','gilded'].includes(p.theme)||
    !/^https:\/\/[a-z0-9][a-z0-9.-]{1,100}$/.test(p.verifiedDomain||'')||
    !Number.isFinite(Date.parse(p.issuedAt))||!Number.isFinite(Date.parse(p.expiresAt)))
  return null;
 return JSON.stringify({
  schema:'yw587.publication-review.v1',tenant_id:p.tenantId,owner_id:p.ownerId,
  reviewer_id:p.reviewerId,site_slug:p.siteSlug,site_sha256:p.siteContentSha256,
  source_sha256:p.sourceRevisionSha256,theme:p.theme,
  verified_domain:p.verifiedDomain,issued_at:p.issuedAt,expires_at:p.expiresAt
 });
}
function verifyP256(publicKeyPem,base64url,payload){
 try{
  if(typeof publicKeyPem!=='string'||typeof base64url!=='string'||
      !/^[A-Za-z0-9_-]{64,256}$/.test(base64url))return false;
  const key=createPublicKey(publicKeyPem);
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
  return verifySignature('sha256',Buffer.from(payload),
    {key,dsaEncoding:'ieee-p1363'},Buffer.from(base64url,'base64url'));
 }catch{return false;}
}
export function inspectPublicationApproval587(packet,{
 tenantId,sourceSha,ownerUserId,reviewerUserId,
 ownerKeyPinned,reviewerKeyPinned,
 independentDomainEvidence=false,independentOwnerActive=false,
 independenceVerified=false,now=Date.now()
}={}){
 const p=packet?.payload,canonical=publicationCanonical587(p);
 if(!validUuid(tenantId)||!validUuid(ownerUserId)||!validUuid(reviewerUserId)||
    tenantId!==p?.tenantId||ownerUserId!==p?.ownerId||
    reviewerUserId!==p?.reviewerId||ownerUserId===reviewerUserId||
    !/^[a-f0-9]{40}$/.test(sourceSha||'')||
    !canonical||!sha(packet?.canonicalDigestSha256)||
    createHash('sha256').update(canonical).digest('hex')!==packet.canonicalDigestSha256||
    p.sourceRevisionSha256!==createHash('sha256').update(sourceSha).digest('hex')||
    !Number.isFinite(now)||Date.parse(p.issuedAt)>now+60000||
    Date.parse(p.expiresAt)<=now||Date.parse(p.expiresAt)>now+86400000||
    independentDomainEvidence!==true||independentOwnerActive!==true||
    independenceVerified!==true||
    packet.reviewerSignedSameDigest!==true||
    packet.publicationAlreadyExecuted===true||
    !verifyP256(ownerKeyPinned,packet.ownerSignatureP1363,canonical)||
    !verifyP256(reviewerKeyPinned,packet.reviewerSignatureP1363,canonical))
  return fail('Independent pinned owner and reviewer P-256 approval absent or expired');
 return Object.freeze({state:'SOURCE_REVIEW_SIGNED_REQUIRES_SEPARATE_PUBLICATION',
  tenantId,contentDigest:p.siteContentSha256,siteSlug:p.siteSlug,
  ownerId:ownerUserId,reviewerId:reviewerUserId,
  approvedForProduction:false,published:false,
  requiresIndependentCurrentDraftReadback:true,
  requiresAuthorizedReleaseOperator:true,
  customerFinancialAuthority:false});
}
