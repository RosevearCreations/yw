/* File: js/jobs-ui.js
   Brief description: Jobs and equipment planning UI.
   Renders live forms inside the Jobs and Equipment sections, supports pool-aware reservation requests,
   and adds requirement-level approval buttons directly in the job workflow.
*/

'use strict';

(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createJobsUI(config = {}) {
    const api = config.api;
    const getAccessProfile = config.getAccessProfile || (() => ({ canManageJobs: false, canManageAdminDirectory: false }));
    const getCurrentRole = config.getCurrentRole || (() => 'worker');

    const state = {
      jobs: [],
      equipment: [],
      requirements: [],
      signouts: [],
      pools: [],
      notifications: []
    };

    function ensureLayout() {
      const jobs = document.getElementById('jobs');
      const equipment = document.getElementById('equipment');
      if (jobs && jobs.dataset.jobsLayoutReady !== '1') {
        jobs.dataset.jobsLayoutReady = '1';
        jobs.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>Jobs</h2>
              <p class="section-subtitle">Create jobs, request pool-based reservations, and approve or reject requirement exceptions.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="job_load" class="secondary" type="button">Reload</button>
            </div>
          </div>
          <div class="grid">
            <label>Job Code<input id="job_code" type="text" placeholder="JOB-1001" /></label>
            <label>Job Name<input id="job_name" type="text" placeholder="Main install" /></label>
            <label>Site<select id="job_site_name"></select></label>
            <label>Job Type<input id="job_type" type="text" placeholder="Install / Repair" /></label>
            <label>Status<input id="job_status" type="text" value="planned" /></label>
            <label>Priority<input id="job_priority" type="text" value="normal" /></label>
            <label>Start Date<input id="job_start_date" type="date" /></label>
            <label>End Date<input id="job_end_date" type="date" /></label>
            <label>Supervisor<input id="job_supervisor_name" type="text" placeholder="Supervisor name" /></label>
            <label>Signing Supervisor<input id="job_signing_supervisor_name" type="text" /></label>
            <label>Admin<input id="job_admin_name" type="text" /></label>
            <label>Client<input id="job_client_name" type="text" /></label>
          </div>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="job_notes" rows="3" placeholder="Job notes"></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="job_add_equipment" class="secondary" type="button">Add Requirement</button>
            <button id="job_save" class="primary" type="button">Save Job</button>
            <label style="display:flex;align-items:center;gap:8px;">
              <input id="job_request_approval" type="checkbox" /> Request job approval
            </label>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_equipment_table">
              <thead>
                <tr>
                  <th>Equipment / Pool</th>
                  <th>Pool Key</th>
                  <th>Needed</th>
                  <th>Reserved</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div id="job_summary" class="notice" style="display:none;margin-top:14px;"></div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Saved Jobs</h3>
            <div class="table-scroll">
              <table id="job_list_table">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Site</th><th>Status</th><th>Approval</th><th>Dates</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (equipment && equipment.dataset.jobsLayoutReady !== '1') {
        equipment.dataset.jobsLayoutReady = '1';
        equipment.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>Equipment</h2>
              <p class="section-subtitle">Manage assets, pool keys, checkout/return, and availability snapshots.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="eq_load" class="secondary" type="button">Reload</button>
            </div>
          </div>
          <div class="grid">
            <label>Equipment Code<input id="eq_code" type="text" /></label>
            <label>Equipment Name<input id="eq_name" type="text" /></label>
            <label>Category<input id="eq_category" type="text" /></label>
            <label>Home Site<select id="eq_home_site"></select></label>
            <label>Status<input id="eq_status" type="text" value="available" /></label>
            <label>Current Job<input id="eq_current_job_code" type="text" /></label>
            <label>Assigned Supervisor<input id="eq_assigned_supervisor" type="text" /></label>
            <label>Serial<input id="eq_serial" type="text" /></label>
          </div>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="eq_notes" rows="3"></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="eq_save" class="primary" type="button">Save Equipment</button>
            <button id="eq_checkout" class="secondary" type="button">Check Out</button>
            <button id="eq_return" class="secondary" type="button">Return</button>
          </div>
          <div id="eq_summary" class="notice" style="display:none;margin-top:14px;"></div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Availability by Pool</h3>
            <div class="table-scroll">
              <table id="eq_pool_table">
                <thead><tr><th>Pool</th><th>Category</th><th>Total</th><th>Available</th><th>Reserved</th><th>Checked Out</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Equipment List</h3>
            <div class="table-scroll">
              <table id="eq_list_table">
                <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Job</th><th>Pool</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    function els() {
      return {
        jobsSection: $('#jobs'),
        equipmentSection: $('#equipment'),
        jobCode: $('#job_code'),
        jobName: $('#job_name'),
        jobSiteName: $('#job_site_name'),
        jobType: $('#job_type'),
        jobStatus: $('#job_status'),
        jobPriority: $('#job_priority'),
        jobStartDate: $('#job_start_date'),
        jobEndDate: $('#job_end_date'),
        jobSupervisorName: $('#job_supervisor_name'),
        jobSigningSupervisorName: $('#job_signing_supervisor_name'),
        jobAdminName: $('#job_admin_name'),
        jobClientName: $('#job_client_name'),
        jobNotes: $('#job_notes'),
        jobAddEquipment: $('#job_add_equipment'),
        jobRequestApproval: $('#job_request_approval'),
        jobEquipmentBody: $('#job_equipment_table tbody'),
        jobSave: $('#job_save'),
        jobLoad: $('#job_load'),
        jobSummary: $('#job_summary'),
        jobListBody: $('#job_list_table tbody'),
        eqCode: $('#eq_code'),
        eqName: $('#eq_name'),
        eqCategory: $('#eq_category'),
        eqHomeSite: $('#eq_home_site'),
        eqStatus: $('#eq_status'),
        eqCurrentJobCode: $('#eq_current_job_code'),
        eqAssignedSupervisor: $('#eq_assigned_supervisor'),
        eqSerial: $('#eq_serial'),
        eqNotes: $('#eq_notes'),
        eqSave: $('#eq_save'),
        eqLoad: $('#eq_load'),
        eqCheckout: $('#eq_checkout'),
        eqReturn: $('#eq_return'),
        eqSummary: $('#eq_summary'),
        eqListBody: $('#eq_list_table tbody'),
        eqPoolBody: $('#eq_pool_table tbody')
      };
    }

    function setNotice(el, text = '', isError = false) {
      if (!el) return;
      if (!text) {
        el.style.display = 'none';
        el.textContent = '';
        el.dataset.kind = '';
        return;
      }
      el.style.display = 'block';
      el.textContent = text;
      el.dataset.kind = isError ? 'error' : 'info';
    }

    function canManage() {
      const access = getAccessProfile(getCurrentRole());
      return !!(access.canManageJobs || access.canManageAdminDirectory);
    }

    function canApprove() {
      const access = getAccessProfile(getCurrentRole());
      return !!access.canManageAdminDirectory;
    }

    function applyRoleVisibility() {
      const e = els();
      const allowed = !!getAccessProfile(getCurrentRole()).canManageJobs || canApprove();
      if (e.jobsSection) e.jobsSection.style.display = allowed ? '' : 'none';
      if (e.equipmentSection) e.equipmentSection.style.display = allowed ? '' : 'none';
    }

    function fillSiteSelect(selectEl) {
      if (!selectEl) return;
      const current = selectEl.value;
      const uniqueSites = Array.from(new Map(state.jobs.map((row) => [row.site_id || row.site_code || row.site_name, row])).values())
        .filter((row) => row.site_name || row.site_code)
        .map((row) => ({ value: row.site_code || row.site_name, label: row.site_code ? `${row.site_code} — ${row.site_name || ''}` : row.site_name }));
      selectEl.innerHTML = '<option value="">Select site</option>' + uniqueSites.map((row) => `<option value="${escHtml(row.value)}">${escHtml(row.label)}</option>`).join('');
      if (current) selectEl.value = current;
    }

    function addEquipmentRequirementRow(row = {}) {
      const e = els();
      if (!e.jobEquipmentBody) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="job-eq-name" placeholder="Harness / Lift / specific asset" value="${escHtml(row.equipment_name || row.name || '')}"></td>
        <td><input type="text" class="job-eq-pool" placeholder="pool key" value="${escHtml(row.equipment_pool_key || row.pool_key || '')}"></td>
        <td><input type="number" class="job-eq-needed" min="1" step="1" value="${escHtml(row.needed_qty ?? 1)}"></td>
        <td><input type="number" class="job-eq-reserved" min="0" step="1" value="${escHtml(row.reserved_qty ?? 0)}"></td>
        <td>
          <select class="job-eq-approval">
            <option value="not_required" ${(row.approval_status || '') === 'not_required' ? 'selected' : ''}>Not required</option>
            <option value="pending" ${(row.approval_status || '') === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${(row.approval_status || '') === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${(row.approval_status || '') === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td><button type="button" class="secondary job-eq-remove">Remove</button></td>
      `;
      e.jobEquipmentBody.appendChild(tr);
    }

    function collectRequirements() {
      const e = els();
      return Array.from(e.jobEquipmentBody?.querySelectorAll('tr') || []).map((tr) => ({
        name: $('.job-eq-name', tr)?.value?.trim?.() || '',
        pool_key: $('.job-eq-pool', tr)?.value?.trim?.() || '',
        needed_qty: Number($('.job-eq-needed', tr)?.value || 0),
        reserved_qty: Number($('.job-eq-reserved', tr)?.value || 0),
        approval_status: $('.job-eq-approval', tr)?.value || 'not_required'
      })).filter((row) => row.name || row.pool_key);
    }

    function renderJobs() {
      const e = els();
      if (!e.jobListBody) return;
      e.jobListBody.innerHTML = '';
      state.jobs.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escHtml(row.job_code)}</td><td>${escHtml(row.job_name)}</td><td>${escHtml(row.site_name || row.site_code || '')}</td><td>${escHtml(row.status || '')}</td><td>${escHtml(row.approval_status || '')}</td><td>${escHtml(row.start_date || '')}${row.end_date ? ` → ${escHtml(row.end_date)}` : ''}</td>`;
        e.jobListBody.appendChild(tr);
      });
    }

    function renderEquipment() {
      const e = els();
      if (e.eqListBody) {
        e.eqListBody.innerHTML = '';
        state.equipment.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code)}</td><td>${escHtml(row.equipment_name)}</td><td>${escHtml(row.status)}</td><td>${escHtml(row.current_job_code || '')}</td><td>${escHtml(row.equipment_pool_key || '')}</td>`;
          e.eqListBody.appendChild(tr);
        });
      }
      if (e.eqPoolBody) {
        e.eqPoolBody.innerHTML = '';
        state.pools.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_pool_key)}</td><td>${escHtml(row.category || '')}</td><td>${escHtml(row.total_qty)}</td><td>${escHtml(row.available_qty)}</td><td>${escHtml(row.reserved_qty)}</td><td>${escHtml(row.checked_out_qty)}</td>`;
          e.eqPoolBody.appendChild(tr);
        });
      }
    }

    async function loadData() {
      const e = els();
      try {
        const resp = await api.fetchJobsDirectory({ scope: 'all' });
        state.jobs = Array.isArray(resp?.jobs) ? resp.jobs : [];
        state.equipment = Array.isArray(resp?.equipment) ? resp.equipment : [];
        state.requirements = Array.isArray(resp?.requirements) ? resp.requirements : [];
        state.signouts = Array.isArray(resp?.signouts) ? resp.signouts : [];
        state.pools = Array.isArray(resp?.pools) ? resp.pools : [];
        state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
        fillSiteSelect(e.jobSiteName);
        fillSiteSelect(e.eqHomeSite);
        renderJobs();
        renderEquipment();
        renderRequirementReviewPanel();
        setNotice(e.jobSummary, `Loaded ${state.jobs.length} jobs and ${state.requirements.length} requirements.`);
        setNotice(e.eqSummary, `Loaded ${state.equipment.length} equipment items across ${state.pools.length} pools.`);
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Failed to load jobs.', true);
        setNotice(e.eqSummary, err?.message || 'Failed to load equipment.', true);
      }
    }

    async function saveJob() {
      const e = els();
      try {
        const payload = {
          entity: 'job',
          action: 'upsert',
          job_code: e.jobCode?.value?.trim?.() || '',
          job_name: e.jobName?.value?.trim?.() || '',
          site_name: e.jobSiteName?.value?.trim?.() || '',
          job_type: e.jobType?.value?.trim?.() || '',
          status: e.jobStatus?.value?.trim?.() || 'planned',
          priority: e.jobPriority?.value?.trim?.() || 'normal',
          start_date: e.jobStartDate?.value || null,
          end_date: e.jobEndDate?.value || null,
          supervisor_name: e.jobSupervisorName?.value?.trim?.() || '',
          signing_supervisor_name: e.jobSigningSupervisorName?.value?.trim?.() || '',
          admin_name: e.jobAdminName?.value?.trim?.() || '',
          client_name: e.jobClientName?.value?.trim?.() || '',
          notes: e.jobNotes?.value?.trim?.() || '',
          request_approval: !!e.jobRequestApproval?.checked,
          requirements: collectRequirements()
        };
        const resp = await api.manageJobsEntity(payload);
        if (!resp?.ok) throw new Error(resp?.error || 'Job save failed');
        setNotice(e.jobSummary, `Job ${payload.job_code} saved. Reservation checks were applied across matching equipment pools.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Failed to save job.', true);
      }
    }

    async function saveEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({
          entity: 'equipment',
          action: 'upsert',
          equipment_code: e.eqCode?.value?.trim?.() || '',
          equipment_name: e.eqName?.value?.trim?.() || '',
          category: e.eqCategory?.value?.trim?.() || '',
          home_site: e.eqHomeSite?.value?.trim?.() || '',
          status: e.eqStatus?.value?.trim?.() || 'available',
          current_job_code: e.eqCurrentJobCode?.value?.trim?.() || '',
          assigned_supervisor_name: e.eqAssignedSupervisor?.value?.trim?.() || '',
          serial_number: e.eqSerial?.value?.trim?.() || '',
          notes: e.eqNotes?.value?.trim?.() || ''
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Equipment save failed');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} saved.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Failed to save equipment.', true);
      }
    }

    async function checkoutEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'checkout', equipment_code: e.eqCode?.value?.trim?.() || '', job_code: e.eqCurrentJobCode?.value?.trim?.() || '', supervisor_name: e.eqAssignedSupervisor?.value?.trim?.() || '', notes: e.eqNotes?.value?.trim?.() || '' });
        if (!resp?.ok) throw new Error(resp?.error || 'Checkout failed');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} checked out.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Checkout failed.', true);
      }
    }

    async function returnEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'return', equipment_code: e.eqCode?.value?.trim?.() || '' });
        if (!resp?.ok) throw new Error(resp?.error || 'Return failed');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} returned.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Return failed.', true);
      }
    }

    async function updateRequirementApproval(requirementId, action) {
      const e = els();
      try {
        const decisionNotes = window.prompt(`Optional note for ${action}:`, '') || '';
        const resp = await window.YWIAPI.manageAdminEntity({ entity: 'job_requirement', action, requirement_id: requirementId, decision_notes: decisionNotes });
        if (!resp?.ok) throw new Error(resp?.error || 'Requirement approval update failed');
        setNotice(e.jobSummary, `Requirement ${requirementId} ${action} complete.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Requirement update failed.', true);
      }
    }

    function renderRequirementReviewPanel() {
      const e = els();
      const existing = document.getElementById('job_requirement_review_block');
      if (existing) existing.remove();
      const pending = state.requirements.filter((row) => ['pending', 'rejected', 'approved'].includes(String(row.approval_status || '').toLowerCase()) || Number(row.reserved_qty || 0) < Number(row.needed_qty || 0));
      if (!pending.length || !e.jobsSection) return;
      const block = document.createElement('div');
      block.id = 'job_requirement_review_block';
      block.className = 'admin-panel-block';
      block.style.marginTop = '16px';
      block.innerHTML = `
        <h3 style="margin-top:0;">Requirement Review</h3>
        <div class="table-scroll">
          <table>
            <thead><tr><th>ID</th><th>Job</th><th>Equipment</th><th>Needed</th><th>Reserved</th><th>Approval</th><th>Actions</th></tr></thead>
            <tbody>
              ${pending.map((row) => `
                <tr>
                  <td>${escHtml(row.id)}</td>
                  <td>${escHtml(row.job_id)}</td>
                  <td>${escHtml(row.equipment_name || row.equipment_code || row.equipment_pool_key || '')}</td>
                  <td>${escHtml(row.needed_qty)}</td>
                  <td>${escHtml(row.reserved_qty)}</td>
                  <td>${escHtml(row.approval_status || '')}</td>
                  <td>
                    <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
                      <button type="button" class="secondary" data-requirement-action="request_approval" data-id="${escHtml(row.id)}">Request</button>
                      <button type="button" class="secondary" data-requirement-action="approve" data-id="${escHtml(row.id)}">Approve</button>
                      <button type="button" class="secondary" data-requirement-action="reject" data-id="${escHtml(row.id)}">Reject</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      e.jobsSection.appendChild(block);
      block.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-requirement-action]');
        if (!btn) return;
        if (!canApprove()) {
          setNotice(e.jobSummary, 'Admin access is required for requirement approvals.', true);
          return;
        }
        updateRequirementApproval(btn.getAttribute('data-id'), btn.getAttribute('data-requirement-action'));
      });
    }

    function bind() {
      const e = els();
      if (e.jobAddEquipment && e.jobAddEquipment.dataset.bound !== '1') {
        e.jobAddEquipment.dataset.bound = '1';
        e.jobAddEquipment.addEventListener('click', () => addEquipmentRequirementRow({ needed_qty: 1, reserved_qty: 0 }));
      }
      if (e.jobEquipmentBody && e.jobEquipmentBody.dataset.bound !== '1') {
        e.jobEquipmentBody.dataset.bound = '1';
        e.jobEquipmentBody.addEventListener('click', (event) => {
          const btn = event.target.closest('.job-eq-remove');
          if (!btn) return;
          btn.closest('tr')?.remove();
        });
      }
      if (e.jobSave && e.jobSave.dataset.bound !== '1') {
        e.jobSave.dataset.bound = '1';
        e.jobSave.addEventListener('click', saveJob);
      }
      if (e.jobLoad && e.jobLoad.dataset.bound !== '1') {
        e.jobLoad.dataset.bound = '1';
        e.jobLoad.addEventListener('click', loadData);
      }
      if (e.eqSave && e.eqSave.dataset.bound !== '1') {
        e.eqSave.dataset.bound = '1';
        e.eqSave.addEventListener('click', saveEquipment);
      }
      if (e.eqLoad && e.eqLoad.dataset.bound !== '1') {
        e.eqLoad.dataset.bound = '1';
        e.eqLoad.addEventListener('click', loadData);
      }
      if (e.eqCheckout && e.eqCheckout.dataset.bound !== '1') {
        e.eqCheckout.dataset.bound = '1';
        e.eqCheckout.addEventListener('click', checkoutEquipment);
      }
      if (e.eqReturn && e.eqReturn.dataset.bound !== '1') {
        e.eqReturn.dataset.bound = '1';
        e.eqReturn.addEventListener('click', returnEquipment);
      }
    }

    async function init() {
      ensureLayout();
      bind();
      applyRoleVisibility();
      await loadData();
      renderRequirementReviewPanel();
    }

    return { init, applyRoleVisibility, loadData };
  }

  window.YWIJobsUI = { create: createJobsUI };
})();
