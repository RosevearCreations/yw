/* YW 555 — original Jobs and Crew/Dispatch evidence handoff.
 * The source RPC is the only write authority: no browser Jobs/Dispatch writes. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);return e;};
 // Only exact IDs from the verified owner sources may be used.
 const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 const opt=(value,label)=>{const o=el('option',label);o.value=value;return o;};
 const freshKey=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const hex=Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');};
 function mount(){
  const settings=$('settings');if(!settings||$('owner555'))return;
  const panel=el('details');panel.id='owner555';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Accepted Booking → Original Job &amp; Crew Handoff (owner)</summary>
   <style>
    #owner555,#owner555 .admin-panel-block,#owner555 fieldset,#owner555 label {max-width:100%;min-width:0;box-sizing:border-box;overflow-wrap:anywhere}
    #owner555 select {width:100%;max-width:100%;min-width:0;box-sizing:border-box}
    #owner555 button {max-width:100%;white-space:normal;overflow-wrap:anywhere;min-height:44px}
    #owner555 p {overflow-wrap:anywhere}
    #owner555 .owner555-actions {display:flex;gap:8px;flex-wrap:wrap}
   </style>
   <div class="admin-panel-block">
    <p><strong>Original sources stay authoritative.</strong> This three-stage, owner-only trail links a YW 554 proposal to a separately accepted original customer quote, then an existing original Job, then verified original Crew/Dispatch. It never creates a Job, reserves a crew, sends a customer message or posts payment.</p>
    <label>Verified company <select id="owner555Company"></select></label>
    <button type="button" id="owner555Refresh" class="secondary">Refresh original owner evidence</button>
    <p id="owner555Status" role="status" aria-live="polite">Sign in as a company owner and refresh.</p>
    <fieldset><legend>1. Approved proposal</legend>
     <label>YW 554 approved booking <select id="owner555Request"></select></label>
     <p id="owner555Proposal">No booking selected.</p>
    </fieldset>
    <fieldset><legend>2. Original accepted quote / canonical job / Dispatch evidence</legend>
     <button type="button" id="owner555Candidates" class="secondary">Refresh original quote, Jobs and Dispatch candidates</button>
     <label>Original source candidate <select id="owner555Candidate"></select></label>
     <p id="owner555Evidence" role="status" aria-live="polite">No original source retrieved.</p>
     <p>A quote needs actual customer acceptance and terms in original Estimates. Create the canonical Job through original Jobs and assign the crew through original Dispatch. Return here to link their exact records.</p>
    </fieldset>
    <fieldset><legend>3. Independent owner handoff decisions</legend>
     <label><input type="checkbox" id="owner555Attest" /> I have independently matched this customer agreement, property, job and proposed slot to the original source records.</label>
     <div class="owner555-actions">
      <button type="button" id="owner555Stage" class="secondary">Stage accepted quote evidence</button>
      <button type="button" id="owner555Link" class="secondary">Link existing original Job</button>
      <button type="button" id="owner555Crew" class="primary">Verify original Crew/Dispatch handoff</button>
     </div>
     <p id="owner555History">No handoff history loaded.</p>
     <p>The source rejects missing owner permission, unaccepted quotes, unpaid required deposits, changed YW 554 versions, reused IDs, foreign companies, unscheduled crews, dispatch conflicts and missing safety release. Uncertain outcomes require refresh before a new action.</p>
    </fieldset>
   </div>`;
  settings.appendChild(panel);
  const company=$('owner555Company'),request=$('owner555Request'),candidate=$('owner555Candidate');
  const status=$('owner555Status'),proposal=$('owner555Proposal'),evidence=$('owner555Evidence'),history=$('owner555History');
  let owned=[],requests=[],decisions=[],handoffs=[],candidates=[],ownerId='',busy=false,epoch=0;
  const selectedDecision=()=>decisions.find(d=>d.request_id===request.value);
  const selectedHandoff=()=>handoffs.find(h=>h.request_id===request.value);
  const selectedCandidate=()=>candidate.value===''?null:candidates[Number(candidate.value)];
  const actionIds=['owner555Stage','owner555Link','owner555Crew'];
  function controls(){const d=selectedDecision(),h=selectedHandoff(),c=selectedCandidate();
   const available=!busy&&!!ownerId&&!!d&&!!c&&$('owner555Attest').checked;
   $('owner555Stage').disabled=!available||!!h;
   $('owner555Link').disabled=!available||h?.state!=='awaiting_original_job'||!validId(c?.work_order_id);
   $('owner555Crew').disabled=!available||h?.state!=='awaiting_crew_dispatch'||!validId(c?.dispatch_id)||h?.work_order_id!==c?.work_order_id;
   $('owner555Candidates').disabled=busy||!d;
   $('owner555Refresh').disabled=busy;
  }
  async function identity(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   if(a?.isAuthenticated!==true||!validId(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Original authenticated company-owner sign-in required.');
   const u=await sb.auth.getUser();if(u.error||u.data?.user?.id!==a.user.id)throw Error('Owner session mismatch.');
   return {id:a.user.id,sb};
  }
  const reset=()=>{requests=[];decisions=[];handoffs=[];candidates=[];
   request.replaceChildren(opt('','Choose an approved booking'));
   candidate.replaceChildren(opt('','Original source not checked'));
   proposal.textContent='No booking selected.';evidence.textContent='No original source retrieved.';
   history.textContent='No handoff history loaded.';$('owner555Attest').checked=false;};
  function show(){const r=requests.find(r=>r.id===request.value),d=selectedDecision(),h=selectedHandoff();
   candidates=[];candidate.replaceChildren(opt('','Refresh original sources for this booking'));
   evidence.textContent='No original sources verified for this selection.';
   proposal.textContent=r&&d?`${r.service_area} · booking proposal ${d.proposed_start} to ${d.proposed_end} · YW554 decision version ${d.decision_version}`:'Choose a YW554 approved booking.';
   history.textContent=h?`Version ${h.handoff_version} · ${h.state} · original estimate ${h.estimate_id} · original Job ${h.work_order_id||'not linked'} · original Dispatch ${h.dispatch_id||'not linked'}.`:'No YW555 handoff yet; choose a customer-accepted original quote.';
   $('owner555Attest').checked=false;controls();
  }
  async function refresh(){if(busy)return;busy=true;const run=++epoch;ownerId='';reset();controls();status.textContent='Verifying original company-owner context…';
   try{const {id,sb}=await identity();const o=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name').limit(101);
    if(run!==epoch)return;
    if(o.error||!Array.isArray(o.data)||o.data.length>100||o.data.some(c=>c.owner_user_id!==id||!validId(c.id)))throw Error('Company ownership not verified.');
    const old=company.value;owned=o.data;ownerId=id;company.replaceChildren(opt('','Choose owned company'));
    owned.forEach(c=>company.appendChild(opt(c.id,c.name)));
    if(owned.some(c=>c.id===old))company.value=old;else if(owned.length===1)company.value=owned[0].id;
    const cid=company.value;if(!owned.some(c=>c.id===cid)){status.textContent='Choose your company, then refresh.';return;}
    const [q,d,h]=await Promise.all([
     sb.from('ywi_landscape_booking_requests_552').select('id,company_id,service_area,created_at').eq('company_id',cid).order('created_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_booking_decisions_554').select('company_id,request_id,decision_state,decision_version,proposed_start,proposed_end,client_id,client_site_id').eq('company_id',cid).order('updated_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_canonical_handoffs_555').select('company_id,request_id,state,handoff_version,estimate_id,quote_package_id,work_order_id,dispatch_id,updated_at').eq('company_id',cid).order('updated_at',{ascending:false}).limit(60)
    ]);
    if(run!==epoch||company.value!==cid||window.YWI_AUTH?.getState?.()?.user?.id!==id)throw Error('Owner context changed; refresh again.');
    for(const [name,z] of [['requests',q],['decisions',d],['handoffs',h]])
     if(z.error||!Array.isArray(z.data)||z.data.some(x=>x.company_id!==cid))throw Error(`${name} unavailable for verified company (migration may be pending).`);
    requests=q.data;decisions=d.data.filter(d=>d.decision_state==='approved_pending_dispatch');handoffs=h.data;
    request.replaceChildren(opt('','Choose an approved booking'));
    for(const r of requests){const decision=decisions.find(d=>d.request_id===r.id);
     if(decision)request.appendChild(opt(r.id,`${r.service_area} · ${new Date(decision.proposed_start).toLocaleString('en-CA')} · ${handoffs.find(h=>h.request_id===r.id)?.state||'not staged'}`));}
    status.textContent=`Owner verified; ${decisions.length} approved proposals and ${handoffs.length} recorded handoffs (bounded lists).`;
   }catch(e){if(run===epoch){reset();status.textContent='HOLD: '+(e?.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function loadCandidates(){const d=selectedDecision(),cid=company.value,rid=request.value;if(!d||busy)return;
   busy=true;controls();const run=++epoch;candidates=[];candidate.replaceChildren(opt('','Loading original candidates'));
   evidence.textContent='Checking original customer quote, Jobs and Crew sources…';
   try{const {id,sb}=await identity();if(id!==ownerId||!owned.some(c=>c.id===cid))throw Error('Owner context changed.');
    const x=await sb.rpc('ywi_rpc_landscape_handoff_candidates_555',{p_company_id:cid,p_request_id:rid});
    if(run!==epoch||company.value!==cid||request.value!==rid||id!==window.YWI_AUTH?.getState?.()?.user?.id)throw Error('Selection changed; refresh.');
    if(x.error||x.data?.company_id!==cid||x.data?.request_id!==rid||x.data?.read_only!==true||!Array.isArray(x.data.candidates)||x.data.candidates.length>40)
     throw Error(x.error?.message||'Original owner-only source candidates not verified.');
    candidates=x.data.candidates;candidate.replaceChildren(opt('','Choose exact original quote / Job / Dispatch'));
    candidates.forEach((c,i)=>candidate.appendChild(opt(String(i),`${c.estimate_number||'Estimate'} · ${c.quote_state} · ${c.work_order_number||'Job pending'} · ${c.dispatch_state||'Crew pending'}`)));
    const h=selectedHandoff();const previousIndex=candidates.findIndex(c=>c.estimate_id===h?.estimate_id&&c.quote_package_id===h?.quote_package_id&&
     (h?.state==='awaiting_original_job'||c.work_order_id===h?.work_order_id)&&
     (h?.state!=='awaiting_crew_dispatch'||c.work_order_id===h?.work_order_id));
    if(previousIndex>=0)candidate.value=String(previousIndex);
    evidence.textContent=candidates.length?`${candidates.length} original candidate rows. Choose the exact accepted quote and records. Quote acceptance/name/terms shown here are preliminary; the server verifies payment, owner permissions and source lineage again.`:'HOLD: No independently accepted original quote matches this company, customer, property and booking date.';
   }catch(e){if(run===epoch){candidate.replaceChildren(opt('','Original source unavailable'));evidence.textContent='HOLD: '+(e?.message||e);}}
   finally{if(run===epoch){busy=false;controls();}}
  }
  async function act(action){if(busy)return;const d=selectedDecision(),h=selectedHandoff(),c=selectedCandidate(),cid=company.value,rid=request.value;
   if(!d||!c||!$('owner555Attest').checked)return;
   busy=true;controls();status.textContent='Rechecking original source before '+action+'…';let ok=false;
   try{const {id,sb}=await identity();if(id!==ownerId||!owned.some(x=>x.id===cid))throw Error('Owner identity drift.');
    if(h&& (h.estimate_id!==c.estimate_id||h.quote_package_id!==c.quote_package_id))throw Error('The staged accepted source cannot be changed.');
    const params={p_company_id:cid,p_request_id:rid,p_action:action,p_idempotency_key:freshKey(),
     p_expected_version:h?.handoff_version||0,p_decision_version:d.decision_version,
     p_estimate_id:c.estimate_id,p_quote_package_id:c.quote_package_id,
     p_work_order_id:action==='stage'?null:c.work_order_id,
     p_dispatch_id:action==='verify_crew'?c.dispatch_id:null,p_owner_attested:true};
    const z=await sb.rpc('ywi_rpc_landscape_canonical_handoff_555',params);
    if(z.error||z.data?.company_id!==cid||z.data?.request_id!==rid||z.data?.original_source_writes!==false||
       z.data?.state?.handoff_version!==params.p_expected_version+1||
       !['awaiting_original_job','awaiting_crew_dispatch','verified_crew_handoff'].includes(z.data?.state?.state))
     throw Error(z.error?.message||'Unverified source response; refresh before retrying.');
    ok=true;status.textContent='Recorded '+z.data.state.state+' with the original source unchanged.';
   }catch(e){status.textContent='HOLD / NOT VERIFIED: '+(e?.message||e)+' Refresh and inspect audit before any retry.';}
   finally{busy=false;controls();if(ok)void refresh();}
  }
  company.addEventListener('change',()=>{reset();void refresh();});
  request.addEventListener('change',show);
  candidate.addEventListener('change',controls);
  $('owner555Attest').addEventListener('change',controls);
  $('owner555Refresh').addEventListener('click',()=>void refresh());
  $('owner555Candidates').addEventListener('click',()=>void loadCandidates());
  for(const [id,action] of [['owner555Stage','stage'],['owner555Link','link_job'],['owner555Crew','verify_crew']])
   $(id).addEventListener('click',()=>void act(action));
  document.addEventListener('ywi:auth-changed',()=>{epoch++;ownerId='';owned=[];reset();company.replaceChildren(opt('','Verify owner login first'));status.textContent='Owner context changed; refresh required.';controls();});
  controls();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
