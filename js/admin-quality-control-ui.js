(()=>{
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase());
  const SERVICES=[
    ['mowing_landscaping','Mowing / landscaping'],
    ['landscape_installation','Landscape installation'],
    ['fall_cleanup','Fall cleanup / leaf collection'],
    ['snow_clearing_removal','Snow clearing / removal'],
    ['general_outdoor','General outdoor']
  ];
  const SEASONS=[['spring_summer','Spring / summer'],['fall','Fall'],['winter','Winter'],['four_season','Four-season']];
  const optionRows=(rows)=>rows.map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('');
  function host(){
    const admin=$('admin'); if(!admin) return null;
    let el=$('qualityControl345'); if(el) return el;
    el=document.createElement('section'); el.id='qualityControl345'; el.className='admin-panel'; el.dataset.adminHubGroups='operations';
    el.innerHTML=[
      '<h3>Build 345 — Quality Control &amp; Customer Signoff</h3>',
      '<p class="muted">Crew completion → QC checklist → canonical before/after execution-proof evidence → deficiencies/rework → supervisor QC where required → customer-safe completion summary → existing closeout/customer-portal signoff.</p>',
      '<div class="notice"><strong>Customer signoff authority:</strong> staff QC cannot sign for a customer. Customer acknowledgement/signoff remains the existing secure customer portal workflow.</div>',
      '<div class="notice"><strong>Four-season QC:</strong> mowing/landscaping, landscape installation, fall cleanup/leaf collection and winter snow clearing/removal use one shared quality model.</div>',
      '<div id="qc345Summary" class="admin-backbone-grid" style="margin-top:10px;"></div>',

      '<div class="admin-panel-block"><h4>Completion template</h4>',
      '<div class="grid"><label>Template name<input id="qc345TemplateName" type="text" placeholder="e.g. Garden bed refresh completion"></label>',
      '<label>Service<select id="qc345TemplateService">'+optionRows(SERVICES)+'</select></label>',
      '<label>Season<select id="qc345TemplateSeason">'+optionRows(SEASONS)+'</select></label></div>',
      '<div class="grid"><label>Customer signoff mode<select id="qc345TemplateSignoff"><option value="none">None</option><option value="optional">Optional</option><option value="recommended" selected>Recommended</option><option value="required">Required</option></select></label>',
      '<label><input id="qc345TemplateSupervisor" type="checkbox" checked> Supervisor QC required</label></div>',
      '<label>Checklist items <small>One per line: Prompt | none/before/after/before_after/detail | required/optional</small>',
      '<textarea id="qc345TemplateItems" rows="6" placeholder="Finished area matches scope | after | required\nCustomer access left clear | none | required"></textarea></label>',
      '<button id="qc345TemplateSave" class="secondary" type="button">Save QC Template</button></div>',

      '<div class="admin-panel-block"><h4>1. Crew completion</h4>',
      '<div class="grid"><label>Work order<select id="qc345WorkOrder"></select></label><label>Template<select id="qc345Template"></select></label><label>Job session<select id="qc345Session"></select></label></div>',
      '<div id="qc345Checklist"></div>',
      '<label>Crew completion summary<textarea id="qc345CrewSummary" rows="3" placeholder="What was completed, exceptions, site condition..."></textarea></label>',
      '<label>Customer-safe completion summary<textarea id="qc345CustomerSummary" rows="3" placeholder="Plain-language summary safe to carry into closeout/customer communication."></textarea></label>',
      '<button id="qc345RunSave" class="secondary" type="button">Save Crew Completion / Checklist</button></div>',

      '<div class="admin-panel-block"><h4>2. Before / after / detail evidence</h4>',
      '<div class="grid"><label>QC run<select id="qc345EvidenceRun"></select></label><label>Checklist item<select id="qc345EvidenceItem"></select></label>',
      '<label>Execution proof<select id="qc345EvidenceProof"></select></label><label>Role<select id="qc345EvidenceRole"><option value="before">Before</option><option value="after">After</option><option value="detail">Detail</option><option value="final">Final</option></select></label></div>',
      '<label><input id="qc345EvidenceCustomerSafe" type="checkbox"> Customer-safe evidence (requires approved + customer-visible execution proof)</label>',
      '<label>Caption<input id="qc345EvidenceCaption" type="text"></label>',
      '<button id="qc345EvidenceSave" class="secondary" type="button">Link Existing Execution Proof</button>',
      '<p class="muted">Build 345 does not create another photo store. Evidence is linked from canonical work-order execution proof.</p></div>',

      '<div class="admin-panel-block"><h4>3. Deficiency &amp; rework</h4>',
      '<div class="grid"><label>QC run<select id="qc345DefRun"></select></label><label>Checklist item<select id="qc345DefItem"></select></label><label>Severity<select id="qc345DefSeverity"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></label></div>',
      '<label>Deficiency<textarea id="qc345DefSummary" rows="3"></textarea></label>',
      '<label>Customer-safe note (optional)<textarea id="qc345DefCustomer" rows="2"></textarea></label>',
      '<button id="qc345DefSave" class="secondary" type="button">Record Deficiency</button>',
      '<hr><div class="grid"><label>Deficiency<select id="qc345ReworkDef"></select></label><label>Rework event<select id="qc345ReworkType"><option value="started">Started</option><option value="progress">Progress</option><option value="completed">Completed / resolved</option></select></label><label>Resolution proof<select id="qc345ReworkProof"></select></label></div>',
      '<label>Rework note<textarea id="qc345ReworkNote" rows="3"></textarea></label>',
      '<button id="qc345ReworkSave" class="secondary" type="button">Save Rework Event</button></div>',

      '<div class="admin-panel-block"><h4>4. Supervisor QC</h4>',
      '<div class="grid"><label>QC run<select id="qc345ReviewRun"></select></label><label>Decision<select id="qc345ReviewDecision"><option value="approve">Approve QC</option><option value="require_rework">Require rework</option></select></label></div>',
      '<label>Supervisor note<textarea id="qc345ReviewNote" rows="3"></textarea></label>',
      '<button id="qc345ReviewSave" class="secondary" type="button">Save Supervisor Review</button>',
      '<p class="muted">Approval requires required checklist items to pass, required evidence to exist, and all deficiencies to be resolved. It never creates customer signoff.</p></div>',

      '<div class="admin-panel-block"><h4>QC queue &amp; customer signoff status</h4><div id="qc345Queue"></div></div>',
      '<div id="qc345Status" class="notice" style="margin-top:10px;"></div>'
    ].join('');
    admin.appendChild(el); return el;
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI; if(!api?.loadAdminDirectory||!api?.manageOperations) return;
    const el=host(); if(!el||el.dataset.mounted==='1') return; el.dataset.mounted='1';
    const state={data:{},selectedRun:'',selectedWorkOrder:''};
    const rows=(key)=>Array.isArray(state.data[key])?state.data[key]:[];
    const note=(msg,bad=false)=>{const n=$('qc345Status'); if(n){n.textContent=msg;n.classList.toggle('error',bad);}};
    const fill=(id,list,key,textFn,empty='— Select —')=>{
      const e=$(id); if(!e)return;
      const old=e.value;
      e.innerHTML='<option value="">'+esc(empty)+'</option>'+list.map(x=>'<option value="'+esc(x[key])+'">'+esc(textFn(x))+'</option>').join('');
      if(old&&list.some(x=>String(x[key])===String(old))) e.value=old;
    };
    const runById=(id)=>rows('quality_control_runs').find(x=>String(x.id)===String(id))||null;
    const templateById=(id)=>rows('quality_control_templates').find(x=>String(x.id)===String(id))||null;
    const templateItems=(templateId)=>rows('quality_control_template_items').filter(x=>String(x.template_id)===String(templateId)&&x.is_active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const runItems=(runId)=>rows('quality_control_items').filter(x=>String(x.qc_run_id)===String(runId)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const proofsForWorkOrder=(workOrderId)=>rows('quality_control_execution_proofs').filter(x=>String(x.work_order_id)===String(workOrderId));
    function renderChecklist(){
      const wo=$('qc345WorkOrder')?.value||'';
      const existing=rows('quality_control_runs').find(x=>String(x.work_order_id)===String(wo))||null;
      if(existing){state.selectedRun=String(existing.id); $('qc345Template').value=existing.template_id||'';}
      const templateId=$('qc345Template')?.value||existing?.template_id||'';
      const source=existing?runItems(existing.id):templateItems(templateId);
      $('qc345Checklist').innerHTML=source.length?source.map((x,index)=>{
        const code=x.item_code||('item_'+index);
        const current=x.result_status||'pending';
        return '<div class="notice" data-qc345-item="'+esc(code)+'"><strong>'+esc(x.item_prompt||code)+'</strong> <small>('+esc(label(x.evidence_requirement||'none'))+(x.is_required?' · required':' · optional')+')</small>'+
          '<div class="grid"><label>Result<select data-qc345-result="'+esc(code)+'"><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="not_applicable">N/A</option></select></label>'+
          '<label>Completion note<input data-qc345-note="'+esc(code)+'" type="text" value="'+esc(x.completion_note||'')+'"></label></div></div>';
      }).join(''):'<p class="muted">Select a template to load its completion checklist.</p>';
      source.forEach(x=>{const e=el.querySelector('[data-qc345-result="'+CSS.escape(String(x.item_code))+'"]');if(e)e.value=x.result_status||'pending';});
      const r=existing;
      if(r){
        $('qc345CrewSummary').value=r.crew_completion_summary||'';
        $('qc345CustomerSummary').value=r.customer_safe_summary||'';
      }
      renderRunDependent();
    }
    function renderRunDependent(){
      const runId=state.selectedRun||$('qc345EvidenceRun')?.value||$('qc345ReviewRun')?.value||'';
      const r=runById(runId);
      const workOrderId=r?.work_order_id||$('qc345WorkOrder')?.value||'';
      const items=runId?runItems(runId):[];
      ['qc345EvidenceItem','qc345DefItem'].forEach(id=>fill(id,items,'id',x=>(x.item_code||'Item')+' · '+(x.item_prompt||''),'— Whole run —'));
      const proofs=proofsForWorkOrder(workOrderId);
      const proofLabel=x=>(x.title||x.proof_type||'Proof')+' · '+label(x.proof_status)+(x.customer_visible?' · customer-visible':'');
      fill('qc345EvidenceProof',proofs,'id',proofLabel);
      fill('qc345ReworkProof',proofs,'id',proofLabel,'— None —');
    }
    function render(){
      const runs=rows('quality_control_runs'),defs=rows('quality_control_deficiencies');
      $('qc345Summary').innerHTML=[
        ['QC runs',runs.length],
        ['Ready for closeout',runs.filter(x=>x.ready_for_closeout).length],
        ['Need rework',runs.filter(x=>x.run_status==='rework_required').length],
        ['Unresolved deficiencies',defs.filter(x=>!['resolved','accepted_exception'].includes(x.deficiency_status)).length],
        ['Customer signed',runs.filter(x=>x.canonical_customer_signoff_status==='signed').length]
      ].map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');

      fill('qc345WorkOrder',rows('quality_control_work_orders'),'id',x=>(x.work_order_number||'Work order')+' · '+label(x.work_type||x.status));
      fill('qc345Template',rows('quality_control_templates').filter(x=>x.is_active!==false),'id',x=>x.template_name+' · '+label(x.season_context));
      const runLabel=x=>(x.work_order_number||'Work order')+' · '+x.template_name+' · '+label(x.run_status)+(x.ready_for_closeout?' · READY':'');
      ['qc345EvidenceRun','qc345DefRun','qc345ReviewRun'].forEach(id=>fill(id,runs,'id',runLabel));
      fill('qc345ReworkDef',defs.filter(x=>!['resolved','accepted_exception'].includes(x.deficiency_status)),'id',x=>(x.work_order_number||'')+' · '+label(x.severity)+' · '+x.deficiency_summary);
      const wo=$('qc345WorkOrder')?.value||state.selectedWorkOrder;
      fill('qc345Session',rows('quality_control_sessions').filter(x=>!wo||String(x.work_order_id)===String(wo)),'id',x=>String(x.session_date||'Session')+' · '+label(x.session_status||x.completion_state),'— No linked session —');

      $('qc345Queue').innerHTML=runs.length?runs.map(r=>{
        const signoff=r.canonical_customer_signoff_status||'not requested';
        return '<button type="button" class="notice" style="display:block;width:100%;text-align:left;margin:6px 0;" data-qc345-run="'+esc(r.id)+'">'+
          '<strong>'+esc(r.work_order_number||'Work order')+'</strong> · '+esc(r.template_name||'QC')+' · '+esc(label(r.run_status))+
          (r.ready_for_closeout?' · <strong>Ready for closeout</strong>':'')+
          '<br><small>'+esc(label(r.service_context))+' / '+esc(label(r.season_context))+
          ' · unresolved deficiencies '+esc(r.unresolved_deficiency_count||0)+
          ' · customer signoff '+esc(label(signoff))+'</small>'+
          '<br><span>'+esc(r.customer_safe_summary||r.crew_completion_summary||'')+'</span></button>';
      }).join(''):'<p class="muted">No QC runs have been started.</p>';
      el.querySelectorAll('[data-qc345-run]').forEach(btn=>btn.addEventListener('click',()=>{
        const id=btn.getAttribute('data-qc345-run')||''; state.selectedRun=id;
        const r=runById(id); if(r){state.selectedWorkOrder=String(r.work_order_id||''); $('qc345WorkOrder').value=state.selectedWorkOrder; $('qc345Template').value=r.template_id||'';}
        ['qc345EvidenceRun','qc345DefRun','qc345ReviewRun'].forEach(x=>{if($(x))$(x).value=id;});
        renderChecklist();
      }));
      renderChecklist();
    }
    async function refresh(msg='Build 345 quality-control workspace refreshed.'){
      try{state.data=await api.loadAdminDirectory({scope:'quality_control',limit:2000})||{};render();note(msg);}
      catch(e){note('Unable to load Build 345 QC workspace: '+(e?.message||e),true);}
    }
    async function manage(payload,okText){
      try{note('Saving…');const r=await api.manageOperations(payload);if(!r?.ok)throw new Error(r?.error||'Operation failed.');await refresh(okText);return r;}
      catch(e){note(e?.message||String(e),true);return null;}
    }

    $('qc345TemplateSave').addEventListener('click',async()=>{
      const items=$('qc345TemplateItems').value.split('\n').map((line,index)=>{
        const [prompt,evidence='none',required='required']=line.split('|').map(x=>String(x||'').trim());
        return prompt?{item_code:'item_'+(index+1),item_prompt:prompt,evidence_requirement:evidence||'none',is_required:required.toLowerCase()!=='optional',sort_order:(index+1)*10}:null;
      }).filter(Boolean);
      await manage({action:'quality_control_template_save',template_name:$('qc345TemplateName').value.trim(),service_context:$('qc345TemplateService').value,season_context:$('qc345TemplateSeason').value,supervisor_qc_required:$('qc345TemplateSupervisor').checked,customer_signoff_mode:$('qc345TemplateSignoff').value,items},'QC template saved.');
    });

    $('qc345RunSave').addEventListener('click',async()=>{
      const wo=$('qc345WorkOrder').value, existing=rows('quality_control_runs').find(x=>String(x.work_order_id)===String(wo));
      const item_results=[...el.querySelectorAll('[data-qc345-result]')].map(sel=>({item_code:sel.getAttribute('data-qc345-result'),result_status:sel.value,completion_note:el.querySelector('[data-qc345-note="'+CSS.escape(sel.getAttribute('data-qc345-result'))+'"]')?.value||''}));
      const r=await manage({action:'quality_control_run_save',id:existing?.id||null,work_order_id:wo,template_id:$('qc345Template').value,job_session_id:$('qc345Session').value||null,crew_completion_summary:$('qc345CrewSummary').value.trim(),customer_safe_summary:$('qc345CustomerSummary').value.trim(),item_results},'Crew completion and QC checklist saved. Customer signoff was not changed.');
      if(r?.record?.id) state.selectedRun=String(r.record.id);
    });

    $('qc345EvidenceSave').addEventListener('click',async()=>{
      await manage({action:'quality_control_evidence_link',qc_run_id:$('qc345EvidenceRun').value,qc_item_id:$('qc345EvidenceItem').value||null,execution_proof_id:$('qc345EvidenceProof').value,evidence_role:$('qc345EvidenceRole').value,customer_safe:$('qc345EvidenceCustomerSafe').checked,caption:$('qc345EvidenceCaption').value.trim()},'Canonical execution proof linked as QC evidence.');
    });

    $('qc345DefSave').addEventListener('click',async()=>{
      await manage({action:'quality_control_deficiency_save',qc_run_id:$('qc345DefRun').value,qc_item_id:$('qc345DefItem').value||null,severity:$('qc345DefSeverity').value,deficiency_summary:$('qc345DefSummary').value.trim(),customer_safe_note:$('qc345DefCustomer').value.trim()},'Deficiency recorded. Closeout remains blocked until QC is ready.');
    });

    $('qc345ReworkSave').addEventListener('click',async()=>{
      await manage({action:'quality_control_rework_save',deficiency_id:$('qc345ReworkDef').value,event_type:$('qc345ReworkType').value,event_note:$('qc345ReworkNote').value.trim(),resolution_execution_proof_id:$('qc345ReworkProof').value||null},'Rework event saved.');
    });

    $('qc345ReviewSave').addEventListener('click',async()=>{
      await manage({action:'quality_control_review',qc_run_id:$('qc345ReviewRun').value,decision:$('qc345ReviewDecision').value,supervisor_review_note:$('qc345ReviewNote').value.trim()},'Supervisor QC decision saved. Customer signoff remains in the existing portal.');
    });

    $('qc345WorkOrder').addEventListener('change',()=>{state.selectedWorkOrder=$('qc345WorkOrder').value;renderChecklist();});
    $('qc345Template').addEventListener('change',renderChecklist);
    ['qc345EvidenceRun','qc345DefRun','qc345ReviewRun'].forEach(id=>$(id).addEventListener('change',(e)=>{state.selectedRun=e.target.value;renderRunDependent();}));
    await refresh();
  }
  window.YWIQualityControlUI={mount};
})();