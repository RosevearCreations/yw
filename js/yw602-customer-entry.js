(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const status=$('yw602LoginStatus'),form=$('yw602Login'),host=$('yw602CustomerPortal'),logout=$('yw602Logout'),signIn=$('yw602SignIn');
 document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow,noarchive');
 const conf=window.YWI_RUNTIME_CONFIG||{};
 if(!conf.SUPABASE_URL||!conf.SUPABASE_ANON_KEY){status.textContent='HOLD · Property access service unavailable.';return;}
 let accessCode='',customerId='',active=false,epoch=0;
 // Deliberately NO Supabase Auth client/sign-up/login, JWT or staff identity.
 // Only the private code RPC is called using the published anonymous API key.
 const call=async(action,payload,code=accessCode)=>{
  try{
   const response=await fetch(conf.SUPABASE_URL+'/rest/v1/rpc/ywi_602_customer_portal',{method:'POST',
    headers:{apikey:conf.SUPABASE_ANON_KEY,Authorization:'Bearer '+conf.SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
    body:JSON.stringify({p_access_code:code,p_action:action,p_payload:payload})});
   if(!response.ok)return {error:{message:'Private access refused'}};
   return {data:await response.json()};
  }catch{return {error:{message:'Private access unavailable'}};}
 };
 const adapter={auth:{getUser:async()=>active?{data:{user:{id:customerId}}}:{error:{message:'Private access required'}}},
  rpc:async(name,args)=>{
   if(!active||name!=='ywi_602_property_portal')return {error:{message:'Action denied'}};
   const g=epoch,id=customerId,r=await call(args.p_action,args.p_payload);
   if(g!==epoch||r.data?.customer_id!==id)return {error:{message:'Session changed or access denied'}};
   return r;
  }};
 const portal=window.YW602PropertyPortal.mount(host,{getClient:()=>adapter,allowed:()=>active});
 function clear(){epoch++;active=false;accessCode='';customerId='';portal.reset();host.hidden=true;logout.hidden=true;signIn.hidden=false;form.elements.access_code.value='';}
 form.addEventListener('submit',async e=>{
  e.preventDefault();const code=form.elements.access_code.value.trim();clear();const g=epoch,submit=form.querySelector('button');submit.disabled=true;
  status.textContent='Verifying private property access…';
  try{
   if(!/^[a-f0-9]{64}$/.test(code))throw Error('Invalid access code');
   const r=await call('list',{},code);
   if(g!==epoch)return;
   if(r.error||r.data?.state!=='authorized_properties'||!r.data?.customer_id)throw Error('Access refused');
   accessCode=code;customerId=r.data.customer_id;active=true;signIn.hidden=true;host.hidden=false;logout.hidden=false;
   status.textContent='Private access verified. Only explicitly authorized properties will be listed.';
   await portal.load();
  }catch{if(g===epoch){clear();status.textContent='Access refused or expired. Contact your contractor for a private access code.';}}
  finally{form.elements.access_code.value='';submit.disabled=false;}
 });
 logout.addEventListener('click',()=>{clear();status.textContent='Signed out locally. Private property data cleared.';});
 window.addEventListener('pagehide',clear);
})();
