/* Builds 350–353 — Owner / Management Command Centre + evidence confidence + four-season capacity forecast */
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
      '<summary><span>Owner / Management Command Centre</span><small>Build 350–354 · four-season cockpit + evidence confidence + capacity + route/crew efficiency</small></summary>',
      '<div class="admin-panel-block" data-build="350">',
      '<div class="section-heading"><div><span class="module-kicker">Build 350 · Management</span><h3>Owner / Management Command Centre</h3><p class="section-subtitle">One read-only view of today, production, profitability, workforce, seasonal execution, Safety, equipment and Finance readiness.</p></div><button id="owner350Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> this cockpit summarizes existing source workflows only. It cannot dispatch crews, alter routes, approve Safety, unlock equipment, edit training, post Finance, invoice work, collect payment or close accounting periods.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Four-season Ontario model:</strong> spring/summer landscaping, fall cleanup/leaf collection and winter snow/storm operations are first-class operating contexts. Missing module access is shown as unavailable rather than inferred.</div>',
      '<div id="owner350Status" class="notice" style="margin-top:10px;"></div>',
      '<section class="admin-panel-block owner351-evidence" style="margin-top:12px;"><div class="owner350-head"><div><h4>Management metric freshness &amp; confidence</h4><p class="section-subtitle">Build 351 · authoritative source age, coverage, visibility and confidence. Missing evidence is never converted into a zero-valued business fact.</p></div></div><div id="owner351Freshness"></div></section>',
      '<section class="admin-panel-block owner353-forecast" style="margin-top:12px;"><div class="owner350-head"><div><h4>Four-season capacity &amp; workability forecast</h4><p class="section-subtitle">Build 353 · 7- and 14-day advisory readiness from existing schedules, recurring visits, crews, equipment, stored workability evidence and seasonal operations.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>No external weather provider:</strong> this forecast uses YW workability observations/rules and operational evidence already stored in the application. It does not auto-dispatch or change source records.</div><div id="owner353Forecast"></div></section>',
      '<section class="admin-panel-block owner354-efficiency" style="margin-top:12px;"><div class="owner350-head"><div><h4>Route &amp; crew efficiency evidence</h4><p class="section-subtitle">Build 354 · planned-versus-recorded service duration, travel allowance context, route order, crew hours, return visits, delay/workability effects and repeated route friction.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>Advisory, not employee scoring:</strong> this evidence can surface route clustering and configured-capacity opportunities, but it does not rank workers, rewrite routes or change dispatch.</div><div id="owner354Efficiency"></div></section>',
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
    if(!$('owner350Style')){const st=document.createElement('style');st.id='owner350Style';st.textContent='.owner350-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.owner350-kpi{padding:12px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(15,23,42,.46)}.owner350-kpi span{display:block;font-size:.76rem;color:#c4d1e2}.owner350-kpi strong{display:block;font-size:1.15rem;margin-top:4px}.owner350-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.owner350-list{display:grid;gap:7px}.owner350-row{padding:8px 10px;border-radius:9px;background:rgba(15,23,42,.45)}.owner350-row small{display:block;color:#c4d1e2;margin-top:2px}.owner351-meta{display:block;margin-top:5px;font-size:.72rem;color:#aebed2}.owner351-source{padding:8px 10px;border-radius:9px;background:rgba(15,23,42,.36);border:1px solid rgba(148,163,184,.16)}.owner351-source strong{display:block}.owner351-source small{display:block;color:#c4d1e2;margin-top:2px}.owner351-state{font-weight:700;letter-spacing:.02em}.owner351-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:10px}.owner353-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.owner353-day{padding:10px;border:1px solid rgba(148,163,184,.22);border-radius:10px;background:rgba(15,23,42,.4)}.owner353-day strong,.owner353-day small{display:block}.owner353-day small{color:#c4d1e2;margin-top:3px}.owner353-season{font-size:.72rem;color:#aebed2;margin-top:5px}@media(max-width:700px){.owner350-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.owner350-head button{width:100%;min-height:44px}}';document.head.appendChild(st)}
    return el;
  }
  function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={data:{}};
    const note=(s,bad=false)=>{const n=$('owner350Status');if(n){n.textContent=s;n.classList.toggle('error',bad)}};
    const allowed=k=>state.data?.source_visibility?.[k]!==false;
    const metricMeta=k=>state.data?.management_metric_confidence?.[k]||null;
    const sourceMeta=k=>state.data?.source_freshness?.[k]||null;
    const when=v=>{if(!v)return'No authoritative timestamp';const d=new Date(v);return Number.isNaN(d.getTime())?'No authoritative timestamp':d.toLocaleString()};
    const metricValue=(key,value)=>{const m=metricMeta(key);if(!m)return value;if(m.state==='unavailable')return'Unavailable';if(m.state==='missing')return'No source evidence';return value};
    const metricDetail=(key,detail)=>{const m=metricMeta(key);if(!m)return detail;if(['unavailable','missing'].includes(String(m.state||'')))return m.reason||'Authoritative source evidence is unavailable.';return detail};
    const metricEvidence=(key)=>{const m=metricMeta(key);if(!m)return'';return '<small class="owner351-meta">Evidence: '+esc(String(m.state||'unknown').toUpperCase())+' · confidence '+esc(String(m.confidence||'unknown').toUpperCase())+' · updated '+esc(when(m.last_authoritative_update))+'</small>'};
    const card=(label,value,detail='',metricKey='')=>'<div class="owner350-kpi"><span>'+esc(label)+'</span><strong>'+esc(metricKey?metricValue(metricKey,value):value)+'</strong>'+(detail||metricKey?'<small>'+esc(metricKey?metricDetail(metricKey,detail):detail)+'</small>':'')+(metricKey?metricEvidence(metricKey):'')+'</div>';
    function renderFreshness(){
      const host=$('owner351Freshness');if(!host)return;
      const entries=Object.values(state.data?.source_freshness||{});
      if(!entries.length){host.innerHTML='<p class="muted">Freshness evidence is unavailable from this response.</p>';return}
      const visible=entries.filter(s=>s?.freshness_state!=='hidden'),current=visible.filter(s=>s?.freshness_state==='current'),stale=visible.filter(s=>s?.freshness_state==='stale');
      const gaps=visible.filter(s=>s?.coverage_gap===true||['source_error','missing','timestamp_unavailable'].includes(String(s?.freshness_state||'')));
      const summary='<div class="owner351-summary">'+[
        card('Visible sources',visible.length+' / '+entries.length,'permission-aware coverage'),
        card('Current sources',current.length,'within configured freshness window'),
        card('Stale sources',stale.length,'requires cautious interpretation'),
        card('Coverage gaps',gaps.length,'missing/error/timestamp/cap signals')
      ].join('')+'</div>';
      const priority=['jobs','dispatch','production','profitability','timekeeping','workability','receivables','bank','safety','equipment','maintenance','recurring_visits','storms','storm_routes'];
      const ordered=[...priority.map(k=>sourceMeta(k)).filter(Boolean),...entries.filter(s=>!priority.includes(s?.source_key))];
      const rows='<div class="owner350-list">'+ordered.map(s=>'<div class="owner351-source"><strong>'+esc(s.source_module||'source')+' · '+esc(s.source_view||s.source_key||'unknown')+'</strong><small><span class="owner351-state">'+esc(String(s.freshness_state||'unknown').toUpperCase())+'</span> · confidence '+esc(String(s.confidence||'unknown').toUpperCase())+' · '+esc(String(s.row_count??0))+' row(s) · updated '+esc(when(s.last_authoritative_update))+'</small><small>'+esc(s.reason||'No freshness explanation supplied.')+'</small></div>').join('')+'</div>';
      host.innerHTML=summary+'<details><summary>Authoritative source details</summary>'+rows+'</details>';
    }
    function renderCapacityForecast(){
      const host=$('owner353Forecast');if(!host)return;
      const f=state.data?.four_season_capacity_forecast;
      const meta=metricMeta('capacity_forecast');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Jobs/operations evidence is unavailable to this profile.</p>';return}
      if(!f||!Array.isArray(f.days)){host.innerHTML='<p class="muted">Capacity forecast evidence is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required forecast source evidence is unavailable.')+'</p>';return
      }
      const w7=f.windows?.seven_day||{},w14=f.windows?.fourteen_day||{};
      const minToHours=v=>(num(v)/60).toFixed(1)+' h';
      const summary='<div class="owner351-summary">'+[
        card('7-day planned',w7.planned_items??0,minToHours(w7.recorded_demand_minutes)+' recorded demand','capacity_forecast'),
        card('7-day constrained',num(w7.blocked_days)+num(w7.attention_days),num(w7.blocked_days)+' blocked · '+num(w7.attention_days)+' attention'),
        card('14-day planned',w14.planned_items??0,minToHours(w14.recorded_demand_minutes)+' recorded demand','capacity_forecast'),
        card('14-day constrained',num(w14.blocked_days)+num(w14.attention_days),num(w14.blocked_days)+' blocked · '+num(w14.attention_days)+' attention')
      ].join('')+'</div>';
      const seasonLabel=s=>'Spring/summer '+num(s?.spring_summer)+' · Fall '+num(s?.fall)+' · Winter '+num(s?.winter)+' · Four-season '+num(s?.four_season);
      const days='<div class="owner353-days">'+f.days.map(d=>'<div class="owner353-day" data-owner353-state="'+esc(d.readiness_state||'unknown')+'"><strong>'+esc(d.date)+' · '+esc(String(d.readiness_state||'unknown').toUpperCase())+'</strong><small>'+esc(num(d.total_planned_items)+' planned · '+minToHours(d.recorded_demand_minutes)+' recorded · '+num(d.scheduled_crew_count)+' / '+num(d.active_crew_count)+' active crews scheduled')+'</small><small>'+esc(num(d.ready_equipment_count)+' / '+num(d.required_equipment_count)+' assigned equipment ready · '+num(d.equipment_attention_count)+' assigned equipment attention · fleet '+num(d.fleet_ready_equipment_count)+' ready · '+num(d.workability_blocked_count)+' blocked / '+num(d.workability_review_count)+' workability review')+'</small><small>'+esc(d.readiness_reason||'No readiness explanation supplied.')+'</small><div class="owner353-season">'+esc(seasonLabel(d.season_load))+'</div></div>').join('')+'</div>';
      host.innerHTML=summary+'<p class="muted">'+esc(f.capacity_method||'')+'</p>'+days+'<details style="margin-top:8px;"><summary>Forecast authority &amp; weather boundary</summary><p class="muted">'+esc(f.weather_boundary||'')+'</p><p class="muted">'+esc(f.authority_boundary||'')+'</p></details>';
    }

    function renderRouteCrewEfficiency(){
      const host=$('owner354Efficiency');if(!host)return;
      const e=state.data?.route_crew_efficiency_evidence;
      const meta=metricMeta('route_efficiency');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Jobs/operations evidence is unavailable to this profile.</p>';return}
      if(!e||!e.summary){host.innerHTML='<p class="muted">Route and crew efficiency evidence is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required route-efficiency source evidence is unavailable.')+'</p>';return
      }
      const s=e.summary||{};
      const minToHours=v=>(num(v)/60).toFixed(1)+' h';
      const summary='<div class="owner351-summary">'+[
        card('Actual service coverage',num(s.items_with_actual_service_evidence),num(s.planned_items)+' planned item(s)','route_efficiency'),
        card('Duration overruns',num(s.service_duration_overrun_items),'recorded actual > recorded plan','route_efficiency'),
        card('Route-order differences',num(s.route_order_deviation_items),'planned order vs recorded start sequence','route_efficiency'),
        card('Return visits',num(s.return_visit_items),minToHours(s.recorded_delay_minutes)+' recorded delay','route_efficiency'),
        card('Repeated route friction',num(s.repeated_route_friction_count),'2+ service dates with evidence signals','route_efficiency'),
        card('Cluster candidates',num(s.clustering_opportunity_count),'same-day city overlap across routes','route_efficiency'),
        card('Capacity-headroom days',num(s.route_days_with_configured_capacity_headroom),'uses configured route capacity only','route_efficiency'),
        card('Crew travel evidence',num(s.recorded_crew_travel_coverage_items),'linked timekeeping coverage','route_efficiency')
      ].join('')+'</div>';
      const routeDays=(e.route_days||[]).slice(0,12).map(r=>{
        const actual=r.actual_service_minutes==null?'actual service n/a':num(r.actual_service_minutes)+' actual service min';
        const cap=r.configured_daily_capacity_minutes==null?'configured capacity n/a':num(r.configured_capacity_headroom_minutes)+' min configured headroom';
        return '<div class="owner350-row"><strong>'+esc((r.route_name||'Unnamed route')+' · '+(r.service_date||''))+'</strong><small>'+esc(num(r.planned_item_count)+' item(s) · '+num(r.planned_service_minutes)+' planned service min · '+num(r.planned_travel_allowance_minutes)+' planned travel min · '+actual)+'</small><small>'+esc(num(r.actual_crew_hours).toFixed(2)+' crew h · '+num(r.delay_minutes)+' delay min · '+num(r.return_visit_count)+' return visit(s) · '+num(r.route_order_deviation_count)+' order difference(s) · '+cap)+'</small></div>';
      }).join('');
      const friction=(e.repeated_route_friction||[]).slice(0,8).map(r=>'<div class="owner350-row"><strong>'+esc(r.route_name||'Unnamed route')+'</strong><small>'+esc(num(r.friction_service_date_count)+' service date(s) with friction evidence · '+num(r.delay_minutes)+' delay min · '+num(r.return_visit_count)+' return visit(s) · '+num(r.route_order_deviation_count)+' order difference(s) · '+num(r.workability_effect_count)+' workability effect(s)')+'</small></div>').join('');
      const clusters=(e.clustering_opportunities||[]).slice(0,8).map(r=>'<div class="owner350-row"><strong>'+esc((r.service_date||'')+' · '+(r.city||'City unavailable'))+'</strong><small>'+esc(num(r.planned_item_count)+' planned item(s) across '+num(r.route_count)+' route(s) · '+(r.route_names||[]).join(', '))+'</small><small>'+esc(r.advisory_reason||'')+'</small></div>').join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Recent route-day evidence</summary><div class="owner350-list">'+(routeDays||'<p class="muted">No route-day evidence is loaded in the 90-day window.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Repeated route friction</summary><div class="owner350-list">'+(friction||'<p class="muted">No route has friction evidence on two or more loaded service dates.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Clustering opportunities</summary><div class="owner350-list">'+(clusters||'<p class="muted">No same-day city overlap across routes is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence boundaries</summary><p class="muted">'+esc(e.comparison_boundary||'')+'</p><p class="muted">'+esc(e.clustering_boundary||'')+'</p><p class="muted">'+esc(e.performance_boundary||'')+'</p><p class="muted">'+esc(e.authority_boundary||'')+'</p></details>';
    }
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
      renderFreshness();
      renderCapacityForecast();
      renderRouteCrewEfficiency();
      $('owner350Kpis').innerHTML=[
        card('Crews today',allowed('jobs')?m.crewCount:'Unavailable',allowed('jobs')?m.scheduledToday+' scheduled':'Jobs module unavailable.','crews_today'),
        card('Completion today',allowed('jobs')?pct(m.completionRate):'Unavailable',allowed('jobs')?m.completedToday+' completed':'Jobs module unavailable.','completion_today'),
        card('Schedule risk',allowed('jobs')?m.scheduleRisk:'Unavailable',allowed('jobs')?'late/workability signals':'Jobs module unavailable.','schedule_risk'),
        card('Revenue',allowed('finance')?money(m.revenue):'Unavailable',allowed('finance')?'loaded job evidence':'Finance module unavailable.','revenue'),
        card('Gross margin',allowed('finance')?pct(m.margin):'Unavailable',allowed('finance')?money(m.gross):'Finance module unavailable.','gross_margin'),
        card('Labour utilization',allowed('admin')?pct(m.labourUtil):'Unavailable',allowed('admin')?'14d production / paid time':'Admin evidence unavailable.','labour_utilization'),
        card('Receivables',allowed('finance')?money(m.arOpen):'Unavailable',allowed('finance')?money(m.arOverdue)+' overdue':'Finance module unavailable.','receivables'),
        card('Cash / bank',allowed('finance')?money(m.cash):'Unavailable',allowed('finance')?'latest reconciliation':'Finance module unavailable.','cash_bank')
      ].join('');
      $('owner350Today').innerHTML=rowsHtml(m.todayDispatch.slice(0,8).map(r=>({title:(r.crew_name||r.route_name||r.job_code||'Scheduled work')+' · '+(r.site_name||r.job_name||''),detail:(r.scheduled_start||'')+' · '+(r.schedule_status||r.status||'scheduled')})),allowed('jobs')?'No work is scheduled in the loaded today window.':'Jobs module unavailable.');
      $('owner350Production').innerHTML=allowed('jobs')?[
        card('Production labour, 14d',m.prodLabour.toFixed(1)+' h'),
        card('Paid time, 14d',m.recentPaidHours.toFixed(1)+' h'),
        card('Recorded utilization',pct(m.labourUtil),'production labour / paid hours','labour_utilization'),
        card('Completed not invoiced',m.completedNotInvoiced)
      ].join(''):'<p class="muted">Jobs/Admin evidence unavailable.</p>';
      $('owner350Finance').innerHTML=allowed('finance')?[
        card('Revenue',money(m.revenue),'','revenue'),card('Cost',money(m.cost),'','gross_margin'),card('Gross profit',money(m.gross),'','gross_margin'),card('Margin',pct(m.margin),'','gross_margin'),
        card('Open receivables',money(m.arOpen),'','receivables'),card('Overdue receivables',money(m.arOverdue),'','receivables'),card('Cash / bank',money(m.cash),'','cash_bank'),
        card('Finance readiness',m.financeReady?'READY':'ATTENTION',m.finEx.length+' reconciliation exception(s)','finance_readiness')
      ].join(''):'<p class="muted">Finance module is not visible to this profile.</p>';
      const routeGroups={};for(const v of m.visits){const key=(v.service_name||v.service_program_type||'Other')+' · '+(v.season_context||v.season||'season n/a');routeGroups[key]=routeGroups[key]||{total:0,done:0};routeGroups[key].total++;if(done(v.visit_status||v.latest_event_type))routeGroups[key].done++}
      const routeRows=Object.entries(routeGroups).slice(0,6).map(([k,v])=>({title:k,detail:v.done+' / '+v.total+' completed'}));
      $('owner350Seasonal').innerHTML=(allowed('jobs')?[
        card('Recurring completion',pct(m.recurringRate),m.doneVisits+' / '+m.dueVisits.length+' due visits','recurring_completion'),
        card('Winter storms',m.winterActive,m.winterRoutes+' storm route(s)','winter_operations'),
        card('Fall cleanup progress',pct(m.fallRate),m.fallDone+' / '+m.fallRows.length+' loaded items','fall_cleanup')
      ].join('')+rowsHtml(routeRows,'No recurring route records loaded.'):'<p class="muted">Jobs/seasonal evidence unavailable.</p>');
      $('owner350Blockers').innerHTML=[
        card('Safety blockers',allowed('safety')?m.safetyBlock:'Unavailable','','safety_blockers'),
        card('Equipment locked out',allowed('jobs')?m.locked:'Unavailable','','equipment_blockers'),
        card('Maintenance due',allowed('jobs')?m.maintBlock:'Unavailable','','equipment_blockers'),
        card('Training blockers',allowed('safety')?m.trainingBlock:'Unavailable','','workforce_blockers'),
        card('Workforce blockers',allowed('admin')?m.workforceBlock:'Unavailable','','workforce_blockers')
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
      try{note('Loading owner / management evidence…');const r=await api.loadAdminDirectory({scope:'owner_management_command',limit:500})||{};if(r.ok===false)throw new Error(r.error||'Management command centre load failed.');state.data=r;render();note('Build 354 route and crew efficiency evidence refreshed. Source records were not changed.')}
      catch(e){state.data={source_visibility:{jobs:false,finance:false,safety:false,admin:false},source_freshness:{},management_metric_confidence:{},four_season_capacity_forecast:null,route_crew_efficiency_evidence:null};render();note('Unable to load Build 354 route and crew efficiency evidence: '+(e?.message||e),true)}
    }
    el.addEventListener('click',e=>{const b=e.target.closest('[data-owner350-open]');if(b)openSource(b.getAttribute('data-owner350-open'))});
    $('owner350Refresh').onclick=load;load();
  }
  window.YWIOwnerManagementCommandUI={mount};
})();