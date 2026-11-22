/* YW588 — original-record private photo pilot evidence classifier.
 * This is a client-safe REVIEW aid, not an authority, signature verifier,
 * uploader or an independent certification of live device/storage bytes. */
(function(root){'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const SHA=/^[a-f0-9]{64}$/i;
 const companyId='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
 const clientId='58700000-0000-4587-8587-000000000001';
 const siteId='58700000-0000-4587-8587-000000000002';
 const bucket='ywi-private-job-photos-581';
 const validId=s=>typeof s==='string'&&UUID.test(s);
 const result=(reason,stage=0)=>Object.freeze({state:'HOLD',reason,stage,
   liveAccepted:false,autoClosesIncident:false,financeWrites:false});
 function originalHistory(source){
  if(!source||source.company_id!==companyId||source.client_id!==clientId||
     source.legacy_unscoped_excluded!==true||source.history_limit_per_type!==80||
     !Array.isArray(source.properties)||!Array.isArray(source.work_orders)||
     source.properties.length>100||source.work_orders.length>80)return result('Original YW422 owner-scoped history missing');
  const property=source.properties.find(p=>p.id===siteId);
  if(!property)return result('Original linked TEST ONLY property missing');
  const workOrders=source.work_orders.filter(w=>w.property_id===siteId&&validId(w.id));
  if(workOrders.length>1||new Set(workOrders.map(w=>w.id)).size!==workOrders.length)
   return result('Multiple or repeated original test work orders: manual review required');
  if(!workOrders.length)return result('Original test work order not yet authorized');
  const job=workOrders[0];
  if(job.service!=='landscape'||!job.status)return result('Wrong original service or unrecognized job state');
  return Object.freeze({state:'ORIGINAL_JOB_READBACK',jobId:job.id,service:job.service,
   status:job.status,companyId,clientId,siteId,liveAccepted:false,financeWrites:false});
 }
 function inspect(e){
  if(!e||e.companyId!==companyId||e.clientId!==clientId||e.siteId!==siteId||
     !validId(e.jobId)||e.originalLinkVerified!==true||e.originalJobReadback!==true||
     e.originalJobCount!==1)return result('Original owner/client/property/work-order readback missing');
  if(e.service!=='landscape'||e.serviceEntitlementAccepted!==true||
     e.amountCharged!==0||e.customerNotified!==false)
   return result('Original approved service, zero-charge or private consent gate missing',1);
  if(!e.photo||e.photo.companyId!==companyId||e.photo.jobId!==e.jobId||
     e.photo.bucket!==bucket||e.photo.isPrivate!==true||
     !validId(e.photo.id)||!SHA.test(e.photo.reportedSha256||'')||
     e.photo.consentScope!=='job_documentation'||e.photo.consentRecorded!==true||
     e.photo.storageObjectCount!==1||e.photo.publicUrlIncluded!==false)
   return result('One original private consented photo object/metadata absent',2);
  if(!e.integrity||e.integrity.photoId!==e.photo.id||
     e.integrity.jobId!==e.jobId||e.integrity.companyId!==companyId||
     e.integrity.observedSha256!==e.photo.reportedSha256||
     e.integrity.verifiedMatch!==true||e.integrity.serverReadBytes!==true||
     !Number.isInteger(e.integrity.observedBytes)||e.integrity.observedBytes<16||
     e.integrity.observedBytes>10485760||!e.integrity.workerReceiptReference)
   return result('No independently read original bytes and matching private storage receipt',3);
  const c=e.crew,d=e.dispatcher,s=e.shell;
  if(!c||c.companyId!==companyId||c.jobId!==e.jobId||
     c.photoId!==e.photo.id||c.visiblePhotoCount!==1||
     c.originalDeviceWitnessed!==true||!validId(c.actorId))
   return result('Original device/crew has not witnessed one attached photo',4);
  if(!d||!validId(d.actorId)||d.actorId===c.actorId||
     d.companyId!==companyId||d.jobId!==e.jobId||
     d.originalJobCountAfter!==1||d.photoCountAfter!==1||
     d.invoiceCountAfter!==d.invoiceCountBefore||d.confirmed!==true||
     !Date.parse(d.confirmedAt)||!Date.parse(c.observedAt)||
     Date.parse(d.confirmedAt)<Date.parse(c.observedAt))
   return result('Independent dispatcher and no duplicate invoice/job not verified',5);
  if(!s||!validId(s.actorId)||s.actorId===d.actorId||s.actorId===c.actorId||
     s.caseId!==e.caseId||!validId(s.caseId)||
     s.tenantDispatcherConfirmed!==true||s.closedAfterDispatcher!==true||
     s.customerDetailsIncluded!==false||s.tenantFinancialsIncluded!==false||
     s.photoBytesIncluded!==false||s.source!=='redacted_platform_case')
   return result('Redacted technical Shell closure not independently witnessed',6);
  return Object.freeze({state:'SOURCE_EVIDENCE_REVIEW_READY',stage:7,
   reason:'All seven provided record predicates match; independent server attestation still required',
   liveAccepted:false,autoClosesIncident:false,financeWrites:false,
   requiresOriginalDeviceWitness:true,requiresIndependentlySignedServerReceipt:true});
 }
 function shellReceipt(x){
  if(!x||x.verifiedPlatformServerReceipt!==true||x.source!=='ywi_rpc_shell_photo_summary_588'||
     !Number.isSafeInteger(x.openCount)||x.openCount<0||x.openCount>100000||
     !Number.isSafeInteger(x.closedCount)||x.closedCount<0||x.closedCount>100000||
     x.containsCustomerData!==false||x.containsFinancialData!==false||
     x.containsPhotoBytes!==false)return result('No trusted redacted Sysop incident summary');
  return Object.freeze({source:'yard_workers',caseScope:'redacted_technical_only',
   openCount:x.openCount,closedCount:x.closedCount,
   customerDetailsIncluded:false,photoBytesIncluded:false,tenantFinancialsIncluded:false,
   masterAckVerified:false,liveAccepted:false});
 }
 const api=Object.freeze({companyId,clientId,siteId,bucket,originalHistory,inspect,shellReceipt});
 if(root)root.YW588Evidence=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
