/* YW 554 — verified company-owner decisions on immutable 552 intake.
 * Approval is a dated PROPOSAL until original CRM/Jobs/Dispatch handoff (555),
 * independent field evidence, customer agreement and communication authority. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const money=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(c/100);
 const option=(id,label)=>{const o=el('option',label);o.value=id;return o;};
 const key=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const x=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
  return [x.slice(0,8),x.slice(8,12),x.slice(12,16),x.slice(16,20),x.slice(20)].join('-');};
 function mount(){
  const settings=$('settings');if(!settings||$('owner554'))return;
  const panel=el('details');panel.id='owner554';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Booking Review, Requote &amp; Scheduling Proposals (owner)</summary>
   <style>
    #owner554,#owner554 .admin-panel-block,#owner554 fieldset,#owner554 label {
     max-width:100%;min-width:0;box-sizing:border-box;overflow-wrap:anywhere
    }
    #owner554 select,#owner554 textarea,#owner554 input:not([type="checkbox"]) {
     max-width:100%;min-width:0;width:100%;box-sizing:border-box
    }
    #owner554 button {max-width:100%;white-space:normal;overflow-wrap:anywhere}
    #owner554 #owner554RequestSummary,#owner554 #owner554Audit,#owner554 #owner554Availability {
     min-width:0;max-width:100%;overflow-wrap:anywhere
    }
   </style>
   <div class="admin-panel-block">
    <p>Requests remain unchanged in the YW 552 inbox. Every decision is versioned and auditable.
    Approval creates an <strong>owner scheduling proposal awaiting original Dispatch and customer confirmation</strong>,
    not a crew reservation, confirmed appointment, sent message or payment.</p>
    <label>Verified owner company <select id="owner554Company"></select></label>
    <button type="button" id="owner554Refresh" class="secondary">Refresh company request queue</button>
    <p id="owner554Status" role="status" aria-live="polite">Sign in as a company owner to review.</p>
    <fieldset><legend>1. Choose a customer quote request</legend>
      <label>Company request <select id="owner554Request"></select></label>
      <div id="owner554RequestSummary" role="status" aria-live="polite">No request selected.</div>
      <div id="owner554Audit"></div>
    </fieldset>
    <fieldset><legend>2. Review and decide</legend>
      <label>Owner-only explanation / decision reason <textarea id="owner554Note" rows="2" maxlength="800"></textarea></label>
      <label>Revised subtotal (CAD, proposal only) <input id="owner554Requote" type="number" min="0" max="1000000" step="0.01" /></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
       <button type="button" class="secondary" id="owner554Hold">Keep under review</button>
       <button type="button" class="secondary" id="owner554Quote">Save requote draft</button>
       <button type="button" class="secondary" id="owner554Decline">Decline request</button>
      </div>
      <p>No requote is sent automatically; revised pricing needs separate customer agreement before acceptance.</p>
    </fieldset>
    <fieldset><legend>3. Check capacity and propose a date/time</legend>
      <p>Use original YW 553 exact-area, dated crew budget and Dispatch data. A human must still check weather, travel, site hazards and shifts.</p>
      <label>Proposed start (device local time) <input id="owner554Start" type="datetime-local" /></label>
      <label>Proposed end (device local time) <input id="owner554End" type="datetime-local" /></label>
      <button type="button" class="secondary" id="owner554Check">Recheck original availability evidence</button>
      <p id="owner554Availability" role="status" aria-live="polite">No availability review yet.</p>
      <label>Verified CRM customer <select id="owner554Client"></select></label>
      <label>Verified property linked to that customer <select id="owner554Site"></select></label>
      <p>For new customers or properties, first create/verify the links in the existing YW company CRM. No name or address matching is automatic.</p>
      <label><input type="checkbox" id="owner554Attest" /> As company owner, I reviewed the location, schedule, crew/equipment and site-safety needs. The customer has <strong>not yet</strong> received booking confirmation.</label>
      <button type="button" class="primary" id="owner554Approve">Approve a proposal — Dispatch still pending</button>
      <p>Approval checks the active landscaping module, Jobs permission, CRM links, current YW 553 review and already-approved proposal minutes on the server.</p>
    </fieldset>
   </div>`;
  settings.appendChild(panel);
  const company=$('owner554Company'),request=$('owner554Request'),client=$('owner554Client'),site=$('owner554Site');
  const status=$('owner554Status'),summary=$('owner554RequestSummary'),audit=$('owner554Audit'),availability=$('owner554Availability');
  const actionButtons=['owner554Hold','owner554Quote','owner554Decline','owner554Approve','owner554Check'];
  let owned=[],requests=[],decisions=[],audits=[],clients=[],verifiedUser='',busy=false,epoch=0;
  const say=s=>{status.textContent=s;};
  const current=()=>requests.find(x=>x.id===request.value);
  const decision=id=>decisions.find(x=>x.request_id===id);
  const iso=local=>{const parsed=new Date(local);if(!local||!Number.isFinite(parsed.getTime()))throw Error('A valid proposed start and end are required.');return parsed.toISOString();};
  const reset=()=>{requests=[];decisions=[];audits=[];clients=[];
    request.replaceChildren(option('','Choose a company request'));
    client.replaceChildren(option('','Choose a verified customer'));
    site.replaceChildren(option('','Choose a verified property'));
    summary.textContent='No request selected.';audit.replaceChildren();
    availability.textContent='No new availability check performed.';};
  function controls(){
   const r=current(),d=r&&decision(r.id),terminal=['declined','approved_pending_dispatch'].includes(d?.decision_state);
   const enabled=!!r&&!busy&&!terminal;
   for(const id of actionButtons)$(id).disabled=!enabled;
   $('owner554Approve').disabled=!enabled||d?.decision_state==='requote_draft';
   if(d?.decision_state==='requote_draft')availability.textContent='Requote draft requires independent customer agreement; no approval action permitted.';
  }
  async function identity(){
   const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   if(auth?.isAuthenticated!==true||!uuid.test(auth.user?.id||'')||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Verified company-owner sign-in is required.');
   const who=await sb.auth.getUser();
   if(who.error||who.data?.user?.id!==auth.user.id)throw Error('Owner identity could not be verified.');
   return {id:auth.user.id,sb};
  }
  function showSelected(){
   const r=current();summary.replaceChildren();audit.replaceChildren();availability.textContent='No new availability check performed.';
   if(!r){summary.textContent='Choose a request to review.';controls();return;}
   const d=decision(r.id);const row=el('div');
   row.append(el('p',`${r.full_name} · ${r.contact_value} · ${r.preferred_contact_method}`),
    el('p',`${r.service_area} · preferred date ${r.requested_date||'not supplied'} · original estimate ${money(r.estimated_subtotal_cents)} CAD subtotal`),
    el('p',`Original request: ${r.customer_message||'No customer details added.'}`),
    el('p',`Decision: ${d?.decision_state||'awaiting company review'} · version ${d?.decision_version||0} · ${d?.owner_note||'no owner note'}`));
   if(d?.owner_quote_cents!==null&&d?.owner_quote_cents!==undefined)
    row.append(el('p','Owner requote draft: '+money(d.owner_quote_cents)+' — not sent to customer.'));
   if(d?.proposed_start)row.append(el('p',`Owner proposal: ${new Date(d.proposed_start).toLocaleString('en-CA')} — not reserved with Dispatch.`));
   summary.appendChild(row);
   const history=audits.filter(a=>a.request_id===r.id).slice(0,10);
   audit.append(el('strong',`Decision history (${history.length} most recent)`));
   for(const h of history)audit.append(el('p',`v${h.decision_version} · ${h.action} · ${String(h.recorded_at).slice(0,16)} · ${h.state_after?.decision_state||'unknown'}`));
   controls();
  }
  async function refresh(){
   if(busy)return;busy=true;const run=++epoch;verifiedUser='';reset();$('owner554Refresh').disabled=true;controls();
   say('Verifying original company-owner identity and private request queue…');
   try{
    const {id,sb}=await identity();
    const res=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name').limit(101);
    if(run!==epoch)return;
    if(res.error||!Array.isArray(res.data)||res.data.length>100||
       res.data.some(c=>c.owner_user_id!==id||!uuid.test(c.id)))throw Error('Original company ownership could not be verified.');
    const prior=company.value;owned=res.data;verifiedUser=id;
    company.replaceChildren(option('','Select your company'));
    owned.forEach(c=>company.appendChild(option(c.id,c.name)));
    if(owned.some(c=>c.id===prior))company.value=prior;
    else if(owned.length===1)company.value=owned[0].id;
    const companyId=company.value;if(!owned.some(c=>c.id===companyId)){say('Choose your company and refresh.');return;}
    const [q,d,h,c]=await Promise.all([
     sb.from('ywi_landscape_booking_requests_552')
      .select('id,company_id,full_name,contact_value,preferred_contact_method,service_area,requested_date,customer_message,estimated_subtotal_cents,created_at')
      .eq('company_id',companyId).order('created_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_booking_decisions_554')
      .select('company_id,request_id,decision_state,decision_version,owner_note,owner_quote_cents,proposed_start,planned_minutes,updated_at')
      .eq('company_id',companyId).order('updated_at',{ascending:false}).limit(60),
     sb.from('ywi_landscape_booking_decision_audit_554')
      .select('company_id,request_id,action,decision_version,state_after,recorded_at')
      .eq('company_id',companyId).order('id',{ascending:false}).limit(100),
     sb.rpc('ywi_rpc_company_customers_422',{p_company_id:companyId})
    ]);
    if(run!==epoch||company.value!==companyId||window.YWI_AUTH?.getState?.()?.user?.id!==id)
     throw Error('Owner context changed during the read; refresh again.');
    for(const [name,data] of [['requests',q],['decisions',d],['audit',h]]){
     if(data.error||!Array.isArray(data.data)||data.data.some(x=>x.company_id!==companyId))
      throw Error(name+' not verified for this company.');
    }
    if(c.error||!Array.isArray(c.data)||c.data.length>100||c.data.some(x=>!uuid.test(x.id)))
     throw Error('Original company CRM links could not be verified.');
    requests=q.data;decisions=d.data;audits=h.data;clients=c.data;
    request.replaceChildren(option('','Choose a customer request'));
    requests.forEach(x=>request.appendChild(option(x.id,
     `${x.full_name} · ${x.service_area} · ${x.requested_date||'date pending'} · ${decision(x.id)?.decision_state||'awaiting review'}`)));
    client.replaceChildren(option('','Choose a verified customer'));
    clients.forEach(x=>client.appendChild(option(x.id,x.name)));
    say(`Verified owner: ${requests.length} recent requests, ${decisions.length} decisions and ${audits.length} audit entries (each list bounded).`);
   }catch(e){if(run===epoch){reset();say('WITHHELD: '+(e?.message||e));}}
   finally{if(run===epoch){busy=false;$('owner554Refresh').disabled=false;controls();}}
  }
  async function loadProperties(){
   const companyId=company.value,clientId=client.value,run=++epoch;site.replaceChildren(option('','Choose a verified property'));
   if(!uuid.test(clientId)||!owned.some(c=>c.id===companyId)||!verifiedUser)return;
   try{
    const {sb,id}=await identity();if(id!==verifiedUser)throw Error('Owner changed.');
    const r=await sb.rpc('ywi_rpc_customer_history_422',{p_company_id:companyId,p_client_id:clientId});
    if(run!==epoch||company.value!==companyId||client.value!==clientId||id!==window.YWI_AUTH?.getState?.()?.user?.id)
     throw Error('Selection changed during CRM lookup.');
    if(r.error||r.data?.company_id!==companyId||r.data?.client_id!==clientId||
       !Array.isArray(r.data.properties)||r.data.properties.length>80||
       r.data.properties.some(x=>!uuid.test(x.id)))throw Error('Company property links unavailable.');
    r.data.properties.forEach(x=>site.appendChild(option(x.id,x.name+' · '+(x.address||'no address recorded'))));
   }catch(e){site.replaceChildren(option('','Verified property unavailable'));say('WITHHELD CRM link: '+(e?.message||e));}
  }
  async function check(){
   const r=current();if(!r||busy)return;
   try{
    const {id,sb}=await identity(),companyId=company.value;
    if(id!==verifiedUser||!owned.some(c=>c.id===companyId))throw Error('Refresh the verified owner company.');
    const start=iso($('owner554Start').value);
    const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(start));
    const part=type=>dateParts.find(x=>x.type===type)?.value;
    const day=`${part('year')}-${part('month')}-${part('day')}`;
    const review=await sb.rpc('ywi_rpc_landscape_availability_553',{
     p_company_id:companyId,p_request_id:r.id,p_review_date:day});
    if(review.error||review.data?.company_id!==companyId||review.data?.request_id!==r.id||
       review.data?.availability_confirmed!==false||review.data?.dispatch_authorized!==false)
      throw Error('Original 553 availability proof unavailable.');
    availability.textContent=`YW553 ${review.data.availability_state||'unknown'}: area ${review.data.coverage_state}, capacity ${review.data.capacity_state}, Dispatch ${review.data.schedule_state}, weather ${review.data.weather_state}. Remaining crew minutes advisory: ${review.data.remaining_minutes_advisory??'unknown'}. Server rechecks at decision time.`;
   }catch(e){availability.textContent='WITHHELD: '+(e?.message||e);}
  }
  async function act(command){
   if(busy)return;const r=current(),companyId=company.value,d=r&&decision(r.id);
   if(!r)return say('Select a company request.');
   busy=true;controls();let success=false;
   try{
    const {id,sb}=await identity();
    if(id!==verifiedUser||!owned.some(c=>c.id===companyId)||r.company_id!==companyId)
     throw Error('Owner or company context changed. Refresh before deciding.');
    const note=$('owner554Note').value.trim(),params={p_company_id:companyId,p_request_id:r.id,
     p_action:command,p_expected_version:d?.decision_version||0,p_idempotency_key:key(),
     p_owner_note:note,p_quote_cents:null,p_start:null,p_end:null,
     p_client_id:null,p_site_id:null,p_owner_checked:false};
    if(command==='requote'){
     const dollars=$('owner554Requote').value;
     const cents=Math.round(Number(dollars)*100);
     if(dollars===''||!Number.isSafeInteger(cents)||cents<0||cents>100000000)
      throw Error('Enter a CAD draft subtotal between $0 and $1,000,000.');
     params.p_quote_cents=cents;
    }
    if(command==='approve'){
     params.p_start=iso($('owner554Start').value);params.p_end=iso($('owner554End').value);
     if(new Date(params.p_end)<=new Date(params.p_start)||!uuid.test(client.value)||!uuid.test(site.value)||
        !$('owner554Attest').checked)throw Error('Choose a future slot, verified CRM pair and tick owner review acknowledgement.');
     params.p_client_id=client.value;params.p_site_id=site.value;params.p_owner_checked=true;
    }
    if(command!=='approve'&&note.length<3)throw Error('Enter a decision explanation (at least 3 characters).');
    say('Recording '+command+' through the company-owner audit RPC…');
    const response=await sb.rpc('ywi_rpc_landscape_decide_554',params);
    if(response.error||response.data?.company_id!==companyId||response.data?.request_id!==r.id||
      response.data?.no_dispatch_write!==true||response.data?.no_customer_message!==true||
      response.data?.state?.decision_version!==params.p_expected_version+1||
      !['review_hold','requote_draft','declined','approved_pending_dispatch'].includes(response.data?.state?.decision_state))
     throw Error(response.error?.message||'The server did not confirm a versioned owner decision.');
    success=true;say('Saved '+response.data.state.decision_state+'. Dispatch and customer communication remain separate.');
   }catch(e){say('NOT SAVED: '+(e?.message||e));}
   finally{busy=false;controls();if(success)void refresh();}
  }
  company.addEventListener('change',()=>{reset();void refresh();});
  request.addEventListener('change',showSelected);
  client.addEventListener('change',()=>{void loadProperties();});
  $('owner554Refresh').addEventListener('click',()=>void refresh());
  $('owner554Check').addEventListener('click',()=>void check());
  for(const [id,action] of [['owner554Hold','hold'],['owner554Quote','requote'],
    ['owner554Decline','decline'],['owner554Approve','approve']])
   $(id).addEventListener('click',()=>void act(action));
  document.addEventListener('ywi:auth-changed',()=>{epoch++;verifiedUser='';owned=[];reset();company.replaceChildren(option('','Verify owner sign-in first'));say('Owner context changed. Refresh before reviewing customer requests.');controls();});
  controls();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
