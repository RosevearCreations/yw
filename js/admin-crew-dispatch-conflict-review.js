/* Build 394: fail-closed advisory crew/dispatch conflict review; no writes. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>{if(!v)return NaN;const n=Date.parse(v);return Number.isFinite(n)?n:NaN};
function check(j,all,crews,requirements,equipment,fleet){
 const issues=[],crewId=j.crew_id||j.assigned_crew_id;
 const start=time(j.scheduled_start_at||j.planned_start_at||j.start_at);
 const end=time(j.scheduled_end_at||j.planned_end_at||j.end_at);
 if(!crewId)issues.push('No confirmed crew assignment');
 else if(!crews.some(c=>String(c.id)===String(crewId)))issues.push('Assigned crew missing from authoritative directory');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)issues.push('Complete scheduled start/end timestamps unavailable — overlap unverified');
 else if(crewId){
 const overlap=all.filter(x=>x!==j&&String(x.crew_id||x.assigned_crew_id||'')===String(crewId)&&!['cancelled','canceled','complete','completed'].includes(String(x.status||x.job_status||'').toLowerCase())&&time(x.scheduled_start_at||x.planned_start_at||x.start_at)<end&&time(x.scheduled_end_at||x.planned_end_at||x.end_at)>start);
 if(overlap.length)issues.push(overlap.length+' overlapping crew assignment(s)');
 }
 const req=requirements.filter(x=>String(x.job_id)===String(j.id));
 if(req.length&&!equipment.length)issues.push('Equipment readiness source unavailable');
 for(const x of req){const item=equipment.find(e=>String(e.id)===String(x.equipment_id||x.equipment_item_id));
 if(!item)issues.push('Required equipment not found');
 else if(/lockout|out.of.service|unavailable|maintenance/.test(String(item.status||item.availability_status||'').toLowerCase()))issues.push('Required equipment not ready: '+String(item.equipment_name||item.equipment_code||item.id));}
 if(!fleet.length)issues.push('Vehicle readiness not verified in Jobs response');
 return issues;
}
function init(){
 const admin=$('admin');if(!admin||$('dispatchReview394'))return;
 const el=document.createElement('details');el.id='dispatchReview394';el.className='admin-hub-detail';el.dataset.adminHubGroups='operations';el.dataset.adminHubTitle='Crew dispatch conflict review';
 el.innerHTML='<summary>Build 394 · Crew Availability &amp; Dispatch Conflict Gate</summary><div class="admin-panel-block"><p>Read-only dispatch preflight. Missing schedule, shift, vehicle or equipment evidence is a BLOCKED/UNKNOWN review—not dispatch approval. Existing Jobs authority remains final. No route, crew, job or schedule mutation.</p><button type="button" class="secondary" id="dispatch394Refresh">Check current Jobs evidence</button><p id="dispatch394Status" role="status" aria-live="polite">Choose Check current Jobs evidence.</p><div id="dispatch394Rows"></div></div>';
 admin.appendChild(el);let busy=false;
 $('dispatch394Refresh').onclick=async()=>{
 if(busy)return;busy=true;const b=$('dispatch394Refresh');b.disabled=true;b.textContent='Checking…';const stat=$('dispatch394Status');
 try{const api=window.YWIAPI;if(typeof api?.fetchJobsDirectory!=='function')throw Error('Authorized Jobs directory unavailable');
 const v=await api.fetchJobsDirectory({scope:'all'});if(v?.ok===false||!Array.isArray(v?.jobs)||!Array.isArray(v?.crews)||!Array.isArray(v?.requirements)||!Array.isArray(v?.equipment))throw Error(v?.error||'Required canonical Jobs sources missing');
 const jobs=v.jobs.filter(j=>!['cancelled','canceled','complete','completed'].includes(String(j.status||j.job_status||'').toLowerCase())).slice(0,150);
 const fleet=Array.isArray(v.fleet_vehicle_operations)?v.fleet_vehicle_operations:[];
 const reviewed=jobs.map(j=>({j,issues:check(j,v.jobs,v.crews,v.requirements,v.equipment,fleet)}));
 stat.textContent=reviewed.length+' job(s) reviewed; '+reviewed.filter(x=>x.issues.length).length+' require attention. This advisory cannot clear dispatch authorization.';
 $('dispatch394Rows').innerHTML=reviewed.length?reviewed.map(({j,issues})=>'<div class="notice"><strong>'+esc(j.job_name||j.job_code||j.id)+'</strong> · '+(issues.length?'BLOCKED / VERIFY':'NO CONFLICT IN CHECKED FIELDS — operator verification required')+'<br>'+esc(issues.join('; ')||'Verify shift availability, vehicle linkage and dispatch authority manually before assignment')+'</div>').join(''):'<p>No active jobs returned. No schedule/dispatch approval is implied.</p>';
 }catch(e){$('dispatch394Rows').textContent='';stat.textContent='BLOCKED: '+String(e?.message||e)}
 finally{busy=false;b.disabled=false;b.textContent='Check current Jobs evidence';}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
