/* File: js/admin-workforce-ui.js
   Build 336 — Employee & Crew Management.
   Extends canonical profiles, crews/crew_members and Build 330 training/authorization evidence.
*/
'use strict';
(function(){
  const BUILD=336;
  const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const byId=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function makeHost(){
    const admin=byId('admin'); if(!admin) return null;
    let host=byId('employeeCrewManagement336'); if(host) return host;
    host=document.createElement('details');
    host.id='employeeCrewManagement336';
    host.className='admin-hub-detail';
    host.dataset.adminHubTitle='Employee & Crew Management';
    host.dataset.adminHubGroups='people';
    host.open=true;
    host.innerHTML=[
      '<summary><span>Employee &amp; Crew Management</span><small>Build 336 · workforce operations</small></summary>',
      '<div class="admin-panel-block" data-build="336">',
      '<div class="section-heading"><div><span class="module-kicker">Build 336 · workforce operations</span><h3>Employee &amp; Crew Management</h3><p class="section-subtitle">Status, role, supervisor, crew, skills, availability, seasonal dates and readiness using existing staff, crew and training authorities.</p></div><button id="workforce336Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Privacy boundary:</strong> home address and emergency contacts are available only in this Admin-manage workspace. Operational workforce views omit them. Skills do not grant equipment or legal authorization; Build 330 remains the training and internal-authorization authority.</div>',
      '<div id="workforce336Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Employee operations</h4><div class="grid">',
      '<label>Employee<select id="workforce336Profile"></select></label>',
      '<label>Role<select id="workforce336Role"><option>employee</option><option>site_leader</option><option>supervisor</option><option>hse</option><option>job_admin</option><option>admin</option></select></label>',
      '<label>Employment<select id="workforce336Employment"><option>active</option><option>inactive</option><option>leave</option><option>blocked</option><option>terminated</option></select></label>',
      '<label>Position<input id="workforce336Position" type="text"></label>',
      '<label>Supervisor<select id="workforce336Supervisor"></select></label>',
      '<label>Availability<select id="workforce336AvailabilityStatus"><option>available</option><option>limited</option><option>unavailable</option><option>leave</option></select></label>',
      '<label>Seasonal status<select id="workforce336Seasonal"><option value="year_round">Year round</option><option value="spring_summer">Spring / summer</option><option value="fall_winter">Fall / winter</option><option value="seasonal">Seasonal</option><option value="on_call">On call</option><option value="inactive">Inactive</option></select></label>',
      '<label>Active from<input id="workforce336ActiveFrom" type="date"></label><label>Active until<input id="workforce336ActiveUntil" type="date"></label>',
      '<label>Account active<input id="workforce336IsActive" type="checkbox"></label></div>',
      '<details style="margin-top:10px;"><summary>Private contact / emergency information</summary><div class="grid" style="margin-top:10px;">',
      '<label>Phone<input id="workforce336Phone" type="tel"></label><label>Address 1<input id="workforce336Address1" type="text"></label><label>Address 2<input id="workforce336Address2" type="text"></label>',
      '<label>City<input id="workforce336City" type="text"></label><label>Province<input id="workforce336Province" type="text"></label><label>Postal code<input id="workforce336Postal" type="text"></label>',
      '<label>Emergency contact<input id="workforce336EmergencyName" type="text"></label><label>Emergency phone<input id="workforce336EmergencyPhone" type="tel"></label></div></details>',
      '<button id="workforce336SaveProfile" class="primary" type="button">Save Employee</button><div id="workforce336Readiness" class="notice" style="margin-top:10px;"></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Skills &amp; availability</h4><div class="grid">',
      '<label>Skill<select id="workforce336Skill"></select></label><label>Proficiency<select id="workforce336Proficiency"><option>awareness</option><option>basic</option><option>competent</option><option>advanced</option><option>lead</option></select></label>',
      '<label>Verified<input id="workforce336SkillVerified" type="checkbox"></label><label>Evidence<input id="workforce336SkillEvidence" type="text"></label></div><button id="workforce336AssignSkill" class="secondary" type="button">Assign / Update Skill</button>',
      '<div class="grid" style="margin-top:12px;"><label>Day<select id="workforce336Day"><option value="">Date range / any day</option><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>',
      '<label>Status<select id="workforce336WindowStatus"><option>available</option><option>preferred</option><option>on_call</option><option>unavailable</option></select></label><label>Start<input id="workforce336StartTime" type="time"></label><label>End<input id="workforce336EndTime" type="time"></label>',
      '<label>From<input id="workforce336EffectiveFrom" type="date"></label><label>Until<input id="workforce336EffectiveUntil" type="date"></label><label>Note<input id="workforce336AvailabilityNote" type="text"></label></div><button id="workforce336AddAvailability" class="secondary" type="button">Add Availability</button>',
      '<div class="table-scroll" style="margin-top:10px;"><table><thead><tr><th>Evidence</th><th>Status</th><th>Detail</th><th>Action</th></tr></thead><tbody id="workforce336EvidenceBody"></tbody></table></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Crew management</h4><div class="grid">',
      '<label>Crew<select id="workforce336Crew"><option value="">New crew</option></select></label><label>Code<input id="workforce336CrewCode" type="text"></label><label>Name<input id="workforce336CrewName" type="text"></label><label>Kind<input id="workforce336CrewKind" type="text" value="general"></label>',
      '<label>Status<select id="workforce336CrewStatus"><option>active</option><option>inactive</option><option>archived</option></select></label><label>Seasonal<select id="workforce336CrewSeasonal"><option value="year_round">Year round</option><option value="spring_summer">Spring / summer</option><option value="fall_winter">Fall / winter</option><option value="seasonal">Seasonal</option><option value="on_call">On call</option><option value="inactive">Inactive</option></select></label>',
      '<label>Supervisor<select id="workforce336CrewSupervisor"></select></label><label>Lead<select id="workforce336CrewLead"></select></label><label>Active from<input id="workforce336CrewFrom" type="date"></label><label>Active until<input id="workforce336CrewUntil" type="date"></label>',
      '<label>Members<select id="workforce336CrewMembers" multiple size="6"></select></label><label>Notes<input id="workforce336CrewNotes" type="text"></label></div><button id="workforce336SaveCrew" class="primary" type="button">Save Crew</button> <button id="workforce336ArchiveCrew" class="secondary" type="button">Archive Crew</button>',
      '<div class="table-scroll" style="margin-top:10px;"><table><thead><tr><th>Crew</th><th>Lead / supervisor</th><th>Members</th><th>Season</th><th>Status</th></tr></thead><tbody id="workforce336CrewBody"></tbody></table></div></div>',
      '</div>'
    ].join('');
    const shell=admin.querySelector('.admin-hub-shell');
    if(shell) shell.insertAdjacentElement('afterend',host); else admin.appendChild(host);
    return host;
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI;
    if(!api?.loadAdminDirectory||!api?.manageAdminEntity) return;
    const host=makeHost(); if(!host||host.dataset.mounted==='1') return;
    host.dataset.mounted='1';
    const state={payload:{},profileId:'',crewId:''};
    const rows=()=>Array.isArray(state.payload.workforce_profiles)?state.payload.workforce_profiles:[];
    const profile=()=>rows().find((x)=>String(x.id)===String(state.profileId))||null;
    const crew=()=>Array.isArray(state.payload.workforce_crews)?state.payload.workforce_crews.find((x)=>String(x.id)===String(state.crewId)):null;
    const contactMap=()=>new Map((state.payload.workforce_private_contacts||[]).map((x)=>[String(x.id),x]));
    const msg=(t,bad=false)=>{const e=byId('workforce336Readiness');if(e){e.textContent=t;e.classList.toggle('error',bad);}};
    function peopleOptions(selected=''){return '<option value="">—</option>'+rows().map((p)=>'<option value="'+esc(p.id)+'" '+(String(p.id)===String(selected)?'selected':'')+'>'+esc(p.full_name||p.email||p.id)+' · '+esc(p.role||'')+'</option>').join('');}
    function renderEvidence(){
      const p=profile(),body=byId('workforce336EvidenceBody'); if(!p||!body)return;
      const skillRows=(p.skills_json||[]).map((s)=>'<tr><td>Skill · '+esc(s.skill_name)+'</td><td>'+esc(s.proficiency_level)+'</td><td>'+(s.verified_at?'Verified '+esc(s.verified_at):'Operational skill only')+'</td><td>—</td></tr>');
      const availability=(state.payload.workforce_availability_windows||[]).filter((x)=>String(x.profile_id)===String(p.id)&&x.is_active!==false).map((x)=>'<tr><td>Availability · '+esc(x.day_of_week==null?'date range / any day':dayNames[Number(x.day_of_week)]||x.day_of_week)+'</td><td>'+esc(x.availability_status)+'</td><td>'+esc([x.start_time,x.end_time,x.effective_from,x.effective_until,x.availability_note].filter(Boolean).join(' · '))+'</td><td><button class="secondary" data-remove-window="'+esc(x.id)+'" type="button">Remove</button></td></tr>');
      const training=(state.payload.workforce_training_readiness||[]).filter((x)=>String(x.profile_id)===String(p.id)).map((x)=>'<tr><td>Training · '+esc(x.requirement_name)+'</td><td>'+esc(String(x.readiness_status||'').replaceAll('_',' '))+'</td><td>'+(x.internal_authorization_required?'Internal authorization: '+esc(x.internal_authorization_status||'pending'):'Build 330 evidence')+'</td><td>Build 330</td></tr>');
      body.innerHTML=skillRows.concat(availability,training).join('')||'<tr><td colspan="4" class="muted">No workforce evidence.</td></tr>';
    }
    function renderProfile(){
      const p=profile();if(!p)return;const c=contactMap().get(String(p.id))||{};
      byId('workforce336Role').value=p.role||'employee';byId('workforce336Employment').value=p.employment_status||'active';byId('workforce336Position').value=p.current_position||'';
      byId('workforce336Supervisor').innerHTML=peopleOptions(p.effective_supervisor_profile_id||'');byId('workforce336AvailabilityStatus').value=p.workforce_availability_status||'available';byId('workforce336Seasonal').value=p.seasonal_status||'year_round';
      byId('workforce336ActiveFrom').value=p.workforce_active_from||'';byId('workforce336ActiveUntil').value=p.workforce_active_until||'';byId('workforce336IsActive').checked=p.is_active!==false;
      byId('workforce336Phone').value=c.phone||'';byId('workforce336Address1').value=c.address_line1||'';byId('workforce336Address2').value=c.address_line2||'';byId('workforce336City').value=c.city||'';byId('workforce336Province').value=c.province||'';byId('workforce336Postal').value=c.postal_code||'';byId('workforce336EmergencyName').value=c.emergency_contact_name||'';byId('workforce336EmergencyPhone').value=c.emergency_contact_phone||'';
      msg('Crew: '+(p.primary_crew_name||'unassigned')+' · skills '+Number(p.skill_count||0)+' · training '+Number(p.training_current_count||0)+'/'+Number(p.training_requirement_count||0)+' current · training attention '+Number(p.training_blocker_count||0)+' · internal authorization pending '+Number(p.internal_authorization_pending_count||0)+'.');
      renderEvidence();
    }
    function renderCrew(){
      const c=crew();
      byId('workforce336CrewSupervisor').innerHTML=peopleOptions(c?.supervisor_profile_id||'');byId('workforce336CrewLead').innerHTML=peopleOptions(c?.lead_profile_id||'');
      byId('workforce336CrewCode').value=c?.crew_code||'';byId('workforce336CrewName').value=c?.crew_name||'';byId('workforce336CrewKind').value=c?.crew_kind||'general';byId('workforce336CrewStatus').value=c?.crew_status||'active';byId('workforce336CrewSeasonal').value=c?.seasonal_status||'year_round';byId('workforce336CrewFrom').value=c?.active_from||'';byId('workforce336CrewUntil').value=c?.active_until||'';byId('workforce336CrewNotes').value=c?.notes||'';
      const ids=new Set((c?.members_json||[]).filter((m)=>m.membership_status!=='ended').map((m)=>String(m.profile_id)));[...byId('workforce336CrewMembers').options].forEach((o)=>o.selected=ids.has(String(o.value)));
    }
    function render(){
      const s=(state.payload.workforce_summary||[])[0]||{};byId('workforce336Summary').innerHTML=[['Active',s.active_profile_count||0],['Training attention',s.training_attention_count||0],['Authorization attention',s.authorization_attention_count||0],['Availability attention',s.availability_attention_count||0]].map((x)=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      if(!state.profileId&&rows()[0])state.profileId=String(rows()[0].id);byId('workforce336Profile').innerHTML=rows().map((p)=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.email||p.id)+' · '+esc(p.workforce_state||'')+'</option>').join('');byId('workforce336Profile').value=state.profileId;
      byId('workforce336Skill').innerHTML=(state.payload.workforce_skills||[]).filter((x)=>x.is_active!==false).map((x)=>'<option value="'+esc(x.id)+'">'+esc(x.skill_name)+' · '+esc(x.skill_category)+'</option>').join('');
      byId('workforce336CrewMembers').innerHTML=rows().map((p)=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.email||p.id)+'</option>').join('');
      const crews=state.payload.workforce_crews||[];byId('workforce336Crew').innerHTML='<option value="">New crew</option>'+crews.map((c)=>'<option value="'+esc(c.id)+'">'+esc(c.crew_name)+' · '+esc(c.crew_status)+'</option>').join('');byId('workforce336Crew').value=state.crewId;
      byId('workforce336CrewBody').innerHTML=crews.length?crews.map((c)=>'<tr><td>'+esc(c.crew_code||'')+' · '+esc(c.crew_name)+'</td><td>'+esc(c.lead_name||'—')+' / '+esc(c.supervisor_name||'—')+'</td><td>'+Number(c.active_member_count||0)+'</td><td>'+esc(c.seasonal_status||'year_round')+'</td><td>'+esc(c.crew_status||'')+'</td></tr>').join(''):'<tr><td colspan="5" class="muted">No crews.</td></tr>';
      renderProfile();renderCrew();
    }
    async function load(){msg('Loading workforce operations…');const r=await api.loadAdminDirectory({scope:'workforce',limit:500});if(!r?.ok)return msg(r?.error||'Workforce load failed.',true);state.payload=r;if(!rows().some((x)=>String(x.id)===String(state.profileId)))state.profileId=rows()[0]?.id||'';render();}
    async function saveProfile(){const p=profile();if(!p)return;const r=await api.manageAdminEntity({entity:'workforce_profile',action:'save',profile_id:p.id,role:byId('workforce336Role').value,employment_status:byId('workforce336Employment').value,current_position:byId('workforce336Position').value.trim(),supervisor_profile_id:byId('workforce336Supervisor').value||null,workforce_availability_status:byId('workforce336AvailabilityStatus').value,seasonal_status:byId('workforce336Seasonal').value,workforce_active_from:byId('workforce336ActiveFrom').value||null,workforce_active_until:byId('workforce336ActiveUntil').value||null,is_active:byId('workforce336IsActive').checked,phone:byId('workforce336Phone').value.trim(),address_line1:byId('workforce336Address1').value.trim(),address_line2:byId('workforce336Address2').value.trim(),city:byId('workforce336City').value.trim(),province:byId('workforce336Province').value.trim(),postal_code:byId('workforce336Postal').value.trim(),emergency_contact_name:byId('workforce336EmergencyName').value.trim(),emergency_contact_phone:byId('workforce336EmergencyPhone').value.trim()});if(!r?.ok)return msg(r?.error||'Employee save failed.',true);await load();}
    async function saveSkill(){const p=profile(),skill=byId('workforce336Skill').value;if(!p||!skill)return;const r=await api.manageAdminEntity({entity:'workforce_profile_skill',action:'save',profile_id:p.id,skill_id:skill,proficiency_level:byId('workforce336Proficiency').value,evidence_note:byId('workforce336SkillEvidence').value.trim(),verified:byId('workforce336SkillVerified').checked});if(!r?.ok)return msg(r?.error||'Skill save failed.',true);await load();}
    async function saveAvailability(){const p=profile();if(!p)return;const r=await api.manageAdminEntity({entity:'workforce_availability',action:'save',profile_id:p.id,day_of_week:byId('workforce336Day').value,availability_status:byId('workforce336WindowStatus').value,start_time:byId('workforce336StartTime').value,end_time:byId('workforce336EndTime').value,effective_from:byId('workforce336EffectiveFrom').value,effective_until:byId('workforce336EffectiveUntil').value,availability_note:byId('workforce336AvailabilityNote').value.trim()});if(!r?.ok)return msg(r?.error||'Availability save failed.',true);await load();}
    async function removeWindow(id){const p=profile();if(!p)return;const r=await api.manageAdminEntity({entity:'workforce_availability',action:'remove',profile_id:p.id,item_id:id});if(!r?.ok)return msg(r?.error||'Availability remove failed.',true);await load();}
    async function saveCrew(){const members=[...byId('workforce336CrewMembers').selectedOptions].map((o)=>({profile_id:o.value,member_role:'member',membership_status:'active'}));const r=await api.manageAdminEntity({entity:'workforce_crew',action:'save',crew_id:state.crewId||null,crew_code:byId('workforce336CrewCode').value.trim(),crew_name:byId('workforce336CrewName').value.trim(),crew_kind:byId('workforce336CrewKind').value.trim(),crew_status:byId('workforce336CrewStatus').value,seasonal_status:byId('workforce336CrewSeasonal').value,supervisor_profile_id:byId('workforce336CrewSupervisor').value||null,lead_profile_id:byId('workforce336CrewLead').value||null,active_from:byId('workforce336CrewFrom').value||null,active_until:byId('workforce336CrewUntil').value||null,notes:byId('workforce336CrewNotes').value.trim(),members});if(!r?.ok)return msg(r?.error||'Crew save failed.',true);state.crewId=r.record?.id||state.crewId;await load();}
    async function archiveCrew(){if(!state.crewId)return;const r=await api.manageAdminEntity({entity:'workforce_crew',action:'archive',crew_id:state.crewId});if(!r?.ok)return msg(r?.error||'Crew archive failed.',true);state.crewId='';await load();}
    byId('workforce336Refresh').onclick=load;byId('workforce336Profile').onchange=(e)=>{state.profileId=e.target.value;renderProfile();};byId('workforce336Crew').onchange=(e)=>{state.crewId=e.target.value;renderCrew();};byId('workforce336SaveProfile').onclick=saveProfile;byId('workforce336AssignSkill').onclick=saveSkill;byId('workforce336AddAvailability').onclick=saveAvailability;byId('workforce336SaveCrew').onclick=saveCrew;byId('workforce336ArchiveCrew').onclick=archiveCrew;
    byId('workforce336EvidenceBody').onclick=(e)=>{const b=e.target.closest('[data-remove-window]');if(b)removeWindow(b.getAttribute('data-remove-window'));};
    await load();
  }
  window.YWIWorkforceUI=Object.freeze({BUILD,mount});
})();