/* Build 490/491. Company ownership is server-side and every read remains
   subject to Supabase RLS. Build 491 invalidates in-flight reads on logout. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const node=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
const serviceKeys=new Set(['landscape','construction','water_parks','snow_removal',
 'snow_plowing','septic','arboriculture']);
const actions=new Set(['initialized','enabled','disabled']);
/* Only view controls are persisted on this device. The authenticated owner and
   RLS-backed company reads remain the authority on every visit. */
const presetKey=(uid,companyId)=>'yw:owner-audit-filters:v496:'+encodeURIComponent(uid)+':'+encodeURIComponent(companyId);
const recoveryKey=(uid,companyId)=>'yw:audit-filter-recovery:v497:'+encodeURIComponent(uid)+':'+encodeURIComponent(companyId);
const validUtcDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
const validPreset=p=>p&&typeof p==='object'&&
 Object.keys(p).sort().join(',')==='action,service,since'&&
 ['service','action','since'].every(k=>typeof p[k]==='string')&&
 (!p.service||serviceKeys.has(p.service))&&(!p.action||actions.has(p.action))&&
 (!p.since||validUtcDate(p.since));
const parsePreset=raw=>{if(!raw)return null;
 try{const value=JSON.parse(raw);return validPreset(value)?{
  service:value.service,action:value.action,since:value.since}:null;}catch{return null;}};
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
 // BUILD 498 verified recovered audit view remains mandatory for BUILD 499 receipt review.
 hero.append(node('span','OWNER OPERATIONS  /  BUILD 500'),node('h3','My Company Workspace'),
  node('p','Service-switch decisions, exact audit summaries, verified receipt change review and company controls. Receipt counts are advisory, not event-level proof or authorization.'));
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
    const presetStatus=node('p','Saved filters stay on this device and are isolated by signed-in owner and company. No audit records or credentials are saved.');
    presetStatus.className='yw495-help';presetStatus.setAttribute('role','status');
    const presetOptions=[['All activity','all'],['Enables only','enabled'],
     ['Disables only','disabled'],['Last 7 days','week']];
    let savedPreset=null,recoveryPreset=null,damagedPreset=false;
    let recoveredViewPending=null,verifyArmed=false;
    const viewStatus=node('p','Recovered view verification is available after a valid saved-filter recovery.');
    viewStatus.className='yw498-verify-state';viewStatus.dataset.owner498Verification=c.id;
    viewStatus.setAttribute('role','status');viewStatus.setAttribute('aria-live','polite');
    const receiptButton=node('button','Review recovered audit receipt');receiptButton.type='button';
    receiptButton.dataset.owner499ReceiptReview=c.id;receiptButton.disabled=true;
    const receiptStatus=node('p','No verified recovered audit receipt in this session.');
    receiptStatus.className='yw498-verify-state';receiptStatus.dataset.owner499ReceiptStatus=c.id;
    receiptStatus.setAttribute('aria-live','polite');
    const receiptDetails=node('p');receiptDetails.dataset.owner499ReceiptDetails=c.id;
    receiptDetails.className='yw499-receipt-detail';receiptDetails.hidden=true;
    const compareButton=node('button','Compare reviewed audit receipts');compareButton.type='button';
    compareButton.dataset.owner500ReceiptCompare=c.id;compareButton.disabled=true;
    const compareStatus=node('p','Review two separately verified receipts to inspect a count change.');
    compareStatus.className='yw500-compare-state';compareStatus.dataset.owner500CompareStatus=c.id;
    compareStatus.setAttribute('aria-live','polite');
    const compareDetails=node('p');compareDetails.className='yw500-compare-detail';
    compareDetails.dataset.owner500CompareDetails=c.id;compareDetails.hidden=true;
    let verifiedReceipt=null,lastReviewedReceipt=null,comparisonBaseline=null,receiptSequence=0;
    const clearReceipt=message=>{verifiedReceipt=null;receiptButton.disabled=true;
      receiptDetails.hidden=true;receiptDetails.textContent='';
      comparisonBaseline=null;compareButton.disabled=true;compareDetails.hidden=true;
      compareDetails.textContent='';compareStatus.textContent='Previous review retained only in this session. Verify and review a new receipt to compare.';
      receiptStatus.textContent=message||'No verified recovered audit receipt in this session.';};
    const describeSelection=p=>'Service '+(p.service||'all')+' · action '+(p.action||'all')+
      ' · since '+(p.since||'any UTC date');
    const key=presetKey(uid,c.id),backupKey=recoveryKey(uid,c.id);
    try{
      const raw=localStorage.getItem(key),backup=localStorage.getItem(backupKey);
      savedPreset=parsePreset(raw);recoveryPreset=parsePreset(backup);
      damagedPreset=!!raw&&!savedPreset||!!backup&&!recoveryPreset;
    }catch{ /* Private browsing or disabled storage remains session-only. */ }
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
    restorePreset.dataset.owner495Preset='restore';restorePreset.disabled=!savedPreset;
    const recoverPreset=node('button','Recover saved filters');recoverPreset.type='button';
    recoverPreset.dataset.owner497Preset='recover';recoverPreset.disabled=!!savedPreset||!recoveryPreset;
    const clearPreset=node('button','Clear saved filters');clearPreset.type='button';
    clearPreset.dataset.owner496Preset='clear';clearPreset.disabled=!savedPreset&&!recoveryPreset&&!damagedPreset;
    if(savedPreset)presetStatus.textContent='Saved review filters available on this device for '+c.name+'. Apply them when ready.';
    else if(recoveryPreset)presetStatus.textContent='RECOVERY AVAILABLE: A valid earlier filter snapshot was found for '+c.name+'. Review it before applying. No audit data is stored.';
    else if(damagedPreset)presetStatus.textContent='Saved filter data is damaged or unsupported. Clear it to start fresh; nothing was applied.';
    savePreset.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)){
        presetStatus.textContent='WITHHELD: Owner session changed; reload to save filters.';return;
      }
      const candidate={service:service.value,action:action.value,since:since.value};
      if(!validPreset(candidate)){
        presetStatus.textContent='WITHHELD: Invalid review filter selection.';return;
      }
      savedPreset=candidate;
      recoveredViewPending=null;verifyArmed=false;
      viewStatus.textContent='Saved new filters. No recovered view awaits verification.';
      clearReceipt('New filters saved; any earlier recovered receipt is no longer current.');
      restorePreset.disabled=false;recoverPreset.disabled=true;
      clearPreset.disabled=false;
      try{
        const previous=parsePreset(localStorage.getItem(key));
        localStorage.setItem(backupKey,JSON.stringify(previous||candidate));
        localStorage.setItem(key,JSON.stringify(candidate));
        recoveryPreset=previous||candidate;damagedPreset=false;
        presetStatus.textContent='Filters saved on this device. One prior valid filter snapshot is available for recovery. No audit records stored.';
      }catch{presetStatus.textContent='Device storage unavailable. Filters saved in this session only.';}
    });
    restorePreset.addEventListener('click',()=>{
      if(savedPreset){verifyArmed=!!recoveredViewPending;
        if(verifyArmed)viewStatus.textContent='VERIFYING RECOVERED VIEW · '+describeSelection(recoveredViewPending)+
          ' · awaiting the verified owner-scoped server audit.';
        applyPreset(savedPreset,'Saved filters');}
    });
    recoverPreset.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)||!validPreset(recoveryPreset)){
        presetStatus.textContent='WITHHELD: Verified owner, company and valid recovery snapshot required.';return;
      }
      savedPreset={...recoveryPreset};restorePreset.disabled=false;
      recoverPreset.disabled=true;clearPreset.disabled=false;
      recoveredViewPending={...savedPreset};verifyArmed=false;
      clearReceipt('Recovered filters are not verified until the owner-scoped server read succeeds.');
      viewStatus.textContent='RECOVERED VIEW READY · '+describeSelection(recoveredViewPending)+
        '. No audit query was made. Choose Apply saved filters to verify against the server.';
      try{localStorage.setItem(key,JSON.stringify(savedPreset));
        presetStatus.textContent='Recovered earlier filters for '+c.name+'. They were not applied automatically; choose Apply saved filters.';
      }catch{presetStatus.textContent='Recovered filters for this session only; device storage unavailable.';}
    });
    clearPreset.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)){
        presetStatus.textContent='WITHHELD: Owner session changed; reload to clear filters.';return;
      }
      savedPreset=null;recoveryPreset=null;damagedPreset=false;
      recoveredViewPending=null;verifyArmed=false;
      viewStatus.textContent='Recovered view verification cleared. No audit records stored.';
      clearReceipt('Recovered audit receipt cleared from this session. No audit records stored.');
      lastReviewedReceipt=null;comparisonBaseline=null;
      compareStatus.textContent='All session-only receipt comparisons cleared.';
      restorePreset.disabled=true;recoverPreset.disabled=true;clearPreset.disabled=true;
      try{localStorage.removeItem(key);localStorage.removeItem(backupKey);
        presetStatus.textContent='Saved review filters cleared from this device for '+c.name+'.';
      }catch{presetStatus.textContent='Saved session filters cleared. Device storage could not be accessed.';}
    });
    presets.append(savePreset,restorePreset,recoverPreset,clearPreset);
    receiptButton.addEventListener('click',()=>{
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)||!verifiedReceipt||
         verifiedReceipt.ownerId!==uid||verifiedReceipt.companyId!==c.id){
        clearReceipt('WITHHELD: Verified owner, company and current session receipt required.');return;
      }
      const r=verifiedReceipt;
      receiptDetails.textContent='VERIFIED RECEIPT REVIEW · '+c.name+' · '+
        describeSelection(r.selection)+' · '+(r.truncated?'More than 100 matches (first 100 shown)':
          r.count+' returned matching event(s)')+' · device review time '+r.checkedAt+
        '. Read-only server response at verification time; no audit rows, IDs or credentials stored.';
      receiptDetails.hidden=false;
      receiptStatus.textContent='SESSION RECEIPT REVIEWED · advisory readback only; not a live count or owner sign-off.';
      if(lastReviewedReceipt&&lastReviewedReceipt.token!==r.token){
        comparisonBaseline=lastReviewedReceipt;compareButton.disabled=false;
        compareStatus.textContent='TWO REVIEWED RECEIPTS READY · compare counts and filter scope; no audit rows retained.';
      }
      lastReviewedReceipt=r;
    });
    compareButton.addEventListener('click',()=>{
      const prior=comparisonBaseline,current=verifiedReceipt;
      if(!currentIdentity(uid)||!verifiedIds.has(c.id)||!prior||!current||
         lastReviewedReceipt?.token!==current.token||prior.token===current.token||
         prior.ownerId!==uid||current.ownerId!==uid||
         prior.companyId!==c.id||current.companyId!==c.id){
        clearReceipt('WITHHELD: Two reviewed, current owner-scoped receipts are required.');return;
      }
      const identical=prior.selection.service===current.selection.service&&
        prior.selection.action===current.selection.action&&prior.selection.since===current.selection.since;
      const delta=current.count-prior.count;
      compareDetails.textContent=identical?
        'RECEIPT COUNT CHANGE REVIEW · '+(prior.truncated||current.truncated?
          'COUNT INDETERMINATE: At least one read exceeded 100 server events.':
          (delta===0?'COUNT UNCHANGED':delta>0?'COUNT INCREASE +'+delta:'COUNT DECREASE '+delta)+
          ' · prior '+prior.count+' · current '+current.count)+
          ' · '+describeSelection(current.selection)+'. Counts alone cannot establish event identity or owner acceptance.':
        'NOT COMPARABLE: Reviewed receipt filters differ. Previous '+describeSelection(prior.selection)+
          ' versus current '+describeSelection(current.selection)+'. No count delta inferred.';
      compareDetails.hidden=false;
      compareStatus.textContent='LOCAL COMPARISON REVIEWED · read-only session evidence, never approval or a persisted audit record.';
    });
    const events=node('ol');
    for(const entry of view.audit.slice(0,25))events.appendChild(node('li',describeAudit(entry)));
    if(!view.audit.length)events.appendChild(node('li','No recorded switch events.'));
    if(view.audit.length===26)events.appendChild(node('li','Older events remain in the server audit; this timeline is limited.'));
    timeline.className='yw494-review-details';
    timeline.append(presets,presetStatus,viewStatus,receiptButton,receiptStatus,receiptDetails,
      compareButton,compareStatus,compareDetails,
      filters,filterStatus,events);item.appendChild(timeline);
    let filterEpoch=0;
    filter.addEventListener('click',async()=>{
      const filterRequest=++filterEpoch;
      if(verifiedReceipt)clearReceipt('Audit filters queried again; previous receipt withdrawn until a new recovered-view verification.');
      filter.disabled=true;filterStatus.textContent='Querying owned-company audit…';
      try{
        assertCurrent();
        if(!verifiedIds.has(c.id))throw Error('Company ownership was not verified');
        const key=service.value,kind=action.value,date=since.value;
        if((key&&!serviceKeys.has(key))||(kind&&!actions.has(kind))||
           (date&&!validUtcDate(date)))throw Error('Invalid filter');
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
        if(verifyArmed&&recoveredViewPending){
          const same=key===recoveredViewPending.service&&kind===recoveredViewPending.action&&
            date===recoveredViewPending.since;
          viewStatus.textContent=same?'VERIFIED RECOVERED VIEW · '+c.name+' · '+
            describeSelection(recoveredViewPending)+' · '+(found.data.length>100?
             'first 100 of more than 100 matching server events':
             found.data.length+' matching server event(s)')+
            '. Read-only, owner-scoped response; no audit records stored.':
            'NOT VERIFIED: Current filters differ from recovered view. Choose Apply saved filters again.';
          if(same){verifiedReceipt={ownerId:uid,companyId:c.id,token:++receiptSequence,
            selection:{...recoveredViewPending},count:found.data.length,truncated:found.data.length>100,
            checkedAt:new Date().toISOString()};
            receiptButton.disabled=false;
            receiptStatus.textContent='VERIFIED RECEIPT READY · review the session-only summary before changing filters.';}
          verifyArmed=false;
        }
      }catch(e){if(epoch===generation&&filterRequest===filterEpoch){
        events.replaceChildren();filterStatus.textContent='WITHHELD: '+(e?.message||'Audit filter failed');
        if(verifyArmed){viewStatus.textContent='WITHHELD: Recovered view not verified by the server; retry Apply saved filters.';
          verifyArmed=false;}
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
