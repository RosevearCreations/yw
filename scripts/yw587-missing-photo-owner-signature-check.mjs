import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,generateKeyPairSync,sign as signP256} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectPublicationApproval587,publicationCanonical587} from './yw587-signed-publication.mjs';
const require=createRequire(import.meta.url);
const engine=require('../js/yw587-photo-incident-engine.js');
const fake=require('../js/yw587-rosevear-synthetic-case.js');
const recovery=require('../js/yw587-original-customer-recovery.js');
const uuid=n=>'58700000-0000-4587-8587-'+String(n).padStart(12,'0');
let rejects=0,passed=0;
const deny=(reason,x)=>{assert.equal(x.state,'HOLD',reason);rejects++;};
const ok=(condition,name)=>{assert.ok(condition,name);passed++;};
const now=Date.parse('2026-11-20T16:00:00-05:00');
const {caseRef,events,syntheticJobNotInDatabase}=fake.make(now);
ok(syntheticJobNotInDatabase,'synthetic case cannot claim real work_order');
ok(caseRef.companyId===fake.companyId,'case tenant bound');
ok(caseRef.clientId===fake.clientId&&caseRef.siteId===fake.siteId,'original linked sample IDs');
assert.equal(engine.EVENTS.length,9);
for(let i=1;i<=events.length;i++){
 const v=engine.inspect(events.slice(0,i),caseRef,{now});
 assert.equal(v.stepsVerified,i,'step '+i);
 assert.equal(v.state,i===9?'REHEARSAL_CLOSED':'REHEARSAL_IN_PROGRESS');
 assert.equal(v.livePhotoAccepted,false);
 assert.equal(v.liveTelemetryAck,false);
 assert.equal(v.liveShellOperational,false);
}
const closed=engine.inspect(events,caseRef,{now});
ok(closed.restoreSeconds>0,'measured synthetic recovery window');
ok(closed.invoiceCountUnchanged===true&&closed.photoCount===1,'one logical photo and invoice count');
const shell=engine.redactedShellReceipt(closed);
assert.equal(shell.master_ack_received,false);
assert.equal(shell.outbound_enabled,false);
assert.equal(shell.photos_included,false);
assert.equal(shell.customer_details_included,false);
assert.equal(shell.financials_included,false);
ok(!JSON.stringify(shell).includes('service_address')&&!JSON.stringify(shell).includes('billing_email'),'redacted shell payload');
const update=(i,change)=>events.map((x,j)=>i===j?{...x,...change}:x);
for(const [reason,modified,context] of [
 ['foreign tenant',update(2,{companyId:uuid(33)})],
 ['wrong original attachment',update(4,{attachmentId:uuid(34)})],
 ['out-of-order stage',[events[1],events[0],...events.slice(2)]],
 ['crew skipped',[...events.slice(1)]],
 ['bad dispatch owner',update(1,{ownerRole:'shell_support'})],
 ['dispatcher same as crew',update(1,{actorId:events[0].actorId})],
 ['shell leaks photo',update(2,{photoBytesIncluded:true})],
 ['shell leaks finances',update(2,{tenantAccountingIncluded:true})],
 ['shell leaks customer',update(2,{customerDetailsIncluded:true})],
 ['support ownership changed',update(3,{actorId:uuid(80)})],
 ['retry generated a new photo',update(4,{createsNewPhoto:true})],
 ['retry changes event id',update(4,{retryEventId:uuid(81)})],
 ['missing original digest',update(5,{attachmentSha256:'0'.repeat(64)})],
 ['photo not private',update(5,{privateBucketConfirmed:false})],
 ['hash not independently checked',update(5,{serverHashVerified:false})],
 ['bad tenant storage',update(5,{tenantIdVerified:uuid(82)})],
 ['storage duplicates',update(5,{storageObjectCount:2})],
 ['storage bytes absent',update(5,{actualBytesReviewed:false})],
 ['crew sees duplicate',update(6,{visiblePhotoCount:2})],
 ['dispatcher sees wrong original job',update(7,{jobCountAfter:2})],
 ['invoice duplication',update(7,{invoiceCountAfter:1})],
 ['dispatcher not approved',update(7,{tenantCaseAccepted:false})],
 ['shell closed without dispatcher',update(8,{tenantDispatcherConfirmed:false})],
 ['shell accessed accounts',update(8,{customerFinancialsAccessed:true})],
 ['old report',events,{now:now+120*3600000}]
])deny(reason,engine.inspect(modified,caseRef,{now,...context}));
deny('forged original company link',engine.inspect(events,{...caseRef,originalCompanySiteLinked:false},{now}));
deny('unconsented attachment',engine.inspect(events,{...caseRef,photoConsentRecorded:false},{now}));
deny('public photo',engine.inspect(events,{...caseRef,privateStorageRequired:false},{now}));
deny('unrecognized source',engine.inspect(events,{...caseRef,environment:'production'},{now}));
deny('untrusted shell status',engine.redactedShellReceipt({state:'LIVE_GREEN'}));

const recoveryPacket={
 companyId:fake.companyId,clientId:fake.clientId,userId:uuid(30),
 ownerId:uuid(31),independentReviewerId:uuid(32),
 original422LinkProven:true,verifiedExistingAuthUser:true,
 recoveryReason:'lost_access_to_existing_customer_account',
 externalIdentityEvidenceChecked:true,customerConsentRecorded:true,
 oldSessionsRevocationRequired:true,membershipReactivated:false,
 evidenceDigest:'a'.repeat(64),expiresAt:new Date(now+1800000).toISOString(),
 tenantWorkerCanEditLedger:false
};
const recoveryOptions={companyId:fake.companyId,originalClientId:fake.clientId,ownerId:uuid(31),now};
const customer=recovery.inspectRecovery(recoveryPacket,recoveryOptions);
assert.equal(customer.state,'RECOVERY_REVIEW_READY_NOT_ACTIVATED');
assert.equal(customer.accountRecovered,false);
for(const [reason,changes] of [
 ['cross tenant',{companyId:uuid(88)}],['client hijack',{clientId:uuid(89)}],
 ['self-recovery by email',{original422LinkProven:false}],
 ['auth user unverified',{verifiedExistingAuthUser:false}],
 ['self-approved',{independentReviewerId:uuid(31)}],
 ['same actor as reviewer',{independentReviewerId:uuid(30)}],
 ['consent absent',{customerConsentRecorded:false}],
 ['sessions not revoked',{oldSessionsRevocationRequired:false}],
 ['membership auto-active',{membershipReactivated:true}],
 ['financial authority',{tenantWorkerCanEditLedger:true}],
 ['expired',{expiresAt:new Date(now-5000).toISOString()}]
])deny(reason,recovery.inspectRecovery({...recoveryPacket,...changes},recoveryOptions));
const row={jobId:uuid(11),companyId:fake.companyId,clientId:fake.clientId,
 siteId:fake.siteId,status:'completed',updatedAt:new Date(now-30000).toISOString(),
 privatePhotoUrlsIncluded:false,financialDataIncluded:false};
const tOptions={companyId:fake.companyId,clientId:fake.clientId,siteId:fake.siteId,
 actorId:uuid(30),verifiedAuth:true,actualOriginalLinks:true,now};
assert.equal(recovery.inspectTimeline([row],tOptions).state,'STAGING_SOURCE_TIMELINE_READONLY');
for(const [reason,rs,opts] of [
 ['foreign tenant',[{...row,companyId:uuid(90)}],{}],
 ['foreign original property',[{...row,siteId:uuid(91)}],{}],
 ['no auth',[row],{verifiedAuth:false}],
 ['not linked',[row],{actualOriginalLinks:false}],
 ['private URL leak',[{...row,privatePhotoUrlsIncluded:true}],{}],
 ['financial leak',[{...row,financialDataIncluded:true}],{}],
 ['duplicate original job',[row,row],{}]
])deny(reason,recovery.inspectTimeline(rs,{...tOptions,...opts}));

const owner=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),
 reviewer=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const sourceSha='a'.repeat(40),sourceShaDigest=createHash('sha256').update(sourceSha).digest('hex');
const pay={tenantId:fake.companyId,ownerId:uuid(31),reviewerId:uuid(32),
 siteContentSha256:'f'.repeat(64),sourceRevisionSha256:sourceShaDigest,
 siteSlug:'rosevear-landscape',theme:'forest',
 verifiedDomain:'https://landscape.example.test',
 issuedAt:new Date(now-10000).toISOString(),
 expiresAt:new Date(now+600000).toISOString()};
const canonical=publicationCanonical587(pay);
ok(!!canonical,'stable canonical owner/reviewer digest');
const sign=(key)=>signP256('sha256',Buffer.from(canonical),
 {key,dsaEncoding:'ieee-p1363'}).toString('base64url');
const packet={payload:pay,canonicalDigestSha256:createHash('sha256').update(canonical).digest('hex'),
 ownerSignatureP1363:sign(owner.privateKey),reviewerSignatureP1363:sign(reviewer.privateKey),
 reviewerSignedSameDigest:true,publicationAlreadyExecuted:false};
const signOptions={tenantId:fake.companyId,sourceSha,ownerUserId:uuid(31),reviewerUserId:uuid(32),
 ownerKeyPinned:owner.publicKey.export({format:'pem',type:'spki'}),
 reviewerKeyPinned:reviewer.publicKey.export({format:'pem',type:'spki'}),
 independentDomainEvidence:true,independentOwnerActive:true,independenceVerified:true,now};
const signed=inspectPublicationApproval587(packet,signOptions);
assert.equal(signed.state,'SOURCE_REVIEW_SIGNED_REQUIRES_SEPARATE_PUBLICATION');
assert.equal(signed.published,false);
for(const [reason,changes,opts] of [
 ['owner signature forged',{ownerSignatureP1363:packet.reviewerSignatureP1363},{}],
 ['reviewer signature forged',{reviewerSignatureP1363:packet.ownerSignatureP1363},{}],
 ['client-selected untrusted key',{}, {reviewerKeyPinned:owner.publicKey.export({format:'pem',type:'spki'})}],
 ['foreign source SHA',{}, {sourceSha:'b'.repeat(40)}],
 ['tenant mismatch',{}, {tenantId:uuid(88)}],
 ['owner identity mismatch',{}, {ownerUserId:uuid(91)}],
 ['unsigned digest',{canonicalDigestSha256:'0'.repeat(64)},{}],
 ['missing independent domain approval',{}, {independentDomainEvidence:false}],
 ['reviewer not independent',{}, {independenceVerified:false}],
 ['owner no longer active',{}, {independentOwnerActive:false}],
 ['publication already executed',{publicationAlreadyExecuted:true},{}],
 ['same digest not proven',{reviewerSignedSameDigest:false},{}],
 ['expired',{}, {now:now+7200000}]
])deny(reason,inspectPublicationApproval587({...packet,...changes},{...signOptions,...opts}));

const txt=p=>readFileSync(p,'utf8');
const index=txt('index.html'),build=txt('scripts/build-vercel-site.mjs');
for(const p of ['js/yw587-photo-incident-engine.js','js/yw587-rosevear-synthetic-case.js',
 'js/yw587-original-customer-recovery.js','js/yw587-shell-case-workspace.js'])
 ok(index.includes(p),'script linked '+p);
ok(index.includes('theme-shell-photo-587.css')&&build.includes("'theme-shell-photo-587.css'"),'theme included in deploy');
const ui=txt('js/yw587-shell-case-workspace.js');
for(const s of ['ywi_is_platform_administrator_489','ywi_companies',
 'auth.getUser','tenantCaseAccepted','Shell','yw584Sysop','yw584Tenant'])ok(ui.includes(s),'role guard '+s);
for(const bad of ['.insert(','.upsert(','.update(','.delete(','.storage.from(','.signUp(','.sendEmail('])
 ok(!ui.includes(bad),'no unauthorized write '+bad);
const publish=txt('scripts/yw587-signed-publication.mjs');
ok(!publish.includes('writeFileSync')&&!publish.includes('fetch('),'signed review never auto-publishes');
console.log('YW587 PASS: nine-stage missing-photo flow, original company/job/photo receipts, redacted Shell, independent recovery and two pinned P256 signatures; '+rejects+' negative guards, '+passed+' assertions');
