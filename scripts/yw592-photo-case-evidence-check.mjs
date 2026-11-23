// YW592 — source-only adversarial checks. Synthetic identities are NEVER real field pilot receipts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const edge=readFileSync('supabase/functions/yw592-photo-case-telemetry/index.ts','utf8');
const sql=readFileSync('sql/yw592_photo_case_signed_decisions_master_receipts.sql','utf8');
const ui=readFileSync('js/yw592-photo-case-triage.js','utf8');
const html=readFileSync('index.html','utf8');
const cfg=readFileSync('supabase/config.toml','utf8');
const fake=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const C=fake(1),B=fake(2),OWNER=fake(3),FOREIGN=fake(4),REVIEWER=fake(5);
const JOB=fake(6),ATT=fake(7);
assert.match(cfg,/\[functions\.yw592-photo-case-telemetry\]\s*verify_jwt\s*=\s*true/);
assert.match(html,/yw592-photo-case-triage\.js/);
assert.match(html,/yw592-photo-case\.css/);
assert.match(ui,/getUser\(\)/);
assert.match(ui,/textContent/);
assert.doesNotMatch(ui,/innerHTML\s*=/);
assert.match(edge,/crypto\.subtle\.verify/);
assert.match(edge,/YW592_MASTER_ACK_KEY/);
assert.match(edge,/YW592_DECISION_HMAC_KEY/);
assert.match(edge,/storageRead\(a\.object_key\)/);
assert.match(edge,/a\.uploaded_by!==user/);
assert.match(edge,/sourcePhotoSha256/);
assert.match(edge,/originalDeviceHardwareAttested:false/);
assert.match(sql,/create table public\.ywi_592_case_proposals/);
assert.match(sql,/create table public\.ywi_592_case_decisions/);
assert.match(sql,/create table public\.ywi_592_master_receipts/);
assert.equal((sql.match(/alter table public\.ywi_592_\w+ enable row level security;/g)||[]).length,3);
assert.equal((sql.match(/execute function public\.ywi_591_forbid_change\(\)/g)||[]).length,3);
assert.equal((sql.match(/language plpgsql security definer set search_path='' as \$fn\$/g)||[]).length,3);
assert.equal((sql.match(/end; \$fn\$/g)||[]).length,3);
assert.doesNotMatch(sql,/\btruncate\b|\bdrop table\b|\bdelete from\b/i);
assert.doesNotMatch(edge,/storage\/v1\/object\/remove|auth\.admin|publicUrl|upsert:true/);
let handler,actor=OWNER;
const trace=[],rows={
 profiles:[{id:OWNER,is_active:true},{id:FOREIGN,is_active:true},{id:REVIEWER,is_active:true}],
 ywi_companies:[{id:C,owner_user_id:OWNER},{id:B,owner_user_id:FOREIGN}],
 ywi_591_tenant_pilots:[{company_id:C,owner_user_id:OWNER,reviewer_user_id:REVIEWER,
   work_order_id:JOB,state:'APPROVED',expires_at:new Date(Date.now()+3600000).toISOString()},
  {company_id:B,owner_user_id:FOREIGN,reviewer_user_id:fake(9),
   work_order_id:fake(10),state:'APPROVED',expires_at:new Date(Date.now()+3600000).toISOString()}],
 ywi_591_pilot_staff:[],ywi_591_photo_attempts:[],ywi_592_case_proposals:[],
 ywi_592_case_decisions:[],ywi_592_master_receipts:[]
};
const response=(x,status=200)=>Response.json(x,{status});
async function fakeFetch(url,opt={}){
 const u=new URL(url),p=u.pathname;trace.push((opt.method||'GET')+' '+p);
 if(p==='/auth/v1/user')return response({id:actor});
 if(p.startsWith('/rest/v1/rpc/'))return response({error:'no write without original source'},403);
 if(p.startsWith('/rest/v1/')){
  const table=p.replace('/rest/v1/','');
  if(!Object.hasOwn(rows,table))return response({error:'no table'},404);
  let data=rows[table];
  for(const [k,v]of u.searchParams){
   if(['select','limit'].includes(k))continue;
   data=data.filter(x=>String(x[k])===v.slice(3));
  }
  return response(data.slice(0,Number(u.searchParams.get('limit')||30)));
 }
 throw Error('Unexpected external dependency '+p);
}
vm.runInNewContext(edge,{
 Deno:{serve:fn=>handler=fn,env:{get:k=>({
  SUPABASE_URL:'https://fixture.supabase.invalid',
  SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only-not-real',
  YW592_DECISION_HMAC_KEY:'fixture-decision-only',
  YW592_TELEMETRY_SEND_KEY:'fixture-source-only',
  YW592_MASTER_ACK_KEY:'fixture-ack-only'
 })[k]}},fetch:fakeFetch,crypto:webcrypto,Response,Request,
 URL,URLSearchParams,Uint8Array,ArrayBuffer,AbortSignal,Date,TextEncoder,
 Error,Object,JSON,Map,Set,Number,String,Array,Promise,console
});
async function call(body,{as=OWNER,origin='https://yw-alpha.vercel.app'}={}){
 actor=as;
 const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/yw592-photo-case-telemetry',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc',
   origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {status:r.status,data:await r.json()};
}
const triage=await call({action:'triage',companyId:C});
assert.equal(triage.status,200);
assert.equal(triage.data.state,'PRIVATE_CASE_TRIAGE');
assert.equal(triage.data.cases.length,0,'No invented case');
const foreign=await call({action:'triage',companyId:B});
assert.equal(foreign.data.state,'HOLD','Owner cannot see foreign company');
const reviewer=await call({action:'triage',companyId:C},{as:REVIEWER});
assert.equal(reviewer.status,200,'Current distinct reviewer may see scoped case queue');
const noSource=await call({action:'propose',companyId:C,attemptId:ATT,
 decision:'EXPIRY_REVIEW',reason:'NORMAL_EXPIRY'});
assert.equal(noSource.data.state,'HOLD','Cannot invent original source photo');
const noTelemetry=await call({action:'forward-telemetry',companyId:C,attemptId:ATT});
assert.equal(noTelemetry.data.state,'HOLD','No original crew or Master ACK');
const forged=await call({action:'triage',companyId:C},{
 origin:'https://attacker.invalid'});
assert.equal(forged.status,403);
assert.equal(rows.ywi_592_case_decisions.length,0);
assert.equal(rows.ywi_592_master_receipts.length,0);
assert.equal(trace.some(s=>s.includes('/storage/v1/object/')),false);
console.log('YW592 PASS: source compiles; no seeded tenant, cross-tenant denied, private queue scoped, default HOLD; immutable HMAC and RLS source guards. No real field certification.');