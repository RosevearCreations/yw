// YW596 adversarial fixture: synthetic accounts/keys are NOT real field records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto,randomUUID} from 'node:crypto';
const file=path=>readFileSync(path,'utf8');
const edge=file('supabase/functions/yw596-receiver-rotation-continuity/index.ts');
const sql=file('sql/yw596_receiver_rotation_two_tenant_ack_continuity.sql');
const ui=file('js/yw596-receiver-continuity.js'),html=file('index.html'),config=file('supabase/config.toml');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const COMPANY=uuid(1),OTHER=uuid(2),OWNER=uuid(3),REVIEWER=uuid(4),CREW=uuid(5),
 OUTSIDER=uuid(6),SYSOP=uuid(7),JOB=uuid(8),OLD=uuid(9),NEXT=uuid(10),
 CONTRACT_OLD=uuid(11),CONTRACT_NEXT=uuid(12),ROTATION=uuid(13),
 SIGNOFF=uuid(14),OLD_ACK=uuid(15),SLOT=uuid(16),OPTIN=uuid(17);
const now=Date.now(),iso=n=>new Date(n).toISOString();
const utf=s=>new TextEncoder().encode(s);
const hex=x=>Array.from(new Uint8Array(x),y=>y.toString(16).padStart(2,'0')).join('');
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const sha=async x=>hex(await webcrypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x));
const hmac=async(key,message)=>hex(await webcrypto.subtle.sign('HMAC',
 await webcrypto.subtle.importKey('raw',utf(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),utf(message)));
const secrets={SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key',
 YW592_MASTER_RECEIPT_URL:'https://receiver.fixture.test/accept',
 YW593_MASTER_ALLOWED_HOST:'receiver.fixture.test',
 YW592_MASTER_ACK_KEY:'fixture-old-master-secret',
 YW596_RECEIVER_NEXT_ACK_KEY:'fixture-next-master-secret',
 YW592_TELEMETRY_SEND_KEY:'fixture-source-key',
 YW595_ROTATION_HMAC_KEY:'fixture-rotation-key',
 YW595_FLEET_HMAC_KEY:'fixture-fleet-key',
 YW593_WITNESS_HMAC_KEY:'fixture-window-key',
 YW596_SCHEDULE_HMAC_KEY:'fixture-window-consent-key',
 YW596_AUDIT_HMAC_KEY:'fixture-audit-key'};
assert.match(config,/\[functions\.yw596-receiver-rotation-continuity\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw596-receiver-continuity\.js/);
assert.match(html,/yw596-receiver-continuity\.css/);
assert.match(ui,/auth\.getUser\(\)/);
assert.doesNotMatch(ui,/localStorage\.|innerHTML\s*=/);
for(const t of ['rotation_proofs','canary_acks','slot_consents',
 'cross_tenant_pilots','independent_continuity_audits'])
 assert.match(sql,new RegExp('create table public\\.ywi_596_'+t));
assert.equal((sql.match(/enable row level security;/g)||[]).length,5);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,5);
assert.equal((sql.match(/grant execute on function public\.ywi_596_/g)||[]).length,5);
assert.match(sql,/from public,anon,authenticated;/);
assert.match(sql,/not \(sa\.ends_at<=sb\.starts_at or sb\.ends_at<=sa\.starts_at\)/);
assert.match(sql,/p_auditor_user_id in\(pair.coordinator_user_id/);
assert.doesNotMatch(sql,/\bdelete from\b|\btruncate\b|\bdrop table\b/i);
assert.match(edge,/YW596_RECEIVER_NEXT_ACK_KEY/);
assert.match(edge,/YW592_MASTER_ACK_KEY/);
assert.match(edge,/originalBytes\(a\)/);
assert.match(edge,/redirect:'error'/);
assert.match(edge,/noSourceBytes:true/);
assert.match(edge,/p\.response_sha256!==await sha/);
assert.doesNotMatch(edge,/storage\/v1\/object\/remove|publicUrl|auth\.admin/);
const oldContractText=(id,nonce)=>
 'YW593-CONTRACT|'+id+'|'+COMPANY+'|'+nonce+
 '|rosevear.yw.source-photo-telemetry.v1|YW592-ACK';
const digestContract=async(id,nonce)=>sha(canon({
 contractId:id,companyId:COMPANY,requestNonce:nonce,
 acceptedSourceSchema:'rosevear.yw.source-photo-telemetry.v1',
 acceptedAckSchema:'YW592-ACK'}));
const oldc={id:CONTRACT_OLD,company_id:COMPANY,owner_user_id:OWNER,
 request_nonce:uuid(101),contract_id:'old-receiver-01',
 source_schema:'rosevear.yw.source-photo-telemetry.v1',
 ack_schema:'YW592-ACK',observed_at:iso(now-1200000),expires_at:iso(now+3000000)};
const nextc={...oldc,id:CONTRACT_NEXT,request_nonce:uuid(102),
 contract_id:'next-receiver-02',observed_at:iso(now-600000)};
oldc.receiver_signature=await hmac(secrets.YW592_MASTER_ACK_KEY,
 oldContractText(oldc.contract_id,oldc.request_nonce));
oldc.receiver_response_sha256=await digestContract(oldc.contract_id,oldc.request_nonce);
nextc.receiver_signature=await hmac(secrets.YW592_MASTER_ACK_KEY,
 oldContractText(nextc.contract_id,nextc.request_nonce));
nextc.receiver_response_sha256=await digestContract(nextc.contract_id,nextc.request_nonce);
const rot={id:ROTATION,company_id:COMPANY,prior_contract_id:CONTRACT_OLD,
 candidate_contract_id:CONTRACT_NEXT,owner_user_id:OWNER,reviewer_user_id:REVIEWER,
 reason:'PLANNED_ROTATION',custody_only:true,proposed_at:iso(now-180000)};
const signedAt=iso(now-120000);
const signMsg=canon({schema:'rosevear.yw.receiver-rotation-custody.v1',
 companyId:COMPANY,rotationId:ROTATION,ownerId:OWNER,reviewerId:REVIEWER,
 priorContractRecordId:CONTRACT_OLD,candidateContractRecordId:CONTRACT_NEXT,
 priorContractId:oldc.contract_id,candidateContractId:nextc.contract_id,
 priorReceiverHmac:oldc.receiver_signature,candidateReceiverHmac:nextc.receiver_signature,
 reason:'PLANNED_ROTATION',proposedAt:rot.proposed_at,signedAt,
 actualSecretRotated:false,remoteEndpointChanged:false});
const signoff={id:SIGNOFF,company_id:COMPANY,proposal_id:ROTATION,
 reviewer_user_id:REVIEWER,signed_at:signedAt.replace('Z','+00:00'),
 payload_sha256:await sha(signMsg),
 server_hmac_sha256:await hmac(secrets.YW595_ROTATION_HMAC_KEY,signMsg),
 actual_secret_rotated:false};
const bytesOld=Uint8Array.from([1,2,3]),bytesNext=Uint8Array.from([9,8,7,6]);
const oldhash=await sha(bytesOld),nexthash=await sha(bytesNext);
const oldAttempt={id:OLD,company_id:COMPANY,work_order_id:JOB,
 uploaded_by:CREW,state:'VERIFIED',content_sha256:oldhash,
 stored_sha256:oldhash,byte_count:3,object_key:'a/b/c'};
const nextAttempt={...oldAttempt,id:NEXT,content_sha256:nexthash,
 stored_sha256:nexthash,byte_count:4,object_key:'d/e/f'};
const oldAckMsg='YW592-ACK|previous-master-receipt|'+uuid(103)+'|'+'a'.repeat(64);
const oldAck={id:OLD_ACK,company_id:COMPANY,attempt_id:OLD,device_actor_id:CREW,
 master_receipt_id:'previous-master-receipt',request_nonce:uuid(103),
 source_sha256:oldhash,payload_sha256:'a'.repeat(64),
 master_ack_hmac_sha256:await hmac(secrets.YW592_MASTER_ACK_KEY,oldAckMsg),
 received_at:iso(now-900000)};
const rows={
 profiles:[{id:OWNER,is_active:true,role:'owner'},{id:REVIEWER,is_active:true,role:'reviewer'},
 {id:CREW,is_active:true,role:'crew'},{id:OUTSIDER,is_active:true,role:'customer'},
 {id:SYSOP,is_active:true,role:'admin'}],
 ywi_companies:[{id:COMPANY,owner_user_id:OWNER},{id:OTHER,owner_user_id:OUTSIDER}],
 ywi_591_tenant_pilots:[{company_id:COMPANY,owner_user_id:OWNER,
 reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',
 expires_at:iso(now+86400000)}],
 ywi_591_pilot_staff:[{company_id:COMPANY,user_id:CREW,role:'crew',state:'APPROVED'}],
 ywi_591_photo_attempts:[oldAttempt,nextAttempt],
 ywi_593_receiver_contracts:[oldc,nextc],
 ywi_595_rotation_proposals:[rot],ywi_595_rotation_signoffs:[signoff],
 ywi_592_master_receipts:[oldAck],ywi_platform_administrators_489:[{user_id:SYSOP}],
 ywi_596_rotation_proofs:[],ywi_596_canary_acks:[],
 ywi_595_fleet_optins:[],ywi_595_ceremony_closures:[],
 ywi_595_ceremony_intents:[],ywi_594_field_certificates:[],
 ywi_593_witness_slots:[],ywi_593_witness_approvals:[],
 ywi_596_slot_consents:[],ywi_596_cross_tenant_pilots:[],
 ywi_596_independent_continuity_audits:[]
};
let actor=OWNER,handler,remoteTamper=false;const trace=[];
async function simulatedRemote(raw,opts){
 const req=JSON.parse(opts.body),company=req.companyId,rotation=req.rotationId,nonce=req.requestNonce;
 assert.equal(company,COMPANY);
 assert.equal(opts.redirect,'error');
 if(req.schema==='rosevear.yw.receiver-dual-key-probe.v1'){
  const common=rotation+'|'+company+'|'+nonce+'|'+oldc.contract_id+'|'+nextc.contract_id+'|YW592-ACK';
  const reply={schema:'rosevear.yw.receiver-dual-key-probe-ack.v1',
   companyId:company,rotationId:rotation,requestNonce:nonce,
   priorContractId:oldc.contract_id,candidateContractId:nextc.contract_id,
   acceptedAckSchema:'YW592-ACK',
   oldHmac:await hmac(secrets.YW592_MASTER_ACK_KEY,'YW596-ROTATE-OLD|'+common),
   nextHmac:await hmac(secrets.YW596_RECEIVER_NEXT_ACK_KEY,'YW596-ROTATE-NEXT|'+common)};
  if(remoteTamper)reply.nextHmac='0'.repeat(64);
  return Response.json(reply);
 }
 if(req.schema==='rosevear.yw.receiver-next-source-canary.v1'){
  const payloadSha=await sha(canon(req)),receiptId='next-master-ack-01';
  const nextMsg='YW596-NEXT-ACK|'+receiptId+'|'+company+'|'+req.attemptId+
   '|'+nonce+'|'+req.sourceSha256+'|'+payloadSha;
  return Response.json({schema:'rosevear.yw.receiver-next-source-canary-ack.v1',
   companyId:company,attemptId:req.attemptId,requestNonce:nonce,
   sourceSha256:req.sourceSha256,payloadSha256:payloadSha,receiptId,
   nextAckHmac:await hmac(secrets.YW596_RECEIVER_NEXT_ACK_KEY,nextMsg)});
 }
 throw Error('Unknown receiver route');
}
async function fakeFetch(raw,opts={}){
 const url=new URL(raw),path=url.pathname;trace.push((opts.method||'GET')+' '+path);
 if(url.hostname==='receiver.fixture.test')return simulatedRemote(raw,opts);
 if(path==='/auth/v1/user')return Response.json({id:actor});
 if(path.startsWith('/storage/v1/object/')){
  if(path.endsWith('/d/e/f'))return new Response(bytesNext);
  return new Response(null,{status:404});
 }
 if(path.startsWith('/rest/v1/rpc/')){
  const data=JSON.parse(opts.body||'{}');
  if(path.endsWith('/ywi_596_record_dual_key_proof')){
   const id=uuid(201);
   rows.ywi_596_rotation_proofs.push({id,company_id:COMPANY,rotation_id:ROTATION,
    signoff_id:SIGNOFF,owner_user_id:OWNER,request_nonce:data.p_nonce,
    response_sha256:data.p_response_sha256,old_receiver_hmac:data.p_old_hmac,
    next_receiver_hmac:data.p_next_hmac,received_at:data.p_received_at,
    actual_secret_rotated:false,observed_state:'DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY'});
   return Response.json({state:'DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY',proofId:id,
    actualSecretRotated:false});
  }
  if(path.endsWith('/ywi_596_record_next_canary')){
   const id=uuid(202);
   rows.ywi_596_canary_acks.push({id,company_id:COMPANY,
    rotation_proof_id:uuid(201),prior_ack_id:OLD_ACK,next_attempt_id:NEXT,
    source_actor_id:CREW,master_receipt_id:data.p_receipt_id,
    request_nonce:data.p_nonce,source_sha256:data.p_source_sha256,
    payload_sha256:data.p_payload_sha256,next_ack_hmac:data.p_ack_hmac,
    acknowledged_at:data.p_acknowledged_at,no_private_object_transferred:true});
   return Response.json({state:'INDEPENDENT_NEXT_KEY_SOURCE_DIGEST_ACK_VERIFIED',
    canaryId:id,privateObjectTransferred:false,hardwareAttested:false});
  }
  return Response.json({error:'No genuine original source approval'},403);
 }
 if(path.startsWith('/rest/v1/')){
  const table=path.replace('/rest/v1/','');
  if(!Object.hasOwn(rows,table))return Response.json({error:'Unexpected table'},404);
  let all=rows[table];
  for(const [k,v]of url.searchParams)if(!['select','limit'].includes(k))
   all=all.filter(x=>String(x[k])===v.slice(3));
  return Response.json(all.slice(0,Number(url.searchParams.get('limit')||25)));
 }
 throw Error('Unexpected network destination '+url.hostname);
}
vm.runInNewContext(edge,{Deno:{serve:fn=>handler=fn,env:{get:k=>secrets[k]}},
 fetch:fakeFetch,crypto:webcrypto,Response,Request,URL,URLSearchParams,
 TextEncoder,Uint8Array,Date,Error,Object,Array,JSON,String,Number,Promise,Set,Map,console,AbortSignal});
async function call(body,{as=OWNER,origin='https://yw-alpha.vercel.app'}={}){
 actor=as;
 const res=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw596-receiver-rotation-continuity',{
  method:'POST',headers:{origin,authorization:'Bearer aaa.bbb.ccc','content-type':'application/json'},
  body:JSON.stringify(body)}));
 return {status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():{}};
}
const queue=await call({action:'overview',companyId:COMPANY});
assert.equal(queue.status,200);
assert.equal(queue.data.rotations.length,1);
const outside=await call({action:'overview',companyId:COMPANY},{as:OUTSIDER});
assert.equal(outside.data.state,'HOLD');
const cross=await call({action:'overview',companyId:OTHER});
assert.equal(cross.data.state,'HOLD');
const notOwner=await call({action:'verify-dual-key-receiver',companyId:COMPANY,
 rotationId:ROTATION,confirmPassiveKeyDrill:true},{as:REVIEWER});
assert.equal(notOwner.data.state,'HOLD');
const notConfirmed=await call({action:'verify-dual-key-receiver',companyId:COMPANY,
 rotationId:ROTATION});
assert.equal(notConfirmed.data.state,'HOLD');
remoteTamper=true;
const forge=await call({action:'verify-dual-key-receiver',companyId:COMPANY,
 rotationId:ROTATION,confirmPassiveKeyDrill:true});
assert.equal(forge.data.state,'HOLD','forged next-key signature must be rejected');
assert.equal(rows.ywi_596_rotation_proofs.length,0);
remoteTamper=false;
const success=await call({action:'verify-dual-key-receiver',companyId:COMPANY,
 rotationId:ROTATION,confirmPassiveKeyDrill:true});
assert.equal(success.data.state,'DUAL_KEY_RECEIVER_VERIFIED_CUSTODY_ONLY');
assert.equal(success.data.actualSecretRotated,false);
assert.equal(rows.ywi_596_rotation_proofs.length,1);
const ownerCannotCanary=await call({action:'original-next-key-canary',
 companyId:COMPANY,rotationProofId:uuid(201),priorAckId:OLD_ACK,
 nextAttemptId:NEXT,confirmOriginalDevice:true});
assert.equal(ownerCannotCanary.data.state,'HOLD');
const crewCanary=await call({action:'original-next-key-canary',
 companyId:COMPANY,rotationProofId:uuid(201),priorAckId:OLD_ACK,
 nextAttemptId:NEXT,confirmOriginalDevice:true},{as:CREW});
assert.equal(crewCanary.data.state,'INDEPENDENT_NEXT_KEY_SOURCE_DIGEST_ACK_VERIFIED');
assert.equal(crewCanary.data.privateObjectTransferred,false);
assert.equal(rows.ywi_596_canary_acks.length,1);
const fakeSlot=await call({action:'owner-consent-specific-window',companyId:COMPANY,
 optinId:OPTIN,slotId:SLOT,explicitConsent:true});
assert.equal(fakeSlot.data.state,'HOLD','missing genuine opt-in and witness must HOLD');
const nonAdmin=await call({action:'sysop-overview'});
assert.equal(nonAdmin.data.state,'HOLD');
const platform=await call({action:'sysop-overview'},{as:SYSOP});
assert.equal(platform.status,200);
assert.equal(platform.data.pairs.length,0);
const twoFakeConsents=await call({action:'coordinate-two-tenant-windows',
 consentAId:uuid(44),consentBId:uuid(45),
 confirmIndependentScheduling:true},{as:SYSOP});
assert.equal(twoFakeConsents.data.state,'HOLD');
const fakeAudit=await call({action:'independent-two-tenant-audit',
 pairId:uuid(55),canaryAId:uuid(202),canaryBId:uuid(56),
 confirmIndependentAudit:true},{as:SYSOP});
assert.equal(fakeAudit.data.state,'HOLD');
assert.equal(rows.ywi_596_cross_tenant_pilots.length,0);
assert.equal(rows.ywi_596_independent_continuity_audits.length,0);
const badOrigin=await call({action:'overview',companyId:COMPANY},{origin:'https://evil.invalid'});
assert.equal(badOrigin.status,403);
assert.equal(trace.filter(x=>x.includes('/storage/v1/object/')).length,1);
console.log('YW596 PASS: verified signed old/next receiver handshake, rejected forged next key, independent genuine old/new canary fixture, owner/crew separation, foreign tenant and second independent Sysop HOLD, zero invented cross-company evidence.');
