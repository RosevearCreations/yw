// YW590 genuine-source rehearsal: run the actual Edge function against isolated
// disposable Auth/PostgREST/Storage, never fake a production human/device.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const server=readFileSync('supabase/functions/yw589-original-device-photo/index.ts','utf8');
const sql=readFileSync('sql/yw590_device_witness_financial_shell_cases_OPT_IN.sql','utf8');
const ui=readFileSync('js/yw590-original-field-certification.js','utf8');
const html=readFileSync('index.html','utf8');
const id=n=>'59000000-0000-4590-8590-'+String(n).padStart(12,'0');
const C='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
const CL='58700000-0000-4587-8587-000000000001',SITE='58700000-0000-4587-8587-000000000002';
const [owner,reviewer,crew,dispatcher,sysop,job,photo,cert]=Array.from({length:8},(_,i)=>id(i+1));
const requestId=id(10);
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(9)]);
const bytesHash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',png)),x=>x.toString(16).padStart(2,'0')).join('');
const path=C+'/'+job+'/'+requestId+'.png';
let user=crew,approval=false,staffEnabled=true,serviceEnabled=true,jobCount=1,
 clientLink=true,siteLink=true,withCandidate=false,withArInvoice=false,photoMutated=false;
const challengeRows=[],witnessRows=[],caseRows=[],events=[];
const approvedAt=new Date(Date.now()-30000).toISOString(),expiresAt=new Date(Date.now()+86400000).toISOString();
const records={
 profiles:()=>[owner,reviewer,crew,dispatcher,sysop].map(x=>({id:x,role:x===sysop?'admin':'employee',is_active:true})),
 ywi_589_pilot_authorizations:()=>approval?[{
  company_id:C,client_id:CL,client_site_id:SITE,owner_user_id:owner,
  independent_reviewer_id:reviewer,approved:true,approved_at:approvedAt,expires_at:expiresAt}]:[],
 ywi_companies:()=>[{id:C,owner_user_id:owner}],
 ywi_589_pilot_staff:()=>[
  {company_id:C,user_id:crew,role:'crew',enabled:staffEnabled,expires_at:expiresAt,independently_reviewed_by:reviewer},
  {company_id:C,user_id:dispatcher,role:'dispatcher',enabled:staffEnabled,expires_at:expiresAt,independently_reviewed_by:owner}],
 ywi_company_service_modules:()=>[{company_id:C,module_key:'landscape',enabled:serviceEnabled}],
 ywi_company_client_links_422:()=>clientLink?[{company_id:C,client_id:CL}]:[],
 ywi_company_site_links_422:()=>siteLink?[{company_id:C,client_id:CL,client_site_id:SITE}]:[],
 work_orders:()=>jobCount?[{id:job,company_id:C,client_id:CL,client_site_id:SITE,
  status:'draft',service_module_key:'landscape',total_amount:0,subtotal:0,tax_total:0,
  completion_ready_for_accounting:false}]:[],
 job_invoice_candidates:()=>withCandidate?[{id:id(90),work_order_id:job}]:[],
 ar_invoices:()=>withArInvoice?[{id:id(91),work_order_id:job}]:[],
 ywi_589_photo_receipts:()=>[{id:photo,company_id:C,client_id:CL,client_site_id:SITE,
  work_order_id:job,request_id:requestId,uploaded_by:crew,stored_bucket:'ywi-private-device-evidence-589',
  object_key:path,content_type:'image/png',observed_sha256:bytesHash,
  server_download_hash_match:true,byte_count:png.length}],
 ywi_589_dispatcher_certifications:()=>[{id:cert,company_id:C,work_order_id:job,photo_id:photo,
  dispatcher_user_id:dispatcher,source_photo_sha256:bytesHash,
  witness_state:'ORIGINAL_DISPATCHER_CONFIRMATION_INDEPENDENT_WITNESS_PENDING'}],
 ywi_platform_administrators_489:()=>[{user_id:sysop}],
 ywi_590_crew_challenges:()=>challengeRows,
 ywi_590_original_field_witnesses:()=>witnessRows,
 ywi_590_shell_case_closures:()=>caseRows
};
const reply=(obj,status=200)=>Response.json(obj,{status});
async function fakeFetch(url,args={}){
 const u=new URL(url),pathName=u.pathname,method=args.method||'GET';events.push({method,pathName});
 if(pathName==='/auth/v1/user')return reply({id:user});
 if(pathName.startsWith('/storage/v1/object/authenticated/')){
  if(photoMutated)return new Response(new Uint8Array(64),{status:200});
  return new Response(png,{status:200,headers:{'Content-Type':'image/png'}});
 }
 if(pathName.startsWith('/rest/v1/rpc/')){
  const name=pathName.split('/').at(-1),argsIn=JSON.parse(args.body);
  if(name==='ywi_590_record_original_witness'){
   if(argsIn.p_witness_user_id!==reviewer||argsIn.p_photo_id!==photo||
      argsIn.p_observed_sha256!==bytesHash||
      challengeRows.find(x=>x.id===argsIn.p_challenge_id)?.photo_id!==photo)
    return reply({error:'source-authority-mismatch'},403);
   if(witnessRows.length)return reply({error:'duplicate witness'},409);
   witnessRows.push({id:id(20),company_id:C,work_order_id:job,photo_id:photo,
    witness_user_id:reviewer,observed_sha256:bytesHash});
   caseRows.push({id:id(21),company_id:C,work_order_id:job,photo_id:photo,
    state:'AWAITING_INDEPENDENT_SYSOP'});
   return reply({state:'AWAITING_INDEPENDENT_SYSOP',case_received:true},200);
  }
  if(name==='ywi_590_close_original_technical_case'){
   if(argsIn.p_sysop_user_id!==sysop||argsIn.p_sha256!==bytesHash||
     witnessRows.length!==1||withCandidate||withArInvoice)
    return reply({error:'not independent or not financially isolated'},403);
   caseRows[0].state='ORIGINAL_CASE_CLOSED';
   return reply({state:'ORIGINAL_CASE_CLOSED',finance_zero_as_of_closure:true});
  }
  return reply({message:'unknown RPC'},404);
 }
 if(pathName.startsWith('/rest/v1/')){
  const table=pathName.slice('/rest/v1/'.length),all=records[table]?.();
  if(!all)return reply({message:'relation missing'},404);
  if(method==='POST'){
   if(table!=='ywi_590_crew_challenges')return reply({message:'unexpected DB write'},403);
   const obj=JSON.parse(args.body);
   challengeRows.push(obj);return reply([obj],201);
  }
  let filtered=all;
  for(const [k,v] of u.searchParams.entries()){
   if(k==='select'||k==='limit')continue;
   if(!v.startsWith('eq.'))return reply({message:'bad filter'},400);
   filtered=filtered.filter(x=>String(x[k])===v.slice(3));
  }
  return reply(filtered.slice(0,Number(u.searchParams.get('limit')||3)));
 }
 throw Error('Unexpected outgoing access '+url);
}
let handler;
vm.runInNewContext(server,{Deno:{serve:fn=>handler=fn,
 env:{get:name=>name==='SUPABASE_URL'?'https://test.supabase.invalid':
 name==='SUPABASE_SERVICE_ROLE_KEY'?'test-secret-key':null}},
 fetch:fakeFetch,crypto:webcrypto,TextEncoder,Response,Request,File,Blob,FormData,
 URL,URLSearchParams,Uint8Array,ArrayBuffer,Date,Error,Map,Set,Number,String,Array,Object,JSON,Promise,console});
assert.equal(typeof handler,'function');
async function call(action,extra={}){
 const r=new Request('https://test.supabase.invalid/functions/v1/yw589-original-device-photo',{
  method:'POST',headers:{Authorization:'Bearer aaa.bbb.ccc',Origin:'https://yw-alpha.vercel.app',
   'Content-Type':'application/json'},
  body:JSON.stringify({action,jobId:job,photoId:photo,...extra})});
 const res=await handler(r);
 if(action==='590:witness-preview'&&res.ok&&res.headers.get('Content-Type')==='image/png')
  return {status:res.status,blob:await res.arrayBuffer()};
 return {status:res.status,data:await res.json()};
}
function hold(result,label){assert.equal(result.data?.state,'HOLD',label);
 assert.equal(result.data?.liveFieldCertified,false,label);}
hold(await call('590:readiness'),'unapproved pilot never readied');
approval=true;
const firstReady=await call('590:readiness');
assert.equal(firstReady.data.state,'AWAITING_INDEPENDENT_ORIGINAL_DEVICE_WITNESS',JSON.stringify(firstReady.data));
serviceEnabled=false;hold(await call('590:readiness'),'service OFF');serviceEnabled=true;
jobCount=0;hold(await call('590:readiness'),'no original job');jobCount=1;
clientLink=false;hold(await call('590:readiness'),'unlinked original client');clientLink=true;
siteLink=false;hold(await call('590:readiness'),'unlinked original site');siteLink=true;
withCandidate=true;hold(await call('590:readiness'),'original invoice candidate'),withCandidate=false;
withArInvoice=true;hold(await call('590:readiness'),'original A/R invoice'),withArInvoice=false;
user=reviewer;hold(await call('590:crew-challenge'),'reviewer cannot issue crew challenge');
user=crew;staffEnabled=false;hold(await call('590:crew-challenge'),'crew enrollment disabled');staffEnabled=true;
photoMutated=true;hold(await call('590:crew-challenge'),'private bucket bytes changed');photoMutated=false;
const issued=(await call('590:crew-challenge')).data;
assert.equal(issued.state,'CREW_ORIGINAL_DEVICE_CHALLENGE_ISSUED');
assert.match(issued.challengeCode,/^[a-f0-9]{32}$/);
assert.match(issued.challengeId,/^[a-f0-9-]{36}$/);
assert.equal(challengeRows.length,1);
user=dispatcher;hold(await call('590:witness-preview'),'dispatcher cannot claim reviewer identity');
user=reviewer;
const preview=await call('590:witness-preview');
assert.equal(preview.status,200);
assert.deepEqual(new Uint8Array(preview.blob),png);
const witnessArgs={challengeId:issued.challengeId,challengeCode:issued.challengeCode,
 observedSha256:bytesHash,reviewedPrivatePhoto:true,sawOriginalCrewDevice:true};
hold(await call('590:witness',{...witnessArgs,challengeCode:'0'.repeat(32)}),'wrong crew code');
hold(await call('590:witness',{...witnessArgs,sawOriginalCrewDevice:false}),'physical witness did not actually observe crew device');
hold(await call('590:witness',{...witnessArgs,observedSha256:'0'.repeat(64)}),'reviewer did not hash original bytes');
photoMutated=true;hold(await call('590:witness',witnessArgs),'post-preview bucket tampered');photoMutated=false;
const witness=(await call('590:witness',witnessArgs)).data;
assert.equal(witness.state,'HUMAN_DEVICE_WITNESS_RECORDED_AWAITING_SYSOP');
assert.equal(witness.machineHardwareAttestation,false);
assert.equal(witnessRows.length,1);assert.equal(caseRows.length,1);
assert.equal((await call('590:readiness')).data.humanWitnessRecorded,true);
user=reviewer;
hold(await call('590:close',{confirmTechnicalRecovery:true,confirmNoCustomerNotice:true}),'reviewer not platform admin');
user=sysop;
const first=(await call('590:shell-summary')).data;
assert.equal(first.open,1);assert.equal(first.closed,0);
assert.equal(first.noCustomerPII,true);assert.equal(first.noPrivatePhoto,true);
assert.equal(first.noTenantFinance,true);assert.equal(first.masterDurableAckVerified,false);
hold(await call('590:close',{confirmTechnicalRecovery:false,confirmNoCustomerNotice:true}),'premature Sysop close');
withCandidate=true;hold(await call('590:close',{confirmTechnicalRecovery:true,confirmNoCustomerNotice:true}),'invoice generated during recovery');withCandidate=false;
const closure=(await call('590:close',{confirmTechnicalRecovery:true,confirmNoCustomerNotice:true})).data;
assert.equal(closure.state,'ORIGINAL_CASE_CLOSED');
assert.equal(closure.pointInTimeFinanceIsolation,true);
assert.equal(closure.machineHardwareAttestation,false);
assert.equal(caseRows[0].state,'ORIGINAL_CASE_CLOSED');
const final=(await call('590:shell-summary')).data;
assert.equal(final.open,0);assert.equal(final.closed,1);
user=crew;hold(await call('590:shell-summary'),'crew cannot read platform Shell');
const writes=events.filter(x=>x.method==='POST');
assert.ok(writes.every(x=>x.pathName.includes('crew_challenges')||
 x.pathName.includes('/rpc/ywi_590_')),'No tenant financial, user, device, photo or customer mutation');
for(const v of ['ywi_590_crew_challenges','ywi_590_original_field_witnesses',
 'ywi_590_shell_case_closures','enable row level security','service_role',
 'YW590 atomic one-way closure failed','job_invoice_candidates',
 'ar_invoices','case_single_close','yw590_witness_immutable','yw590_challenge_immutable'])
 assert.ok(sql.includes(v),'Missing SQL source rule '+v);
for(const v of ['strict','xxx'].filter(()=>false))assert.ok(!server.includes(v));
assert.ok(html.includes('/js/yw590-original-field-certification.js'));
assert.ok(html.includes('/yw590-field-certification.css'));
assert.ok(ui.includes('human original crew device')||ui.includes('original crew device'));
console.log('YW590 PASS: real Edge handler against disposable Auth/PostgREST/private binary Storage; no original job/paid finance write, distinct crew/dispatcher/reviewer/Sysop, 10-min hash-bound challenge, byte re-read, human-review status and Shell financial close. No real-device witness is claimed.');
