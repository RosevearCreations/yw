/* Build 399 — read-only visit completion, QC and customer-safe evidence review.
   Authoritative actions remain in existing Production, QC and customer portal modules. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=x=>String(x??'');
 function review(workOrder,sessions,runs,deficiencies,proofs,closeouts){
   const id=key(workOrder.id), related=(items)=>items.filter(x=>key(x.work_order_id)===id);
   const s=related(sessions),q=related(runs),d=related(deficiencies),p=related(proofs),c=related(closeouts);
   const gaps=[];
   if(!s.some(x=>['complete','completed','finished'].includes(String(x.session_status||x.completion_state||'').toLowerCase()))) gaps.push('Completion session unverified');
   if(!q.length)gaps.push('Supervisor QC record absent');
   if(d.some(x=>!['resolved','closed','corrected'].includes(String(x.status||x.deficiency_status||'').toLowerCase())))gaps.push('Open or uncertain deficiencies');
   if(!p.some(x=>String(x.proof_status).toLowerCase()==='approved'))gaps.push('No approved execution proof');
   if(!c.length||c.some(x=>x.customer_signoff_required===true&&!['signed','approved','complete','completed'].includes(String(x.customer_signoff_status||'').toLowerCase())))gaps.push('Customer signoff unverified');
   return {state:gaps.length?'HOLD / REVIEW':'REVIEW RECORDS — NOT CUSTOMER APPROVAL',gaps,proofCount:p.length,qcCount:q.length};
 }
 function init(){
  const admin=$('admin');if(!admin||$('visitEvidence399'))return;
  const panel=document.createElement('details');panel.id='visitEvidence399';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='Visit completion and QC evidence';panel.dataset.adminHubGroups='operations';
  panel.innerHTML='<summary>Build 399 · Visit Completion, QC &amp; Customer-Safe Evidence</summary><div class="admin-panel-block"><p>Authorized read-only handoff. Job completion, supervisor QC, deficiencies, execution proof and customer signoff must each be verified in their existing authoritative modules. This review cannot approve, publish, message, upload, expose private media, impersonate customers or close a visit.</p><button type="button" class="secondary" id="visit399Refresh">Review current QC evidence</button><p id="visit399Status" role="status" aria-live="polite">No review performed.</p><div id="visit399Rows"></div></div>';
  admin.appendChild(panel);let busy=false;
  $('visit399Refresh').onclick=async()=>{
   if(busy)return;busy=true;const b=$('visit399Refresh'),status=$('visit399Status'),rows=$('visit399Rows');b.disabled=true;b.textContent='Reviewing…';rows.replaceChildren();
   try{
    const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Authorized QC source unavailable');
    const data=await api.loadAdminDirectory({scope:'quality_control'});
    const names=['quality_control_runs','quality_control_deficiencies','quality_control_evidence','quality_control_work_orders','quality_control_proofs','quality_control_sessions','quality_control_closeouts'];
    if(data?.ok===false||names.some(n=>!Array.isArray(data?.[n])))throw Error(data?.error||'Canonical QC, visit and proof sources missing');
    if(data.quality_control_work_orders.length>=2000||data.quality_control_runs.length>=1500||data.quality_control_deficiencies.length>=3000||data.quality_control_proofs.length>=4000||data.quality_control_sessions.length>=2500||data.quality_control_closeouts.length>=2000)throw Error('Query limit reached: results incomplete');
    const orders=data.quality_control_work_orders.slice(0,100);
    const evaluations=orders.map(o=>({o,result:review(o,data.quality_control_sessions,data.quality_control_runs,data.quality_control_deficiencies,data.quality_control_proofs,data.quality_control_closeouts)}));
    status.textContent=orders.length+' visits checked · '+evaluations.filter(x=>x.result.gaps.length).length+' require review. No customer-visible content released.';
    rows.innerHTML=evaluations.map(({o,result})=>'<article class="notice"><strong>'+esc(o.work_order_number||o.id)+'</strong> · '+esc(result.state)+'<p>QC records '+result.qcCount+' · proof records '+result.proofCount+'</p><p>'+esc(result.gaps.join('; ')||'Review actual approvals and access scope in canonical modules before closure')+'</p></article>').join('')||'<p>No work orders returned; absence is not clearance.</p>';
   }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
   finally{busy=false;b.disabled=false;b.textContent='Review current QC evidence';}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
