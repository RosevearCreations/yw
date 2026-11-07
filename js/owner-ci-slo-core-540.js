/* Build 540 — browser/Node shared, read-only CI evidence presentation core.
 * A digest detects accidental archive changes; it is NOT a signature or
 * independent proof that a downloaded GitHub report is authentic.
 */
'use strict';
(function(root){
  const REPORT='ywi.build530.ci-runtime-report.v1';
  const ARCHIVE='ywi.build540.ci-slo-owner-archive.v1';
  const MAX_RECORDS=120;
  const MAX_BYTES=1024*1024;
  const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
  const run=value=>Number.isSafeInteger(value)&&value>0;
  const second=value=>value===null||(Number.isSafeInteger(value)&&value>=0&&value<=1000000);
  const delta=value=>value===null||(Number.isSafeInteger(value)&&Math.abs(value)<=1000000);
  const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&value.length<=40;
  const alertCode=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,70}$/.test(value);
  const finite=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
  const metric=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)&&second(object[key])?object[key]:null;
  const change=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)&&delta(object[key])?object[key]:null;
  const allowedStates=['MEETS_OBSERVATIONAL_SLO_BUDGET','REVIEW_OBSERVED_SLO_DRIFT','HOLD_UNVERIFIABLE_SLO'];
  const requiredGates=['Browser regression lane a','Browser regression lane b','Browser regression lane c',
    'source-checks','repository-enforcement','release-source-evidence','release-truth-summary'];
  function assertion(ok,message){if(!ok)throw new Error(message);}
  function validateRecord(record){
    assertion(record&&typeof record==='object'&&!Array.isArray(record),'Missing release evidence record.');
    assertion(run(record.runId)&&sha(record.sha)&&date(record.observedAt),'Invalid original run identity or timestamp.');
    assertion(allowedStates.includes(record.sloState)&&typeof record.trendState==='string'&&record.trendState.length<=80,'Invalid SLO or history state.');
    assertion(Number.isSafeInteger(record.samples)&&record.samples>=0&&record.samples<=6,'Invalid verified release count.');
    assertion(record.runner&&['handoff','setup','stepGap'].every(k=>second(record.runner[k])),'Invalid runner timing evidence.');
    assertion(record.p95&&['handoff','setup','stepGap','source','release'].every(k=>second(record.p95[k])),'Invalid historical P95 evidence.');
    assertion(record.drift&&['source','warm','release'].every(k=>delta(record.drift[k])),'Invalid P95 drift evidence.');
    assertion(Array.isArray(record.alerts)&&record.alerts.length<=30&&record.alerts.every(a=>
      a&&alertCode(a.code)&&finite(a.observedSeconds)&&finite(a.limitSeconds)&&
      finite(a.overSeconds)&&a.observedSeconds-a.limitSeconds===a.overSeconds&&a.overSeconds>0),
      'Invalid original CI alert evidence.');
    assertion(new Set(record.alerts.map(a=>a.code)).size===record.alerts.length,
      'An original Actions release cannot contain duplicate alert codes.');
    if(record.sloState!=='HOLD_UNVERIFIABLE_SLO'){
      assertion(record.samples===6&&record.trendState==='SIX_RELEASE_VERIFIED_TREND',
        'Non-HOLD SLO state requires six distinct verified original releases.');
      assertion(Object.values(record.runner).every(finite)&&Object.values(record.p95).every(finite)&&
        Object.values(record.drift).every(n=>n!==null),'Non-HOLD metrics are incomplete.');
      assertion((record.alerts.length>0)===(record.sloState==='REVIEW_OBSERVED_SLO_DRIFT'),
        'SLO alert state does not match its recorded observations.');
    }
    return record;
  }
  function fromAudit(report){
    assertion(report?.schema===REPORT,'File is not a Build 530–540 post-promotion audit report.');
    assertion(report.exactCurrentMain===true&&sha(report.currentMainSha)&&
      report.current?.status==='VERIFIED_GREEN'&&report.current.headSha===report.currentMainSha,
      'Audit is not verified against its exact current main commit.');
    const b=report.build539;
    assertion(run(report.sourceRunId)&&report.current.runId===report.sourceRunId&&
      b?.currentRunId===report.sourceRunId&&
      b?.state==='EXACT_MAIN_VERIFIED_ORIGINAL_ACTIONS_SCHEDULING',
      'Build 539 exact-run source identity was not verified.');
    assertion(JSON.stringify(b.safeguards?.requiredGates)===JSON.stringify(requiredGates)&&
      b.safeguards.requireExactCurrentMain===true&&b.safeguards.releaseAuthority===false&&
      b.safeguards.gateWaiver===false&&b.safeguards.changesProtectedJobs===false,
      'Original seven-gate source protection evidence is missing or altered.');
    assertion(date(report.observedAt),'Audit timestamp is invalid.');
    assertion(allowedStates.includes(b.sloState)&&
      Number.isSafeInteger(b.verifiedDistinctSamples),'SLO evidence is incomplete.');
    const alerts=(b.alerts??[]).map(item=>({code:item.code,
      observedSeconds:item.observedSeconds,limitSeconds:item.limitSeconds,overSeconds:item.overSeconds}));
    const record={runId:report.sourceRunId,sha:report.currentMainSha,
      observedAt:report.observedAt,sloState:b.sloState,trendState:b.trendState,
      samples:b.verifiedDistinctSamples,
      runner:{handoff:metric(b.current,'handoffSeconds'),setup:metric(b.current,'setupSeconds'),
        stepGap:metric(b.current,'interStepGapSeconds')},
      p95:{handoff:metric(b.historicalP95,'runnerHandoffSeconds'),
        setup:metric(b.historicalP95,'runnerSetupSeconds'),
        stepGap:metric(b.historicalP95,'sourceStepGapSeconds'),
        source:metric(b.historicalP95,'sourceSeconds'),
        release:metric(b.historicalP95,'releaseSeconds')},
      drift:{source:change(b.cohorts?.metrics?.sourceSeconds,'increaseSeconds'),
        warm:change(b.cohorts?.metrics?.warmSeconds,'increaseSeconds'),
        release:change(b.cohorts?.metrics?.releaseSeconds,'increaseSeconds')},
      alerts};
    return validateRecord(record);
  }
  function mergeRecords(existing,incoming){
    assertion(Array.isArray(existing)&&Array.isArray(incoming),'Evidence records must be arrays.');
    const byRun=new Map(),bySha=new Map();
    for(const record of [...existing,...incoming]){
      validateRecord(record);
      const old=byRun.get(record.runId);
      assertion(!old||JSON.stringify(old)===JSON.stringify(record),
        'Conflicting evidence for the same Actions run; no earlier record was overwritten.');
      assertion(!bySha.has(record.sha)||bySha.get(record.sha)===record.runId,
        'Different run identities reuse a commit SHA; distinct release proof is required.');
      byRun.set(record.runId,record);bySha.set(record.sha,record.runId);
    }
    assertion(byRun.size<=MAX_RECORDS,'Archive capacity reached. Export and preserve this archive before beginning a new review period.');
    return [...byRun.values()].sort((a,b)=>b.runId-a.runId);
  }
  function dedupeAlerts(records,windowSize=6){
    assertion(Number.isSafeInteger(windowSize)&&windowSize>=1&&windowSize<=MAX_RECORDS,'Invalid rolling window.');
    const latest=mergeRecords([],records).slice(0,windowSize);
    const byCode=new Map();
    for(const record of latest){
      for(const a of record.alerts){
        const group=byCode.get(a.code)??{code:a.code,occurrences:0,firstRunId:record.runId,
          latestRunId:record.runId,maxOverSeconds:0};
        if(group.latestRunId<record.runId)group.latestRunId=record.runId;
        if(group.firstRunId>record.runId)group.firstRunId=record.runId;
        group.occurrences++;
        group.maxOverSeconds=Math.max(group.maxOverSeconds,a.overSeconds);
        byCode.set(a.code,group);
      }
    }
    return [...byCode.values()].map(x=>({...x,repeatState:x.occurrences>=2?'REPEATED':'FIRST_OBSERVATION'}))
      .sort((a,b)=>b.occurrences-a.occurrences||a.code.localeCompare(b.code));
  }
  const archivePayload=records=>({schema:ARCHIVE,records:mergeRecords([],records)});
  async function digest(payload){
    assertion(root.crypto?.subtle,'SHA-256 integrity support is unavailable.');
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    const hash=await root.crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function sealArchive(records,generatedAt=new Date().toISOString()){
    assertion(date(generatedAt),'Invalid archive timestamp.');
    const payload=archivePayload(records);
    return {...payload,generatedAt,integrity:{algorithm:'SHA-256',
      payloadDigest:await digest(payload)},
      authority:'OWNER_PORTABLE_COPY_NOT_INDEPENDENT_SOURCE_SIGNATURE'};
  }
  async function openArchive(value){
    assertion(value?.schema===ARCHIVE&&Array.isArray(value.records)&&value.records.length<=MAX_RECORDS,
      'Not a supported bounded Yard Workers owner archive.');
    assertion(date(value.generatedAt)&&value.integrity?.algorithm==='SHA-256'&&
      /^[a-f0-9]{64}$/.test(value.integrity.payloadDigest),'Archive integrity receipt is incomplete.');
    const payload=archivePayload(value.records);
    assertion(await digest(payload)===value.integrity.payloadDigest,
      'Archive digest mismatch; no records imported.');
    return payload.records;
  }
  root.YWICiSloCore540={REPORT,ARCHIVE,MAX_BYTES,MAX_RECORDS,fromAudit,validateRecord,
    mergeRecords,dedupeAlerts,sealArchive,openArchive};
})(globalThis);
