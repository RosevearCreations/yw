// YW597 fail-closed original owner/sysop/reviewer fixture; test identities are NEVER live.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto,randomUUID} from 'node:crypto';
const file=p=>readFileSync(p,'utf8');
const edge=file('supabase/functions/yw597-cutover-rollback-health/index.ts');
const sql=file('sql/yw597_cutover_rollback_ack_watch.sql');
const html=file('index.html'),ui=file('js/yw597-cutover-rollback-health.js');
const cfg=file('supabase/config.toml');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const [COMPANY,OTHER,OWNER,REVIEWER,CREW,SYSOP,OUTSIDER,JOB,OLD_CONTRACT,NEXT_CONTRACT,
 ROTATION,SIGNOFF,PROOF,OLD_ACK,NEXT_ATTEMPT,CANARY,INTENT]=Array.from({length:17},(_,i)=>uuid(i+1));
const now=Date.now(),iso=t=>new Date(t).toISOString();
const utf=s=>new TextEncoder().encode(s);
const hex=x=>Array.from(new Uint8Array(x),z=>z.toString(16).padStart(2,'0')).join('');
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const sha=async x=>hex(await webcrypto.subtle.digest('SHA-256',utf(x)));
const hmac=async(key,msg)=>hex(await webcrypto.subtle.sign('HMAC',
 await webcrypto.subtle.importKey('raw',utf(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),utf(msg)));
const secrets={
 SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-service-role-only',
 YW592_MASTER_RECEIPT_URL:'https://master.fixture.invalid/accept',
 YW593_MASTER_ALLOWED_HOST:'master.fixture.invalid',
 YW592_MASTER_ACK_KEY:'test-existing-old-key',
 YW596_RECEIVER_NEXT_ACK_KEY:'test-existing-next-key',
 YW592_TELEMETRY_SEND_KEY:'test-source-signer',
 YW595_ROTATION_HMAC_KEY:'test-independent-human-rotation-signature',
 YW597_CUTOVER_HMAC_KEY:'test-independent-cutover-review-signature',
 YW597_HEALTH_HMAC_KEY:'test-health-local-signature'
};
assert.match(cfg,/\[functions\.yw597-cutover-rollback-health\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw597-cutover-rollback-health\.css/);
assert.match(html,/yw597-cutover-rollback-health\.js/);
assert.match(ui,/auth\.getUser\(\)/);
assert.doesNotMatch(ui,/innerHTML\s*=|localStorage\./);
for(const suffix of ['cutover_intents','rollback_proofs','cutover_approvals','health_enrollments','health_samples','health_alerts'])
 assert.match(sql,new RegExp('create table public\\.ywi_597_'+suffix));
assert.equal((sql.match(/enable row level security;/g)||[]).length,6);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,6);
assert.equal((sql.match(/grant execute on function public\.ywi_597_/g)||[]).length,7);
assert.match(sql,/cron\.schedule\('yw597-master-ack-evidence-watch-15m','\*\/15 \* \* \* \*'/);
assert.match(sql,/NO_SIGNED_MASTER_ACK_30M/);
assert.match(sql,/RECEIVER_UNVERIFIED_HOLD/);
assert.doesNotMatch(sql,/\bdelete from\b|\btruncate\b|\bdrop table\b/i);
assert.match(edge,/YW597-ROLLBACK-OLD/);
assert.match(edge,/YW597-ROLLBACK-NEXT/);
assert.match(edge,/YW597-HEALTH-OLD/);
assert.match(edge,/YW597-HEALTH-NEXT/);
assert.match(edge,/redirect:'error'/);
assert.match(edge,/noRemoteMutation:true/);
assert.match(edge,/noSourceBytes:true/);
assert.match(edge,/await verify\('YW596_RECEIVER_NEXT_ACK_KEY'/);
assert.match(edge,/actualCutoverObserved:false/);
assert.doesNotMatch(edge,/auth\.admin|publicUrl|object\/remove|storage\.from\(.+remove/);
const hash='a'.repeat(64),otherHash='b'.repeat(64);
const oldc={id:OLD_CONTRACT,company_id:COMPANY,owner_user_id:OWNER,
 request_nonce:uuid(30),contract_id:'master-old-001',
 source_schema:'rosevear.yw.source-photo-telemetry.v1',
 ack_schema:'YW592-ACK',observed_at:iso(now-3600000),expires_at:iso(now+3600000)};
const newc={...oldc,id:NEXT_CONTRACT,contract_id:'master-next-002',
 request_nonce:uuid(31),observed_at:iso(now-1800000)};
for(const c of [oldc,newc]){
 c.receiver_signature=await hmac(secrets.YW592_MASTER_ACK_KEY,
  'YW593-CONTRACT|'+c.contract_id+'|'+COMPANY+'|'+c.request_nonce+
  '|rosevear.yw.source-photo-telemetry.v1|YW592-ACK');
 c.receiver_response_sha256=await sha(canon({contractId:c.contract_id,
  companyId:COMPANY,requestNonce:c.request_nonce,
  acceptedSourceSchema:'rosevear.yw.source-photo-telemetry.v1',acceptedAckSchema:'YW592-ACK'}));
}
const rot={id:ROTATION,company_id:COMPANY,prior_contract_id:OLD_CONTRACT,
 candidate_contract_id:NEXT_CONTRACT,owner_user_id:OWNER,reviewer_user_id:REVIEWER,
 reason:'PLANNED_ROTATION',custody_only:true,proposed_at:iso(now-1500000)};
const signedAt=iso(now-1400000);
const signed=canon({schema:'rosevear.yw.receiver-rotation-custody.v1',
 companyId:COMPANY,rotationId:ROTATION,ownerId:OWNER,reviewerId:REVIEWER,
 priorContractRecordId:oldc.id,candidateContractRecordId:newc.id,
 priorContractId:oldc.contract_id,candidateContractId:newc.contract_id,
 priorReceiverHmac:oldc.receiver_signature,candidateReceiverHmac:newc.receiver_signature,
 reason:rot.reason,proposedAt:rot.proposed_at,signedAt,
 actualSecretRotated:false,remoteEndpointChanged:false});
const signoff={id:SIGNOFF,company_id:COMPANY,proposal_id:ROTATION,reviewer_user_id:REVIEWER,
 signed_at:signedAt.replace('Z','+00:00'),payload_sha256:await sha(signed),
 server_hmac_sha256:await hmac(secrets.YW595_ROTATION_HMAC_KEY,signed),actual_secret_rotated:false};
const nonce=uuid(32),common=ROTATION+'|'+COMPANY+'|'+nonce+'|'+oldc.contract_id+'|'+newc.contract_id+'|YW592-ACK';
const pr={id:PROOF,company_id:COMPANY,rotation_id:ROTATION,signoff_id:SIGNOFF,owner_user_id:OWNER,
 request_nonce:nonce,
 old_receiver_hmac:await hmac(secrets.YW592_MASTER_ACK_KEY,'YW596-ROTATE-OLD|'+common),
 next_receiver_hmac:await hmac(secrets.YW596_RECEIVER_NEXT_ACK_KEY,'YW596-ROTATE-NEXT|'+common),
 response_sha256:await sha(canon({schema:'rosevear.yw.receiver-dual-key-probe-ack.v1',
  companyId:COMPANY,rotationId:ROTATION,requestNonce:nonce,
  priorContractId:oldc.contract_id,candidateContractId:newc.contract_id,acceptedAckSchema:'YW592-ACK'})),
 received_at:iso(now-1200000),actual_secret_rotated:false,
 observed_state:'DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY'};
const oldAck={id:OLD_ACK,company_id:COMPANY,attempt_id:uuid(40),device_actor_id:CREW,
 master_receipt_id:'previous-master-receipt',request_nonce:uuid(41),
 source_sha256:hash,payload_sha256:'c'.repeat(64),
 received_at:iso(now-1600000)};
oldAck.master_ack_hmac_sha256=await hmac(secrets.YW592_MASTER_ACK_KEY,
 'YW592-ACK|'+oldAck.master_receipt_id+'|'+oldAck.request_nonce+'|'+oldAck.payload_sha256);
const next={id:NEXT_ATTEMPT,company_id:COMPANY,uploaded_by:CREW,
 state:'VERIFIED',content_sha256:otherHash,stored_sha256:otherHash};
const canaryNonce=uuid(42);
const canaryBody={schema:'rosevear.yw.receiver-next-source-canary.v1',
 companyId:COMPANY,rotationId:ROTATION,requestNonce:canaryNonce,sourceApp:'yw',
 sourceActorId:CREW,attemptId:NEXT_ATTEMPT,sourceSha256:otherHash,
 acceptedAckSchemaRequired:'YW596-NEXT-ACK',noSourceBytes:true,noCustomerDetails:true};
const can={id:CANARY,company_id:COMPANY,rotation_proof_id:PROOF,prior_ack_id:OLD_ACK,
 next_attempt_id:NEXT_ATTEMPT,source_actor_id:CREW,master_receipt_id:'new-master-receipt',
 request_nonce:canaryNonce,source_sha256:otherHash,
 payload_sha256:await sha(canon(canaryBody)),
 acknowledged_at:iso(now-900000),no_private_object_transferred:true};
can.next_ack_hmac=await hmac(secrets.YW596_RECEIVER_NEXT_ACK_KEY,
 'YW596-NEXT-ACK|'+can.master_receipt_id+'|'+COMPANY+'|'+NEXT_ATTEMPT+'|'+canaryNonce+'|'+otherHash+'|'+can.payload_sha256);
const rows={
 profiles:[{id:OWNER,is_active:true,role:'owner'},{id:REVIEWER,is_active:true,role:'reviewer'},
  {id:CREW,is_active:true,role:'crew'},{id:SYSOP,is_active:true,role:'admin'},
  {id:OUTSIDER,is_active:true,role:'customer'}],
 ywi_companies:[{id:COMPANY,owner_user_id:OWNER},{id:OTHER,owner_user_id:OUTSIDER}],
 ywi_591_tenant_pilots:[{company_id:COMPANY,owner_user_id:OWNER,
  reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',
  expires_at:iso(now+3600000)}],
 ywi_platform_administrators_489:[{user_id:SYSOP}],
 ywi_595_rotation_proposals:[rot],
 ywi_595_rotation_signoffs:[signoff],
 ywi_593_receiver_contracts:[oldc,newc],
 ywi_596_rotation_proofs:[pr],
 ywi_596_canary_acks:[can],
 ywi_592_master_receipts:[oldAck],
 ywi_591_photo_attempts:[next],
 ywi_597_cutover_intents:[],ywi_597_rollback_proofs:[],ywi_597_cutover_approvals:[],
 ywi_597_health_enrollments:[],ywi_597_health_samples:[],ywi_597_health_alerts:[]
};
let handler,actor=OWNER,remoteTamper=true;const calls=[];
async function fixtureFetch(uri,opts={}){
 const url=new URL(uri),path=url.pathname;calls.push({method:opts.method||'GET',path});
 if(path==='/auth/v1/user')return Response.json({id:actor});
 if(path.startsWith('/rest/v1/rpc/')){
  const payload=JSON.parse(opts.body);
  if(path.endsWith('ywi_597_begin_cutover')){
   const row={id:INTENT,company_id:COMPANY,proof_id:PROOF,canary_id:CANARY,
    owner_user_id:OWNER,reviewer_user_id:REVIEWER,consent_at:iso(now),
    expires_at:iso(now+86400000),actual_key_changed:false};
   rows.ywi_597_cutover_intents.push(row);
   return Response.json({state:'OWNER_INTENT_CUTOVER_NOT_EXECUTED',intentId:INTENT,actualKeyChanged:false});
  }
  return Response.json({error:'No actual original certificate or receiver execution'},403);
 }
 if(path.startsWith('/rest/v1/')){
  const table=path.slice('/rest/v1/'.length),source=rows[table];
  if(!source)return Response.json({error:'Fixture table missing'},404);
  let result=source;
  for(const [k,v]of url.searchParams)if(k!=='select'&&k!=='limit')
   result=result.filter(x=>String(x[k])===v.slice(3));
  return Response.json(result.slice(0,Number(url.searchParams.get('limit')||25)));
 }
 if(url.hostname==='master.fixture.invalid'){
  const req=JSON.parse(opts.body);
  assert.equal(opts.redirect,'error');
  if(req.schema!=='rosevear.yw.receiver-rollback-readiness.v1')
   return Response.json({error:'Fixture only supports rollback challenge'},404);
  const response={schema:'rosevear.yw.receiver-rollback-readiness-ack.v1',
   companyId:req.companyId,intentId:req.intentId,requestNonce:req.requestNonce,
   priorContractId:req.priorContractId,candidateContractId:req.candidateContractId,
   acceptedAckSchema:'YW592-ACK',previousKeyAccepted:true,candidateKeyAccepted:true,
   rollbackExecutionPerformed:false,oldHmac:'0'.repeat(64),nextHmac:'0'.repeat(64)};
  if(!remoteTamper)throw Error('Invalid fixture setup');
  return Response.json(response);
 }
 throw Error('Unexpected endpoint '+url.href);
}
vm.runInNewContext(edge,{Deno:{env:{get:k=>secrets[k]},serve:fn=>handler=fn},
 crypto:webcrypto,fetch:fixtureFetch,TextEncoder,Uint8Array,URL,URLSearchParams,
 Response,Request,Date,JSON,Array,Object,Set,Promise,Error,AbortSignal});
async function call(action,payload={},as=OWNER,origin='https://yw-alpha.vercel.app'){
 actor=as;
 const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw597-cutover-rollback-health',{
  method:'POST',headers:{origin,'content-type':'application/json',
   authorization:'Bearer a.b.c'},body:JSON.stringify({action,...payload})}));
 return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():{}};
}
const base={companyId:COMPANY};
let x=await call('overview',base);assert.equal(x.status,200);assert.equal(x.data.intents.length,0);
x=await call('owner-begin-cutover',{...base,dualKeyProofId:PROOF,canaryId:CANARY});
assert.equal(x.data.state,'HOLD');
x=await call('owner-begin-cutover',{...base,dualKeyProofId:PROOF,canaryId:CANARY,
 confirmOriginalOwnerIntent:true},REVIEWER);assert.equal(x.data.state,'HOLD');
x=await call('owner-begin-cutover',{...base,dualKeyProofId:PROOF,canaryId:CANARY,
 confirmOriginalOwnerIntent:true},OUTSIDER);assert.equal(x.data.state,'HOLD');
x=await call('owner-begin-cutover',{...base,dualKeyProofId:PROOF,canaryId:CANARY,
 confirmOriginalOwnerIntent:true});assert.equal(x.data.state,'OWNER_INTENT_CUTOVER_NOT_EXECUTED');
assert.equal(x.data.actualKeyChanged,false);
x=await call('sysop-rollback-readiness',{...base,intentId:INTENT,confirmReadOnlyRollbackDrill:true},OWNER);
assert.equal(x.data.state,'HOLD');
x=await call('sysop-rollback-readiness',{...base,intentId:INTENT,confirmReadOnlyRollbackDrill:true},SYSOP);
assert.equal(x.data.state,'HOLD','Forged two-key receiver 200 response must HOLD');
x=await call('reviewer-authorize-manual-cutover',{...base,intentId:INTENT,
 rollbackProofId:uuid(77),confirmIndependentManualAuthorization:true},REVIEWER);
assert.equal(x.data.state,'HOLD');
x=await call('owner-enroll-health-watch',{...base,approvalId:uuid(78),confirmWatchOnly:true});
assert.equal(x.data.state,'HOLD');
x=await call('owner-probe-remote-health',{...base,enrollmentId:uuid(79),confirmReadOnlyProbe:true});
assert.equal(x.data.state,'HOLD');
x=await call('overview',{companyId:OTHER});assert.equal(x.data.state,'HOLD');
x=await call('overview',base,OWNER,'https://unauthorized.invalid');
assert.equal(x.status,403);
assert.equal(rows.ywi_597_cutover_approvals.length,0);
assert.equal(rows.ywi_597_rollback_proofs.length,0);
assert.equal(rows.ywi_597_health_enrollments.length,0);
assert.equal(calls.filter(x=>x.path==='/auth/v1/user').length>0,true);
console.log('YW597 PASS: original dual-key/old+next source custody, owner consent, distinct roles, fake receiver HMAC rejection, fail-closed cutover/health and scheduled immutable 15-min stale ACK monitor.');
