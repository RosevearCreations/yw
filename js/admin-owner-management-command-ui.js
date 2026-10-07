/* Builds 350–364 — Owner / Management Command Centre + evidence confidence + capacity + workability recovery + route/crew + recurring retention + estimate-to-cash + utilization + stock readiness + communication readiness + data quality reconciliation */
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
      '<summary><span>Owner / Management Command Centre</span><small>Build 350–360 foundation · Build 364 workability recovery outcomes · four-season cockpit + evidence confidence + capacity + route/crew efficiency + recurring retention + estimate-to-cash + utilization + stock readiness + communication readiness + data quality reconciliation</small></summary>',
      '<div class="admin-panel-block" data-build="350">',
      '<div class="section-heading"><div><span class="module-kicker">Build 350 · Management</span><h3>Owner / Management Command Centre</h3><p class="section-subtitle">One read-only view of today, production, profitability, workforce, seasonal execution, Safety, equipment and Finance readiness.</p></div><button id="owner350Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> this cockpit summarizes existing source workflows only. It cannot dispatch crews, alter routes, approve Safety, unlock equipment, edit training, post Finance, invoice work, collect payment or close accounting periods.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Four-season Ontario model:</strong> spring/summer landscaping, fall cleanup/leaf collection and winter snow/storm operations are first-class operating contexts. Missing module access is shown as unavailable rather than inferred.</div>',
      '<div id="owner350Status" class="notice" style="margin-top:10px;"></div>',
      '<section class="admin-panel-block owner351-evidence" style="margin-top:12px;"><div class="owner350-head"><div><h4>Management metric freshness &amp; confidence</h4><p class="section-subtitle">Build 351 · authoritative source age, coverage, visibility and confidence. Missing evidence is never converted into a zero-valued business fact.</p></div></div><div id="owner351Freshness"></div></section>',
      '<section class="admin-panel-block owner353-forecast" style="margin-top:12px;"><div class="owner350-head"><div><h4>Four-season capacity &amp; workability forecast</h4><p class="section-subtitle">Build 353 · 7- and 14-day advisory readiness from existing schedules, recurring visits, crews, equipment, stored workability evidence and seasonal operations.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>No external weather provider:</strong> this forecast uses YW workability observations/rules and operational evidence already stored in the application. It does not auto-dispatch or change source records.</div><div id="owner353Forecast"></div></section>',
      '<section class="admin-panel-block owner364-recovery" style="margin-top:12px;"><div class="owner350-head"><div><h4>Workability-to-schedule recovery outcomes</h4><p class="section-subtitle">Build 364 · 90-day comparison of recorded Workability constraints with later Dispatch and Production evidence, including same-day recovery, rescheduled completion, partial/return visits and unresolved work.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>Outcome learning only:</strong> missing schedule or production evidence remains unresolved. This view cannot change a Workability decision, move a schedule item, dispatch crews, complete work or send a customer message.</div><div id="owner364Recovery"></div></section>',
      '<section class="admin-panel-block owner354-efficiency" style="margin-top:12px;"><div class="owner350-head"><div><h4>Route &amp; crew efficiency evidence</h4><p class="section-subtitle">Build 354 · planned-versus-recorded service duration, travel allowance context, route order, crew hours, return visits, delay/workability effects and repeated route friction.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>Advisory, not employee scoring:</strong> this evidence can surface route clustering and configured-capacity opportunities, but it does not rank workers, rewrite routes or change dispatch.</div><div id="owner354Efficiency"></div></section>',
      '<section class="admin-panel-block owner365-sequence" style="margin-top:12px;"><div class="owner350-head"><div><h4>Route plan-vs-actual &amp; stop-sequence learning</h4><p class="section-subtitle">Build 365 · repeated route-day learning from planned stop order, recorded production-start order, service duration, recorded delays, return visits and travel evidence already held by YW.</p></div><button class="secondary" data-owner350-open="jobs">Open Jobs</button></div><div class="notice" style="margin:8px 0;"><strong>Learning only:</strong> repeated differences become review candidates, never automatic route changes. No worker scoring, GPS inference, stop reordering or dispatch mutation is performed.</div><div id="owner365Sequence"></div></section>',
      '<section class="admin-panel-block owner355-retention" style="margin-top:12px;"><div class="owner350-head"><div><h4>Recurring service renewal &amp; retention workbench</h4><p class="section-subtitle">Build 355 · renewal windows, holds, repeated skips/delays, unresolved service issues, seasonal rollover and price-review evidence.</p></div><button class="secondary" data-owner350-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Review only:</strong> this workbench prepares context. It does not renew an agreement, change pricing, send a customer message or create a customer commitment.</div><div id="owner355Retention"></div></section>',
      '<section class="admin-panel-block owner366-outcomes" style="margin-top:12px;"><div class="owner350-head"><div><h4>Recurring renewal conversion &amp; churn outcomes</h4><p class="section-subtitle">Build 366 · recorded renewed, declined, held, expired and unresolved outcomes from recurring agreements, CRM decisions, seasonal rollover and permission-scoped Finance evidence.</p></div><button class="secondary" data-owner350-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Recorded outcomes only:</strong> active or overdue status is not treated as a renewal. This view does not renew/cancel agreements, change pricing, contact customers or resolve complaints.</div><div id="owner366Outcomes"></div></section>',
      '<section class="admin-panel-block owner356-cash" style="margin-top:12px;"><div class="owner350-head"><div><h4>Estimate-to-cash leakage &amp; margin recovery</h4><p class="section-subtitle">Build 356 · accepted estimate → scheduling → production → approved extras → invoice readiness → invoicing → payment application → collection.</p></div><button class="secondary" data-owner356-open="finance">Open Finance</button></div><div class="notice" style="margin:8px 0;"><strong>Analytical only:</strong> this workbench does not create invoices, post accounting, apply payments, send collection messages or charge customers.</div><div id="owner356EstimateCash"></div></section>',
      '<section class="admin-panel-block owner367-calibration" style="margin-top:12px;"><div class="owner350-head"><div><h4>Estimate accuracy &amp; change-order margin calibration</h4><p class="section-subtitle">Build 367 · accepted estimate baselines versus recorded labour, material, equipment, approved/applied change-order and job-cost closeout evidence.</p></div><button class="secondary" data-owner356-open="finance">Open Finance</button></div><div class="notice" style="margin:8px 0;"><strong>Calibration evidence only:</strong> recorded variances can identify repeated estimate patterns, but this view never edits assumptions, invents target margins, changes prices, approves extras or posts accounting.</div><div id="owner367Calibration"></div></section>',
      '<section class="admin-panel-block owner368-cash-cycle" style="margin-top:12px;"><div class="owner350-head"><div><h4>Completed-to-invoiced cycle-time &amp; cash conversion</h4><p class="section-subtitle">Build 368 · recorded completion/approved closeout → invoice readiness → A/R invoice creation → payment application and full-collection evidence.</p></div><button class="secondary" data-owner356-open="finance">Open Finance</button></div><div class="notice" style="margin:8px 0;"><strong>Timing evidence only:</strong> this view measures recorded milestones and aging cohorts. It never creates invoices, applies payments, sends collection messages, posts journals or mutates payment-provider state.</div><div id="owner368CashCycle"></div></section>',
      '<section class="admin-panel-block owner357-utilization" style="margin-top:12px;"><div class="owner350-head"><div><h4>Labour, equipment &amp; fleet utilization decision support</h4><p class="section-subtitle">Build 357 · 30-day paid-time, crew assignment, production labour, equipment-use, maintenance, lockout/downtime and fleet availability evidence.</p></div><button class="secondary" data-owner357-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Decision support only:</strong> this view does not score employees, clear Safety restrictions, change crew/equipment assignments, complete maintenance, replace assets or create purchases.</div><div id="owner357Utilization"></div></section>',
      '<section class="admin-panel-block owner370-equipment-lifecycle" style="margin-top:12px;"><div class="owner350-head"><div><h4>Equipment downtime cost &amp; replacement readiness</h4><p class="section-subtitle">Build 370 · 365-day recorded downtime, maintenance/service burden, signout evidence, lifecycle costs and existing replacement-state context.</p></div><button class="secondary" data-owner357-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Lifecycle review only:</strong> repeated downtime/maintenance are evidence signals, not replacement recommendations. This view cannot clear lockouts, return assets to service, replace/buy equipment, create vendor commitments or post Finance.</div><div id="owner370EquipmentLifecycle"></div></section>',
      '<section class="admin-panel-block owner369-labour-capture" style="margin-top:12px;"><div class="owner350-head"><div><h4>Labour capture completeness &amp; payroll exception reduction</h4><p class="section-subtitle">Build 369 · 30 completed days of crew/job work evidence matched to canonical timekeeping and payroll-readiness evidence.</p></div><button class="secondary" data-owner357-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Evidence quality, not employee scoring:</strong> this view surfaces missing/exception payroll evidence at crew/job level. It never ranks workers, approves payroll or corrections, changes pay codes, makes employment decisions or overrides Safety restrictions.</div><div id="owner369LabourCapture"></div></section>',
      '<section class="admin-panel-block owner358-stock" style="margin-top:12px;"><div class="owner350-head"><div><h4>Materials, consumables &amp; seasonal stock readiness</h4><p class="section-subtitle">Build 358 · 7/14-day planned material demand, on-hand stock, recurring-demand coverage, reorder risk and spring/summer, fall and winter readiness.</p></div><button class="secondary" data-owner358-open="jobs">Open Materials</button></div><div class="notice" style="margin:8px 0;"><strong>No automatic purchasing:</strong> this view uses recorded stock, planned material estimates and schedule evidence. It does not create purchase orders, contact suppliers, reserve stock or create vendor commitments.</div><div id="owner358Stock"></div></section>',
      '<section class="admin-panel-block owner359-communications" style="margin-top:12px;"><div class="owner350-head"><div><h4>Customer communication readiness &amp; queue quality</h4><p class="section-subtitle">Build 359 · weather/workability, reschedule/ETA, completion, recurring-service, overdue follow-up and invoice-reminder readiness with cross-source duplicate suppression.</p></div><button class="secondary" data-owner359-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>Review only — no send:</strong> this queue never emails, texts, publishes updates, reschedules work, retries providers or collects payment. Protected consent and delivery remain separate authority.</div><div id="owner359Communications"></div></section>',
      '<section class="admin-panel-block owner360-data-quality" style="margin-top:12px;"><div class="owner350-head"><div><h4>Data quality, duplicate &amp; orphan reconciliation workbench</h4><p class="section-subtitle">Build 360 · duplicate customer/property candidates, broken canonical references, cross-module mismatches, stale crew/equipment assignments, and conflicting four-season service tags.</p></div><button class="secondary" data-owner360-open="operations">Open Operations</button></div><div class="notice" style="margin:8px 0;"><strong>No destructive auto-fix:</strong> this workbench preserves source IDs and audit history. It cannot merge/delete records, rewrite foreign keys, reassign crews/equipment or clear lockouts.</div><div id="owner360DataQuality"></div></section>',
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
      const priority=['jobs','dispatch','production','profitability','timekeeping','timekeeping_detail','workability','crm_followups','crm_customers','crm_properties','crm_interactions','notification_delivery','closeouts','receivables','bank','safety','equipment','equipment_use','maintenance','fleet','recurring','routes','recurring_visits','storms','storm_routes'];
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


    function renderWorkabilityRecovery(){
      const host=$('owner364Recovery');if(!host)return;
      const r=state.data?.workability_schedule_recovery_outcomes;
      const meta=metricMeta('workability_schedule_recovery');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Jobs/operations evidence is unavailable to this profile.</p>';return}
      if(!r||!r.summary){host.innerHTML='<p class="muted">Workability schedule-recovery outcome evidence is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){host.innerHTML='<p class="muted">'+esc(meta.reason||'Required recovery source evidence is unavailable.')+'</p>';return}
      const s=r.summary||{};
      const hours=(num(s.recorded_completed_service_minutes)/60).toFixed(1)+' h';
      const avg=s.average_recovery_days==null?'n/a':num(s.average_recovery_days).toFixed(1)+' d';
      const summary='<div class="owner351-summary">'+[
        card('Constraint episodes',num(s.constraint_episodes),r.lookback_days+'-day recorded window','workability_schedule_recovery'),
        card('Full completion recovery',num(s.full_completion_recovery_count),pct(s.completion_recovery_rate_percent),'workability_schedule_recovery'),
        card('Same-day completion',num(s.same_day_completion_count),'constraint date completed'),
        card('Completed after recovery',num(s.completed_after_recovery_count),'later recorded completion'),
        card('Partial / return visit',num(s.partial_or_return_visit_count),'not counted as full recovery'),
        card('Reschedule pending',num(s.reschedule_pending_count),'recorded/proposed later schedule'),
        card('Unresolved',num(s.unresolved_count),'no later completion/schedule evidence'),
        card('Avg recovery time',avg,hours+' recorded completed service')
      ].join('')+'</div>';
      const seasons=(r.season_outcomes||[]).map(x=>'<div class="owner350-row"><strong>'+esc(String(x.season_context||'four_season').replace('_',' / '))+'</strong><small>'+esc(num(x.full_completion_recovery_count)+' / '+num(x.constraint_episodes)+' full completion recovery · '+pct(x.recovery_rate_percent)+' · '+num(x.partial_or_return_visit_count)+' partial/return · '+num(x.reschedule_pending_count)+' pending reschedule · '+num(x.unresolved_count)+' unresolved')+'</small></div>').join('');
      const outcomes=(r.outcomes||[]).slice(0,18).map(x=>{
        const label=x.work_order_number||x.site_name||x.source_key||'Workability episode';
        const recovery=x.recovery_days==null?'recovery time n/a':num(x.recovery_days)+' day(s)';
        return '<div class="owner350-row" data-owner364-state="'+esc(x.outcome_state||'unknown')+'"><strong>'+esc(label+' · '+String(x.outcome_state||'unknown').replaceAll('_',' ').toUpperCase())+'</strong><small>'+esc((x.service_date||'date n/a')+' · '+(x.season_context||'four_season')+' · '+(x.decision_state||x.workability_state||'constraint')+' · '+recovery)+'</small><small>'+esc(x.decision_reason||'Recorded Workability constraint with no additional reason text.')+'</small></div>';
      }).join('');
      host.innerHTML=summary+'<details open><summary>Four-season recovery mix</summary><div class="owner350-list" style="margin-top:8px;">'+(seasons||'<p class="muted">No constrained episodes in the loaded window.</p>')+'</div></details><details style="margin-top:8px;"><summary>Recent recovery evidence</summary><div class="owner350-list" style="margin-top:8px;">'+(outcomes||'<p class="muted">No constrained episodes in the loaded window.</p>')+'</div></details><details style="margin-top:8px;"><summary>Evidence and authority boundaries</summary><p class="muted">'+esc(r.evidence_boundary||'')+'</p><p class="muted">'+esc(r.capacity_boundary||'')+'</p><p class="muted">'+esc(r.weather_boundary||'')+'</p><p class="muted">'+esc(r.authority_boundary||'')+'</p></details>';
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


    function renderRouteSequenceLearning(){
      const host=$('owner365Sequence');if(!host)return;
      const e=state.data?.route_plan_actual_stop_sequence_learning;
      const meta=metricMeta('route_sequence_learning');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Jobs/operations evidence is unavailable to this profile.</p>';return}
      if(!e||!e.summary){host.innerHTML='<p class="muted">Route plan-vs-actual learning is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required route sequence source evidence is unavailable.')+'</p>';return
      }
      const x=e.summary||{};
      const summary='<div class="owner350-grid">'+[
        card('Comparable stop evidence',num(x.comparable_sequence_items),num(x.loaded_item_evidence)+' loaded items'),
        card('Route days with order difference',num(x.route_days_with_sequence_deviation),num(x.route_days_reviewed)+' route days reviewed'),
        card('Exact route-day sequence',num(x.exact_sequence_route_days),'recorded starts aligned to plan'),
        card('Stable friction routes',num(x.stable_friction_pattern_routes),'same friction on 2+ dates'),
        card('Sequencing review candidates',num(x.candidate_sequence_review_count),'same position difference on 2+ dates'),
        card('Recorded delay',num(x.recorded_delay_minutes)+' min',num(x.return_visit_items)+' return-visit items')
      ].join('')+'</div>';
      const days=(e.route_day_comparisons||[]).slice(0,20).map(d=>{
        const planned=(d.planned_sequence||[]).map(v=>num(v.position)+'. '+(v.site_name||'stop')).join(' → ');
        const actual=(d.recorded_start_sequence||[]).map(v=>num(v.position)+'. '+(v.site_name||'stop')).join(' → ');
        const travel=d.recorded_crew_travel_minutes==null?'crew travel not recorded':num(d.recorded_crew_travel_minutes)+' min recorded crew travel';
        return '<div class="owner350-row" data-owner365-day="'+esc(d.route_id+'|'+d.service_date)+'"><strong>'+esc((d.route_name||'Route')+' · '+(d.service_date||'date n/a'))+'</strong><small>'+esc('Plan: '+(planned||'no planned stop-order evidence'))+'</small><small>'+esc('Recorded starts: '+(actual||'no production-start sequence evidence'))+'</small><small>'+esc(num(d.order_deviation_count)+' order differences · '+num(d.service_duration_overrun_count)+' duration overruns · '+num(d.recorded_delay_minutes)+' delay min · '+num(d.return_visit_count)+' return visits · '+num(d.planned_travel_allowance_minutes)+' min planned travel · '+travel)+'</small></div>';
      }).join('');
      const patterns=(e.stable_friction_patterns||[]).slice(0,20).map(p=>'<div class="owner350-row"><strong>'+esc(p.route_name||'Route')+'</strong><small>'+esc((p.repeated_friction_types||[]).join(' · '))+'</small><small>'+esc(num(p.service_days)+' service days reviewed · '+num(p.order_deviation_service_days)+' order-difference days · '+num(p.delay_service_days)+' delay days · '+num(p.return_visit_service_days)+' return-visit days')+'</small></div>').join('');
      const candidates=(e.candidate_sequence_reviews||[]).slice(0,20).map(c=>'<div class="owner350-row" data-owner365-candidate="'+esc(String(c.route_id||''))+'"><strong>'+esc((c.route_name||'Route')+' · planned '+num(c.planned_position)+' → recorded start '+num(c.recorded_start_position))+'</strong><small>'+esc(num(c.repeat_service_date_count)+' service dates · '+(c.service_dates||[]).join(', '))+'</small><small>'+esc(c.review_reason||'Review sequencing context only; do not auto-reorder.')+'</small></div>').join('');
      host.innerHTML=summary+
        '<details open><summary>Recent route-day comparisons</summary><div class="owner350-list" style="margin-top:8px;">'+(days||'<p class="muted">No comparable route-day evidence in the loaded window.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Stable route-day friction patterns</summary><div class="owner350-list" style="margin-top:8px;">'+(patterns||'<p class="muted">No friction type repeated on two or more loaded service dates.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Candidate sequencing review</summary><div class="owner350-list" style="margin-top:8px;">'+(candidates||'<p class="muted">No repeated planned-position versus recorded-start-position difference met the review threshold.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence and authority boundaries</summary><p class="muted">'+esc(e.source_scope_boundary||'')+'</p><p class="muted">'+esc(e.travel_boundary||'')+'</p><p class="muted">'+esc(e.learning_boundary||'')+'</p><p class="muted">'+esc(e.performance_boundary||'')+'</p><p class="muted">'+esc(e.authority_boundary||'')+'</p></details>';
    }

    function renderRecurringRetention(){
      const host=$('owner355Retention');if(!host)return;
      const w=state.data?.recurring_renewal_retention_workbench;
      const meta=metricMeta('recurring_retention');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Recurring-service evidence is unavailable to this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Recurring renewal and retention evidence is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required recurring-service evidence is unavailable.')+'</p>';return
      }
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Renewal candidates',num(s.renewal_candidates),num(s.loaded_agreements)+' loaded agreement(s)','recurring_retention'),
        card('Retention attention',num(s.retention_attention),'holds / friction / unresolved issues','recurring_retention'),
        card('Repeated service friction',num(s.repeated_service_friction),'2+ skip/cancel/delay events in 180d','recurring_retention'),
        card('Unresolved service issues',num(s.unresolved_service_issues),'open CRM complaint/service-review evidence','recurring_retention'),
        card('Customer holds',num(s.customer_holds),'paused or active hold evidence','recurring_retention'),
        card('Price-review candidates',s.finance_evidence_visible?num(s.price_review_candidates):'Unavailable',s.finance_evidence_visible?'loss/non-positive contribution evidence':'Finance evidence not visible','recurring_retention')
      ].join('')+'</div>';
      const queue=(w.attention_queue||[]).slice(0,16).map(r=>{
        const finance=r.finance_evidence_state==='available'&&r.actual_margin_percent!=null?' · actual margin '+Number(r.actual_margin_percent).toFixed(1)+'%':'';
        const flags=[
          r.renewal_candidate?'renewal':'',
          r.retention_attention?'retention':'',
          r.price_review_candidate?'price review':''
        ].filter(Boolean).join(' · ');
        return '<div class="owner350-row"><strong>'+esc((r.client_name||r.agreement_code||'Recurring agreement')+' · '+(r.service_name||'Service'))+'</strong><small>'+esc((r.renewal_status||'renewal status n/a')+' · '+(r.site_name||r.site_city||'site n/a')+' · '+(flags||'review'))+'</small><small>'+esc((r.attention_reasons||[]).join(' · ')+finance)+'</small><small>'+esc(r.suggested_next_action||'Review source evidence')+'</small></div>';
      }).join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Renewal &amp; retention attention queue</summary><div class="owner350-list">'+(queue||'<p class="muted">No recurring agreement is in the loaded renewal/retention attention queue.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Decision boundaries</summary><p class="muted">'+esc(w.margin_boundary||'')+'</p><p class="muted">'+esc(w.retention_boundary||'')+'</p><p class="muted">'+esc(w.communication_boundary||'')+'</p><p class="muted">'+esc(w.pricing_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }


    function renderRecurringOutcomes(){
      const host=$('owner366Outcomes');if(!host)return;
      const o=state.data?.recurring_renewal_conversion_churn_outcomes;
      const meta=metricMeta('recurring_outcomes');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Recurring-service outcome evidence is unavailable to this profile.</p>';return}
      if(!o||!o.summary){host.innerHTML='<p class="muted">Recurring renewal outcome evidence is unavailable from this response.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required recurring outcome evidence is unavailable.')+'</p>';return
      }
      const x=o.summary||{};
      const conversion=x.recorded_renewal_conversion_rate_percent==null?'N/A':pct(x.recorded_renewal_conversion_rate_percent);
      const summary='<div class="owner351-summary">'+[
        card('Renewed',num(x.renewed_count),num(x.explicit_renewal_decision_count)+' explicit renewal decision(s)','recurring_outcomes'),
        card('Declined',num(x.declined_count),num(x.recorded_churn_outcome_count)+' recorded churn outcome(s)','recurring_outcomes'),
        card('Held',num(x.held_count),'recorded pause / hold evidence','recurring_outcomes'),
        card('Expired',num(x.expired_count),'recorded lifecycle outcome','recurring_outcomes'),
        card('Unresolved',num(x.unresolved_count),'missing or non-terminal renewal evidence','recurring_outcomes'),
        card('Recorded conversion',conversion,'renewed ÷ explicit renewed + declined','recurring_outcomes')
      ].join('')+'</div>';
      const labels={renewed:'Renewed',declined:'Declined',held:'Held',expired:'Expired',unresolved:'Unresolved'};
      const outcomes=(o.outcomes||[]).slice(0,60).map(r=>{
        const finance=r.finance_evidence_state==='available'&&r.actual_profit_total!=null?' · recorded profit '+money(r.actual_profit_total)+(r.actual_margin_percent!=null?' · margin '+pct(r.actual_margin_percent):''):'';
        const evidence=(r.reason_evidence||[]).map(e=>(e.type||'evidence')+': '+(e.text||'')).join(' · ');
        return '<div class="owner350-row" data-owner366-state="'+esc(r.outcome_state||'unresolved')+'"><strong>'+esc((r.client_name||r.agreement_code||'Agreement')+' · '+(labels[r.outcome_state]||r.outcome_state||'Unresolved'))+'</strong><small>'+esc((r.service_name||'service')+' · '+(r.agreement_code||'code n/a')+' · lifecycle '+(r.agreement_status||'not recorded')+(r.renewal_status?' · review '+r.renewal_status:''))+'</small><small>'+esc((evidence||'No explicit terminal renewal reason recorded')+finance)+'</small></div>';
      }).join('');
      const groups=(o.outcome_groups||[]).map(g=>'<div class="owner350-row"><strong>'+esc(labels[g.outcome_state]||g.outcome_state)+'</strong><small>'+esc(num(g.count)+' agreement(s)'+(g.recorded_profit_total!=null?' · recorded profit '+money(g.recorded_profit_total):''))+'</small></div>').join('');
      host.innerHTML=summary+
        '<details open><summary>Recorded renewal and churn outcomes</summary><div class="owner350-list" style="margin-top:8px;">'+(outcomes||'<p class="muted">No recurring agreement outcomes are loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Outcome mix</summary><div class="owner350-list" style="margin-top:8px;">'+groups+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Classification and authority boundaries</summary><p class="muted">'+esc(o.classification_boundary||'')+'</p><p class="muted">'+esc(o.conversion_boundary||'')+'</p><p class="muted">'+esc(o.churn_boundary||'')+'</p><p class="muted">'+esc(o.finance_boundary||'')+'</p><p class="muted">'+esc(o.authority_boundary||'')+'</p></details>';
    }

    function renderEstimateToCash(){
      const host=$('owner356EstimateCash');if(!host)return;
      const w=state.data?.estimate_to_cash_leakage_workbench;
      const meta=metricMeta('estimate_to_cash');
      if(!allowed('jobs')||!allowed('finance')){host.innerHTML='<p class="muted">Estimate-to-cash evidence requires both Jobs and Finance visibility for this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Estimate-to-cash evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical estimate-to-cash source queries failed. Leakage counts are withheld rather than converted into zero-valued facts.</p>';return}
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Accepted lifecycles',num(s.accepted_estimate_lifecycles),'accepted estimate chains loaded'),
        card('Accepted not scheduled',num(s.accepted_not_scheduled),'no active dispatch evidence'),
        card('Completed not invoiced',num(s.completed_not_invoiced),'completion/accounting-ready without A/R invoice'),
        card('Approved extras not billed',num(s.approved_extra_not_billed),'authorized/applied scope without linked invoice evidence'),
        card('Invoiced not collected',num(s.invoiced_not_collected),'A/R balance remains due'),
        card('Margin leakage',num(s.material_margin_leakage),'loss or simultaneous adverse revenue/cost variance')
      ].join('')+'</div>';
      const queue=(w.attention_queue||[]).slice(0,20).map(r=>{
        const amount=r.amount==null?'':' · '+money(r.amount);
        const label=String(r.signal_type||'review').replaceAll('_',' ');
        return '<div class="owner350-row"><strong>'+esc(label.toUpperCase()+' · '+(r.source_reference||'Source record'))+'</strong><small>'+esc((r.client_name||'Client unavailable')+(r.site_name?' · '+r.site_name:'')+amount)+'</small><small>'+esc(r.detail||'')+'</small><small>'+esc(r.suggested_next_action||'Review source evidence')+'</small><button class="secondary" style="margin-top:6px;" data-owner350-open="'+esc(r.navigation_target||r.source_module||'finance')+'">Open '+esc((r.navigation_target||r.source_module||'finance')==='jobs'?'Jobs':'Finance')+'</button></div>';
      }).join('');
      const lifecycle=(w.lifecycles||[]).slice(0,16).map(r=>{
        const flags=[
          r.accepted_not_scheduled?'accepted not scheduled':'',
          r.completed_not_invoiced?'completed not invoiced':'',
          r.approved_extra_not_billed_count?num(r.approved_extra_not_billed_count)+' extra(s) not billed':'',
          r.invoiced_not_collected?'invoice balance '+money(r.invoice_balance_due):'',
          r.material_margin_leakage?'margin leakage':''
        ].filter(Boolean).join(' · ');
        return '<div class="owner350-row"><strong>'+esc((r.estimate_number||'Estimate')+' → '+(r.work_order_number||'No work order')+' → '+(r.invoice_number||'No invoice'))+'</strong><small>'+esc((r.client_name||'Client unavailable')+' · '+(r.site_name||'Site unavailable'))+'</small><small>'+esc(flags||'No leakage signal in loaded evidence')+'</small></div>';
      }).join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Leakage &amp; recovery queue</summary><div class="owner350-list">'+(queue||'<p class="muted">No estimate-to-cash leakage signal is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Accepted estimate lifecycle traces</summary><div class="owner350-list">'+(lifecycle||'<p class="muted">No accepted estimate lifecycle is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence boundaries</summary><p class="muted">'+esc(w.margin_boundary||'')+'</p><p class="muted">'+esc(w.scheduling_boundary||'')+'</p><p class="muted">'+esc(w.billing_boundary||'')+'</p><p class="muted">'+esc(w.collection_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }


    function renderEstimateCalibration(){
      const host=$('owner367Calibration');if(!host)return;
      const c=state.data?.estimate_accuracy_change_order_margin_calibration;
      const meta=metricMeta('estimate_accuracy_calibration');
      if(!allowed('jobs')||!allowed('finance')){host.innerHTML='<p class="muted">Estimate calibration evidence requires both Jobs and Finance visibility for this profile.</p>';return}
      if(!c||!c.summary){host.innerHTML='<p class="muted">Estimate accuracy calibration evidence is unavailable from this response.</p>';return}
      if(c.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical calibration source queries failed. Variance results are withheld rather than converted into zero-valued facts.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){host.innerHTML='<p class="muted">'+esc(meta.reason||'Required estimate calibration evidence is unavailable.')+'</p>';return}

      const x=c.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Accepted estimates',num(x.accepted_estimates_reviewed),'accepted estimate chains reviewed','estimate_accuracy_calibration'),
        card('Comparable closeouts',num(x.comparison_ready_jobs),'adjusted baseline vs recorded known cost','estimate_accuracy_calibration'),
        card('Applied approved changes',num(x.approved_applied_change_orders),num(x.approved_change_orders)+' approved change order(s)','estimate_accuracy_calibration'),
        card('Labour cost comparisons',num(x.comparable_labour_cost_jobs),num(x.labour_hours_comparable_jobs)+' labour-hour comparison(s)','estimate_accuracy_calibration'),
        card('Material / equipment',num(x.comparable_material_cost_jobs)+' / '+num(x.comparable_equipment_cost_jobs),'recorded cost comparisons','estimate_accuracy_calibration'),
        card('Recurring patterns',num(x.recurring_calibration_pattern_count),'same variance direction on 2+ estimates','estimate_accuracy_calibration')
      ].join('')+'</div>';

      const components=(c.component_summary||[]).map(r=>{
        const variance=Number(r.cost_variance_total||0);
        const direction=variance>0?'actual above estimate':variance<0?'actual below estimate':'no aggregate difference';
        return '<div class="owner350-row" data-owner367-component="'+esc(r.component||'other')+'"><strong>'+esc(String(r.component||'cost').toUpperCase())+'</strong><small>'+esc(num(r.comparable_jobs)+' comparable job(s) · estimated '+money(r.estimated_cost_total)+' · actual '+money(r.actual_cost_total))+'</small><small>'+esc('recorded variance '+money(r.cost_variance_total)+' · '+direction+' · '+num(r.adverse_jobs)+' above / '+num(r.favorable_jobs)+' below / '+num(r.exact_jobs)+' exact')+'</small></div>';
      }).join('');

      const patterns=(c.recurring_calibration_patterns||[]).slice(0,30).map(r=>{
        const label=String(r.direction||'recorded variance').replaceAll('_',' ');
        const value=r.pattern_type==='recorded_margin_variance'
          ? num(r.recorded_variance_total)+' percentage-point total'
          : money(r.recorded_variance_total);
        return '<div class="owner350-row" data-owner367-pattern="'+esc(r.pattern_type||'pattern')+'"><strong>'+esc((r.template_key||'Estimate group')+' · '+(r.component||'total'))+'</strong><small>'+esc(num(r.occurrence_count)+' occurrence(s) across '+num(r.comparable_count)+' comparable record(s) · '+label+' · '+value)+'</small><small>'+esc(r.review_note||'Review recorded source evidence only.')+'</small></div>';
      }).join('');

      const records=(c.calibration_records||[]).slice(0,30).map(r=>{
        const total=r.total_cost_variance==null?'known total cost not comparable':'adjusted baseline '+money(r.adjusted_baseline_cost_total)+' · known actual '+money(r.actual_known_cost_total)+' · variance '+money(r.total_cost_variance);
        const hours=r.labour_hours_variance==null?'labour hours not comparable':'labour hours '+num(r.estimated_labour_hours)+' estimated → '+num(r.recorded_production_labour_hours)+' recorded · variance '+num(r.labour_hours_variance)+' h';
        const margin=r.margin_variance_percentage_points==null?'margin not comparable':'margin '+pct(r.estimated_margin_percent)+' estimated → '+pct(r.actual_margin_percent)+' recorded · '+num(r.margin_variance_percentage_points)+' pp';
        const comp=(r.component_cost_variance||[]).map(v=>v.comparable?(v.component+' '+money(v.estimated_cost)+' → '+money(v.actual_cost)+' ('+(Number(v.cost_variance)>0?'+':'')+money(v.cost_variance)+')'):(v.component+' unavailable')).join(' · ');
        const units=(r.assumption_unit_evidence||[]).map(u=>u.component||u.assumption_type).map((type,i)=>{
          const u=(r.assumption_unit_evidence||[])[i]||{};
          return (type||'assumption')+': '+((u.source_unit_labels||[]).join(', ')||'unit not recorded');
        }).join(' · ');
        return '<div class="owner350-row" data-owner367-record="'+esc(String(r.estimate_id||r.work_order_id||''))+'"><strong>'+esc((r.estimate_number||'Estimate')+' → '+(r.work_order_number||'No work order')+' · '+(r.template_name||r.template_code||r.template_key||'No template'))+'</strong><small>'+esc((r.client_name||'Client unavailable')+' · '+(r.site_name||'Site unavailable')+' · baseline '+(r.baseline_source||'not recorded')+(r.baseline_snapshot_version!=null?' v'+r.baseline_snapshot_version:''))+'</small><small>'+esc(total+' · '+num(r.approved_applied_change_order_count)+' approved/applied change(s)')+'</small><small>'+esc(hours+' · '+margin)+'</small><small>'+esc(comp)+'</small><small>'+esc('Source units: '+units)+'</small></div>';
      }).join('');

      host.innerHTML=summary+
        '<details open><summary>Component cost calibration</summary><div class="owner350-list" style="margin-top:8px;">'+(components||'<p class="muted">No comparable labour, material or equipment cost evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Recurring calibration patterns</summary><div class="owner350-list" style="margin-top:8px;">'+(patterns||'<p class="muted">No same-direction variance pattern appears on two or more comparable estimates.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Estimate-to-actual calibration records</summary><div class="owner350-list" style="margin-top:8px;">'+(records||'<p class="muted">No accepted estimate calibration record is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence, units and authority boundaries</summary><p class="muted">'+esc(c.baseline_boundary||'')+'</p><p class="muted">'+esc(c.unit_boundary||'')+'</p><p class="muted">'+esc(c.change_order_boundary||'')+'</p><p class="muted">'+esc(c.margin_boundary||'')+'</p><p class="muted">'+esc(c.actuals_boundary||'')+'</p><p class="muted">'+esc(c.authority_boundary||'')+'</p></details>';
    }


    function renderCompletedCashConversion(){
      const host=$('owner368CashCycle');if(!host)return;
      const c=state.data?.completed_to_invoiced_cycle_time_cash_conversion;
      const meta=metricMeta('completed_invoiced_cash_conversion');
      if(!allowed('jobs')||!allowed('finance')){host.innerHTML='<p class="muted">Completed-to-invoiced cash-conversion evidence requires both Jobs and Finance visibility for this profile.</p>';return}
      if(!c||!c.summary){host.innerHTML='<p class="muted">Completed-to-invoiced cash-conversion evidence is unavailable from this response.</p>';return}
      if(c.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical cash-conversion source queries failed. Cycle-time values are withheld rather than converted into zero-valued facts.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){host.innerHTML='<p class="muted">'+esc(meta.reason||'Required cash-conversion evidence is unavailable.')+'</p>';return}

      const x=c.summary||{};
      const measure=(v,suffix)=>v==null?'Unavailable':num(v)+(suffix||'');
      const summary='<div class="owner351-summary">'+[
        card('Completed / approved',num(x.completed_or_approved_closeouts),'recorded lifecycle starts','completed_invoiced_cash_conversion'),
        card('Invoice ready',num(x.invoice_ready_count),num(x.invoice_ready_not_invoiced_count)+' ready but not invoiced','completed_invoiced_cash_conversion'),
        card('Invoiced',num(x.invoiced_count),money(x.recorded_invoiced_value_total)+' recorded invoice value','completed_invoiced_cash_conversion'),
        card('Collected',num(x.fully_collected_with_payment_evidence_count),money(x.recorded_fully_collected_invoice_value_total)+' with payment evidence','completed_invoiced_cash_conversion'),
        card('Completion → invoice',measure(x.average_completion_to_invoice_hours,' h'),'average only where both timestamps exist','completed_invoiced_cash_conversion'),
        card('Invoice → collection',measure(x.average_invoice_to_collection_days,' d'),money(x.recorded_open_balance_total)+' recorded open balance','completed_invoiced_cash_conversion')
      ].join('')+'</div>';

      const stageLabel={completed_not_invoice_ready:'Completed / closeout, not invoice ready',invoice_ready_not_invoiced:'Invoice ready, not invoiced',invoiced_open:'Invoiced, balance open'};
      const bucketLabel={'0_1_days':'0–1 days','2_3_days':'2–3 days','4_7_days':'4–7 days','8_plus_days':'8+ days'};
      const cohorts=(c.aging_cohorts||[]).filter(r=>Number(r.count||0)>0).map(r=>
        '<div class="owner350-row" data-owner368-cohort="'+esc((r.stage||'')+':'+(r.age_bucket||''))+'"><strong>'+esc((stageLabel[r.stage]||String(r.stage||'stage').replaceAll('_',' '))+' · '+(bucketLabel[r.age_bucket]||r.age_bucket||'age unavailable'))+'</strong><small>'+esc(num(r.count)+' record(s) · invoice value '+money(r.invoice_value_total)+' · open balance '+money(r.open_balance_total))+'</small></div>'
      ).join('');

      const records=(c.cycle_records||[]).slice(0,36).map(r=>{
        const stage=String(r.current_stage||'recorded').replaceAll('_',' ');
        const age=r.current_stage==='collected'?'collected':(r.current_stage_age_days==null?'age unavailable':num(r.current_stage_age_days)+' day(s) in stage');
        const cycle=[
          r.completion_to_closeout_hours==null?'completion → closeout unavailable':'completion → closeout '+num(r.completion_to_closeout_hours)+' h',
          r.completion_to_invoice_ready_hours==null?'completion → invoice ready unavailable':'completion → invoice ready '+num(r.completion_to_invoice_ready_hours)+' h',
          r.invoice_ready_to_invoice_hours==null?'ready → invoice unavailable':'ready → invoice '+num(r.invoice_ready_to_invoice_hours)+' h',
          r.completion_to_invoice_hours==null?'completion → invoice unavailable':'completion → invoice '+num(r.completion_to_invoice_hours)+' h',
          r.invoice_to_first_payment_days==null?'invoice → first payment unavailable':'invoice → first payment '+num(r.invoice_to_first_payment_days)+' d',
          r.invoice_to_collection_days==null?'invoice → collection unavailable':'invoice → collection '+num(r.invoice_to_collection_days)+' d'
        ].join(' · ');
        const milestones=[
          'completion '+when(r.completion_at),
          'closeout '+when(r.closeout_approved_at),
          'ready '+when(r.invoice_ready_at),
          'invoice '+when(r.invoice_created_at),
          'first payment '+when(r.first_payment_at),
          'collection '+when(r.collection_at)
        ].join(' · ');
        return '<div class="owner350-row" data-owner368-record="'+esc(String(r.work_order_id||''))+'"><strong>'+esc((r.work_order_number||'Work order')+' · '+(r.invoice_number||'No A/R invoice'))+'</strong><small>'+esc((r.client_name||'Client unavailable')+(r.site_name?' · '+r.site_name:'')+' · '+stage+' · '+age)+'</small><small>'+esc(cycle)+'</small><small>'+esc(milestones)+'</small><small>'+esc('payments '+num(r.payment_application_count)+' · applied '+money(r.payment_applied_total)+' · balance '+(r.invoice_balance_due==null?'unavailable':money(r.invoice_balance_due)))+'</small></div>';
      }).join('');

      host.innerHTML=summary+
        '<details open><summary>Aging cohorts</summary><div class="owner350-list" style="margin-top:8px;">'+(cohorts||'<p class="muted">No open completed-to-cash aging cohort is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Recorded cycle traces</summary><div class="owner350-list" style="margin-top:8px;">'+(records||'<p class="muted">No completed or approved-closeout cash-conversion record is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Timing and authority boundaries</summary><p class="muted">'+esc(c.completion_boundary||'')+'</p><p class="muted">'+esc(c.closeout_boundary||'')+'</p><p class="muted">'+esc(c.invoice_readiness_boundary||'')+'</p><p class="muted">'+esc(c.invoice_boundary||'')+'</p><p class="muted">'+esc(c.payment_boundary||'')+'</p><p class="muted">'+esc(c.aging_boundary||'')+'</p><p class="muted">'+esc(c.authority_boundary||'')+'</p></details>';
    }

    function renderUtilizationSupport(){
      const host=$('owner357Utilization');if(!host)return;
      const w=state.data?.labour_equipment_fleet_utilization_support;
      const meta=metricMeta('utilization_support');
      if(!allowed('jobs')||!allowed('admin')){host.innerHTML='<p class="muted">Utilization decision support requires Jobs visibility and Admin management access so crew-level paid-time evidence stays permission scoped.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Labour, equipment and fleet utilization evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical utilization source queries failed. Utilization counts are withheld rather than converted into zero-valued facts.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){
        host.innerHTML='<p class="muted">'+esc(meta.reason||'Required utilization evidence is unavailable.')+'</p>';return
      }
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Paid time, 30d',Number(s.paid_hours||0).toFixed(1)+' h','recorded paid time','utilization_support'),
        card('Job-linked paid time',Number(s.job_linked_paid_hours||0).toFixed(1)+' h','paid time linked to job/session evidence','utilization_support'),
        card('Paid time without job link',Number(s.paid_hours_without_job_link||0).toFixed(1)+' h','recording/assignment evidence to review','utilization_support'),
        card('Production labour',Number(s.production_labour_hours||0).toFixed(1)+' h','recorded production crew-hours','utilization_support'),
        card('Equipment with recorded use',num(s.equipment_with_recent_recorded_use),num(s.equipment_asset_count)+' loaded asset(s)','utilization_support'),
        card('Fleet known available',num(s.fleet_known_available),num(s.fleet_asset_count)+' fleet asset(s)','utilization_support'),
        card('Fleet downtime',num(s.fleet_downtime_assets),'recorded downtime evidence','utilization_support'),
        card('Maintenance attention',num(s.maintenance_attention_assets),'due / due-soon / overdue assets','utilization_support')
      ].join('')+'</div>';
      const crews=(w.crew_utilization||[]).slice(0,30).map(r=>{
        const coverage=r.job_link_coverage_percent==null?'job-link coverage unavailable':Number(r.job_link_coverage_percent).toFixed(1)+'% job-link coverage';
        return '<div class="owner350-row"><strong>'+esc(r.crew_name||'Unassigned / not recorded')+'</strong><small>'+esc(Number(r.paid_hours||0).toFixed(1)+' paid h · '+Number(r.job_linked_paid_hours||0).toFixed(1)+' job-linked h · '+Number(r.travel_hours||0).toFixed(1)+' travel h')+'</small><small>'+esc(Number(r.production_labour_hours||0).toFixed(1)+' production h · '+num(r.dispatch_item_count)+' dispatch item(s) · '+coverage)+'</small></div>';
      }).join('');
      const queue=(w.attention_queue||[]).slice(0,30).map(r=>{
        const label=String(r.signal_type||'review').replaceAll('_',' ');
        return '<div class="owner350-row"><strong>'+esc(label.toUpperCase()+' · '+(r.equipment_code||r.equipment_name||'Asset'))+'</strong><small>'+esc(r.equipment_name||'')+'</small><small>'+esc(r.detail||'')+'</small><small>'+esc(r.suggested_next_action||'Review source evidence')+'</small><button class="secondary" style="margin-top:6px;" data-owner357-open="operations">Open Operations</button></div>';
      }).join('');
      const fleet=(w.fleet_availability||[]).slice(0,20).map(r=>{
        const state=[
          r.fleet_operational_status?'operations '+r.fleet_operational_status:'',
          r.fleet_readiness_status?'readiness '+r.fleet_readiness_status:'',
          r.locked_out?'locked out':'',
          r.fleet_downtime?'downtime':'',
          r.last_recorded_use_at?'last recorded use '+when(r.last_recorded_use_at):'no recorded use timestamp'
        ].filter(Boolean).join(' · ');
        return '<div class="owner350-row"><strong>'+esc((r.equipment_code||'Fleet asset')+' · '+(r.equipment_name||''))+'</strong><small>'+esc(state)+'</small></div>';
      }).join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Crew-level recording context</summary><div class="owner350-list">'+(crews||'<p class="muted">No crew-level paid-time/production evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;" open><summary>Utilization, downtime &amp; maintenance signals</summary><div class="owner350-list">'+(queue||'<p class="muted">No equipment/fleet utilization attention signal is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Fleet availability evidence</summary><div class="owner350-list">'+(fleet||'<p class="muted">No fleet asset evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence boundaries</summary><p class="muted">'+esc(w.labour_boundary||'')+'</p><p class="muted">'+esc(w.equipment_boundary||'')+'</p><p class="muted">'+esc(w.safety_boundary||'')+'</p><p class="muted">'+esc(w.maintenance_boundary||'')+'</p><p class="muted">'+esc(w.privacy_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }




    function renderEquipmentDowntimeReplacementReadiness(){
      const host=$('owner370EquipmentLifecycle');if(!host)return;
      const w=state.data?.equipment_downtime_cost_replacement_readiness;
      const meta=metricMeta('equipment_downtime_replacement_readiness');
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Equipment lifecycle evidence requires Jobs visibility for this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Equipment downtime, cost and replacement-readiness evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical equipment lifecycle source queries failed. Downtime/cost results are withheld rather than converted into zero-valued facts.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){host.innerHTML='<p class="muted">'+esc(meta.reason||'Required equipment lifecycle evidence is unavailable.')+'</p>';return}

      const x=w.summary||{};
      const financeContext=allowed('finance')?num(x.assets_with_finance_job_cost_context):'Unavailable';
      const summary='<div class="owner351-summary">'+[
        card('Equipment assets',num(x.equipment_assets),num(x.lifecycle_attention_assets)+' lifecycle attention','equipment_downtime_replacement_readiness'),
        card('Lockout / downtime',num(x.locked_out_assets)+' / '+num(x.current_fleet_downtime_assets),'current recorded constraints','equipment_downtime_replacement_readiness'),
        card('Downtime, 365d',num(x.recorded_downtime_hours_365)+' h',num(x.repeated_downtime_assets)+' asset(s) with repeated events','equipment_downtime_replacement_readiness'),
        card('Repeated maintenance',num(x.repeated_maintenance_assets),num(x.open_service_task_assets)+' asset(s) with open service tasks','equipment_downtime_replacement_readiness'),
        card('Replacement state',num(x.recorded_replacement_plan_assets)+' plan / '+num(x.recorded_replacement_hold_assets)+' hold','existing registry state only','equipment_downtime_replacement_readiness'),
        card('Recorded service cost',money(x.recorded_service_cost_total_all_time),'registry all-time service rollup','equipment_downtime_replacement_readiness'),
        card('Recorded replacement estimate',money(x.recorded_replacement_estimated_cost_total),'only assets already carrying plan/replace state','equipment_downtime_replacement_readiness'),
        card('Finance job context',financeContext,allowed('finance')?'linked job-level context; not asset-attributed':'Finance module unavailable.','equipment_downtime_replacement_readiness')
      ].join('')+'</div>';

      const attention=(w.lifecycle_attention||[]).slice(0,50).map(r=>{
        const state=String(r.lifecycle_review_state||'recorded').replaceAll('_',' ');
        const signals=(r.lifecycle_review_signals||[]).join(' · ')||'no recorded lifecycle attention signal';
        const downtime=[
          num(r.downtime_event_count_365)+' downtime event(s)',
          num(r.recorded_downtime_hours_365)+' recorded h',
          r.current_fleet_downtime?'current fleet downtime '+(r.current_fleet_downtime_hours==null?'age unavailable':num(r.current_fleet_downtime_hours)+' h'):'',
          r.locked_out?'locked out '+(r.lockout_age_days==null?'age unavailable':num(r.lockout_age_days)+' d'):''
        ].filter(Boolean).join(' · ');
        const maintenance=[
          num(r.maintenance_history_count_365)+' maintenance history event(s) / '+money(r.maintenance_history_cost_365),
          num(r.service_task_count_365)+' service task(s) / '+money(r.service_task_actual_cost_365)+' actual',
          num(r.open_service_task_count_365)+' open task(s) / '+money(r.open_service_estimated_cost_365)+' recorded estimate'
        ].join(' · ');
        const lifecycle=[
          'acquisition '+(r.acquisition_cost==null?'unavailable':money(r.acquisition_cost)),
          'recorded service '+(r.recorded_service_cost_total_all_time==null?'unavailable':money(r.recorded_service_cost_total_all_time)),
          'recorded lifecycle '+(r.recorded_lifecycle_cost_total==null?'unavailable':money(r.recorded_lifecycle_cost_total)),
          r.service_cost_to_acquisition_percent==null?'service/acquisition ratio unavailable':'service/acquisition '+pct(r.service_cost_to_acquisition_percent)
        ].join(' · ');
        const replacement=[
          'replacement state '+(r.replacement_state||'not recorded'),
          r.replacement_target_date?'target '+r.replacement_target_date:'',
          r.replacement_estimated_cost==null?'':'recorded estimate '+money(r.replacement_estimated_cost)
        ].filter(Boolean).join(' · ');
        const jobs=allowed('finance')&&(r.linked_job_cost_context||[]).length
          ?(r.linked_job_cost_context||[]).slice(0,5).map(j=>{
              const bits=[
                j.job_equipment_repair_cost_total==null?'':'job repair '+money(j.job_equipment_repair_cost_total),
                j.equipment_repair_event_cost_total==null?'':'repair events '+money(j.equipment_repair_event_cost_total),
                j.equipment_replacement_cost_total==null?'':'replacement '+money(j.equipment_replacement_cost_total),
                j.job_delay_cost_total==null?'':'delay '+money(j.job_delay_cost_total)
              ].filter(Boolean).join(' · ');
              return (j.job_code||j.job_name||'Linked job')+(bits?' · '+bits:'');
            }).join(' | ')
          :(allowed('finance')?'no linked job-level Finance cost context':'Finance context unavailable');
        return '<div class="owner350-row" data-owner370-asset="'+esc(String(r.equipment_item_id||r.equipment_code||''))+'"><strong>'+esc((r.equipment_code||'Equipment')+' · '+(r.equipment_name||'')+' · '+state)+'</strong><small>'+esc(signals)+'</small><small>'+esc(downtime)+'</small><small>'+esc(maintenance)+'</small><small>'+esc(lifecycle)+'</small><small>'+esc(replacement)+'</small><small>'+esc('Job-cost context: '+jobs)+'</small></div>';
      }).join('');

      const assets=(w.asset_evidence||[]).slice(0,60).map(r=>{
        const state=String(r.lifecycle_review_state||'recorded').replaceAll('_',' ');
        return '<div class="owner350-row" data-owner370-evidence="'+esc(String(r.equipment_item_id||r.equipment_code||''))+'"><strong>'+esc((r.equipment_code||'Equipment')+' · '+(r.equipment_name||'')+'</strong><small>'+esc(state+' · downtime events '+num(r.downtime_event_count_365)+' · maintenance/service '+num(Number(r.maintenance_history_count_365||0)+Number(r.service_task_count_365||0))+' · signouts '+num(r.signout_count_365))+'</small><small>'+esc('readiness '+(r.registry_readiness_status||'not recorded')+' · replacement '+(r.replacement_state||'not recorded')+' · last use '+(r.last_recorded_use_at?when(r.last_recorded_use_at):'not recorded'))+'</small></div>';
      }).join('');

      host.innerHTML=summary+
        '<details open style="margin-top:8px;"><summary>Lifecycle attention evidence</summary><div class="owner350-list" style="margin-top:8px;">'+(attention||'<p class="muted">No recorded lifecycle attention signal is visible in the loaded equipment evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>All loaded equipment evidence</summary><div class="owner350-list" style="margin-top:8px;">'+(assets||'<p class="muted">No equipment registry evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Downtime, cost, replacement &amp; authority boundaries</summary><p class="muted">'+esc(w.downtime_boundary||'')+'</p><p class="muted">'+esc(w.maintenance_boundary||'')+'</p><p class="muted">'+esc(w.cost_boundary||'')+'</p><p class="muted">'+esc(w.replacement_boundary||'')+'</p><p class="muted">'+esc(w.safety_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }

    function renderLabourCapturePayrollExceptions(){
      const host=$('owner369LabourCapture');if(!host)return;
      const w=state.data?.labour_capture_completeness_payroll_exception_reduction;
      const meta=metricMeta('labour_capture_payroll_exceptions');
      if(!allowed('jobs')||!allowed('admin')){host.innerHTML='<p class="muted">Labour-capture completeness requires Jobs visibility and Admin management access so payroll evidence remains permission scoped.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Labour-capture and payroll-exception evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical labour/payroll source queries failed. Coverage and exception results are withheld rather than converted into zero-valued facts.</p>';return}
      if(meta&&['unavailable','missing'].includes(String(meta.state||''))){host.innerHTML='<p class="muted">'+esc(meta.reason||'Required labour/payroll evidence is unavailable.')+'</p>';return}

      const x=w.summary||{};
      const rate=x.payroll_evidence_completion_rate_percent==null?'Unavailable':pct(x.payroll_evidence_completion_rate_percent);
      const recent=x.recent_exception_rate_percent==null?'Unavailable':pct(x.recent_exception_rate_percent);
      const prior=x.prior_exception_rate_percent==null?'Unavailable':pct(x.prior_exception_rate_percent);
      const change=x.exception_rate_change_percentage_points==null?'Not comparable':((Number(x.exception_rate_change_percentage_points)>0?'+':'')+num(x.exception_rate_change_percentage_points)+' pp');
      const summary='<div class="owner351-summary">'+[
        card('Work units',num(x.work_units),'crew/job/service-date units','labour_capture_payroll_exceptions'),
        card('Payroll-ready coverage',rate,num(x.complete_payroll_evidence_work_units)+' complete unit(s)','labour_capture_payroll_exceptions'),
        card('Missing time capture',num(x.missing_time_capture_work_units),'no matching time entry','labour_capture_payroll_exceptions'),
        card('Open shifts',num(x.open_shift_work_units),'canonical payroll readiness','labour_capture_payroll_exceptions'),
        card('Corrections / review',num(x.correction_pending_work_units)+' / '+num(x.attendance_review_work_units),'pending correction / attendance review','labour_capture_payroll_exceptions'),
        card('Recent exception rate',recent,'prior '+prior+' · change '+change,'labour_capture_payroll_exceptions')
      ].join('')+'</div>';

      const reduction='<div class="owner350-row"><strong>Recorded exception-rate movement</strong><small>'+esc((w.recent_period?.start_date||'')+' → '+(w.recent_period?.end_date||'')+' · '+recent+' exception rate · '+num(w.recent_period?.work_units)+' work unit(s)')+'</small><small>'+esc((w.prior_period?.start_date||'')+' → '+(w.prior_period?.end_date||'')+' · '+prior+' exception rate · '+num(w.prior_period?.work_units)+' work unit(s)')+'</small><small>'+esc('Movement: '+String(w.exception_reduction_state||'not_comparable').replaceAll('_',' ')+' · '+change)+'</small></div>';

      const patterns=(w.repeated_patterns||[]).slice(0,40).map(r=>
        '<div class="owner350-row" data-owner369-pattern="'+esc((r.crew_id||r.crew_name||'')+':'+(r.job_id||r.job_code||'')+':'+(r.capture_state||''))+'"><strong>'+esc((r.crew_name||'Unassigned / not recorded')+' · '+(r.job_code||r.job_name||'Job not recorded'))+'</strong><small>'+esc(String(r.capture_state||'review').replaceAll('_',' ')+' · '+num(r.occurrence_count)+' occurrence(s) · '+(r.first_service_date||'')+' → '+(r.last_service_date||''))+'</small><small>'+esc('open reviews '+num(r.open_review_count)+' · pending corrections '+num(r.pending_correction_count)+' · explicit late-coded exceptions '+num(r.explicit_late_exception_count))+'</small></div>'
      ).join('');

      const evidence=(w.work_unit_evidence||[]).slice(0,50).map(r=>{
        const state=String(r.capture_state||'unknown').replaceAll('_',' ');
        const payroll=r.capture_complete?'payroll-ready evidence complete':'payroll evidence requires review';
        const codes=(r.open_review_codes||[]).join(', ')||'no open review code';
        return '<div class="owner350-row" data-owner369-evidence="'+esc((r.job_id||r.job_code||'')+':'+(r.service_date||'')+':'+(r.crew_id||r.crew_name||''))+'"><strong>'+esc((r.service_date||'Date unavailable')+' · '+(r.crew_name||'Unassigned / not recorded')+' · '+(r.job_code||r.job_name||'Job not recorded'))+'</strong><small>'+esc(state+' · '+payroll+' · '+num(r.time_entry_count)+' time entr'+(num(r.time_entry_count)===1?'y':'ies'))+'</small><small>'+esc(num(r.paid_hours)+' paid h · '+num(r.job_work_hours)+' job-work h · '+num(r.production_labour_hours)+' Production labour h')+'</small><small>'+esc('open reviews '+num(r.open_review_count)+' · pending corrections '+num(r.pending_correction_count)+' · explicit late-coded '+num(r.explicit_late_exception_count)+' · '+codes)+'</small></div>';
      }).join('');

      host.innerHTML=summary+
        '<div class="owner350-list" style="margin-top:8px;">'+reduction+'</div>'+
        '<details open style="margin-top:8px;"><summary>Repeated crew/job exception patterns</summary><div class="owner350-list" style="margin-top:8px;">'+(patterns||'<p class="muted">No same crew/job exception pattern appears at least twice in the loaded 30-day evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Crew/job/service-date evidence</summary><div class="owner350-list" style="margin-top:8px;">'+(evidence||'<p class="muted">No eligible completed-day work evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Matching, lateness, privacy &amp; authority boundaries</summary><p class="muted">'+esc(w.matching_boundary||'')+'</p><p class="muted">'+esc(w.late_boundary||'')+'</p><p class="muted">'+esc(w.reduction_boundary||'')+'</p><p class="muted">'+esc(w.privacy_boundary||'')+'</p><p class="muted">'+esc(w.safety_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }

    function renderStockReadiness(){
      const host=$('owner358Stock');if(!host)return;
      const w=state.data?.materials_consumables_seasonal_stock_readiness;
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Materials and seasonal stock readiness requires Jobs visibility for this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Materials and seasonal stock readiness evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical stock-readiness source queries failed. Shortage and reorder counts are withheld rather than converted into zero-valued facts.</p>';return}
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Tracked materials',num(s.tracked_material_count),num(s.active_material_count)+' active catalog item(s)'),
        card('Quantified 14-day demand',num(s.materials_with_quantified_14_day_demand),'materials with unit-compatible scheduled plans'),
        card('Shortage ≤7 days',num(s.shortage_within_7_days),'definite from comparable recorded units'),
        card('Shortage ≤14 days',num(s.shortage_within_14_days),'definite from comparable recorded units'),
        card('Reorder review',num(s.reorder_review_count),'recorded/current projected reorder point'),
        card('Unit comparison needed',num(s.unit_comparison_required_count),'no hidden conversion performed'),
        card('Recurring demand unquantified',num(s.recurring_visits_without_quantified_material_plan),num(s.recurring_visit_count_14_days)+' upcoming recurring visit(s)'),
        card('Unscheduled material lines',num(s.unscheduled_material_plan_line_count),'planned lines outside active 14-day dispatch evidence')
      ].join('')+'</div>';
      const queue=(w.attention_queue||[]).slice(0,30).map(r=>{
        const qty=r.stock_on_hand==null?'stock not tracked':Number(r.stock_on_hand).toFixed(2)+' '+(r.stock_unit||'');
        const d14=r.planned_demand_14==null?'14-day demand not comparable':Number(r.planned_demand_14).toFixed(2)+' '+(r.stock_unit||'')+' planned in 14d';
        const date=r.shortage_date?' · shortage '+r.shortage_date:'';
        return '<div class="owner350-row"><strong>'+esc(String(r.signal_type||'review').replaceAll('_',' ').toUpperCase()+' · '+(r.sku||r.item_name||'Material'))+'</strong><small>'+esc((r.item_name||'')+' · '+(r.seasonal_bucket||'four_season').replaceAll('_',' / '))+'</small><small>'+esc(qty+' · '+d14+date)+'</small><small>'+esc(r.detail||'')+'</small><small>'+esc(r.suggested_next_action||'Review Materials Control evidence')+'</small><button class="secondary" style="margin-top:6px;" data-owner358-open="jobs">Open Materials</button></div>';
      }).join('');
      const seasons=(w.seasonal_summary||[]).map(r=>'<div class="owner350-row"><strong>'+esc(String(r.season||'four_season').replaceAll('_',' / '))+'</strong><small>'+esc(num(r.material_count)+' material(s) · '+num(r.attention_count)+' attention · '+num(r.shortage_count)+' shortage · '+num(r.reorder_review_count)+' reorder review · '+num(r.unit_comparison_required_count)+' unit comparison')+'</small></div>').join('');
      const recurring=(w.recurring_demand_coverage||[]).filter(r=>r.material_plan_coverage!=='quantified').slice(0,20).map(r=>'<div class="owner350-row"><strong>'+esc((r.agreement_code||'Recurring visit')+' · '+(r.service_name||r.service_program_type||'service'))+'</strong><small>'+esc((r.service_date||'date unavailable')+' · quantified material plan not linked')+'</small></div>').join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Shortage &amp; reorder review queue</summary><div class="owner350-list">'+(queue||'<p class="muted">No stock-readiness attention signal is visible in the loaded comparable evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;" open><summary>Four-season stock context</summary><div class="owner350-list">'+(seasons||'<p class="muted">No seasonal stock classification evidence is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Recurring demand coverage gaps</summary><div class="owner350-list">'+(recurring||'<p class="muted">Every loaded upcoming recurring visit with material demand has quantified plan coverage, or no recurring visits are loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Evidence boundaries</summary><p class="muted">'+esc(w.demand_boundary||'')+'</p><p class="muted">'+esc(w.recurring_boundary||'')+'</p><p class="muted">'+esc(w.unit_boundary||'')+'</p><p class="muted">'+esc(w.seasonal_boundary||'')+'</p><p class="muted">'+esc(w.purchasing_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }


    function renderCommunicationReadiness(){
      const host=$('owner359Communications');if(!host)return;
      const w=state.data?.customer_communication_readiness_queue;
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Customer communication readiness requires Jobs visibility for this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Customer communication readiness evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical communication source queries failed. Queue counts are withheld rather than converted into zero-valued facts.</p>';return}
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Ready for review',num(s.queue_count),'deduplicated candidates','communication_readiness'),
        card('Weather / workability',num(s.weather_workability_changes),'recorded decision changes','communication_readiness'),
        card('Reschedule / ETA',num(s.reschedule_notices)+num(s.eta_changes),'schedule-change candidates','communication_readiness'),
        card('Completion follow-up',num(s.completion_followups),'no later outbound CRM interaction','communication_readiness'),
        card('Recurring notices',num(s.recurring_service_notices),'upcoming 14-day visits','communication_readiness'),
        card('Overdue follow-up',num(s.overdue_customer_followups),'canonical CRM follow-ups','communication_readiness'),
        card('Invoice reminders',allowed('finance')?num(s.invoice_reminder_candidates):'Unavailable','Finance-scoped overdue A/R','communication_readiness'),
        card('Merged multi-source',num(s.merged_multi_source_count),'duplicate schedule/workability signals collapsed','communication_readiness')
      ].join('')+'</div>';
      const queue=(w.readiness_queue||[]).slice(0,40).map(r=>{
        const labels=(r.signal_types||[r.signal_type]).map(x=>String(x||'').replaceAll('_',' ')).join(' + ');
        const context=(r.message_context||[]).join(' · ');
        const target=r.navigation_target==='finance'?'finance':r.navigation_target==='jobs'?'jobs':'operations';
        return '<div class="owner350-row"><strong>'+esc(labels.toUpperCase())+'</strong><small>'+esc(context||r.detail||'')+'</small><small>'+esc(r.detail||'')+'</small><small>'+esc('Sources: '+num(r.source_link_count)+' · key '+(r.dedupe_key||''))+'</small><button class="secondary" style="margin-top:6px;" data-owner359-open="'+esc(target)+'">Open source workspace</button></div>';
      }).join('');
      const delivery=(w.delivery_attention||[]).slice(0,20).map(r=>'<div class="owner350-row"><strong>'+esc(String(r.delivery_status||'review').replaceAll('_',' ').toUpperCase()+' · '+(r.work_order_number||'Work order'))+'</strong><small>'+esc((r.client_name||'Customer')+' · '+(r.live_update_title||'customer-visible update'))+'</small><small>'+esc(r.detail||'')+'</small></div>').join('');
      host.innerHTML=summary+
        '<details style="margin-top:10px;" open><summary>Communication readiness queue</summary><div class="owner350-list">'+(queue||'<p class="muted">No communication-readiness candidate is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Protected delivery attention</summary><div class="owner350-list">'+(delivery||'<p class="muted">No failed/manual-review/retry delivery state is loaded.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Queue-quality boundaries</summary><p class="muted">'+esc(w.duplicate_boundary||'')+'</p><p class="muted">'+esc(w.context_boundary||'')+'</p><p class="muted">'+esc(w.completion_boundary||'')+'</p><p class="muted">'+esc(w.recurring_boundary||'')+'</p><p class="muted">'+esc(w.finance_boundary||'')+'</p><p class="muted">'+esc(w.delivery_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
    }


    function renderDataQualityReconciliation(){
      const host=$('owner360DataQuality');if(!host)return;
      const w=state.data?.data_quality_duplicate_orphan_reconciliation;
      if(!allowed('jobs')){host.innerHTML='<p class="muted">Data-quality reconciliation requires Jobs / Business &amp; Operations visibility for this profile.</p>';return}
      if(!w||!w.summary){host.innerHTML='<p class="muted">Data-quality reconciliation evidence is unavailable from this response.</p>';return}
      if(w.source_queries_ok===false){host.innerHTML='<p class="muted">One or more canonical data-quality source queries failed. Reconciliation counts are withheld rather than converted into zero-valued facts.</p>';return}
      const s=w.summary||{};
      const summary='<div class="owner351-summary">'+[
        card('Signals',num(s.total_signals),'review candidates','data_quality_reconciliation'),
        card('Duplicate customers',num(s.duplicate_customer_candidates),'candidate pairs; no identity decision','data_quality_reconciliation'),
        card('Duplicate properties',num(s.duplicate_property_candidates),'candidate pairs; source IDs preserved','data_quality_reconciliation'),
        card('Broken references',w.reference_coverage_complete?num(s.broken_canonical_references):'Withheld',w.reference_coverage_complete?'complete loaded reference coverage':'one or more reference sources reached a row cap','data_quality_reconciliation'),
        card('Cross-module mismatches',w.reference_coverage_complete?num(s.cross_module_link_mismatches):'Withheld','customer/property and operational ownership links','data_quality_reconciliation'),
        card('Stale assignments',w.reference_coverage_complete?num(s.stale_assignments):'Withheld','crew membership, crew/equipment assignment','data_quality_reconciliation'),
        card('Season tag conflicts',num(s.conflicting_season_service_tags),'four-season taxonomy review','data_quality_reconciliation')
      ].join('')+'</div>';
      const queue=(w.reconciliation_queue||[]).slice(0,50).map(r=>{
        const basis=(r.match_basis||[]).map(x=>String(x).replaceAll('_',' ')).join(', ');
        const related=(r.related_entities||[]).map(x=>[x.type,x.reference||x.name||x.id].filter(Boolean).join(': ')).join(' · ');
        const target=['jobs','finance'].includes(r.navigation_target)?r.navigation_target:(r.navigation_target==='workforce'?'workforce':r.navigation_target==='crm'?'crm':'operations');
        return '<div class="owner350-row"><strong>'+esc(String(r.signal_type||'review').replaceAll('_',' ').toUpperCase()+' · '+(r.title||r.reference||'Review candidate'))+'</strong>'+
          (r.reference?'<small>'+esc('Reference: '+r.reference)+'</small>':'')+
          (basis?'<small>'+esc('Match basis: '+basis)+'</small>':'')+
          (related?'<small>'+esc('Related: '+related)+'</small>':'')+
          '<small>'+esc(r.detail||'')+'</small><small>'+esc(r.suggested_action||'Review canonical source records.')+'</small>'+
          '<button class="secondary" style="margin-top:6px;" data-owner360-open="'+esc(target)+'">Open source workspace</button></div>';
      }).join('');
      const duplicates=[...(w.duplicate_customer_pairs||[]),...(w.duplicate_property_pairs||[])].slice(0,30).map(r=>'<div class="owner350-row"><strong>'+esc(r.title||r.reference||'Duplicate candidate')+'</strong><small>'+esc((r.match_basis||[]).map(x=>String(x).replaceAll('_',' ')).join(', ')||'candidate evidence')+'</small><small>'+esc(r.detail||'')+'</small></div>').join('');
      const refs=(w.reference_and_assignment_issues||[]).slice(0,30).map(r=>'<div class="owner350-row"><strong>'+esc(String(r.signal_type||'reference issue').replaceAll('_',' ').toUpperCase()+' · '+(r.reference||r.title||'source record'))+'</strong><small>'+esc(r.detail||'')+'</small></div>').join('');
      const seasons=(w.season_tag_conflicts||[]).slice(0,20).map(r=>'<div class="owner350-row"><strong>'+esc(r.reference||r.title||'Season/service tag')+'</strong><small>'+esc(r.detail||'')+'</small></div>').join('');
      host.innerHTML=summary+
        (!w.reference_coverage_complete?'<div class="notice" style="margin:8px 0;"><strong>Reference-gap findings withheld:</strong> at least one canonical reference source reached its configured row cap. Duplicate and season-tag review may still be partial; missing rows are not treated as missing records.</div>':'')+
        '<details style="margin-top:10px;" open><summary>Reconciliation queue</summary><div class="owner350-list">'+(queue||'<p class="muted">No data-quality reconciliation signal is visible in the loaded evidence.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Duplicate customer &amp; property candidates</summary><div class="owner350-list">'+(duplicates||'<p class="muted">No duplicate candidate is visible from the deterministic matching rules.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Reference &amp; assignment issues</summary><div class="owner350-list">'+(refs||'<p class="muted">No broken/stale reference signal is visible, or reference-gap findings are withheld because coverage is incomplete.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Four-season tag conflicts</summary><div class="owner350-list">'+(seasons||'<p class="muted">No spring/summer, fall or winter service/season conflict is visible.</p>')+'</div></details>'+
        '<details style="margin-top:8px;"><summary>Reconciliation boundaries</summary><p class="muted">'+esc(w.duplicate_boundary||'')+'</p><p class="muted">'+esc(w.reference_boundary||'')+'</p><p class="muted">'+esc(w.assignment_boundary||'')+'</p><p class="muted">'+esc(w.season_boundary||'')+'</p><p class="muted">'+esc(w.destructive_boundary||'')+'</p><p class="muted">'+esc(w.audit_boundary||'')+'</p><p class="muted">'+esc(w.authority_boundary||'')+'</p></details>';
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
      renderWorkabilityRecovery();
      renderRouteCrewEfficiency();
      renderRouteSequenceLearning();
      renderRecurringRetention();
      renderRecurringOutcomes();
      renderEstimateToCash();
      renderEstimateCalibration();
      renderCompletedCashConversion();
      renderUtilizationSupport();
      renderEquipmentDowntimeReplacementReadiness();
      renderLabourCapturePayrollExceptions();
      renderStockReadiness();
      renderCommunicationReadiness();
      renderDataQualityReconciliation();
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
      window.YWIRouter?.showSection?.('admin');
      const group=target==='safety'?'safety':target==='workforce'?'people':'operations';
      setTimeout(()=>window.YWIAdminHub?.open?.(group),0);
    }
    async function load(){
      try{note('Loading owner / management evidence…');const r=await api.loadAdminDirectory({scope:'owner_management_command',limit:500})||{};if(r.ok===false)throw new Error(r.error||'Management command centre load failed.');state.data=r;render();note('Build 360 data-quality duplicate/orphan reconciliation evidence refreshed. Build 364 workability-to-schedule recovery outcomes refreshed. Source records were not changed.')}
      catch(e){state.data={source_visibility:{jobs:false,finance:false,safety:false,admin:false},source_freshness:{},management_metric_confidence:{},four_season_capacity_forecast:null,route_crew_efficiency_evidence:null,recurring_renewal_retention_workbench:null,estimate_to_cash_leakage_workbench:null,labour_equipment_fleet_utilization_support:null,materials_consumables_seasonal_stock_readiness:null,customer_communication_readiness_queue:null,data_quality_duplicate_orphan_reconciliation:null,workability_schedule_recovery_outcomes:null};render();note('Unable to load Build 364 workability schedule-recovery outcomes. Unable to load Build 360 data-quality duplicate/orphan reconciliation evidence: '+(e?.message||e),true)}
    }
    el.addEventListener('click',e=>{const b=e.target.closest('[data-owner350-open],[data-owner356-open],[data-owner357-open],[data-owner358-open],[data-owner359-open],[data-owner360-open]');if(b)openSource(b.getAttribute('data-owner350-open')||b.getAttribute('data-owner356-open')||b.getAttribute('data-owner357-open')||b.getAttribute('data-owner358-open')||b.getAttribute('data-owner359-open')||b.getAttribute('data-owner360-open'))});
    $('owner350Refresh').onclick=load;load();
  }
  window.YWIOwnerManagementCommandUI={mount};
})();