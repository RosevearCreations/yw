(()=>{
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
  const label=(v)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase());
  const SERVICES=[
    ['mowing_landscaping','Mowing / landscaping'],
    ['landscape_installation','Landscape installation'],
    ['fall_cleanup','Fall cleanup / leaf collection'],
    ['snow_clearing_removal','Snow clearing / removal'],
    ['general_outdoor','General outdoor']
  ];
  const SEASONS=[['spring_summer','Spring / summer'],['fall','Fall'],['winter','Winter'],['four_season','Four-season']];
  function options(rows){return rows.map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('');}
  function host(){
    const admin=document.getElementById('admin'); if(!admin)return null;
    let el=$('changeOrdersExtras344'); if(el)return el;
    el=document.createElement('section');el.id='changeOrdersExtras344';el.className='admin-panel';el.dataset.adminHubGroups='operations';
    el.innerHTML=[
      '<h3>Build 344 — Change Orders &amp; Extras</h3>',
      '<p class="muted">Crew discovery → evidence/photos → office/supervisor review &amp; pricing → customer authorization → one audited work-order scope/budget application → invoice evidence. <strong>No hidden field pricing or billing.</strong></p>',
      '<div class="notice"><strong>Four-season coverage:</strong> mowing/landscaping, landscape installation, fall cleanup/leaf collection and winter snow clearing/removal use the same controlled workflow.</div>',
      '<div id="co344Summary" class="admin-backbone-grid" style="margin-top:10px;"></div>',
      '<div class="admin-panel-block"><h4>1. Crew field discovery</h4>',
      '<div class="grid"><label>Work order<select id="co344WorkOrder"></select></label><label>Service<select id="co344Service">'+options(SERVICES)+'</select></label><label>Season<select id="co344Season">'+options(SEASONS)+'</select></label></div>',
      '<label>Extra work discovered<textarea id="co344Discovery" placeholder="Describe what was found on site and why it is outside the current scope."></textarea></label>',
      '<label>Proposed scope description (optional at discovery)<textarea id="co344Scope"></textarea></label>',
      '<label>Reason / site context<textarea id="co344Reason"></textarea></label>',
      '<button id="co344Discover" class="secondary" type="button">Save Field Discovery</button>',
      '<p class="muted">This step records the need only. It cannot change customer price or the work-order budget.</p></div>',
      '<div class="admin-panel-block"><h4>2. Evidence / photos</h4><label>Change order<select id="co344EvidenceChange"></select></label>',
      '<div class="grid"><label>Evidence type<select id="co344EvidenceType"><option value="photo">Photo</option><option value="measurement">Measurement</option><option value="note">Note</option><option value="customer_message">Customer message</option><option value="document">Document</option><option value="other">Other</option></select></label><label>Evidence reference<input id="co344EvidenceRef" type="text" placeholder="Private asset path, document ID, photo reference, measurement note…"></label></div>',
      '<label>Caption / context<textarea id="co344EvidenceCaption"></textarea></label><label><input id="co344CustomerSafe" type="checkbox"> Customer-safe evidence</label>',
      '<button id="co344EvidenceSave" class="secondary" type="button">Add Evidence</button></div>',
      '<div class="admin-panel-block"><h4>3. Office / supervisor review &amp; customer authorization</h4><label>Change order<select id="co344ReviewChange"></select></label>',
      '<div class="grid"><label>Review decision<select id="co344ReviewDecision"><option value="approve_for_pricing">Approve scope + price</option><option value="changes_required">Changes required</option><option value="reject">Reject</option></select></label><label>Estimated internal cost delta (CAD)<input id="co344Cost" type="number" min="0" step="0.01" value="0"></label><label>Customer charge delta (CAD)<input id="co344Charge" type="number" min="0" step="0.01" value="0"></label></div>',
      '<label>Reviewed scope<textarea id="co344ReviewedScope"></textarea></label><label>Review note<textarea id="co344ReviewNote"></textarea></label>',
      '<button id="co344ReviewSave" class="secondary" type="button">Save Review &amp; Pricing</button>',
      '<hr><div class="grid"><label>Authorization decision<select id="co344AuthDecision"><option value="authorize">Authorized</option><option value="decline">Declined</option></select></label><label>Method<select id="co344AuthMethod"><option value="signed">Signed</option><option value="email">Email</option><option value="sms">SMS</option><option value="verbal">Verbal</option><option value="portal">Portal</option><option value="other">Other</option></select></label><label>Customer name<input id="co344AuthName" type="text"></label></div>',
      '<label>Customer authorization evidence / reference<input id="co344AuthRef" type="text" placeholder="Signed document, email/message reference, portal acceptance ID…"></label>',
      '<button id="co344AuthSave" class="secondary" type="button">Record Customer Authorization</button>',
      '<p class="muted">Authorization evidence is required before an approved extra can be applied to the work order.</p></div>',
      '<div class="admin-panel-block"><h4>4. Apply authorized scope &amp; record invoice evidence</h4><label>Change order<select id="co344ApplyChange"></select></label>',
      '<button id="co344Apply" class="secondary" type="button">Apply Authorized Scope / Budget Once</button>',
      '<p class="muted">Application creates one linked change-order work-order line and an immutable before/after budget record. Repeating the action is idempotent.</p>',
      '<hr><div class="grid"><label>Invoice evidence status<select id="co344InvoiceStatus"><option value="ready">Ready for Finance evidence</option><option value="linked">Linked to existing Finance candidate</option></select></label><label>Existing invoice candidate<select id="co344InvoiceCandidate"></select></label></div>',
      '<label>Invoice evidence / reference<input id="co344InvoiceRef" type="text" placeholder="Closeout/invoice review evidence reference"></label>',
      '<button id="co344InvoiceSave" class="secondary" type="button">Record Invoice Evidence</button>',
      '<p class="muted"><strong>Finance authority:</strong> this never creates an AR invoice, payment, posting or invoice candidate. It can only link an existing Finance candidate.</p></div>',
      '<div class="admin-panel-block"><h4>Change-order queue</h4><div id="co344Queue"></div></div>',
      '<div id="co344Status" class="notice" style="margin-top:10px;"></div>'
    ].join('');
    admin.appendChild(el);return el;
  }
  async function mount(config={}){
    const api=config.api||window.YWIAPI;if(!api?.loadAdminDirectory||!api?.manageOperations)return;
    const el=host();if(!el||el.dataset.mounted==='1')return;el.dataset.mounted='1';
    const state={data:{},selected:''};
    const rows=(k)=>Array.isArray(state.data[k])?state.data[k]:[];
    const note=(t,b=false)=>{const n=$('co344Status');if(n){n.textContent=t;n.classList.toggle('error',b);}};
    const fill=(id,list,key,textFn,empty='— Select —')=>{const e=$(id);if(!e)return;e.innerHTML='<option value="">'+esc(empty)+'</option>'+list.map(x=>'<option value="'+esc(x[key])+'">'+esc(textFn(x))+'</option>').join('');};
    const current=()=>rows('change_order_extras').find(x=>String(x.id)===String(state.selected))||null;
    function setSelected(id){
      state.selected=String(id||'');
      ['co344EvidenceChange','co344ReviewChange','co344ApplyChange'].forEach(k=>{if($(k))$(k).value=state.selected;});
      const c=current(); if(!c)return;
      $('co344ReviewedScope').value=c.scope_summary||'';
      $('co344Cost').value=String(c.estimated_cost_delta??0);
      $('co344Charge').value=String(c.estimated_charge_delta??0);
      $('co344Service').value=c.service_context||'general_outdoor';
      $('co344Season').value=c.season_context||'four_season';
    }
    function render(){
      const changes=rows('change_order_extras'),evidence=rows('change_order_evidence'),apps=rows('change_order_budget_applications');
      const open=changes.filter(x=>!['closed_not_authorized','invoice_evidence_linked'].includes(x.lifecycle_stage)).length;
      $('co344Summary').innerHTML=[
        ['Change orders',changes.length],['Open / actionable',open],
        ['Evidence items',evidence.length],['Applied budgets',apps.length],
        ['Winter extras',changes.filter(x=>x.season_context==='winter'||x.service_context==='snow_clearing_removal').length]
      ].map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      fill('co344WorkOrder',rows('change_order_work_orders'),'id',x=>(x.work_order_number||'Work order')+' · '+label(x.work_type||x.status));
      const changeLabel=x=>(x.change_order_number||'Change order')+' · '+label(x.lifecycle_stage)+' · '+(x.work_order_number||'');
      ['co344EvidenceChange','co344ReviewChange','co344ApplyChange'].forEach(id=>fill(id,changes,'id',changeLabel));
      fill('co344InvoiceCandidate',rows('change_order_invoice_candidates'),'id',x=>(x.candidate_number||'Candidate')+' · '+label(x.candidate_status||'draft')+' · $'+num(x.total_amount).toFixed(2),'— None / not linked —');
      if(state.selected&&changes.some(x=>String(x.id)===state.selected))setSelected(state.selected);
      $('co344Queue').innerHTML=changes.length?changes.map(x=>{
        const ev=Number(x.evidence_count||0),cost=num(x.estimated_cost_delta),charge=num(x.estimated_charge_delta);
        return '<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-co344="'+esc(x.id)+'"><strong>'+esc(x.change_order_number)+'</strong> · '+esc(label(x.lifecycle_stage))+
          '<br><small>'+esc(x.work_order_number||'')+' · '+esc(label(x.service_context))+' / '+esc(label(x.season_context))+' · evidence '+ev+
          ' · proposed cost $'+cost.toFixed(2)+' / charge $'+charge.toFixed(2)+'</small><br><span>'+esc(x.scope_summary||x.field_discovery_summary||'')+'</span></button>';
      }).join(''):'<p class="muted">No change orders have been recorded.</p>';
      el.querySelectorAll('[data-co344]').forEach(btn=>btn.addEventListener('click',()=>setSelected(btn.getAttribute('data-co344'))));
    }
    async function refresh(){
      try{state.data=await api.loadAdminDirectory({scope:'change_orders_extras',limit:1500})||{};render();note('Build 344 change-order queue refreshed.');}
      catch(e){note('Unable to load change-order queue: '+(e?.message||e),true);}
    }
    async function manage(payload,okText){
      try{note('Saving…');const r=await api.manageOperations(payload);if(!r?.ok)throw new Error(r?.error||'Operation failed.');note(okText);await refresh();return r;}
      catch(e){note(e?.message||String(e),true);return null;}
    }
    $('co344Discover').addEventListener('click',async()=>{
      const r=await manage({action:'change_order_discovery_save',work_order_id:$('co344WorkOrder').value,service_context:$('co344Service').value,season_context:$('co344Season').value,field_discovery_summary:$('co344Discovery').value.trim(),scope_summary:$('co344Scope').value.trim(),reason:$('co344Reason').value.trim()},'Field discovery saved. Customer price and job budget were not changed.');
      if(r?.record?.id){state.selected=String(r.record.id);render();}
    });
    $('co344EvidenceSave').addEventListener('click',async()=>{
      await manage({action:'change_order_evidence_save',change_order_id:$('co344EvidenceChange').value,evidence_type:$('co344EvidenceType').value,evidence_reference:$('co344EvidenceRef').value.trim(),caption:$('co344EvidenceCaption').value.trim(),customer_safe:$('co344CustomerSafe').checked},'Evidence saved. Price and billing were not changed.');
    });
    $('co344ReviewSave').addEventListener('click',async()=>{
      await manage({action:'change_order_review_price',change_order_id:$('co344ReviewChange').value,decision:$('co344ReviewDecision').value,scope_summary:$('co344ReviewedScope').value.trim(),review_note:$('co344ReviewNote').value.trim(),estimated_cost_delta:num($('co344Cost').value),estimated_charge_delta:num($('co344Charge').value)},'Supervisor/office review saved. Work-order budget remains unchanged until customer authorization and Apply.');
    });
    $('co344AuthSave').addEventListener('click',async()=>{
      await manage({action:'change_order_customer_authorization',change_order_id:$('co344ReviewChange').value,decision:$('co344AuthDecision').value,customer_authorization_method:$('co344AuthMethod').value,customer_approval_reference:$('co344AuthRef').value.trim(),customer_approved_by_name:$('co344AuthName').value.trim()},'Customer authorization decision recorded. No budget or billing was changed yet.');
    });
    $('co344Apply').addEventListener('click',async()=>{
      await manage({action:'change_order_apply',change_order_id:$('co344ApplyChange').value},'Authorized change-order scope and budget applied once. No invoice or Finance posting was created.');
    });
    $('co344InvoiceSave').addEventListener('click',async()=>{
      await manage({action:'change_order_invoice_evidence_save',change_order_id:$('co344ApplyChange').value,invoice_evidence_status:$('co344InvoiceStatus').value,invoice_evidence_reference:$('co344InvoiceRef').value.trim(),invoice_candidate_id:$('co344InvoiceCandidate').value||null},'Invoice evidence recorded. Finance invoice creation/posting remains separate.');
    });
    ['co344EvidenceChange','co344ReviewChange','co344ApplyChange'].forEach(id=>$(id).addEventListener('change',e=>setSelected(e.target.value)));
    await refresh();
  }
  window.YWIChangeOrdersExtrasUI={mount};
})();