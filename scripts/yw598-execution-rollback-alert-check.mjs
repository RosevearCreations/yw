// YW598: CI-only fabricated fixtures NEVER leave this isolated JS VM or count as field evidence.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(p,'utf8');
const edge=file('supabase/functions/yw598-original-cutover-rollback-alert/index.ts');
const sql=file('sql/yw598_execution_rollback_signed_alert_delivery.sql');
const ui=file('js/yw598-original-master-cutover-alert.js');
const html=file('index.html'),cfg=file('supabase/config.toml');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const [COMPANY,OTHER,OWNER,REVIEWER,CREW,SYSOP,OUTSIDER,JOB]=Array.from({length:8},(_,i)=>uid(i+1));
const iso=n=>new Date(n).toISOString();
const now=Date.now();
assert.match(cfg,/\[functions\.yw598-original-cutover-rollback-alert\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw598-original-master-cutover-alert\.js/);
assert.match(html,/yw598-original-master-cutover-alert\.css/);
assert.match(ui,/auth\.getUser\(\)/);
assert.doesNotMatch(ui,/innerHTML\s*=|localStorage\.|YW592_MASTER_ACK_KEY/);
for(const table of ['execution_receipts','execution_witnesses','rollback_receipts',
 'rollback_drills','alert_consents','alert_deliveries'])
 assert.match(sql,new RegExp('create table public\\.ywi_598_'+table));
assert.equal((sql.match(/enable row level security;/g)||[]).length,6);
assert.equal((sql.match(/create policy yw598_/g)||[]).length,6);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,6);
assert.equal((sql.match(/grant execute on function public\.ywi_598_/g)||[]).length,6);
assert.equal((sql.match(/commit;/g)||[]).length,1);
assert.match(sql,/remote_rollback_reported boolean not null check\(remote_rollback_reported=true\)/);
assert.match(sql,/reviewer_physically_witnessed boolean not null check\(reviewer_physically_witnessed=true\)/);
assert.match(sql,/actual_customer_notification boolean not null default false check\(actual_customer_notification=false\)/);
assert.match(sql,/reference(s)? public\.ywi_597_health_alerts/);
assert.doesNotMatch(sql,/\bdelete from\b|\btruncate\b|\bdrop table\b|\bdisable row level security\b/i);
for(const target of ['YW598-EXEC-OLD','YW598-EXEC-NEXT',
 'YW598-ROLLBACK-OLD','YW598-ROLLBACK-NEXT','YW598-ALERT-ACK'])
 assert.match(edge,new RegExp(target));
assert.match(edge,/YW597_CUTOVER_HMAC_KEY/);
assert.match(edge,/YW597_HEALTH_HMAC_KEY/);
assert.match(edge,/redirect:'error'/);
assert.match(edge,/noRemoteMutation:true/);
assert.match(edge,/noSourceBytes:true/);
assert.match(edge,/noCustomerMessage:true/);
assert.doesNotMatch(edge,/auth\.admin|publicUrl|storage\/v1\/object\/remove|generateLink/);
const secret={SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-private-service-only',
 YW597_CUTOVER_HMAC_KEY:'fixture-private-human-key',
 YW597_HEALTH_HMAC_KEY:'fixture-private-health-key',
 YW592_MASTER_RECEIPT_URL:'https://receiver.fixture.invalid/endpoint',
 YW593_MASTER_ALLOWED_HOST:'receiver.fixture.invalid',
 YW592_MASTER_ACK_KEY:'fixture-master-old-private',
 YW596_RECEIVER_NEXT_ACK_KEY:'fixture-master-next-private',
 YW595_ROTATION_HMAC_KEY:'fixture-private-rotation-signoff',
 YW592_TELEMETRY_SEND_KEY:'fixture-private-source-outbound-signer'};
const records={
 profiles:[{id:OWNER,role:'owner',is_active:true},
  {id:REVIEWER,role:'reviewer',is_active:true},
  {id:CREW,role:'crew',is_active:true},
  {id:SYSOP,role:'admin',is_active:true},
  {id:OUTSIDER,role:'customer',is_active:true}],
 ywi_companies:[{id:COMPANY,owner_user_id:OWNER},{id:OTHER,owner_user_id:OUTSIDER}],
 ywi_591_tenant_pilots:[{company_id:COMPANY,owner_user_id:OWNER,
  reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',
  expires_at:iso(now+86400000)}],
 ywi_platform_administrators_489:[{user_id:SYSOP}],
 ywi_598_execution_receipts:[],ywi_598_execution_witnesses:[],
 ywi_598_rollback_receipts:[],ywi_598_rollback_drills:[],
 ywi_598_alert_consents:[],ywi_598_alert_deliveries:[],
 ywi_597_cutover_approvals:[],ywi_597_cutover_intents:[],
 ywi_597_health_alerts:[],ywi_597_health_enrollments:[],
 ywi_597_health_samples:[],
 ywi_596_rotation_proofs:[],ywi_596_canary_acks:[],
 ywi_595_rotation_proposals:[],ywi_595_rotation_signoffs:[],
 ywi_593_receiver_contracts:[],ywi_592_master_receipts:[],
 ywi_591_photo_attempts:[]
};
const utf=s=>new TextEncoder().encode(s);
const hex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const digest=async msg=>hex(await webcrypto.subtle.digest('SHA-256',utf(msg)));
const mac=async(msg,k)=>hex(await webcrypto.subtle.sign('HMAC',
 await webcrypto.subtle.importKey('raw',utf(k),
  {name:'HMAC',hash:'SHA-256'},false,['sign']),utf(msg)));
let user=OWNER,handler;const calls=[];
async function fakeFetch(raw,opts={}){
 const path=new URL(raw).pathname;calls.push({path,method:opts.method||'GET'});
 if(path==='/auth/v1/user')return Response.json({id:user});
 if(path.startsWith('/rest/v1/rpc/')){
  const args=JSON.parse(opts.body||'{}');
  if(path.endsWith('/ywi_598_consent_alert_channel')){
   if(args.p_company_id!==COMPANY||args.p_owner_user_id!==OWNER)
    return Response.json({error:'not owner'},403);
   records.ywi_598_alert_consents.push({
    id:uid(40),company_id:COMPANY,owner_user_id:OWNER,
    approved_channel:'ORIGINAL_PINNED_MASTER_ACK_ONLY',signed_at:args.p_signed_at,
    evidence_sha256:args.p_evidence_sha256,server_hmac_sha256:args.p_hmac,
    explicit_owner_consent:true,no_customer_notification:true});
   return Response.json({state:'ORIGINAL_OWNER_PINNED_MASTER_ALERT_HANDOFF_OPTED_IN',
    consentId:uid(40),customerMessageSent:false});
  }
  return Response.json({error:'No independently verified original execution or health source'},403);
 }
 if(path.startsWith('/rest/v1/')){
  const table=path.slice('/rest/v1/'.length);
  if(!Object.hasOwn(records,table))return Response.json({error:'Fixture table missing'},404);
  let result=records[table],query=new URL(raw).searchParams;
  for(const [k,v]of query)if(k!=='select'&&k!=='limit')
   result=result.filter(x=>String(x[k])===v.slice(3));
  return Response.json(result.slice(0,Number(query.get('limit')||25)));
 }
 throw Error('Unexpected network request: '+path);
}
vm.runInNewContext(edge,{
 Deno:{serve:fn=>handler=fn,env:{get:k=>secret[k]}},
 crypto:webcrypto,fetch:fakeFetch,TextEncoder,Uint8Array,Response,Request,
 URL,URLSearchParams,Date,JSON,Array,Object,Set,Promise,Error,AbortSignal
});
async function call(action,payload={},as=OWNER,origin='https://yw-alpha.vercel.app'){
 user=as;
 const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw598-original-cutover-rollback-alert',{
  method:'POST',headers:{origin,'content-type':'application/json',
   authorization:'Bearer a.b.c'},body:JSON.stringify({action,...payload})}));
 return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():{}};
}
let x=await call('overview',{companyId:COMPANY});
assert.equal(x.status,200);assert.equal(x.data.execution.length,0);
x=await call('overview',{companyId:OTHER});
assert.equal(x.data.state,'HOLD','Real company with no approved original pilot must HOLD');
x=await call('sysop-read-execution',{
 companyId:COMPANY,approvalId:uid(41),confirmExternallyPerformed:true},OWNER);
assert.equal(x.data.state,'HOLD');
x=await call('sysop-read-execution',{
 companyId:COMPANY,approvalId:uid(41),confirmExternallyPerformed:true},SYSOP);
assert.equal(x.data.state,'HOLD','Even sysop with no original signed cutover must HOLD');
x=await call('owner-witness-execution',{companyId:COMPANY,
 executionId:uid(42),confirmPersonallyObservedActualCutover:true});
assert.equal(x.data.state,'HOLD');
x=await call('sysop-read-rollback',{companyId:COMPANY,
 witnessId:uid(43),confirmExternalPhysicalRollbackAlreadyDone:true},SYSOP);
assert.equal(x.data.state,'HOLD');
x=await call('reviewer-witness-rollback',{companyId:COMPANY,
 rollbackReceiptId:uid(44),confirmReviewerPersonallyWitnessedRollback:true},REVIEWER);
assert.equal(x.data.state,'HOLD');
x=await call('owner-alert-consent',{companyId:COMPANY});
assert.equal(x.data.state,'HOLD');
x=await call('owner-alert-consent',{companyId:COMPANY,
 confirmRedactedPinnedMasterOnly:true},REVIEWER);
assert.equal(x.data.state,'HOLD');
x=await call('owner-alert-consent',{companyId:COMPANY,
 confirmRedactedPinnedMasterOnly:true},OWNER);
assert.equal(x.data.state,'ORIGINAL_OWNER_PINNED_MASTER_ALERT_HANDOFF_OPTED_IN');
assert.equal(x.data.customerMessageSent,false);
assert.equal(records.ywi_598_alert_consents.length,1);
x=await call('owner-deliver-health-alert',{companyId:COMPANY,
 consentId:uid(40),alertId:uid(45),confirmDeliverToOriginalMasterOnly:true});
assert.equal(x.data.state,'HOLD','Cannot deliver a synthetic/missing health alert');
x=await call('overview',{companyId:COMPANY},OWNER,'https://spoof.invalid');
assert.equal(x.status,403);
assert.equal(records.ywi_598_execution_receipts.length,0);
assert.equal(records.ywi_598_execution_witnesses.length,0);
assert.equal(records.ywi_598_rollback_receipts.length,0);
assert.equal(records.ywi_598_rollback_drills.length,0);
assert.equal(records.ywi_598_alert_deliveries.length,0);
assert.equal(calls.some(x=>x.path.includes('/storage/v1/object/')),false);
assert.equal(calls.some(x=>x.path.includes('/endpoint')),false);
console.log('YW598 PASS: original owner-only explicit consent; unapproved sysop, foreign company, nonexistent remote execution, nonexistent physical rollback, missing health alert and forged origins all HOLD; zero fake receiver receipts or customer delivery.');
