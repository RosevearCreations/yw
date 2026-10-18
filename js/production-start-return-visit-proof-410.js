/* Build 410 — source-bound first-job production and return-visit proof. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fresh=d=>{const at=Date.parse(String(d?.retrieved_at||''));return Number.isFinite(at)&&at<=Date.now()+300000&&Date.now()-at<=300000;};
function init(){
 const host=$('admin');if(!host||$('production410'))return;
 const panel=document.createElement('details');panel.id='production410';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Production start and return-visit proof';
 panel.dataset.adminHubGroups='operations jobs';
 panel.innerHTML='<summary>410 · Production Start &amp; Return-Visit Proof</summary>'+
  '<div class="admin-panel-block"><p>Supervisor read-only comparison of an authorized scheduled first work order to an actual dated started session, its recorded field receipt, partial work and any subsequent return receipt. A scheduled visit is not an actual start.</p>'+
  '<button type="button" id="production410Recheck" class="secondary">Recheck production receipts</button> '+
  '<a href="/help.html#production-start-return-visit-410" aria-label="Help: production and return proof">ⓘ Help</a>'+
  '<p id="production410Status" role="status" aria-live="polite">Not checked.</p>'+
  '<div id="production410Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(panel);let busy=false;
 $('production410Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const btn=$('production410Recheck'),status=$('production410Status'),out=$('production410Rows');
  btn.disabled=true;out.replaceChildren();status.textContent='Inspecting first-job dispatch and field-capture receipts…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Jobs production source is unavailable');
   const result=await api.loadAdminDirectory({scope:'production_start_return_visit_proof'});
   if(result?.ok!==true)throw Error(result?.error||'Access denied');
   const d=result?.proof_410;
   if(!d||d.complete!==true||d.state==='withheld'||!fresh(d)||!Array.isArray(d.records)){
    status.textContent='WITHHELD: '+String(d?.reason||'Full fresh source not verified');
    out.innerHTML='<p data-production410-state="withheld">Production proof withheld until authorized recheck.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length)throw Error('Inconsistent no-record data');
    status.textContent='No accepted first-job cohort in the complete inspected source.';
    out.innerHTML='<p data-production410-state="no_record">No production starts or return visits claimed.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>150)throw Error('Unexpected or capped production evidence');
   status.textContent=d.records.length+' first-job candidate(s); '+
    d.records.filter(r=>r.production_proof_state==='dated_start_and_field_receipt_recorded').length+
    ' dated production start(s) with field receipts. Read only.';
   out.innerHTML=d.records.map(r=>{
    const good=r.production_proof_state==='dated_start_and_field_receipt_recorded';
    const start=good?'Dated production start '+esc(r.first_started_at)+' · Field receipt '+esc(r.field_receipt_recorded_at):
     r.production_proof_state==='started_at_without_field_receipt'?'Session start '+esc(r.first_started_at)+'; field receipt NOT verified':
      r.production_proof_state==='no_started_session'?'No actual started session recorded':
      r.production_proof_state==='scheduled_dispatch_missing'?'No matching dated noncancelled dispatch':'Authorization evidence missing — HOLD';
    const partial=r.partial_completion_state==='explicit_partial_evidence_recorded'?
      'Explicit partial/unfinished work recorded; NOT final completion':
      r.partial_completion_state==='partial_completion_not_proven'?
      'Partial work not verified':'Not assessed';
    const ret=r.return_visit_state==='dated_return_visit_receipt_recorded'?
      'Actual dated return start '+esc(r.return_started_at)+' and field receipt '+esc(r.return_field_receipt_at):
      r.return_visit_state==='return_started_no_field_receipt'?
      'Return start recorded, but field receipt missing':
      r.return_visit_state==='return_visit_pending_no_session_receipt'?
      'Return required; no actual dated return receipt yet':'No actual return visit proven';
    return '<article class="notice" style="min-width:0;overflow-wrap:anywhere" data-production410-state="'+(good?'verified':'held')+'">'+
      '<strong>Estimate '+esc(r.estimate_number||r.estimate_id)+'</strong>'+
      '<p>First work order: '+esc(r.first_work_order_number||r.first_work_order_id||'Not verified')+'</p>'+
      '<p>First scheduled dispatch: '+esc(r.first_scheduled_start||'Not verified')+'</p>'+
      '<p><strong>Actual production:</strong> '+start+'</p>'+
      '<p><strong>Partial work:</strong> '+partial+'</p>'+
      '<p>Actual quantity lines: '+esc(r.actual_quantity_receipt_count)+' · Execution proofs: '+esc(r.execution_proof_count)+'</p>'+
      '<p><strong>Return requirement:</strong> '+esc(r.return_required_state||'Not assessed')+'</p>'+
      '<p><strong>Return evidence:</strong> '+ret+'</p>'+
      '<p>No automated completion, staffing, weather clearance or invoice authorization.</p></article>';
   }).join('');
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();