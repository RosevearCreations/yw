/* Build 412 — first-job QC, supervisor and customer-safe closeout evidence. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=x=>{const t=Date.parse(String(x?.retrieved_at||''));return Number.isFinite(t)&&t<=Date.now()+300000&&Date.now()-t<=300000;};
const states={
 qc_inspection_missing:'HOLD: no actual QC inspection run recorded',
 qc_required_items_incomplete:'HOLD: required inspection results are not all passed or rework remains',
 qc_supervisor_approval_missing:'HOLD: actual dated supervisor QC approval not verified',
 closeout_approval_missing:'HOLD: dated supervisor closeout approval missing',
 customer_safe_proof_incomplete:'HOLD: approved customer-visible completion proof or gallery is incomplete',
 customer_signoff_pending:'HOLD: required customer closeout signoff not verified',
 qc_closeout_proof_verified:'QC, supervisor closeout and customer-safe proof completeness verified'
};
function mount(){
 const host=$('admin');if(!host||$('quality412'))return;
 const el=document.createElement('details');el.id='quality412';el.className='admin-hub-detail';
 el.dataset.adminHubTitle='First-job quality-control closeout evidence';el.dataset.adminHubGroups='operations jobs';
 el.innerHTML='<summary>412 · Quality-Control Closeout Evidence</summary>'+
 '<div class="admin-panel-block"><p>Supervisor read-only inspection. Planned checklists, submitted proofs and proposed signoffs are NOT actual approved QC or completed customer-safe proof.</p>'+
 '<button id="quality412Recheck" type="button" class="secondary">Recheck QC and closeout evidence</button> '+
 '<a href="/help.html#quality-control-closeout-evidence-412" aria-label="Help: QC closeout evidence">ⓘ Help</a>'+
 '<p id="quality412Status" role="status" aria-live="polite">Not checked.</p>'+
 '<div id="quality412Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(el);let busy=false;
 $('quality412Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const btn=$('quality412Recheck'),s=$('quality412Status'),out=$('quality412Rows');
  btn.disabled=true;out.replaceChildren();s.textContent='Checking fresh, complete QC sources…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Jobs QC source unavailable');
   const result=await api.loadAdminDirectory({scope:'first_job_quality_closeout_evidence'});
   if(result?.ok!==true)throw Error(result?.error||'Access denied');
   const d=result?.evidence_412;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.records)||d.state==='withheld'){
    s.textContent='WITHHELD: '+String(d?.reason||'Required source missing or incomplete.');
    out.innerHTML='<p data-quality412-state="withheld">QC evidence cannot be claimed until authorized recheck.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length)throw Error('Inconsistent no-record state');
    s.textContent='No accepted first-job cohort in complete QC source.';
    out.innerHTML='<p data-quality412-state="no_record">No completed QC, approved proof or customer signoff claimed.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>150)throw Error('Unexpected or capped QC evidence');
   s.textContent=d.records.length+' first-job candidate(s) reviewed · '+d.records.filter(r=>r.evidence_state==='qc_closeout_proof_verified').length+' verified. Read only.';
   out.innerHTML=d.records.map(r=>{
    const good=r.evidence_state==='qc_closeout_proof_verified';
    return '<article class="notice" data-quality412-state="'+(good?'verified':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>First work order '+esc(r.first_work_order_number||r.first_work_order_id)+'</strong>'+
      '<p>Estimate: '+esc(r.estimate_number||r.estimate_id)+'</p>'+
      '<p>QC run: '+esc(r.qc_run_id||'Not recorded')+' · status: '+esc(r.qc_run_status||'Not recorded')+'</p>'+
      '<p>Required QC items passed: '+esc(r.required_item_passed_count??'Unknown')+' / '+esc(r.required_item_count??'Unknown')+
      ' · failed: '+esc(r.failed_item_count??'Unknown')+' · unresolved rework: '+esc(r.unresolved_deficiency_count??'Unknown')+'</p>'+
      '<p>Dated supervisor QC review: '+esc(r.qc_reviewed_at||'Not verified')+' · closeout approval: '+esc(r.closeout_approved_at||'Not verified')+'</p>'+
      '<p>Approved customer-visible completion/quality proof: '+esc(r.approved_customer_visible_proof_count)+
      ' · approved customer-safe gallery assets: '+esc(r.approved_customer_gallery_asset_count)+'</p>'+
      '<p>Customer signoff: '+esc(r.customer_signoff_state||'Not recorded')+'</p>'+
      '<p><strong>'+esc(states[r.evidence_state]||'HOLD: unrecognized QC status')+'</strong></p>'+
      '<p>No signoff, customer message, review request, gallery publication or Finance posting occurs.</p></article>';
   }).join('');
  }catch(e){s.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();