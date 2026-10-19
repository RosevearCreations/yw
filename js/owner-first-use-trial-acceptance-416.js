/* Build 416 — read-only owner trial evidence review and manually exportable gap receipt. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=d=>{const t=Date.parse(String(d?.retrieved_at||''));return Number.isFinite(t)&&t<=Date.now()+300000&&Date.now()-t<=300000;};
function mount(){
 const host=$('admin');if(!host||$('owner416'))return;
 const panel=document.createElement('details');panel.id='owner416';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Owner first-use trial acceptance workbench';panel.dataset.adminHubGroups='management operations';
 panel.innerHTML='<summary>416 · Owner First-Use Trial Acceptance Workbench</summary>'+
 '<div class="admin-panel-block"><p>Owner-only, read-only review of canonical first-use handoffs (406–415). Source-verified is NOT owner acceptance. Review unresolved gaps; export a receipt yourself. No automated seed customers, approval, Finance posting, account changes, messages or external calls.</p>'+
 '<button id="owner416Recheck" type="button" class="secondary">Recheck live first-use sources</button> '+
 '<button id="owner416Copy" type="button" class="secondary" disabled>Copy unresolved-gap review</button> '+
 '<a href="/help.html#owner-first-use-trial-416" aria-label="Help: first-use trial acceptance">ⓘ Help</a>'+
 '<p id="owner416Status" role="status" aria-live="polite">Not checked.</p>'+
 '<div id="owner416Rows" style="display:grid;gap:12px;min-width:0;overflow-wrap:anywhere"></div>'+
 '<p id="owner416CopyStatus" aria-live="polite"></p></div>';
 host.appendChild(panel);
 let busy=false,last=null;
 const copy=$('owner416Copy'),status=$('owner416Status'),out=$('owner416Rows');
 $('owner416Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;last=null;copy.disabled=true;
  const btn=$('owner416Recheck');btn.disabled=true;out.replaceChildren();
  $('owner416CopyStatus').textContent='';status.textContent='Checking owner-authorized current CRM, Jobs, QC, Finance and seasonal evidence…';
  try{
   const api=window.YWIAPI;
   if(typeof api?.loadAdminDirectory!=='function')throw Error('Owner source unavailable');
   const result=await api.loadAdminDirectory({scope:'owner_first_use_trial_acceptance'});
   if(result?.ok!==true)throw Error(result?.error||'Owner permission missing');
   const d=result?.acceptance_416;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.records)||!Array.isArray(d.unresolved_gaps)||d.state==='withheld'){
    status.textContent='WITHHELD: '+String(d?.reason||'Complete, fresh and authorized evidence unavailable.');
    out.innerHTML='<p data-owner416-state="withheld">No owner acceptance or gap receipt recorded.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.records.length||d.unresolved_gaps.length)throw Error('Inconsistent empty source');
    status.textContent='No actual first-job trial records; no acceptance or fake success.';
    out.innerHTML='<p data-owner416-state="no_record">No first-use cohort exists in the authorized evidence. Create and operate a real customer/property/job through the existing manual workflow before review.</p>';return;
   }
   if(d.state!=='recorded'||d.records.length>25||d.unresolved_gaps.length>250)throw Error('Capped or unknown owner trial source');
   if(d.records.some(r=>!Array.isArray(r.steps)||r.steps.length!==10||
     r.steps.some(s=>!['source_verified','unresolved'].includes(s.state))||
     !Number.isSafeInteger(r.unresolved_count)||r.unresolved_count!==r.steps.filter(s=>s.state==='unresolved').length||
     r.trial_acceptance!=='operator_review_required'))
     throw Error('Owner handoff record inconsistent; review withheld');
   last={type:'yw_owner_first_use_trial_gap_review',build:416,retrieved_at:d.retrieved_at,
     review_status:'owner_review_pending',first_use_jobs:d.records.map(r=>({
       first_work_order_id:r.first_work_order_id,source_verified_handoffs:r.steps.filter(s=>s.state==='source_verified').map(s=>s.handoff),
       unresolved_handoffs:r.steps.filter(s=>s.state==='unresolved').map(s=>s.handoff)})),
     unresolved_gaps:d.unresolved_gaps,
     note:'This is a manually copied review snapshot, NOT server-stored acceptance, signature, or approval.'};
   copy.disabled=false;
   status.textContent=d.records.length+' real first-job trial(s), '+d.unresolved_gaps.length+
     ' unresolved handoff(s). Review needed; no automatic owner acceptance.';
   out.innerHTML=d.records.map(r=>'<article class="notice" data-owner416-state="'+
      (r.unresolved_count?'gaps':'review_pending')+'" style="min-width:0;overflow-wrap:anywhere">'+
      '<strong>First job '+esc(r.work_order_number||r.first_work_order_id)+'</strong>'+
      '<p>Original work-order date: '+esc(r.first_order_created_at||'Not verified')+
      ' · unresolved: '+esc(r.unresolved_count)+'</p>'+
      '<ol>'+r.steps.map(s=>'<li><strong>'+esc(s.handoff)+' · '+esc(s.label)+'</strong>: '+
        (s.state==='source_verified'?'Source verified (operator acceptance pending)':
          'GAP — '+esc(s.reason||'Evidence not corroborated'))+'</li>').join('')+'</ol>'+
      '<p><strong>Owner acceptance: not recorded.</strong> This inspection cannot approve the trial.</p></article>').join('');
  }catch(err){last=null;copy.disabled=true;status.textContent='BLOCKED / UNAVAILABLE: '+String(err?.message||err);out.replaceChildren();}
  finally{busy=false;btn.disabled=false;}
 });
 copy.addEventListener('click',async()=>{
  if(!last)return;
  if(!fresh({retrieved_at:last.retrieved_at})){
    copy.disabled=true;last=null;
    $('owner416CopyStatus').textContent='Receipt expired. Recheck live evidence.';return;
  }
  try{
   if(typeof navigator?.clipboard?.writeText!=='function')throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(JSON.stringify({...last,copied_at:new Date().toISOString()},null,2));
   $('owner416CopyStatus').textContent='Gap snapshot copied. Save it in your approved owner records; nothing was sent to the server.';
  }catch(err){$('owner416CopyStatus').textContent='Copy unavailable: '+String(err?.message||err)+'. No receipt has been stored.';}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();