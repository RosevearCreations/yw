// YW599 server-only evidence/transport primitives. No production scheduler or DB adapter is enabled by this module.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const REF=/^[A-Za-z0-9_-]{8,128}$/;
const enc=new TextEncoder();
const fail=(code)=>{throw new Error('YW599_'+code+'_HOLD')};
const must=(v,code)=>{if(!v)fail(code)};
const id=(x)=>typeof x==='string'&&UUID.test(x);
const hash=(x)=>typeof x==='string'&&SHA.test(x);
const ref=(x)=>typeof x==='string'&&REF.test(x);
const iso=(x)=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const hex=(x)=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join('');
export function canonical(x){
 if(x===null||typeof x==='string'||typeof x==='boolean'||(typeof x==='number'&&Number.isFinite(x)))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&Object.getPrototypeOf(x)===Object.prototype)return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 fail('CANONICAL_INPUT');
}
export async function digest(x){return hex(await crypto.subtle.digest('SHA-256',enc.encode(canonical(x))))}
async function hkey(key){
 must(typeof key==='string'&&enc.encode(key).length>=32,'SECRET_CONFIG');
 return crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function sign(key,domain,payload){return hex(await crypto.subtle.sign('HMAC',await hkey(key),enc.encode(domain+'|'+canonical(payload))))}
export async function verify(key,domain,payload,sig){
 return hash(sig)&&await crypto.subtle.verify('HMAC',await hkey(key),Uint8Array.from(sig.match(/../g),v=>parseInt(v,16)),enc.encode(domain+'|'+canonical(payload)));
}
function exact(x,keys){return x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|')}
function pinned(url,host,masterHost){
 const u=new URL(url);const h=String(host).toLowerCase(),m=String(masterHost).toLowerCase();
 must(u.protocol==='https:'&&u.hostname===h&&h!==m&&!h.endsWith('.'+m)&&!m.endsWith('.'+h)&&h.includes('.')&&!h.endsWith('.local')&&!h.endsWith('.internal')&&!/^[\d.]+$/.test(h)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash,'INDEPENDENT_PINNED_HTTPS');
 return u.toString();
}
export function notificationPlan({alert,enrollment,attempts,now}){
 must(Number.isFinite(now)&&id(alert?.id)&&id(alert.companyId)&&id(enrollment?.id)&&enrollment.companyId===alert.companyId&&id(enrollment.ownerId)&&id(enrollment.reviewerId)&&enrollment.ownerId!==enrollment.reviewerId,'ORIGINAL_DISTINCT_AUTHORITY');
 must(enrollment.active===true&&enrollment.approvedRecipient===true&&enrollment.providerEnrolled===true&&enrollment.noPaidProvider===true&&ref(enrollment.recipientRef)&&ref(enrollment.providerId)&&iso(enrollment.expiresAt)&&Date.parse(enrollment.expiresAt)>now,'PROVIDER_OR_CONSENT');
 must(['NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD'].includes(alert.issueCode)&&iso(alert.detectedAt)&&Date.parse(alert.detectedAt)<=now&&now-Date.parse(alert.detectedAt)<=24*3600000&&hash(alert.sourceSha256),'SOURCE_ALERT');
 must(Array.isArray(attempts)&&attempts.every((a,i)=>a.companyId===alert.companyId&&a.alertId===alert.id&&a.enrollmentId===enrollment.id&&a.attempt===i+1&&iso(a.at)&&Date.parse(a.at)<=now&&['VERIFIED_DELIVERY','DEFINITIVE_FAILURE','UNKNOWN','IN_FLIGHT'].includes(a.state)),'ATTEMPT_LEDGER');
 if(attempts.some(a=>a.state==='VERIFIED_DELIVERY'))return {state:'DELIVERED_NO_RETRY'};
 if(attempts.some(a=>['UNKNOWN','IN_FLIGHT'].includes(a.state)))return {state:'HOLD_RECONCILE_PROVIDER'};
 if(attempts.length>=3)return {state:'HOLD_RETRY_EXHAUSTED'};
 if(attempts.length&&now-Date.parse(attempts.at(-1).at)<[60000,300000][attempts.length-1])return {state:'WAIT_BACKOFF'};
 return {state:'ELIGIBLE_FOR_ATOMIC_CLAIM',attempt:attempts.length+1,idempotencyKey:alert.companyId+':'+alert.id+':'+enrollment.id};
}
// Trusted server adapter only: claim must atomically authorize original source, consent,
// enrolled provider and recipient, deduplicate and persist the in-flight attempt before network I/O.
// An ambiguous timeout must never cause an automatic second send.
export async function sendClaimedNotification({claim,config,requestKey,receiptKey,fetcher=fetch,now=Date.now()}){
 must(claim?.state==='ATOMIC_CLAIMED'&&id(claim.companyId)&&id(claim.alertId)&&id(claim.enrollmentId)&&id(claim.nonce)&&ref(claim.providerId)&&ref(claim.recipientRef)&&hash(claim.sourceSha256)&&['NO_SIGNED_MASTER_ACK_30M','RECEIVER_UNVERIFIED_HOLD'].includes(claim.issueCode)&&Number.isInteger(claim.attempt)&&claim.attempt>=1&&claim.attempt<=3&&iso(claim.claimedAt)&&now-Date.parse(claim.claimedAt)>=0&&now-Date.parse(claim.claimedAt)<=30000,'CLAIM');
 must(config.providerId===claim.providerId&&requestKey!==receiptKey,'PROVIDER_KEYS');
 const url=pinned(config.url,config.host,config.masterHost);
 const body={schema:'rosevear.yw.outage-notification.v1',providerId:claim.providerId,companyId:claim.companyId,alertId:claim.alertId,enrollmentId:claim.enrollmentId,nonce:claim.nonce,recipientRef:claim.recipientRef,issueCode:claim.issueCode,sourceSha256:claim.sourceSha256,idempotencyKey:claim.companyId+':'+claim.alertId+':'+claim.enrollmentId,noCustomerData:true};
 const requestDigest=await digest(body);
 const signature=await sign(requestKey,'YW599-NOTIFY',body);
 try{
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json','x-yw-signature':signature,'idempotency-key':body.idempotencyKey},body:canonical(body)});
  if(!response.ok)return {state:'UNKNOWN',reason:'HTTP_NOT_VERIFIED',requestDigest};
  const reader=response.body?.getReader();if(!reader)return {state:'UNKNOWN',reason:'EMPTY_RESPONSE',requestDigest};
  const decoder=new TextDecoder();let size=0,raw='';
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();fail('RECEIPT_SIZE')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  const r=JSON.parse(raw);
  const fields=['schema','providerId','companyId','alertId','enrollmentId','nonce','recipientRef','sourceSha256','requestDigest','receiptId','status','observedAt','signature'];
  must(exact(r,fields),'RECEIPT_FIELDS');
  const {signature:sig,...payload}=r;
  must(r.schema==='rosevear.yw.outage-notification-receipt.v1'&&r.providerId===body.providerId&&r.companyId===body.companyId&&r.alertId===body.alertId&&r.enrollmentId===body.enrollmentId&&r.nonce===body.nonce&&r.recipientRef===body.recipientRef&&r.sourceSha256===body.sourceSha256&&r.requestDigest===requestDigest&&ref(r.receiptId)&&iso(r.observedAt)&&Date.parse(r.observedAt)>=Date.parse(claim.claimedAt)&&Date.parse(r.observedAt)<=now+30000&&['DELIVERED','NOT_DELIVERED'].includes(r.status),'RECEIPT_BINDING');
  must(await verify(receiptKey,'YW599-PROVIDER-RECEIPT',payload,sig),'RECEIPT_SIGNATURE');
  return {state:r.status==='DELIVERED'?'VERIFIED_DELIVERY':'DEFINITIVE_FAILURE',receipt:payload,signature:sig,requestDigest};
 }catch{return {state:'UNKNOWN',reason:'NO_VERIFIED_PROVIDER_RECEIPT',requestDigest}}
}
export async function verifyCutoverReadback({challenge,response,oldKey,nextKey,now=Date.now()}){
 must(oldKey!==nextKey&&id(challenge?.companyId)&&id(challenge?.executionId)&&id(challenge?.rollbackDrillId)&&id(challenge?.nonce)&&id(challenge?.oldContractId)&&id(challenge?.nextContractId)&&challenge.oldContractId!==challenge.nextContractId&&iso(challenge.issuedAt)&&now-Date.parse(challenge.issuedAt)>=0&&now-Date.parse(challenge.issuedAt)<=120000,'CUTOVER_CHALLENGE');
 const fields=['schema','companyId','executionId','rollbackDrillId','nonce','oldContractId','nextContractId','state','receiptId','observedAt','oldSignature','nextSignature'];
 must(exact(response,fields),'CUTOVER_FIELDS');
 const {oldSignature,nextSignature,...payload}=response;
 for(const k of ['companyId','executionId','rollbackDrillId','nonce','oldContractId','nextContractId'])must(response[k]===challenge[k],'CUTOVER_BINDING');
 must(response.schema==='rosevear.yw.final-cutover-readback.v1'&&response.state==='NEXT_ACTIVE_OLD_ACCEPTED'&&ref(response.receiptId)&&iso(response.observedAt)&&Date.parse(response.observedAt)>=Date.parse(challenge.issuedAt)&&Date.parse(response.observedAt)<=now,'CUTOVER_STATE');
 must(await verify(oldKey,'YW599-CUTOVER-OLD',payload,oldSignature)&&await verify(nextKey,'YW599-CUTOVER-NEXT',payload,nextSignature),'CUTOVER_SIGNATURES');
 return {state:'SIGNED_REMOTE_CUTOVER_REPORTED',payload,oldSignature,nextSignature};
}
// This is a classification of already independently reverified, durable evidence,
// not an authorization check or a means of manufacturing production proof.
export function classifyRecoveryAudit(records,now=Date.now()){
 must(Array.isArray(records)&&Number.isFinite(now),'AUDIT_INPUT');
 const seen=new Set(),owners=new Set(),reviewers=new Set(),receipts=new Set();
 for(const r of records){
  must(id(r.companyId)&&id(r.ownerId)&&id(r.reviewerId)&&r.ownerId!==r.reviewerId&&!seen.has(r.companyId)&&!owners.has(r.ownerId)&&!reviewers.has(r.reviewerId)&&!owners.has(r.reviewerId)&&!reviewers.has(r.ownerId),'DISTINCT_TENANTS_AND_ACTORS');
  must(r.sourceVerified===true&&r.providerReceiptVerified===true&&r.cutoverReadbackVerified===true&&r.rollbackWitnessVerified===true&&r.independentReviewerVerified===true&&iso(r.verifiedAt)&&Date.parse(r.verifiedAt)<=now&&now-Date.parse(r.verifiedAt)<=86400000,'AUDIT_EVIDENCE');
  for(const k of ['sourceReceiptId','providerReceiptId','cutoverReceiptId','rollbackReceiptId']){must(ref(r[k])&&!receipts.has(r[k]),'UNIQUE_RECEIPTS');receipts.add(r[k])}
  seen.add(r.companyId);owners.add(r.ownerId);reviewers.add(r.reviewerId);
 }
 return {state:seen.size>=2?'TWO_TENANT_VERIFIED_EVIDENCE_CANDIDATE':'HOLD_INSUFFICIENT_TENANTS',verifiedTenantCount:seen.size};
}
