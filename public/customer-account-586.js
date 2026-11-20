/* YW586 — existing customer sign-in, original YW422/585 verification.
 * NO public signup, account issuance, job/photo access or payment APIs.
 * The current YW585 SQL is STAGING-ONLY and is not enrolled in production;
 * missing tables or RPCs must result in HOLD without private data.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
 const hold=reason=>Object.freeze({state:'HOLD',reason,companies:[],jobAccess:false,photoAccess:false,
  bookingAuthorized:false,customerEnrolled:false,financeAuthorized:false});
 function inspectMemberships(rows,actorId){
  if(!uuid(actorId)||!Array.isArray(rows)||!rows.length||rows.length>20)return hold('No independently active original customer links');
  const seen=new Set();
  for(const r of rows){
   if(!uuid(r?.company_id)||!uuid(r?.client_id)||r.customer_user_id!==actorId||
     r.membership_state!=='active'||seen.has(r.company_id))return hold('Foreign, inactive or duplicate original CRM membership');
   seen.add(r.company_id);
  }
  return Object.freeze({state:'SOURCE_MEMBERSHIPS_ONLY',companies:rows.map(r=>({
   companyId:r.company_id,clientId:r.client_id})),
   requiresLiveServerReadback:true,jobAccess:false,photoAccess:false,
   customerEnrolled:false,bookingAuthorized:false,financeAuthorized:false});
 }
 function inspectScope(scope,member,now=Date.now()){
  if(!member||scope?.scope!=='original_customer_company_only'||
    scope?.company_id!==member.companyId||scope.client_id!==member.clientId||
    typeof scope.company_name!=='string'||scope.company_name.trim().length<2||
    scope.company_name.trim().length>160||
    !Number.isSafeInteger(scope.service_count_enabled)||scope.service_count_enabled<0||
    scope.service_count_enabled>7||
    !Number.isFinite(Date.parse(scope.captured_at))||
    !Number.isFinite(now)||Date.parse(scope.captured_at)>now+60000||
    now-Date.parse(scope.captured_at)>180000||
    scope.can_view_work_orders!==false||scope.can_view_photos!==false||
    scope.can_submit_booking!==false||scope.can_charge_account!==false||
    scope.can_change_company_settings!==false||scope.public_site_published!==false||
    scope.owner_or_sysop_authority!==false)
    return hold('Unauthenticated or stale customer scope');
  return Object.freeze({state:'VERIFIED_SCOPE_READ_ONLY',companyId:member.companyId,
   displayName:scope.company_name.trim(),serviceCount:scope.service_count_enabled,
   jobAccess:false,photoAccess:false,bookingAuthorized:false,
   customerEnrolled:false,financeAuthorized:false});
 }
 const state={epoch:0,busy:false,client:null,verifiedUser:null,companies:[]};
 function status(message){const n=$('yw586-account-status');if(n)n.textContent=message;}
 function clear({signOut=false}={}){
  state.epoch++;state.verifiedUser=null;state.companies=[];
  $('yw586-company-list')?.replaceChildren();
  const list=$('yw586-company-list');if(list){const p=document.createElement('p');
   p.textContent='No independently verified original customer company account is available.';list.append(p);}
  const password=$('yw586-password');if(password)password.value='';
  if(signOut&&state.client?.auth?.signOut){
   // Actual remote sign-out is best effort; local state is already invalidated.
   state.client.auth.signOut().catch(()=>{});
  }
 }
 function client(){
  if(state.client)return state.client;
  const config=window.YWI_RUNTIME_CONFIG||{};
  const url=String(config.SB_URL||config.SUPABASE_URL||'');
  const key=String(config.SB_ANON_KEY||config.SUPABASE_ANON_KEY||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||
     !key||!window.supabase?.createClient)
    throw Error('Authentication configuration unavailable');
  state.client=window.supabase.createClient(url,key,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   global:{headers:{'x-ywi-customer-surface':'586-read-only'}}
  });
  return state.client;
 }
 async function signIn(e){
  e.preventDefault();if(state.busy)return;
  // Capture credentials before clearing the visible password and prior
  // company state. Never persist the password beyond this in-flight call.
  const email=$('yw586-email')?.value.trim()||'';
  const pass=$('yw586-password')?.value||'';
  clear({signOut:false});state.busy=true;
  const run=state.epoch,button=$('yw586-login');
  if(button)button.disabled=true;
  status('Verifying existing account and original CRM membership…');
  try{
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||pass.length<8||pass.length>256)
    throw Error('Valid existing email and password required');
   const sb=client();
   const a=await sb.auth.signInWithPassword({email,password:pass});
   if(run!==state.epoch)return;
   if(a.error||!uuid(a.data?.user?.id))throw Error('Existing customer sign-in was not verified');
   const confirm=await sb.auth.getUser();
   if(run!==state.epoch)return;
   if(confirm.error||confirm.data?.user?.id!==a.data.user.id)throw Error('Current server-side identity not verified');
   const actorId=confirm.data.user.id;
   state.verifiedUser=actorId;
   const query=await sb.from('ywi_585_customer_memberships')
    .select('company_id,client_id,customer_user_id,membership_state')
    .eq('customer_user_id',actorId).eq('membership_state','active').limit(21);
   if(run!==state.epoch||state.verifiedUser!==actorId)return;
   if(query.error)throw Error('Original customer enrollment is not active');
   const m=inspectMemberships(query.data,actorId);
   if(m.state!=='SOURCE_MEMBERSHIPS_ONLY')throw Error(m.reason);
   const approved=[];
   for(const member of m.companies){
    const user=await sb.auth.getUser();
    if(run!==state.epoch||state.verifiedUser!==actorId)return;
    if(user.error||user.data?.user?.id!==actorId)throw Error('Identity changed during independent review');
    const p=await sb.rpc('ywi_585_customer_portal_scope',{p_company_id:member.companyId});
    if(run!==state.epoch||state.verifiedUser!==actorId)return;
    if(p.error)throw Error('Original customer scope was not available');
    const valid=inspectScope(p.data,member);
    if(valid.state!=='VERIFIED_SCOPE_READ_ONLY')throw Error(valid.reason);
    approved.push(valid);
   }
   if(!approved.length)throw Error('Original customer membership has not been approved');
   state.companies=approved;
   const list=$('yw586-company-list');if(list){
    list.replaceChildren();
    for(const company of approved){
     const card=document.createElement('article');card.className='account-company';
     const h=document.createElement('h3');h.textContent=company.displayName;
     const p=document.createElement('p');
     p.textContent='Verified company scope · '+company.serviceCount+' currently enabled service(s) · Job, photo and payment access not enrolled';
     card.append(h,p);list.append(card);
    }
   }
   status('Verified customer session with '+approved.length+' original company link(s). Read-only company scope; bookings and private records remain unavailable.');
  }catch(_){
   if(run===state.epoch){
    clear({signOut:true});
    status('HOLD · Sign-in or independently approved original customer linkage unavailable. No private customer records were opened.');
   }
  }finally{state.busy=false;if(button)button.disabled=false;}
 }
 function mount(){
  // js/app-config.js manages general SEO metadata; this restricted account
  // must remain noindex regardless of the app's public landing authority.
  const robots=document.querySelector('meta[name="robots"]');
  if(robots)robots.setAttribute('content','noindex,nofollow,noarchive,nosnippet');
  $('yw586-login-form')?.addEventListener('submit',signIn);
  $('yw586-logout')?.addEventListener('click',()=>{clear({signOut:true});status('Session cleared. No customer data remains displayed.');});
  window.addEventListener?.('pagehide',()=>clear({signOut:true}));
  clear();
 }
 window.YW586CustomerAccount=Object.freeze({inspectMemberships,inspectScope,
  snapshot:()=>({companyCount:state.companies.length,authorized:false,
   jobAccess:false,photoAccess:false,bookingAuthorized:false,financeAuthorized:false})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
