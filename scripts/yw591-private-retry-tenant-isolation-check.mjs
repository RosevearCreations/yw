// YW591: exercise the actual independent Edge handler against disposable
// two-tenant Auth / PostgREST / private binary Storage. Zero live mutations.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const code=readFileSync('supabase/functions/yw591-photo-recovery/index.ts','utf8');
const sql=readFileSync('sql/yw591_private_photo_retry_opt_in_multitenant.sql','utf8');
const ui=readFileSync('js/yw591-private-recovery.js','utf8');
const html=readFileSync('index.html','utf8');
const id=n=>'59100000-0000-4591-8591-'+String(n).padStart(12,'0');
const C='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
const B=id(90),CL=id(20),SITE=id(21),JOB=id(22),R=id(23);
const OWNER=id(1),REVIEWER=id(2),CREW=id(3),DISPATCH=id(4);
const OWNER_B=id(11),REVIEWER_B=id(12),CREW_B=id(13),DISPATCH_B=id(14);
const REQ=id(25),REQ2=id(26),ATT=id(27),ATT2=id(28);
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(3)]);
const bytesHash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',png)),v=>v.toString(16).padStart(2,'0')).join('');
const bad=new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(9)]);
let actor=OWNER,service=true,billed=false,linked=true,denyFinalize=false,nowExpired=false;
const pilots=new Map(),staff=[],attempts=[],events=[],stored=new Map(),trace=[];
const people=[OWNER,REVIEWER,CREW,DISPATCH,OWNER_B,REVIEWER_B,CREW_B,DISPATCH_B];
const ownerFor=new Map([[C,OWNER],[B,OWNER_B]]);
const companyFor=new Map([[OWNER,C],[REVIEWER,C],[CREW,C],[DISPATCH,C],
 [OWNER_B,B],[REVIEWER_B,B],[CREW_B,B],[DISPATCH_B,B]]);
const filePath=(company,request)=>company+'/'+JOB+'/'+request+'.png';
function props(table){
 if(table==='profiles')return people.map(id=>({id,is_active:true,role:'employee'}));
 if(table==='ywi_companies')return [...ownerFor].map(([id,owner_user_id])=>({id,owner_user_id}));
 if(table==='ywi_591_tenant_pilots')return [...pilots.values()];
 if(table==='ywi_591_pilot_staff')return staff;
 if(table==='ywi_591_photo_attempts')return attempts;
 if(table==='work_orders')return [{id:JOB,company_id:C,client_id:CL,client_site_id:SITE,
  service_module_key:'landscape',status:'draft',total_amount:0,subtotal:0,tax_total:0,
  completion_ready_for_accounting:false}];
 if(table==='job_invoice_candidates')return billed?[{id:id(81),work_order_id:JOB}]:[];
 if(table==='ar_invoices')return [];
 if(table==='ywi_company_service_modules')return [{company_id:C,module_key:'landscape',enabled:service}];
 if(table==='ywi_company_client_links_422')return linked?[{company_id:C,client_id:CL}]:[];
 if(table==='ywi_company_site_links_422')return linked?[{company_id:C,client_id:CL,client_site_id:SITE}]:[];
 return null;
}
const reply=(d,status=200)=>Response.json(d,{status});
function pr(action,p){
 const company=p.p_company_id,grant=pilots.get(company);
 if(action==='ywi_591_pilot_action'){
  if(p.p_action==='propose'){
   if(company!==C||actor!==OWNER||p.p_reviewer_user_id===actor||!service||billed||!linked)
    return reply({error:'denied'},403);
   pilots.set(company,{company_id:company,owner_user_id:OWNER,reviewer_user_id:REVIEWER,
    client_id:CL,client_site_id:SITE,work_order_id:JOB,state:'PROPOSED',
    approved_at:null,expires_at:new Date(Date.now()+86400000).toISOString()});
   return reply({state:'PROPOSED'});
  }
  if(p.p_action==='approve'){
   if(actor!==grant?.reviewer_user_id)return reply({error:'independent reviewer only'},403);
   grant.state='APPROVED';grant.approved_at=new Date().toISOString();
   return reply({state:'APPROVED'});
  }
  if(p.p_action==='nominate-staff'){
   if(actor!==grant?.owner_user_id||grant.state!=='APPROVED')return reply({},403);
   staff.push({company_id:company,user_id:p.p_staff_user_id,role:p.p_staff_role,state:'NOMINATED'});
   return reply({state:'STAFF_NOMINATED'});
  }
  if(p.p_action==='approve-staff'){
   if(actor!==grant?.reviewer_user_id)return reply({},403);
   const s=staff.find(s=>s.company_id===company&&s.user_id===p.p_staff_user_id&&s.role===p.p_staff_role);
   if(!s||s.state!=='NOMINATED')return reply({},403);s.state='APPROVED';
   return reply({state:'STAFF_APPROVED'});
  }
  if(p.p_action==='revoke'){
   if(actor!==grant?.owner_user_id&&actor!==grant?.reviewer_user_id)return reply({},403);
   grant.state='REVOKED';return reply({state:'REVOKED'});
  }
  if(p.p_action==='revoke-staff'){
   const s=staff.find(s=>s.company_id===company&&s.user_id===p.p_staff_user_id&&s.role===p.p_staff_role);
   if(!s||![grant?.owner_user_id,grant?.reviewer_user_id].includes(actor))return reply({},403);
   s.state='REVOKED';return reply({state:'STAFF_REVOKED'});
  }
 }
 if(action==='ywi_591_reserve_attempt'){
  if(actor!==CREW||!staff.some(s=>s.company_id===company&&s.user_id===CREW&&s.role==='crew'&&s.state==='APPROVED')||
    grant?.state!=='APPROVED'||!service||billed||!linked||p.p_work_order_id!==JOB)
   return reply({error:'pilot or finance blocked'},403);
  let a=attempts.find(x=>x.company_id===company&&x.work_order_id===JOB);
  if(a&&(a.request_id!==p.p_request_id||a.content_sha256!==p.p_content_sha256||
     a.uploaded_by!==actor||a.content_type!==p.p_content_type||a.byte_count!==p.p_byte_count))
   return reply({error:'conflicting request'},409);
  if(!a){
   a={id:attempts.length?ATT2:ATT,company_id:company,work_order_id:JOB,
    request_id:p.p_request_id,content_sha256:p.p_content_sha256,
    byte_count:p.p_byte_count,content_type:p.p_content_type,object_key:p.p_object_key,
    uploaded_by:actor,state:'RESERVED',
    lease_expires_at:new Date(Date.now()+86400000).toISOString()};
   attempts.push(a);
  }
  return reply({state:a.state,attemptId:a.id,leaseExpiresAt:a.lease_expires_at});
 }
 if(action==='ywi_591_finalize_attempt'){
  const a=attempts.find(x=>x.id===p.p_attempt_id&&x.company_id===company);
  if(denyFinalize){denyFinalize=false;return reply({error:'induced post-upload DB failure'},503);}
  if(!a||a.uploaded_by!==actor||a.content_sha256!==p.p_server_sha256||
    grant?.state!=='APPROVED'||billed)return reply({error:'not finalizable'},403);
  if(a.state==='VERIFIED')return reply({state:'VERIFIED',idempotent:true});
  a.state='VERIFIED';a.stored_sha256=p.p_server_sha256;
  events.push({company_id:company,event:p.p_recovered?'RECOVERED_STORED_OBJECT':'SERVER_BYTES_VERIFIED'});
  return reply({state:'VERIFIED',attemptId:a.id,serverHashVerified:true});
 }
 if(action==='ywi_591_quarantine_attempt'){
  const a=attempts.find(x=>x.id===p.p_attempt_id&&x.company_id===company);
  if(actor!==REVIEWER||!a||a.state!=='RESERVED'||p.p_observed_sha256===a.content_sha256)
   return reply({error:'reviewer and mismatch required'},403);
  a.state='QUARANTINED';events.push({company_id:company,event:'QUARANTINED'});
  return reply({state:'QUARANTINED',objectDeleted:false});
 }
 return reply({message:'unexpected RPC '+action},404);
}
async function net(url,opts={}){
 const u=new URL(url),path=u.pathname,method=opts.method||'GET';
 trace.push({method,path});
 if(path==='/auth/v1/user')return reply({id:actor});
 if(path.startsWith('/rest/v1/rpc/')){
  return pr(path.split('/').at(-1),JSON.parse(opts.body));
 }
 if(path.startsWith('/rest/v1/')){
  const name=path.slice('/rest/v1/'.length),rows=props(name);
  if(rows===null)return reply({message:'unknown table'},404);
  if(method!=='GET')return reply({message:'unexpected direct write'},403);
  let filtered=rows;
  for(const [key,val] of u.searchParams.entries()){
   if(key==='select'||key==='limit')continue;
   if(!val.startsWith('eq.'))return reply({},400);
   filtered=filtered.filter(x=>String(x[key])===val.slice(3));
  }
  return reply(filtered.slice(0,Number(u.searchParams.get('limit')||3)));
 }
 if(path.startsWith('/storage/v1/object/authenticated/')){
  const key=decodeURIComponent(path.slice('/storage/v1/object/authenticated/'.length));
  return stored.has(key)?new Response(stored.get(key),{status:200}):reply({message:'not found'},404);
 }
 if(path.startsWith('/storage/v1/object/')){
  const key=decodeURIComponent(path.slice('/storage/v1/object/'.length));
  if(method!=='POST')return reply({error:'only create'},403);
  if(stored.has(key))return reply({error:'not upsertable'},409);
  stored.set(key,new Uint8Array(opts.body));
  return reply({key},201);
 }
 throw Error('Unexpected external I/O '+method+' '+url);
}
let handler;vm.runInNewContext(code,{
 Deno:{serve:fn=>handler=fn,env:{get:name=>name==='SUPABASE_URL'?'https://test.supabase.invalid':
 name==='SUPABASE_SERVICE_ROLE_KEY'?'server-only-key':null}},
 fetch:net,crypto:webcrypto,Response,Request,File,FormData,Blob,URL,URLSearchParams,
 Uint8Array,ArrayBuffer,Date,Error,Object,JSON,Map,Set,Number,String,Array,Promise,console
});
async function call(data,asForm=false){
 let body,headers={Authorization:'Bearer aaa.bbb.ccc',Origin:'https://yw-alpha.vercel.app'};
 if(asForm){
  const f=new FormData();
  const values={...data,consent:'true',consentScope:'private_original_job'};
  for(const [key,value] of Object.entries(values))f.set(key,String(value));
  f.set('photo',new File([png],'original.png',{type:'image/png'}));body=f;
 }else{headers['Content-Type']='application/json';body=JSON.stringify(data);}
 const req=new Request('https://test.supabase.invalid/functions/v1/yw591-photo-recovery',{
  method:'POST',headers,body});
 const res=await handler(req);
 if(data.action==='dispatcher-preview'&&res.ok&&res.headers.get('Content-Type')==='image/png')
  return {status:res.status,bytes:new Uint8Array(await res.arrayBuffer())};
 return {status:res.status,data:await res.json()};
}
function assertHold(v,reason){assert.equal(v.data?.state,'HOLD',reason);assert.equal(v.data?.tenantIsolationEnforced,true,reason);}
assertHold(await call({action:'pilot-status',companyId:B}),'foreign company not visible');
assertHold(await call({action:'pilot-approve',companyId:C}),'owner cannot independently approve');
const base={companyId:C,jobId:JOB,clientId:CL,siteId:SITE,reviewerUserId:REVIEWER};
service=false;assertHold(await call({action:'pilot-propose',...base}),'disabled landscape entitlement');service=true;
billed=true;assertHold(await call({action:'pilot-propose',...base}),'original invoice must block');billed=false;
linked=false;assertHold(await call({action:'pilot-propose',...base}),'original client link missing');linked=true;
assert.equal((await call({action:'pilot-propose',...base})).data.state,'PROPOSED');
assert.equal(pilots.get(C)?.state,'PROPOSED');
actor=CREW;assertHold(await call({action:'pilot-approve',companyId:C}),'crew cannot approve');
actor=REVIEWER;assert.equal((await call({action:'pilot-approve',companyId:C})).data.state,'APPROVED');
actor=OWNER;
assert.equal((await call({action:'staff-nominate',companyId:C,staffUserId:CREW,staffRole:'crew'})).data.state,'STAFF_NOMINATED');
assert.equal((await call({action:'staff-nominate',companyId:C,staffUserId:DISPATCH,staffRole:'dispatcher'})).data.state,'STAFF_NOMINATED');
actor=REVIEWER;
assert.equal((await call({action:'staff-approve',companyId:C,staffUserId:CREW,staffRole:'crew'})).data.state,'STAFF_APPROVED');
assert.equal((await call({action:'staff-approve',companyId:C,staffUserId:DISPATCH,staffRole:'dispatcher'})).data.state,'STAFF_APPROVED');
const formBase={action:'capture',companyId:C,jobId:JOB,requestId:REQ,deviceSha256:bytesHash};
actor=CREW_B;assertHold(await call(formBase,true),'cross-tenant actor upload rejected');
actor=CREW;const wrongHash={...formBase,deviceSha256:'f'.repeat(64)};
assertHold(await call(wrongHash,true),'device/server hash mismatch');
const badId=await call({...formBase,requestId:REQ2},true);
assert.equal(badId.data.state,'PRIVATE_NEW_OBJECT_VERIFIED');
assert.equal(attempts.length,1);assert.equal(stored.size,1);
assert.equal((await call({...formBase,requestId:REQ2},true)).data.idempotentReplay,true);
const conflict=await call(formBase,true);assertHold(conflict,'distinct original request cannot overwrite');
assert.equal(stored.size,1);
actor=DISPATCH_B;assertHold(await call({action:'dispatcher-preview',companyId:C,jobId:JOB,attemptId:ATT}),
 'cross tenant dispatcher denied');
actor=DISPATCH;const preview=await call({action:'dispatcher-preview',companyId:C,jobId:JOB,attemptId:ATT});
assert.equal(preview.status,200);assert.deepEqual(preview.bytes,png);
actor=CREW;service=false;assertHold(await call({...formBase,requestId:REQ2},true),'disabled service when reserved');
service=true;
actor=OWNER_B;assertHold(await call({action:'pilot-revoke',companyId:C}),'another tenant cannot revoke');
actor=OWNER;assert.equal((await call({action:'pilot-revoke',companyId:C})).data.state,'REVOKED');
actor=CREW;assertHold(await call({...formBase,requestId:REQ2},true),'revoke stops replay');
assert.equal(stored.size,1);assert.equal(events.length,1);
assert.ok(trace.every(x=>!/^POST \/rest\/v1\/(ar_invoices|job_invoice_candidates|work_orders|profiles)/.test(x.method+' '+x.path)));

// Independent recover-after-storage proof on a SECOND isolated test fixture.
// No live company B Auth accounts or production photos are created.
pilots.get(C).state='APPROVED';
const existing=attempts[0];attempts.splice(0);stored.clear();events.length=0;
denyFinalize=true;actor=CREW;
const first=await call(formBase,true);assertHold(first,'DB finalize failed after successful private upload');
assert.equal(attempts.length,1);assert.equal(stored.size,1);
const resume=await call({action:'resume',companyId:C,jobId:JOB,requestId:REQ});
assert.equal(resume.data.state,'PRIVATE_ORPHAN_OBJECT_RECONCILED');
assert.equal(resume.data.serverVerified,true);assert.equal(resume.data.recoveredAfterRetry,true);
assert.equal((await call({action:'resume',companyId:C,jobId:JOB,requestId:REQ})).data.idempotentReplay,true);

// Third isolated fixture: mismatch is not overwritten or deleted; a
// distinct real reviewer alone may sign a quarantine event.
attempts.length=0;stored.clear();events.length=0;
denyFinalize=true;const fail=await call(formBase,true);assertHold(fail,'created reserved orphan');
stored.set('ywi-private-device-evidence-589/'+filePath(C,REQ),bad);
assertHold(await call({action:'resume',companyId:C,jobId:JOB,requestId:REQ}),'tampered source held');
actor=OWNER;assertHold(await call({action:'quarantine',companyId:C,jobId:JOB,attemptId:ATT}),'owner not reviewer');
actor=REVIEWER;
assert.equal((await call({action:'quarantine',companyId:C,jobId:JOB,attemptId:ATT})).data.state,'QUARANTINED');
assert.equal(attempts[0].state,'QUARANTINED');assert.equal(stored.size,1);
assert.equal(events.at(-1).event,'QUARANTINED');
for(const text of ['enable row level security','yw591_owner_pilot_read',
 'ywi_591_reserve_attempt','ywi_591_finalize_attempt','ywi_591_quarantine_attempt',
 'owner_user_id<>reviewer_user_id','revoke all on public.ywi_591_tenant_pilots',
 'on conflict(company_id,work_order_id) do nothing','unique(company_id,work_order_id)',
 'one-way original attempt state','grant execute on function',
 'expires_at<=proposed_at+interval \'7 days\'']){
 assert.ok(sql.includes(text),'SQL authority missing '+text);
}
assert.ok(ui.includes("AES-GCM"));assert.ok(ui.includes("false,['encrypt','decrypt']"));
assert.ok(html.includes('/js/yw591-private-recovery.js'));
console.log('YW591 PASS: real YW591 Edge HTTP handler tested with two independent Auth company principals, owner/reviewer approvals, crew/dispatcher gating, private binary storage, idempotent collision refusal, post-upload orphan reconciliation and reviewer-only quarantine. Production unmodified.');
