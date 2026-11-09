/* YW 553 — owner-only coverage and crew-minutes advisory.
   Original Dispatch authority remains with 435. Nothing here reserves a crew,
   accepts a booking, moves a route, clears weather, or sends a customer message. */
(() => {'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,value)=>{const item=document.createElement(tag);if(value!==undefined)item.textContent=String(value);return item;};
 const isoDate=/^\d{4}-\d{2}-\d{2}$/;
 const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const areaKey=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
 function mount(){
  const settings=$('settings');if(!settings||$('owner553'))return;
  const panel=node('details');panel.id='owner553';panel.className='admin-hub-detail';
  panel.innerHTML=`<summary>Landscaping · Service Area, Crew Capacity &amp; Availability (owner only)</summary>
   <div class="admin-panel-block">
    <p>This is a company-owner advisory, using the original dated Dispatch 435 evidence.
    A possible opening is NEVER a confirmed appointment. Weather, equipment, site access,
    staff shifts and actual acceptance remain separate checks.</p>
    <label>Verified landscaping company <select id="owner553Company" aria-label="Verified landscaping company"></select></label>
    <button id="owner553Refresh" type="button" class="secondary">Refresh owner evidence</button>
    <p id="owner553Status" role="status" aria-live="polite">Sign in and refresh to verify your company.</p>
    <fieldset><legend>1. Define an exact town/area coverage rule</legend>
     <label>Town or service-area name <input id="owner553Area" maxlength="80" placeholder="Tillsonburg" /></label>
     <label>Coverage <select id="owner553Coverage"><option value="included">Included</option><option value="excluded">Excluded</option></select></label>
     <button id="owner553SaveArea" type="button" class="secondary">Save company coverage rule</button>
     <div id="owner553Areas"></div>
    </fieldset>
    <fieldset><legend>2. Declare available crew minutes for one date</legend>
     <p>Enter a reviewed planning budget, not employee shifts or a dispatch commitment.
     Maximum 12 hours per declared crew, before existing Dispatch assignments are deducted.</p>
     <label>Service date <input id="owner553Date" type="date" /></label>
     <label>Number of planned crews <input id="owner553CrewCount" type="number" min="1" max="30" step="1" value="1" /></label>
     <label>Total crew minutes for that date <input id="owner553Minutes" type="number" min="0" max="21600" step="1" value="480" /></label>
     <label>Owner note (optional) <input id="owner553Note" maxlength="500" /></label>
     <button id="owner553SavePlan" type="button" class="secondary">Save date-specific capacity plan</button>
     <div id="owner553Plans"></div>
    </fieldset>
    <fieldset><legend>3. Review a customer's requested date</legend>
     <label>Owner-reviewable request <select id="owner553Request" aria-label="Company quote request"></select></label>
     <button id="owner553Review" type="button" class="primary">Validate against current company evidence</button>
     <div id="owner553Result" role="status" aria-live="polite">No review performed. A request stays pending owner approval.</div>
    </fieldset>
   </div>`;
  settings.appendChild(panel);
  const select=$('owner553Company'),status=$('owner553Status'),requestSelect=$('owner553Request');
  const areaList=$('owner553Areas'),planList=$('owner553Plans'),result=$('owner553Result');
  let companies=[],requests=[],areas=[],plans=[],verifiedUser='',busy=false,epoch=0;
  const option=(value,label)=>{const o=node('option',label);o.value=value;return o;};
  const say=(msg)=>{status.textContent=msg;};
  const clear=()=>{requests=[];areas=[];plans=[];areaList.replaceChildren();planList.replaceChildren();
   requestSelect.replaceChildren(option('','Select a request'));result.textContent='Review not yet performed.';};
  async function identity(){
   const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
   if(auth?.isAuthenticated!==true||!validUuid.test(auth.user?.id||'')||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
    throw Error('Verified company-owner sign-in is required.');
   const proof=await sb.auth.getUser();
   if(proof.error||proof.data?.user?.id!==auth.user.id)throw Error('Owner session could not be verified.');
   return {sb,id:auth.user.id};
  }
  async function refresh(){
   if(busy)return;busy=true;const run=++epoch;$('owner553Refresh').disabled=true;clear();verifiedUser='';companies=[];
   say('Verifying company and refreshing owner-scoped evidence…');
   try{
    const {sb,id}=await identity();
    const owned=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name').limit(101);
    if(run!==epoch)return;
    if(owned.error||!Array.isArray(owned.data)||owned.data.length>100||
       owned.data.some(c=>c.owner_user_id!==id||!validUuid.test(c.id)))throw Error('Owner company list could not be verified.');
    companies=owned.data;verifiedUser=id;
    const old=select.value;select.replaceChildren(option('','Select an owner company'));
    companies.forEach(c=>select.appendChild(option(c.id,c.name)));
    if(companies.some(c=>c.id===old))select.value=old;else if(companies.length===1)select.value=companies[0].id;
    const companyId=select.value;
    if(!companies.some(c=>c.id===companyId)){say('Select a company, then refresh.');return;}
    const [q,a,p]=await Promise.all([
     sb.from('ywi_landscape_booking_requests_552').select('id,company_id,full_name,service_area,requested_date,request_status,created_at')
      .eq('company_id',companyId).order('created_at',{ascending:false}).limit(40),
     sb.from('ywi_landscape_service_areas_553').select('company_id,area_key,display_name,coverage_state,active,updated_at')
      .eq('company_id',companyId).order('area_key').limit(81),
     sb.from('ywi_landscape_capacity_plans_553').select('company_id,service_date,crew_count,capacity_minutes,review_note,updated_at')
      .eq('company_id',companyId).order('service_date',{ascending:false}).limit(121)
    ]);
    const now=window.YWI_AUTH?.getState?.();
    if(run!==epoch||now?.isAuthenticated!==true||now.user?.id!==id||select.value!==companyId)
     throw Error('Owner session or company changed during review.');
    for(const [name,data,limit] of [['requests',q,40],['areas',a,80],['plans',p,120]]){
     if(data.error||!Array.isArray(data.data)||data.data.length>limit||
       data.data.some(row=>row.company_id!==companyId))throw Error(name+' source was unavailable or not company-scoped.');
    }
    requests=q.data;areas=a.data;plans=p.data;
    requestSelect.replaceChildren(option('','Select a pending request'));
    requests.forEach(r=>requestSelect.appendChild(option(r.id,
      `${r.full_name} · ${r.service_area} · ${r.requested_date||'date not supplied'}`)));
    areaList.replaceChildren(node('p',areas.length+' owner-scoped coverage rules'));
    for(const a of areas){areaList.appendChild(node('p',
      `${a.display_name} — ${a.active?a.coverage_state:'inactive'} (exact-area match only)`));}
    planList.replaceChildren(node('p',plans.length+' dated capacity plans (latest 120 maximum)'));
    for(const p of plans.slice(0,12))planList.appendChild(node('p',
      `${p.service_date}: ${p.crew_count} crew(s), ${p.capacity_minutes} owner-declared minutes · updated ${String(p.updated_at).slice(0,10)}`));
    say('Verified owner: '+requests.length+' requests, '+areas.length+' area rules and '+plans.length+' capacity plans.');
   }catch(e){if(run===epoch){clear();say('WITHHELD: '+(e?.message||e));}}
   finally{if(run===epoch){busy=false;$('owner553Refresh').disabled=false;}}
  }
  async function act(action){
   if(busy)return;busy=true;
   const companyId=select.value,selectedRequest=requestSelect.value;
   try{
    const {sb,id}=await identity();
    if(id!==verifiedUser||!companies.some(c=>c.id===companyId))throw Error('Refresh and verify company ownership first.');
    if(action==='area'){
     const name=$('owner553Area').value.trim(),key=areaKey(name),coverage=$('owner553Coverage').value;
     if(key.length<2||key.length>80||!/^[a-z0-9][a-z0-9 .'-]{1,79}$/.test(key)||
       !['included','excluded'].includes(coverage))throw Error('Use a plain town/area name and explicit coverage choice.');
     const existing=areas.some(a=>a.area_key===key);
     const res=existing?await sb.from('ywi_landscape_service_areas_553')
      .update({display_name:name,coverage_state:coverage,active:true}).eq('company_id',companyId).eq('area_key',key)
      .select('company_id,area_key,coverage_state'):
      await sb.from('ywi_landscape_service_areas_553')
       .insert({company_id:companyId,area_key:key,display_name:name,coverage_state:coverage,active:true})
       .select('company_id,area_key,coverage_state');
     if(res.error||res.data?.length!==1||res.data[0].company_id!==companyId||
       res.data[0].area_key!==key||res.data[0].coverage_state!==coverage)
      throw Error('Company coverage rule was not confirmed by the database.');
     say('Company coverage rule saved; refresh to read current evidence.');
    }else if(action==='plan'){
     const date=$('owner553Date').value,crews=Number($('owner553CrewCount').value),
      minutes=Number($('owner553Minutes').value),note=$('owner553Note').value.trim();
     if(!isoDate.test(date)||!Number.isSafeInteger(crews)||crews<1||crews>30||
       !Number.isSafeInteger(minutes)||minutes<0||minutes>crews*720||note.length>500)
      throw Error('Enter date, 1–30 crews and at most 720 minutes per crew.');
     const existing=await sb.from('ywi_landscape_capacity_plans_553').select('company_id,service_date')
      .eq('company_id',companyId).eq('service_date',date).limit(1);
     if(existing.error||!Array.isArray(existing.data)||existing.data.length>1||
       existing.data.some(p=>p.company_id!==companyId))throw Error('Capacity plan identity could not be checked.');
     const res=existing.data.length?await sb.from('ywi_landscape_capacity_plans_553')
      .update({crew_count:crews,capacity_minutes:minutes,review_note:note})
      .eq('company_id',companyId).eq('service_date',date).select('company_id,service_date,capacity_minutes'):
      await sb.from('ywi_landscape_capacity_plans_553')
       .insert({company_id:companyId,service_date:date,crew_count:crews,capacity_minutes:minutes,review_note:note})
       .select('company_id,service_date,capacity_minutes');
     if(res.error||res.data?.length!==1||res.data[0].company_id!==companyId||
       res.data[0].service_date!==date||res.data[0].capacity_minutes!==minutes)
      throw Error('Owner capacity plan was not confirmed by the database.');
     say('Crew-minute plan saved. Refresh and recheck the request; no crew was scheduled.');
    }else if(action==='review'){
     if(!requests.some(r=>r.id===selectedRequest))throw Error('Choose a verified company request.');
     const date=$('owner553Date').value;
     if(!isoDate.test(date))throw Error('Select a review date; customer requested dates can be empty.');
     const res=await sb.rpc('ywi_rpc_landscape_availability_553',
       {p_company_id:companyId,p_request_id:selectedRequest,p_review_date:date});
     const proof=res.data,authNow=window.YWI_AUTH?.getState?.();
     if(res.error||authNow?.isAuthenticated!==true||authNow.user?.id!==id||
       select.value!==companyId||requestSelect.value!==selectedRequest||
       proof?.company_id!==companyId||proof?.request_id!==selectedRequest||
       proof?.company_scope_only!==true||proof?.advisory_only!==true||
       proof?.availability_confirmed!==false||proof?.dispatch_authorized!==false||
       proof?.no_business_writes!==true||proof?.source!=='company_owner_553_plus_original_dispatch_435'||
       !['hold','unknown','review'].includes(proof?.availability_state)||
       !Array.isArray(proof?.reasons)||proof.reasons.length>20)
      throw Error('Fresh owner-scoped availability evidence was not verified.');
     result.replaceChildren(node('strong',proof.availability_state.toUpperCase()+' — advisory, not a reservation'));
     result.appendChild(node('p',`Coverage: ${proof.coverage_state} · Crew budget: ${proof.capacity_state} · Original Dispatch: ${proof.schedule_state} · Weather: ${proof.weather_state}`));
     if(proof.review_matches_customer_date===false)
      result.appendChild(node('p','Chosen review date differs from the customer request. Confirm the change with the customer before scheduling.'));
     result.appendChild(node('p',`Owner crew minutes: ${proof.declared_crew_minutes??'unknown'} · Existing scheduled minutes: ${proof.scheduled_minutes} · Potential headroom: ${proof.remaining_minutes_advisory??'unknown'} · Reviewed: ${String(proof.evaluated_at||'').slice(0,19)}`));
     const list=node('ul');proof.reasons.forEach(reason=>list.appendChild(node('li',reason)));result.appendChild(list);
     say('Evidence review completed. Only the company owner can confirm a future booking.');
    }
    const current=window.YWI_AUTH?.getState?.();
    if(current?.isAuthenticated!==true||current.user?.id!==id||select.value!==companyId)
     throw Error('Owner session changed; refresh before using the result.');
   }catch(e){say('WITHHELD: '+(e?.message||e));if(action==='review')result.textContent='No availability was confirmed.';}
   finally{busy=false;}
  }
  $('owner553Refresh').addEventListener('click',refresh);
  select.addEventListener('change',()=>{verifiedUser='';clear();say('Company changed. Refresh to verify its ownership.');});
  requestSelect.addEventListener('change',()=>{
   const q=requests.find(r=>r.id===requestSelect.value);
   $('owner553Date').value=q?.requested_date||'';result.textContent='Date selected; no capacity check yet.';
  });
  $('owner553SaveArea').addEventListener('click',()=>act('area'));
  $('owner553SavePlan').addEventListener('click',()=>act('plan'));
  $('owner553Review').addEventListener('click',()=>act('review'));
  document.addEventListener('ywi:auth-changed',()=>{
   epoch++;busy=false;$('owner553Refresh').disabled=false;
   verifiedUser='';companies=[];select.replaceChildren();clear();
   say('Session changed. Refresh and verify the company again.');
  });
 }
 window.YWI553=Object.freeze({mount});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
