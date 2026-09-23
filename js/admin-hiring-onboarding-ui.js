/* File: js/admin-hiring-onboarding-ui.js
   Build 339 — Hiring & Onboarding Workflow.
   Four-season Ontario hiring readiness across landscaping, fall cleanup and winter snow work.
*/
'use strict';
(function(){
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const byId=(id)=>document.getElementById(id);
  const stages=['applicant','interview','offer','hired','documents','orientation','training','equipment_authorization','crew_assignment','ready'];
  const stageLabel=(v)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,(m)=>m.toUpperCase());
  function host(){
    const admin=byId('admin'); if(!admin)return null;
    let el=byId('hiringOnboarding339'); if(el)return el;
    el=document.createElement('details');
    el.id='hiringOnboarding339'; el.className='admin-hub-detail'; el.dataset.adminHubTitle='Hiring & Onboarding'; el.dataset.adminHubGroups='people'; el.open=true;
    el.innerHTML=[
      '<summary><span>Hiring &amp; Onboarding</span><small>Build 339 · candidate → pre-field ready</small></summary>',
      '<div class="admin-panel-block" data-build="339">',
      '<div class="section-heading"><div><span class="module-kicker">Build 339 · four-season workforce</span><h3>Hiring &amp; Onboarding Workflow</h3><p class="section-subtitle">Applicant → Interview → Offer → Hired → Documents → Orientation → Training → Equipment Authorization → Crew Assignment.</p></div><button id="hire339Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Four-season Ontario operating model:</strong> onboarding can cover spring/summer mowing and landscaping, fall cleanup and leaf collection, and winter snow clearing/removal. Winter work is a first-class seasonal readiness path, not an optional add-on.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Authority boundary:</strong> candidate records do not create a second employee, crew, training or equipment-authorization system. Pre-field readiness reads the existing profile, training/certification, internal authorization and crew-membership authorities.</div>',
      '<div id="hire339Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Add candidate</h4><div class="grid">',
      '<label>Name<input id="hire339Name" type="text"></label><label>Target position<input id="hire339Position" type="text" placeholder="Crew Member"></label>',
      '<label>Employment<select id="hire339Employment"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="seasonal">Seasonal</option><option value="casual">Casual</option><option value="contract">Contract</option></select></label>',
      '<label>Season profile<select id="hire339Season"><option value="four_season">Four season</option><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="fall_winter">Fall / winter</option><option value="winter">Winter</option><option value="seasonal_flexible">Seasonal flexible</option></select></label>',
      '<label>Planned crew<select id="hire339Crew"><option value="">Not planned yet</option></select></label><label>Available from<input id="hire339Available" type="date"></label>',
      '</div><button id="hire339Add" class="secondary" type="button">Add Candidate</button></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Pipeline</h4><div id="hire339Pipeline"></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Selected onboarding record</h4><div id="hire339Selected"></div></div>',
      '<div id="hire339Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    const anchor=byId('performanceDevelopment338');
    if(anchor) anchor.insertAdjacentElement('afterend',el); else admin.appendChild(el);
    return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI;
    if(!api?.loadAdminDirectory||!api?.manageAdminEntity)return;
    const el=host(); if(!el||el.dataset.mounted==='1')return; el.dataset.mounted='1';
    const state={payload:{},selectedId:''};
    const arr=(k)=>Array.isArray(state.payload[k])?state.payload[k]:[];
    const notice=(t,bad=false)=>{const e=byId('hire339Status');if(e){e.textContent=t;e.classList.toggle('error',bad);}};
    const selected=()=>arr('onboarding_overview').find((x)=>String(x.candidate_id)===String(state.selectedId))||null;
    function render(){
      const rows=arr('onboarding_overview').filter((x)=>!x.is_archived);
      if(!state.selectedId&&rows[0])state.selectedId=String(rows[0].candidate_id);
      const ready=rows.filter((x)=>x.pre_field_ready).length;
      const winter=rows.filter((x)=>['four_season','fall_winter','winter','seasonal_flexible'].includes(x.season_profile)).length;
      byId('hire339Summary').innerHTML=[
        ['Active candidates',rows.length],['Pre-field ready',ready],['Incomplete onboarding',Math.max(rows.length-ready,0)],['Winter-path candidates',winter]
      ].map((x)=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      byId('hire339Crew').innerHTML='<option value="">Not planned yet</option>'+arr('onboarding_crews').map((c)=>'<option value="'+esc(c.crew_id||c.id)+'">'+esc(c.crew_name||c.crew_code||'Crew')+'</option>').join('');
      byId('hire339Pipeline').innerHTML=rows.length?rows.map((x)=>{
        const nextIndex=stages.indexOf(x.stage)+1;
        const canAdvance=nextIndex>0&&nextIndex<stages.length;
        return '<div class="notice" data-candidate-id="'+esc(x.candidate_id)+'"><strong>'+esc(x.full_name)+'</strong> · '+esc(stageLabel(x.stage))+' · '+esc(stageLabel(x.season_profile))+
          '<br><small>Next gate: '+esc(stageLabel(x.next_readiness_gate))+' · onboarding blockers '+esc(x.onboarding_blocker_count||0)+' · training blockers '+esc(x.training_blocker_count||0)+' · authorization blockers '+esc(x.equipment_authorization_blocker_count||0)+' · crew '+esc(x.current_crew_name||'not assigned')+'</small><br>'+
          '<button type="button" class="secondary" data-select="'+esc(x.candidate_id)+'">Open</button> '+
          (canAdvance?'<button type="button" class="secondary" data-advance="'+esc(x.candidate_id)+'" data-stage="'+esc(stages[nextIndex])+'">Advance to '+esc(stageLabel(stages[nextIndex]))+'</button>':'')+
          (x.pre_field_ready&&x.stage!=='ready'?'<button type="button" class="secondary" data-ready="'+esc(x.candidate_id)+'">Mark Ready</button>':'')+
          '</div>';
      }).join(''):'<p class="muted">No candidates yet.</p>';
      const c=selected();
      if(!c){byId('hire339Selected').innerHTML='<p class="muted">Select a candidate.</p>';return;}
      const items=arr('onboarding_items').filter((x)=>String(x.candidate_id)===String(c.candidate_id));
      const profiles=arr('onboarding_profiles');
      byId('hire339Selected').innerHTML=[
        '<div class="notice"><strong>'+esc(c.full_name)+'</strong><br>Stage '+esc(stageLabel(c.stage))+' · '+esc(stageLabel(c.season_profile))+'<br><small>Pre-field ready: '+(c.pre_field_ready?'Yes':'No')+' · Next gate: '+esc(stageLabel(c.next_readiness_gate))+'</small></div>',
        '<div class="grid" style="margin-top:10px;"><label>Link existing employee profile<select id="hire339Profile"><option value="">Not linked</option>'+profiles.map((p)=>'<option value="'+esc(p.profile_id||p.id)+'" '+(String(c.profile_id||'')===String(p.profile_id||p.id)?'selected':'')+'>'+esc(p.full_name||p.employee_number||p.email||'Employee')+'</option>').join('')+'</select></label><button id="hire339LinkProfile" class="secondary" type="button">Save Profile Link</button></div>',
        '<h5 style="margin-top:12px;">Onboarding checklist</h5>',
        items.length?items.map((x)=>'<div class="notice" data-item="'+esc(x.id)+'"><strong>'+esc(x.item_name)+'</strong> · '+esc(stageLabel(x.item_category))+'<br><select data-status="'+esc(x.id)+'"><option value="pending" '+(x.item_status==='pending'?'selected':'')+'>Pending</option><option value="in_progress" '+(x.item_status==='in_progress'?'selected':'')+'>In progress</option><option value="completed" '+(x.item_status==='completed'?'selected':'')+'>Completed</option><option value="waived" '+(x.item_status==='waived'?'selected':'')+'>Waived</option><option value="not_applicable" '+(x.item_status==='not_applicable'?'selected':'')+'>Not applicable</option></select> <button type="button" class="secondary" data-save-item="'+esc(x.id)+'">Save</button></div>').join(''):'<p class="muted">No onboarding items.</p>'
      ].join('');
      const link=byId('hire339LinkProfile');
      if(link)link.onclick=()=>manage({entity:'hiring_candidate',action:'link_profile',item_id:c.candidate_id,profile_id:byId('hire339Profile').value},'Employee profile link saved.');
    }
    async function load(){
      notice('Loading hiring and onboarding evidence…');
      const r=await api.loadAdminDirectory({scope:'onboarding',limit:1000});
      if(!r?.ok)return notice(r?.error||'Hiring & Onboarding load failed.',true);
      state.payload=r;
      if(!arr('onboarding_overview').some((x)=>String(x.candidate_id)===String(state.selectedId)))state.selectedId=String(arr('onboarding_overview')[0]?.candidate_id||'');
      render(); notice('Hiring & Onboarding evidence loaded. Four-season readiness is active.');
    }
    async function manage(req,ok){
      const r=await api.manageAdminEntity(req);
      if(!r?.ok)return notice(r?.error||'Update failed.',true);
      await load(); notice(ok);
    }
    byId('hire339Refresh').onclick=load;
    byId('hire339Add').onclick=()=>manage({
      entity:'hiring_candidate',action:'create',full_name:byId('hire339Name').value.trim(),target_position:byId('hire339Position').value.trim(),
      employment_type:byId('hire339Employment').value,season_profile:byId('hire339Season').value,planned_crew_id:byId('hire339Crew').value||null,
      available_from:byId('hire339Available').value||null
    },'Candidate added with season-appropriate onboarding checklist.');
    byId('hire339Pipeline').onclick=(e)=>{
      const s=e.target.closest('[data-select]'); if(s){state.selectedId=s.getAttribute('data-select')||'';render();return;}
      const a=e.target.closest('[data-advance]'); if(a){manage({entity:'hiring_candidate',action:'set_stage',item_id:a.getAttribute('data-advance'),stage:a.getAttribute('data-stage')},'Hiring stage advanced.');return;}
      const r=e.target.closest('[data-ready]'); if(r)manage({entity:'hiring_candidate',action:'set_stage',item_id:r.getAttribute('data-ready'),stage:'ready'},'Candidate marked pre-field ready.');
    };
    byId('hire339Selected').onclick=(e)=>{
      const b=e.target.closest('[data-save-item]'); if(!b)return;
      const id=b.getAttribute('data-save-item'), sel=el.querySelector('[data-status="'+id+'"]');
      manage({entity:'hiring_onboarding_item',action:'update',item_id:id,item_status:sel?.value||'pending'},'Onboarding item updated.');
    };
    await load();
  }
  window.YWIHiringOnboardingUI={mount};
})();
