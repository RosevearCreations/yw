/* File: js/admin-performance-development-ui.js
   Build 338 — Performance & Development.
   Uses canonical workforce, training and timekeeping evidence while keeping Safety truth separate.
*/
'use strict';
(function(){
  const BUILD=338;
  const byId=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtDate=(v)=>v?new Date(v+'T00:00:00').toLocaleDateString('en-CA'):'—';

  function makeHost(){
    const admin=byId('admin'); if(!admin)return null;
    let host=byId('performanceDevelopment338'); if(host)return host;
    host=document.createElement('details');
    host.id='performanceDevelopment338';
    host.className='admin-hub-detail';
    host.dataset.adminHubTitle='Performance & Development';
    host.dataset.adminHubGroups='people';
    host.open=true;
    host.innerHTML=[
      '<summary><span>Performance &amp; Development</span><small>Build 338 · coaching, growth &amp; follow-up</small></summary>',
      '<div class="admin-panel-block" data-build="338">',
      '<div class="section-heading"><div><span class="module-kicker">Build 338 · workforce development</span><h3>Performance &amp; Development</h3><p class="section-subtitle">Role expectations, coaching, recognition, attendance-pattern context, development plans, documented reviews, improvement actions and follow-up dates.</p></div><button id="perf338Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Safety boundary:</strong> Safety incident and near-miss truth stays in Safety. This workbench does not convert, score or rewrite Safety events as performance outcomes. Attendance context is derived from the existing Build 337 timekeeping evidence.</div>',
      '<div class="grid" style="margin-top:12px;"><label>Employee<select id="perf338Profile"></select></label><div id="perf338Summary" class="admin-backbone-summary"></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Role expectations</h4><div class="grid"><label>Role key<input id="perf338RoleKey" type="text" placeholder="employee"></label><label>Area<input id="perf338ExpectationArea" type="text" placeholder="quality"></label><label>Title<input id="perf338ExpectationTitle" type="text"></label><label>Expectation<textarea id="perf338ExpectationText" rows="2"></textarea></label></div><button id="perf338AddExpectation" class="secondary" type="button">Add Expectation</button><div id="perf338Expectations" class="table-scroll" style="margin-top:10px;"></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Coaching &amp; recognition</h4><div class="grid"><label>Type<select id="perf338CoachingType"><option value="coaching">Coaching</option><option value="recognition">Recognition</option><option value="check_in">Check-in</option><option value="feedback">Feedback</option></select></label><label>Topic<input id="perf338CoachingTopic" type="text"></label><label>Summary<textarea id="perf338CoachingSummary" rows="2"></textarea></label><label>Follow-up<input id="perf338CoachingFollowUp" type="date"></label></div><button id="perf338AddCoaching" class="secondary" type="button">Record Coaching / Recognition</button></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Development plan</h4><div class="grid"><label>Plan title<input id="perf338PlanTitle" type="text"></label><label>Goal<textarea id="perf338PlanGoal" rows="2"></textarea></label><label>Skill<select id="perf338PlanSkill"><option value="">No linked skill</option></select></label><label>Target date<input id="perf338PlanTarget" type="date"></label></div><button id="perf338AddPlan" class="secondary" type="button">Add Development Plan</button></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Documented review</h4><div class="grid"><label>Period start<input id="perf338ReviewStart" type="date"></label><label>Period end<input id="perf338ReviewEnd" type="date"></label><label>Summary<textarea id="perf338ReviewSummary" rows="2"></textarea></label><label>Strengths<textarea id="perf338ReviewStrengths" rows="2"></textarea></label><label>Development focus<textarea id="perf338ReviewFocus" rows="2"></textarea></label><label>Follow-up<input id="perf338ReviewFollowUp" type="date"></label></div><button id="perf338AddReview" class="secondary" type="button">Save Draft Review</button></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Improvement action</h4><div class="grid"><label>Action<textarea id="perf338ActionText" rows="2"></textarea></label><label>Success measure<input id="perf338ActionMeasure" type="text"></label><label>Due date<input id="perf338ActionDue" type="date"></label><label>Follow-up<input id="perf338ActionFollowUp" type="date"></label></div><button id="perf338AddAction" class="secondary" type="button">Add Improvement Action</button></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Employee development record</h4><div id="perf338Record"></div></div>',
      '<div id="perf338Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    const anchor=byId('timekeepingAttendance337');
    if(anchor) anchor.insertAdjacentElement('afterend',host); else admin.appendChild(host);
    return host;
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI;
    if(!api?.loadAdminDirectory||!api?.manageAdminEntity)return;
    const host=makeHost(); if(!host||host.dataset.mounted==='1')return;
    host.dataset.mounted='1';
    const state={payload:{},profileId:''};
    const arr=(k)=>Array.isArray(state.payload[k])?state.payload[k]:[];
    const status=(t,bad=false)=>{const e=byId('perf338Status');if(e){e.textContent=t;e.classList.toggle('error',bad);}};
    const selected=()=>arr('performance_overview').find((x)=>String(x.profile_id)===String(state.profileId))||null;

    function render(){
      const people=arr('performance_overview');
      if(!state.profileId&&people[0])state.profileId=String(people[0].profile_id);
      byId('perf338Profile').innerHTML=people.map((p)=>'<option value="'+esc(p.profile_id)+'">'+esc(p.full_name||p.employee_number||p.email||'Employee')+'</option>').join('');
      byId('perf338Profile').value=state.profileId;
      const p=selected()||{};
      byId('perf338RoleKey').value=p.role||'employee';
      const cards=[
        ['Coaching',p.coaching_record_count||0],['Recognition',p.recognition_count||0],
        ['Open plans',p.open_development_plan_count||0],['Reviews',p.review_count||0],
        ['Open actions',p.open_improvement_action_count||0],['Attendance reviews (90d)',p.attendance_review_count||0]
      ];
      byId('perf338Summary').innerHTML=cards.map((x)=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      byId('perf338PlanSkill').innerHTML='<option value="">No linked skill</option>'+arr('performance_skills').map((s)=>'<option value="'+esc(s.id)+'">'+esc(s.skill_name||s.skill_code)+'</option>').join('');
      const expectations=arr('performance_expectations');
      byId('perf338Expectations').innerHTML='<table><thead><tr><th>Role</th><th>Area</th><th>Expectation</th></tr></thead><tbody>'+(expectations.length?expectations.map((x)=>'<tr><td>'+esc(x.role_key)+'</td><td>'+esc(x.expectation_area)+'</td><td><strong>'+esc(x.expectation_title)+'</strong><br><small>'+esc(x.expectation_text)+'</small></td></tr>').join(''):'<tr><td colspan="3" class="muted">No role expectations yet.</td></tr>')+'</tbody></table>';

      const coaching=arr('performance_coaching').filter((x)=>String(x.profile_id)===state.profileId);
      const plans=arr('performance_development_plans').filter((x)=>String(x.profile_id)===state.profileId);
      const reviews=arr('performance_reviews').filter((x)=>String(x.profile_id)===state.profileId);
      const actions=arr('performance_improvement_actions').filter((x)=>String(x.profile_id)===state.profileId);
      byId('perf338Record').innerHTML=[
        '<h5>Coaching / recognition</h5>',coaching.length?coaching.map((x)=>'<div class="notice"><strong>'+esc(String(x.record_type||'').replaceAll('_',' '))+' · '+esc(x.topic)+'</strong><br>'+esc(x.summary)+'<br><small>Observed '+esc(fmtDate(x.observed_on))+' · follow-up '+esc(fmtDate(x.follow_up_date))+' · '+esc(x.record_status)+'</small></div>').join(''):'<p class="muted">No coaching records.</p>',
        '<h5>Development plans</h5>',plans.length?plans.map((x)=>'<div class="notice"><strong>'+esc(x.plan_title)+'</strong><br>'+esc(x.goal_text)+'<br><small>'+esc(x.plan_status)+' · target '+esc(fmtDate(x.target_date))+'</small> '+(x.plan_status!=='completed'?'<button type="button" class="secondary" data-complete-plan="'+esc(x.id)+'">Complete</button>':'')+'</div>').join(''):'<p class="muted">No development plans.</p>',
        '<h5>Reviews</h5>',reviews.length?reviews.map((x)=>'<div class="notice"><strong>'+esc(x.review_status)+' review</strong><br>'+esc(x.summary)+'<br><small>'+esc(fmtDate(x.review_period_start))+' → '+esc(fmtDate(x.review_period_end))+' · follow-up '+esc(fmtDate(x.follow_up_date))+'</small> '+(x.review_status==='draft'?'<button type="button" class="secondary" data-complete-review="'+esc(x.id)+'">Complete Review</button>':'')+'</div>').join(''):'<p class="muted">No documented reviews.</p>',
        '<h5>Improvement actions</h5>',actions.length?actions.map((x)=>'<div class="notice"><strong>'+esc(x.action_status)+'</strong> · '+esc(x.action_text)+'<br><small>Due '+esc(fmtDate(x.due_date))+' · follow-up '+esc(fmtDate(x.follow_up_date))+'</small> '+(!['completed','cancelled'].includes(x.action_status)?'<button type="button" class="secondary" data-complete-action="'+esc(x.id)+'">Complete</button>':'')+'</div>').join(''):'<p class="muted">No improvement actions.</p>'
      ].join('');
    }

    async function load(){
      status('Loading performance and development evidence…');
      const r=await api.loadAdminDirectory({scope:'performance',limit:1000});
      if(!r?.ok)return status(r?.error||'Performance & Development load failed.',true);
      state.payload=r;
      if(!arr('performance_overview').some((x)=>String(x.profile_id)===String(state.profileId)))state.profileId=String(arr('performance_overview')[0]?.profile_id||'');
      render(); status('Performance & Development evidence loaded. Safety truth remains separate.');
    }

    async function manage(req,okText){
      const out=await api.manageAdminEntity(req);
      if(!out?.ok)return status(out?.error||'Update failed.',true);
      await load(); status(okText);
    }

    byId('perf338Refresh').onclick=load;
    byId('perf338Profile').onchange=(e)=>{state.profileId=String(e.target.value||'');render();};
    byId('perf338AddExpectation').onclick=()=>manage({entity:'performance_expectation',action:'create',role_key:byId('perf338RoleKey').value.trim()||'employee',expectation_area:byId('perf338ExpectationArea').value.trim()||'role',expectation_title:byId('perf338ExpectationTitle').value.trim(),expectation_text:byId('perf338ExpectationText').value.trim()},'Role expectation recorded.');
    byId('perf338AddCoaching').onclick=()=>manage({entity:'performance_coaching',action:'create',profile_id:state.profileId,record_type:byId('perf338CoachingType').value,topic:byId('perf338CoachingTopic').value.trim(),summary:byId('perf338CoachingSummary').value.trim(),follow_up_date:byId('perf338CoachingFollowUp').value||null},'Coaching / recognition record saved.');
    byId('perf338AddPlan').onclick=()=>manage({entity:'performance_development_plan',action:'create',profile_id:state.profileId,plan_title:byId('perf338PlanTitle').value.trim(),goal_text:byId('perf338PlanGoal').value.trim(),skill_id:byId('perf338PlanSkill').value||null,target_date:byId('perf338PlanTarget').value||null},'Development plan saved.');
    byId('perf338AddReview').onclick=()=>manage({entity:'performance_review',action:'create',profile_id:state.profileId,review_period_start:byId('perf338ReviewStart').value||null,review_period_end:byId('perf338ReviewEnd').value||null,summary:byId('perf338ReviewSummary').value.trim(),strengths:byId('perf338ReviewStrengths').value.trim(),development_focus:byId('perf338ReviewFocus').value.trim(),follow_up_date:byId('perf338ReviewFollowUp').value||null},'Draft review saved.');
    byId('perf338AddAction').onclick=()=>manage({entity:'performance_improvement_action',action:'create',profile_id:state.profileId,action_text:byId('perf338ActionText').value.trim(),success_measure:byId('perf338ActionMeasure').value.trim(),due_date:byId('perf338ActionDue').value||null,follow_up_date:byId('perf338ActionFollowUp').value||null},'Improvement action saved.');
    byId('perf338Record').onclick=(e)=>{
      const p=e.target.closest('[data-complete-plan]'); if(p){manage({entity:'performance_development_plan',action:'complete',item_id:p.getAttribute('data-complete-plan')},'Development plan completed.');return;}
      const r=e.target.closest('[data-complete-review]'); if(r){manage({entity:'performance_review',action:'complete',item_id:r.getAttribute('data-complete-review')},'Review completed.');return;}
      const a=e.target.closest('[data-complete-action]'); if(a)manage({entity:'performance_improvement_action',action:'complete',item_id:a.getAttribute('data-complete-action')},'Improvement action completed.');
    };
    await load();
  }

  window.YWIPerformanceDevelopmentUI=Object.freeze({BUILD,mount});
})();
