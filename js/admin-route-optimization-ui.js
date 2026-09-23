/* Build 341 — Route Optimization & Territory Management */
'use strict';
(function(){
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replaceAll('_',' ');
  function host(){
    const admin=$('admin'); if(!admin)return null;
    let el=$('routeOptimization341'); if(el)return el;
    el=document.createElement('details');
    el.id='routeOptimization341'; el.className='admin-hub-detail'; el.dataset.adminHubTitle='Route Optimization & Territory'; el.dataset.adminHubGroups='operations'; el.open=true;
    el.innerHTML=[
      '<summary><span>Route Optimization &amp; Territory Management</span><small>Build 341 · advisory route planning</small></summary>',
      '<div class="admin-panel-block" data-build="341">',
      '<div class="section-heading"><div><span class="module-kicker">Build 341 · Business &amp; Operations</span><h3>Route Optimization &amp; Territory Management</h3><p class="section-subtitle">Plan recurring routes by territory, proximity, capacity, duration, time windows, equipment needs and service priority without replacing operator dispatch authority.</p></div><button id="route341Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Four-season Ontario routing:</strong> spring/summer mowing and landscaping, fall cleanup/leaf collection, and winter snow clearing/removal are first-class route contexts. Winter routes can be explicitly marked storm-event capable.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Dispatch boundary:</strong> optimization is advisory only. Accepting a proposal records operator judgment; it does not schedule crews, rewrite <code>dispatch_schedule_items</code>, or silently replace canonical <code>route_stops</code>.</div>',
      '<div id="route341Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="grid" style="margin-top:14px;">',
        '<div class="admin-panel-block"><h4>Territory &amp; route settings</h4>',
          '<div class="grid"><label>Territory name<input id="route341TerritoryName" type="text"></label>',
          '<label>Season<select id="route341TerritorySeason"><option value="four_season">Four season</option><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option></select></label>',
          '<label>Service area<select id="route341ServiceArea"></select></label>',
          '<label>Owner crew<select id="route341OwnerCrew"></select></label>',
          '<label>Route<select id="route341RouteLink"></select></label>',
          '<label>Capacity minutes<input id="route341Capacity" type="number" min="30" max="1440"></label>',
          '<label>Route priority<select id="route341RoutePriority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label>',
          '<label><input id="route341StormCapable" type="checkbox"> Winter storm-event capable</label></div>',
          '<label>Equipment requirements<input id="route341Equipment" type="text" placeholder="Truck, trailer, plow, mower…"></label>',
          '<button id="route341SaveTerritory" class="secondary" type="button">Save Territory / Route Settings</button>',
        '</div>',
        '<div class="admin-panel-block"><h4>Assign property to territory</h4>',
          '<div class="grid"><label>Territory<select id="route341TerritorySelect"></select></label><label>Property<select id="route341Property"></select></label>',
          '<label>Priority<select id="route341SitePriority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label></div>',
          '<button id="route341AssignSite" class="secondary" type="button">Assign Property</button>',
          '<div id="route341Territories" style="margin-top:10px;"></div>',
        '</div>',
      '</div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Generate advisory route proposal</h4>',
        '<div class="grid"><label>Route<select id="route341Route"></select></label><label>Service date<input id="route341Date" type="date"></label>',
        '<label>Season<select id="route341Season"><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option><option value="four_season">Four season</option></select></label>',
        '<label>Goal<select id="route341Goal"><option value="travel_efficiency">Travel efficiency</option><option value="capacity_balance">Capacity balance</option><option value="time_windows">Time windows</option><option value="service_priority">Service priority</option><option value="storm_priority">Storm priority</option></select></label>',
        '<label><input id="route341Storm" type="checkbox"> Storm-event activation</label><label>Storm event key<input id="route341StormKey" type="text" placeholder="2026-12-01-A"></label></div>',
        '<button id="route341Generate" class="secondary" type="button">Generate Proposal</button>',
      '</div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Optimization runs</h4><div id="route341Runs"></div></div><div class="admin-panel-block"><h4>Selected proposal</h4><div id="route341Stops"></div><div class="grid"><button id="route341Review" class="secondary" type="button">Mark Reviewed</button><button id="route341Accept" class="secondary" type="button">Accept Advisory Proposal</button><button id="route341Reject" class="secondary" type="button">Reject Proposal</button></div></div></div>',
      '<div id="route341Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    admin.appendChild(el); return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI; if(!api?.loadAdminDirectory||!api?.manageOperations)return;
    const el=host(); if(!el||el.dataset.mounted==='1')return; el.dataset.mounted='1';
    const state={data:{},runId:''}; const arr=(k)=>Array.isArray(state.data[k])?state.data[k]:[];
    const note=(t,b=false)=>{const n=$('route341Status');if(n){n.textContent=t;n.classList.toggle('error',b);}};
    const fill=(id,rows,valueKey,textFn,blank='— Select —')=>{const e=$(id);if(!e)return;e.innerHTML='<option value="">'+esc(blank)+'</option>'+rows.map(r=>'<option value="'+esc(r[valueKey])+'">'+esc(textFn(r))+'</option>').join('');};
    function render(){
      const territories=arr('route_territories'), routes=arr('route_planning'), runs=arr('route_optimization_runs');
      $('route341Summary').innerHTML=[['Territories',territories.length],['Routes',routes.length],['Active route proposals',runs.filter(x=>['generated','reviewed'].includes(x.run_status)).length],['Winter routes',routes.filter(x=>['winter','four_season'].includes(x.season_context)).length]]
        .map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      fill('route341ServiceArea',arr('service_areas'),'id',x=>x.name);
      fill('route341OwnerCrew',arr('route_crews'),'id',x=>x.crew_name);
      fill('route341RouteLink',routes,'route_id',x=>x.route_name+' · '+label(x.season_context));
      fill('route341TerritorySelect',territories,'id',x=>x.territory_name+' · '+label(x.season_context));
      fill('route341Property',arr('route_properties'),'id',x=>x.site_name+' · '+(x.city||x.service_address||''));
      fill('route341Route',routes,'route_id',x=>x.route_name+' · '+label(x.season_context));
      $('route341Territories').innerHTML=territories.length?territories.map(t=>'<div class="notice"><strong>'+esc(t.territory_name)+'</strong> · '+esc(label(t.season_context))+'<br><small>'+esc(t.service_area_name||'No service area')+' · '+esc(t.owner_crew_name||t.owner_name||'No owner')+' · '+esc(t.site_count)+' properties · '+esc(t.route_count)+' routes</small></div>').join(''):'<p class="muted">No territories defined.</p>';
      $('route341Runs').innerHTML=runs.length?runs.slice(0,20).map(r=>'<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-route-run="'+esc(r.id)+'"><strong>'+esc(r.route_name)+'</strong> · '+esc(r.service_date)+' · '+esc(label(r.run_status))+'<br><small>'+esc(label(r.season_context))+(r.storm_event_active?' · STORM EVENT':'')+' · '+esc(r.proposed_stop_count)+' stops · '+esc(r.capacity_status)+'</small></button>').join(''):'<p class="muted">No optimization runs yet.</p>';
      const selected=runs.find(r=>String(r.id)===String(state.runId))||runs[0];
      if(selected)state.runId=String(selected.id);
      const stops=arr('route_optimization_stops').filter(s=>String(s.run_id)===String(state.runId)).sort((a,b)=>Number(a.proposed_order)-Number(b.proposed_order));
      $('route341Stops').innerHTML=selected?[
        '<div class="notice"><strong>'+esc(selected.route_name)+'</strong> · '+esc(label(selected.run_status))+'<br><small>Dispatch authority: '+esc(selected.dispatch_application_status)+' · Service '+esc(selected.proposed_service_minutes)+' min · Travel estimate '+esc(selected.proposed_travel_minutes)+' min</small></div>',
        stops.length?stops.map(s=>'<div class="notice"><strong>#'+esc(s.proposed_order)+' '+esc(s.site_name)+'</strong> · '+esc(label(s.service_priority))+'<br><small>Current #'+esc(s.current_order??'—')+' · '+esc(s.estimated_service_minutes??'—')+' service min · '+esc(s.proximity_travel_minutes_estimate)+' proximity travel min · '+esc(s.data_quality)+'</small></div>').join(''):'<p class="muted">No proposal stops.</p>'
      ].join(''):'<p class="muted">Select a run.</p>';
    }
    async function load(){
      note('Loading route planning…'); const r=await api.loadAdminDirectory({scope:'routing',limit:1500});
      if(!r?.ok)return note(r?.error||'Routing load failed.',true); state.data=r;
      if(!arr('route_optimization_runs').some(x=>String(x.id)===String(state.runId)))state.runId=String(arr('route_optimization_runs')[0]?.id||'');
      render(); note('Route planning loaded. Optimization remains advisory.');
    }
    async function manage(payload,msg){const r=await api.manageOperations(payload);if(!r?.ok)return note(r?.error||'Routing update failed.',true);if(r.record?.id&&payload.action==='route_optimization_generate')state.runId=String(r.record.id);await load();note(msg);}
    $('route341Refresh').onclick=load;
    $('route341SaveTerritory').onclick=()=>manage({action:'route_territory_save',territory_name:$('route341TerritoryName').value.trim(),season_context:$('route341TerritorySeason').value,service_area_id:$('route341ServiceArea').value||null,owner_crew_id:$('route341OwnerCrew').value||null,route_id:$('route341RouteLink').value||null,route_capacity_minutes:$('route341Capacity').value||null,route_service_priority:$('route341RoutePriority').value,storm_event_capable:$('route341StormCapable').checked,default_equipment_requirements:$('route341Equipment').value.trim()},'Territory and route planning settings saved.');
    $('route341AssignSite').onclick=()=>manage({action:'route_territory_site_save',territory_id:$('route341TerritorySelect').value,client_site_id:$('route341Property').value,service_priority:$('route341SitePriority').value,preferred_route_id:$('route341RouteLink').value||null},'Property assigned to territory.');
    $('route341Generate').onclick=()=>manage({action:'route_optimization_generate',route_id:$('route341Route').value,service_date:$('route341Date').value,season_context:$('route341Season').value,optimization_goal:$('route341Goal').value,storm_event_active:$('route341Storm').checked,storm_event_key:$('route341StormKey').value.trim()},'Advisory route proposal generated.');
    $('route341Runs').onclick=(e)=>{const b=e.target.closest('[data-route-run]');if(!b)return;state.runId=b.getAttribute('data-route-run')||'';render();};
    const decide=(s)=>{if(!state.runId)return note('Select an optimization run first.',true);manage({action:'route_optimization_decision',id:state.runId,run_status:s,decision_note:'Recorded from Build 341 route planning workbench.'},'Proposal decision recorded. Dispatch was not changed.');};
    $('route341Review').onclick=()=>decide('reviewed'); $('route341Accept').onclick=()=>decide('accepted'); $('route341Reject').onclick=()=>decide('rejected');
    await load();
  }
  window.YWIRouteOptimizationUI={mount};
})();