/* File: js/jobs-ui.js
   Brief description: Jobs and equipment planning scaffold.
   Supports job drafts, equipment drafts, reservation-style planning, and backend calls when available.
   Falls back to local browser storage so the workflow can still be tested before full deployment.
*/

'use strict';

(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  const JOBS_KEY = 'ywi_jobs_drafts_v1';
  const EQUIP_KEY = 'ywi_equipment_drafts_v1';

  function getJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }
  function setJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
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
    const getAccessProfile = config.getAccessProfile || (() => ({ canManageJobs: false }));
    const getCurrentRole = config.getCurrentRole || (() => 'worker');

    const els = {
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
      eqSummary: $('#eq_summary'),
      eqListBody: $('#eq_list_table tbody')
    };

    const state = {
      jobs: getJson(JOBS_KEY, []),
      equipment: getJson(EQUIP_KEY, [])
    };

    function setNotice(el, text) {
      if (!el) return;
      if (text) {
        el.style.display = 'block';
        el.textContent = text;
      } else {
        el.style.display = 'none';
        el.textContent = '';
      }
    }

    function canManage() {
      return !!getAccessProfile(getCurrentRole()).canManageJobs;
    }

    function applyRoleVisibility() {
      const allowed = canManage();
      if (els.jobsSection) els.jobsSection.style.display = allowed ? '' : 'none';
      if (els.equipmentSection) els.equipmentSection.style.display = allowed ? '' : 'none';
    }

    function addEquipmentRequirementRow(row = {}) {
      if (!els.jobEquipmentBody) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="job-eq-name" placeholder="Equipment type or specific asset" value="${escHtml(row.name || '')}"></td>
        <td><input type="number" class="job-eq-needed" min="0" step="1" value="${escHtml(row.needed_qty ?? 1)}"></td>
        <td><input type="number" class="job-eq-reserved" min="0" step="1" value="${escHtml(row.reserved_qty ?? 0)}"></td>
        <td>
          <select class="job-eq-status">
            <option value="needed" ${row.status === 'needed' ? 'selected' : ''}>Needed</option>
            <option value="reserved" ${row.status === 'reserved' ? 'selected' : ''}>Reserved</option>
            <option value="checked_out" ${row.status === 'checked_out' ? 'selected' : ''}>Checked Out</option>
            <option value="returned" ${row.status === 'returned' ? 'selected' : ''}>Returned</option>
          </select>
        </td>
        <td><input type="text" class="job-eq-notes" value="${escHtml(row.notes || '')}" placeholder="Reservation notes"></td>
        <td><button type="button" data-act="remove-job-eq">Remove</button></td>
      `;
      els.jobEquipmentBody.appendChild(tr);
    }

    function collectRequirements() {
      return Array.from(els.jobEquipmentBody?.querySelectorAll('tr') || []).map((tr) => ({
        name: tr.querySelector('.job-eq-name')?.value?.trim?.() || '',
        needed_qty: Number(tr.querySelector('.job-eq-needed')?.value || 0),
        reserved_qty: Number(tr.querySelector('.job-eq-reserved')?.value || 0),
        status: tr.querySelector('.job-eq-status')?.value || 'needed',
        notes: tr.querySelector('.job-eq-notes')?.value?.trim?.() || ''
      })).filter((row) => row.name);
    }

    function renderJobList() {
      if (!els.jobListBody) return;
      els.jobListBody.innerHTML = '';
      state.jobs.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.job_code || '')}</td>
          <td>${escHtml(row.job_name || '')}</td>
          <td>${escHtml(row.site_name || '')}</td>
          <td>${escHtml(row.supervisor_name || '')}</td>
          <td>${escHtml(row.admin_name || '')}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml([row.start_date || '', row.end_date || ''].filter(Boolean).join(' to '))}</td>
        `;
        els.jobListBody.appendChild(tr);
      });
    }

    function renderEquipmentList() {
      if (!els.eqListBody) return;
      els.eqListBody.innerHTML = '';
      state.equipment.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.equipment_code || '')}</td>
          <td>${escHtml(row.equipment_name || '')}</td>
          <td>${escHtml(row.category || '')}</td>
          <td>${escHtml(row.home_site || '')}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml(row.current_job_code || '')}</td>
          <td>${escHtml(row.assigned_supervisor_name || '')}</td>
        `;
        els.eqListBody.appendChild(tr);
      });
    }

    async function loadJobs() {
      try {
        if (api?.fetchJobsDirectory) {
          const resp = await api.fetchJobsDirectory({ scope: 'jobs' });
          if (Array.isArray(resp?.jobs)) {
            state.jobs = resp.jobs;
            setJson(JOBS_KEY, state.jobs);
          }
          if (Array.isArray(resp?.equipment)) {
            state.equipment = resp.equipment;
            setJson(EQUIP_KEY, state.equipment);
          }
          setNotice(els.jobSummary, `Loaded ${state.jobs.length} jobs from backend.`);
        } else {
          setNotice(els.jobSummary, 'Backend job directory not deployed yet. Showing local drafts.');
        }
      } catch (err) {
        console.error(err);
        setNotice(els.jobSummary, 'Backend jobs directory unavailable. Showing local drafts.');
      }
      renderJobList();
      renderEquipmentList();
    }

    async function saveJob() {
      const row = {
        job_code: els.jobCode?.value?.trim?.() || '',
        job_name: els.jobName?.value?.trim?.() || '',
        site_name: els.jobSiteName?.value?.trim?.() || '',
        job_type: els.jobType?.value?.trim?.() || '',
        status: els.jobStatus?.value || 'planned',
        priority: els.jobPriority?.value || 'normal',
        start_date: els.jobStartDate?.value || '',
        end_date: els.jobEndDate?.value || '',
        supervisor_name: els.jobSupervisorName?.value?.trim?.() || '',
        signing_supervisor_name: els.jobSigningSupervisorName?.value?.trim?.() || '',
        admin_name: els.jobAdminName?.value?.trim?.() || '',
        client_name: els.jobClientName?.value?.trim?.() || '',
        notes: els.jobNotes?.value?.trim?.() || '',
        requirements: collectRequirements()
      };
      if (!row.job_code || !row.job_name) {
        setNotice(els.jobSummary, 'Job code and job name are required.');
        return;
      }
      try {
        if (api?.manageJobsEntity) {
          const resp = await api.manageJobsEntity({ entity: 'job', action: 'upsert', ...row });
          if (resp?.ok) setNotice(els.jobSummary, 'Job saved to backend.');
        }
      } catch (err) {
        console.error(err);
      }
      state.jobs = [row, ...state.jobs.filter((x) => x.job_code !== row.job_code)];
      setJson(JOBS_KEY, state.jobs);
      renderJobList();
      if (!els.jobSummary?.textContent) setNotice(els.jobSummary, 'Job saved locally.');
    }

    async function saveEquipment() {
      const row = {
        equipment_code: els.eqCode?.value?.trim?.() || '',
        equipment_name: els.eqName?.value?.trim?.() || '',
        category: els.eqCategory?.value?.trim?.() || '',
        home_site: els.eqHomeSite?.value?.trim?.() || '',
        status: els.eqStatus?.value || 'available',
        current_job_code: els.eqCurrentJobCode?.value?.trim?.() || '',
        assigned_supervisor_name: els.eqAssignedSupervisor?.value?.trim?.() || '',
        serial_number: els.eqSerial?.value?.trim?.() || '',
        notes: els.eqNotes?.value?.trim?.() || ''
      };
      if (!row.equipment_code || !row.equipment_name) {
        setNotice(els.eqSummary, 'Equipment code and name are required.');
        return;
      }
      try {
        if (api?.manageJobsEntity) {
          const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'upsert', ...row });
          if (resp?.ok) setNotice(els.eqSummary, 'Equipment saved to backend.');
        }
      } catch (err) {
        console.error(err);
      }
      state.equipment = [row, ...state.equipment.filter((x) => x.equipment_code !== row.equipment_code)];
      setJson(EQUIP_KEY, state.equipment);
      renderEquipmentList();
      if (!els.eqSummary?.textContent) setNotice(els.eqSummary, 'Equipment saved locally.');
    }

    function bind() {
      els.jobAddEquipment?.addEventListener('click', () => addEquipmentRequirementRow());
      els.jobEquipmentBody?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn?.dataset.act === 'remove-job-eq') btn.closest('tr')?.remove();
      });
      els.jobSave?.addEventListener('click', saveJob);
      els.jobLoad?.addEventListener('click', loadJobs);
      els.eqSave?.addEventListener('click', saveEquipment);
      els.eqLoad?.addEventListener('click', loadJobs);
      document.addEventListener('ywi:auth-changed', () => applyRoleVisibility());
    }

    async function init() {
      applyRoleVisibility();
      bind();
      if (els.jobEquipmentBody && !els.jobEquipmentBody.children.length) addEquipmentRequirementRow();
      await loadJobs();
    }

    return { init, loadJobs, applyRoleVisibility };
  }

  window.YWIJobsUI = { create: createJobsUI };
})();
