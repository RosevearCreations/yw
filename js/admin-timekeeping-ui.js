/* File: js/admin-timekeeping-ui.js
   Build 337 — Timekeeping, Attendance & Payroll Evidence.
   Uses canonical employee time / attendance review / job-cost / payroll evidence authorities.
*/
'use strict';
(function(){
  const BUILD=337;
  const byId=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=(v)=>v?new Date(v).toLocaleString('en-CA'):'—';
  const minutes=(v)=>{const n=Number(v||0);return Math.floor(n/60)+'h '+Math.abs(n%60)+'m';};

  function makeHost(){
    const admin=byId('admin'); if(!admin)return null;
    let host=byId('timekeepingAttendance337'); if(host)return host;
    host=document.createElement('details');
    host.id='timekeepingAttendance337';
    host.className='admin-hub-detail';
    host.dataset.adminHubTitle='Timekeeping, Attendance & Payroll Evidence';
    host.dataset.adminHubGroups='people';
    host.open=true;
    host.innerHTML=[
      '<summary><span>Timekeeping, Attendance &amp; Payroll Evidence</span><small>Build 337 · auditable payroll readiness</small></summary>',
      '<div class="admin-panel-block" data-build="337">',
      '<div class="section-heading"><div><span class="module-kicker">Build 337 · workforce evidence</span><h3>Timekeeping, Attendance &amp; Payroll Evidence</h3><p class="section-subtitle">Shift, job/visit, travel, break, overtime, attendance exception, correction, approval and payroll-ready evidence using the existing time and payroll authorities.</p></div><button id="time337Refresh" class="secondary" type="button">Refresh</button></div>',
      '<div class="notice"><strong>Authority boundary:</strong> My Profile remains the employee clock/break authority. Job-session crew hours remain job-cost allocation. This workbench prepares and approves evidence only; Finance keeps payroll-export generation, delivery and close controls.</div>',
      '<div id="time337Summary" class="admin-backbone-summary" style="margin-top:12px;"></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><div class="section-heading"><div><h4>Payroll readiness</h4><p class="section-subtitle">Every row stays tied to its original time entry and correction history.</p></div><button id="time337Download" class="secondary" type="button">Download Ready CSV</button></div>',
      '<div class="table-scroll"><table><thead><tr><th>Employee / job</th><th>Shift</th><th>Break / travel</th><th>Allocation</th><th>Evidence</th><th>Readiness</th></tr></thead><tbody id="time337EvidenceBody"></tbody></table></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Correction &amp; supervisor approval</h4><div class="grid">',
      '<label>Time entry<select id="time337Entry"></select></label>',
      '<label>Clock in<input id="time337SignedIn" type="datetime-local"></label><label>Clock out<input id="time337SignedOut" type="datetime-local"></label>',
      '<label>Break minutes<input id="time337Break" type="number" min="0" step="1"></label><label>Travel minutes<input id="time337Travel" type="number" min="0" step="1"></label>',
      '<label>Correction reason<input id="time337Reason" type="text" placeholder="Missed punch, travel allocation, break correction…"></label>',
      '<label>Employee explanation<textarea id="time337Explanation" rows="2"></textarea></label><label>Supervisor note<textarea id="time337ApprovalNote" rows="2"></textarea></label>',
      '</div><div class="admin-heading-actions"><button id="time337RequestCorrection" class="secondary" type="button">Record Correction Request</button><button id="time337Approve" class="primary" type="button">Approve Payroll Evidence</button></div><div id="time337Status" class="notice" style="margin-top:10px;"></div></div>',
      '<div class="admin-panel-block" style="margin-top:14px;"><h4>Correction audit</h4><div class="table-scroll"><table><thead><tr><th>Employee / job</th><th>Request</th><th>Requested values</th><th>Review</th><th>Action</th></tr></thead><tbody id="time337CorrectionBody"></tbody></table></div></div>',
      '</div>'
    ].join('');
    const anchor=byId('employeeCrewManagement336');
    if(anchor) anchor.insertAdjacentElement('afterend',host);
    else {
      const shell=admin.querySelector('.admin-hub-shell');
      if(shell)shell.insertAdjacentElement('afterend',host);else admin.appendChild(host);
    }
    return host;
  }

  function localValue(v){
    if(!v)return '';
    const d=new Date(v); if(Number.isNaN(d.getTime()))return '';
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,16);
  }

  async function mount(config={}){
    const api=config.api||window.YWIAPI;
    if(!api?.loadAdminDirectory||!api?.manageAdminEntity)return;
    const host=makeHost(); if(!host||host.dataset.mounted==='1')return;
    host.dataset.mounted='1';
    const state={payload:{},entryId:''};
    const rows=()=>Array.isArray(state.payload.timekeeping_evidence)?state.payload.timekeeping_evidence:[];
    const current=()=>rows().find((x)=>String(x.time_entry_id)===String(state.entryId))||null;
    const status=(t,bad=false)=>{const e=byId('time337Status');if(e){e.textContent=t;e.classList.toggle('error',bad);}};

    function renderSummary(){
      const s=(state.payload.timekeeping_summary||[])[0]||{};
      const cards=[
        ['Open shifts',s.open_shift_count||0],
        ['Attendance review',s.attendance_review_count||0],
        ['Correction pending',s.correction_pending_count||0],
        ['Supervisor approval',s.supervisor_approval_count||0],
        ['Payroll ready',s.payroll_ready_count||0]
      ];
      byId('time337Summary').innerHTML=cards.map((x)=>'<div class="admin-backbone-card"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
    }

    function renderRows(){
      const body=byId('time337EvidenceBody');
      body.innerHTML=rows().length?rows().map((r)=>[
        '<tr data-time-entry="',esc(r.time_entry_id),'"><td><button type="button" class="link-button" data-select-time="',esc(r.time_entry_id),'">',esc(r.full_name||r.employee_number||'Employee'),'</button><br><small>',esc([r.job_code,r.job_name].filter(Boolean).join(' · ')),'</small></td>',
        '<td>',esc(fmt(r.signed_in_at)),'<br><small>',esc(fmt(r.signed_out_at)),' · ',esc(minutes(r.paid_minutes)),' paid</small></td>',
        '<td>',esc(r.break_minutes||0),'m break<br><small>',esc(r.travel_minutes||0),'m travel</small></td>',
        '<td>',esc(r.regular_hours||0),'h regular · ',esc(r.overtime_hours||0),'h OT<br><small>',esc(r.job_work_minutes||0),'m job work · ',esc(r.pay_code||'—'),'</small></td>',
        '<td>',Number(r.open_review_count||0),' review · ',Number(r.pending_correction_count||0),' correction<br><small>version ',Number(r.correction_version||0),'</small></td>',
        '<td><strong>',esc(String(r.payroll_readiness_status||'').replaceAll('_',' ')),'</strong><br><small>',esc(r.supervisor_approved_by_name||''),'</small></td></tr>'
      ].join('')).join(''):'<tr><td colspan="6" class="muted">No timekeeping evidence.</td></tr>';
    }

    function renderCurrent(){
      const r=current(); if(!r)return;
      byId('time337Entry').value=String(r.time_entry_id);
      byId('time337SignedIn').value=localValue(r.signed_in_at);
      byId('time337SignedOut').value=localValue(r.signed_out_at);
      byId('time337Break').value=Number(r.break_minutes||0);
      byId('time337Travel').value=Number(r.travel_minutes||0);
      byId('time337Explanation').value=r.employee_explanation||'';
      byId('time337ApprovalNote').value=r.supervisor_approval_note||'';
      status('Selected '+(r.full_name||r.employee_number||'employee')+' · '+String(r.payroll_readiness_status||'').replaceAll('_',' ')+'.');
    }

    function renderCorrections(){
      const body=byId('time337CorrectionBody');
      const items=Array.isArray(state.payload.timekeeping_corrections)?state.payload.timekeeping_corrections:[];
      body.innerHTML=items.length?items.map((c)=>{
        const requested=[
          c.requested_signed_in_at?'in '+fmt(c.requested_signed_in_at):'',
          c.requested_signed_out_at?'out '+fmt(c.requested_signed_out_at):'',
          c.requested_break_minutes!=null?c.requested_break_minutes+'m break':'',
          c.requested_travel_minutes!=null?c.requested_travel_minutes+'m travel':''
        ].filter(Boolean).join(' · ');
        const action=c.correction_status==='pending'
          ? '<button type="button" class="primary" data-approve-correction="'+esc(c.id)+'">Approve &amp; Apply</button> <button type="button" class="secondary" data-reject-correction="'+esc(c.id)+'">Reject</button>'
          : '—';
        return '<tr><td>'+esc(c.full_name||c.employee_number||'')+'<br><small>'+esc(c.job_code||'')+'</small></td><td>'+esc(c.correction_reason)+'<br><small>'+esc(c.employee_explanation)+'</small></td><td>'+esc(requested||'No value change')+'</td><td>'+esc(c.correction_status)+'<br><small>'+esc(c.review_note||'')+'</small></td><td>'+action+'</td></tr>';
      }).join(''):'<tr><td colspan="5" class="muted">No correction audit records.</td></tr>';
    }

    function render(){
      renderSummary();
      const list=rows();
      if(!state.entryId&&list[0])state.entryId=String(list[0].time_entry_id);
      byId('time337Entry').innerHTML=list.map((r)=>'<option value="'+esc(r.time_entry_id)+'">'+esc(r.full_name||r.employee_number||'Employee')+' · '+esc(r.job_code||'job')+' · '+esc(String(r.payroll_readiness_status||'').replaceAll('_',' '))+'</option>').join('');
      renderRows(); renderCurrent(); renderCorrections();
    }

    async function load(){
      status('Loading timekeeping evidence…');
      const r=await api.loadAdminDirectory({scope:'timekeeping',limit:1000});
      if(!r?.ok)return status(r?.error||'Timekeeping load failed.',true);
      state.payload=r;
      if(!rows().some((x)=>String(x.time_entry_id)===String(state.entryId)))state.entryId=rows()[0]?.time_entry_id||'';
      render();
    }

    async function correction(){
      const r=current();if(!r)return;
      const reason=byId('time337Reason').value.trim();
      const explanation=byId('time337Explanation').value.trim();
      if(!reason||!explanation)return status('Correction reason and employee explanation are required.',true);
      const req={
        entity:'timekeeping_correction',action:'create',time_entry_id:r.time_entry_id,
        correction_reason:reason,employee_explanation:explanation,
        requested_signed_in_at:byId('time337SignedIn').value||null,
        requested_signed_out_at:byId('time337SignedOut').value||null,
        requested_break_minutes:Number(byId('time337Break').value||0),
        requested_travel_minutes:Number(byId('time337Travel').value||0)
      };
      const out=await api.manageAdminEntity(req);
      if(!out?.ok)return status(out?.error||'Correction request failed.',true);
      byId('time337Reason').value=''; await load();
    }

    async function approveEntry(){
      const r=current();if(!r)return;
      const out=await api.manageAdminEntity({entity:'timekeeping_approval',action:'approve',time_entry_id:r.time_entry_id,approval_note:byId('time337ApprovalNote').value.trim()});
      if(!out?.ok)return status(out?.error||'Supervisor approval failed.',true);
      await load();
    }

    async function decideCorrection(id,action){
      const note=byId('time337ApprovalNote').value.trim();
      const out=await api.manageAdminEntity({entity:'timekeeping_correction',action,item_id:id,review_note:note});
      if(!out?.ok)return status(out?.error||'Correction review failed.',true);
      await load();
    }

    function downloadReady(){
      const ready=rows().filter((r)=>r.payroll_ready===true);
      if(!ready.length)return status('No payroll-ready rows are available to export.',true);
      const cols=['employee_number','full_name','job_code','signed_in_at','signed_out_at','regular_hours','overtime_hours','paid_minutes','break_minutes','travel_minutes','pay_code','time_entry_id'];
      const quote=(v)=>'"'+String(v??'').replaceAll('"','""')+'"';
      const csv=[cols.join(','),...ready.map((r)=>cols.map((k)=>quote(r[k])).join(','))].join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='timekeeping-payroll-ready-evidence.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);
      status('Downloaded '+ready.length+' payroll-ready evidence row(s). Finance remains responsible for provider export/delivery.');
    }

    byId('time337Refresh').onclick=load;
    byId('time337Entry').onchange=(e)=>{state.entryId=e.target.value;renderCurrent();};
    byId('time337EvidenceBody').onclick=(e)=>{const b=e.target.closest('[data-select-time]');if(b){state.entryId=b.getAttribute('data-select-time');renderCurrent();}};
    byId('time337RequestCorrection').onclick=correction;
    byId('time337Approve').onclick=approveEntry;
    byId('time337Download').onclick=downloadReady;
    byId('time337CorrectionBody').onclick=(e)=>{
      const a=e.target.closest('[data-approve-correction]');if(a){decideCorrection(a.getAttribute('data-approve-correction'),'approve');return;}
      const r=e.target.closest('[data-reject-correction]');if(r)decideCorrection(r.getAttribute('data-reject-correction'),'reject');
    };
    await load();
  }

  window.YWITimekeepingUI=Object.freeze({BUILD,mount});
})();