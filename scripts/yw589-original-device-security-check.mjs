// YW589: exercise the actual Deno Edge request handler with network/storage
// and Auth fixtures. No real user, photo, invoice or remote database mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const code=readFileSync('supabase/functions/yw589-original-device-photo/index.ts','utf8');
const sql=readFileSync('sql/yw589_original_device_custody_PRIVATE_OPT_IN.sql','utf8');
const ui=readFileSync('js/yw589-original-device-pilot.js','utf8');
const index=readFileSync('index.html','utf8');
const uuid=x=>'58900000-0000-4589-8589-'+String(x).padStart(12,'0');
const C='03bcf48e-a4f5-4427-9aba-b0f91f39b16b',CL='58700000-0000-4587-8587-000000000001';
const S='58700000-0000-4587-8587-000000000002';
const owner=uuid(1),reviewer=uuid(2),crew=uuid(3),dispatcher=uuid(4),sysop=uuid(5),job=uuid(6),reqId=uuid(7);
let user=crew,allowed=false,serviceOn=true,amount=0,posted=false;
const now=Date.now(),approvedAt=new Date(now-300000).toISOString(),expiresAt=new Date(now+2*86400000).toISOString();
const storage=new Map(),photos=[],signoffs=[],events=[];
const fakeRows={
 profiles:()=>[owner,reviewer,crew,dispatcher,sysop].map(id=>({id,role:id===sysop?'admin':'employee',is_active:true})),
 ywi_589_pilot_authorizations:()=>allowed?[{company_id:C,client_id:CL,client_site_id:S,
  owner_user_id:owner,independent_reviewer_id:reviewer,approved:true,
  approved_at:approvedAt,expires_at:expiresAt}]:[],
 ywi_companies:()=>[{id:C,owner_user_id:owner}],
 ywi_589_pilot_staff:()=>[{company_id:C,user_id:crew,role:'crew',enabled:true,expires_at:expiresAt,
  independently_reviewed_by:reviewer},{company_id:C,user_id:dispatcher,role:'dispatcher',enabled:true,
  expires_at:expiresAt,independently_reviewed_by:owner}],
 ywi_company_service_modules:()=>[{company_id:C,module_key:'landscape',enabled:serviceOn}],
 ywi_company_client_links_422:()=>[{company_id:C,client_id:CL}],
 ywi_company_site_links_422:()=>[{company_id:C,client_id:CL,client_site_id:S}],
 work_orders:()=>[{id:job,company_id:C,client_id:CL,client_site_id:S,service_module_key:'landscape',
  status:'draft',total_amount:amount,subtotal:amount,tax_total:0,completion_ready_for_accounting:false}],
 job_invoice_candidates:()=>posted?[{id:uuid(50),work_order_id:job}]:[],
 ar_invoices:()=>[], 
 ywi_589_photo_receipts:()=>photos,
 ywi_589_dispatcher_certifications:()=>signoffs,
 ywi_platform_administrators_489:()=>[{user_id:sysop}]
};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
async function fetchMock(url,init={}){
 const u=new URL(url),path=u.pathname,method=init.method||'GET';events.push(method+' '+path);
 if(path==='/auth/v1/user')return reply({id:user});
 if(path.startsWith('/rest/v1/')){
  const table=path.slice('/rest/v1/'.length),rows=fakeRows[table]?.();
  if(!rows)return reply({message:'Missing relation'},404);
  if(method==='POST'){
   const val=JSON.parse(init.body);
   if(table==='ywi_589_photo_receipts'){
    if(photos.some(x=>x.company_id===val.company_id&&x.work_order_id===val.work_order_id))
     return reply({message:'Unique'},409);
    photos.push(val);return reply([val],201);
   }
   if(table==='ywi_589_dispatcher_certifications'){
    if(signoffs.some(x=>x.photo_id===val.photo_id))return reply({message:'Unique'},409);
    signoffs.push({...val,id:uuid(42)});return reply([signoffs.at(-1)],201);
   }
   return reply({message:'write forbidden'},403);
  }
  let result=rows;
  for(const [k,v] of u.searchParams.entries()){
   if(k==='select'||k==='limit')continue;
   if(!v.startsWith('eq.'))return reply({message:'bad comparator'},400);
   result=result.filter(x=>String(x[k])===v.slice(3));
  }
  return reply(result.slice(0,Number(u.searchParams.get('limit')||3)));
 }
 if(path.startsWith('/storage/v1/object/authenticated/')){
  const key=decodeURIComponent(path.slice('/storage/v1/object/authenticated/'.length));
  return storage.has(key)?new Response(storage.get(key),{status:200}):reply({message:'missing'},404);
 }
 if(path.startsWith('/storage/v1/object/')){
  if(method!=='POST')return reply({message:'not allowed'},403);
  const key=decodeURIComponent(path.slice('/storage/v1/object/'.length));
  if(storage.has(key))return reply({message:'duplicate'},409);
  const bytes=new Uint8Array(init.body);storage.set(key,bytes);
  return reply({Key:key});
 }
 throw Error('unexpected request '+method+' '+url);
}
let handler;
vm.runInNewContext(code,{Deno:{serve:fn=>handler=fn,env:{get:name=>name==='SUPABASE_URL'?
 'https://test.supabase.invalid':name==='SUPABASE_SERVICE_ROLE_KEY'?'fixture-private-key':null}},
 fetch:fetchMock,crypto:webcrypto,Response,Request,File,Blob,FormData,URL,URLSearchParams,
 Uint8Array,ArrayBuffer,Date,Error,Map,Set,Number,String,Array,Object,JSON,Promise,console});
assert.equal(typeof handler,'function');
async function invoke(data){
 const raw=new Request('https://test.supabase.invalid/functions/v1/yw589-original-device-photo',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc','Content-Type':'application/json',
   Origin:'https://yw-alpha.vercel.app'},body:JSON.stringify(data)});
 const ans=await handler(raw);return {response:ans,data:await ans.json()};
}
function assertHold(x,reason){assert.equal(x.data.state,'HOLD',reason);assert.equal(x.data.liveFieldCertified,false,reason);}
assertHold(await invoke({action:'readiness',jobId:job}),'no independent pilot approval');
assert.equal(storage.size,0);assert.equal(photos.length,0);
allowed=true;
assert.equal((await invoke({action:'readiness',jobId:job})).data.state,'ORIGINAL_DEVICE_CAPTURE_AUTHORIZED');
assertHold(await invoke({action:'readiness',jobId:uuid(55)}),'foreign job');
serviceOn=false;assertHold(await invoke({action:'readiness',jobId:job}),'disabled service');serviceOn=true;
amount=5;assertHold(await invoke({action:'readiness',jobId:job}),'nonzero financial amount');amount=0;
posted=true;assertHold(await invoke({action:'readiness',jobId:job}),'existing posted invoice');posted=false;
user=sysop;assertHold(await invoke({action:'readiness',jobId:job}),'sysop cannot become a crew actor');
user=crew;
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(9)]);
const deviceHash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',png)),x=>x.toString(16).padStart(2,'0')).join('');
async function upload({hash=deviceHash,consent=true,request=reqId,bytes=png}={}){
 const form=new FormData();
 for(const [k,v] of Object.entries({action:'capture',jobId:job,requestId:request,
  deviceSha256:hash,consent:String(consent),consentScope:'original_job_documentation'}))
  form.set(k,v);
 form.set('photo',new File([bytes],'field.png',{type:'image/png'}));
 const q=new Request('https://test.supabase.invalid/functions/v1/yw589-original-device-photo',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc',Origin:'https://yw-alpha.vercel.app'},body:form});
 const a=await handler(q);return {response:a,data:await a.json()};
}
assertHold(await upload({consent:false}),'no photo consent');
assertHold(await upload({hash:'0'.repeat(64)}),'unmatched original device hash');
assertHold(await upload({bytes:new Uint8Array(64)}),'invalid image magic');
assert.equal(storage.size,0);
const up=await upload();assert.equal(up.data.state,'PRIVATE_PHOTO_BYTES_READ_BACK_AND_VERIFIED');
assert.equal(up.data.serverHashVerified,true);assert.equal(photos.length,1);assert.equal(storage.size,1);
const again=await upload();assert.equal(again.data.state,'PRIVATE_PHOTO_VERIFIED_IDEMPOTENT_REPLAY');
assert.equal(photos.length,1);assert.equal(storage.size,1);
assertHold(await upload({request:uuid(80)}),'different photo cannot be added to same job');
assert.equal((await invoke({action:'status',jobId:job})).data.state,'PRIVATE_BYTES_INDEPENDENTLY_VERIFIED_DISPATCHER_PENDING');
assertHold(await invoke({action:'confirm',jobId:job,photoId:up.data.photoId,
 dispatcherConfirmed:true,reviewedPrivatePhotoOnOriginalDevice:true}),'crew cannot self certify');
user=dispatcher;
const reviewReq=new Request('https://test.supabase.invalid/functions/v1/yw589-original-device-photo',{
 method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc',Origin:'https://yw-alpha.vercel.app',
 'Content-Type':'application/json'},body:JSON.stringify({action:'review',jobId:job,photoId:up.data.photoId})});
const preview=await handler(reviewReq);
assert.equal(preview.headers.get('Content-Type'),'image/png');
assert.deepEqual(new Uint8Array(await preview.arrayBuffer()),png);
assertHold(await invoke({action:'confirm',jobId:job,photoId:up.data.photoId,
 dispatcherConfirmed:false,reviewedPrivatePhotoOnOriginalDevice:true}),'unconfirmed dispatcher');
const signed=await invoke({action:'confirm',jobId:job,photoId:up.data.photoId,
 dispatcherConfirmed:true,reviewedPrivatePhotoOnOriginalDevice:true});
assert.equal(signed.data.state,'ORIGINAL_DISPATCHER_SIGNOFF_RECORDED_EXTERNAL_WITNESS_PENDING');
assert.equal(signed.data.liveFieldCertified,false);
assert.equal(signoffs.length,1);
assert.equal((await invoke({action:'confirm',jobId:job,photoId:up.data.photoId,
 dispatcherConfirmed:true,reviewedPrivatePhotoOnOriginalDevice:true})).data.state,'ORIGINAL_DISPATCHER_SIGNOFF_IDEMPOTENT_REPLAY');
assert.equal(signoffs.length,1);
assert.equal((await invoke({action:'status',jobId:job})).data.dispatcherSigned,true);
user=sysop;
const summary=await invoke({action:'summary'});
assert.equal(summary.data.photoReceiptCount,1);
assert.equal(summary.data.dispatcherConfirmationCount,1);
assert.equal(summary.data.customerDetailsIncluded,false);
assert.equal(summary.data.privatePhotoIncluded,false);
assert.equal(summary.data.tenantFinanceIncluded,false);
assert.equal(summary.data.masterDurableAckVerified,false);
user=crew;assertHold(await invoke({action:'summary'}),'crew cannot read Sysop telemetry');
assert.equal(events.filter(x=>x.startsWith('POST /rest/v1/job_invoice_candidates')||x.startsWith('POST /rest/v1/ar_invoices')).length,0);
for(const forbidden of ['.from(\'invoices\').insert','work_orders\').insert','job_invoice_postings\').insert','auth.admin.createUser',
 'sendEmail','customer_notification','publicUrl','upsert:true'])
 assert.ok(!code.includes(forbidden),'forbidden direct finance/public/customer mutation '+forbidden);
for(const expected of ['file instanceof File','matchMagic','downloadedHash!==sourceHash',
 'if(receipts.length!==1','pilot_staff','job_invoice_candidates','ar_invoices','Deno.serve',
 'EXTERNAL_WITNESS_PENDING','x-upsert'])
 assert.ok(code.includes(expected),'critical backend enforcement '+expected);
for(const expected of ['enable row level security','false,10485760',
 'approved boolean not null default false','enabled boolean not null default false',
 'yw589_no_photo_mutation','yw589_no_cert_mutation'])
 assert.ok(sql.includes(expected),'critical security SQL '+expected);
for(const expected of ['capture','FormData','crypto.subtle.digest',
 'Dispatcher: securely open original photo','requestId','yw589Consent'])
 assert.ok(ui.includes(expected),'camera/dispatcher UI '+expected);
assert.ok(index.includes('/js/yw589-original-device-pilot.js'));
assert.ok(index.includes('/yw589-original-device.css'));
console.log('YW589 PASS: real request handler exercised with fake Auth/PostgREST/private Storage, original byte reread, idempotent retry, distinct dispatcher and redacted Sysop; production untouched');
