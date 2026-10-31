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
const metric=(label,value,tone='purple')=>{
 const card=node('div');card.className='yw494-kpi';card.dataset.tone=tone;
 const caption=node('span',label);caption.className='yw494-kpi-label';
 const number=node('strong',value);number.className='yw494-kpi-value';
 card.append(caption,number);return card;
};
function install(){
 const host=$('settings');if(!host||$('owner490'))return;
 const section=node('section');section.id='owner490';section.className='admin-panel-block yw494-command';
 const hero=node('div');hero.className='yw494-hero';
 hero.append(node('span','OWNER OPERATIONS  /  BUILD 495'),node('h3','My Company Workspace'),
  node('p','Service-switch decisions, exact audit summaries, reusable review presets and company controls. Ownership does not grant platform administrator privileges.'));
 const metrics=node('div');metrics.id='owner494Metrics';metrics.className='yw494-kpis';
 metrics.append(metric('Owned companies','—'),metric('Enabled services','—','blue'),metric('Recent events','—','green'));
 const load=node('button','Load my companies');load.type='button';load.id='owner490Load';
 const status=node('p','Sign in to verify company ownership.');status.id='owner490Status';status.setAttribute('role','status');
 const list=node('div');list.id='owner490List';list.style.cssText='display:grid;gap:10px;min-width:0';
 section.append(hero,metrics,load,status,list);
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
    views.push({company:c,enabled:m.data.filter(x=>x.enabled).length,modules:m.data,audit:audit.data});
   }
   assertCurrent();
   verifiedIds=new Set(views.map(v=>v.company.id));
   status.textContent=views.length+' owned company workspace(s) verified by signed-in identity.';
   metrics.replaceChildren(metric('Owned companies',views.length),
    metric('Enabled services',views.reduce((sum,v)=>sum+v.enabled,0)+' / '+(views.length*7),'blue'),
    metric('Recent audit events',views.reduce((sum,v)=>sum+Math.min(25,v.audit.length),0)+' shown','green'));
   for(const view of views){
    const c=view.company,item=node('article');item.dataset.owner490Company=c.id;
    item.className='yw494-review-card';
    item.append(node('h4',c.name),node('p','Company owner — application-wide administrator privileges are not required.'),
      node('p','Enabled services: '+view.enabled+' of 7'));
    const exact=node('details');exact.className='yw494-review-details';exact.dataset.owner494Summary=c.id;
    exact.appendChild(node('summary','Exact service-switch audit review (server counts)'));
    const exactButton=node('button','Load exact audit summary');exactButton.type='button';
    const exactStatus=node('p','Not loaded. Counts are read from the owner-scoped server audit, not the latest-event window.');
    exactStatus.setAttribute('role','status');
    const exactGrid=node('div');exactGrid.className='yw494-summary-grid';
    exact.append(exactButton,exactStatus,exactGrid);item.appendChild(exact);
    exactButton.addEventListener('click',async()=>{
      exactButton.disabled=true;exactStatus.textContent='Verifying company ownership and exact server counts…';
      exactGrid.replaceChildren();
      try{
        assertCurrent();
        if(!verifiedIds.has(c.id)||!sb.rpc)throw Error('Verified owner summary unavailable');
        const result=await sb.rpc('ywi_company_service_audit_summary_494',{p_company_id:c.id});
        assertCurrent();
        const rows=result.data,keys=new Set(),moduleState=new Map(view.modules.map(x=>[x.module_key,x.enabled]));
        if(result.error||!Array.isArray(rows)||rows.length!==7)throw Error('Incomplete owner service summary');
        for(const row of rows){
          if(!serviceKeys.has(row.module_key)||keys.has(row.module_key)||
             typeof row.enabled!=='boolean'||moduleState.get(row.module_key)!==row.enabled||
             !['initialized_events','enabled_events','disabled_events'].every(k=>
              row[k]!==null&&['number','string'].includes(typeof row[k])&&
              Number.isSafeInteger(Number(row[k]))&&Number(row[k])>=0)||
             (row.last_action!==null&&!actions.has(row.last_action))||
             (row.last_event_at!==null&&!Number.isFinite(Date.parse(row.last_event_at))))
            throw Error('Foreign or invalid exact audit summary');
          keys.add(row.module_key);
        }
        const table=node('table');table.className='yw494-data-table';
        const caption=node('caption','Exact audit totals by owned service (all recorded events)');
        const head=node('thead'),headRow=node('tr');
        for(const label of ['Service','State','Initialized','Enabled','Disabled','Last change'])headRow.appendChild(node('th',label));
        head.appendChild(headRow);const tbody=node('tbody');
        for(const row of rows){
          const tr=node('tr');
          for(const value of [row.module_key.replaceAll('_',' '),row.enabled?'ON':'OFF',
            row.initialized_events,row.enabled_events,row.disabled_events,
            row.last_event_at?new Date(row.last_event_at).toLocaleString():'Never'])tr.appendChild(node('td',value));
          tbody.appendChild(tr);
        }
        table.append(caption,head,tbody);exactGrid.appendChild(table);
        const total=rows.reduce((sum,r)=>sum+Number(r.initialized_events)+Number(r.enabled_events)+Number(r.disabled_events),0);
        exactStatus.textContent='VERIFIED OWNER SCOPE · '+total+' total audit events across 7 services. Read-only; no service state changed.';
      }catch(e){if(epoch===generation){exactGrid.replaceChildren();exactStatus.textContent='WITHHELD: '+(e?.message||'Summary unavailable');}}
      finally{if(epoch===generation)exactButton.disabled=false;}
    });
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
    const presets=node('div');presets.className='yw495-preset-bar';
    presets.setAttribute('role','group');presets.setAttribute('aria-label','Owner audit review presets');
    const presetStatus=node('p','Presets change only this company’s review filters. They do not change service switches.');
    presetStatus.className='yw495-help';presetStatus.setAttribute('role','status');
    const presetOptions=[['All activity','all'],['Enables only','enabled'],
     ['Disables only','disabled'],['Last 7 days','week']];
    let savedPreset=null;
    const applyPreset=(selection,label)=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)){
        presetStatus.textContent='WITHHELD: Owner session changed; reload the company workspace.';return;
      }
      service.value=selection.service;action.value=selection.action;since.value=selection.since;
      presetStatus.textContent=label+' selected for '+c.name+'. The server audit will enforce company ownership.';
      filter.click();
    };
    for(const [label,kind] of presetOptions){
      const button=node('button',label);button.type='button';button.dataset.owner495Preset=kind;
      button.addEventListener('click',()=>{
        let from='';if(kind==='week'){
          const d=new Date();d.setUTCDate(d.getUTCDate()-7);from=d.toISOString().slice(0,10);
        }
        applyPreset({service:'',action:kind==='enabled'||kind==='disabled'?kind:'',since:from},label);
      });
      presets.appendChild(button);
    }
    const savePreset=node('button','Save my current filters');savePreset.type='button';
    savePreset.dataset.owner495Preset='save';
    const restorePreset=node('button','Apply saved filters');restorePreset.type='button';
    restorePreset.dataset.owner495Preset='restore';restorePreset.disabled=true;
    savePreset.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)){
        presetStatus.textContent='WITHHELD: Owner session changed; reload to save filters.';return;
      }
      if((service.value&&!serviceKeys.has(service.value))||
         (action.value&&!actions.has(action.value))||
         (since.value&&!/^\d{4}-\d{2}-\d{2}$/.test(since.value))){
        presetStatus.textContent='WITHHELD: Invalid review filter selection.';return;
      }
      savedPreset={service:service.value,action:action.value,since:since.value};
      restorePreset.disabled=false;
      presetStatus.textContent='Custom filters saved for this company in this session only. No audit data was stored.';
    });
    restorePreset.addEventListener('click',()=>{
      if(savedPreset)applyPreset(savedPreset,'Saved filters');
    });
    presets.append(savePreset,restorePreset);
    const events=node('ol');
    for(const entry of view.audit.slice(0,25))events.appendChild(node('li',describeAudit(entry)));
    if(!view.audit.length)events.appendChild(node('li','No recorded switch events.'));
    if(view.audit.length===26)events.appendChild(node('li','Older events remain in the server audit; this timeline is limited.'));
    timeline.className='yw494-review-details';
    timeline.append(presets,presetStatus,filters,filterStatus,events);item.appendChild(timeline);
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
  }catch(err){if(epoch===generation){verifiedIds=new Set();list.replaceChildren();metrics.replaceChildren();status.textContent='WITHHELD: '+(err?.message||'Unverified identity');}}
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
  list.replaceChildren();metrics.replaceChildren();status.textContent='Session changed. Load the company workspace again.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
