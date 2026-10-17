/* File: js/admin-customer-property-crm-ui.js
   Build 340 — Customer & Property CRM.
   Four-season Ontario relationship workbench around canonical customer/property/service authorities.
*/
'use strict';
(function(){
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const byId=(id)=>document.getElementById(id);
  const seasonLabel=(v)=>({spring_summer:'Spring / summer',fall:'Fall',winter:'Winter',four_season:'Four season',other:'Other'}[v]||String(v||'Other').replaceAll('_',' '));
  const mark=(v)=>v?'✓':'—';
  function host(){
    const admin=byId('admin'); if(!admin)return null;
    let el=byId('customerPropertyCrm340'); if(el)return el;
    el=document.createElement('details');
    el.id='customerPropertyCrm340'; el.className='admin-hub-detail'; el.dataset.adminHubTitle='Customer & Property CRM'; el.dataset.adminHubGroups='operations'; el.open=true;
    el.innerHTML=[
      '<summary><span>Customer &amp; Property CRM</span><small>Build 340 · year-round relationship history</small></summary>',
      '<div class="admin-panel-block" data-build="340">',
      '<div class="section-heading"><div><span class="module-kicker">Build 340 · Business &amp; Operations</span><h3>Customer &amp; Property CRM</h3><p class="section-subtitle">One relationship view across leads, customers, properties, estimates, service plans, history, communications, complaints, follow-ups, renewals and explicitly recorded opportunities.</p></div><button id="crm340Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Four-season Ontario operating model:</strong> the same customer/property relationship carries spring/summer mowing and landscaping, fall cleanup and leaf collection, and winter snow clearing/removal history. Winter is a first-class CRM service context.</div>',
      '<div class="notice" style="margin-top:8px;"><strong>Authority boundary:</strong> canonical <code>clients</code>, <code>client_sites</code>, quote/contact leads, recurring service agreements, estimates and work orders remain authoritative. Cross-service candidates are advisory only; nothing here automatically contacts a customer, creates an estimate, schedules work or bills anything.</div>',
      '<div id="crm340Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<section class="admin-panel-block" data-build="392" style="margin-top:14px;" id="crm392Guided"><h4>Guided customer &amp; property creation</h4>',
      '<p class="muted">Existing authorized CRM and Property Site records only. Search and check possible duplicates before pressing Save. Buttons acknowledge pending, saved or failed actions.</p>',
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;">',
      '<div><h5>1. Find or save customer</h5><label>Find customer<input id="crm392CustomerSearch" type="search" placeholder="Search customer or email" style="width:100%;box-sizing:border-box"></label>',
      '<label>Record<select id="crm392CustomerSelect" style="width:100%;box-sizing:border-box"><option value="">New customer</option></select></label>',
      '<label>Legal name<input id="crm392LegalName" maxlength="220" style="width:100%;box-sizing:border-box"></label>',
      '<label>Billing email<input id="crm392Email" type="email" maxlength="320" style="width:100%;box-sizing:border-box"></label>',
      '<label>Phone<input id="crm392Phone" type="tel" maxlength="80" style="width:100%;box-sizing:border-box"></label>',
      '<label>City<input id="crm392CustomerCity" maxlength="120" style="width:100%;box-sizing:border-box"></label>',
      '<button id="crm392SaveCustomer" class="secondary" type="button">Save customer</button>',
      '<div id="crm392CustomerStatus" class="notice" role="status" aria-live="polite"></div></div>',
      '<div><h5>2. Find or save property</h5><label>Find property<input id="crm392PropertySearch" type="search" placeholder="Search property or address" style="width:100%;box-sizing:border-box"></label>',
      '<label>Record<select id="crm392PropertySelect" style="width:100%;box-sizing:border-box"><option value="">New property</option></select></label>',
      '<label>Customer<select id="crm392PropertyCustomer" style="width:100%;box-sizing:border-box"></select></label>',
      '<label>Site name<input id="crm392SiteName" maxlength="180" style="width:100%;box-sizing:border-box"></label>',
      '<label>Service address<input id="crm392Address" maxlength="400" style="width:100%;box-sizing:border-box"></label>',
      '<label>City<input id="crm392SiteCity" maxlength="120" style="width:100%;box-sizing:border-box"></label>',
      '<label>Postal code<input id="crm392Postal" maxlength="30" style="width:100%;box-sizing:border-box"></label>',
      '<button id="crm392SaveProperty" class="secondary" type="button">Save property</button>',
      '<div id="crm392PropertyStatus" class="notice" role="status" aria-live="polite"></div></div>',
      '</div><p class="muted">A matching customer or property is a review warning, not a destructive merge. This view never sends customer messages, schedules jobs or creates invoices. Backend Jobs approve access is mandatory.</p></section>',

      '<section class="admin-panel-block" data-build="407" id="crm407PropertyCoverage" style="margin-top:14px;"><h4>Property &amp; four-season coverage evidence</h4><p class="muted">Site-specific spring/summer, fall and winter agreement evidence for the selected customer-owned property. History, plans in draft/paused status and coverage flags do not prove an active agreement or operational readiness. <a href="/help.html#property-four-season-coverage-407">ⓘ Help</a></p><button type="button" class="secondary" id="crm407Recheck">Recheck property and agreements</button><div id="crm407Evidence" role="status" aria-live="polite"></div></section>',
      '<section class="admin-panel-block" data-build="406" id="crm406Intake" style="margin-top:14px;"><h4>First-customer intake receipt &amp; duplicate review</h4><p class="muted">Dated, read-only source evidence for the selected recorded customer. Possible duplicate names or emails require human review; no automatic merge, creation or contact. <a href="/help.html#first-customer-intake-receipt-406">ⓘ Help</a></p><button type="button" class="secondary" id="crm406Recheck">Recheck canonical intake</button><div id="crm406Receipt" role="status" aria-live="polite"></div></section>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Customers</h4><div id="crm340Customers"></div></div><div class="admin-panel-block"><h4>Selected relationship</h4><div id="crm340Selected"></div></div></div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Open leads</h4><div id="crm340Leads"></div></div><div class="admin-panel-block"><h4>Renewals &amp; follow-ups</h4><div id="crm340Queues"></div></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Record relationship evidence</h4><div class="grid">',
      '<label>Type<select id="crm340InteractionType"><option value="communication">Communication</option><option value="complaint">Complaint</option><option value="service_review">Service review</option><option value="renewal_discussion">Renewal discussion</option><option value="opportunity_note">Opportunity note</option></select></label>',
      '<label>Channel<select id="crm340Channel"><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option><option value="in_person">In person</option><option value="portal">Portal</option><option value="other">Other</option></select></label>',
      '<label>Direction<select id="crm340Direction"><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="internal">Internal</option></select></label>',
      '<label>Season<select id="crm340Season"><option value="spring_summer">Spring / summer</option><option value="fall">Fall</option><option value="winter">Winter</option><option value="four_season">Four season</option><option value="other">Other</option></select></label>',
      '<label>Service<input id="crm340Service" type="text" placeholder="Snow clearing, mowing, fall cleanup…"></label>',
      '<label>Summary<input id="crm340InteractionSummary" type="text"></label>',
      '</div><button id="crm340AddInteraction" class="secondary" type="button">Record Interaction</button></div>',
      '<div class="grid" style="margin-top:14px;"><div class="admin-panel-block"><h4>Schedule follow-up</h4><div class="grid"><label>Due<input id="crm340FollowupDue" type="datetime-local"></label><label>Type<select id="crm340FollowupType"><option value="general">General</option><option value="complaint">Complaint</option><option value="renewal">Renewal</option><option value="service_review">Service review</option><option value="upsell_cross_service">Cross-service</option></select></label><label>Summary<input id="crm340FollowupSummary" type="text"></label></div><button id="crm340AddFollowup" class="secondary" type="button">Add Follow-up</button></div>',
      '<div class="admin-panel-block"><h4>Advisory cross-service candidates</h4><div id="crm340Candidates"></div></div></div>',
      '<div id="crm340Status" class="notice" style="margin-top:10px;"></div>',
      '</div>'
    ].join('');
    admin.appendChild(el); return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI;
    if(!api?.loadAdminDirectory||!api?.manageOperations)return;
    const el=host(); if(!el||el.dataset.mounted==='1')return; el.dataset.mounted='1';
    const state={payload:{},selectedId:'',loaded:false,customerEdit:'',propertyEdit:'',saving:false};
    const arr=(k)=>Array.isArray(state.payload[k])?state.payload[k]:[];
    const notice=(t,bad=false)=>{const e=byId('crm340Status');if(e){e.textContent=t;e.classList.toggle('error',bad);}};
    const selected=()=>arr('crm_customers').find((x)=>String(x.client_id)===String(state.selectedId))||null;
    const coverage=(x)=>'<small>Spring/summer '+mark(x?.spring_summer_coverage)+' · Fall '+mark(x?.fall_coverage)+' · Winter '+mark(x?.winter_coverage)+'</small>';

    const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-CA');
    const val=id=>byId(id)?.value.trim()||'';
    const status392=(kind,message,bad=false)=>{const host=byId('crm392'+kind+'Status');if(host){host.textContent=message;host.classList.toggle('error',bad)}};
    const sourceCustomer=id=>arr('crm_customers').find(r=>String(r.client_id)===String(id));
    const sourceProperty=id=>arr('crm_properties').find(r=>String(r.id)===String(id));
    const customers=()=>arr('crm_customers').filter(r=>r.is_active!==false);
    const propertyCustomerSelect=()=>val('crm392PropertyCustomer');
    function renderGuideOptions(){
      const active=customers(),selectedCustomer=state.customerEdit,selectedProperty=state.propertyEdit;
      const searchCustomer=norm(val('crm392CustomerSearch')),searchProperty=norm(val('crm392PropertySearch'));
      const keep=(list,current,predicate)=>list.filter(r=>predicate(r)||String(r.client_id||r.id)===String(current));
      const matches=keep(active,selectedCustomer,c=>!searchCustomer||norm([c.client_name,c.billing_email,c.client_code].join(' ')).includes(searchCustomer));
      byId('crm392CustomerSelect').innerHTML='<option value="">New customer</option>'+matches.map(c=>
        '<option value="'+esc(c.client_id)+'">'+esc(c.client_name||c.legal_name||'Customer')+'</option>').join('');
      byId('crm392CustomerSelect').value=sourceCustomer(selectedCustomer)?selectedCustomer:'';
      const sites=keep(arr('crm_properties'),selectedProperty,p=>!searchProperty||norm([p.site_name,p.service_address,p.postal_code].join(' ')).includes(searchProperty));
      byId('crm392PropertySelect').innerHTML='<option value="">New property</option>'+sites.map(p=>
        '<option value="'+esc(p.id)+'">'+esc((p.site_name||'Property')+' — '+(p.service_address||'no address'))+'</option>').join('');
      byId('crm392PropertySelect').value=sourceProperty(selectedProperty)?selectedProperty:'';
      const chosen=propertyCustomerSelect();
      byId('crm392PropertyCustomer').innerHTML='<option value="">Choose an existing customer</option>'+
        active.map(c=>'<option value="'+esc(c.client_id)+'">'+esc(c.client_name||c.legal_name||'Customer')+'</option>').join('');
      byId('crm392PropertyCustomer').value=active.some(c=>String(c.client_id)===chosen)?chosen:
        active.some(c=>String(c.client_id)===state.selectedId)?state.selectedId:'';
      byId('crm392SaveCustomer').disabled=state.saving||!state.loaded;
      byId('crm392SaveProperty').disabled=state.saving||!state.loaded||!active.length;
    }
    function renderPropertyCoverage407(){
      const host=byId('crm407Evidence');if(!host)return;
      const proof=state.payload?.crm_property_coverage_407;
      const checked=Date.parse(String(proof?.retrieved_at||''));
      const current=Number.isFinite(checked)&&checked<=Date.now()+300000&&Date.now()-checked<=300000;
      if(!state.loaded||!proof?.complete||!current||!['recorded','no_property'].includes(proof.state)){
        host.innerHTML='<p class="muted" data-crm407-state="withheld">Site/season evidence withheld: a fresh complete permissioned CRM property and agreement read is unavailable.</p>';return;
      }
      if(proof.state==='no_property'){
        host.innerHTML='<p class="muted" data-crm407-state="no_property">No verified customer-owned property in the complete CRM read. No seasonal coverage or winter readiness is inferred.</p>';return;
      }
      const owner=String(state.customerEdit||state.selectedId||'');
      const owned=arr('crm_properties').filter(p=>String(p.client_id)===owner);
      const requested=state.propertyEdit?owned.find(p=>String(p.id)===String(state.propertyEdit)):null;
      const property=requested||(!state.propertyEdit?owned[0]:null);
      const evidence=Array.isArray(proof.properties)&&property?proof.properties.find(p=>String(p.client_site_id)===String(property.id)&&String(p.client_id)===owner):null;
      if(!owner||!property||!evidence||!evidence.seasons){
        host.innerHTML='<p class="muted" data-crm407-state="withheld">Select an existing property belonging to the selected customer. Unmatched site ownership is not evidence.</p>';return;
      }
      const rows=[['spring_summer','Spring / summer'],['fall','Fall'],['winter','Winter']].map(([key,label])=>{
        const season=evidence.seasons[key];
        const valid=season&&['active_agreement_recorded','review_agreement','not_verified'].includes(season.state);
        const stateLabel=!valid?'Withheld':season.state==='active_agreement_recorded'?'Dated active agreement recorded':
          season.state==='review_agreement'?'Agreement exists; status or dates require review':'No verified active site agreement';
        return '<div class="notice" data-crm407-season="'+esc(key)+'"><strong>'+esc(label)+'</strong> · '+esc(stateLabel)+
          '<br><small>Site-scoped agreement records: '+esc(valid?season.agreement_count:'Withheld')+
          '. This is not a workability, crew, weather or safety clearance.</small></div>';
      }).join('');
      host.innerHTML='<p data-crm407-state="recorded"><strong>Owned site:</strong> '+esc(property.site_name||'Property')+
        ' · <small>Checked '+esc(new Date(checked).toLocaleString('en-CA'))+'</small></p>'+rows+
        '<p class="muted">Draft, paused, unclassified, future or incomplete-date plans do not count as active coverage. Customer-only agreements cannot establish a particular site. No changes or bookings were made.</p>';
    }
    function renderIntake406(){
      const host=byId('crm406Receipt');if(!host)return;
      const evidence=state.payload?.crm_intake_406;
      const retrieved=Date.parse(String(evidence?.retrieved_at||''));
      const current=Number.isFinite(retrieved)&&retrieved<=Date.now()+300000&&Date.now()-retrieved<=300000;
      if(!state.loaded||!evidence?.complete||!current||!['recorded','no_record'].includes(evidence?.state)){
        host.innerHTML='<p class="muted" data-crm406-state="withheld">Intake receipt withheld: canonical date, source coverage, permission or freshness has not been verified. Recheck before treating this as a record.</p>';return;
      }
      if(evidence.state==='no_record'){
        host.innerHTML='<p class="muted" data-crm406-state="no_record">No dated first-customer intake receipt exists in the complete current CRM read. Create a real customer only through the existing authorized Save customer workflow after checking possible matches.</p>';return;
      }
      const id=state.customerEdit||state.selectedId;
      const record=arr('crm_customers').find(r=>String(r.client_id)===String(id));
      const receipt=Array.isArray(evidence.receipts)?evidence.receipts.find(r=>String(r.client_id)===String(id)):null;
      const stamp=Date.parse(String(receipt?.recorded_at||''));
      if(!record||!Number.isFinite(stamp)||stamp>Date.now()+300000){
        host.innerHTML='<p class="muted" data-crm406-state="withheld">No dated source-linked intake receipt for the selected customer. Select a canonical customer and refresh.</p>';return;
      }
      const name=norm(val('crm392LegalName')||record.client_name||record.legal_name);
      const email=norm(val('crm392Email')||record.billing_email);
      const candidates=arr('crm_customers').filter(r=>String(r.client_id)!==String(id)&&
        ((name&&norm(r.client_name||r.legal_name)===name)||(email&&norm(r.billing_email)===email)));
      host.innerHTML='<p class="notice" data-crm406-state="recorded"><strong>Recorded customer intake</strong> · '+esc(record.client_name||record.legal_name||'Selected customer')+
        '<br><small>Canonical created: '+esc(new Date(stamp).toLocaleString('en-CA'))+
        ' · Intake rechecked: '+esc(new Date(retrieved).toLocaleString('en-CA'))+'</small></p>'+
        (candidates.length?'<p class="notice" data-crm406-duplicates="review">Possible duplicate customers in the complete CRM read: '+
          esc(candidates.slice(0,3).map(r=>r.client_name||r.legal_name||'Existing customer').join(', '))+
          '. Review the existing record before any new Save. No automatic merge.</p>':
          '<p class="muted" data-crm406-duplicates="none">No exact name/email match in the inspected complete CRM read. This does not guarantee uniqueness outside current authority.</p>');
    }
    function fillCustomer(){
      const c=sourceCustomer(state.customerEdit)||{};
      for(const [key,source] of [['crm392LegalName','legal_name'],['crm392Email','billing_email'],
        ['crm392Phone','phone'],['crm392CustomerCity','city']])byId(key).value=String(c[source]||'');
      status392('Customer',state.customerEdit?'Editing recorded customer. Save changes explicitly.':'New customer — complete legal name and review existing matches.');
    }
    function fillProperty(){
      const p=sourceProperty(state.propertyEdit)||{};
      for(const [key,source] of [['crm392SiteName','site_name'],['crm392Address','service_address'],
        ['crm392SiteCity','city'],['crm392Postal','postal_code']])byId(key).value=String(p[source]||'');
      if(p.client_id&&customers().some(c=>String(c.client_id)===String(p.client_id)))byId('crm392PropertyCustomer').value=String(p.client_id);
      status392('Property',state.propertyEdit?'Editing recorded property; service address is canonical.':'New property — select a real customer first.');
    }
    async function guidedSave(kind){
      if(state.saving||!state.loaded)return;
      const isCustomer=kind==='Customer';
      const button=byId(isCustomer?'crm392SaveCustomer':'crm392SaveProperty');
      const name=val(isCustomer?'crm392LegalName':'crm392SiteName');
      if(!name)return status392(kind,isCustomer?'Customer legal name is required.':'Property/site name is required.',true);
      const edit=isCustomer?state.customerEdit:state.propertyEdit;
      const row=isCustomer?sourceCustomer(edit):sourceProperty(edit);
      if(edit&&!row)return status392(kind,'Selected record is not in the latest CRM read. Refresh first.',true);
      if(isCustomer&&!edit&&state.payload?.crm_intake_406){
        const evidence=state.payload.crm_intake_406;
        const checked=Date.parse(String(evidence.retrieved_at||''));
        if(!evidence.complete||!['recorded','no_record'].includes(evidence.state)||
           !Number.isFinite(checked)||checked>Date.now()+300000||Date.now()-checked>300000)
          return status392(kind,'Current complete canonical CRM intake verification is unavailable. Recheck before creating a customer.',true);
      }
      if(isCustomer){
        const email=val('crm392Email');
        if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return status392(kind,'Please enter a valid billing email.',true);
        const duplicate=customers().find(c=>String(c.client_id)!==String(edit)&&
          (norm(c.client_name||c.legal_name)===norm(name)||(email&&norm(c.billing_email)===norm(email))));
        if(duplicate)return status392(kind,'Possible duplicate customer: '+(duplicate.client_name||duplicate.legal_name||'Existing customer')+'. Search/select the existing record before creating another.',true);
      }else{
        const clientId=propertyCustomerSelect();
        if(!clientId||!sourceCustomer(clientId))return status392(kind,'Choose an existing customer before saving the property.',true);
        const address=val('crm392Address');
        const duplicate=arr('crm_properties').find(p=>String(p.id)!==String(edit)&&String(p.client_id)===clientId&&(
          (address&&norm(p.service_address)===norm(address))||norm(p.site_name)===norm(name)));
        if(duplicate)return status392(kind,'Possible duplicate property: '+(duplicate.site_name||'Existing site')+'. Search/select it to edit rather than creating a second site.',true);
      }
      const payload=isCustomer?{
        action:'crm_client_save',...(edit?{id:edit}:{}),legal_name:name,
        billing_email:val('crm392Email'),phone:val('crm392Phone'),city:val('crm392CustomerCity'),
        ...(!edit?{crm_lifecycle_stage:'customer'}:{})
      }:{
        action:'property_site_save',...(edit?{id:edit}:{}),client_id:propertyCustomerSelect(),
        site_name:name,service_address:val('crm392Address'),city:val('crm392SiteCity'),postal_code:val('crm392Postal')
      };
      state.saving=true;
      button.textContent='Saving…';button.disabled=true;
      byId('crm392SaveCustomer').disabled=true;byId('crm392SaveProperty').disabled=true;
      status392(kind,'Saving in the authorized CRM workflow…');
      try{
        const result=await api.manageOperations(payload);
        if(!result?.ok)throw new Error(result?.error||'Backend did not acknowledge the save.');
        const recordId=isCustomer?String(result.record?.client_id||result.record?.id||''):String(result.record?.id||'');
        if(!recordId)throw new Error('Save response did not contain the canonical record identifier. Verify the source before retrying.');
        if(isCustomer){state.customerEdit=recordId;state.selectedId=recordId}
        else state.propertyEdit=recordId;
        const refreshed=await load();
        if(!refreshed)throw new Error('Save was acknowledged, but the CRM readback failed. Verify the record before retrying.');
        status392(kind,'Saved and CRM records reloaded. The backend acknowledged '+(edit?'an update.':'a new record.')+' No automatic additional action was taken.');
      }catch(e){status392(kind,String(e?.message||e),true)}
      finally{state.saving=false;button.textContent=isCustomer?'Save customer':'Save property';renderGuideOptions()}
    }
    function render(){
      renderGuideOptions();
      renderIntake406();
      const customers=arr('crm_customers').filter((x)=>x.is_active!==false);
      if(!state.selectedId&&customers[0])state.selectedId=String(customers[0].client_id);
      renderPropertyCoverage407();
      const openFollowups=arr('crm_followups').filter((x)=>['pending','in_progress','deferred'].includes(x.followup_status)).length;
      const renewals=arr('crm_renewals').filter((x)=>x.renewal_status!=='open_ended').length;
      const opportunities=arr('crm_opportunities').filter((x)=>['identified','contact_ready','quoted','on_hold'].includes(x.opportunity_status)).length;
      byId('crm340Summary').innerHTML=[
        ['Customers',customers.length],['Properties',arr('crm_properties').length],['Open leads',arr('crm_leads').filter((x)=>!x.converted_client_id).length],
        ['Open follow-ups',openFollowups],['Renewals',renewals],['Open opportunities',opportunities]
      ].map((x)=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      byId('crm340Customers').innerHTML=customers.length?customers.map((c)=>'<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-crm-customer="'+esc(c.client_id)+'"><strong>'+esc(c.client_name)+'</strong> · '+esc(c.crm_lifecycle_stage)+'<br>'+coverage(c)+'</button>').join(''):'<p class="muted">No customers loaded.</p>';
      const c=selected();
      if(!c){byId('crm340Selected').innerHTML='<p class="muted">Select a customer.</p>';return;}
      const props=arr('crm_properties').filter((x)=>String(x.client_id)===String(c.client_id));
      const plans=arr('crm_service_plans').filter((x)=>String(x.client_id)===String(c.client_id));
      const history=arr('crm_service_history').filter((x)=>String(x.client_id)===String(c.client_id)).slice(0,8);
      const interactions=arr('crm_interactions').filter((x)=>String(x.client_id)===String(c.client_id)).slice(0,6);
      byId('crm340Selected').innerHTML=[
        '<div class="notice"><strong>'+esc(c.client_name)+'</strong> · '+esc(c.crm_lifecycle_stage)+'<br>'+coverage(c)+'<br><small>'+esc(c.crm_preferred_contact_method||'No preferred contact method')+(c.crm_preferred_contact_window?' · '+esc(c.crm_preferred_contact_window):'')+'</small></div>',
        '<h5>Properties & preferences</h5>',props.length?props.map((p)=>'<div class="notice"><strong>'+esc(p.site_name)+'</strong> · '+esc(p.service_address||'No address')+'<br>'+coverage(p)+'<br><small>Access: '+esc(p.access_notes||'—')+' · Pets: '+esc(p.pet_notes||'—')+' · Recurring instructions: '+esc(p.recurring_property_instructions||'—')+'</small></div>').join(''):'<p class="muted">No properties.</p>',
        '<h5>Active service plans</h5>',plans.length?plans.map((p)=>'<div class="notice"><strong>'+esc(p.service_name)+'</strong> · '+esc(seasonLabel(p.season_context))+' · '+esc(p.agreement_status)+'</div>').join(''):'<p class="muted">No service plans.</p>',
        '<h5>Service history</h5>',history.length?history.map((h)=>'<div class="notice">'+esc(h.reference_code)+' · '+esc(h.service_type)+' · '+esc(seasonLabel(h.season_context))+' · '+esc(h.status)+'</div>').join(''):'<p class="muted">No estimate/work-order history.</p>',
        '<h5>Interactions & complaints</h5>',interactions.length?interactions.map((i)=>'<div class="notice"><strong>'+esc(i.interaction_type)+'</strong> · '+esc(seasonLabel(i.season_context))+'<br>'+esc(i.summary)+'</div>').join(''):'<p class="muted">No CRM interactions yet.</p>'
      ].join('');
      const leads=arr('crm_leads').slice(0,8);
      byId('crm340Leads').innerHTML=leads.length?leads.map((l)=>'<div class="notice"><strong>'+esc(l.full_name||'Lead')+'</strong> · '+esc(l.service_type||'Service not set')+'<br><small>'+esc(l.request_status||'new')+(l.converted_client_id?' · linked to customer':' · not yet converted')+'</small></div>').join(''):'<p class="muted">No lead evidence.</p>';
      const q1=arr('crm_followups').filter((x)=>String(x.client_id)===String(c.client_id)&&['pending','in_progress','deferred'].includes(x.followup_status)).slice(0,6).map((x)=>'<div class="notice"><strong>'+esc(x.followup_type)+'</strong> · '+esc(x.priority)+(x.overdue?' · OVERDUE':'')+'<br>'+esc(x.summary)+'</div>');
      const q2=arr('crm_renewals').filter((x)=>String(x.client_id)===String(c.client_id)).slice(0,4).map((x)=>'<div class="notice"><strong>Renewal:</strong> '+esc(x.service_name)+' · '+esc(x.renewal_status)+' · '+esc(seasonLabel(x.season_context))+'</div>');
      byId('crm340Queues').innerHTML=[...q1,...q2].join('')||'<p class="muted">No pending relationship work.</p>';
      const candidates=arr('crm_cross_service_candidates').filter((x)=>String(x.client_id)===String(c.client_id));
      byId('crm340Candidates').innerHTML=candidates.length?candidates.map((x)=>'<div class="notice"><strong>'+esc(x.target_service_type)+'</strong> · '+esc(seasonLabel(x.season_context))+'<br><small>'+esc(x.candidate_reason)+'</small><br><button type="button" class="secondary" data-crm-candidate="'+esc(x.client_site_id)+'" data-season="'+esc(x.season_context)+'" data-service="'+esc(x.target_service_type)+'">Record Opportunity</button></div>').join(''):'<p class="muted">No uncovered seasonal service candidates.</p>';
    }
    async function load(){
      notice('Loading Customer & Property CRM…');
      try{
        const r=await api.loadAdminDirectory({scope:'crm',limit:1000});
        if(!r?.ok)throw new Error(r?.error||'CRM access denied or load failed.');
        if(!Array.isArray(r.crm_customers)||!Array.isArray(r.crm_properties))throw new Error('CRM customer/property sources not returned; intake is withheld.');
        state.payload=r;state.loaded=true;
        if(!arr('crm_customers').some((x)=>String(x.client_id)===String(state.selectedId)))state.selectedId=String(arr('crm_customers')[0]?.client_id||'');
        render();notice('CRM loaded. Canonical customer and property sources checked.');
        return true;
      }catch(e){
        state.loaded=false;state.payload={crm_customers:[],crm_properties:[]};
        render();notice(String(e?.message||e),true);return false;
      }
    }
    async function manage(payload,ok){
      const r=await api.manageOperations(payload);
      if(!r?.ok)return notice(r?.error||'CRM update failed.',true);
      await load(); notice(ok);
    }
    byId('crm340Refresh').onclick=load;
    byId('crm406Recheck').onclick=load;
    byId('crm407Recheck').onclick=load;
    byId('crm392PropertyCustomer').onchange=renderPropertyCoverage407;
    byId('crm392LegalName').addEventListener('input',renderIntake406);
    byId('crm392Email').addEventListener('input',renderIntake406);
    byId('crm392CustomerSearch').oninput=renderGuideOptions;
    byId('crm392PropertySearch').oninput=renderGuideOptions;
    byId('crm392CustomerSelect').onchange=()=>{state.customerEdit=val('crm392CustomerSelect');fillCustomer();renderIntake406();renderPropertyCoverage407()};
    byId('crm392PropertySelect').onchange=()=>{state.propertyEdit=val('crm392PropertySelect');fillProperty();renderPropertyCoverage407()};
    byId('crm392SaveCustomer').onclick=()=>guidedSave('Customer');
    byId('crm392SaveProperty').onclick=()=>guidedSave('Property');
    byId('crm340Customers').onclick=(e)=>{const b=e.target.closest('[data-crm-customer]');if(!b)return;state.selectedId=b.getAttribute('data-crm-customer')||'';render();};
    byId('crm340AddInteraction').onclick=()=>{
      const c=selected(); if(!c)return notice('Select a customer first.',true);
      const type=byId('crm340InteractionType').value;
      manage({action:'crm_interaction_save',client_id:c.client_id,interaction_type:type,channel:byId('crm340Channel').value,direction:byId('crm340Direction').value,
        interaction_status:type==='complaint'?'open':'informational',complaint_status:type==='complaint'?'open':null,
        season_context:byId('crm340Season').value,service_type:byId('crm340Service').value.trim(),summary:byId('crm340InteractionSummary').value.trim()},'CRM interaction recorded.');
    };
    byId('crm340AddFollowup').onclick=()=>{
      const c=selected(); if(!c)return notice('Select a customer first.',true);
      manage({action:'crm_followup_save',client_id:c.client_id,followup_type:byId('crm340FollowupType').value,followup_status:'pending',priority:'normal',
        due_at:byId('crm340FollowupDue').value,season_context:byId('crm340Season').value,service_type:byId('crm340Service').value.trim(),summary:byId('crm340FollowupSummary').value.trim()},'CRM follow-up scheduled.');
    };
    byId('crm340Candidates').onclick=(e)=>{
      const b=e.target.closest('[data-crm-candidate]');if(!b)return;const c=selected();if(!c)return;
      manage({action:'crm_opportunity_save',client_id:c.client_id,client_site_id:b.getAttribute('data-crm-candidate'),opportunity_type:'cross_service',
        opportunity_status:'identified',target_service_type:b.getAttribute('data-service'),season_context:b.getAttribute('data-season'),
        reason:'Advisory four-season coverage gap recorded by Build 340 CRM.'},'Advisory cross-service opportunity recorded.');
    };
    await load();
  }
  window.YWICustomerPropertyCRMUI={mount};
})();
