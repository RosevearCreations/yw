/* Build 409 — bounded first-dispatch schedule receipt; review only. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fresh=v=>{const n=Date.parse(String(v?.retrieved_at||''));return Number.isFinite(n)&&n<=Date.now()+300000&&Date.now()-n<=300000;};
const labelCode=code=>({
 crew_not_assigned:'Crew assignment missing',
 recorded_resource_conflict:'Recorded resource conflict',
 conflict_override_requires_manual_review:'Recorded conflict override requires manual review',
 dispatch_readiness_not_confirmed:'Dispatch readiness not confirmed'
}[code]||'Unclassified exception — review source');
function init(){
 const host=$('admin');if(!host||$('firstDispatch409'))return;
 const panel=document.createElement('details');panel.id='firstDispatch409';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='First dispatch schedule receipt';
 panel.dataset.adminHubGroups='jobs operations';
 panel.innerHTML='<summary>409 · First-Dispatch Schedule Receipt</summary><div class="admin-panel-block">'+
  '<p>Trace a source-authorized first work order to its earliest dated noncancelled dispatch. Crew/resource exceptions and weather/workability observations are reported separately. Schedule presence never means a crew was dispatched or weather is safe.</p>'+
  '<button id="dispatch409Recheck" class="secondary" type="button">Recheck first-dispatch evidence</button> '+
  '<a href="/help.html#first-dispatch-schedule-receipt-409" aria-label="Help: first-dispatch receipt">ⓘ Help</a>'+
  '<p id="dispatch409Status" role="status" aria-live="polite">Not checked.</p>'+
  '<div id="dispatch409Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(panel);let busy=false;
 $('dispatch409Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const btn=$('dispatch409Recheck'),status=$('dispatch409Status'),out=$('dispatch409Rows');
  btn.disabled=true;out.replaceChildren();status.textContent='Checking source completeness and receipt identity…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Jobs evidence authority unavailable');
   const response=await api.loadAdminDirectory({scope:'first_dispatch_schedule_receipt'});
   if(response?.ok!==true)throw Error(response?.error||'Jobs permission denied');
   const data=response?.receipt_409;
   if(!data||!data.complete||data.state==='withheld'||!fresh(data)||!Array.isArray(data.records)){
    status.textContent='WITHHELD: '+String(data?.reason||'Complete and fresh dispatch evidence is unavailable.');
    out.innerHTML='<p data-dispatch409-state="withheld">Source evidence withheld — recheck.</p>';return;
   }
   if(data.state==='no_record'){
    if(data.records.length)throw Error('Inconsistent no-record source');
    status.textContent='No accepted first-job dispatch cohort in this complete source read.';
    out.innerHTML='<p data-dispatch409-state="no_record">No first-dispatch schedule can be claimed.</p>';return;
   }
   if(data.state!=='recorded'||data.records.length>150)throw Error('Unexpected or capped evidence');
   status.textContent=data.records.length+' estimate(s) reviewed; no scheduling or assignment action performed.';
   out.innerHTML=data.records.map(r=>{
    const verified=r.schedule_state==='dated_non_cancelled_schedule_recorded'&&r.first_dispatch_id;
    const date=verified?esc(r.scheduled_start):'Not recorded / approval held';
    const issues=(Array.isArray(r.resource_exception_codes)?r.resource_exception_codes:[]).map(labelCode);
    const resources=r.resource_exception_state==='not_assessed'?'Not assessed — no authorized schedule':
      issues.length?issues.map(esc).join('; '):'No exception recorded in this read (not a safety clearance)';
    const weather=r.workability_exception_state==='unresolved_workability_exception'?
      'Unresolved workability exception — operator review required':
      r.workability_exception_state==='recorded_observation_not_clearance'?
      'Observation recorded — not a weather clearance':
      r.workability_exception_state==='not_observed'?
      'No linked observation — workability not verified':'Not assessed';
    return '<article class="notice" data-dispatch409-state="'+(verified?'matched':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
     '<strong>Estimate '+esc(r.estimate_number||r.estimate_id)+'</strong>'+
     '<p>First work order: '+esc(r.first_work_order_number||r.first_work_order_id||'Not recorded')+'</p>'+
     '<p>Authorization: '+esc(r.authorization_state==='confirmed_source_authorization'?'Verified in canonical sources':'Approval evidence missing — HOLD')+'</p>'+
     '<p>First noncancelled schedule: '+date+(verified?' · '+esc(r.schedule_status||'status unavailable'):'')+'</p>'+
     '<p><strong>Resource exceptions:</strong> '+resources+'</p>'+
     '<p><strong>Weather/workability:</strong> '+weather+'</p>'+
     '<p>Schedule evidence is not proof of dispatch, completion, or safe working conditions.</p></article>';
   }).join('');
  }catch(e){out.replaceChildren();status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
  finally{busy=false;btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();