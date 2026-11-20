/* YW587 role-separated recovery review source. Real account recovery requires
 * already enrolled YW585 original customer, independent owner+reviewer,
 * no public email-only lookup, no password/token issuance by this script.
 */
(function(root){'use strict';
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
 const hold=reason=>Object.freeze({state:'HOLD',reason,
  accountRecovered:false,sitePublished:false,customerRecordsExposed:false});
 function inspectRecovery(r,{companyId,originalClientId,ownerId,now=Date.now()}={}){
  if(!r||!uuid(companyId)||!uuid(originalClientId)||!uuid(ownerId)||
    r.companyId!==companyId||r.clientId!==originalClientId||
    !uuid(r.userId)||!uuid(r.ownerId)||r.ownerId!==ownerId||
    !uuid(r.independentReviewerId)||r.independentReviewerId===r.ownerId||
    r.independentReviewerId===r.userId||r.ownerId===r.userId||
    r.original422LinkProven!==true||r.verifiedExistingAuthUser!==true||
    r.recoveryReason!=='lost_access_to_existing_customer_account'||
    r.externalIdentityEvidenceChecked!==true||r.customerConsentRecorded!==true||
    r.oldSessionsRevocationRequired!==true||r.membershipReactivated!==false||
    !sha(r.evidenceDigest)||typeof r.expiresAt!=='string'||
    !Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=now||
    Date.parse(r.expiresAt)>now+86400000||
    r.tenantWorkerCanEditLedger!==false)
    return hold('Original customer, owner and independent identity proof incomplete');
  return Object.freeze({state:'RECOVERY_REVIEW_READY_NOT_ACTIVATED',
   companyId,clientId:originalClientId,
   requiresTrustedServerAction:true,requiresFreshUserAuthentication:true,
   accountRecovered:false,sitePublished:false,customerRecordsExposed:false});
 }
 function inspectTimeline(rows,{companyId,clientId,siteId,actorId,verifiedAuth=false,
    actualOriginalLinks=false,now=Date.now()}={}){
  if(![companyId,clientId,siteId,actorId].every(uuid)||
    !verifiedAuth||!actualOriginalLinks||
    !Array.isArray(rows)||rows.length>20)
    return hold('Original company, user and property access not independently verified');
  const seen=new Set(),safe=[];
  for(const r of rows){
   if(!uuid(r?.jobId)||seen.has(r.jobId)||r.companyId!==companyId||
     r.clientId!==clientId||r.siteId!==siteId||
     r.privatePhotoUrlsIncluded!==false||r.financialDataIncluded!==false||
     !['draft','scheduled','in_progress','completed','followup'].includes(r.status)||
     !Number.isFinite(Date.parse(r.updatedAt))||Date.parse(r.updatedAt)>now+60000)
     return hold('Foreign, duplicated or sensitive original-job timeline item');
   seen.add(r.jobId);safe.push(Object.freeze({jobId:r.jobId,status:r.status,
      updatedAt:r.updatedAt,privatePhotoVerified:false}));
  }
  return Object.freeze({state:'STAGING_SOURCE_TIMELINE_READONLY',
   records:Object.freeze(safe),requiresLiveRLSReadback:true,
   customerRecordsExposed:false,accountRecovered:false,sitePublished:false});
 }
 const api=Object.freeze({inspectRecovery,inspectTimeline});
 if(root)root.YW587OriginalCustomer=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
