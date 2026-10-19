/* Build 414 — bounded first non-void invoice and receivable confidence; no mutations. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=x=>{const at=Date.parse(String(x?.retrieved_at||''));return Number.isFinite(at)&&at<=Date.now()+300000&&Date.now()-at<=300000;};
const amount=v=>Number.isSafeInteger(v)&&v>=0?(v/100).toFixed(2):'Not verified';
const statuses={
 paid_with_application_verified:'Paid balance: payment application verified',
 open_receivable_verified:'Open receivable: amount and payment application reconciled',
 zero_balance_payment_unproven:'HOLD: zero balance is not evidence of payment',
 receivable_discrepancy_hold:'HOLD: invoice and payment application totals disagree',
 invoice_not_issued:'HOLD: invoice remains draft / unissued',
 closeout_or_customer_signoff_unapproved:'HOLD: closeout, invoice readiness or customer signoff not approved',
 invoice_candidate_missing:'HOLD: Finance candidate missing',
 issued_invoice_missing:'HOLD: no actual non-void invoice found',
 approved_closeout_missing:'HOLD: closeout approval missing'
};
function mount(){
 const host=$('admin');if(!host||$('receivable414'))return;
 const el=document.createElement('details');el.id='receivable414';el.className='admin-hub-detail';
 el.dataset.adminHubTitle='First invoice receivable confidence';el.dataset.adminHubGroups='finance operations';
 el.innerHTML='<summary>414 · First Invoice &amp; Receivable Confidence</summary>'+
 '<div class="admin-panel-block"><p>Supervisor Finance/Jobs read-only review. A candidate is not a posted invoice; a zero balance is not proof of payment. Reports only actual non-void first invoices matched to approved closeout and verified payment applications.</p>'+
 '<button type="button" id="receivable414Recheck" class="secondary">Recheck Finance source</button> '+
 '<a href="/help.html#first-invoice-receivable-414" aria-label="Help: first-invoice receivable confidence">ⓘ Help</a>'+
 '<p id="receivable414Status" role="status" aria-live="polite">Not checked.</p>'+
 '<div id="receivable414Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(el);let busy=false;
 $('receivable414Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const b=$('receivable414Recheck'),s=$('receivable414Status'),out=$('receivable414Rows');
  b.disabled=true;out.replaceChildren();s.textContent='Verifying complete fresh Finance sources…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Finance source unavailable');
   const result=await api.loadAdminDirectory({scope:'first_invoice_receivable_confidence'});
   if(result?.ok!==true)throw Error(result?.error||'Access denied');
   const d=result?.evidence_414;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.records)||d.state==='withheld'){
    s.textContent='WITHHELD: '+String(d?.reason||'Fresh, complete, permitted source not confirmed.');
    out.innerHTML='<p data-receivable414-state="withheld">No invoice or payment claim available.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length)throw Error('Inconsistent no-record report');
    s.textContent='No accepted first-job sample found in complete authorized source.';
    out.innerHTML='<p data-receivable414-state="no_record">No first invoice, receivable or payment outcome claimed.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>150)throw Error('Unexpected or capped source');
   const verified=d.records.filter(r=>['paid_with_application_verified','open_receivable_verified'].includes(r.receivable_state));
   s.textContent=d.records.length+' first-job candidate(s) · '+verified.length+' reconciled first-invoice receivable(s). Read only.';
   out.innerHTML=d.records.map(r=>{
    const good=['paid_with_application_verified','open_receivable_verified'].includes(r.receivable_state);
    const message=statuses[r.receivable_state]||'HOLD: unrecognized receivable state';
    return '<article class="notice" data-receivable414-state="'+(good?'verified':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>First work order '+esc(r.first_work_order_number||r.first_work_order_id||'Unverified')+'</strong>'+
      '<p>Estimate: '+esc(r.estimate_number||r.estimate_id||'Unverified')+'</p>'+
      '<p>Closeout approval: '+esc(r.closeout_approved_at||'Not verified')+' · Finance candidate: '+esc(r.invoice_candidate_number||'Not verified')+'</p>'+
      '<p>Actual first invoice: '+esc(r.invoice_number||'Not verified')+' · status: '+esc(r.invoice_status||'Not verified')+'</p>'+
      '<p>Invoice date: '+esc(r.invoice_date||'Not verified')+' · due: '+esc(r.due_date||'Not verified')+'</p>'+
      '<p>Total: '+amount(r.total_amount_cents)+' · Applied: '+amount(r.applied_amount_cents)+' · Balance: '+amount(r.balance_due_cents)+'</p>'+
      '<p><strong>'+esc(message)+'</strong></p><p>No invoice, payment, collection or reminder is created by this inspection.</p></article>';
   }).join('');
  }catch(e){s.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;b.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();