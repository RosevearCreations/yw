/* Item 408 — source-bound estimate acceptance → first work order. Read-only. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const isFresh=s=>{const at=Date.parse(String(s?.retrieved_at||''));return Number.isFinite(at)&&at<=Date.now()+300000&&Date.now()-at<=300000;};
function init(){
 const admin=$('admin');if(!admin||$('estimate408'))return;
 const panel=document.createElement('details');panel.id='estimate408';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Estimate acceptance to first work order';
 panel.dataset.adminHubGroups='operations jobs';
 panel.innerHTML='<summary>408 · Estimate Acceptance → First Work Order</summary>'+
  '<div class="admin-panel-block"><p>Supervisor review of an actual dated customer quote acceptance, separate internal approval, and the earliest recorded linked work order. Status-only acceptance is not proof of a customer-signed quote. No approval, price change, or work order is created.</p>'+
  '<button type="button" id="estimate408Recheck" class="secondary">Recheck canonical evidence</button> '+
  '<a href="/help.html#estimate-first-work-order-trace-408" aria-label="Help: estimate acceptance to first work order">ⓘ Help</a>'+
  '<p id="estimate408Status" role="status" aria-live="polite">Not checked.</p>'+
  '<div id="estimate408Rows" style="display:grid;gap:9px;min-width:0;overflow-wrap:anywhere"></div></div>';
 admin.appendChild(panel);
 let busy=false;
 $('estimate408Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const button=$('estimate408Recheck'),status=$('estimate408Status'),out=$('estimate408Rows');
  button.disabled=true;status.textContent='Checking complete, fresh canonical source…';out.replaceChildren();
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Authorized Jobs source is unavailable');
   const result=await api.loadAdminDirectory({scope:'estimate_first_work_order_trace'});
   if(result?.ok!==true)throw Error(result?.error||'Access denied');
   const evidence=result?.trace_408;
   if(!evidence||evidence.complete!==true||!isFresh(evidence)||!Array.isArray(evidence.records)||evidence.state==='withheld'){
    status.textContent='WITHHELD: '+String(evidence?.reason||'Complete fresh estimate evidence is unavailable.');out.innerHTML='<p data-estimate408-state="withheld">Trace withheld until authorized recheck.</p>';return;
   }
   if(evidence.state==='no_record'){
    if(evidence.records.length)throw Error('Inconsistent empty source');
    status.textContent='No recorded accepted estimate in the complete inspected source.';
    out.innerHTML='<p data-estimate408-state="no_record">No accepted estimate or first work-order trace is claimed.</p>';return;
   }
   if(evidence.state!=='recorded')throw Error('Unknown evidence state');
   if(evidence.records.length>150)throw Error('Incomplete or capped presentation');
   status.textContent=evidence.records.length+' accepted-estimate candidate(s) reviewed · '+evidence.records.filter(x=>x.trace_state==='fully_traced').length+' fully traced. Review only; not an approval or issuance.';
   out.innerHTML=evidence.records.map(r=>{
     const good=r.trace_state==='fully_traced';
     const accept=r.customer_acceptance_state==='dated_quote_acceptance_recorded';
     const internal=r.internal_approval_state==='not_required'?'Not required (source)':
       r.internal_approval_state==='dated_internal_approval_recorded'?'Dated internal approval recorded':'Not verified — HOLD';
     const wo=r.first_work_order_state==='first_work_order_recorded'&&r.first_work_order_id?
       escapeHtml(r.first_work_order_number||r.first_work_order_id):'No recorded first work order';
     return '<article class="notice" data-estimate408-state="'+(good?'fully_traced':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>Estimate '+escapeHtml(r.estimate_number||r.estimate_id)+'</strong> · '+(good?'EVIDENCE TRACED':'HOLD / REVIEW')+
      '<p>Customer quote acceptance: '+(accept?'Dated receipt '+escapeHtml(r.customer_accepted_at):'Not verified — HOLD')+'</p>'+
      '<p>Internal approval: '+internal+'</p>'+
      '<p>First work order: '+wo+(r.first_work_order_created_at?' · '+escapeHtml(r.first_work_order_created_at):'')+'</p>'+
      '</article>';
   }).join('')||'<p data-estimate408-state="no_record">No accepted estimate trace recorded.</p>';
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();