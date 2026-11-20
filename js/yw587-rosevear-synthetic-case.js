/* YW587 isolated demonstration for the OWNER-AUTHORIZED Rosevear Landscaping
 * test customer and property (REAL CRM links; FAKE job, attachment and bytes).
 * No Supabase write, no real crew event, never a live proof certificate.
 */
(function(root){'use strict';
 const id=n=>'58700000-0000-4587-8587-'+String(n).padStart(12,'0');
 const company='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
 const originalClient=id(1),originalSite=id(2);
 const digest='779344be249f80dfb6b9c2798c96a496e8aafd752cc20c19f7bee90872c59177';
 function make(now=Date.now()){
  const t=i=>new Date(now-(9-i)*1000).toISOString(),a=id(20),b=id(21),s=id(22),worker=id(23);
  const c=Object.freeze({companyId:company,clientId:originalClient,siteId:originalSite,
   jobId:id(11),attachmentId:id(12),caseId:id(13),deviceId:id(14),
   originalSha256:digest,invoiceCountBefore:0,environment:'synthetic_fixture',
   originalCompanySiteLinked:true,privateStorageRequired:true,
   photoConsentRecorded:true});
  const e=(kind,role,actorId,i,extras={})=>Object.freeze({
   kind,role,actorId,companyId:company,caseId:c.caseId,
   jobId:c.jobId,attachmentId:c.attachmentId,at:t(i),...extras});
  const events=Object.freeze([
   e('crew_photo_pending','crew',a,0,{failureClass:'offline_reconnect',photoState:'pending',
    deviceId:c.deviceId,retryEventId:id(15)}),
   e('dispatcher_case_opened','dispatcher',b,1,{ownerRole:'tenant_dispatcher',
    nextUpdateAt:new Date(now+3600000).toISOString()}),
   e('shell_incident_ack','shell_support',s,2,{summaryScope:'redacted_technical_only',
    photoBytesIncluded:false,customerDetailsIncluded:false,tenantAccountingIncluded:false}),
   e('shell_fault_diagnosed','shell_support',s,3,{detectedSource:'tenant_attachment_retry',
    affectedDevices:1,lastDeviceContactAt:t(1),lastUploadAttemptAt:t(2)}),
   e('support_retry_requested','shell_support',s,4,{retryEventId:id(15),
    idempotency:'enforced',reusesOriginalAttachment:true,createsNewPhoto:false}),
   e('private_photo_receipt','storage_worker',worker,5,{attachmentSha256:digest,
    privateBucketConfirmed:true,serverHashVerified:true,tenantIdVerified:company,
    storageObjectCount:1,actualBytesReviewed:true}),
   e('crew_photo_visible','crew',a,6,{visiblePhotoCount:1,jobCount:1}),
   e('dispatcher_recovery_confirmed','dispatcher',b,7,{invoiceCountAfter:0,
    jobCountAfter:1,confirmedOriginalJob:true,tenantCaseAccepted:true}),
   e('shell_incident_closed','shell_support',s,8,{tenantDispatcherConfirmed:true,
    supportClosureReason:'restored_original_attachment',
    customerFinancialsAccessed:false})
  ]);
  return Object.freeze({caseRef:c,events,syntheticJobNotInDatabase:true,
   fabricatedPhotoIsOnlyFixtureBytes:true,storageAndCrewNotActuallyContacted:true,
   onlyOriginalClientSiteLinkedInProduction:true});
 }
 const api=Object.freeze({make,companyId:company,clientId:originalClient,siteId:originalSite});
 if(root)root.YW587RosevearFixture=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
