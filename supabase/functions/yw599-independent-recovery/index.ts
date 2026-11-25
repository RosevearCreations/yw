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
 if(!b||Object.keys(b).sort().join('|')!=='alertId|companyId|confirmed|enrollmentId'||![b.alertId,b.companyId,b.enrollmentId].every(x=>typeof x==='string'&&uuid.test(x))||b.confirmed!==true)return reply(400,{state:'REQUEST_HOLD'});
 // Explicit operator activation is separate from deployment; no automatic sends.
 if(Deno.env.get('YW599_DELIVERY_ENABLED')!=='true')return reply(409,{state:'DELIVERY_DISABLED_HOLD'});
 const config=JSON.parse(env('YW599_APPROVED_PROVIDER_CONFIG'));
 const keys={owner:env('YW599_OWNER_CONSENT_KEY'),reviewer:env('YW599_REVIEWER_APPROVAL_KEY'),request:env('YW599_PROVIDER_REQUEST_KEY'),receipt:env('YW599_PROVIDER_RECEIPT_KEY')};
 if(new Set(Object.values(keys)).size!==4)return reply(409,{state:'KEY_SEPARATION_HOLD'});
 const result=await deliverOriginalAlert({actor:{id:user.id,active:true},companyId:b.companyId,enrollmentId:b.enrollmentId,alertId:b.alertId,confirmed:true,db,config,keys});
 return reply(200,result);
 }catch{return reply(409,{state:'AUTHORITY_OR_RUNTIME_HOLD'})}
});
