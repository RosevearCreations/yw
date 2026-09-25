/* Build 349 — Saved Views, Search & Command Centre */
'use strict';
(function(){
  const STORAGE_PREFIX='ywi_saved_command_views_v1:';
  const BUILT_INS=Object.freeze([
    {key:'my_crew_today',label:'My Crew Today',hint:'Crew and dispatch context for today.'},
    {key:'my_route',label:'My Route',hint:'Route and dispatch context assigned to me.'},
    {key:'snow_route',label:'Snow Route / Storm Event',hint:'Winter routes and storm-event work.'},
    {key:'fall_cleanup',label:'Fall Cleanup Queue',hint:'Fall cleanup and leaf-collection work.'},
    {key:'jobs_behind',label:'Jobs Behind Schedule',hint:'Open jobs with a past due/scheduled date.'},
    {key:'equipment_locked',label:'Equipment Locked Out',hint:'Equipment currently unavailable or locked out.'},
    {key:'maintenance_due',label:'Maintenance Due',hint:'Due, due-soon, or overdue maintenance.'},
    {key:'safety_due',label:'Safety Actions Due',hint:'Open supervisor safety actions requiring review.'},
    {key:'training_expiring',label:'Training Expiring',hint:'Training/certification nearing expiry or not ready.'},
    {key:'completed_not_invoiced',label:'Completed Not Invoiced',hint:'Completed jobs without invoice evidence in this read model.'},
    {key:'overdue_receivables',label:'Overdue Receivables',hint:'Outstanding receivables beyond their due date.'},
    {key:'finance_exceptions',label:'Finance Exceptions',hint:'Manual-review reconciliation/payment exceptions.'},
    {key:'assigned_to_me',label:'Assigned to Me',hint:'Visible records that reference my profile.'}
  ]);
  const SOURCE_DEFS=Object.freeze([
    ['command_customers','customer','Customers',['client_name','legal_name','display_name','full_name'],['client_id','id']],
    ['command_properties','property','Properties',['site_name','service_address','property_name'],['client_site_id','site_id','id']],
    ['command_jobs','job','Jobs',['job_code','job_name','name'],['job_id','id']],
    ['command_employees','employee','Employees',['full_name','display_name','email'],['profile_id','id']],
    ['command_equipment','equipment','Equipment',['equipment_code','equipment_name','name'],['equipment_item_id','id']],
    ['command_routes','route','Routes',['route_name','route_code','name'],['route_id','id']],
    ['command_schedule','schedule','Crew / Dispatch',['job_name','route_name','site_name','crew_name'],['dispatch_schedule_item_id','id']],
    ['command_seasonal_work','seasonal','Seasonal Work',['work_label','service_name','site_name','title'],['id','work_id']],
    ['command_storms','storm','Storm Events',['event_name','storm_event_key','name'],['id','storm_event_id']],
    ['command_maintenance','maintenance','Maintenance',['equipment_name','plan_name','equipment_code'],['id','plan_id','equipment_item_id']],
    ['command_safety','safety','Safety Actions',['action_title','title','submission_type','site_name'],['id','submission_id']],
    ['command_training','training','Training',['requirement_name','full_name','equipment_name'],['id','profile_id','requirement_code']],
    ['command_receivables','invoice','Invoices / Receivables',['invoice_number','customer_name','client_name'],['invoice_id','id']],
    ['command_payments','payment','Payments',['payment_reference','invoice_number','customer_name'],['payment_id','id']],
    ['command_finance_exceptions','finance_exception','Finance Exceptions',['exception_type','description','reference_number'],['id','reconciliation_id']]
  ]);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const $=(id)=>document.getElementById(id);
  const auth=()=>window.YWI_AUTH?.getState?.()||{};
  const ownerKey=()=>String(auth().profile?.id||auth().profile_id||auth().user?.id||auth().session?.user?.id||'anonymous');
  const storageKey=()=>STORAGE_PREFIX+ownerKey();
  const first=(row,keys)=>{for(const k of keys){const v=row?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v)}return''};
  const valuesText=(row)=>Object.values(row||{}).filter(v=>['string','number','boolean'].includes(typeof v)).join(' ').toLowerCase();
  const asDate=(row,keys)=>{const raw=first(row,keys);if(!raw)return null;const d=new Date(raw);return Number.isNaN(d.getTime())?null:d};
  const today=()=>{const d=new Date();d.setHours(23,59,59,999);return d};
  const soon=()=>new Date(Date.now()+60*24*60*60*1000);
  function loadSaved(){try{const v=JSON.parse(localStorage.getItem(storageKey())||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function saveSaved(rows){try{localStorage.setItem(storageKey(),JSON.stringify(rows.slice(0,20)))}catch{}}
  function host(){
    const admin=$('admin');if(!admin)return null;
    let el=$('savedSearch349');if(el)return el;
    el=document.createElement('details');el.id='savedSearch349';el.className='admin-hub-detail';el.dataset.adminHubTitle='Saved Views, Search & Command Centre';el.dataset.adminHubGroups='operations';el.open=true;
    el.innerHTML=[
      '<summary><span>Saved Views, Search &amp; Command Centre</span><small>Build 349 · permission-aware read/navigation layer</small></summary>',
      '<div class="admin-panel-block" data-build="349">',
      '<div class="section-heading"><div><span class="module-kicker">Build 349 · Business &amp; Operations</span><h3>Saved Views, Search &amp; Command Centre</h3><p class="section-subtitle">Find visible customers, properties, jobs, invoices/payments, employees, equipment and workspaces; keep season/service context; save browser-local views without changing business records.</p></div><button id="command349Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> search, filtering, navigation and saved views are read-only. A saved view is a browser preference scoped to the signed-in profile; it cannot schedule work, change a route, unlock equipment, approve Safety, post Finance, invoice a job, or alter source records.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Four-season Ontario context:</strong> Spring / summer, Fall and Winter are first-class filters. Snow routes / storm events remain distinct from fall cleanup and warm-weather services.</div>',
      '<div class="grid" style="margin-top:12px;">',
      '<label>Search<input id="command349Query" type="search" placeholder="Customer, property, job, invoice, employee, equipment…"></label>',
      '<label>Domain<select id="command349Domain"><option value="">All visible domains</option></select></label>',
      '<label>Season<select id="command349Season"><option value="">All seasons</option><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option><option value="four_season">Four season</option></select></label>',
      '<label>Service context<input id="command349Service" type="search" placeholder="mowing, snow, cleanup…"></label>',
      '</div>',
      '<div class="grid" style="margin-top:12px;"><div class="admin-panel-block"><h4>Operational views</h4><div id="command349BuiltIns" class="command349-chips"></div></div><div class="admin-panel-block"><h4>My saved views</h4><div class="grid"><label>Name<input id="command349SaveName" type="text" maxlength="60" placeholder="Monday snow review"></label><button id="command349Save" class="secondary" type="button">Save Current View</button></div><div id="command349Saved"></div></div></div>',
      '<div class="admin-panel-block" style="margin-top:12px;"><div class="section-heading"><div><h4>Command results</h4><p id="command349Context" class="section-subtitle"></p></div><button id="command349Clear" class="secondary" type="button">Clear View</button></div><div id="command349Results"></div></div>',
      '<div id="command349Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    admin.appendChild(el);
    const style=document.createElement('style');style.id='command349Style';style.textContent='.command349-chips{display:flex;flex-wrap:wrap;gap:8px}.command349-chip{min-height:40px}.command349-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin:7px 0}.command349-result small{overflow-wrap:anywhere}@media(max-width:700px){.command349-result{grid-template-columns:1fr}.command349-result button{width:100%;min-height:44px}}';document.head.appendChild(style);
    return el;
  }
  function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={payload:{},records:[],activeView:'',saved:loadSaved()};
    const note=(t,bad=false)=>{const n=$('command349Status');if(n){n.textContent=t;n.classList.toggle('error',bad)}};
    function flatten(){
      const visibility=state.payload.source_visibility||{};
      const records=[];
      for(const [key,domain,label,labelKeys,idKeys] of SOURCE_DEFS){
        if(visibility[domain]===false)continue;
        const rows=Array.isArray(state.payload[key])?state.payload[key]:[];
        for(const row of rows){
          const title=first(row,labelKeys)||label;
          records.push({domain,label,title,id:first(row,idKeys),row,text:valuesText(row)});
        }
      }
      state.records=records;
    }
    function assigned(rec){
      const id=ownerKey();const name=String(auth().profile?.full_name||auth().user?.email||'').toLowerCase();
      return (id&&id!=='anonymous'&&rec.text.includes(id.toLowerCase()))||(name&&rec.text.includes(name));
    }
    function matchesBuiltIn(rec,key){
      const r=rec.row,t=rec.text,end=today(),exp=soon(),status=String(r.status||r.job_status||r.due_status||r.readiness_status||'').toLowerCase();
      if(!key)return true;
      if(key==='assigned_to_me')return assigned(rec);
      if(key==='my_crew_today'){const d=asDate(r,['scheduled_start','service_date','work_date','date']);return rec.domain==='employee'||(rec.domain==='schedule'&&d&&d.toDateString()===new Date().toDateString())}
      if(key==='my_route')return (rec.domain==='route'||rec.domain==='schedule')&&(assigned(rec)||rec.domain==='route');
      if(key==='snow_route')return ['route','schedule','storm','seasonal'].includes(rec.domain)&&/(winter|snow|storm|plow|ice)/.test(t);
      if(key==='fall_cleanup')return ['schedule','seasonal','job','route'].includes(rec.domain)&&/(fall|leaf|cleanup)/.test(t);
      if(key==='jobs_behind'){const d=asDate(r,['due_date','scheduled_end','scheduled_start','end_date']);return rec.domain==='job'&&!/(complete|closed|cancel)/.test(status)&&!!d&&d<end}
      if(key==='equipment_locked')return rec.domain==='equipment'&&(r.is_locked_out===true||/(locked|out.of.service|unavailable)/.test(t));
      if(key==='maintenance_due')return rec.domain==='maintenance'&&/(overdue|due_soon|due|open)/.test(status+' '+t);
      if(key==='safety_due')return rec.domain==='safety'&&!/(closed|complete|resolved)/.test(status);
      if(key==='training_expiring'){const d=asDate(r,['expires_at','expiry_date','assignment_due_date']);return rec.domain==='training'&&(!/(ready|current|complete)/.test(status)||!!(d&&d<exp))}
      if(key==='completed_not_invoiced')return rec.domain==='job'&&/(complete|closed)/.test(status)&&!first(r,['invoice_id','invoice_number']);
      if(key==='overdue_receivables'){const d=asDate(r,['due_date']);return rec.domain==='invoice'&&Number(r.balance_due||r.outstanding_balance||0)>0&&!!d&&d<end}
      if(key==='finance_exceptions')return rec.domain==='finance_exception';
      return true;
    }
    function visible(){
      const q=String($('command349Query')?.value||'').trim().toLowerCase();
      const domain=$('command349Domain')?.value||'',season=$('command349Season')?.value||'',service=String($('command349Service')?.value||'').trim().toLowerCase();
      return state.records.filter(rec=>{
        if(domain&&rec.domain!==domain)return false;
        if(q&&!rec.text.includes(q)&&!rec.title.toLowerCase().includes(q))return false;
        if(season&&!rec.text.includes(season)&&!(season==='spring_summer'&&/(spring|summer)/.test(rec.text)))return false;
        if(service&&!rec.text.includes(service))return false;
        return matchesBuiltIn(rec,state.activeView);
      }).slice(0,120);
    }
    function openDomain(domain){
      const map={job:'jobs',equipment:'jobs',maintenance:'jobs',route:'jobs',schedule:'jobs',seasonal:'jobs',storm:'jobs',invoice:'finance',payment:'finance',finance_exception:'finance',safety:'admin',training:'admin',employee:'admin',customer:'admin',property:'admin'};
      const target=map[domain]||'admin';window.YWIRouter?.showSection?.(target);
      if(target==='admin'){const group=['customer','property','job','equipment','maintenance','route','schedule','seasonal','storm'].includes(domain)?'operations':(['employee'].includes(domain)?'people':(['safety','training'].includes(domain)?'safety':'home'));setTimeout(()=>window.YWIAdminHub?.open?.(group),0)}
    }
    function renderSaved(){
      $('command349Saved').innerHTML=state.saved.length?state.saved.map((v,i)=>'<div class="notice command349-result"><span><strong>'+esc(v.name)+'</strong><br><small>'+esc((BUILT_INS.find(x=>x.key===v.activeView)?.label||'Custom search')+' · '+(v.season||'all seasons')+' · '+(v.service||'all services'))+'</small></span><span><button class="secondary" data-command349-saved="'+i+'" type="button">Apply</button> <button class="secondary" data-command349-delete="'+i+'" type="button">Delete</button></span></div>').join(''):'<p class="muted">No browser-local saved views yet.</p>';
    }
    function render(){
      const rows=visible(),active=BUILT_INS.find(x=>x.key===state.activeView);
      $('command349BuiltIns').innerHTML=BUILT_INS.map(v=>'<button type="button" class="secondary command349-chip" data-command349-view="'+esc(v.key)+'" aria-pressed="'+(state.activeView===v.key?'true':'false')+'" title="'+esc(v.hint)+'">'+esc(v.label)+'</button>').join('');
      const domains=[...new Map(state.records.map(r=>[r.domain,r.label])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
      const select=$('command349Domain'),current=select.value;select.innerHTML='<option value="">All visible domains</option>'+domains.map(([k,l])=>'<option value="'+esc(k)+'">'+esc(l)+'</option>').join('');if(domains.some(([k])=>k===current))select.value=current;
      $('command349Context').textContent=(active?active.label:'Global search')+' · '+rows.length+' shown / '+state.records.length+' visible records';
      $('command349Results').innerHTML=rows.length?rows.map(rec=>'<article class="notice command349-result" data-command349-domain="'+esc(rec.domain)+'"><span><strong>'+esc(rec.title)+'</strong> · '+esc(rec.label)+'<br><small>'+esc(rec.id||'No reference')+'</small></span><button class="secondary" type="button" data-command349-open="'+esc(rec.domain)+'">Open workspace</button></article>').join(''):'<p class="muted">No visible records match this search/view and permission set.</p>';
      renderSaved();
    }
    async function refresh(){
      try{note('Loading permission-aware command-centre index…');const r=await api.loadAdminDirectory({scope:'saved_views_search',limit:300})||{};if(r.ok===false)throw new Error(r.error||'Command-centre load failed.');state.payload=r;flatten();render();note('Build 349 command-centre index refreshed. Business records were not changed.')}
      catch(e){state.payload={};state.records=[];render();note('Unable to load Build 349 command centre: '+(e?.message||e),true)}
    }
    function applySaved(v){state.activeView=v.activeView||'';$('command349Query').value=v.query||'';$('command349Domain').value=v.domain||'';$('command349Season').value=v.season||'';$('command349Service').value=v.service||'';render()}
    el.addEventListener('click',e=>{
      const view=e.target.closest('[data-command349-view]');if(view){state.activeView=view.getAttribute('data-command349-view')||'';render();return}
      const open=e.target.closest('[data-command349-open]');if(open){openDomain(open.getAttribute('data-command349-open'));return}
      const saved=e.target.closest('[data-command349-saved]');if(saved){applySaved(state.saved[Number(saved.getAttribute('data-command349-saved'))]||{});return}
      const del=e.target.closest('[data-command349-delete]');if(del){state.saved.splice(Number(del.getAttribute('data-command349-delete')),1);saveSaved(state.saved);renderSaved()}
    });
    for(const id of ['command349Query','command349Service'])$(id).addEventListener('input',render);
    for(const id of ['command349Domain','command349Season'])$(id).addEventListener('change',render);
    $('command349Clear').onclick=()=>{state.activeView='';$('command349Query').value='';$('command349Domain').value='';$('command349Season').value='';$('command349Service').value='';render()};
    $('command349Save').onclick=()=>{const name=$('command349SaveName').value.trim();if(!name)return note('Name the saved view first.',true);state.saved.unshift({name:name.slice(0,60),activeView:state.activeView,query:$('command349Query').value.trim(),domain:$('command349Domain').value,season:$('command349Season').value,service:$('command349Service').value.trim(),saved_at:new Date().toISOString()});saveSaved(state.saved);$('command349SaveName').value='';renderSaved();note('Saved this view locally for the current signed-in profile.')};
    $('command349Refresh').onclick=refresh;
    refresh();
  }
  window.YWISavedViewsSearchCommandUI={mount,BUILT_INS};
})();