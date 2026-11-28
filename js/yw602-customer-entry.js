(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const status=$('yw602LoginStatus'),form=$('yw602Login'),host=$('yw602CustomerPortal'),logout=$('yw602Logout'),signIn=$('yw602SignIn');
 document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow,noarchive');
 const conf=window.YWI_RUNTIME_CONFIG||{};
 if(!window.supabase?.createClient||!conf.SUPABASE_URL||!conf.SUPABASE_ANON_KEY){status.textContent='HOLD · Sign-in service unavailable.';return;}
 const sb=window.supabase.createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'yw602-private-customer-session'}});
 let active=false,epoch=0;
 const portal=window.YW602PropertyPortal.mount(host,{getClient:()=>sb,allowed:()=>active});
 function clear(){epoch++;active=false;portal.reset();host.hidden=true;logout.hidden=true;signIn.hidden=false;}
 form.addEventListener('submit',async e=>{
  e.preventDefault();clear();const g=epoch,submit=form.querySelector('button');submit.disabled=true;
  status.textContent='Verifying account…';
  try{
   const email=form.elements.email.value.trim(),password=form.elements.password.value;
   const r=await sb.auth.signInWithPassword({email,password});form.elements.password.value='';
   if(g!==epoch)return;
   if(r.error||!r.data?.user)throw Error('Sign-in not accepted');
   const user=await sb.auth.getUser();if(g!==epoch)return;
   if(user.error||user.data?.user?.id!==r.data.user.id)throw Error('Account verification failed');
   active=true;signIn.hidden=true;host.hidden=false;logout.hidden=false;
   status.textContent='Account verified. Only explicitly authorized properties will be listed.';
   await portal.load();
  }catch{if(g===epoch){clear();status.textContent='Sign-in or verification failed. No property data loaded.';}}
  finally{form.elements.password.value='';submit.disabled=false;}
 });
 logout.addEventListener('click',async()=>{clear();status.textContent='Signed out locally. Private property data cleared.';try{await sb.auth.signOut({scope:'local'});}catch{}});
 sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clear();status.textContent='Session ended. Private data cleared.';}});
 window.addEventListener('pagehide',()=>{clear();});
})();
