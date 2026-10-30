/* Build 490/491. Company ownership is server-side and every read remains
   subject to Supabase RLS. Build 491 invalidates in-flight reads on logout. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const node=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
const serviceKeys=new Set(['landscape','construction','water_parks','snow_removal',
 'snow_plowing','septic','arboriculture']);
const actions=new Set(['initialized','enabled','disabled']);
const validAudit=(a,companyId)=>a&&a.company_id===companyId&&
 serviceKeys.has(a.module_key)&&actions.has(a.action)&&
 Number.isFinite(Date.parse(a.recorded_at))&&(
  (a.action==='initialized'&&a.previous_enabled===null&&a.next_enabled===false)||
  (a.action==='enabled'&&a.previous_enabled===false&&a.next_enabled===true)||
  (a.action==='disabled'&&a.previous_enabled===true&&a.next_enabled===false));
const describeAudit=a=>new Date(a.recorded_at).toLocaleString()+' · '+
 a.module_key.replaceAll('_',' ')+' · '+a.action+' · '+
 (a.previous_enabled===null?'INITIAL':a.previous_enabled?'ON':'OFF')+
 ' → '+(a.next_enabled?'ON':'OFF');
function install(){
 const host=$('settings');if(!host||$('owner490'))return;
 const section=node('section');section.id='owner490';section.className='admin-panel-block';
 section.style.cssText='border:1px solid #64748b;border-radius:12px;padding:14px;margin:14px 0;min-width:0;overflow-wrap:anywhere';
 section.appendChild(node('h3','My Company Workspace'));
 section.appendChild(node('p','Company ownership is separate from Yard Workers platform administration. Only our own company records are available here.'));
 const load=node('button','Load my companies');load.type='button';load.id='owner490Load';
 const status=node('p','Sign in to verify company ownership.');status.id='owner490Status';status.setAttribute('role','status');
 const list=node('div');list.id='owner490List';list.style.cssText='display:grid;gap:10px;min-width:0';
 section.append(load,status,list);
 const heading=host.querySelector('h2');if(heading)heading.after(section);else host.appendChild(section);
 let generation=0,verifiedIds=new Set(),pendingFocus=null;
 const currentIdentity=uid=>{
  const s=window.YWI_AUTH?.getState?.();
  return s?.isAuthenticated===true&&s.user?.id===uid;
 };
 async function refresh(){
  const epoch=++generation;
  load.disabled=true;list.replaceChildren();status.textContent='Checking signed-in identity and company ownership…';
  verifiedIds=new Set();pendingFocus=null;
  try{
   const sb=window.YWI_SB||window._sb,session=window.YWI_AUTH?.getState?.();
   if(session?.isAuthenticated!==true||!session?.user?.id||!sb?.auth?.getUser||!sb?.from)
     throw Error('Authenticated company owner required');
   const uid=session.user.id;
   const assertCurrent=()=>{
    if(epoch!==generation||!currentIdentity(uid))throw Error('Session changed during company read');
   };
   const auth=await sb.auth.getUser();
   assertCurrent();
   if(auth.error||auth.data?.user?.id!==session.user.id)throw Error('Session identity mismatch');
   const q=await sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   assertCurrent();
   if(q.error||!Array.isArray(q.data)||q.data.length>100||q.data.some(c=>
     !c.id||!c.name||c.owner_user_id!==session.user.id))throw Error('Owner company roster unavailable or cross-tenant');
   if(!q.data.length){status.textContent='No companies owned by this account.';return;}
   const views=[];
   for(const c of q.data){
    const m=await sb.from('ywi_company_service_modules').select('company_id,module_key,enabled')
     .eq('company_id',c.id).limit(8);
    assertCurrent();
    if(m.error||!Array.isArray(m.data)||m.data.length!==7||new Set(m.data.map(x=>x.module_key)).size!==7||
      m.data.some(x=>x.company_id!==c.id||!serviceKeys.has(x.module_key)||typeof x.enabled!=='boolean'))
      throw Error('Company module registry incomplete or foreign');
    const audit=await sb.from('ywi_company_service_module_audit')
     .select('id,company_id,module_key,action,previous_enabled,next_enabled,recorded_at')
     .eq('company_id',c.id).order('id',{ascending:false}).limit(26);
    assertCurrent();
    if(audit.error||!Array.isArray(audit.data)||audit.data.some(a=>!validAudit(a,c.id)))
      throw Error('Company switch history unavailable or foreign');
    views.push({company:c,enabled:m.data.filter(x=>x.enabled).length,audit:audit.data});
   }
   assertCurrent();
   verifiedIds=new Set(views.map(v=>v.company.id));
   status.textContent=views.length+' owned company workspace(s) verified by signed-in identity.';
   for(const view of views){
    const c=view.company,item=node('article');item.dataset.owner490Company=c.id;
    item.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
    item.append(node('h4',c.name),node('p','Company owner — application-wide administrator privileges are not required.'),
      node('p','Enabled services: '+view.enabled+' of 7'));
    const timeline=node('details');timeline.dataset.owner492Timeline=c.id;
    timeline.appendChild(node('summary','Service-switch audit timeline (read-only)'));
    const filters=node('div');filters.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0';
    const service=node('select');service.setAttribute('aria-label','Filter service audit by service');
    service.appendChild(new Option('All services',''));
    for(const key of serviceKeys)service.appendChild(new Option(key.replaceAll('_',' '),key));
    const action=node('select');action.setAttribute('aria-label','Filter service audit by action');
    action.appendChild(new Option('All actions',''));
    for(const key of actions)action.appendChild(new Option(key,key));
    const since=node('input');since.type='date';since.setAttribute('aria-label','Audit events on or after UTC date');
    const filter=node('button','Filter audit');filter.type='button';
    const filterStatus=node('p','Latest 25 events shown. Filters query the server audit directly.');
    filterStatus.setAttribute('role','status');
    filters.append(service,action,since,filter);
    const events=node('ol');
    for(const entry of view.audit.slice(0,25))events.appendChild(node('li',describeAudit(entry)));
    if(!view.audit.length)events.appendChild(node('li','No recorded switch events.'));
    if(view.audit.length===26)events.appendChild(node('li','Older events remain in the server audit; this timeline is limited.'));
    timeline.append(filters,filterStatus,events);item.appendChild(timeline);
    let filterEpoch=0;
    filter.addEventListener('click',async()=>{
      const filterRequest=++filterEpoch;
      filter.disabled=true;filterStatus.textContent='Querying owned-company audit…';
      try{
        assertCurrent();
        if(!verifiedIds.has(c.id))throw Error('Company ownership was not verified');
        const key=service.value,kind=action.value,date=since.value;
        if((key&&!serviceKeys.has(key))||(kind&&!actions.has(kind))||
           (date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw Error('Invalid filter');
        let query=sb.from('ywi_company_service_module_audit')
         .select('id,company_id,module_key,action,previous_enabled,next_enabled,recorded_at')
         .eq('company_id',c.id);
        if(key)query=query.eq('module_key',key);
        if(kind)query=query.eq('action',kind);
        if(date)query=query.gte('recorded_at',date+'T00:00:00.000Z');
        const found=await query.order('id',{ascending:false}).limit(101);
        assertCurrent();
        if(filterRequest!==filterEpoch||!verifiedIds.has(c.id))return;
        if(found.error||!Array.isArray(found.data)||found.data.some(a=>
          !validAudit(a,c.id)||(key&&a.module_key!==key)||(kind&&a.action!==kind)||
          (date&&a.recorded_at<date+'T00:00:00.000Z')))
          throw Error('Filtered audit unavailable or foreign');
        const fragment=document.createDocumentFragment();
        for(const entry of found.data.slice(0,100))fragment.appendChild(node('li',describeAudit(entry)));
        if(!found.data.length)fragment.appendChild(node('li','No audit events match these filters.'));
        events.replaceChildren(fragment);
        filterStatus.textContent=found.data.length>100?'Showing 100 events; narrow filters for older history.':
         'Showing '+found.data.length+' matching audited event(s), newest first.';
      }catch(e){if(epoch===generation&&filterRequest===filterEpoch){
        events.replaceChildren();filterStatus.textContent='WITHHELD: '+(e?.message||'Audit filter failed');
      }}finally{if(epoch===generation&&filterRequest===filterEpoch)filter.disabled=false;}
    });
    const open=node('button','Manage this company’s services');open.type='button';
    open.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)){
       status.textContent='WITHHELD: Company owner session changed. Load again.';return;
      }
      const registry=$('owner420'),refreshRegistry=$('owner420Refresh');
      if(!registry||!refreshRegistry){status.textContent='WITHHELD: Company service controls unavailable';return;}
      pendingFocus={companyId:c.id,ownerId:uid};
      registry.open=true;registry.scrollIntoView?.({behavior:'smooth',block:'start'});
      refreshRegistry.click();
    });
    item.appendChild(open);list.appendChild(item);
   }
  }catch(err){if(epoch===generation){verifiedIds=new Set();list.replaceChildren();status.textContent='WITHHELD: '+(err?.message||'Unverified identity');}}
  finally{if(epoch===generation)load.disabled=false;}
 }
 load.addEventListener('click',refresh);
 document.addEventListener('ywi:company-registry-loaded-491',event=>{
  const focus=pendingFocus;if(!focus)return;
  pendingFocus=null;
  if(!currentIdentity(focus.ownerId)||!verifiedIds.has(focus.companyId)||
     event.detail?.ownerUserId!==focus.ownerId||!event.detail?.companyIds?.includes(focus.companyId)){
   status.textContent='WITHHELD: Could not confirm selected company in service registry.';return;
  }
  const target=[...document.querySelectorAll('[data-owner420-company]')]
   .find(x=>x.dataset.owner420Company===focus.companyId);
  if(!target){status.textContent='WITHHELD: Selected company controls missing.';return;}
  target.scrollIntoView?.({behavior:'smooth',block:'start'});
  status.textContent='Verified service controls opened for selected company.';
 });
 document.addEventListener('ywi:company-service-offering-changed',event=>{
  if(verifiedIds.has(event.detail?.company_id)&&load.disabled===false)void refresh();
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;verifiedIds=new Set();pendingFocus=null;load.disabled=false;
  list.replaceChildren();status.textContent='Session changed. Load the company workspace again.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
