import {digest,sign,verify} from '../_shared/yw599-independent-recovery.mjs';
import {deliverOriginalAlert} from '../_shared/yw599-notification-runtime.mjs';
const origins=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw Error('CONFIG_HOLD');return v};
const tables=new Set(['ywi_599_provider_enrollments','ywi_599_provider_approvals','ywi_599_provider_revocations','ywi_companies','ywi_591_tenant_pilots','profiles','ywi_597_health_alerts','ywi_597_health_enrollments']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(origins.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'}:{})};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{state:'ORIGIN_HOLD'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{state:'METHOD_HOLD'});
 try{
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))return reply(401,{state:'AUTH_HOLD'});
 const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:service,authorization:bearer},signal:AbortSignal.timeout(5000)});
 if(!auth.ok)return reply(401,{state:'AUTH_HOLD'});
 const user=await auth.json();if(!uuid.test(user.id))return reply(401,{state:'AUTH_HOLD'});
 const rest=async(path:string,method='GET',body?:unknown)=>{
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json',prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('DB_HOLD');return r.json();
 };
 const select=async(table:string,filters:Record<string,string>)=>{
 if(!tables.has(table))throw Error('TABLE_HOLD');
 const q=new URLSearchParams({select:'*',limit:'2'});
 for(const [k,v] of Object.entries(filters))q.set(k,'eq.'+v);
 return rest(table+'?'+q);
 };
 const db={
 one:async(t:string,f:Record<string,string>)=>{const a=await select(t,f);if(a.length!==1)throw Error('ROW_HOLD');return a[0]},
 optional:async(t:string,f:Record<string,string>)=>{const a=await select(t,f);if(a.length>1)throw Error('ROW_HOLD');return a[0]??null},
 profiles:async(ids:string[])=>{if(ids.length!==2||!ids.every(x=>uuid.test(x)))throw Error('PROFILE_HOLD');return Promise.all(ids.map(id=>db.one('profiles',{id})))},
 rpc:async(name:string,data:unknown)=>{if(name!=='ywi_599_claim_notification')throw Error('RPC_HOLD');return rest('rpc/'+name,'POST',data)},
 insert:async(t:string,data:unknown)=>{if(t!=='ywi_599_notification_results')throw Error('INSERT_HOLD');return rest(t,'POST',data)}
 };
 const profile=await db.one('profiles',{id:user.id});
 if(profile.is_active!==true)return reply(403,{state:'ACCOUNT_HOLD'});
 const raw=await req.text();if(raw.length>2048)return reply(413,{state:'BODY_HOLD'});
 const b=JSON.parse(raw);
 if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.companyId!=='string'||!uuid.test(b.companyId))return reply(400,{state:'REQUEST_HOLD'});
 const action=b.action??'deliver';
 const exact=(fields:string[])=>Object.keys(b).sort().join('|')===fields.sort().join('|');
 const company=await db.one('ywi_companies',{id:b.companyId});
 const pilot=await db.one('ywi_591_tenant_pilots',{company_id:b.companyId,owner_user_id:company.owner_user_id,state:'APPROVED'});
 const owner=company.owner_user_id===user.id,reviewer=pilot.reviewer_user_id===user.id&&!owner;
 if(!owner&&!reviewer||pilot.owner_user_id===pilot.reviewer_user_id||!(Date.parse(pilot.expires_at)>Date.now()))return reply(403,{state:'TENANT_AUTHORITY_HOLD'});
 const config=JSON.parse(env('YW599_APPROVED_PROVIDER_CONFIG'));
 const keys={owner:env('YW599_OWNER_CONSENT_KEY'),reviewer:env('YW599_REVIEWER_APPROVAL_KEY'),request:env('YW599_PROVIDER_REQUEST_KEY'),receipt:env('YW599_PROVIDER_RECEIPT_KEY')};
 if(new Set(Object.values(keys)).size!==4||Object.values(keys).some(k=>new TextEncoder().encode(k).length<32))return reply(409,{state:'KEY_SEPARATION_HOLD'});
 const providerRef=/^[A-Za-z0-9_-]{8,128}$/;
 const u=new URL(config.url),h=config.host,m=env('YW593_MASTER_ALLOWED_HOST').toLowerCase();
 if(config.companyId!==b.companyId||config.masterHost!==m||typeof h!=='string'||h!==h.toLowerCase()||!h.includes('.')||!m.includes('.')||u.protocol!=='https:'||u.hostname!==h||h===m||h.endsWith('.'+m)||m.endsWith('.'+h)||u.port||u.username||u.password||u.search||u.hash||h.endsWith('.local')||h.endsWith('.internal')||/^[\d.]+$/.test(h)||!providerRef.test(config.providerId)||!providerRef.test(config.recipientRef)||config.noPaidProvider!==true||config.providerEnrolled!==true||config.approvedRecipient!==true)return reply(409,{state:'PROVIDER_CONFIG_HOLD'});
 const configSha=await digest(config);
 if(action==='overview'){
  if(!exact(['action','companyId']))return reply(400,{state:'REQUEST_HOLD'});
  const q=new URLSearchParams({select:'id,provider_id,recipient_ref,config_sha256,created_at,expires_at',company_id:'eq.'+b.companyId,owner_id:'eq.'+company.owner_user_id,reviewer_id:'eq.'+pilot.reviewer_user_id,order:'created_at.desc',limit:'20'});
  const rows=await rest('ywi_599_provider_enrollments?'+q);
  const enrollments=await Promise.all(rows.map(async(e:any)=>({id:e.id,providerId:e.provider_id,recipientRef:e.recipient_ref,expiresAt:e.expires_at,configCurrent:e.config_sha256===configSha,approved:!!await db.optional('ywi_599_provider_approvals',{enrollment_id:e.id}),revoked:!!await db.optional('ywi_599_provider_revocations',{enrollment_id:e.id})})));
  const aq=new URLSearchParams({select:'id,issue_code,detected_at',company_id:'eq.'+b.companyId,order:'detected_at.desc',limit:'20'});
  const alerts=owner?await rest('ywi_597_health_alerts?'+aq):[];
  return reply(200,{state:'PRIVATE_OVERVIEW',role:owner?'OWNER':'REVIEWER',providerId:config.providerId,recipientRef:config.recipientRef,configSha,deliveryEnabled:Deno.env.get('YW599_DELIVERY_ENABLED')==='true',enrollments,alerts});
 }
 if(action==='enroll'){
  if(!owner||!exact(['action','companyId','configSha','confirmed'])||b.confirmed!==true||b.configSha!==configSha)return reply(403,{state:'OWNER_CONSENT_HOLD'});
  const id=crypto.randomUUID(),createdAt=new Date().toISOString(),expiresAt=new Date(Math.min(Date.now()+7*86400000,Date.parse(pilot.expires_at))).toISOString();
  if(Date.parse(expiresAt)<=Date.parse(createdAt))return reply(409,{state:'EXPIRED_PILOT_HOLD'});
  const payload={schema:'rosevear.yw.provider-consent.v1',enrollmentId:id,companyId:b.companyId,ownerId:user.id,reviewerId:pilot.reviewer_user_id,providerId:config.providerId,recipientRef:config.recipientRef,configSha256:configSha,createdAt,expiresAt};
  const sig=await sign(keys.owner,'YW599-OWNER-CONSENT',payload);
  await rest('ywi_599_provider_enrollments','POST',{id,company_id:b.companyId,owner_id:user.id,reviewer_id:pilot.reviewer_user_id,provider_id:config.providerId,recipient_ref:config.recipientRef,config_sha256:configSha,owner_signature:sig,created_at:createdAt,expires_at:expiresAt});
  return reply(200,{state:'OWNER_CONSENT_RECORDED_REVIEW_REQUIRED',enrollmentId:id});
 }
 if(action==='approve'||action==='revoke'){
  if(!exact(['action','companyId','enrollmentId','configSha','confirmed'])||!uuid.test(b.enrollmentId)||b.confirmed!==true||b.configSha!==configSha)return reply(400,{state:'REQUEST_HOLD'});
  const e=await db.one('ywi_599_provider_enrollments',{id:b.enrollmentId,company_id:b.companyId});
  if(e.owner_id!==company.owner_user_id||e.reviewer_id!==pilot.reviewer_user_id)return reply(403,{state:'TENANT_AUTHORITY_HOLD'});
  if(action==='revoke'){
   await rest('ywi_599_provider_revocations','POST',{enrollment_id:e.id,actor_id:user.id});
   return reply(200,{state:'CONSENT_REVOKED',enrollmentId:e.id});
  }
  if(!reviewer||e.config_sha256!==configSha||e.provider_id!==config.providerId||e.recipient_ref!==config.recipientRef||!(Date.parse(e.expires_at)>Date.now())||await db.optional('ywi_599_provider_revocations',{enrollment_id:e.id}))return reply(403,{state:'REVIEW_AUTHORITY_HOLD'});
  const payload={schema:'rosevear.yw.provider-consent.v1',enrollmentId:e.id,companyId:e.company_id,ownerId:e.owner_id,reviewerId:e.reviewer_id,providerId:e.provider_id,recipientRef:e.recipient_ref,configSha256:e.config_sha256,createdAt:new Date(e.created_at).toISOString(),expiresAt:new Date(e.expires_at).toISOString()};
  if(!await verify(keys.owner,'YW599-OWNER-CONSENT',payload,e.owner_signature))return reply(409,{state:'ORIGINAL_OWNER_SIGNATURE_HOLD'});
  const approvedAt=new Date().toISOString();
  const reviewerSignature=await sign(keys.reviewer,'YW599-REVIEWER-APPROVAL',{...payload,ownerSignature:e.owner_signature,approvedAt});
  await rest('ywi_599_provider_approvals','POST',{enrollment_id:e.id,reviewer_id:user.id,reviewer_signature:reviewerSignature,approved_at:approvedAt});
  return reply(200,{state:'INDEPENDENT_REVIEW_RECORDED',enrollmentId:e.id});
 }
 if(action!=='deliver'||!owner||!exact(b.action===undefined?['alertId','companyId','confirmed','enrollmentId']:['action','alertId','companyId','confirmed','enrollmentId'])||![b.alertId,b.enrollmentId].every(x=>typeof x==='string'&&uuid.test(x))||b.confirmed!==true)return reply(400,{state:'REQUEST_HOLD'});
 if(Deno.env.get('YW599_DELIVERY_ENABLED')!=='true')return reply(409,{state:'DELIVERY_DISABLED_HOLD'});
 const result=await deliverOriginalAlert({actor:{id:user.id,active:true},companyId:b.companyId,enrollmentId:b.enrollmentId,alertId:b.alertId,confirmed:true,db,config,keys});
 return reply(200,result);
 }catch{return reply(409,{state:'AUTHORITY_OR_RUNTIME_HOLD'})}
});
