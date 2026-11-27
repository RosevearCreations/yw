// Isolated actual Edge entrypoint acceptance. No network or production credentials.
import assert from 'node:assert/strict';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const owner=id(1),reviewer=id(2),company=id(3),foreign=id(4);
let handler,actor=owner,active=true,expired=false,requests=[];
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'})[n]},serve:h=>{handler=h}};
globalThis.fetch=async(input,options={})=>{
 const u=new URL(input);requests.push([u.pathname,options.method??'GET']);
 assert.equal(u.hostname,'fixture.invalid');
 if(u.pathname==='/auth/v1/user')return Response.json({id:actor});
 assert.equal(options.method,'GET');
 const table=u.pathname.split('/').pop();
 if(table==='profiles')return Response.json([{id:actor,is_active:active}]);
 if(table==='ywi_companies')return Response.json([{id:company,owner_user_id:owner}]);
 if(table==='ywi_591_tenant_pilots')return Response.json([{company_id:company,owner_user_id:owner,reviewer_user_id:reviewer,state:'APPROVED',expires_at:new Date(Date.now()+(expired?-10000:10000)).toISOString()}]);
 throw Error('unexpected fixture access '+table);
};
await import('../supabase/functions/yw600-independent-failover/index.ts');
assert.equal(typeof handler,'function');
const call=async({method='POST',origin='https://yw-alpha.vercel.app',token='Bearer aaa.bbb.ccc',body={companyId:company,action:'deliver'}}={})=>{
 requests=[];const r=await handler(new Request('https://edge.invalid',{method,headers:{origin,authorization:token,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
 return [r.status,r.status===204?null:(await r.json()).state];
};
assert.deepEqual(await call({token:''}),[401,'AUTH_HOLD']);assert.equal(requests.length,0);
assert.deepEqual(await call({origin:'https://foreign.invalid'}),[403,'ORIGIN_HOLD']);assert.equal(requests.length,0);
assert.deepEqual(await call({method:'GET'}),[405,'METHOD_HOLD']);
assert.deepEqual(await call({method:'OPTIONS'}),[204,null]);
assert.deepEqual(await call(),[409,'FAILOVER_DISABLED_HOLD']);
actor=reviewer;assert.deepEqual(await call(),[409,'FAILOVER_DISABLED_HOLD']);
actor=foreign;assert.deepEqual(await call(),[403,'TENANT_AUTHORITY_HOLD']);
actor=owner;active=false;assert.deepEqual(await call(),[403,'ACCOUNT_HOLD']);
active=true;expired=true;assert.deepEqual(await call(),[403,'TENANT_AUTHORITY_HOLD']);
expired=false;assert.deepEqual(await call({body:{companyId:'invalid',action:'deliver'}}),[400,'REQUEST_HOLD']);
console.log('YW600 actual Edge entrypoint: auth, origin, method, active account, tenant, expiry and unconditional delivery HOLD verified in isolated fixtures.');
