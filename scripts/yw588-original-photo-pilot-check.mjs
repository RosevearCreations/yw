import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync('js/yw588-pilot-evidence.js','utf8'),{window});
const v=window.YW588Evidence,company=v.companyId,client=v.clientId,site=v.siteId;
const id=n=>'58800000-0000-4588-8588-'+String(n).padStart(12,'0');
const p={company_id:company,client_id:client,legacy_unscoped_excluded:true,
 history_limit_per_type:80,properties:[{id:site,name:'TEST ONLY'}],
 work_orders:[{id:id(1),property_id:site,service:'landscape',status:'draft'}]};
assert.equal(v.originalHistory(p).state,'ORIGINAL_JOB_READBACK');
assert.equal(v.originalHistory({...p,company_id:id(40)}).state,'HOLD');
assert.equal(v.originalHistory({...p,work_orders:[]}).state,'HOLD');
assert.equal(v.originalHistory({...p,work_orders:[...p.work_orders,...p.work_orders]}).state,'HOLD');
assert.equal(v.originalHistory({...p,properties:[]}).state,'HOLD');
const e={companyId:company,clientId:client,siteId:site,jobId:id(1),
 originalLinkVerified:true,originalJobReadback:true,originalJobCount:1,
 service:'landscape',serviceEntitlementAccepted:true,amountCharged:0,
 customerNotified:false,
 photo:{id:id(2),companyId:company,jobId:id(1),bucket:v.bucket,isPrivate:true,
  reportedSha256:'a'.repeat(64),consentScope:'job_documentation',consentRecorded:true,
  storageObjectCount:1,publicUrlIncluded:false},
 integrity:{photoId:id(2),jobId:id(1),companyId:company,observedSha256:'a'.repeat(64),
  verifiedMatch:true,serverReadBytes:true,observedBytes:200,workerReceiptReference:'independent-rec-01'},
 crew:{actorId:id(3),companyId:company,jobId:id(1),photoId:id(2),
  visiblePhotoCount:1,originalDeviceWitnessed:true,observedAt:'2026-11-22T12:00:00Z'},
 dispatcher:{actorId:id(4),companyId:company,jobId:id(1),originalJobCountAfter:1,
  photoCountAfter:1,invoiceCountBefore:0,invoiceCountAfter:0,confirmed:true,
  confirmedAt:'2026-11-22T12:01:00Z'},
 caseId:id(5),shell:{actorId:id(6),caseId:id(5),tenantDispatcherConfirmed:true,
  closedAfterDispatcher:true,customerDetailsIncluded:false,tenantFinancialsIncluded:false,
  photoBytesIncluded:false,source:'redacted_platform_case'}
};
const good=v.inspect(e);
assert.equal(good.state,'SOURCE_EVIDENCE_REVIEW_READY');
assert.equal(good.liveAccepted,false,'never self-certify a live receipt from browser');
assert.equal(good.autoClosesIncident,false);
const deny=(name,x)=>assert.equal(v.inspect(x).state,'HOLD',name);
deny('tenant mismatch',{...e,companyId:id(70)});
deny('customer mismatch',{...e,clientId:id(71)});
deny('property mismatch',{...e,siteId:id(72)});
deny('foreign job',{...e,originalJobReadback:false});
deny('two jobs',{...e,originalJobCount:2});
deny('disabled service',{...e,serviceEntitlementAccepted:false});
deny('charged demo',{...e,amountCharged:1});
deny('unexpected customer notice',{...e,customerNotified:true});
deny('public bucket',{...e,photo:{...e.photo,isPrivate:false}});
deny('public link',{...e,photo:{...e.photo,publicUrlIncluded:true}});
deny('two stored photos',{...e,photo:{...e.photo,storageObjectCount:2}});
deny('foreign attachment',{...e,photo:{...e.photo,jobId:id(60)}});
deny('no consent',{...e,photo:{...e.photo,consentRecorded:false}});
deny('client hash only',{...e,integrity:{...e.integrity,serverReadBytes:false}});
deny('wrong bytes',{...e,integrity:{...e.integrity,observedSha256:'b'.repeat(64)}});
deny('invalid byte count',{...e,integrity:{...e.integrity,observedBytes:0}});
deny('missing worker receipt',{...e,integrity:{...e.integrity,workerReceiptReference:''}});
deny('fake crew device',{...e,crew:{...e.crew,originalDeviceWitnessed:false}});
deny('duplicate photo seen',{...e,crew:{...e.crew,visiblePhotoCount:2}});
deny('dispatcher same as crew',{...e,dispatcher:{...e.dispatcher,actorId:id(3)}});
deny('invoice duplicated',{...e,dispatcher:{...e.dispatcher,invoiceCountAfter:1}});
deny('dispatcher predated crew',{...e,dispatcher:{...e.dispatcher,confirmedAt:'2026-11-22T11:50:00Z'}});
deny('shell closes before dispatcher',{...e,shell:{...e.shell,closedAfterDispatcher:false}});
deny('shell leaks PII',{...e,shell:{...e.shell,customerDetailsIncluded:true}});
deny('shell leaks money',{...e,shell:{...e.shell,tenantFinancialsIncluded:true}});
deny('shell leaks bytes',{...e,shell:{...e.shell,photoBytesIncluded:true}});
deny('shell same actor as crew',{...e,shell:{...e.shell,actorId:id(3)}});
const base={verifiedPlatformServerReceipt:true,source:'ywi_rpc_shell_photo_summary_588',
 openCount:1,closedCount:0,containsCustomerData:false,
 containsFinancialData:false,containsPhotoBytes:false};
const shell=v.shellReceipt(base);
assert.equal(shell.openCount,1);
assert.equal(shell.customerDetailsIncluded,false);
assert.equal(shell.liveAccepted,false);
assert.equal(v.shellReceipt({...base,containsCustomerData:true}).state,'HOLD');
assert.equal(v.shellReceipt({...base,closedCount:-1}).state,'HOLD');
assert.equal(v.shellReceipt({...base,verifiedPlatformServerReceipt:false}).state,'HOLD');
for(const f of ['public/admin-shell.html','public/yw588-pilot.css','js/yw588-pilot-workspace.js']){
 assert.ok(readFileSync(f,'utf8').length>100,'staged source missing '+f);
}
console.log('YW588 PASS: real original-record readback, private custody predicates, distinct dispatcher, redacted vendor Shell, fail closed; no live claim.');
