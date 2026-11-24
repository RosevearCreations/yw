// YW595 regression: all synthetic fixture actors are confined to CI; NOT field evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const file=p=>readFileSync(p,'utf8');
const edge=file('supabase/functions/yw595-original-pilot-rotation-fleet/index.ts');
const sql=file('sql/yw595_supervised_pilot_rotation_two_tenant.sql');
const ui=file('js/yw595-supervised-original-pilot.js');
const index=file('index.html'),cfg=file('supabase/config.toml');
const UUID=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const COMPANY=UUID(1),OTHER=UUID(2),OWNER=UUID(3),REVIEWER=UUID(4),
 CREW=UUID(5),FOREIGN=UUID(6),SYSOP=UUID(7),SLOT=UUID(8),ATTEMPT=UUID(9),
 JOB=UUID(10),APPROVAL=UUID(11);
const now=Date.now(),iso=n=>new Date(n).toISOString(),utf=s=>new TextEncoder().encode(s);
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const digest=async x=>hex(await webcrypto.subtle.digest('SHA-256',utf(x)));
const sign=async(msg,key)=>hex(await webcrypto.subtle.sign('HMAC',
 await webcrypto.subtle.importKey('raw',utf(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),utf(msg)));
assert.match(index,/yw595-supervised-original-pilot\.js/);
assert.match(index,/yw595-supervised-original-pilot\.css/);
assert.match(cfg,/\[functions\.yw595-original-pilot-rotation-fleet\]\s*verify_jwt\s*=\s*true/);
assert.match(ui,/auth\.getUser\(\)/);
assert.doesNotMatch(ui,/innerHTML\s*=|localStorage\./);
for(const table of ['ceremony_intents','ceremony_closures','rotation_proposals',
 'rotation_signoffs','fleet_optins','fleet_reviews'])
 assert.match(sql,new RegExp('create table public\\.ywi_595_'+table));
assert.equal((sql.match(/enable row level security;/g)||[]).length,6);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,6);
assert.equal((sql.match(/grant execute on function public\.ywi_595_/g)||[]).length,6);
assert.match(sql,/Cross-tenant aggregate is NOT directly readable/);
assert.match(sql,/user_id=s\.crew_user_id[\s\S]*role='crew' and state='APPROVED'/);
assert.match(sql,/id=b\.reviewer_user_id and is_active=true/);
// PostgREST formats persisted timestamptz as +00:00 rather than browser Z.
assert.match(edge,/signedAt:new Date\(a\.signed_at\)\.toISOString\(\)/);
assert.match(edge,/closedAt:new Date\(cert\.closedAt\)\.toISOString\(\)/);
assert.match(edge,/certifiedAt:new Date\(c\.certified_at\)\.toISOString\(\)/);
assert.match(sql,/actual_secret_rotated boolean not null default false check\(actual_secret_rotated=false\)/);
assert.doesNotMatch(sql,/\bdelete from\b|\btruncate\b|\bdrop table\b/i);
assert.match(edge,/YW592_MASTER_ACK_KEY/);
assert.match(edge,/YW593_WITNESS_HMAC_KEY/);
assert.match(edge,/YW594_HUMAN_EVIDENCE_HMAC_KEY/);
assert.match(edge,/YW595_CEREMONY_HMAC_KEY/);
assert.match(edge,/YW595_ROTATION_HMAC_KEY/);
assert.match(edge,/YW595_FLEET_HMAC_KEY/);
assert.match(edge,/readBytes\(cert\.a\)/);
assert.match(edge,/ywi_platform_administrators_489/);
assert.doesNotMatch(edge,/auth\.admin|publicUrl|delete\(|storage\/v1\/object\/remove/);
const secret={
 SUPABASE_URL:'https://fixture.supabase.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'server-fixture-only',
 YW593_WITNESS_HMAC_KEY:'window-fixture',
 YW592_MASTER_ACK_KEY:'master-fixture',
 YW594_HUMAN_EVIDENCE_HMAC_KEY:'human-fixture',
 YW594_DRIFT_HMAC_KEY:'drift-fixture',
 YW595_CEREMONY_HMAC_KEY:'ceremony-fixture',
 YW595_ROTATION_HMAC_KEY:'rotation-fixture',
 YW595_FLEET_HMAC_KEY:'fleet-fixture'
};
const slot={id:SLOT,company_id:COMPANY,attempt_id:ATTEMPT,owner_user_id:OWNER,
 reviewer_user_id:REVIEWER,crew_user_id:CREW,
 starts_at:iso(now+35*60000),ends_at:iso(now+115*60000)};
const signedAt=iso(now-1000);
const windowMessage=canonical({schema:'rosevear.yw.witness-window-approval.v1',
 companyId:COMPANY,slotId:SLOT,attemptId:ATTEMPT,ownerId:OWNER,
 reviewerId:REVIEWER,crewId:CREW,startsAt:slot.starts_at,endsAt:slot.ends_at,
 signedAt});
const rows={
 profiles:[{id:OWNER,role:'owner',is_active:true},
  {id:REVIEWER,role:'reviewer',is_active:true},
  {id:CREW,role:'crew',is_active:true},
  {id:FOREIGN,role:'owner',is_active:true},
  {id:SYSOP,role:'admin',is_active:true}],
 ywi_companies:[{id:COMPANY,owner_user_id:OWNER},
  {id:OTHER,owner_user_id:FOREIGN}],
 ywi_591_tenant_pilots:[{company_id:COMPANY,owner_user_id:OWNER,
  reviewer_user_id:REVIEWER,work_order_id:JOB,state:'APPROVED',
  expires_at:iso(now+86400000)}],
 ywi_593_witness_slots:[slot],
 ywi_593_witness_approvals:[{slot_id:SLOT,company_id:COMPANY,
  reviewer_user_id:REVIEWER,signed_at:signedAt.replace('Z','+00:00'),payload_sha256:await digest(windowMessage),
  server_hmac_sha256:await sign(windowMessage,secret.YW593_WITNESS_HMAC_KEY)}],
 ywi_591_photo_attempts:[{id:ATTEMPT,company_id:COMPANY,work_order_id:JOB,
  uploaded_by:CREW,state:'VERIFIED',content_sha256:'a'.repeat(64),
  stored_sha256:'a'.repeat(64),byte_count:3,object_key:'a/b/c'}],
 ywi_platform_administrators_489:[{user_id:SYSOP}],
 ywi_594_field_certificates:[],ywi_592_master_receipts:[],
 ywi_593_receiver_contracts:[],ywi_594_receiver_drift_alerts:[],
 ywi_594_attendance_proofs:[],ywi_594_owner_observations:[],
 ywi_595_ceremony_intents:[],ywi_595_ceremony_closures:[],
 ywi_595_rotation_proposals:[],ywi_595_rotation_signoffs:[],
 ywi_595_fleet_optins:[],ywi_595_fleet_reviews:[]
};
let handler,actor=OWNER;const trace=[];
async function fakeFetch(raw,opts={}){
 const url=new URL(raw),path=url.pathname;trace.push((opts.method||'GET')+' '+path);
 if(path==='/auth/v1/user')return Response.json({id:actor});
 if(path.startsWith('/rest/v1/rpc/')){
  const body=JSON.parse(opts.body||'{}');
  if(path.endsWith('/ywi_595_begin_ceremony')){
   const ident=UUID(100),row={id:ident,company_id:COMPANY,slot_id:SLOT,
    owner_user_id:OWNER,reviewer_user_id:REVIEWER,crew_user_id:CREW,
    briefing_consent:true,source_sha256:body.p_source_sha256,proposed_at:iso(now)};
   rows.ywi_595_ceremony_intents.push(row);
   return Response.json({state:'SUPERVISED_ORIGINAL_FIELD_CEREMONY_BRIEFED',
    ceremonyId:ident,humanFieldCertified:false,hardwareAttested:false});
  }
  return Response.json({error:'No real original source or remote signed Master evidence'},403);
 }
 if(path.startsWith('/rest/v1/')){
  const table=path.replace('/rest/v1/','');
  if(!Object.hasOwn(rows,table))return Response.json({error:'Unknown fixture original source'},404);
  let result=rows[table];
  for(const [key,value] of url.searchParams)
   if(key!=='select'&&key!=='limit')result=result.filter(x=>String(x[key])===value.slice(3));
  return Response.json(result.slice(0,Number(url.searchParams.get('limit')||25)));
 }
 throw Error('Unexpected unauthorised network '+path);
}
vm.runInNewContext(edge,{
 Deno:{serve:fn=>handler=fn,env:{get:k=>secret[k]}},
 fetch:fakeFetch,crypto:webcrypto,Response,Request,URL,URLSearchParams,Uint8Array,
 TextEncoder,Date,Error,Object,Array,JSON,String,Number,Promise,Set,Map,console
});
async function call(body,{as=OWNER,origin='https://yw-alpha.vercel.app'}={}){
 actor=as;
 const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw595-original-pilot-rotation-fleet',{
  method:'POST',headers:{origin,'content-type':'application/json',
   authorization:'Bearer aaa.bbb.ccc'},body:JSON.stringify(body)}));
 return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():{}};
}
const base={companyId:COMPANY};
const queue=await call({action:'overview',...base});
assert.equal(queue.status,200);
assert.equal(queue.data.ceremonies.length,0);
const noOwnerConsent=await call({action:'begin-ceremony',slotId:SLOT,...base});
assert.equal(noOwnerConsent.data.state,'HOLD');
const wrongReviewer=await call({action:'begin-ceremony',slotId:SLOT,confirmBriefing:true,...base},{as:REVIEWER});
assert.equal(wrongReviewer.data.state,'HOLD');
const noSecondTenant=await call({action:'overview',companyId:OTHER});
assert.equal(noSecondTenant.data.state,'HOLD');
const otherTenantAdmin=await call({action:'sysop-overview'},{as:OWNER});
assert.equal(otherTenantAdmin.data.state,'HOLD');
const actualSysop=await call({action:'sysop-overview'},{as:SYSOP});
assert.equal(actualSysop.status,200);
assert.equal(actualSysop.data.independentlyOptedInCompanies,0);
const forgedFleet=await call({action:'sysop-two-tenant-review',
 firstOptinId:UUID(41),secondOptinId:UUID(42),
 confirmIndependentReview:true},{as:SYSOP});
assert.equal(forgedFleet.data.state,'HOLD');
assert.equal(rows.ywi_595_fleet_reviews.length,0);
const approved=await call({action:'begin-ceremony',...base,slotId:SLOT,confirmBriefing:true});
assert.equal(approved.data.state,'SUPERVISED_ORIGINAL_FIELD_CEREMONY_BRIEFED');
assert.equal(approved.data.humanFieldCertified,false);
const noCertificate=await call({action:'close-ceremony',...base,ceremonyId:UUID(100),
 fieldCertificateId:UUID(101),attestSupervision:true},{as:REVIEWER});
assert.equal(noCertificate.data.state,'HOLD');
const fakeRotation=await call({action:'propose-rotation',...base,
 priorContractId:UUID(110),candidateContractId:UUID(111),
 reason:'PLANNED_ROTATION',confirmCustodyOnly:true});
assert.equal(fakeRotation.data.state,'HOLD');
const wrongSignoff=await call({action:'review-rotation',...base,rotationId:UUID(113),
 attestIndependentReview:true});
assert.equal(wrongSignoff.data.state,'HOLD');
const fakeOptin=await call({action:'optin-two-tenant-review',...base,
 closureId:UUID(112),confirmFleetOptin:true});
assert.equal(fakeOptin.data.state,'HOLD');
const foreign=await call({action:'overview',...base},{as:FOREIGN});
assert.equal(foreign.data.state,'HOLD');
const forbidden=await call({action:'overview',...base},{origin:'https://attacker.invalid'});
assert.equal(forbidden.status,403);
assert.equal(rows.ywi_595_ceremony_closures.length,0);
assert.equal(rows.ywi_595_rotation_signoffs.length,0);
assert.equal(rows.ywi_595_fleet_optins.length,0);
assert.equal(trace.some(x=>x.includes('/storage/v1/object/')),false,
 'No private photo byte claims without actual approved Master evidence');
console.log('YW595 PASS: signed YW593 window, authenticated tenant owner briefing only, reviewer/foreign denial, empty two-tenant real sysop gate, missing genuine certificate/receiver HOLD and no fabricated rotation or cross-tenant acceptance.');
