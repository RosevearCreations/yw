/* Build 400 — source-grounded invoice packet readiness, read-only. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function init(){
const host=$('admin');if(!host||$('invoicePacket400'))return;
const el=document.createElement('details');el.id='invoicePacket400';el.className='admin-hub-detail';el.dataset.adminHubTitle='Invoice readiness review';el.dataset.adminHubGroups='finance operations';
el.innerHTML='<summary>Build 400 · Estimate / Change Order to Invoice Readiness</summary><div class="admin-panel-block"><p>Internal Finance review packet only. A job, estimate, recorded change-order application and approved closeout are distinct sources. No invoice, payment, tax, external provider or customer communication is created. Unknown status is HOLD, never automatic approval.</p><button type="button" class="secondary" id="invoice400Refresh">Review invoice candidates</button><p id="invoice400Status" role="status" aria-live="polite">Not checked.</p><div id="invoice400Rows"></div></div>';host.appendChild(el);let busy=false;
$('invoice400Refresh').onclick=async()=>{
if(busy)return;busy=true;const btn=$('invoice400Refresh'),status=$('invoice400Status'),out=$('invoice400Rows');btn.disabled=true;out.replaceChildren();
try{
const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Admin Finance source unavailable');
const [change,qc]=await Promise.all([api.loadAdminDirectory({scope:'change_orders_extras'}),api.loadAdminDirectory({scope:'quality_control'})]);
for(const [data,fields] of [[change,['change_order_extras','change_order_budget_applications','change_order_work_orders','change_order_invoice_candidates']],[qc,['quality_control_closeouts','quality_control_deficiencies']]]){if(data?.ok===false||fields.some(k=>!Array.isArray(data?.[k])))throw Error(data?.error||'Required canonical source unavailable');}
const orders=change.change_order_work_orders,candidates=change.change_order_invoice_candidates,closeouts=qc.quality_control_closeouts,deficiencies=qc.quality_control_deficiencies,applications=change.change_order_budget_applications;
if(orders.length>=1500||candidates.length>=1500||closeouts.length>=2000||deficiencies.length>=3000||applications.length>=1500)throw Error('Canonical query cap reached — incomplete packet');
const packets=orders.slice(0,150).map(o=>{
const id=String(o.id||''),closed=closeouts.filter(c=>String(c.work_order_id||'')===id),candidate=candidates.find(c=>String(c.work_order_id||'')===id);
const applied=applications.filter(a=>String(a.work_order_id||'')===id);
const openDefects=deficiencies.filter(d=>String(d.work_order_id||'')===id&&!['closed','resolved','corrected'].includes(String(d.status||d.deficiency_status||'').toLowerCase()));
const holds=[];if(!o.estimate_id)holds.push('Estimate link missing');if(!closed.some(c=>String(c.closeout_status||'').toLowerCase()==='approved'))holds.push('Approved closeout missing');
if(closed.some(c=>c.customer_signoff_required===true&&!['signed','approved','completed'].includes(String(c.customer_signoff_status||'').toLowerCase())))holds.push('Customer signoff pending');
if(openDefects.length)holds.push('Deficiencies unresolved');if(!candidate)holds.push('Canonical invoice candidate missing');
if(applied.some(a=>!a.change_order_id))holds.push('Change-order application provenance incomplete');
return {o,candidate,applied:applied.length,holds};});
status.textContent=packets.length+' work orders reviewed · '+packets.filter(p=>p.holds.length).length+' held. All output advisory; Finance authorization required.';
out.innerHTML=packets.map(p=>'<div class="notice"><strong>'+esc(p.o.work_order_number||p.o.id)+'</strong> · '+esc(p.holds.length?'HOLD / RECHECK':'FINANCE REVIEW ONLY')+'<p>Estimate '+esc(p.o.estimate_id||'missing')+' · applied change-order records '+p.applied+' · invoice candidate '+esc(p.candidate?.candidate_number||'none')+' · amount '+esc(p.candidate?.total_amount??'unavailable')+'</p><p>'+esc(p.holds.join('; ')||'Reconfirm source amounts, tax treatment and separate Finance approval before invoicing.')+'</p></div>').join('')||'<p>No work orders returned; none approved.</p>';
}catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
finally{busy=false;btn.disabled=false;}
};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();