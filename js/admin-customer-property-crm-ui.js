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
    const state={payload:{},selectedId:''};
    const arr=(k)=>Array.isArray(state.payload[k])?state.payload[k]:[];
    const notice=(t,bad=false)=>{const e=byId('crm340Status');if(e){e.textContent=t;e.classList.toggle('error',bad);}};
    const selected=()=>arr('crm_customers').find((x)=>String(x.client_id)===String(state.selectedId))||null;
    const coverage=(x)=>'<small>Spring/summer '+mark(x?.spring_summer_coverage)+' · Fall '+mark(x?.fall_coverage)+' · Winter '+mark(x?.winter_coverage)+'</small>';
    function render(){
      const customers=arr('crm_customers').filter((x)=>x.is_active!==false);
      if(!state.selectedId&&customers[0])state.selectedId=String(customers[0].client_id);
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
      const r=await api.loadAdminDirectory({scope:'crm',limit:1000});
      if(!r?.ok)return notice(r?.error||'CRM load failed.',true);
      state.payload=r;
      if(!arr('crm_customers').some((x)=>String(x.client_id)===String(state.selectedId)))state.selectedId=String(arr('crm_customers')[0]?.client_id||'');
      render(); notice('CRM loaded. Four-season customer/property history is unified.');
    }
    async function manage(payload,ok){
      const r=await api.manageOperations(payload);
      if(!r?.ok)return notice(r?.error||'CRM update failed.',true);
      await load(); notice(ok);
    }
    byId('crm340Refresh').onclick=load;
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
