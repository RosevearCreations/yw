(()=>{
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=(v)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase());
  const groups=['customer','property','estimate','job_visit','employee','equipment_fleet','safety','invoice_payment','other'];
  const modules=['jobs','safety','finance','admin'];
  const kinds=['created','changed','assigned','approved','rejected','inspected','locked_out','trained','uploaded','notified','posted','reopened','activity'];
  const options=(values,allLabel)=>'<option value="">'+esc(allLabel)+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(label(v))+'</option>').join('');

  function host(){
    const admin=$('admin'); if(!admin)return null;
    let el=$('universalActivityAudit347'); if(el)return el;
    el=document.createElement('section'); el.id='universalActivityAudit347'; el.className='admin-panel'; el.dataset.adminHubGroups='operations';
    el.innerHTML=[
      '<h3>Build 347 — Universal Activity & Audit Timeline</h3>',
      '<p class="muted">One chronological evidence view across Customer, Property, Estimate, Job/Visit, Employee, Equipment/Fleet, Safety and Invoice/Payment activity.</p>',
      '<div class="notice"><strong>Permission-aware:</strong> the server removes events from modules the signed-in profile cannot view before this workspace receives them.</div>',
      '<div class="notice"><strong>Read-only authority boundary:</strong> this timeline does not edit source records. Raw request/response payloads are intentionally excluded; source modules remain authoritative.</div>',
      '<div id="activity347Summary" class="admin-backbone-grid" style="margin-top:10px;"></div>',
      '<div class="admin-panel-block"><h4>Timeline filters</h4><div class="grid">',
      '<label>Record type<select id="activity347Group">'+options(groups,'All record types')+'</select></label>',
      '<label>Source module<select id="activity347Module">'+options(modules,'All visible modules')+'</select></label>',
      '<label>Activity<select id="activity347Kind">'+options(kinds,'All activity')+'</select></label>',
      '<label>Search<input id="activity347Search" type="search" placeholder="actor, action, entity or evidence reference"></label>',
      '</div><button id="activity347Refresh" class="secondary" type="button">Refresh Timeline</button></div>',
      '<div class="admin-panel-block"><h4>Newest activity first</h4><div id="activity347Rows"></div></div>',
      '<div id="activity347Status" class="notice" style="margin-top:10px;"></div>'
    ].join('');
    admin.appendChild(el); return el;
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI; if(!api?.loadAdminDirectory)return;
    const el=host(); if(!el||el.dataset.mounted==='1')return; el.dataset.mounted='1';
    const state={rows:[],visibility:{}};
    const note=(msg,bad=false)=>{const n=$('activity347Status');if(n){n.textContent=msg;n.classList.toggle('error',bad);}};
    function visibleRows(){
      const group=$('activity347Group').value,module=$('activity347Module').value,kind=$('activity347Kind').value,q=$('activity347Search').value.trim().toLowerCase();
      return state.rows.filter(row=>{
        if(group&&row.entity_group!==group)return false;
        if(module&&row.source_module!==module)return false;
        if(kind&&row.activity_kind!==kind)return false;
        if(!q)return true;
        return [row.actor_label,row.activity_label,row.action_key,row.source_entity_type,row.entity_id,row.evidence_reference,row.event_status].some(v=>String(v||'').toLowerCase().includes(q));
      });
    }
    function render(){
      const rows=visibleRows(),allowed=Object.entries(state.visibility).filter(([,v])=>v).map(([k])=>label(k));
      $('activity347Summary').innerHTML=[
        ['Visible events',rows.length],['Loaded events',state.rows.length],['Visible modules',allowed.length?allowed.join(', '):'None'],
        ['Newest',state.rows[0]?.occurred_at?new Date(state.rows[0].occurred_at).toLocaleString():'—']
      ].map(x=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
      $('activity347Rows').innerHTML=rows.length?rows.map(row=>{
        const when=row.occurred_at?new Date(row.occurred_at).toLocaleString():'Unknown time';
        return '<article class="notice" data-activity347-event="'+esc(row.event_id||'')+'"><strong>'+esc(row.activity_label||label(row.activity_kind))+'</strong> · '+esc(label(row.event_status||'captured'))+
          '<br><small>'+esc(when)+' · '+esc(row.actor_label||'System / unknown')+' · '+esc(label(row.source_module))+'</small>'+
          '<br><span>'+esc(label(row.entity_group))+' · '+esc(row.source_entity_type||'unspecified')+(row.entity_id?' · '+esc(row.entity_id):'')+'</span>'+
          '<br><small>Evidence: '+esc(row.evidence_reference||'—')+'</small>'+(row.error_message?'<br><small class="error">'+esc(row.error_message)+'</small>':'')+'</article>';
      }).join(''):'<p class="muted">No visible timeline events match the current filters.</p>';
    }
    async function refresh(){
      try{
        note('Loading activity evidence…');
        const r=await api.loadAdminDirectory({scope:'activity_timeline',limit:500})||{};
        if(r.ok===false)throw new Error(r.error||'Timeline load failed.');
        state.rows=Array.isArray(r.activity_timeline)?r.activity_timeline:[]; state.visibility=r.source_visibility||{}; render();
        note('Build 347 activity timeline refreshed. Source records were not changed.');
      }catch(e){state.rows=[];render();note('Unable to load Build 347 activity timeline: '+(e?.message||e),true);}
    }
    ['activity347Group','activity347Module','activity347Kind'].forEach(id=>$(id).addEventListener('change',render));
    $('activity347Search').addEventListener('input',render); $('activity347Refresh').addEventListener('click',refresh); await refresh();
  }
  window.YWIUniversalActivityTimelineUI={mount};
})();
