// YW593 source-only adversarial checks; fixture identities are NEVER real field witnesses.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const edge=read('supabase/functions/yw593-field-recovery-contract/index.ts');
const sql=read('sql/yw593_field_witness_expiry_master_contract.sql');
const ui=read('js/yw593-field-recovery.js');
const html=read('index.html');
const cfg=read('supabase/config.toml');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const C=id(1),OTHER=id(2),OWNER=id(3),REVIEWER=id(4),CREW=id(5),
 ATT=id(6),JOB=id(7),FOREIGN=id(8),SLOT=id(9);
assert.match(cfg,/\[functions\.yw593-field-recovery-contract\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw593-field-recovery\.js/);
assert.match(html,/yw593-field-recovery\.css/);
assert.match(ui,/auth\.getUser\(\)/);
assert.match(ui,/textContent/);
assert.doesNotMatch(ui,/innerHTML\s*=/);
for(const s of ['ywi_593_witness_slots','ywi_593_witness_approvals',
 'ywi_593_expiry_escalations','ywi_593_receiver_contracts'])
 assert.match(sql,new RegExp('create table public\\.'+s));
assert.equal((sql.match(/enable row level security;/g)||[]).length,4);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,4);
assert.doesNotMatch(sql,/\btruncate\b|\bdrop table\b|\bdelete from\b/i);
assert.doesNotMatch(edge,/storage\/v1\/object\/remove|publicUrl|auth\.admin|upsert:true/);
assert.match(edge,/YW593_MASTER_ALLOWED_HOST/);
assert.match(edge,/YW592_MASTER_ACK_KEY/);
assert.match(edge,/decisionValid/);
assert.match(edge,/crypto\.subtle\.verify/);
assert.match(edge,/originalPhysicalWitnessCertified:false/);
let handler,actor=OWNER,trace=[],now=Date.now();
const future=new Date(now+3600000).toISOString(),end=new Date(now+7200000).toISOString();
const rows={
 profiles:[{id:OWNER,is_active:true},{id:REVIEWER,is_active:true},
  {id:CREW,is_active:true},{id:FOREIGN,is_active:true}],
 ywi_companies:[{id:C,owner_user_id:OWNER},{id:OTHER,owner_user_id:FOREIGN}],
 ywi_591_tenant_pilots:[{company_id:C,owner_user_id:OWNER,
  reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',
  expires_at:new Date(now+86400000).toISOString()},
  {company_id:OTHER,owner_user_id:FOREIGN,
   reviewer_user_id:id(22),work_order_id:id(23),state:'APPROVED',
   expires_at:new Date(now+86400000).toISOString()}],
 ywi_591_photo_attempts:[{id:ATT,company_id:C,work_order_id:JOB,uploaded_by:CREW,
  content_sha256:'a'.repeat(64),stored_sha256:'a'.repeat(64),state:'VERIFIED',
  lease_expires_at:new Date(now-3600000).toISOString()}],
 ywi_593_witness_slots:[],ywi_593_witness_approvals:[],
 ywi_593_expiry_escalations:[],ywi_593_receiver_contracts:[],
 ywi_592_case_proposals:[],ywi_592_case_decisions:[]
};
const response=(obj,status=200)=>Response.json(obj,{status});
async function fakeFetch(url,opt={}){
 const u=new URL(url),p=u.pathname;trace.push((opt.method||'GET')+' '+p);
 if(p==='/auth/v1/user')return response({id:actor});
 if(p.startsWith('/rest/v1/rpc/')){
  const data=JSON.parse(opt.body||'{}');
  if(p.endsWith('/ywi_593_schedule_witness'))
   return response({state:'WITNESS_PROPOSED_PENDING_DISTINCT_REVIEW',
    slotId:SLOT,physicalFieldWitnessCertified:false,
    ownerActor:data.p_owner_user_id,crewActor:data.p_crew_user_id});
  if(p.endsWith('/ywi_593_approve_witness'))
   return response({state:'WITNESS_WINDOW_APPROVED_NOT_OBSERVED',slotId:data.p_slot_id,
    signatureRecorded:/^[a-f0-9]{64}$/.test(data.p_server_hmac),
    physicalFieldWitnessCertified:false});
  throw Error('An unauthorized RPC was attempted '+p);
 }
 if(p.startsWith('/rest/v1/')){
  const table=p.replace('/rest/v1/','');
  if(!Object.hasOwn(rows,table))return response({error:'No fixture table'},404);
  let found=rows[table];
  for(const [k,v]of u.searchParams)if(!['select','limit'].includes(k))
   found=found.filter(item=>String(item[k])===v.slice(3));
  return response(found.slice(0,Number(u.searchParams.get('limit')||25)));
 }
 throw Error('Unexpected external network dependency: '+p);
}
vm.runInNewContext(edge,{Deno:{serve:fn=>handler=fn,env:{get:k=>({
 SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-service-secret',
 YW593_WITNESS_HMAC_KEY:'fixture-distinct-witness-signature',
 YW592_DECISION_HMAC_KEY:'fixture-decision-signature',
 YW592_TELEMETRY_SEND_KEY:'fixture-telemetry-signature',
 YW592_MASTER_ACK_KEY:'fixture-master-ack-signature'
})[k]}},fetch:fakeFetch,crypto:webcrypto,Response,Request,
 URL,URLSearchParams,Uint8Array,ArrayBuffer,AbortSignal,Date,TextEncoder,
 Error,Object,JSON,Map,Set,Number,String,Array,Promise,console});
async function call(body,{as=OWNER,origin='https://yw-alpha.vercel.app'}={}){
 actor=as;const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw593-field-recovery-contract',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc',
   origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():{}};
}
const empty=await call({action:'overview',companyId:C});
assert.equal(empty.status,200);
assert.deepEqual(Array.from(empty.data.witnesses),[]);
assert.deepEqual(Array.from(empty.data.escalations),[]);
const foreign=await call({action:'overview',companyId:OTHER});
assert.equal(foreign.data.state,'HOLD','Original owner denied foreign tenant');
const notReviewer=await call({action:'approve-witness',companyId:C,slotId:SLOT});
assert.equal(notReviewer.data.state,'HOLD');
const forged=await call({action:'overview',companyId:C},{origin:'https://attacker.invalid'});
assert.equal(forged.status,403);
const badCrew=await call({action:'schedule',companyId:C,attemptId:ATT,crewUserId:FOREIGN,
 startsAt:future,endsAt:end});
assert.equal(badCrew.data.state,'HOLD','Cannot schedule somebody other than original uploader');
const good=await call({action:'schedule',companyId:C,attemptId:ATT,crewUserId:CREW,
 startsAt:future,endsAt:end});
assert.equal(good.data.state,'WITNESS_PROPOSED_PENDING_DISTINCT_REVIEW');
assert.equal(good.data.physicalFieldWitnessCertified,false);
rows.ywi_593_witness_slots=[{id:SLOT,company_id:C,attempt_id:ATT,
 owner_user_id:OWNER,reviewer_user_id:REVIEWER,crew_user_id:CREW,
 starts_at:future,ends_at:end,proposed_at:new Date(now).toISOString()}];
const approved=await call({action:'approve-witness',companyId:C,slotId:SLOT},{as:REVIEWER});
assert.equal(approved.data.state,'WITNESS_WINDOW_APPROVED_NOT_OBSERVED');
assert.equal(approved.data.signatureRecorded,true);
const noSignedDecision=await call({action:'escalate-expiry',companyId:C,
 attemptId:ATT,proposalId:id(20),reasonCode:'LEASE_EXPIRED'},{as:REVIEWER});
assert.equal(noSignedDecision.data.state,'HOLD');
const receiverHold=await call({action:'probe-receiver-contract',companyId:C});
assert.equal(receiverHold.data.state,'HOLD','Receiver not fabricated when not enrolled');
assert.equal(trace.some(x=>x.includes('ywi_593_record_receiver_contract')),false);
assert.equal(trace.some(x=>x.includes('ywi_593_escalate_expiry')),false);
console.log('YW593 PASS: exact-source field schedule, distinct reviewer, tenant separation, signed reviewer payload, expiry and receiver HOLD; no physical witness invented.');
