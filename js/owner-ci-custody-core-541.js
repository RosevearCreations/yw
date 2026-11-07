/* Build 541 — browser/Node shared evidence readback and SLO review.
 * Byte matches detect changes between owner-selected copies. Neither a hash
 * nor a manual checkbox proves independent custody or GitHub issuer identity.
 */
'use strict';
(function(root){
  const prior=root.YWICiSloCore540;
  if(!prior)throw Error('Build 540 CI archive verifier is required.');
  const CHECKPOINT='ywi.build541.ci-custody-checkpoint.v1';
  const REVIEW='ywi.build541.owner-ci-custody-review.v1';
  const MAX=prior.MAX_BYTES;
  const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
  const timestamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&s.length<=40;
  function require(ok,message){if(!ok)throw Error(message);}
  async function digest(text){
    require(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX,'Invalid or oversized evidence file.');
    require(root.crypto?.subtle,'SHA-256 support is required.');
    const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const json=text=>{require(typeof text==='string'&&text.length>0&&text.length<=MAX,'Missing or oversized JSON evidence.');return JSON.parse(text);};
  const archiveText=obj=>JSON.stringify(obj,null,2)+'\n';
  function checkCheckpoint(value,original){
    require(value?.schema===CHECKPOINT&&value.state==='SECOND_COPY_READBACK_REQUIRED'&&
      value.originalActionsRunId===original.runId&&value.originalMainSha===original.sha&&
      value.originalAuditFileSha256===original.auditDigest&&
      value.ownerArchiveFileSha256===original.archiveDigest&&
      value.originalRetentionReceiptSha256===original.receiptDigest&&
      value.archivePayloadSha256===original.payloadDigest&&
      value.githubActionsArtifactRetentionDays===30&&
      timestamp(value.estimatedArtifactExpiryAt)&&
      value.independentSourceSignatureVerified===false&&
      value.independentArchiveCustodyVerified===false&&
      value.productionMutation===false&&value.protectedGateWaiver===false,
      'Independent custody checkpoint source/digest/authority mismatch.');
    return value;
  }
  async function verifyBundle({auditRaw,archiveRaw,receiptRaw,checkpointRaw}){
    const audit=json(auditRaw),archive=json(archiveRaw),receipt=json(receiptRaw);
    const record=prior.fromAudit(audit);
    const stored=await prior.openArchive(archive);
    require(stored.length===1&&JSON.stringify(stored[0])===JSON.stringify(record),
      'Original Actions audit does not match the owner archive record.');
    const [auditDigest,archiveDigest,receiptDigest]=await Promise.all([
      digest(auditRaw),digest(archiveRaw),digest(receiptRaw)]);
    require(receipt?.schema==='ywi.build540.ci-slo-retention-receipt.v1'&&
      receipt.originalActionsRunId===record.runId&&receipt.originalMainSha===record.sha&&
      receipt.originalAuditFileSha256===auditDigest&&
      receipt.ownerArchiveFileSha256===archiveDigest&&
      receipt.archivePayloadSha256===archive.integrity.payloadDigest&&
      receipt.artifactRetentionDays===30&&receipt.longTermOwnerExportRequired===true&&
      receipt.independentArchiveCustodyVerified===false&&
      receipt.independentSourceSignatureVerified===false&&
      receipt.productionMutation===false&&receipt.protectedGateWaiver===false,
      'Original audit, archive and retention receipt are inconsistent.');
    const original={runId:record.runId,sha:record.sha,auditDigest,archiveDigest,receiptDigest,
      payloadDigest:archive.integrity.payloadDigest};
    const checkpoint=checkpointRaw===undefined?null:checkCheckpoint(json(checkpointRaw),original);
    return {record,original,checkpoint,archiveRaw,
      status:checkpoint?'THREE_FILES_AND_CHECKPOINT_BYTES_MATCH':'THREE_FILES_MATCH_CHECKPOINT_NOT_IMPORTED',
      independentCustodyVerified:false,independentSourceSignatureVerified:false};
  }
  async function compareIndependentCopy(bundle,secondCopyRaw){
    require(bundle?.original?.archiveDigest&&typeof secondCopyRaw==='string',
      'Verify the original source bundle before second-copy readback.');
    require((await digest(secondCopyRaw))===bundle.original.archiveDigest,
      'Second owner-selected copy differs from the archived original bytes.');
    const archive=json(secondCopyRaw);
    const stored=await prior.openArchive(archive);
    require(stored.length===1&&stored[0].runId===bundle.record.runId&&
      stored[0].sha===bundle.record.sha,'Second copy belongs to a different release.');
    return {state:'SECOND_COPY_BYTES_MATCH_OWNER_ASSERTION_REQUIRED',
      bytesMatch:true,independentCustodyVerified:false,sha256:bundle.original.archiveDigest};
  }
  const ACTIONS=['ACKNOWLEDGED','INVESTIGATING','CLOSURE_REVIEW_REQUESTED'];
  function alertLifecycle(records,decisions=[]){
    require(Array.isArray(decisions)&&decisions.length<=30&&decisions.every(d=>
      d&&typeof d.code==='string'&&ACTIONS.includes(d.action)),'Invalid owner alert review.');
    const ordered=prior.mergeRecords([],records);
    const latest=ordered[0];
    return prior.dedupeAlerts(ordered,6).map(group=>{
      const hasNow=latest?.alerts.some(a=>a.code===group.code)??false;
      const newerClean=ordered.filter(r=>r.runId>group.latestRunId&&
        !r.alerts.some(a=>a.code===group.code)).length;
      const observedState=hasNow?'ACTIVE_IN_LATEST_IMPORTED_RELEASE':
        newerClean>=2?'TWO_LATER_IMPORTED_RELEASES_CLEARANCE_CANDIDATE':
          'PRIOR_ALERT_FRESH_RECHECK_REQUIRED';
      const action=decisions.find(d=>d.code===group.code)?.action??'UNREVIEWED';
      return {...group,observedState,ownerAction:action,externallyVerifiedClosed:false};
    });
  }
  async function sealOwnerReview(bundle,{copyCompared=false,ownerAcknowledged=false,
    alertDecisions=[],records=[bundle?.record]}={},now=new Date().toISOString()){
    require(bundle?.checkpoint?.schema===CHECKPOINT&&copyCompared===true&&ownerAcknowledged===true,
      'Four-file source readback, matching second copy and explicit owner renewal review are required.');
    require(timestamp(now),'Invalid owner review time.');
    const originalRecords=prior.mergeRecords([],records);
    require(originalRecords.some(r=>r.runId===bundle.record.runId&&r.sha===bundle.record.sha),
      'Owner review lacks its original evidence record.');
    const alerts=alertLifecycle(originalRecords,alertDecisions);
    require(alertDecisions.every(d=>alerts.some(a=>a.code===d.code)),
      'Owner alert decision is not attached to an observed source alert.');
    require(new Set(alertDecisions.map(d=>d.code)).size===alertDecisions.length,
      'Duplicate alert owner action.');
    const payload={schema:REVIEW,originalActionsRunId:bundle.record.runId,
      originalMainSha:bundle.record.sha,originalArchiveSha256:bundle.original.archiveDigest,
      originalCheckpointSha256:await digest(archiveText(bundle.checkpoint)),
      ownerReviewedAt:now,nextOwnerReviewAfter:new Date(Date.parse(now)+30*86400000).toISOString(),
      originalGitHubArtifactExpiryUnchanged:true,
      secondCopyBytesMatched:true,ownerConfirmedSeparateCustody:true,
      independentSourceSignatureVerified:false,independentCustodyVerified:false,
      originalAlertStates:alerts.map(a=>({code:a.code,state:a.observedState,ownerAction:a.ownerAction,
        externallyVerifiedClosed:false})),productionMutation:false,protectedGateWaiver:false};
    return {...payload,integrity:{algorithm:'SHA-256',payloadDigest:await digest(JSON.stringify(payload))}};
  }
  async function openOwnerReview(value,bundle){
    require(value?.schema===REVIEW&&value.integrity?.algorithm==='SHA-256'&&
      sha(value.integrity.payloadDigest),'Invalid owner review digest.');
    const {integrity,...payload}=value;
    require((await digest(JSON.stringify(payload)))===integrity.payloadDigest,
      'Owner review was changed after export.');
    require(bundle?.record?.runId===value.originalActionsRunId&&
      bundle.record.sha===value.originalMainSha&&
      bundle.original.archiveDigest===value.originalArchiveSha256&&
      value.independentCustodyVerified===false&&value.independentSourceSignatureVerified===false&&
      value.productionMutation===false&&value.protectedGateWaiver===false,
      'Owner review identity or original authority was altered.');
    return value;
  }
  root.YWICiCustodyCore541={CHECKPOINT,REVIEW,MAX,digest,verifyBundle,compareIndependentCopy,
    alertLifecycle,sealOwnerReview,openOwnerReview};
})(globalThis);
