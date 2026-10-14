/* Build 395 — Workability Safe Schedule Recheck.
   Advisory, read-only preflight against canonical workability + dispatch + HSE records.
   Never dispatches, clears a hold, modifies an assignment, or creates a Safety approval.
*/
'use strict';
(function () {
  const MAX_OBSERVATION_AGE_MS = 24 * 60 * 60 * 1000;
  const BLOCKED_DECISIONS = new Set(['postpone','reschedule','blocked']);
  const RESTRICTED_DISPATCH = /block|hold|postpon|reschedul|cancel|suspend|clos|stop/i;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const millis = value => {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? time : NaN;
  };
  const byId = (list, id) => (list || []).find(row => String(row?.id || '') === String(id || ''));
  const active = state => !/cancel|complet|closed|archiv/i.test(String(state || ''));
  function safetyPermission() {
    const security = window.YWISecurity;
    const state = security?.getModulePermissionState?.();
    const level = state?.permissions?.safety;
    const ranks = { hidden:0, view:1, create:2, approve:3, manage:4 };
    // Only loaded, profile-specific module permissions count. Never use role defaults.
    return { verified:state?.loaded === true &&
      Object.prototype.hasOwnProperty.call(state.permissions || {}, 'safety') &&
      (ranks[level] || 0) >= 3, level:String(level || 'not verified') };
  }
  function assess(dispatch, payload, permission, now = Date.now()) {
    const holds = [], reviews = [];
    const observations = payload?.workability_queue || [];
    const decisions = payload?.workability_decisions || [];
    const packets = payload?.workability_hse_packets || [];
    if (!permission?.verified) holds.push('Safety approve permission not verified for the current signed-in profile');
    const begin = millis(dispatch?.scheduled_start);
    const finish = millis(dispatch?.scheduled_end);
    if (!Number.isFinite(begin) || !Number.isFinite(finish) || finish <= begin)
      holds.push('Canonical dispatch has no valid scheduled start and end');
    if (RESTRICTED_DISPATCH.test(String(dispatch?.schedule_status || '')))
      holds.push('Existing dispatch schedule status is a hold, cancellation, or restriction');
    if (RESTRICTED_DISPATCH.test(String(dispatch?.workability_state || '')))
      holds.push('Existing dispatch workability state is restricted; this view cannot clear it');
    if (!dispatch?.id) holds.push('Canonical dispatch identifier missing');
    const candidates = observations.filter(row =>
      row?.dispatch_schedule_item_id && String(row.dispatch_schedule_item_id) === String(dispatch?.id));
    candidates.sort((a,b) => (millis(b.observed_at) || 0) - (millis(a.observed_at) || 0));
    const observation = candidates[0] || null;
    let decision = null, packet = null;
    if (!observation) holds.push('No weather observation linked to this exact dispatch');
    else {
      const observed = millis(observation.observed_at);
      if (!observation.service_date || !Number.isFinite(observed))
        holds.push('Observation date/time missing');
      else if (observed > now + 5*60*1000 || now - observed > MAX_OBSERVATION_AGE_MS)
        holds.push('Recorded Ontario conditions are stale or dated in the future; re-observe');
      const tags = Array.isArray(observation.condition_tags) ? observation.condition_tags : [];
      const hasConditions = !!String(observation.weather_condition || '').trim() ||
        tags.length > 0 || ['saturated','icy','snow_covered'].includes(observation.ground_state) ||
        ['possible','observed'].includes(observation.freezing_rain_ice_state) ||
        Number.isFinite(Number(observation.temperature_c)) && observation.temperature_c !== null &&
        observation.temperature_c !== undefined;
      if (!hasConditions) holds.push('No substantive recorded weather conditions');
      if ((Number(observation.restriction_guidance_count) || 0) > 0)
        reviews.push('Restriction guidance requires explicit Safety/operator review');
      decision = byId(decisions,observation.latest_decision_id);
      if (!decision || String(decision.observation_id) !== String(observation.id))
        holds.push('Latest linked supervisor decision missing from the canonical decision source');
      else {
        if (!decision.decided_by_profile_id || !Number.isFinite(millis(decision.decision_at)))
          holds.push('Supervisor identity or decision time unverified');
        if (Number.isFinite(observed) && millis(decision.decision_at) < observed)
          holds.push('Supervisor decision predates the recorded observation');
        if (BLOCKED_DECISIONS.has(String(decision.decision_state || '').toLowerCase()))
          holds.push('Supervisor decision is '+String(decision.decision_state)+'; no override is allowed');
        else if (decision.decision_state === 'caution')
          reviews.push('Supervisor recorded caution; explicit operator assessment is required');
        else if (decision.decision_state !== 'workable')
          holds.push('No current workable/caution supervisor decision');
      }
      packet = packets.find(p =>
        (observation.linked_hse_packet_id && String(p.id) === String(observation.linked_hse_packet_id)) ||
        (p.dispatch_schedule_item_id && String(p.dispatch_schedule_item_id) === String(dispatch.id))) || null;
      if (observation.linked_hse_packet_id && !packet)
        holds.push('Linked HSE safety packet is unavailable');
      if (!packet) reviews.push('No linked HSE packet: Safety must confirm site-specific requirements');
      if (packet) {
        if (RESTRICTED_DISPATCH.test(String(packet.packet_status || '')))
          holds.push('Linked Safety packet is restricted');
        if (packet.weather_monitoring_required === true && packet.weather_monitoring_completed !== true)
          holds.push('Required HSE weather monitoring is incomplete');
        if (packet.heat_monitoring_required === true && packet.heat_monitoring_completed !== true)
          holds.push('Required HSE heat monitoring is incomplete');
      }
      if (observation.dispatch_application_status === 'pending_operator_dispatch')
        reviews.push('A recorded decision still awaits an authorized dispatcher');
    }
    if (Number.isFinite(begin) && begin > now + MAX_OBSERVATION_AGE_MS)
      reviews.push('Future dispatch: check conditions again near the scheduled work window');
    return { status:holds.length?'HOLD':reviews.length?'REVIEW':'OPERATOR_RECHECK',
      holds,reviews,observation,decision,packet,dispatch };
  }
  function mount(parent,{api}={}) {
    if (!parent || parent.querySelector('#wk395SafeRecheck')) return;
    const box=document.createElement('section');
    box.className='admin-panel-block';box.id='wk395SafeRecheck';
    box.innerHTML='<h4>Build 395 · Workability Safe Schedule Recheck</h4>'+
      '<p>Check recorded Ontario conditions, the latest supervisor decision, existing dispatch holds and linked HSE evidence. This is a review aid, <strong>not</strong> permission to start work, lift a Safety hold or automatically reschedule.</p>'+
      '<label>Canonical dispatch <select id="wk395Dispatch"><option value="">Select a scheduled dispatch</option></select></label> '+
      '<button type="button" class="secondary" id="wk395Recheck">Recheck current evidence</button>'+
      '<p id="wk395Status" role="status" aria-live="polite">Select a dispatch to review. Current evidence has not been checked.</p>'+
      '<div id="wk395Findings"></div>';
    const anchor=parent.querySelector('#wk342Status');
    if(anchor)parent.insertBefore(box,anchor);else parent.appendChild(box);
    const btn=$('wk395Recheck'),sel=$('wk395Dispatch'),status=$('wk395Status'),results=$('wk395Findings');
    let busy=false;
    btn.addEventListener('click',async()=>{
      if(busy)return;busy=true;btn.disabled=true;btn.textContent='Checking…';
      status.textContent='Refreshing workability and Safety evidence…';results.textContent='';
      try {
        const client=api||window.YWIAPI;
        if(typeof client?.loadAdminDirectory !== 'function')throw Error('Authorized workability reader is unavailable');
        const data=await client.loadAdminDirectory({scope:'workability',limit:1500,cacheMs:0,forceFresh:true});
        if(data?.ok!==true || data.scope && data.scope!=='workability')
          throw Error(data?.error || 'Workability access denied');
        for(const source of ['workability_queue','workability_decisions','workability_dispatch','workability_hse_packets'])
          if(!Array.isArray(data[source]))throw Error('Required source missing: '+source);
        const all=data.workability_dispatch.filter(d=>d?.id && active(d.schedule_status));
        const previous=sel.value;
        sel.innerHTML='<option value="">Select a scheduled dispatch</option>'+all.map(d=>
          '<option value="'+esc(d.id)+'">'+esc(d.work_order_number||d.route_name||d.id)+' · '+esc(d.scheduled_start||'unscheduled')+'</option>').join('');
        if(all.some(d=>String(d.id)===previous))sel.value=previous;
        else if(all.length===1)sel.value=String(all[0].id);
        const dispatch=byId(all,sel.value);
        if(!dispatch) {
          status.textContent=all.length?'Select a dispatch and Recheck again.':'No active canonical dispatches returned; scheduling approval is not implied.';
          return;
        }
        const permission=safetyPermission();
        const result=assess(dispatch,data,permission);
        const labels=result.holds.map(x=>'<li>'+esc(x)+'</li>').join('');
        const notices=result.reviews.map(x=>'<li>'+esc(x)+'</li>').join('');
        status.textContent=result.status==='HOLD'?'HOLD — do not dispatch':result.status==='REVIEW'?'REVIEW REQUIRED — operator/Safety determination outstanding':'EVIDENCE PRESENT — operator must still authorize dispatch';
        results.innerHTML='<p><strong>Safety permission:</strong> '+esc(permission.level)+
          ' · <strong>Observation:</strong> '+esc(result.observation?.observation_code||'none')+
          ' · <strong>Decision:</strong> '+esc(result.decision?.decision_state||'none')+
          ' · <strong>HSE packet:</strong> '+esc(result.packet?.packet_number||'none')+'</p>'+
          (labels?'<p><strong>Blocking evidence</strong></p><ul>'+labels+'</ul>':'')+
          (notices?'<p><strong>Review items</strong></p><ul>'+notices+'</ul>':'')+
          '<p><small>No action was submitted to the dispatch, recurring-service, workability-decision, or customer-notification write endpoints.</small></p>';
      } catch(error) {
        status.textContent='HOLD — recheck could not verify current evidence: '+String(error?.message||error);
        results.textContent='';
      } finally {busy=false;btn.disabled=false;btn.textContent='Recheck current evidence';}
    });
  }
  window.YWIWorkabilitySafeScheduleRecheck={mount,assess,safetyPermission};
})();