/* Item 418 — owner-initiated live first-trial coverage and manual receipt workbench. */
(function(){'use strict';
const byId=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=at=>{const t=Date.parse(String(at||''));return Number.isFinite(t)&&t<=Date.now()&&Date.now()-t<=300000;};
function mount(){
 const host=byId('admin');if(!host||byId('owner418'))return;
 const panel=document.createElement('details');
 panel.id='owner418';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='First live trial source coverage and owner acceptance';
 panel.dataset.adminHubGroups='management operations';
 panel.innerHTML='<summary>418 · First Live Trial Source Coverage &amp; Owner Acceptance</summary>'+
 '<div class="admin-panel-block"><p>Read-only first-use evidence from the existing owner-authorized 416 source. Recheck current CRM customer, owned property, first job and all ten handoffs. No test customer is created; no acceptance is automatic or server-stored.</p>'+
 '<button type="button" class="secondary" id="owner418Refresh">Recheck original first-use sources</button> '+
 '<a href="/help.html#first-live-trial-418" aria-label="Help: live first-use and manual owner decision">ⓘ Help</a>'+
 '<p role="status" aria-live="polite" id="owner418Status">Not checked.</p>'+
 '<div id="owner418Results" style="display:grid;gap:12px;min-width:0;overflow-wrap:anywhere"></div>'+
 '<div id="owner418Review" hidden><label for="owner418Choice">Choose first-use record</label>'+
 '<select id="owner418Choice"></select><label for="owner418Decision">Manual owner review action</label>'+
 '<select id="owner418Decision"><option value="reviewed_with_gaps">Record follow-up review (no acceptance)</option>'+
 '<option value="manual_acceptance_candidate">Prepare manual acceptance receipt (only when every source is verified)</option></select>'+
 '<label for="owner418Note">Review note (optional, 200 characters)</label>'+
 '<textarea id="owner418Note" maxlength="200" rows="2" placeholder="Internal owner review note"></textarea>'+
 '<label><input type="checkbox" id="owner418Confirm"> I reviewed this source evidence and will manually retain the copied receipt in approved records.</label>'+
 '<label for="owner418Phrase">To prepare an acceptance receipt, enter ACCEPT (required only for that decision)</label>'+
 '<input id="owner418Phrase" maxlength="12" autocomplete="off" placeholder="ACCEPT">'+
 '<button type="button" class="secondary" id="owner418Copy" disabled>Copy manual owner decision receipt</button>'+
 '<p aria-live="polite" id="owner418CopyStatus"></p></div></div>';
 host.appendChild(panel);
 const refresh=byId('owner418Refresh'),status=byId('owner418Status'),results=byId('owner418Results'),
 review=byId('owner418Review'),selector=byId('owner418Choice'),decision=byId('owner418Decision'),
 note=byId('owner418Note'),confirm=byId('owner418Confirm'),phrase=byId('owner418Phrase'),copy=byId('owner418Copy'),
 copyStatus=byId('owner418CopyStatus');
 let last=null,busy=false;
 function selected(){return last?.records?.[Number(selector.value)]||null;}
 function enable(){
  const r=selected(),accepted=decision.value==='manual_acceptance_candidate';
  copy.disabled=busy||!r||!fresh(last.retrieved_at)||!confirm.checked||
   (accepted&&(!r.manual_acceptance_eligible||phrase.value.trim()!=='ACCEPT'));
 }
 function reset(){last=null;copy.disabled=true;review.hidden=true;selector.replaceChildren();results.replaceChildren();copyStatus.textContent='';
  confirm.checked=false;note.value='';phrase.value='';decision.value='reviewed_with_gaps';}
 function render(d){
  last=d;
  selector.innerHTML=d.records.map((r,i)=>'<option value="'+i+'">'+
   escape(r.work_order_number||r.first_work_order_id||'Customer '+(i+1))+' · '+escape(r.coverage.replaceAll('_',' '))+'</option>').join('');
  results.innerHTML=d.records.map(r=>'<article class="notice" data-owner418-coverage="'+escape(r.coverage)+'" style="min-width:0;overflow-wrap:anywhere">'+
   '<strong>First job: '+escape(r.work_order_number||r.first_work_order_id||'Not yet recorded')+'</strong>'+
   '<p>CRM customer ID: '+escape(r.customer_id)+' · linked property ID: '+escape(r.property_id||'Not verified')+'</p>'+
   '<p>Original first work order: '+escape(r.first_order_created_at||'Not verified')+
   ' · unresolved handoffs: '+r.unresolved_count+'</p>'+
   '<ol>'+r.steps.map(s=>'<li>'+escape(s.handoff+' '+s.label)+': '+
    (s.state==='source_verified'?'source verified, owner review pending': 'GAP — '+escape(s.reason))+'</li>').join('')+'</ol>'+
   '<p><strong>Owner decision: not recorded in the server.</strong> '+(r.manual_acceptance_eligible?
    'All ten source checks verified; manual owner decision is still required.':
    'Acceptance unavailable: original source gaps need manual follow-up.')+'</p></article>').join('');
  review.hidden=false;
  status.textContent=d.records.length+' actual owner-sourced customer trial candidate(s), '+
   d.unresolved_gaps.length+' unresolved handoff(s). No owner acceptance was recorded.';
  enable();
 }
 refresh.addEventListener('click',async()=>{
  if(busy)return;busy=true;refresh.disabled=true;reset();
  status.textContent='Checking current owner-authorized CRM, property, Jobs and ten canonical handoffs…';
  try{
   if(typeof window.YWI418?.inspect!=='function'||typeof window.YWIAPI?.loadAdminDirectory!=='function')throw Error('Owner evidence unavailable');
   const source=await window.YWIAPI.loadAdminDirectory({scope:'owner_first_use_trial_acceptance'});
   const d=window.YWI418.inspect(source);
   if(d.state==='withheld'){status.textContent='WITHHELD: '+d.reason;results.innerHTML='<p data-owner418-state="withheld">No source-verified acceptance can be prepared.</p>';return;}
   if(d.state==='no_record'){status.textContent='No live first-use customer/property/job recorded. No owner acceptance possible.';
    results.innerHTML='<p data-owner418-state="no_record">Use the existing authorized CRM and Jobs screens to create and operate a genuine first job. This workbench will not invent sample records.</p>';return;}
   render(d);
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
  finally{busy=false;refresh.disabled=false;enable();}
 });
 for(const el of [selector,decision,confirm,phrase])el.addEventListener('change',enable);
 phrase.addEventListener('input',enable);
 selector.addEventListener('change',()=>{confirm.checked=false;phrase.value='';decision.value='reviewed_with_gaps';enable();});
 copy.addEventListener('click',async()=>{
  const r=selected();enable();
  if(copy.disabled||!r)return;
  const accepted=decision.value==='manual_acceptance_candidate';
  if(!fresh(last?.retrieved_at)){copy.disabled=true;copyStatus.textContent='Source expired; recheck before copying.';return;}
  const receipt={type:'yw_manual_first_live_trial_owner_review',item:418,
   retrieved_at:last.retrieved_at,reviewed_at:new Date().toISOString(),
   customer_id:r.customer_id,property_id:r.property_id,first_work_order_id:r.first_work_order_id,
   source_coverage:r.coverage,unresolved_handoffs:r.steps.filter(s=>s.state==='unresolved').map(s=>({handoff:s.handoff,reason:s.reason})),
   review_decision:accepted?'manual_acceptance_candidate':'reviewed_with_gaps',
   note:note.value.slice(0,200),
   warning:'Manual clipboard receipt only. NOT digitally signed, NOT server-stored, NOT an approval of dispatch, Finance, completion or payments.'};
  try{
   if(typeof navigator.clipboard?.writeText!=='function')throw Error('Clipboard not available');
   await navigator.clipboard.writeText(JSON.stringify(receipt,null,2));
   copyStatus.textContent='Manual review receipt copied. Save in approved owner records; no server-side acceptance or transaction occurred.';
  }catch(e){copyStatus.textContent='Receipt not copied: '+String(e?.message||e);}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
