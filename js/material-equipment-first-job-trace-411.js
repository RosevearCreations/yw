/* Build 411 — first-job material issues and equipment checkout trace; read-only. */
(()=>{'use strict';
const $=x=>document.getElementById(x);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=d=>{const t=Date.parse(String(d?.retrieved_at||''));return Number.isFinite(t)&&t<=Date.now()+300000&&Date.now()-t<=300000;};
function mount(){
 const host=$('admin');if(!host||$('materialEquipment411'))return;
 const panel=document.createElement('details');panel.id='materialEquipment411';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='First-job material and equipment trace';panel.dataset.adminHubGroups='operations jobs';
 panel.innerHTML='<summary>411 · Material &amp; Equipment First-Job Trace</summary><div class="admin-panel-block">'+
 '<p>Supervisor read-only reconciliation of original first-job material plans, actual issued lines, and equipment checkouts. Field receipts are separate from an issue/checkout. A current lockout is never cleared here.</p>'+
 '<button id="materialEquipment411Recheck" class="secondary" type="button">Recheck material and equipment evidence</button> '+
 '<a href="/help.html#material-equipment-first-job-411" aria-label="Help: first-job materials and equipment">ⓘ Help</a>'+
 '<p id="materialEquipment411Status" role="status" aria-live="polite">Not checked.</p>'+
 '<div id="materialEquipment411Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(panel);let busy=false;
 $('materialEquipment411Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const button=$('materialEquipment411Recheck'),status=$('materialEquipment411Status'),out=$('materialEquipment411Rows');
  button.disabled=true;out.replaceChildren();status.textContent='Checking complete, fresh material and equipment sources…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Jobs source unavailable');
   const response=await api.loadAdminDirectory({scope:'material_equipment_first_job_trace'});
   if(response?.ok!==true)throw Error(response?.error||'Access denied');
   const d=response?.trace_411;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.records)||d.state==='withheld'){
    status.textContent='WITHHELD: '+String(d?.reason||'Source completeness or authorization is unverified.');
    out.innerHTML='<p data-material411-state="withheld">Material/equipment trace withheld.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length)throw Error('Inconsistent no-record report');
    status.textContent='No accepted first-job cohort in the complete source.';
    out.innerHTML='<p data-material411-state="no_record">No material issues or equipment use assumed.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>150)throw Error('Capped/unknown evidence');
   status.textContent=d.records.length+' first-job record(s) reviewed; no inventory or equipment mutation.';
   out.innerHTML=d.records.map(r=>{
    const good=r.trace_state==='field_linked_receipts_recorded';
    const state=r.trace_state==='safety_lockout_hold'?'HOLD: at least one checked-out item is currently locked out':
      r.trace_state==='unmatched_or_capped_detail'?'HOLD: material issue not matched to original plan or detail capped':
      r.trace_state==='issue_or_checkout_only'?'Issuance/checkout only; verified field consumption or operation not proven':
      good?'Actual field-linked issue or checkout receipt recorded':'HOLD: unknown evidence state';
    const lines=Array.isArray(r.material_lines)?r.material_lines:[];
    return '<article class="notice" data-material411-state="'+(good?'recorded':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>First work order '+esc(r.first_work_order_number||r.first_work_order_id)+'</strong>'+
      '<p>Estimate: '+esc(r.estimate_number||r.estimate_id)+'</p>'+
      '<p>Materials: '+esc(r.planned_material_lines)+' planned line(s) · '+esc(r.issued_material_lines)+' issued job-use line(s) · '+esc(r.material_issues_with_field_receipt)+' issue(s) with field receipts</p>'+
      '<p>Unmatched material issues: '+esc(r.unmatched_material_lines)+' · detailed plan capped: '+esc(r.material_line_cap===true?'YES':'no')+'</p>'+
      '<p>Equipment: '+esc(r.planned_equipment_lines)+' planned line(s) · '+esc(r.equipment_checkout_count)+' checkout(s) · '+esc(r.equipment_checkout_with_field_receipt)+' field-linked checkout(s) · '+esc(r.equipment_plan_matches)+' planned-master matches</p>'+
      '<p><strong>'+esc(state)+'</strong></p>'+
      (lines.length?'<ul>'+lines.map(l=>'<li>Material plan '+esc(l.planned_line_id)+': planned '+esc(l.planned_quantity)+', issued '+esc(l.issued_quantity)+', field-linked issue line(s) '+esc(l.verified_field_receipt_lines)+'</li>').join('')+'</ul>':'')+
      '<p>No stock correction, equipment lockout override, purchase, job-cost posting or automated signoff.</p></article>';
   }).join('');
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();