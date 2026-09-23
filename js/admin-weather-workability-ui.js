/* Build 342 — Weather & Workability Controls */
'use strict';
(function(){
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replaceAll('_',' ');
  function host(){
    const admin=$('admin'); if(!admin)return null;
    let el=$('weatherWorkability342'); if(el)return el;
    el=document.createElement('details');
    el.id='weatherWorkability342'; el.className='admin-hub-detail'; el.dataset.adminHubTitle='Weather & Workability'; el.dataset.adminHubGroups='operations'; el.open=true;
    el.innerHTML=[
      '<summary><span>Weather &amp; Workability Controls</span><small>Build 342 · supervisor decision support</small></summary>',
      '<div class="admin-panel-block" data-build="342">',
      '<div class="section-heading"><div><span class="module-kicker">Build 342 · Business &amp; Operations</span><h3>Weather &amp; Workability Controls</h3><p class="section-subtitle">Record conditions, service-specific guidance, supervisor disposition, proposed postponement/reschedule and customer-notification readiness.</p></div><button id="wk342Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Four-season Ontario model:</strong> mowing/landscaping, fall cleanup/leaf collection and winter snow clearing/removal are evaluated separately. Rain, saturated ground, heat, cold, high wind, lightning/storm, visibility, snowfall and freezing rain/ice are supported.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Decision boundary:</strong> guidance never makes an automatic safety decision. A supervisor records the disposition. Postpone/reschedule/block decisions do not alter schedule status or send a customer notification; existing dispatch/recurring actions remain authoritative.</div>',
      '<div id="wk342Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Record condition observation</h4>',
      '<div class="grid"><label>Service date<input id="wk342Date" type="date"></label><label>Service context<select id="wk342Service"><option value="mowing_landscaping">Mowing / landscaping</option><option value="fall_cleanup">Fall cleanup / leaf collection</option><option value="snow_clearing_removal">Snow clearing / removal</option><option value="general_outdoor">General outdoor</option></select></label>',
      '<label>Season<select id="wk342Season"><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option><option value="four_season">Four season</option></select></label><label>Property<select id="wk342Property"></select></label>',
      '<label>Dispatch<select id="wk342Dispatch"></select></label><label>Route<select id="wk342Route"></select></label><label>Weather summary<input id="wk342Weather" type="text"></label>',
      '<label>Temp °C<input id="wk342Temp" type="number" step="0.1"></label><label>Wind km/h<input id="wk342Wind" type="number" step="0.1"></label><label>Visibility km<input id="wk342Visibility" type="number" step="0.1"></label><label>Snowfall cm<input id="wk342Snow" type="number" step="0.1"></label>',
      '<label>Rain<select id="wk342Rain"><option value="none">None</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option><option value="recent">Recent</option></select></label><label>Ground<select id="wk342Ground"><option value="unknown">Unknown</option><option value="dry">Dry</option><option value="damp">Damp</option><option value="saturated">Saturated</option><option value="frozen">Frozen</option><option value="snow_covered">Snow covered</option><option value="icy">Icy</option></select></label>',
      '<label>Ice<select id="wk342Ice"><option value="none">None</option><option value="possible">Possible</option><option value="observed">Observed</option><option value="treated">Treated</option></select></label><label>Lightning/storm<select id="wk342Storm"><option value="none">None</option><option value="watch">Watch</option><option value="nearby">Nearby</option><option value="observed">Observed</option></select></label></div>',
      '<fieldset><legend>Condition tags</legend><label><input type="checkbox" data-wk-tag="rain"> Rain</label> <label><input type="checkbox" data-wk-tag="saturated_ground"> Saturated ground</label> <label><input type="checkbox" data-wk-tag="heat"> Heat</label> <label><input type="checkbox" data-wk-tag="cold"> Cold</label> <label><input type="checkbox" data-wk-tag="high_wind"> High wind</label> <label><input type="checkbox" data-wk-tag="lightning_storm"> Lightning/storm</label> <label><input type="checkbox" data-wk-tag="visibility"> Visibility</label> <label><input type="checkbox" data-wk-tag="snowfall"> Snowfall</label> <label><input type="checkbox" data-wk-tag="freezing_rain_ice"> Freezing rain/ice</label></fieldset>',
      '<label>Observation note<textarea id="wk342ObservationNote"></textarea></label><button id="wk342SaveObservation" class="secondary" type="button">Record Observation</button></div>',
      '<div class="admin-panel-block"><h4>Service guidance</h4><div id="wk342Rules"></div></div></div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Workability queue</h4><div id="wk342Queue"></div></div><div class="admin-panel-block"><h4>Supervisor decision</h4><div id="wk342Selected"></div>',
      '<label>Decision<select id="wk342Decision"><option value="workable">Workable</option><option value="caution">Caution</option><option value="postpone">Postpone</option><option value="reschedule">Reschedule</option><option value="blocked">Blocked</option></select></label><label>Reason<textarea id="wk342Reason"></textarea></label>',
      '<div class="grid"><label>Proposed new start<input id="wk342Start" type="datetime-local"></label><label>Proposed new end<input id="wk342End" type="datetime-local"></label><label>Notification readiness<select id="wk342Notify"><option value="not_ready">Not ready</option><option value="ready">Ready</option><option value="not_needed">Not needed</option><option value="notified">Notified elsewhere</option></select></label></div>',
      '<button id="wk342SaveDecision" class="secondary" type="button">Record Supervisor Decision</button><button id="wk342Ready" class="secondary" type="button">Mark Notification Ready</button></div></div>',
      '<div id="wk342Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    admin.appendChild(el); return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory||!api?.manageOperations)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={data:{},observationId:'',decisionId:''};const arr=(k)=>Array.isArray(state.data[k])?state.data[k]:[];
    const note=(t,b=false)=>{const n=$('wk342Status');if(n){n.textContent=t;n.classList.toggle('error',b);}};
    const fill=(id,rows,key,textFn)=>{const e=$(id);if(!e)return;e.innerHTML='<option value="">— Select —</option>'+rows.map(x=>'<option value="'+esc(x[key])+'">'+esc(textFn(x))+'</option>').join('');};
    function render(){
      const queue=arr('workability_queue'),rules=arr('workability_rules');
      $('wk342Summary').innerHTML=[['Open observations',queue.filter(x=>x.workability_queue_status==='decision_required').length],['Notification review',queue.filter(x=>x.workability_queue_status==='notification_review').length],['Operator dispatch required',queue.filter(x=>x.workability_queue_status==='operator_dispatch_required').length],['Active guidance rules',rules.length]]
        .map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      fill('wk342Property',arr('workability_properties'),'id',x=>x.site_name+' · '+(x.city||x.service_address||''));
      fill('wk342Dispatch',arr('workability_dispatch'),'id',x=>(x.work_order_number||'Dispatch')+' · '+(x.scheduled_start||'unscheduled'));
      fill('wk342Route',arr('workability_routes'),'route_id',x=>x.route_name+' · '+label(x.season_context));
      $('wk342Rules').innerHTML=rules.length?rules.map(r=>'<div class="notice"><strong>'+esc(r.rule_name)+'</strong> · '+esc(label(r.guidance_level))+'<br><small>'+esc(label(r.service_context))+' · '+esc(label(r.condition_type))+' — '+esc(r.operator_guidance)+'</small></div>').join(''):'<p class="muted">No workability guidance.</p>';
      $('wk342Queue').innerHTML=queue.length?queue.map(q=>'<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-wk-observation="'+esc(q.id)+'"><strong>'+esc(q.site_name||q.route_name||q.observation_code)+'</strong> · '+esc(label(q.service_context))+'<br><small>'+esc(q.service_date)+' · '+esc(q.weather_condition||'No weather summary')+' · '+esc(q.workability_queue_status)+'</small></button>').join(''):'<p class="muted">No observations.</p>';
      const selected=queue.find(x=>String(x.id)===String(state.observationId))||queue[0];if(selected){state.observationId=String(selected.id);state.decisionId=String(selected.latest_decision_id||'');}
      if(!selected){$('wk342Selected').innerHTML='<p class="muted">Select an observation.</p>';return;}
      const guidance=arr('workability_guidance').filter(g=>String(g.observation_id)===String(selected.id));
      $('wk342Selected').innerHTML='<div class="notice"><strong>'+esc(selected.observation_code)+'</strong> · '+esc(label(selected.service_context))+' · '+esc(label(selected.season_context))+'<br><small>Rain '+esc(selected.rain_state)+' · Ground '+esc(selected.ground_state)+' · Ice '+esc(selected.freezing_rain_ice_state)+' · Storm '+esc(selected.lightning_storm_state)+'</small></div>'+
        (guidance.length?guidance.map(g=>'<div class="notice"><strong>'+esc(g.rule_name)+'</strong> · '+esc(g.guidance_level)+'<br><small>'+esc(g.operator_guidance)+'</small></div>').join(''):'<p class="muted">No tagged guidance matched. Supervisor decision is still required.</p>')+
        (selected.decision_state?'<div class="notice"><strong>Latest decision:</strong> '+esc(label(selected.decision_state))+' · '+esc(selected.customer_notification_readiness)+'<br><small>'+esc(selected.decision_reason||'')+' · '+esc(selected.dispatch_application_status||'')+'</small></div>':'');
    }
    async function load(){note('Loading weather/workability controls…');const r=await api.loadAdminDirectory({scope:'workability',limit:1500});if(!r?.ok)return note(r?.error||'Workability load failed.',true);state.data=r;render();note('Workability controls loaded. Supervisor decision remains required.');}
    async function manage(payload,msg){const r=await api.manageOperations(payload);if(!r?.ok)return note(r?.error||'Workability update failed.',true);if(payload.action==='workability_observation_save'&&r.record?.id)state.observationId=String(r.record.id);if(payload.action==='workability_decision_save'&&r.record?.id)state.decisionId=String(r.record.id);await load();note(msg);}
    $('wk342Refresh').onclick=load;
    $('wk342Queue').onclick=(e)=>{const b=e.target.closest('[data-wk-observation]');if(!b)return;state.observationId=b.getAttribute('data-wk-observation')||'';render();};
    $('wk342SaveObservation').onclick=()=>manage({action:'workability_observation_save',service_date:$('wk342Date').value,observation_source:'supervisor',service_context:$('wk342Service').value,season_context:$('wk342Season').value,client_site_id:$('wk342Property').value||null,dispatch_schedule_item_id:$('wk342Dispatch').value||null,route_id:$('wk342Route').value||null,weather_condition:$('wk342Weather').value.trim(),temperature_c:$('wk342Temp').value,wind_kph:$('wk342Wind').value,visibility_km:$('wk342Visibility').value,snowfall_cm:$('wk342Snow').value,rain_state:$('wk342Rain').value,ground_state:$('wk342Ground').value,freezing_rain_ice_state:$('wk342Ice').value,lightning_storm_state:$('wk342Storm').value,condition_tags:[...document.querySelectorAll('[data-wk-tag]:checked')].map(x=>x.getAttribute('data-wk-tag')),observation_note:$('wk342ObservationNote').value.trim()},'Observation recorded. No automatic workability decision was made.');
    $('wk342SaveDecision').onclick=()=>{if(!state.observationId)return note('Select an observation first.',true);manage({action:'workability_decision_save',observation_id:state.observationId,decision_state:$('wk342Decision').value,decision_reason:$('wk342Reason').value.trim(),proposed_reschedule_start:$('wk342Start').value||null,proposed_reschedule_end:$('wk342End').value||null,customer_notification_readiness:$('wk342Notify').value},'Supervisor decision recorded. Schedule status and customer notification were not changed automatically.');};
    $('wk342Ready').onclick=()=>{if(!state.decisionId)return note('Record or select a supervisor decision first.',true);manage({action:'workability_notification_readiness_save',decision_id:state.decisionId,readiness_state:'ready',channel_options:['email','phone','text'],readiness_note:'Customer notification is ready for an operator to send using the existing notification workflow.'},'Customer-notification readiness recorded; no notification was sent.');};
    await load();
  }
  window.YWIWeatherWorkabilityUI={mount};
})();