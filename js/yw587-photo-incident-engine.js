/* YW587 — deterministic REDACTED missing-photo incident support loop.
 * No network, storage, payments, job mutation, customer PII, or accepted live claims.
 * Production data must be corroborated by independently authenticated tenant
 * receipts, original storage hash, and dispatcher confirmation.
 */
(function(root){'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const SHA=/^[0-9a-f]{64}$/i;
 const EVENTS=Object.freeze(['crew_photo_pending','dispatcher_case_opened','shell_incident_ack',
  'shell_fault_diagnosed','support_retry_requested','private_photo_receipt',
  'crew_photo_visible','dispatcher_recovery_confirmed','shell_incident_closed']);
 const ROLES=Object.freeze(['crew','dispatcher','shell_support','shell_support','shell_support',
  'storage_worker','crew','dispatcher','shell_support']);
 const failures=new Set(['upload_timeout','offline_reconnect','storage_permission_denied',
  'processing_delay','hash_mismatch','unknown']);
 const goodId=s=>typeof s==='string'&&UUID.test(s);
 const goodDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
 const fail=(reason,index)=>Object.freeze({state:'HOLD',reason,failedAt:index??null,
  stepsVerified:Math.max(0,index||0),livePhotoAccepted:false,
  liveShellOperational:false,liveTelemetryAck:false});
 function validateCase(c){
  return !!c&&goodId(c.companyId)&&goodId(c.clientId)&&goodId(c.siteId)&&
   goodId(c.jobId)&&goodId(c.attachmentId)&&goodId(c.caseId)&&
   goodId(c.deviceId)&&SHA.test(c.originalSha256||'')&&
   Number.isSafeInteger(c.invoiceCountBefore)&&c.invoiceCountBefore>=0&&
   typeof c.environment==='string'&&['synthetic_fixture','independent_staging'].includes(c.environment)&&
   c.originalCompanySiteLinked===true&&c.privateStorageRequired===true&&
   c.photoConsentRecorded===true;
 }
 function inspect(events,caseRef,{now=Date.now(),maximumAgeHours=72}={}){
  if(!validateCase(caseRef)||!Array.isArray(events)||events.length>EVENTS.length||
     !Number.isFinite(now)||maximumAgeHours<=0||maximumAgeHours>168)return fail('Invalid case identity, consent, source or time',0);
  if(!events.length)return Object.freeze({state:'NOT_REPORTED',stepsVerified:0,livePhotoAccepted:false,
   liveShellOperational:false,liveTelemetryAck:false});
  let previous=0,initial=0;
  const actors={};
  for(let i=0;i<events.length;i++){
   const x=events[i],time=Date.parse(x?.at);
   if(!x||x.kind!==EVENTS[i]||x.role!==ROLES[i]||
      x.companyId!==caseRef.companyId||x.caseId!==caseRef.caseId||
      x.jobId!==caseRef.jobId||x.attachmentId!==caseRef.attachmentId||
      !goodId(x.actorId)||!goodDate(x.at)||time<previous||
      time>now+60000||i===0&&now-time>maximumAgeHours*3600000)
     return fail('Out of order, foreign, expired or unauthorized incident event',i);
   if(i===0){initial=time;if(!failures.has(x.failureClass)||x.photoState!=='pending'||
     x.deviceId!==caseRef.deviceId||!goodId(x.retryEventId))
     return fail('Crew report must identify original pending attachment and retry event',i);
     actors.crew=x.actorId;actors.initialRetryEventId=x.retryEventId;}
   if(i===1){if(x.actorId===actors.crew||x.ownerRole!=='tenant_dispatcher'||
      !goodDate(x.nextUpdateAt)||Date.parse(x.nextUpdateAt)<=time)
      return fail('Dispatcher must assign the tenant case and next update',i);
     actors.dispatcher=x.actorId;}
   if(i===2){if(x.actorId===actors.crew||x.actorId===actors.dispatcher||
      x.summaryScope!=='redacted_technical_only'||x.photoBytesIncluded!==false||
      x.customerDetailsIncluded!==false||x.tenantAccountingIncluded!==false)
      return fail('Shell can only receive redacted operational metadata',i);
     actors.support=x.actorId;}
   if(i===3){if(x.actorId!==actors.support||
     !goodDate(x.lastDeviceContactAt)||!goodDate(x.lastUploadAttemptAt)||
     x.detectedSource!=='tenant_attachment_retry'||!Number.isSafeInteger(x.affectedDevices)||
     x.affectedDevices<1||x.affectedDevices>1000)
      return fail('Shell diagnosis must identify source and affected devices',i);}
   if(i===4){if(x.actorId!==actors.support||
      x.retryEventId!==actors.initialRetryEventId||x.idempotency==='disabled'||
      x.reusesOriginalAttachment!==true||x.createsNewPhoto!==false)
      return fail('Support retry must be same logical original attachment',i);}
   if(i===5){if(x.attachmentSha256!==caseRef.originalSha256||
      x.privateBucketConfirmed!==true||x.serverHashVerified!==true||
      x.tenantIdVerified!==caseRef.companyId||x.storageObjectCount!==1||
      x.attachmentId!==caseRef.attachmentId||x.actualBytesReviewed!==true)
      return fail('Original private photo bytes, hash and one-object custody missing',i);}
   if(i===6){if(x.actorId!==actors.crew||x.visiblePhotoCount!==1||
     x.jobCount!==1)return fail('Crew must see one photo on the original job',i);}
   if(i===7){if(x.actorId!==actors.dispatcher||
     x.invoiceCountAfter!==caseRef.invoiceCountBefore||
     x.jobCountAfter!==1||x.confirmedOriginalJob!==true||
     x.tenantCaseAccepted!==true)return fail('Dispatcher must confirm no duplicate job or invoice',i);}
   if(i===8){if(x.actorId!==actors.support||x.tenantDispatcherConfirmed!==true||
      x.supportClosureReason!=='restored_original_attachment'||
      x.customerFinancialsAccessed!==false)
      return fail('Shell closure requires independent tenant confirmation',i);}
   previous=time;
  }
  const elapsed=Math.max(0,(previous-initial)/1000);
  const complete=events.length===EVENTS.length;
  return Object.freeze({state:complete?'REHEARSAL_CLOSED':'REHEARSAL_IN_PROGRESS',
   caseId:caseRef.caseId,companyId:caseRef.companyId,jobRef:caseRef.jobId,
   stepsVerified:events.length,
   oldestPendingSeconds:complete?0:Math.max(0,(now-initial)/1000),
   restoreSeconds:complete?elapsed:null,
   failureAttempts:events.some(x=>x.kind==='crew_photo_pending')?1:0,
   affectedDevices:events.find(x=>x.kind==='shell_fault_diagnosed')?.affectedDevices??null,
   photoCount:complete?1:null,invoiceCountUnchanged:complete,
   livePhotoAccepted:false,liveShellOperational:false,liveTelemetryAck:false,
   productionEvidenceMissing:true,
   sampleWindow:'synthetic_fixture_only',
   latestEvidenceAt:new Date(previous).toISOString()});
 }
 function redactedShellReceipt(result){
  if(!result||!['REHEARSAL_CLOSED','REHEARSAL_IN_PROGRESS'].includes(result.state))
   return fail('Insufficient trusted case packet',0);
  return Object.freeze({type:'yw.support.attachment_failure.v1',source:'yard_workers',
   tenant_reference:result.companyId,anonymous_job_reference:result.jobRef,
   incident_reference:result.caseId,case_state:result.state,
   failed_upload_attempts:result.failureAttempts,affected_devices:result.affectedDevices,
   oldest_pending_seconds:result.oldestPendingSeconds,
   last_signal_at:result.latestEvidenceAt,observation_window:result.sampleWindow,
   photos_included:false,customer_details_included:false,
   financials_included:false,master_ack_received:false,
   outbound_enabled:false});
 }
 const api=Object.freeze({EVENTS,ROLES,validateCase,inspect,redactedShellReceipt});
 if(root)root.YW587PhotoSupport=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
