/* Build 343 — Landscape Material Estimator */
'use strict';
(function(){
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replaceAll('_',' ');
  const num=(v)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const MATERIAL_DEFAULTS={
    mulch:{method:'area_depth',unit:'m3'},soil:{method:'area_depth',unit:'m3'},gravel:{method:'area_depth',unit:'m3'},stone:{method:'area_depth',unit:'m3'},
    sod:{method:'area',unit:'m2'},seed:{method:'application_rate',unit:'kg'},fertilizer:{method:'application_rate',unit:'kg'},
    disposal:{method:'volume',unit:'m3'},salt_deicer:{method:'application_rate',unit:'kg'},traction_material:{method:'application_rate',unit:'kg'},
    configurable:{method:'direct',unit:'unit'}
  };
  function host(){
    const admin=$('admin');if(!admin)return null;
    let el=$('landscapeMaterialEstimator343');if(el)return el;
    el=document.createElement('details');
    el.id='landscapeMaterialEstimator343';el.className='admin-hub-detail';el.dataset.adminHubTitle='Landscape Material Estimator';el.dataset.adminHubGroups='operations';el.open=true;
    el.innerHTML=[
      '<summary><span>Landscape Material Estimator</span><small>Build 343 · planning evidence</small></summary>',
      '<div class="admin-panel-block" data-build="343">',
      '<div class="section-heading"><div><span class="module-kicker">Build 343 · Business &amp; Operations</span><h3>Landscape Material Estimator</h3><p class="section-subtitle">Calculate planned material quantities from area, depth, volume or application rate, then compare planned vs actual use.</p></div><button id="lme343Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> this is planning/evidence only. Saving a calculation or actual-use observation does not move inventory, change a job/estimate, create billing, or replace canonical material receipts/issues/adjustments.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Four-season coverage:</strong> mulch, soil, sod, seed, fertilizer, gravel, stone, disposal, configurable materials, and winter salt/de-icer or traction material.</div>',
      '<div id="lme343Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Plan material</h4>',
      '<div class="grid"><label>Existing plan<select id="lme343Plan"></select></label><label>Service context<select id="lme343Service"><option value="mowing_landscaping">Mowing / landscaping</option><option value="landscape_installation">Landscape installation</option><option value="fall_cleanup">Fall cleanup</option><option value="snow_clearing_removal">Snow clearing / removal</option><option value="general_outdoor">General outdoor</option></select></label>',
      '<label>Season<select id="lme343Season"><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option><option value="four_season">Four season</option></select></label><label>Property<select id="lme343Property"></select></label>',
      '<label>Estimate<select id="lme343Estimate"></select></label><label>Work order<select id="lme343WorkOrder"></select></label></div>',
      '<div class="grid"><label>Material type<select id="lme343Type"><option value="mulch">Mulch</option><option value="soil">Soil</option><option value="sod">Sod</option><option value="seed">Seed</option><option value="fertilizer">Fertilizer</option><option value="gravel">Gravel</option><option value="stone">Stone</option><option value="disposal">Disposal</option><option value="salt_deicer">Salt / de-icer</option><option value="traction_material">Traction material</option><option value="configurable">Configurable</option></select></label>',
      '<label>Material label<input id="lme343Label" type="text" value="Mulch"></label><label>Catalog material<select id="lme343Material"></select></label><label>Calculation<select id="lme343Method"><option value="area_depth">Area × depth</option><option value="area">Area</option><option value="application_rate">Area × application rate</option><option value="volume">Volume</option><option value="direct">Direct quantity</option></select></label></div>',
      '<div class="grid"><label>Length (m)<input id="lme343Length" type="number" min="0" step="0.01"></label><label>Width (m)<input id="lme343Width" type="number" min="0" step="0.01"></label><label>Area (m²)<input id="lme343Area" type="number" min="0" step="0.01"></label><label>Depth (cm)<input id="lme343DepthCm" type="number" min="0" step="0.1"></label>',
      '<label>Volume (m³)<input id="lme343Volume" type="number" min="0" step="0.01"></label><label>Application rate / m²<input id="lme343Rate" type="number" min="0" step="0.001"></label><label>Direct quantity<input id="lme343Direct" type="number" min="0" step="0.01"></label><label>Source unit<input id="lme343SourceUnit" type="text" placeholder="kg, bag, tonne…"></label></div>',
      '<div class="grid"><label>Planned unit<select id="lme343Unit"><option value="m3">m³</option><option value="yd3">yd³</option><option value="ft3">ft³</option><option value="L">L</option><option value="m2">m²</option><option value="ft2">ft²</option><option value="kg">kg</option><option value="lb">lb</option><option value="bag">bag</option><option value="tonne">tonne</option><option value="unit">unit</option></select></label><label>Base → planned conversion factor<input id="lme343Factor" type="number" min="0.000000001" step="0.000001" value="1"></label><label>Waste factor (%)<input id="lme343Waste" type="number" min="0" max="100" step="0.1" value="10"></label></div>',
      '<label>Assumptions / site note<textarea id="lme343Assumptions"></textarea></label>',
      '<div id="lme343Preview" class="notice" style="margin-top:8px;">Enter measurements to calculate a preview.</div>',
      '<button id="lme343Calculate" class="secondary" type="button">Calculate Preview</button> <button id="lme343Save" class="secondary" type="button">Save Plan + Material Line</button></div>',
      '<div class="admin-panel-block"><h4>Planned vs actual use</h4><label>Planned line<select id="lme343ActualLine"></select></label>',
      '<div class="grid"><label>Actual quantity<input id="lme343ActualQty" type="number" min="0" step="0.01"></label><label>Actual unit<input id="lme343ActualUnit" type="text"></label><label>Actual → planned conversion factor<input id="lme343ActualFactor" type="number" min="0.000000001" step="0.000001" value="1"></label></div>',
      '<label>Actual-use note<textarea id="lme343ActualNote"></textarea></label><button id="lme343RecordActual" class="secondary" type="button">Record Actual Use Evidence</button>',
      '<div id="lme343Lines" style="margin-top:12px;"></div></div></div>',
      '<div id="lme343Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    admin.appendChild(el);return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory||!api?.manageOperations)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={data:{},planId:''};
    const arr=(k)=>Array.isArray(state.data[k])?state.data[k]:[];
    const note=(t,b=false)=>{const n=$('lme343Status');if(n){n.textContent=t;n.classList.toggle('error',b);}};
    const fill=(id,rows,key,textFn,empty='— Select —')=>{const e=$(id);if(!e)return;e.innerHTML='<option value="">'+esc(empty)+'</option>'+rows.map(x=>'<option value="'+esc(x[key])+'">'+esc(textFn(x))+'</option>').join('');};
    function deriveArea(){
      const direct=num($('lme343Area').value),length=num($('lme343Length').value),width=num($('lme343Width').value);
      return direct>0?direct:(length>0&&width>0?length*width:0);
    }
    function baseForPreview(){
      const method=$('lme343Method').value,area=deriveArea(),depthM=num($('lme343DepthCm').value)/100,volume=num($('lme343Volume').value),rate=num($('lme343Rate').value),direct=num($('lme343Direct').value);
      if(method==='area_depth')return {qty:area*depthM,unit:'m3'};
      if(method==='area')return {qty:area,unit:'m2'};
      if(method==='application_rate')return {qty:area*rate,unit:$('lme343SourceUnit').value.trim()||'rate_unit'};
      if(method==='volume')return {qty:volume,unit:'m3'};
      return {qty:direct,unit:$('lme343SourceUnit').value.trim()||$('lme343Unit').value};
    }
    function setSuggestedFactor(){
      const method=$('lme343Method').value,unit=$('lme343Unit').value;
      let factor=1;
      if(method==='area_depth'||method==='volume'){
        factor={m3:1,yd3:1.307950619,ft3:35.314666722,L:1000}[unit]||1;
      }else if(method==='area'){
        factor={m2:1,ft2:10.763910417}[unit]||1;
      }
      $('lme343Factor').value=String(factor);
      calculate();
    }
    function applyTypeDefaults(){
      const type=$('lme343Type').value,d=MATERIAL_DEFAULTS[type]||MATERIAL_DEFAULTS.configurable;
      $('lme343Method').value=d.method;$('lme343Unit').value=d.unit;$('lme343Label').value=label(type).replace(/\b\w/g,(m)=>m.toUpperCase());
      if(d.method==='application_rate')$('lme343SourceUnit').value=d.unit;
      setSuggestedFactor();
    }
    function calculate(){
      const b=baseForPreview(),factor=num($('lme343Factor').value)||1,waste=Math.max(0,num($('lme343Waste').value));
      const planned=b.qty*factor*(1+waste/100);
      $('lme343Preview').innerHTML='<strong>Preview:</strong> '+(b.qty>0?b.qty.toFixed(3):'0')+' '+esc(b.unit)+' base × '+factor.toFixed(6)+' × waste '+waste.toFixed(1)+'% = <strong>'+planned.toFixed(3)+' '+esc($('lme343Unit').value)+'</strong>.';
      return {base:b,planned};
    }
    function render(){
      const plans=arr('material_estimator_plans'),lines=arr('material_estimator_lines');
      $('lme343Summary').innerHTML=[
        ['Plans',plans.length],['Material lines',lines.length],['Actual-use evidence',lines.reduce((n,x)=>n+Number(x.actual_event_count||0),0)],
        ['Winter lines',lines.filter(x=>x.season_context==='winter'||['salt_deicer','traction_material'].includes(x.material_type)).length]
      ].map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      fill('lme343Plan',plans,'id',x=>x.estimator_code+' · '+label(x.service_context)+' · '+label(x.plan_status),'New plan');
      fill('lme343Property',arr('material_estimator_properties'),'id',x=>x.site_name+' · '+(x.city||x.service_address||''));
      fill('lme343Estimate',arr('material_estimator_estimates'),'id',x=>(x.estimate_number||'Estimate')+' · '+(x.quote_title||x.status||''));
      fill('lme343WorkOrder',arr('material_estimator_work_orders'),'id',x=>(x.work_order_number||'Work order')+' · '+(x.status||''));
      fill('lme343Material',arr('material_estimator_materials'),'id',x=>(x.sku||'Material')+' · '+(x.item_name||''));
      fill('lme343ActualLine',lines,'id',x=>x.estimator_code+' · '+x.material_label+' · '+Number(x.planned_quantity||0).toFixed(2)+' '+x.planned_unit);
      if(state.planId&&plans.some(x=>String(x.id)===String(state.planId)))$('lme343Plan').value=state.planId;
      $('lme343Lines').innerHTML=lines.length?lines.map(x=>'<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-lme-line="'+esc(x.id)+'"><strong>'+esc(x.material_label)+'</strong> · '+esc(label(x.material_type))+'<br><small>planned '+Number(x.planned_quantity||0).toFixed(2)+' '+esc(x.planned_unit)+' · actual '+Number(x.actual_quantity_planned_unit||0).toFixed(2)+' '+esc(x.planned_unit)+' · variance '+Number(x.variance_quantity||0).toFixed(2)+' ('+(x.variance_percent==null?'—':Number(x.variance_percent).toFixed(1)+'%')+')</small></button>').join(''):'<p class="muted">No material-estimator lines yet.</p>';
    }
    async function load(){
      note('Loading landscape material estimator…');
      const r=await api.loadAdminDirectory({scope:'material_estimator',limit:1500});
      if(!r?.ok)return note(r?.error||'Landscape material estimator load failed.',true);
      state.data=r;render();note('Landscape material estimator loaded. Inventory and job authority remain unchanged.');
    }
    async function manage(payload,msg){
      const r=await api.manageOperations(payload);
      if(!r?.ok)return note(r?.error||'Material estimator update failed.',true);
      if(payload.action==='landscape_material_estimate_save'&&r.record?.estimate?.id)state.planId=String(r.record.estimate.id);
      await load();note(msg);
    }
    $('lme343Refresh').onclick=load;
    $('lme343Calculate').onclick=calculate;
    $('lme343Type').onchange=applyTypeDefaults;
    $('lme343Method').onchange=setSuggestedFactor;
    $('lme343Unit').onchange=setSuggestedFactor;
    $('lme343Plan').onchange=()=>{state.planId=$('lme343Plan').value||'';};
    $('lme343Lines').onclick=(e)=>{const b=e.target.closest('[data-lme-line]');if(!b)return;$('lme343ActualLine').value=b.getAttribute('data-lme-line')||'';};
    $('lme343Save').onclick=()=>{
      const area=deriveArea(),depthM=num($('lme343DepthCm').value)/100;
      manage({
        action:'landscape_material_estimate_save',id:state.planId||null,service_context:$('lme343Service').value,season_context:$('lme343Season').value,
        client_site_id:$('lme343Property').value||null,estimate_id:$('lme343Estimate').value||null,work_order_id:$('lme343WorkOrder').value||null,
        assumptions:$('lme343Assumptions').value.trim(),material_id:$('lme343Material').value||null,material_type:$('lme343Type').value,
        material_label:$('lme343Label').value.trim(),calculation_method:$('lme343Method').value,area_m2:area||null,depth_m:depthM||null,
        volume_m3:num($('lme343Volume').value)||null,application_rate:num($('lme343Rate').value)||null,direct_quantity:num($('lme343Direct').value)||null,
        source_unit:$('lme343SourceUnit').value.trim()||null,conversion_factor:num($('lme343Factor').value)||1,planned_unit:$('lme343Unit').value,
        waste_factor_percent:num($('lme343Waste').value),unit_conversion_note:'Operator-selected conversion factor; preview shown before save.',line_assumptions:$('lme343Assumptions').value.trim()
      },'Material plan recorded. No inventory movement or job/estimate change was made.');
    };
    $('lme343RecordActual').onclick=()=>{
      const lineId=$('lme343ActualLine').value;if(!lineId)return note('Select a planned material line first.',true);
      manage({action:'landscape_material_actual_use_save',material_estimate_line_id:lineId,actual_quantity:num($('lme343ActualQty').value),actual_unit:$('lme343ActualUnit').value.trim(),conversion_factor_to_planned:num($('lme343ActualFactor').value)||1,use_note:$('lme343ActualNote').value.trim()},'Actual-use evidence recorded. Canonical inventory issue/receipt records were not changed.');
    };
    applyTypeDefaults();
    await load();
  }
  window.YWILandscapeMaterialEstimatorUI={mount};
})();
