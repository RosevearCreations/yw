/* YW 556 — owner-only recovery ledger; original Jobs/Dispatch remain authoritative. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,content)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=String(content);return node;};
 const option=(id,text)=>{const o=el('option',text);o.value=id;return o;};
 const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 const key=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const h=Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');};
 function mount(){
  if(!$('settings')||$('owner556'))return;
  const panel=el('details');panel.id='owner556';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Original Job/Dispatch Exception Recovery &amp; Customer Confirmation (owner)</summary>
   <style>#owner556,#owner556 fieldset,#owner556 label{max-width:100%;min-width:0;overflow-wrap:anywhere;box-sizing:border-box}
    #owner556 select,#owner556 textarea{max-width:100%;width:100%;box-sizing:border-box}#owner556 button{min-height:44px;white-space:normal}
    #owner556 .owner556-actions{display:flex;flex-wrap:wrap;gap:8px}</style>
   <div class="admin-panel-block">
    <p><strong>Original Jobs and Dispatch remain the source of truth.</strong> Record an exception, reassign crew or timing only through the original authorized Dispatch workflow, independently verify the replacement here, then await an actual customer response through the token-protected customer portal. This panel does not send messages, change Dispatch, create Jobs or bypass safety gates.</p>
    <label>Owned landscaping company <select id="owner556Company"></select></label>
    <button id="owner556Refresh" type="button" class="secondary">Refresh owner and original-source evidence</button>
    <p id="owner556Status" role="status" aria-live="polite">Sign in as a company owner to review.</p>
    <fieldset><legend>1. Verified original canonical Job and Dispatch</legend>
     <label>Booking handoff <select id="owner556Request"></select></label>
     <p id="owner556Original">No original handoff selected.</p>
    </fieldset>
    <fieldset><legend>2. Record and resolve an exception</legend>
     <label>Exception reason <select id="owner556Reason"><option value="">Choose reason</option>
      <option value="crew_unavailable">Crew unavailable</option><option value="schedule_conflict">Schedule conflict</option>
      <option value="weather">Weather</option><option value="equipment">Equipment</option>
      <option value="access">Property access</option><option value="other">Other</option></select></label>
     <label>Owner explanation (10–1,000 characters) <textarea id="owner556Note" maxlength="1000" rows="3" placeholder="Describe the original exception and necessary recovery."></textarea></label>
     <button id="owner556Open" type="button" class="secondary">Open original-source exception</button>
     <p>Assign a replacement crew or slot <strong>inside the original Dispatch application</strong>. It must reference the original dispatch, preserve the canonical Job, pass crew/safety conflict checks and carry an original dispatch receipt.</p>
     <button id="owner556Candidates" type="button" class="secondary">Read replacement receipts from original Dispatch</button>
     <label>Original replacement receipt <select id="owner556Replacement"></select></label>
     <button id="owner556Verify" type="button" class="secondary">Verify replacement and request customer confirmation</button>
    </fieldset>
    <fieldset><legend>3. Independent customer response and closure</legend>
     <p id="owner556Customer" role="status" aria-live="polite">No customer receipt checked.</p>
     <label><input id="owner556Attest" type="checkbox"> I have checked the original records, current crew/safety release and the customer confirmation evidence.</label>
     <div class="owner556-actions"><button id="owner556Close" type="button" class="primary">Close only after accepted customer receipt</button></div>
     <p id="owner556Case" role="status" aria-live="polite">No recovery case.</p>
     <p>The source enforces exact company ownership, idempotent versioned decisions, original Dispatch lineage, current scheduling safety and a separate customer-origin receipt. A HOLD requires refresh, not an assumed approval.</p>
    </fieldset>
   </div>`;
  $('settings').append(panel);
  const company=$('owner556Company'),request=$('owner556Request'),replacement=$('owner556Replacement');
  const status=$('owner556Status'),original=$('owner556Original'),customer=$('owner556Customer'),caseLabel=$('owner556Case');
  let owned=[],handoffs=[],cases=[],confirmations=[],replacements=[],owner='',busy=false,epoch=0;
  const selectedHandoff=()=>handoffs.find(row=>row.request_id===request.value);
  const selectedCase=()=>cases.find(row=>row.request_id===request.value);
  const selectedConfirmation=()=>{const c=selectedCase();return confirmations.find(row=>row.request_id===request.value&&row.case_version===c?.case_version);};
  const selectedReplacement=()=>replacements.find(row=>row.id===replacement.value);
  function controls(){const h=selectedHandoff(),c=selectedCase(),receipt=selectedConfirmation(),att=$('owner556Attest').checked;
   $('owner556Refresh').disabled=busy;
   $('owner556Open').disabled=busy||!h||!att||!$('owner556Reason').value||$('owner556Note').value.trim().length<10||
     (c?.state==='replacement_pending_customer'&&receipt?.decision!=='declined');
   $('owner556Candidates').disabled=busy||!c||c.state!=='exception_open';
   $('owner556Verify').disabled=busy||!att||c?.state!=='exception_open'||!validId(selectedReplacement()?.id);
   $('owner556Close').disabled=busy||!att||c?.state!=='replacement_pending_customer'||receipt?.decision!=='accepted';
  }
  async function identity(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   if(state?.isAuthenticated!==true||!validId(state.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Original authenticated owner login required.');
   const current=await sb.auth.getUser();
   if(current.error||current.data?.user?.id!==state.user.id)throw Error('Owner session no longer matches.');
   return {id:state.user.id,sb};
  }
  function clear(){handoffs=[];cases=[];confirmations=[];replacements=[];
   request.replaceChildren(option('','Choose verified original handoff'));
   replacement.replaceChildren(option('','No original replacement checked'));
   original.textContent='No original Jobs and Dispatch evidence.';
   customer.textContent='No independent customer response.';caseLabel.textContent='No recovery case.';
   $('owner556Attest').checked=false;
  }
  function show(){const h=selectedHandoff(),c=selectedCase(),receipt=selectedConfirmation();
   replacement.replaceChildren(option('','Refresh original Dispatch replacements'));replacements=[];
   $('owner556Attest').checked=false;
   original.textContent=h?`Original Job ${h.work_order_id} · original Dispatch ${h.dispatch_id} · verified ${new Date(h.updated_at).toLocaleString('en-CA')}.`:'Choose a verified original Jobs/Dispatch handoff.';
   caseLabel.textContent=c?`Case version ${c.case_version} · ${c.state} · ${c.reason} · original Dispatch ${c.original_dispatch_id} · replacement ${c.replacement_dispatch_id||'not yet verified'}.`:'No exception has been recorded.';
   customer.textContent=receipt?`Customer ${receipt.decision.toUpperCase()} · recorded ${new Date(receipt.recorded_at).toLocaleString('en-CA')} · receipt ${receipt.id}.`:
    c?.state==='replacement_pending_customer'?'Awaiting a current-version response through the customer quote portal. This panel cannot attest for the customer.':'No customer receipt required yet.';
   controls();
  }
  async function refresh(){if(busy)return;busy=true;const run=++epoch,previousCompany=company.value,previousRequest=request.value;
   owner='';clear();controls();status.textContent='Verifying the signed-in company owner and original handoff…';
   try{const {id,sb}=await identity();const o=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name').limit(101);
    if(run!==epoch)return;
    if(o.error||!Array.isArray(o.data)||o.data.length>100||o.data.some(c=>c.owner_user_id!==id||!validId(c.id)))throw Error('Company ownership not verified.');
    owner=id;owned=o.data;company.replaceChildren(option('','Choose owned company'));
    owned.forEach(c=>company.append(option(c.id,c.name)));
    if(owned.some(c=>c.id===previousCompany))company.value=previousCompany;else if(owned.length===1)company.value=owned[0].id;
    const cid=company.value;if(!owned.some(c=>c.id===cid)){status.textContent='Select your owned company and refresh.';return;}
    const [h,c,a]=await Promise.all([
     sb.from('ywi_landscape_canonical_handoffs_555').select('company_id,request_id,work_order_id,quote_package_id,dispatch_id,state,updated_at').eq('company_id',cid).eq('state','verified_crew_handoff').order('updated_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_recovery_cases_556').select('company_id,request_id,case_version,state,reason,owner_note,original_dispatch_id,replacement_dispatch_id,updated_at').eq('company_id',cid).order('updated_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_customer_confirmations_556').select('id,company_id,request_id,case_version,decision,recorded_at,replacement_dispatch_id').eq('company_id',cid).order('recorded_at',{ascending:false}).limit(80)
    ]);
    if(run!==epoch||company.value!==cid||window.YWI_AUTH?.getState?.()?.user?.id!==id)throw Error('Owner context changed.');
    for(const [label,z] of [['Original Jobs/Dispatch',h],['Recovery ledger',c],['Customer receipts',a]])
     if(z.error||!Array.isArray(z.data)||z.data.some(x=>x.company_id!==cid))throw Error(`${label} unavailable: ${z.error?.message||'company mismatch'}. Migration may be pending.`);
    handoffs=h.data;cases=c.data;confirmations=a.data;
    request.replaceChildren(option('','Choose verified original handoff'));
    handoffs.forEach(x=>request.append(option(x.request_id,`${x.request_id.slice(0,8)} · ${cases.find(c=>c.request_id===x.request_id)?.state||'no exception'}`)));
    if(handoffs.some(x=>x.request_id===previousRequest))request.value=previousRequest;
    show();status.textContent=`Verified owner and ${handoffs.length} original Job/Dispatch handoffs. Read-only source references loaded.`;
   }catch(e){if(run===epoch){clear();status.textContent='HOLD: '+(e?.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function loadCandidates(){const c=selectedCase(),cid=company.value,rid=request.value;if(busy||!c)return;
   busy=true;controls();const run=++epoch;replacements=[];replacement.replaceChildren(option('','Checking original Dispatch'));
   try{const {id,sb}=await identity();if(id!==owner)throw Error('Owner context drift.');
    const z=await sb.rpc('ywi_rpc_landscape_recovery_candidates_556',{p_company_id:cid,p_request_id:rid});
    if(run!==epoch||company.value!==cid||request.value!==rid)throw Error('Selection changed.');
    if(z.error||z.data?.company_id!==cid||z.data?.request_id!==rid||z.data?.read_only!==true||
      !Array.isArray(z.data.candidates)||z.data.candidates.length>20)throw Error(z.error?.message||'Original Dispatch candidates not verified.');
    replacements=z.data.candidates;replacement.replaceChildren(option('','Choose exact original replacement receipt'));
    replacements.forEach(x=>replacement.append(option(x.id,`${x.schedule_status} · ${x.scheduled_start} · crew ${String(x.crew_id).slice(0,8)}`)));
    status.textContent=replacements.length?`${replacements.length} original Dispatch replacement receipts found; the source will independently recheck conflicts and safety.`:'HOLD: No original Dispatch replacement superseding the original receipt exists yet.';
   }catch(e){if(run===epoch)status.textContent='HOLD: '+(e?.message||e);}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function act(action){if(busy||!$('owner556Attest').checked)return;
   const cid=company.value,rid=request.value,c=selectedCase(),chosen=selectedReplacement();
   if(!selectedHandoff()||!owned.some(x=>x.id===cid))return;
   busy=true;controls();status.textContent=`Rechecking source and recording ${action}…`;
   try{const {id,sb}=await identity();if(id!==owner)throw Error('Owner identity changed.');
    const z=await sb.rpc('ywi_rpc_landscape_recovery_556',{
     p_company_id:cid,p_request_id:rid,p_action:action,p_idempotency_key:key(),p_expected_version:c?.case_version||0,
     p_reason:action==='open'?$('owner556Reason').value:null,p_note:action==='open'?$('owner556Note').value.trim():null,
     p_replacement_dispatch_id:action==='verify_replacement'?chosen?.id:null,p_owner_attested:true
    });
    if(z.error||z.data?.company_id!==cid||z.data?.request_id!==rid||
      z.data?.case_version!==(c?.case_version||0)+1||z.data?.authorizes_original_dispatch_mutation!==false)
      throw Error(z.error?.message||'Recovery result not verified; refresh and review the audit.');
    status.textContent=`Recorded ${z.data.state} version ${z.data.case_version}. Original Jobs/Dispatch were not edited.`;
    busy=false;void refresh();
   }catch(e){status.textContent='HOLD / NO CHANGE VERIFIED: '+(e?.message||e)+' Refresh and inspect before retrying.';}
   finally{busy=false;controls();}
  }
  company.addEventListener('change',()=>{clear();void refresh();});
  request.addEventListener('change',show);
  replacement.addEventListener('change',controls);
  $('owner556Attest').addEventListener('change',controls);
  $('owner556Reason').addEventListener('change',controls);
  $('owner556Note').addEventListener('input',controls);
  $('owner556Refresh').addEventListener('click',()=>void refresh());
  $('owner556Candidates').addEventListener('click',()=>void loadCandidates());
  for(const [id,action] of [['owner556Open','open'],['owner556Verify','verify_replacement'],['owner556Close','close']])
   $(id).addEventListener('click',()=>void act(action));
  document.addEventListener('ywi:auth-changed',()=>{epoch++;owner='';owned=[];clear();company.replaceChildren(option('','Owner sign-in required'));status.textContent='Owner context changed. Refresh before acting.';controls();});
  controls();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
