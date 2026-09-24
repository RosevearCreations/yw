(()=>{
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase());
  const SEASONS=[['spring_summer','Spring / summer'],['fall','Fall cleanup'],['winter','Winter snow operations'],['four_season','Four-season']];
  const optionRows=(rows)=>rows.map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('');

  function host(){
    const admin=$('admin'); if(!admin) return null;
    let el=$('seasonalOperations346'); if(el) return el;
    el=document.createElement('section'); el.id='seasonalOperations346'; el.className='admin-panel'; el.dataset.adminHubGroups='operations';
    el.innerHTML=[
      '<h3>Build 346 — Seasonal Operations Centre</h3>',
      '<p class="muted">Coordinate recurring-customer rollover, seasonal staffing, equipment conversion/service, materials stock, storm routes, workability, checklists and outstanding work without replacing the underlying modules.</p>',
      '<div class="notice"><strong>Winter is core operations:</strong> snow-clearing/removal is not an optional season. Storm events exist only inside winter cycles and only canonical winter/four-season routes already marked storm-event capable may activate.</div>',
      '<div class="notice"><strong>Authority boundary:</strong> this centre records readiness and coordination. Recurring agreements, workforce, preventive maintenance, materials stock, route planning/dispatch and workability remain authoritative.</div>',
      '<div id="seasonal346Summary" class="admin-backbone-grid" style="margin-top:10px;"></div>',

      '<div class="admin-panel-block"><h4>Season cycle</h4>',
      '<div class="grid"><label>Cycle<select id="seasonal346Cycle"><option value="">— New cycle —</option></select></label>',
      '<label>Year<input id="seasonal346Year" type="number" min="2020" max="2100"></label>',
      '<label>Season<select id="seasonal346Season">'+optionRows(SEASONS)+'</select></label>',
      '<label>Status<select id="seasonal346CycleStatus"><option value="planning">Planning</option><option value="readiness">Readiness</option><option value="ready">Ready</option><option value="active">Active</option><option value="closeout">Closeout</option><option value="complete">Complete</option><option value="archived">Archived</option></select></label></div>',
      '<div class="grid"><label>Cycle name<input id="seasonal346CycleName" type="text"></label><label>Start<input id="seasonal346Start" type="date"></label><label>End<input id="seasonal346End" type="date"></label><label>Priority<select id="seasonal346Priority"><option value="core">Core</option><option value="supporting">Supporting</option></select></label></div>',
      '<label>Operations note<textarea id="seasonal346CycleNote" rows="2"></textarea></label>',
      '<button id="seasonal346CycleSave" class="secondary" type="button">Save / Start Seasonal Cycle</button></div>',

      '<div class="admin-panel-block"><h4>Seasonal checklist</h4><div id="seasonal346Checklist"></div></div>',

      '<div class="admin-panel-block"><h4>Readiness review</h4>',
      '<div class="grid"><label>Type<select id="seasonal346ReadinessType"><option value="customer_rollover">Customer rollover</option><option value="staffing">Staffing</option><option value="equipment">Equipment</option><option value="material">Material / stock</option><option value="route">Route</option><option value="safety">Safety</option><option value="communications">Communications</option><option value="general">General</option></select></label>',
      '<label>Status<select id="seasonal346ReadinessStatus"><option value="pending">Pending</option><option value="ready">Ready</option><option value="monitor">Monitor</option><option value="blocked">Blocked</option><option value="not_applicable">N/A</option></select></label>',
      '<label>Canonical record<select id="seasonal346ReadinessEntity"><option value="">— None —</option></select></label><label>Target date<input id="seasonal346ReadinessTarget" type="date"></label></div>',
      '<label>Review note<textarea id="seasonal346ReadinessNote" rows="2"></textarea></label><label>Next action<textarea id="seasonal346ReadinessNext" rows="2"></textarea></label>',
      '<button id="seasonal346ReadinessSave" class="secondary" type="button">Save Readiness Review</button></div>',

      '<div class="admin-panel-block"><h4>Recurring-customer rollover</h4>',
      '<div class="grid"><label>Agreement<select id="seasonal346RolloverAgreement"></select></label><label>Decision<select id="seasonal346RolloverState"><option value="review">Review</option><option value="continue">Continue</option><option value="renewal_contact_needed">Renewal contact needed</option><option value="hold">Hold</option><option value="end">End</option></select></label><label>Effective start<input id="seasonal346RolloverDate" type="date"></label></div>',
      '<label>Decision note<textarea id="seasonal346RolloverNote" rows="2"></textarea></label><button id="seasonal346RolloverSave" class="secondary" type="button">Save Rollover Decision</button>',
      '<p class="muted">This records the seasonal decision only; it does not silently change the canonical recurring agreement.</p></div>',

      '<div class="admin-panel-block"><h4>Winter storm event</h4>',
      '<div class="grid"><label>Storm name<input id="seasonal346StormName" type="text" placeholder="e.g. Lake-effect event — Dec 12"></label><label>Status<select id="seasonal346StormStatus"><option value="watch">Watch</option><option value="ready">Ready</option><option value="active">Active</option><option value="paused">Paused</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option></select></label><label>Planned start<input id="seasonal346StormStart" type="datetime-local"></label><label>Planned end<input id="seasonal346StormEnd" type="datetime-local"></label></div>',
      '<label>Workability observation<select id="seasonal346StormWorkability"><option value="">— Optional —</option></select></label><label>Activation note<textarea id="seasonal346StormNote" rows="2"></textarea></label>',
      '<button id="seasonal346StormSave" class="secondary" type="button">Save Winter Storm Event</button></div>',

      '<div class="admin-panel-block"><h4>Storm-route activation</h4>',
      '<div class="grid"><label>Storm event<select id="seasonal346StormEvent"></select></label><label>Storm-capable route<select id="seasonal346StormRoute"></select></label><label>Crew<select id="seasonal346StormCrew"><option value="">— Unassigned —</option></select></label>',
      '<label>Activation<select id="seasonal346StormRouteStatus"><option value="staged">Staged</option><option value="active">Active</option><option value="paused">Paused</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option></select></label><label>Priority<select id="seasonal346StormPriority"><option value="normal">Normal</option><option value="high" selected>High</option><option value="critical">Critical</option></select></label></div>',
      '<label>Activation note<textarea id="seasonal346StormRouteNote" rows="2"></textarea></label><button id="seasonal346StormRouteSave" class="secondary" type="button">Save Storm-Route Activation</button>',
      '<p class="muted">The route must already be winter/four-season and storm-event capable in Route Optimization &amp; Territory Management.</p></div>',

      '<div class="admin-panel-block"><h4>Outstanding seasonal work</h4><div id="seasonal346Outstanding"></div></div>',
      '<div id="seasonal346Status" class="notice" style="margin-top:10px;"></div>'
    ].join('');
    admin.appendChild(el); return el;
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI; if(!api?.loadAdminDirectory||!api?.manageOperations) return;
    const el=host(); if(!el||el.dataset.mounted==='1') return; el.dataset.mounted='1';
    const state={data:{},selectedCycle:''};
    const rows=(key)=>Array.isArray(state.data[key])?state.data[key]:[];
    const note=(msg,bad=false)=>{const n=$('seasonal346Status'); if(n){n.textContent=msg;n.classList.toggle('error',bad);}};
    const fill=(id,list,key,textFn,empty='— Select —')=>{
      const e=$(id); if(!e)return; const old=e.value;
      e.innerHTML='<option value="">'+esc(empty)+'</option>'+list.map(x=>'<option value="'+esc(x[key])+'">'+esc(textFn(x))+'</option>').join('');
      if(old&&list.some(x=>String(x[key])===String(old))) e.value=old;
    };
    const cycle=()=>rows('seasonal_operations_cycles').find(x=>String(x.id)===String(state.selectedCycle||$('seasonal346Cycle')?.value))||null;
    const selectedCycleId=()=>state.selectedCycle||$('seasonal346Cycle')?.value||'';

    function setCycleForm(c){
      if(!c){
        const y=new Date().getFullYear(); $('seasonal346Year').value=String(y); $('seasonal346Season').value='spring_summer';
        $('seasonal346CycleStatus').value='planning'; $('seasonal346Priority').value='core'; $('seasonal346CycleName').value=''; $('seasonal346Start').value=''; $('seasonal346End').value=''; $('seasonal346CycleNote').value=''; return;
      }
      $('seasonal346Year').value=c.season_year||''; $('seasonal346Season').value=c.season_context||'four_season'; $('seasonal346CycleStatus').value=c.cycle_status||'planning';
      $('seasonal346Priority').value=c.operating_priority||'core'; $('seasonal346CycleName').value=c.cycle_name||''; $('seasonal346Start').value=c.start_date||''; $('seasonal346End').value=c.end_date||''; $('seasonal346CycleNote').value=c.operations_note||'';
      if(c.season_context==='winter') $('seasonal346Priority').value='core';
    }

    function readinessOptions(){
      const type=$('seasonal346ReadinessType').value; let list=[],key='id',textFn=(x)=>x.entity_label||x.id;
      if(type==='customer_rollover'){list=rows('canonical_recurring_programs');textFn=x=>(x.agreement_code||'Agreement')+' · '+(x.client_name||'')+' · '+(x.service_name||'');}
      if(type==='staffing'){list=rows('canonical_crews');textFn=x=>(x.crew_code||'Crew')+' · '+(x.crew_name||'')+' · '+label(x.seasonal_status||x.crew_status);}
      if(type==='equipment'){list=rows('canonical_preventive_maintenance');key='equipment_item_id';textFn=x=>(x.equipment_code||'Equipment')+' · '+(x.equipment_name||'')+' · '+label(x.due_status||x.equipment_status);}
      if(type==='material'){list=rows('canonical_material_stock');textFn=x=>(x.sku||'Material')+' · '+(x.item_name||'')+' · '+label(x.stock_status);}
      if(type==='route'){list=rows('canonical_route_planning');key='route_id';textFn=x=>(x.route_code||'Route')+' · '+(x.route_name||'')+' · '+label(x.season_context)+(x.storm_event_capable?' · storm-capable':'');}
      fill('seasonal346ReadinessEntity',list,key,textFn,'— No canonical record —');
    }

    function renderChecklist(){
      const id=selectedCycleId(); const items=rows('seasonal_operations_checklist_items').filter(x=>String(x.cycle_id)===String(id)).sort((a,b)=>String(a.item_key).localeCompare(String(b.item_key)));
      $('seasonal346Checklist').innerHTML=items.length?items.map(x=>
        '<div class="notice" data-seasonal346-check="'+esc(x.id)+'"><strong>'+esc(x.item_label)+'</strong> <small>· '+esc(label(x.category))+'</small>'+
        '<div class="grid"><label>Status<select data-seasonal346-status="'+esc(x.id)+'"><option value="pending">Pending</option><option value="ready">Ready</option><option value="blocked">Blocked</option><option value="not_applicable">N/A</option><option value="complete">Complete</option></select></label>'+
        '<label>Due<input data-seasonal346-due="'+esc(x.id)+'" type="date" value="'+esc(x.due_date||'')+'"></label><label>Note<input data-seasonal346-note="'+esc(x.id)+'" type="text" value="'+esc(x.item_note||'')+'"></label>'+
        '<button type="button" class="secondary" data-seasonal346-save="'+esc(x.id)+'">Save</button></div></div>'
      ).join(''):'<p class="muted">Create or select a seasonal cycle to seed its checklist.</p>';
      items.forEach(x=>{const e=el.querySelector('[data-seasonal346-status="'+CSS.escape(String(x.id))+'"]');if(e)e.value=x.item_status||'pending';});
      el.querySelectorAll('[data-seasonal346-save]').forEach(btn=>btn.addEventListener('click',async()=>{
        const id=btn.getAttribute('data-seasonal346-save'),item=items.find(x=>String(x.id)===String(id)); if(!item)return;
        await manage({action:'seasonal_checklist_save',id:item.id,cycle_id:item.cycle_id,item_key:item.item_key,category:item.category,item_label:item.item_label,
          item_status:el.querySelector('[data-seasonal346-status="'+CSS.escape(String(id))+'"]').value,
          due_date:el.querySelector('[data-seasonal346-due="'+CSS.escape(String(id))+'"]').value||null,
          canonical_source:item.canonical_source||null,canonical_entity_id:item.canonical_entity_id||null,
          item_note:el.querySelector('[data-seasonal346-note="'+CSS.escape(String(id))+'"]').value||null},'Seasonal checklist item saved.');
      }));
    }

    function render(){
      const cycles=rows('seasonal_operations_cycles'),outstanding=rows('seasonal_operations_outstanding_work');
      $('seasonal346Summary').innerHTML=[
        ['Cycles',cycles.length],['Active / ready',cycles.filter(x=>['ready','active'].includes(x.cycle_status)).length],
        ['Blocked checklist',cycles.reduce((n,x)=>n+Number(x.checklist_blocked||0),0)],
        ['Open readiness',cycles.reduce((n,x)=>n+Number(x.readiness_open||0)+Number(x.readiness_blocked||0),0)],
        ['Outstanding work',outstanding.length]
      ].map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      fill('seasonal346Cycle',cycles,'id',x=>(x.cycle_code||'Cycle')+' · '+x.cycle_name+' · '+label(x.cycle_status),'— New cycle —');
      if(state.selectedCycle&&cycles.some(x=>String(x.id)===String(state.selectedCycle))) $('seasonal346Cycle').value=state.selectedCycle;
      setCycleForm(cycle());
      fill('seasonal346RolloverAgreement',rows('canonical_recurring_programs'),'id',x=>(x.agreement_code||'Agreement')+' · '+(x.client_name||'')+' · '+(x.service_name||''));
      fill('seasonal346StormWorkability',rows('canonical_workability').filter(x=>x.season_context==='winter'),'id',x=>(x.observation_code||'Observation')+' · '+(x.route_name||x.site_name||'')+' · '+label(x.workability_queue_status),'— Optional —');
      const storms=rows('seasonal_storm_events').filter(x=>!selectedCycleId()||String(x.cycle_id)===String(selectedCycleId()));
      fill('seasonal346StormEvent',storms,'id',x=>(x.storm_code||'Storm')+' · '+x.storm_name+' · '+label(x.storm_status));
      const stormRoutes=rows('canonical_route_planning').filter(x=>x.storm_event_capable&&['winter','four_season'].includes(x.season_context)&&x.is_active!==false);
      fill('seasonal346StormRoute',stormRoutes,'route_id',x=>(x.route_code||'Route')+' · '+x.route_name+' · '+label(x.season_context));
      fill('seasonal346StormCrew',rows('canonical_crews').filter(x=>x.crew_status!=='inactive'),'id',x=>(x.crew_code||'Crew')+' · '+x.crew_name,'— Unassigned —');
      readinessOptions(); renderChecklist();
      const ow=outstanding.filter(x=>!selectedCycleId()||String(x.cycle_id)===String(selectedCycleId()));
      $('seasonal346Outstanding').innerHTML=ow.length?ow.map(x=>'<div class="notice"><strong>'+esc(x.label||label(x.item_type))+'</strong> · '+esc(label(x.status))+'<br><small>'+esc(label(x.category))+(x.due_date?' · due '+esc(x.due_date):'')+'</small><br>'+esc(x.detail||'')+'</div>').join(''):'<p class="muted">No outstanding seasonal work for the selected cycle.</p>';
    }

    async function refresh(msg='Build 346 Seasonal Operations Centre refreshed.'){
      try{state.data=await api.loadAdminDirectory({scope:'seasonal_operations',limit:2500})||{};render();note(msg);}
      catch(e){note('Unable to load Build 346 seasonal operations: '+(e?.message||e),true);}
    }
    async function manage(payload,okText){
      try{note('Saving…');const r=await api.manageOperations(payload);if(!r?.ok)throw new Error(r?.error||'Operation failed.');await refresh(okText);return r;}
      catch(e){note(e?.message||String(e),true);return null;}
    }

    $('seasonal346Cycle').addEventListener('change',()=>{state.selectedCycle=$('seasonal346Cycle').value;render();});
    $('seasonal346Season').addEventListener('change',()=>{if($('seasonal346Season').value==='winter'){$('seasonal346Priority').value='core';$('seasonal346Priority').disabled=true;}else $('seasonal346Priority').disabled=false;});
    $('seasonal346ReadinessType').addEventListener('change',readinessOptions);

    $('seasonal346CycleSave').addEventListener('click',async()=>{
      const season=$('seasonal346Season').value;
      const r=await manage({action:'seasonal_cycle_save',id:selectedCycleId()||null,season_year:Number($('seasonal346Year').value),season_context:season,
        cycle_name:$('seasonal346CycleName').value.trim(),cycle_status:$('seasonal346CycleStatus').value,
        operating_priority:season==='winter'?'core':$('seasonal346Priority').value,start_date:$('seasonal346Start').value||null,end_date:$('seasonal346End').value||null,
        operations_note:$('seasonal346CycleNote').value.trim()},'Seasonal cycle saved and checklist synchronized.');
      if(r?.record?.id) state.selectedCycle=String(r.record.id);
    });

    $('seasonal346ReadinessSave').addEventListener('click',async()=>{
      const type=$('seasonal346ReadinessType').value,select=$('seasonal346ReadinessEntity'),id=select.value||null;
      const selected=select.options[select.selectedIndex]?.text||'';
      const payload={action:'seasonal_readiness_save',cycle_id:selectedCycleId(),readiness_type:type,readiness_status:$('seasonal346ReadinessStatus').value,
        entity_label:id?selected:null,review_note:$('seasonal346ReadinessNote').value.trim(),next_action:$('seasonal346ReadinessNext').value.trim(),target_date:$('seasonal346ReadinessTarget').value||null};
      if(type==='customer_rollover')payload.recurring_service_agreement_id=id;
      if(type==='staffing')payload.crew_id=id;
      if(type==='equipment')payload.equipment_item_id=id;
      if(type==='material')payload.material_id=id;
      if(type==='route')payload.route_id=id;
      await manage(payload,'Seasonal readiness review saved. Canonical source was not changed.');
    });

    $('seasonal346RolloverSave').addEventListener('click',async()=>{
      await manage({action:'seasonal_rollover_save',cycle_id:selectedCycleId(),recurring_service_agreement_id:$('seasonal346RolloverAgreement').value,
        rollover_state:$('seasonal346RolloverState').value,effective_start_date:$('seasonal346RolloverDate').value||null,decision_note:$('seasonal346RolloverNote').value.trim()},
        'Rollover decision saved. Canonical recurring agreement was not changed.');
    });

    $('seasonal346StormSave').addEventListener('click',async()=>{
      const c=cycle(); if(!c||c.season_context!=='winter'){note('Select a winter cycle before creating a storm event.',true);return;}
      await manage({action:'seasonal_storm_event_save',cycle_id:c.id,storm_name:$('seasonal346StormName').value.trim(),storm_status:$('seasonal346StormStatus').value,
        planned_start:$('seasonal346StormStart').value||null,planned_end:$('seasonal346StormEnd').value||null,workability_observation_id:$('seasonal346StormWorkability').value||null,
        activation_note:$('seasonal346StormNote').value.trim()},'Winter storm event saved.');
    });

    $('seasonal346StormRouteSave').addEventListener('click',async()=>{
      await manage({action:'seasonal_storm_route_activation_save',storm_event_id:$('seasonal346StormEvent').value,route_id:$('seasonal346StormRoute').value,
        crew_id:$('seasonal346StormCrew').value||null,activation_status:$('seasonal346StormRouteStatus').value,service_priority:$('seasonal346StormPriority').value,
        activation_note:$('seasonal346StormRouteNote').value.trim()},'Storm-route activation saved. Canonical route capability was not changed.');
    });

    await refresh();
  }
  window.YWISeasonalOperationsUI={mount};
})();