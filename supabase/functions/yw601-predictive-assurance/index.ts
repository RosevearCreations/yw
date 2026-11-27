import {assessEvidence} from '../_shared/yw601-predictive-assurance.mjs';
import {resolveOriginalContracts} from '../_shared/yw601-original-contracts.mjs';
const origins=new Set(['https://yw-alpha.vercel.app','https://yardweasels.ca','https://www.yardweasels.ca']);
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw Error('CONFIG_HOLD');return v};
const unknown=(state:string)=>({state,confidence:'INSUFFICIENT',outageConfirmed:false,recoveryConfirmed:false,automaticRecoveryPerformed:false,automaticNotificationSent:false});
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'cache-control':'no-store','vary':'Origin','content-type':'application/json',...(origins.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,x-client-info,content-type','access-control-allow-methods':'POST,OPTIONS'}:{})};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,unknown('ORIGIN_HOLD'));
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,unknown('METHOD_HOLD'));
 try{
  const token=req.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return reply(401,unknown('AUTH_HOLD'));
  const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:service,authorization:token},signal:AbortSignal.timeout(5000)});
  if(!auth.ok)return reply(401,unknown('AUTH_HOLD'));
  const user=await auth.json();if(!uuid(user.id))return reply(401,unknown('AUTH_HOLD'));
  const read=async(table:string,columns:string,filters:Record<string,string>,limit=2,order?:string)=>{
   const q=new URLSearchParams({select:columns,limit:String(limit),...filters});if(order)q.set('order',order);
   const r=await fetch(base+'/rest/v1/'+table+'?'+q,{headers:{apikey:service,authorization:'Bearer '+service},signal:AbortSignal.timeout(5000)});
   if(!r.ok)throw Error('DB_HOLD');const a=await r.json();if(!Array.isArray(a))throw Error('DB_HOLD');return a;
  };
  const one=async(t:string,c:string,f:Record<string,string>)=>{const a=await read(t,c,f);if(a.length!==1)throw Error('ROW_HOLD');return a[0]};
  const raw=await req.text();if(raw.length>1024)return reply(413,unknown('BODY_HOLD'));
  const b=JSON.parse(raw);if(!b||b.action!=='overview'||!uuid(b.companyId)||Object.keys(b).sort().join('|')!=='action|companyId')return reply(400,unknown('REQUEST_HOLD'));
  const profile=await one('profiles','id,is_active',{id:'eq.'+user.id});if(profile.is_active!==true)return reply(403,unknown('ACCOUNT_HOLD'));
  const company=await one('ywi_companies','id,owner_user_id',{id:'eq.'+b.companyId});
  const pilotRows=await read('ywi_591_tenant_pilots','company_id,owner_user_id,reviewer_user_id,state,expires_at',{company_id:'eq.'+company.id,owner_user_id:'eq.'+company.owner_user_id,state:'eq.APPROVED',expires_at:'gt.'+new Date().toISOString()});
  if(!pilotRows.length&&user.id===company.owner_user_id)return reply(200,{...unknown('UNKNOWN_NO_ACTIVE_PILOT'),assessments:[]});
  if(pilotRows.length!==1)return reply(403,unknown('TENANT_AUTHORITY_HOLD'));
  const pilot=pilotRows[0];
  if(pilot.owner_user_id===pilot.reviewer_user_id||![pilot.owner_user_id,pilot.reviewer_user_id].includes(user.id))return reply(403,unknown('TENANT_AUTHORITY_HOLD'));
  const profiles=await Promise.all([pilot.owner_user_id,pilot.reviewer_user_id].map(id=>one('profiles','id,is_active',{id:'eq.'+id})));
  if(profiles.some(p=>p.is_active!==true))return reply(403,unknown('PILOT_ACCOUNT_HOLD'));
  const now=Date.now(),at=new Date(now).toISOString();
  const watches=await read('ywi_597_health_enrollments','id,company_id,approval_id,owner_user_id,started_at,expires_at,sample_period_minutes,passive_monitor_only',{company_id:'eq.'+company.id,owner_user_id:'eq.'+company.owner_user_id,expires_at:'gt.'+at},9,'started_at.desc');
  if(watches.length>8)return reply(200,{...unknown('UNKNOWN_WATCH_LIMIT'),assessments:[]});
  const assessments=[];
  for(const e of watches){
   try{
    const rows=await read('ywi_597_health_samples','id,company_id,enrollment_id,challenge_nonce,source_actor_id,prior_hmac,next_hmac,receiver_response_sha256,verified_at,receiver_state,local_event_sha256,local_event_hmac,actual_key_changed',{company_id:'eq.'+company.id,enrollment_id:'eq.'+e.id,verified_at:'gte.'+new Date(now-86400000).toISOString()},97,'verified_at.desc');
    if(!rows.length){assessments.push({...unknown('UNKNOWN_NO_SIGNED_SAMPLES'),enrollmentId:e.id});continue;}
    const contracts=await resolveOriginalContracts({enrollment:e,company:company.id,reviewerId:pilot.reviewer_user_id});
    const result=await assessEvidence({enrollment:e,rows,contractIds:contracts,keys:{old:env('YW592_MASTER_ACK_KEY'),next:env('YW596_RECEIVER_NEXT_ACK_KEY'),local:env('YW597_HEALTH_HMAC_KEY')},now});
    assessments.push({...result,enrollmentId:e.id});
   }catch{assessments.push({...unknown('UNKNOWN_ORIGINAL_CHAIN_HOLD'),enrollmentId:e.id});}
  }
  // Read-only, tenant scoped. No receipt claims, provider sends or remote recovery.
  return reply(200,{state:watches.length?'TENANT_EVIDENCE_ASSESSMENT':'UNKNOWN_NO_ACTIVE_WATCH',assessedAt:at,assessments,automatedSampleProbesActive:false,outageConfirmed:false,recoveryConfirmed:false,automaticRecoveryPerformed:false,automaticNotificationSent:false});
 }catch{return reply(409,unknown('AUTHORITY_OR_RUNTIME_HOLD'))}
});
