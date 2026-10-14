/* Build 397 — read-only, fail-closed operator preflight. Does not authorize starting work. */
(()=>{'use strict';
const byId=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=j=>!['cancelled','canceled','complete','completed'].includes(String(j.status||j.job_status||'').toLowerCase());
const blocked=x=>/lockout|locked|out.of.service|unavailable|maintenance|failed|unsafe|quarantine|red.tag/i.test(String(x??''));
function assess(job,response){
  const issues=[];
  const id=String(job.id);
  const requirements=response.requirements.filter(r=>String(r.job_id)===id);
  // This endpoint has Jobs/equipment data but is NOT authoritative for Safety
  // plan approval or the training matrix. Never treat their absence as a pass.
  issues.push('Safety plan, site-hazard signoff and worker training currency require authorized Safety verification');
  const site=job.site||job.property||job.client_site||null;
  if(!site)issues.push('Canonical site hazard details not supplied with this job');
  else {
    const hazard=site.hazards||site.site_hazards||site.hazard_notes;
    if(hazard)issues.push('Site hazards must be reviewed in Safety: '+String(hazard).slice(0,180));
    else issues.push('No verified site hazard assessment supplied');
  }
  if(!requirements.length)issues.push('No validated equipment requirement assessment supplied');
  for(const req of requirements){
    const equipment=response.equipment.find(e=>String(e.id)===String(req.equipment_id||req.equipment_item_id));
    if(!equipment){issues.push('Required equipment missing or inaccessible');continue;}
    const label=String(equipment.equipment_name||equipment.name||equipment.equipment_code||equipment.id);
    if(blocked(equipment.status)||blocked(equipment.availability_status)||blocked(equipment.lockout_status))
      issues.push('Equipment BLOCKED: '+label);
    else issues.push('Verify current inspection and lockout authority in Equipment: '+label);
  }
  return {state:'BLOCKED / UNVERIFIED',issues};
}
function init(){
  const admin=byId('admin');if(!admin||byId('preflight397'))return;
  const el=document.createElement('details');el.id='preflight397';el.className='admin-hub-detail';
  el.dataset.adminHubGroups='operations';el.dataset.adminHubTitle='Safety and equipment readiness preflight';
  el.innerHTML='<summary>Build 397 · Safety &amp; Equipment Readiness Preflight</summary><div class="admin-panel-block"><p>Advisory only. A job cannot be marked safe by this review. Open the canonical Safety and Equipment modules for hazard plans, training, inspections and lockouts. Missing or stale evidence is BLOCKED / UNVERIFIED; this panel cannot approve work, remove lockouts or change employee status.</p><button type="button" class="secondary" id="preflight397Refresh">Recheck authorized job and equipment records</button><p id="preflight397Status" role="status" aria-live="polite">No current evidence retrieved.</p><div id="preflight397Rows"></div></div>';
  admin.appendChild(el);let busy=false;
  byId('preflight397Refresh').addEventListener('click',async()=>{
    if(busy)return;busy=true;
    const button=byId('preflight397Refresh'),status=byId('preflight397Status'),rows=byId('preflight397Rows');
    button.disabled=true;button.textContent='Checking…';rows.replaceChildren();
    try{
      const api=window.YWIAPI;
      if(typeof api?.fetchJobsDirectory!=='function')throw Error('Authorized Jobs source not available');
      const v=await api.fetchJobsDirectory({scope:'all'});
      if(v?.ok===false||!Array.isArray(v?.jobs)||!Array.isArray(v?.requirements)||!Array.isArray(v?.equipment))throw Error(v?.error||'A required canonical source is unavailable');
      const jobs=v.jobs.filter(active);
      if(jobs.length>150)throw Error('More than 150 active jobs: narrow review in Jobs; no partial clearance');
      status.textContent=jobs.length+' active jobs reviewed · all require separate current Safety authorization. No clearance issued.';
      rows.innerHTML=jobs.length?jobs.map(j=>{
        const result=assess(j,v);
        return '<div class="notice"><strong>'+esc(j.job_name||j.job_code||j.id)+'</strong> · '+result.state+'<ul>'+result.issues.map(issue=>'<li>'+esc(issue)+'</li>').join('')+'</ul></div>';
      }).join(''):'<p>No active jobs returned. No Safety approval is implied.</p>';
    }catch(error){status.textContent='BLOCKED / UNAVAILABLE: '+String(error?.message||error);}
    finally{busy=false;button.disabled=false;button.textContent='Recheck authorized job and equipment records';}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();