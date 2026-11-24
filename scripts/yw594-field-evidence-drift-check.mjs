// YW594 security regression fixture. Synthetic actors are never real human field evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto,randomUUID} from 'node:crypto';
const f=p=>readFileSync(p,'utf8');
const edge=f('supabase/functions/yw594-field-evidence-drift/index.ts');
const sql=f('sql/yw594_independent_field_evidence_receiver_drift.sql');
const ui=f('js/yw594-field-evidence.js');
const html=f('index.html');
const cfg=f('supabase/config.toml');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const COMPANY=id(1),OTHER=id(2),OWNER=id(3),REVIEWER=id(4),CREW=id(5),
 FOREIGN=id(6),JOB=id(7),ATT=id(8),SLOT=id(9),AP=id(10),PROOF=id(11),OBS=id(12);
const now=Date.now();
const ISO=n=>new Date(n).toISOString();
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const utf=s=>new TextEncoder().encode(s);
const hx=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async s=>hx(await webcrypto.subtle.digest('SHA-256',utf(s)));
const sign=async(s,key)=>hx(await webcrypto.subtle.sign('HMAC',
 await webcrypto.subtle.importKey('raw',utf(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),utf(s)));
assert.match(cfg,/\[functions\.yw594-field-evidence-drift\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw594-field-evidence\.js/);
assert.match(html,/yw594-field-evidence\.css/);
assert.match(ui,/auth\.getUser\(\)/);
assert.match(ui,/crypto\.subtle\.generateKey/);
assert.doesNotMatch(ui,/localStorage\.|innerHTML\s*=/);
assert.match(edge,/YW593_WITNESS_HMAC_KEY/);
assert.match(edge,/YW594_HUMAN_EVIDENCE_HMAC_KEY/);
assert.match(edge,/YW594_DRIFT_HMAC_KEY/);
assert.match(edge,/YW592_MASTER_ACK_KEY/);
assert.match(edge,/originalBytes\(a\)/);
assert.match(edge,/hardwareAttested:false/);
assert.match(edge,/deviceVerify/);
assert.match(edge,/redirect:'error'/);
for(const table of ['attendance_challenges','attendance_proofs','owner_observations',
 'receiver_drift_alerts','field_certificates'])
 assert.match(sql,new RegExp('create table public\\.ywi_594_'+table));
assert.equal((sql.match(/enable row level security;/g)||[]).length,5);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,5);
assert.equal((sql.match(/grant execute on function public\.ywi_594_/g)||[]).length,5);
assert.doesNotMatch(sql,/\btruncate\b|\bdrop table\b|\bdelete from\b/i);
assert.doesNotMatch(edge,/auth\.admin|storage\/v1\/object\/remove|publicUrl/);
const secret={SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only',
 YW593_WITNESS_HMAC_KEY:'fixture-witness-only',
 YW594_HUMAN_EVIDENCE_HMAC_KEY:'fixture-human-evidence',
 YW594_DRIFT_HMAC_KEY:'fixture-local-drift',
 YW592_MASTER_ACK_KEY:'fixture-remote-ack',
 YW592_TELEMETRY_SEND_KEY:'fixture-telemetry-signer'};
const slot={id:SLOT,company_id:COMPANY,attempt_id:ATT,owner_user_id:OWNER,
 reviewer_user_id:REVIEWER,crew_user_id:CREW,starts_at:ISO(now-60000),
 ends_at:ISO(now+3600000)};
const signedAt=ISO(now-120000);
const msg=canonical({schema:'rosevear.yw.witness-window-approval.v1',
 companyId:COMPANY,slotId:SLOT,attemptId:ATT,ownerId:OWNER,reviewerId:REVIEWER,
 crewId:CREW,startsAt:slot.starts_at,endsAt:slot.ends_at,signedAt});
const rows={
 profiles:[{id:OWNER,is_active:true},{id:REVIEWER,is_active:true},
  {id:CREW,is_active:true},{id:FOREIGN,is_active:true}],
 ywi_companies:[{id:COMPANY,owner_user_id:OWNER},{id:OTHER,owner_user_id:FOREIGN}],
 ywi_591_tenant_pilots:[{company_id:COMPANY,owner_user_id:OWNER,
  reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',expires_at:ISO(now+86400000)},
  {company_id:OTHER,owner_user_id:FOREIGN,reviewer_user_id:id(33),
   work_order_id:id(34),state:'APPROVED',expires_at:ISO(now+86400000)}],
 ywi_591_pilot_staff:[{company_id:COMPANY,user_id:CREW,role:'crew',state:'APPROVED'}],
 ywi_593_witness_slots:[slot],
 ywi_593_witness_approvals:[{slot_id:SLOT,company_id:COMPANY,reviewer_user_id:REVIEWER,
  signed_at:signedAt,payload_sha256:await sha(msg),
  server_hmac_sha256:await sign(msg,secret.YW593_WITNESS_HMAC_KEY)}],
 ywi_591_photo_attempts:[{id:ATT,company_id:COMPANY,work_order_id:JOB,uploaded_by:CREW,
  content_sha256:'a'.repeat(64),stored_sha256:'a'.repeat(64),
  byte_count:15,object_key:'a/b/c',state:'VERIFIED'}],
 ywi_594_attendance_challenges:[],ywi_594_attendance_proofs:[],
 ywi_594_owner_observations:[],ywi_594_field_certificates:[],
 ywi_594_receiver_drift_alerts:[],ywi_592_master_receipts:[],
 ywi_593_receiver_contracts:[]
};
let handler,actor=OWNER;const trace=[];
const respond=(x,status=200)=>Response.json(x,{status});
async function fakeFetch(raw,opt={}){
 const url=new URL(raw),p=url.pathname;trace.push((opt.method||'GET')+' '+p);
 if(p==='/auth/v1/user')return respond({id:actor});
 if(p.startsWith('/rest/v1/rpc/')){
  const data=JSON.parse(opt.body||'{}');
  if(p.endsWith('/ywi_594_issue_attendance')){
   const newId=randomUUID(),row={id:newId,company_id:COMPANY,slot_id:SLOT,
    attempt_id:ATT,crew_user_id:CREW,nonce:data.p_nonce,source_sha256:'a'.repeat(64),
    issued_at:new Date().toISOString(),expires_at:ISO(Date.now()+5*60000)};
   rows.ywi_594_attendance_challenges.push(row);
   return respond({state:'CREW_CHALLENGE_ISSUED_NOT_ATTESTED',challengeId:newId,
    nonce:row.nonce,expiresAt:row.expires_at});
  }
  if(p.endsWith('/ywi_594_record_attendance')){
   rows.ywi_594_attendance_proofs.push({id:PROOF,challenge_id:data.p_challenge_id,
    company_id:COMPANY,slot_id:SLOT,crew_user_id:CREW,signed_at:data.p_signed_at,
    challenge_message_sha256:data.p_message_sha256,
    key_fingerprint_sha256:data.p_fingerprint_sha256,
    public_jwk:data.p_jwk,device_signature_b64url:data.p_signature,hardware_attested:false});
   return respond({state:'ORIGINAL_CREW_BROWSER_SIGNATURE_VERIFIED',
    proofId:PROOF,hardwareAttested:false,physicalAttendanceCertified:false});
  }
  if(p.endsWith('/ywi_594_owner_observe')){
   rows.ywi_594_owner_observations.push({id:OBS,proof_id:PROOF,
    company_id:COMPANY,slot_id:SLOT,owner_user_id:OWNER,observed_at:data.p_observed_at,
    co_presence_attested:true,payload_sha256:data.p_payload_sha256,
    server_hmac_sha256:data.p_server_hmac});
   return respond({state:'HUMAN_OWNER_COPRESENCE_ATTESTED',observationId:OBS,
    hardwareAttested:false,independentReviewPending:true});
  }
  return respond({error:'Unsigned original source must hold'},403);
 }
 if(p.startsWith('/rest/v1/')){
  const table=p.replace('/rest/v1/','');
  if(!Object.hasOwn(rows,table))return respond({error:'No original source'},404);
  let all=rows[table];
  for(const [k,v]of url.searchParams)if(!['select','limit'].includes(k))
   all=all.filter(x=>String(x[k])===v.slice(3));
  return respond(all.slice(0,Number(url.searchParams.get('limit')||25)));
 }
 throw Error('Unapproved external fetch '+p);
}
vm.runInNewContext(edge,{Deno:{serve:fn=>handler=fn,env:{get:k=>secret[k]}},
 fetch:fakeFetch,crypto:webcrypto,Response,Request,URL,URLSearchParams,
 Uint8Array,ArrayBuffer,AbortSignal,Date,TextEncoder,Error,Object,JSON,
 Number,String,Array,Promise,Set,Map,console,atob});
async function call(body,{as=OWNER,origin='https://yw-alpha.vercel.app'}={}){
 actor=as;
 const res=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw594-field-evidence-drift',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc',origin,
   'content-type':'application/json'},body:JSON.stringify(body)}));
 return {status:res.status,data:res.headers.get('content-type')?.includes('json')?
  await res.json():{}};
}
const initial=await call({action:'overview',companyId:COMPANY});
assert.equal(initial.status,200);assert.equal(initial.data.humanCertifiedCaseCount,0);
const wrong=await call({action:'overview',companyId:OTHER});
assert.equal(wrong.data.state,'HOLD','Cross-tenant read must HOLD');
const wrongCrew=await call({action:'issue-attendance',companyId:COMPANY,slotId:SLOT});
assert.equal(wrongCrew.data.state,'HOLD','Owner must not issue crew challenge');
const foreign=await call({action:'issue-attendance',companyId:COMPANY,slotId:SLOT},{as:FOREIGN});
assert.equal(foreign.data.state,'HOLD','Foreign actor cannot issue');
const issued=await call({action:'issue-attendance',companyId:COMPANY,slotId:SLOT},{as:CREW});
assert.equal(issued.data.state,'CREW_CHALLENGE_ISSUED_NOT_ATTESTED');
assert.equal(issued.data.hardwareAttested,false);
const kp=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const jwk=await webcrypto.subtle.exportKey('jwk',kp.publicKey);
const sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,utf(issued.data.message));
const b64=Buffer.from(sig).toString('base64url');
const forgedSig=await call({action:'submit-attendance',companyId:COMPANY,
 challengeId:issued.data.challengeId,publicJwk:jwk,signature:'A'.repeat(86)},{as:CREW});
assert.equal(forgedSig.data.state,'HOLD','Forged browser proof must HOLD');
assert.equal(rows.ywi_594_attendance_proofs.length,0);
const signed=await call({action:'submit-attendance',companyId:COMPANY,
 challengeId:issued.data.challengeId,publicJwk:jwk,signature:b64},{as:CREW});
assert.equal(signed.data.state,'ORIGINAL_CREW_BROWSER_SIGNATURE_VERIFIED');
assert.equal(signed.data.hardwareAttested,false);
const ownerWithoutConsent=await call({action:'owner-observe',companyId:COMPANY,proofId:PROOF});
assert.equal(ownerWithoutConsent.data.state,'HOLD');
const observe=await call({action:'owner-observe',companyId:COMPANY,
 proofId:PROOF,attestCoPresence:true});
assert.equal(observe.data.state,'HUMAN_OWNER_COPRESENCE_ATTESTED');
const ownerCannotCertify=await call({action:'reviewer-certify',companyId:COMPANY,
 proofId:PROOF,attestInPerson:true});
assert.equal(ownerCannotCertify.data.state,'HOLD');
const noAck=await call({action:'reviewer-certify',companyId:COMPANY,
 proofId:PROOF,attestInPerson:true},{as:REVIEWER});
assert.equal(noAck.data.state,'HOLD','No original signed Master ACK and contract');
const noContract=await call({action:'check-contract-drift',companyId:COMPANY});
assert.equal(noContract.data.state,'HOLD','No receiver baseline must not create signed MATCH');
assert.equal(rows.ywi_594_field_certificates.length,0);
assert.equal(rows.ywi_594_receiver_drift_alerts.length,0);
const badOrigin=await call({action:'overview',companyId:COMPANY},{origin:'https://evil.invalid'});
assert.equal(badOrigin.status,403);
assert.equal(trace.some(x=>x.includes('storage/v1/object')),false,'No fake byte read on absent Master');
console.log('YW594 PASS: real P256 fixture signature, distinct original principals, signed YW593 window, tenant isolation, explicit co-presence, default Master/contract HOLD; no hardware or human certification invented.');
