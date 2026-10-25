/* Property Maintenance System · 443. Company-specific, read-only navigation.
 * The client is never an authorization boundary; 420 RLS, 422 owner assertion and
 * 421 server-side Jobs/estimate inserts remain authoritative. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const modules=Object.freeze([
 {key:'landscape',label:'Lawn & Grounds',target:'owner449'},
 {key:'construction',label:'Light Construction',target:'owner425'},
 {key:'water_parks',label:'Aquatic Facilities',target:'owner426'},
 {key:'snow_removal',label:'Snow Removal',target:'owner427'},
 {key:'snow_plowing',label:'Snow Plowing',target:'owner427'},
 {key:'septic',label:'Septic Services',target:'owner428'}
]);
const planned=Object.freeze(['Arboriculture & Tree Care','Concrete Pouring','Fibre / Utility Trenching',
 'Land Clearing','Excavation & Ditching','Hardscaping','Fencing & Decks','Commercial Property Inspections',
 'Advanced CRM Automation']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const withheld=reason=>({state:'withheld',reason,services:[],planned:[],historicalRead:false,newWorkAllowed:false});
function inspect(source,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const t=Date.parse(source?.captured_at);
 if(!uuid(companyId)||source?.company_id!==companyId||source.owner_guard!=='ywi_422_assert_owner'||
  source.jobs_new_work_guard!=='ywi_421_assert_company_new_work'||
  source.historical_audit_retained!==true||source.privacy_minimized!==true||
  source.mutation_authorized!==false||source.synthetic!==false||
  !Number.isFinite(t)||!Number.isFinite(now)||t>now+60000||now-t>300000||
  !Array.isArray(source.services)||source.services.length!==6||
  new Set(source.services.map(s=>s.module_key)).size!==6||
  source.services.some(s=>s.company_id!==companyId||!keys.includes(s.module_key)||typeof s.enabled!=='boolean')||
  jobsAllowed!==true)
  return withheld('Authenticated company ownership, complete fresh registry or Jobs viewing permission not verified');
 const enabled=new Set(source.services.filter(s=>s.enabled).map(s=>s.module_key));
 return {state:'verified_navigation_only',companyId,capturedAt:source.captured_at,
  services:modules.filter(m=>enabled.has(m.key)),planned:planned.slice(),
  disabled:modules.filter(m=>!enabled.has(m.key)).map(m=>m.key),
  historicalRead:true,newWorkAllowed:false,tenantScoped:true};
}
window.YWI443=Object.freeze({keys,modules,planned,inspect});
const element=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
function mount(){const root=document.getElementById('admin');if(!root||document.getElementById('pms443'))return;
 const panel=element('details');panel.id='pms443';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Company Modules & Service Navigation';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(element('summary','443 · Property Maintenance System · Company Module Navigator'));
 const body=element('div');body.className='admin-panel-block';
 body.append(element('p','Choose an owned company to see only its enabled service entry points. Desktop and mobile show the same six-service entitlements. This is navigation, not permission to create work. Existing authorized historical reviews remain available when an offering is OFF.'));
 const help=element('a','ⓘ Module navigation Help');help.href='/help.html#pms-tenant-module-navigation-443';body.append(help);
 const row=element('div');row.className='pms443-toolbar';
 const label=element('label','Verified owner company');const company=element('select');company.id='pms443Company';
 label.append(company);row.append(label);const refresh=element('button','Verify company modules');
 refresh.type='button';refresh.id='pms443Refresh';refresh.className='secondary';row.append(refresh);body.append(row);
 const status=element('p','Sign in as a verified company owner to load module navigation.');
 status.id='pms443Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const desktop=element('nav');desktop.id='pms443Desktop';desktop.className='pms443-desktop';desktop.setAttribute('aria-label','Company service modules (desktop)');body.append(desktop);
 const mobileLabel=element('label','Mobile service navigation');mobileLabel.className='pms443-mobile-label';
 const mobile=element('select');mobile.id='pms443Mobile';mobile.setAttribute('aria-label','Company service modules (mobile)');
 mobileLabel.append(mobile);body.append(mobileLabel);
 const archived=element('p');archived.id='pms443History';body.append(archived);
 const shared=element('button','Client & Property 360 · shared workspace');shared.type='button';
 shared.id='pms443Client360';shared.className='secondary';shared.hidden=true;
 shared.onclick=()=>{if(review?.state!=='verified_navigation_only')return;
  const target=document.getElementById('owner444');
  if(target?.tagName==='DETAILS'){target.open=true;target.scrollIntoView?.({block:'start',behavior:'smooth'});}
  else status.textContent='Client & Property 360 is not installed in this version.';};body.append(shared);
 const hrLink=element('button','Employee & HR · private company records');hrLink.type='button';
 hrLink.id='pms443HR';hrLink.className='secondary';hrLink.hidden=true;
 const garbageLink=element('button','Rural Garbage Collection · sticker and contract pickups');garbageLink.type='button';
 garbageLink.id='pms443Garbage';garbageLink.className='secondary';garbageLink.hidden=true;
 const payrollLink=element('button','Payroll Readiness · confidential planning');payrollLink.type='button';
 payrollLink.id='pms443Payroll';payrollLink.className='secondary';payrollLink.hidden=true;
 const accountingLink=element('button','Accounting · company financial controls');accountingLink.type='button';
 accountingLink.id='pms443Accounting';accountingLink.className='secondary';accountingLink.hidden=true;
 for(const [button,targetId] of [[hrLink,'owner445HR'],[garbageLink,'owner445Garbage'],
  [payrollLink,'owner446Payroll'],[accountingLink,'owner447Accounting']]){
  button.onclick=()=>{if(review?.state!=='verified_navigation_only')return;
   const target=document.getElementById(targetId);
   if(target?.tagName==='DETAILS'){target.open=true;target.scrollIntoView?.({block:'start',behavior:'smooth'});}
   else status.textContent='Company workspace is not installed in this version.';};
  body.append(button);
 }
 const later=element('details');later.id='pms443Planned';later.append(element('summary','Planned service and business modules (not available yet)'));
 const plannedList=element('ul');for(const name of planned)plannedList.append(element('li',name+' · PLANNED'));
 later.append(plannedList);body.append(later);
 panel.append(body);root.append(panel);
 let epoch=0,identity=null,roster=[],busy=false,review=null;
 const clear=()=>{company.replaceChildren();desktop.replaceChildren();mobile.replaceChildren();archived.replaceChildren();shared.hidden=true;hrLink.hidden=true;garbageLink.hidden=true;payrollLink.hidden=true;accountingLink.hidden=true;review=null;};
 function companyOptions(rows){const prior=company.value;company.replaceChildren();const placeholder=element('option','Choose owner company');placeholder.value='';company.append(placeholder);
  for(const item of rows){const opt=element('option',item.name);opt.value=item.id;company.append(opt);}
  if(rows.some(r=>r.id===prior))company.value=prior;else if(rows.length===1)company.value=rows[0].id;}
 function go(key){if(review?.state!=='verified_navigation_only'||!review.services.some(s=>s.key===key))return;
  const target=modules.find(m=>m.key===key);
  const section=document.getElementById(target?.target)||
    (key==='landscape'?document.getElementById('owner424'):null);
  if(section?.tagName==='DETAILS'){section.open=true;section.scrollIntoView?.({block:'start',behavior:'smooth'});}
  else status.textContent='Service entry point is not yet installed here; original Jobs and audits remain available under their own permissions.';}
 function render(value){review=value;desktop.replaceChildren();mobile.replaceChildren();
  const placeholder=element('option','Choose an enabled service');placeholder.value='';mobile.append(placeholder);
  if(value.state!=='verified_navigation_only'){status.textContent='WITHHELD: '+value.reason;archived.replaceChildren();shared.hidden=true;hrLink.hidden=true;garbageLink.hidden=true;payrollLink.hidden=true;accountingLink.hidden=true;return;}
  shared.hidden=false;hrLink.hidden=false;garbageLink.hidden=false;
  const role=window.YWI_AUTH?.getState?.()?.role;
  const financial=window.YWISecurity?.canViewModule?.('admin',role,'manage')&&
   window.YWISecurity?.canViewModule?.('finance',role,'manage');
  payrollLink.hidden=!financial;accountingLink.hidden=!financial;
  status.textContent='VERIFIED MENU ONLY: '+value.services.length+' enabled / '+value.disabled.length+' disabled. No new-work authorization was granted.';
  for(const service of value.services){const button=element('button',service.label);button.type='button';button.className='secondary';
   button.dataset.pms443Service=service.key;button.onclick=()=>go(service.key);desktop.append(button);
   const opt=element('option',service.label);opt.value=service.key;mobile.append(opt);}
  if(!value.services.length)desktop.append(element('p','All services are OFF for this company.'));
  archived.replaceChildren();archived.append(element('strong','Historical access retained: '),
   document.createTextNode('authorized Jobs and audit screens still follow their existing roles and server checks; the module switch does not delete records.'));
 }
 async function session(){const state=window.YWI_AUTH?.getState?.();const sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!uuid(state.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',state.role,'view'))
   throw Error('Verified owner identity and Jobs view access required');
  const response=await sb.auth.getUser();if(response.error||response.data?.user?.id!==state.user.id)
   throw Error('Supabase owner identity mismatch');return{uid:state.user.id,sb,role:state.role};}
 const alive=(uid,start)=>epoch===start&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
  window.YWI_AUTH.getState().user?.id===uid;
 async function load(){const start=epoch,ctx=await session();if(!alive(ctx.uid,start))throw Error('Owner session changed');
  if(identity!==ctx.uid){clear();identity=ctx.uid;roster=[];}
  if(!roster.length){const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(!alive(ctx.uid,start)||r.error||!Array.isArray(r.data)||r.data.length>100||
    new Set(r.data.map(c=>c.id)).size!==r.data.length||
    r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==ctx.uid))throw Error('Company roster incomplete or foreign');
   roster=r.data;companyOptions(roster);}
  if(!roster.length){status.textContent='HOLD: no real company is registered. Yard Rosevear is a synthetic test fixture, not a Production login.';return;}
  const id=company.value;if(!roster.some(c=>c.id===id)){render(withheld('Choose a verified owner company'));return;}
  const r=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
  if(!alive(ctx.uid,start)||company.value!==id||r.error||!r.data)throw Error('Owner-scoped module registry denied or changed');
  render(inspect(r.data,{companyId:id,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')}));}
 refresh.onclick=async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;
  try{await load();}catch(e){render(withheld(e?.message||String(e)));}
  finally{busy=false;refresh.disabled=company.disabled=false;}};
 company.onchange=()=>{epoch++;render(withheld('Company changed; refresh and verify the new company registry'));};
 mobile.onchange=()=>{const key=mobile.value;mobile.value='';go(key);};
 document.addEventListener('ywi:auth-changed',()=>{epoch++;identity=null;roster=[];clear();status.textContent='Company identity changed; menu cleared.';});
 document.addEventListener('ywi:module-permissions-changed',()=>{epoch++;desktop.replaceChildren();mobile.replaceChildren();shared.hidden=true;review=null;status.textContent='Module permissions changed; reverify company menu.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
