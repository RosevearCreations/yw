/* Build 350 — Owner / Management Command Centre */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(num(v));
  const pct=v=>Number.isFinite(Number(v))?Number(v).toFixed(1)+'%':'—';
  const arr=(o,k)=>Array.isArray(o?.[k])?o[k]:[];
  const dateKey=v=>{if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const todayKey=()=>dateKey(new Date());
  const done=s=>/(complete|completed|done|closed|finished)/i.test(String(s||''));
  const open=s=>!/(complete|completed|done|closed|resolved|cancelled|canceled)/i.test(String(s||''));
  const text=row=>Object.values(row||{}).filter(v=>['string','number','boolean'].includes(typeof v)).join(' ').toLowerCase();
  function host(){
    const admin=$('admin');if(!admin)return null;
    let el=$('ownerCommand350');if(el)return el;
    el=document.createElement('details');el.id='ownerCommand350';el.className='admin-hub-detail';el.dataset.adminHubTitle='Owner / Management Command Centre';el.dataset.adminHubGroups='operations';el.open=true;
    el.innerHTML=[
      '<summary><span>Owner / Management Command Centre</span><small>Build 350 · four-season business cockpit</small></summary>',
      '<div class="admin-panel-block" data-build="350">',
      '<div class="section-heading"><div><span class="module-kicker">Build 350 · Management</span><h3>Owner / Management Command Centre</h3><p class="section-subtitle">One read-only view of today, production, profitability, workforce, seasonal execution, Safety, equipment and Finance readiness.</p></div><button id="owner350Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> this cockpit summarizes existing source workflows only. It cannot dispatch crews, alter routes, approve Safety, unlock equipment, edit training, post Finance, invoice work, collect payment or close accounting periods.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Four-season Ontario model:</strong> spring/summer landscaping, fall cleanup/leaf collection and winter snow/storm operations are first-class operating contexts. Missing module access is shown as unavailable rather than inferred.</div>',
      '<div id="owner350Status" class="notice" style="margin-top:10px;"></div>',
      '<div id="owner350Kpis" class="owner350-grid" style="margin-top:12px;"></div>',
      '<div class="grid" style="margin-top:14px;">',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Today &amp; schedule risk</h4><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div id="owner350Today"></div></section>',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Production &amp; labour</h4><button class="secondary" data-owner350-open="jobs">Open Production</button></div><div id="owner350Production"></div></section>',
      '</div>',
      '<div class="grid" style="margin-top:14px;">',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Profitability &amp; receivables</h4><button class="secondary" data-owner350-open="finance">Open Finance</button></div><div id="owner350Finance"></div></section>',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Recurring routes &amp; seasonal progress</h4><button class="secondary" data-owner350-open="operations">Open Operations</button></div><div id="owner350Seasonal"></div></section>',
      '</div>',
      '<div class="grid" style="margin-top:14px;">',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Safety, equipment &amp; workforce blockers</h4><button class="secondary" data-owner350-open="safety">Open Safety</button></div><div id="owner350Blockers"></div></section>',
        '<section class="admin-panel-block"><div class="owner350-head"><h4>Needs attention</h4><button class="secondary" data-owner350-open="operations">Open Command Centre</button></div><div id="owner350Attention"></div></section>',
      '</div>',
      '</div>'
    ].join('');
    admin.appendChild(el);
    if(!$('owner350Style')){const st=document.createElement('style');st.id='owner350Style';st.textContent='.owner350-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.owner350-kpi{padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(15,23,42,.46)}.owner350-kpi span{display:block;font-size:.76rem;color:#c4d1e2}.owner350-kpi strong{display:block;font-size:1.15rem;margin-top:4px}.owner350-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.owner350-list{display:grid;gap:7px}.owner350-row{padding:8px 10px;border-radius:9px;background:rgba(15,23,42,.45)}.owner350-row small{display:block;color:#c4d1e2;margin-top:2px}@media(max-width:700px){.owner350-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.owner350-head button{width:100%;min-height:44px}}';document.head.appendChild(st)}
    return el;
  }
  function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={data:{}};
    const note=(s,bad=false)=>{const n=$('owner350Status');if(n){n.textContent=s;n.classList.toggle('error',bad)}};
    const allowed=k=>state.data?.source_visibility?.[k]!==false;
    const card=(label,value,detail='')=>'<div class="owner350-kpi"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</div>';
    const rowsHtml=(rows,empty='No current items.')=>rows.length?'<div class="owner350-list">'+rows.map(r=>'<div class="owner350-row"><strong>'+esc(r.title)+'</strong><small>'+esc(r.detail||'')+'</small></div>').join('')+'</div>':'<p class="muted">'+esc(empty)+'</p>';
    function metrics(){
      const d=state.data,today=todayKey(),now=Date.now();
      const jobs=arr(d,'owner_jobs'),dispatch=arr(d,'owner_dispatch'),prod=arr(d,'owner_production'),profit=arr(d,'owner_profitability');
      const recurring=arr(d,'owner_recurring'),visits=arr(d,'owner_recurring_visits'),storms=arr(d,'owner_storms'),stormRoutes=arr(d,'owner_storm_routes'),seasonal=arr(d,'owner_seasonal_work');
      const safety=arr(d,'owner_safety'),equipment=arr(d,'owner_equipment'),maintenance=arr(d,'owner_maintenance'),training=arr(d,'owner_training_summary')[0]||{},workforce=arr(d,'owner_workforce_summary')[0]||{};
      const ar=arr(d,'owner_receivables'),bank=arr(d,'owner_bank'),finEx=arr(d,'owner_finance_exceptions'),close=arr(d,'owner_close_dashboard')[0]||{},time=arr(d,'owner_timekeeping_summary')[0]||{};
      const workability=arr(d,'owner_workability');
      const todayDispatch=dispatch.filter(r=>dateKey(r.scheduled_start||r.service_date||r.work_date)===today);
      const todayProd=prod.filter(r=>dateKey(r.session_date||r.started_at)===today);
      const crewNames=new Set(todayDispatch.map(r=>r.crew_name||r.assigned_crew_name).filter(Boolean));
      const completedToday=todayProd.filter(r=>done(r.production_state||r.completion_state||r.session_status)).length;
      const scheduledToday=todayDispatch.length||todayProd.length;
      const completionRate=scheduledToday?Math.min(100,(completedToday/scheduledToday)*100):0;
      const scheduleRisk=todayDispatch.filter(r=>{const start=new Date(r.scheduled_start||0).getTime();return start&&start<now&&open(r.schedule_status||r.status||r.dispatch_status)}).length+
        workability.filter(r=>open(r.decision_status||r.workability_status||r.queue_status)&&/(delay|stop|unsafe|review|hold|weather|ice|snow|rain|wind)/i.test(text(r))).length;
      const jobRows=profit.filter(r=>String(r.group_type||'').toLowerCase()==='job');
      const revenue=jobRows.reduce((s,r)=>s+num(r.actual_revenue_total||r.revenue_total),0),cost=jobRows.reduce((s,r)=>s+num(r.actual_cost_total||r.cost_total),0),gross=revenue-cost,margin=revenue?gross/revenue*100:0;
      const completedNotInvoiced=jobs.filter(r=>done(r.status||r.job_status)&&!String(r.invoice_number||r.invoice_id||'').trim()).length;
      const arOpen=ar.reduce((s,r)=>s+num(r.balance_due||r.outstanding_balance),0),arOverdue=ar.filter(r=>num(r.days_past_due)>0||/(overdue|past_due)/i.test(String(r.aging_bucket||r.status||''))).reduce((s,r)=>s+num(r.balance_due||r.outstanding_balance),0);
      const latestBank=[...bank].sort((a,b)=>new Date(b.period_end||0)-new Date(a.period_end||0))[0]||{},cash=num(latestBank.bank_balance??latestBank.book_balance);
      const recentPaidHours=num(time.recent_paid_minutes)/60;
      const cutoff=Date.now()-14*86400000;
      const prodLabour=prod.filter(r=>new Date(r.session_date||r.started_at||0).getTime()>=cutoff).reduce((s,r)=>s+num(r.total_labour_hours),0);
      const labourUtil=recentPaidHours?Math.min(100,prodLabour/recentPaidHours*100):0;
      const dueVisits=visits.filter(r=>new Date(r.service_date||0).getTime()<=Date.now()&&!/(cancel|skip)/i.test(String(r.visit_status||'')));
      const doneVisits=dueVisits.filter(r=>done(r.visit_status||r.latest_event_type)).length;
      const recurringRate=dueVisits.length?doneVisits/dueVisits.length*100:0;
      const winterActive=storms.filter(r=>open(r.event_status||r.status)&&/(winter|snow|storm|ice)/i.test(text(r))).length;
      const winterRoutes=stormRoutes.filter(r=>open(r.route_status||r.status)||/(active|ready|assigned)/i.test(text(r))).length;
      const fallRows=[...visits,...seasonal].filter(r=>/(fall|leaf|cleanup)/i.test(text(r)));
      const fallDone=fallRows.filter(r=>done(r.visit_status||r.work_status||r.status||r.latest_event_type)).length;
      const fallRate=fallRows.length?fallDone/fallRows.length*100:0;
      const locked=equipment.filter(r=>r.is_locked_out===true||/(locked|out.of.service|down)/i.test(String(r.status||r.operational_status||''))).length;
      const maintBlock=maintenance.filter(r=>/(overdue|due|due_soon)/i.test(String(r.due_status||r.task_status||''))).length;
      const trainingBlock=num(training.attention_count||training.expired_count)+num(training.internal_authorization_pending_count);
      const workforceBlock=num(workforce.training_attention_count)+num(workforce.authorization_attention_count)+num(workforce.availability_attention_count);
      const safetyBlock=safety.filter(r=>open(r.queue_status||r.status||r.action_status)).length;
      const financeReady=finEx.length===0&&num(close.open_bank_reconciliation_count)===0&&num(close.open_tax_filing_count)===0&&num(close.open_payroll_remittance_count)===0;
      return {jobs,dispatch,prod,recurring,visits,storms,stormRoutes,seasonal,safety,equipment,maintenance,training,workforce,ar,bank,finEx,close,time,
        crewCount:crewNames.size,scheduledToday,completedToday,completionRate,scheduleRisk,revenue,cost,gross,margin,completedNotInvoiced,arOpen,arOverdue,cash,
        prodLabour,recentPaidHours,labourUtil,recurringRate,dueVisits,doneVisits,winterActive,winterRoutes,fallRows,fallDone,fallRate,locked,maintBlock,trainingBlock,workforceBlock,safetyBlock,financeReady,todayDispatch,todayProd};
    }
    function render(){
      const m=metrics();
      $('owner350Kpis').innerHTML=[
        card('Crews today',allowed('jobs')?m.crewCount:'Unavailable',m.scheduledToday+' scheduled'),
        card('Completion today',allowed('jobs')?pct(m.completionRate):'Unavailable',m.completedToday+' completed'),
        card('Schedule risk',allowed('jobs')?m.scheduleRisk:'Unavailable','late/workability signals'),
        card('Revenue',allowed('finance')?money(m.revenue):'Unavailable','loaded job evidence'),
        card('Gross margin',allowed('finance')?pct(m.margin):'Unavailable',allowed('finance')?money(m.gross):'Finance hidden'),
        card('Labour utilization',allowed('admin')?pct(m.labourUtil):'Unavailable','14d production / paid time'),
        card('Receivables',allowed('finance')?money(m.arOpen):'Unavailable',allowed('finance')?money(m.arOverdue)+' overdue':'Finance hidden'),
        card('Cash / bank',allowed('finance')?money(m.cash):'Unavailable','latest reconciliation')
      ].join('');
      $('owner350Today').innerHTML=rowsHtml(m.todayDispatch.slice(0,8).map(r=>({title:(r.crew_name||r.route_name||r.job_code||'Scheduled work')+' · '+(r.site_name||r.job_name||''),detail:(r.scheduled_start||'')+' · '+(r.schedule_status||r.status||'scheduled')})),allowed('jobs')?'No work is scheduled in the loaded today window.':'Jobs module unavailable.');
      $('owner350Production').innerHTML=allowed('jobs')?[
        card('Production labour, 14d',m.prodLabour.toFixed(1)+' h'),
        card('Paid time, 14d',m.recentPaidHours.toFixed(1)+' h'),
        card('Recorded utilization',pct(m.labourUtil),'production labour / paid hours'),
        card('Completed not invoiced',m.completedNotInvoiced)
      ].join(''):'<p class="muted">Jobs/Admin evidence unavailable.</p>';
      $('owner350Finance').innerHTML=allowed('finance')?[
        card('Revenue',money(m.revenue)),card('Cost',money(m.cost)),card('Gross profit',money(m.gross)),card('Margin',pct(m.margin)),
        card('Open receivables',money(m.arOpen)),card('Overdue receivables',money(m.arOverdue)),card('Cash / bank',money(m.cash)),
        card('Finance readiness',m.financeReady?'READY':'ATTENTION',m.finEx.length+' reconciliation exception(s)')
      ].join(''):'<p class="muted">Finance module is not visible to this profile.</p>';
      const routeGroups={};for(const v of m.visits){const key=(v.service_name||v.service_program_type||'Other')+' · '+(v.season_context||v.season||'season n/a');routeGroups[key]=routeGroups[key]||{total:0,done:0};routeGroups[key].total++;if(done(v.visit_status||v.latest_event_type))routeGroups[key].done++}
      const routeRows=Object.entries(routeGroups).slice(0,6).map(([k,v])=>({title:k,detail:v.done+' / '+v.total+' completed'}));
      $('owner350Seasonal').innerHTML=(allowed('jobs')?[
        card('Recurring completion',pct(m.recurringRate),m.doneVisits+' / '+m.dueVisits.length+' due visits'),
        card('Winter storms',m.winterActive,m.winterRoutes+' storm route(s)'),
        card('Fall cleanup progress',pct(m.fallRate),m.fallDone+' / '+m.fallRows.length+' loaded items')
      ].join('')+rowsHtml(routeRows,'No recurring route records loaded.'):'<p class="muted">Jobs/seasonal evidence unavailable.</p>');
      $('owner350Blockers').innerHTML=[
        card('Safety blockers',allowed('safety')?m.safetyBlock:'Unavailable'),
        card('Equipment locked out',allowed('jobs')?m.locked:'Unavailable'),
        card('Maintenance due',allowed('jobs')?m.maintBlock:'Unavailable'),
        card('Training blockers',allowed('safety')?m.trainingBlock:'Unavailable'),
        card('Workforce blockers',allowed('admin')?m.workforceBlock:'Unavailable')
      ].join('');
      const attention=[
        m.scheduleRisk?{title:'Schedule risk',detail:m.scheduleRisk+' late/workability signal(s)'}:null,
        m.safetyBlock?{title:'Safety',detail:m.safetyBlock+' action(s) require review'}:null,
        (m.locked+m.maintBlock)?{title:'Equipment',detail:m.locked+' locked · '+m.maintBlock+' maintenance due'}:null,
        (m.trainingBlock+m.workforceBlock)?{title:'Workforce',detail:m.trainingBlock+' training · '+m.workforceBlock+' workforce blocker(s)'}:null,
        m.completedNotInvoiced?{title:'Completed not invoiced',detail:m.completedNotInvoiced+' job(s)'}:null,
        m.arOverdue>0?{title:'Overdue receivables',detail:money(m.arOverdue)}:null,
        m.finEx.length?{title:'Finance exceptions',detail:m.finEx.length+' manual-review item(s)'}:null
      ].filter(Boolean);
      $('owner350Attention').innerHTML=rowsHtml(attention,'No blocker is visible in the currently loaded management evidence.');
    }
    function openSource(target){
      if(target==='jobs'||target==='finance'){window.YWIRouter?.showSection?.(target);return}
      window.YWIRouter?.showSection?.('admin');setTimeout(()=>window.YWIAdminHub?.open?.(target==='safety'?'safety':'operations'),0);
    }
    async function load(){
      try{note('Loading owner / management evidence…');const r=await api.loadAdminDirectory({scope:'owner_management_command',limit:500})||{};if(r.ok===false)throw new Error(r.error||'Management command centre load failed.');state.data=r;render();note('Build 350 management cockpit refreshed. Source records were not changed.')}
      catch(e){state.data={source_visibility:{jobs:false,finance:false,safety:false,admin:false}};render();note('Unable to load Build 350 management cockpit: '+(e?.message||e),true)}
    }
    el.addEventListener('click',e=>{const b=e.target.closest('[data-owner350-open]');if(b)openSource(b.getAttribute('data-owner350-open'))});
    $('owner350Refresh').onclick=load;load();
  }
  window.YWIOwnerManagementCommandUI={mount};
})();