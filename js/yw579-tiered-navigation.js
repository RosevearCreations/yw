/* YW579 — three-tier navigation presentation.
 * Workspace (original YW550) → permissioned functions + independently enabled
 * company services (original YW443) → module-owned tools. Read-only.
 * Existing module security, original service RPC, and RLS remain authoritative. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const root=document.documentElement;
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const sec=()=>window.YWISecurity||null;
const snapshot=()=>window.YWIDualWorkspace?.snapshot?.()||{};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
const state={epoch:0,loading:false,actor:'',companies:[],companyId:'',review:null,service:'',timer:null};
const isPlatform=()=>location.hash==='#sysop'||root.dataset.ywSurface==='platform';
const signed=()=>auth().isAuthenticated===true&&uuid(auth().user?.id);
const owner=()=>signed()&&!isPlatform()&&snapshot().ownedCompanies>0;
const role=()=>auth().role||'employee';
const allowed=(section)=>signed()&&sec()?.canViewSection?.(section,role())===true;
const status=msg=>{const n=$('yw579ServiceStatus');if(n)n.textContent=msg;};
const recent=()=>state.review?.state==='verified_navigation_only'&&
  Number.isFinite(Date.parse(state.review.capturedAt))&&
  Date.now()-Date.parse(state.review.capturedAt)<240000;
const available=service=>owner()&&recent()&&state.companyId&&
  state.companies.some(c=>c.id===state.companyId)&&
  state.review?.companyId===state.companyId&&
  state.review.services.some(s=>s.key===service);
function clearNavigation(msg='Service modules require verified company ownership and a current company registry.'){
 state.review=null;state.service='';root.removeAttribute('data-yw579-service');
 for(const id of ['yw579ServiceNav','yw579PlanningNav','yw579ServiceTools']){
  const n=$(id);if(n){n.replaceChildren();n.hidden=true;}
 }
 const label=$('yw579CompanyLabel');if(label)label.hidden=true;
 status(msg);
}
function reset(){
 state.epoch++;state.companies=[];state.companyId='';state.actor='';
 clearNavigation();
 const pick=$('yw579CompanySelect');pick?.replaceChildren();
}
function showServiceNav(){
 const main=$('yw579ServiceNav'),planning=$('yw579PlanningNav');
 if(!main||!planning)return;
 main.replaceChildren();planning.replaceChildren();
 if(!owner()||!recent()||state.review?.companyId!==state.companyId){
  main.hidden=planning.hidden=true;return;
 }
 for(const item of state.review.services){
  const b=el('button',item.label);b.type='button';b.className='yw579-service';
  b.dataset.yw579Service=item.key;b.setAttribute('aria-pressed',state.service===item.key?'true':'false');
  b.addEventListener('click',()=>choose(item.key));main.append(b);
 }
 main.hidden=!state.review.services.length;
 // Distinct planning-only routes are not eighth/ninth ON entitlement switches.
 for(const item of window.YWI443?.specialties||[]){
  if(!allowed(item.route))continue;
  const b=el('button',item.label+' · planning only');b.type='button';
  b.className='yw579-planning';b.dataset.yw579Planning=item.key;
  b.addEventListener('click',()=>{
   if(!owner()||!recent()||!allowed(item.route)){clearNavigation('Planning unavailable: reverify company permissions.');return;}
   resetSelected();window.YWIRouter?.showSection?.(item.route);
  });planning.append(b);
 }
 planning.hidden=!planning.childElementCount;
}
function resetSelected(){
 state.service='';root.removeAttribute('data-yw579-service');
 const sub=$('yw579ServiceTools');if(sub){sub.replaceChildren();sub.hidden=true;}
 showServiceNav();
}
function route(id){
 if(!owner()||!recent()||!state.service||!available(state.service)||!allowed(id)){
  resetSelected();status('HOLD: company, module or service verification is no longer current.');return;
 }
 window.YWIRouter?.showSection?.(id);
}
function openServiceSetup(targetId){
 if(!owner()||!recent()||!available(state.service)||!allowed('admin')){
  status('HOLD: service configuration requires current company ownership and Admin permission.');return;
 }
 window.YWIRouter?.showSection?.('admin');
 // The original company service details mount with the Admin module.
 const open=()=>{
  if(!available(state.service)||!allowed('admin'))return;
  const target=$(targetId);
  if(target?.tagName==='DETAILS'){target.open=true;target.scrollIntoView?.({block:'start',behavior:'auto'});}
  else status('Original service workspace is not available for this signed-in role.');
 };
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(open,0));
 else setTimeout(open,0);
}
function makeTools(key){
 const nav=$('yw579ServiceTools');if(!nav)return;
 nav.replaceChildren();nav.hidden=true;
 if(!available(key))return;
 const data=window.YWI443?.modules?.find(s=>s.key===key);
 const options=[
  ['Service setup','admin',data?.target],
  ['Jobs & schedule','today'],
  ['Client / work orders','jobs'],
  ['Crew allocation','crew'],
  ['Equipment & materials','equipment'],
  ['Safety / evidence','inspect'],
  ['Finance / invoices','finance'],
  ['Company settings','settings']
 ];
 for(const [label,section,detail] of options){
  if(!allowed(section)||(!detail&&section==='admin'))continue;
  const b=el('button',label);b.type='button';b.className='yw579-tool';
  b.dataset.yw579Tool=section;
  b.addEventListener('click',()=>detail?openServiceSetup(detail):route(section));
  nav.append(b);
 }
 nav.hidden=!nav.childElementCount;
}
function choose(key){
 if(!available(key)){
  resetSelected();status('HOLD: verify enabled service and company ownership before opening tools.');return;
 }
 state.service=key;root.dataset.yw579Service=key;
 showServiceNav();makeTools(key);
 status('VERIFIED NAVIGATION ONLY · '+state.review.services.find(s=>s.key===key).label+
  ' · Original Jobs, Finance, HR, Safety, Equipment and service-specific authorities still apply.');
}
async function refresh(){
 const epoch=++state.epoch,subject=auth().user?.id||'';
 state.loading=true;state.review=null;state.service='';
 root.removeAttribute('data-yw579-service');showServiceNav();
 if(!owner()){
  clearNavigation(isPlatform()?'Platform scope: no tenant service or financial records.':
   'HOLD: verify a landscaping company owner session before loading service modules.');
  state.loading=false;return;
 }
 status('Verifying original company ownership and enabled service registry…');
 try{
  const sb=window.YWI_SB||window._sb;
  if(!sb?.auth?.getUser||!sb?.rpc||!sb?.from||!window.YWI443?.inspect)
   throw Error('Original service registry not available');
  if(!sec()?.canViewModule?.('jobs',role(),'view'))
   throw Error('Jobs module view access required for service navigation');
  const user=await sb.auth.getUser();
  if(epoch!==state.epoch||!owner()||auth().user?.id!==subject)return;
  if(user.error||user.data?.user?.id!==subject)throw Error('Authenticated identity mismatch');
  const c=await sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(epoch!==state.epoch||!owner()||auth().user?.id!==subject)return;
  if(c.error||!Array.isArray(c.data)||c.data.length>100||
    c.data.some(x=>!uuid(x.id)||typeof x.name!=='string'||!x.name||x.owner_user_id!==subject)||
    new Set(c.data.map(x=>x.id)).size!==c.data.length)
   throw Error('Original company roster invalid or includes a foreign company');
  state.companies=c.data;state.actor=subject;
  if(!c.data.length)throw Error('No verified company under this owner');
  const select=$('yw579CompanySelect'),label=$('yw579CompanyLabel'),prior=state.companyId;
  state.companyId=c.data.some(x=>x.id===prior)?prior:c.data[0].id;
  if(select){
   select.replaceChildren();
   for(const company of c.data){
    const o=el('option',company.name);o.value=company.id;select.append(o);
   }
   select.value=state.companyId;
  }
  if(label)label.hidden=false;
  const companyId=state.companyId;
  const response=await sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:companyId});
  if(epoch!==state.epoch||!owner()||auth().user?.id!==subject||state.companyId!==companyId)return;
  if(response.error||!response.data)throw Error('Original company service registry unavailable');
  const review=window.YWI443.inspect(response.data,{companyId,
   jobsAllowed:sec()?.canViewModule?.('jobs',role(),'view')===true});
  if(review?.state!=='verified_navigation_only')throw Error(review?.reason||'Registry verification failed');
  state.review=review;showServiceNav();
  status('Company verified · '+review.services.length+' enabled / '+review.disabled.length+
   ' disabled service modules. Planning tools are separate from paid service entitlements.');
 }catch(e){
  if(epoch===state.epoch)clearNavigation('HOLD: '+(e?.message||'Company verification unavailable'));
 }finally{if(epoch===state.epoch)state.loading=false;}
}
function reschedule(){
 if(state.timer)clearTimeout(state.timer);
 state.timer=setTimeout(()=>{state.timer=null;refresh();},100);
}
function init(){
 const select=$('yw579CompanySelect'),refreshBtn=$('yw579RefreshServices');
 if(select)select.addEventListener('change',()=>{
  if(!owner()||!state.companies.some(c=>c.id===select.value)){reset();return;}
  state.companyId=select.value;reschedule();
 });
 refreshBtn?.addEventListener('click',reschedule);
 // Selecting a shared business function intentionally resets the service-only third tier.
 $('mainNav')?.addEventListener('click',e=>{
  if(e.target?.closest?.('[data-module]'))resetSelected();
 },true);
 $('workspace550Nav')?.addEventListener('click',()=>resetSelected(),true);
 document.addEventListener('ywi:route-shown',()=>{
  if(isPlatform()){resetSelected();clearNavigation('Platform monitoring is isolated from tenant service operations.');}
  else if(state.service&&!available(state.service)){resetSelected();status('Service verification expired; refresh to review modules.');}
 });
 document.addEventListener('ywi:auth-changed',()=>{reset();reschedule();});
 document.addEventListener('ywi:module-permissions-changed',reschedule);
 document.addEventListener('ywi:workspace-authority-changed',reschedule);
 document.addEventListener('ywi:company-service-offering-changed',reschedule);
 window.addEventListener('hashchange',()=>{if(isPlatform())resetSelected();});
 reschedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
window.YW579Navigation=Object.freeze({refresh,choose,reset,available,
 snapshot:()=>({loading:state.loading,companyId:state.companyId,
  verified:recent(),enabledServices:recent()?state.review.services.map(x=>x.key):[],selectedService:state.service})});
})();
