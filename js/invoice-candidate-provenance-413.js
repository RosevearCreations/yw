/* Build 413 — read-only first-job Finance invoice candidate provenance. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=d=>{const t=Date.parse(String(d?.retrieved_at||''));return Number.isFinite(t)&&t<=Date.now()+300000&&Date.now()-t<=300000;};
const states={qc_approval_hold:'HOLD: required QC supervisor approval incomplete',
 closeout_or_signoff_hold:'HOLD: closeout, customer signoff or invoice readiness unapproved',
 finance_candidate_missing:'HOLD: no canonical Finance invoice candidate',
 candidate_provenance_missing:'HOLD: candidate lacks Finance completion-review authority',
 candidate_status_hold:'HOLD: Finance candidate state not approved for this trace',
 candidate_draft_pending_review:'Candidate exists as draft; Finance review pending, NOT invoiced',
 candidate_ready_unposted:'Finance candidate ready; NOT posted or invoiced',
 candidate_reviewed_unposted:'Finance candidate reviewed; NOT an issued invoice',
 candidate_posted_requires_invoice_reconciliation:'Candidate posting state recorded; actual A/R invoice must be verified separately'};
function mount(){
 const host=$('admin');if(!host||$('candidate413'))return;
 const p=document.createElement('details');p.id='candidate413';p.className='admin-hub-detail';
 p.dataset.adminHubTitle='First-job invoice readiness and candidate provenance';p.dataset.adminHubGroups='finance operations';
 p.innerHTML='<summary>413 · Invoice Readiness &amp; Candidate Provenance</summary>'+
 '<div class="admin-panel-block"><p>Supervisor Finance/Jobs review of approved QC and closeout to the original first work order and Finance invoice candidate. A draft, ready, reviewed or posting-marked candidate is NOT proof an invoice exists.</p>'+
 '<button id="candidate413Recheck" type="button" class="secondary">Recheck Finance candidate evidence</button> '+
 '<a href="/help.html#invoice-candidate-provenance-413" aria-label="Help: invoice candidate provenance">ⓘ Help</a>'+
 '<p id="candidate413Status" role="status" aria-live="polite">Not checked.</p>'+
 '<div id="candidate413Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(p);let busy=false;
 $('candidate413Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const button=$('candidate413Recheck'),status=$('candidate413Status'),out=$('candidate413Rows');
  button.disabled=true;out.replaceChildren();status.textContent='Checking current QC/closeout/Finance identity…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Finance source unavailable');
   const result=await api.loadAdminDirectory({scope:'first_job_invoice_candidate_provenance'});
   if(result?.ok!==true)throw Error(result?.error||'Access denied');
   const d=result.trace_413;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.records)||d.state==='withheld'){
    status.textContent='WITHHELD: '+String(d?.reason||'Authorized fresh complete evidence not verified.');
    out.innerHTML='<p data-candidate413-state="withheld">No invoice candidate or approval claimed.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length)throw Error('Inconsistent no-record response');
    status.textContent='No accepted first-job cohort in current complete source.';
    out.innerHTML='<p data-candidate413-state="no_record">No invoice candidate inferred.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>150)throw Error('Unknown or capped source');
   status.textContent=d.records.length+' first-job candidate(s) inspected. No Finance writes.';
   out.innerHTML=d.records.map(r=>{
    const present=['candidate_draft_pending_review','candidate_ready_unposted','candidate_reviewed_unposted','candidate_posted_requires_invoice_reconciliation'].includes(r.provenance_state);
    return '<article class="notice" data-candidate413-state="'+(present?'recorded':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>First work order '+esc(r.first_work_order_number||r.first_work_order_id)+'</strong>'+
      '<p>Estimate: '+esc(r.estimate_number||r.estimate_id)+'</p>'+
      '<p>QC approval: '+esc(r.qc_reviewed_at||'Not verified')+' · closeout approval: '+esc(r.closeout_approved_at||'Not verified')+'</p>'+
      '<p>Customer signoff: '+esc(r.customer_signoff_status||'Not recorded')+'</p>'+
      '<p>Finance candidate: '+esc(r.invoice_candidate_number||r.invoice_candidate_id||'Not recorded')+
      ' · status: '+esc(r.candidate_status||'Not recorded')+'</p>'+
      '<p>Finance completion review: '+esc(r.finance_completion_review_id||'Not verified')+'</p>'+
      '<p><strong>'+esc(states[r.provenance_state]||'HOLD: unexpected provenance state')+'</strong></p>'+
      '<p>No invoice posting, collection, payment, provider call or customer message.</p></article>';
   }).join('');
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();