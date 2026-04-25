/* File: js/forms-incident.js
   Brief description: Incident / Near Miss form module.
   Captures incident, near miss, property damage, and vehicle event details,
   supports optional image upload, and falls back to the outbox when offline.
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
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function bytesLabel(size) {
    const n = Number(size || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }
  function clearImageState(state, body, fileInput, captionInput) {
    state.splice(0, state.length);
    if (body) body.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (captionInput) captionInput.value = '';
  }
  function renderImageRows(state, body) {
    if (!body) return;
    body.innerHTML = '';
    state.forEach((img, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escHtml(img.file?.name || '')}</td>
        <td>${escHtml(img.image_type || 'general')}</td>
        <td>${escHtml(bytesLabel(img.file?.size || 0))}</td>
        <td>${escHtml(img.caption || '')}</td>
        <td><button type="button" data-remove-index="${idx}">Remove</button></td>`;
      body.appendChild(tr);
    });
  }

  function ensureLayout() {
    const section = document.getElementById('incident');
    if (!section || section.dataset.layoutReady === '1') return;
    section.dataset.layoutReady = '1';
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Incident / Near Miss</h2>
          <p class="section-subtitle">Report injuries, near misses, property damage, vehicle events, and immediate corrective actions before details are lost.</p>
        </div>
      </div>
      <div id="inc_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
      <form id="incidentForm">
        <div class="grid">
          <label>Site<input id="inc_site" type="text" list="site-options" placeholder="Site name" required></label>
          <label>Date<input id="inc_date" type="date" required></label>
          <label>Time<input id="inc_time" type="time"></label>
          <label>Reported By<input id="inc_reported_by" type="text" list="employee-options" placeholder="Worker or supervisor" required></label>
          <label>Affected Worker<input id="inc_worker_name" type="text" list="employee-options" placeholder="Optional affected worker" /></label>
          <label>Incident Type
            <select id="inc_kind">
              <option value="near_miss">Near Miss</option>
              <option value="injury_illness">Injury / Illness</option>
              <option value="property_damage">Property Damage</option>
              <option value="equipment_damage">Equipment Damage</option>
              <option value="vehicle_event">Vehicle Event</option>
              <option value="spill_release">Spill / Release</option>
              <option value="public_incident">Public / Third-Party Incident</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Severity
            <select id="inc_severity">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>Job Code<input id="inc_job_code" type="text" placeholder="Optional job code" /></label>
          <label>Work Order #<input id="inc_work_order" type="text" placeholder="Optional work order" /></label>
          <label>Route Code<input id="inc_route_code" type="text" placeholder="Optional route" /></label>
          <label>Equipment Code<input id="inc_equipment_code" type="text" placeholder="Optional equipment" /></label>
        </div>
        <div class="grid" style="margin-top:12px;">
          <label><input id="inc_anonymous" type="checkbox" /> Anonymous / confidential report</label>
          <label><input id="inc_medical" type="checkbox" /> Medical treatment required</label>
          <label><input id="inc_lost_time" type="checkbox" /> Lost time / removed from work</label>
          <label><input id="inc_property_damage" type="checkbox" /> Property damage</label>
          <label><input id="inc_vehicle" type="checkbox" /> Vehicle involved</label>
          <label><input id="inc_immediate_fixed" type="checkbox" /> Immediate hazard controlled</label>
        </div>
        <label style="display:block;margin-top:12px;">Event Summary<textarea id="inc_event_summary" rows="2" placeholder="Short summary for reports and follow-up" required></textarea></label>
        <label style="display:block;margin-top:12px;">What Happened<textarea id="inc_description" rows="4" placeholder="Describe what happened, what was being done, and what hazards were present" required></textarea></label>
        <label style="display:block;margin-top:12px;">Immediate Actions Taken<textarea id="inc_immediate_actions" rows="3" placeholder="First aid, shutdown, barricade, supervisor notified, etc."></textarea></label>
        <label style="display:block;margin-top:12px;">Root Cause / Contributing Factors<textarea id="inc_root_cause" rows="3" placeholder="Weather, traffic, lifting, equipment, training, planning, housekeeping, communication, public contact, etc."></textarea></label>
        <div class="grid" style="margin-top:12px;">
          <label>Corrective Action Owner<input id="inc_action_owner" type="text" list="employee-options" placeholder="Responsible person" /></label>
          <label>Corrective Action Status
            <select id="inc_action_status">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <label>Corrective Action Due Date<input id="inc_action_due" type="date" /></label>
          <label>Witness Names<input id="inc_witnesses" type="text" placeholder="Comma-separated witness names" /></label>
        </div>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Images</h3></div>
        <div class="grid">
          <label>Files<input id="inc_image_files" type="file" accept="image/*" multiple></label>
          <label>Image Type
            <select id="inc_image_type">
              <option value="general">General</option>
              <option value="hazard">Hazard</option>
              <option value="equipment">Equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="site">Site</option>
            </select>
          </label>
          <label>Caption<input id="inc_image_caption" type="text" placeholder="Optional caption" /></label>
        </div>
        <div class="form-footer" style="margin-top:10px;"><button id="inc_image_add" type="button" class="secondary">Add Images</button></div>
        <div class="table-scroll">
          <table id="inc_images_table"><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Caption</th><th>Actions</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="form-footer" style="margin-top:18px;"><button type="submit">Submit Incident / Near Miss</button></div>
      </form>`;
  }

  function createIncidentForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;
    ensureLayout();
    const els = {
      form: $('#incidentForm'),
      summary: $('#inc_summary'),
      site: $('#inc_site'),
      date: $('#inc_date'),
      time: $('#inc_time'),
      reportedBy: $('#inc_reported_by'),
      workerName: $('#inc_worker_name'),
      kind: $('#inc_kind'),
      severity: $('#inc_severity'),
      jobCode: $('#inc_job_code'),
      workOrder: $('#inc_work_order'),
      routeCode: $('#inc_route_code'),
      equipmentCode: $('#inc_equipment_code'),
      anonymous: $('#inc_anonymous'),
      medical: $('#inc_medical'),
      lostTime: $('#inc_lost_time'),
      propertyDamage: $('#inc_property_damage'),
      vehicle: $('#inc_vehicle'),
      immediateFixed: $('#inc_immediate_fixed'),
      eventSummary: $('#inc_event_summary'),
      description: $('#inc_description'),
      immediateActions: $('#inc_immediate_actions'),
      rootCause: $('#inc_root_cause'),
      actionOwner: $('#inc_action_owner'),
      actionStatus: $('#inc_action_status'),
      actionDue: $('#inc_action_due'),
      witnesses: $('#inc_witnesses'),
      imageFiles: $('#inc_image_files'),
      imageType: $('#inc_image_type'),
      imageCaption: $('#inc_image_caption'),
      imageAddBtn: $('#inc_image_add'),
      imageBody: $('#inc_images_table tbody')
    };
    const state = { images: [] };

    function setSummary(message = '', isError = false) {
      if (!els.summary) return;
      if (!message) {
        els.summary.style.display = 'none';
        els.summary.textContent = '';
        els.summary.dataset.kind = '';
        return;
      }
      els.summary.style.display = 'block';
      els.summary.dataset.kind = isError ? 'error' : 'info';
      els.summary.textContent = message;
    }

    function resetForm() {
      els.form?.reset();
      if (els.date) els.date.value = todayISO();
      clearImageState(state.images, els.imageBody, els.imageFiles, els.imageCaption);
      setSummary('');
    }

    function collectPayload() {
      const payload = {
        site: els.site?.value?.trim?.() || '',
        date: els.date?.value || '',
        event_time: els.time?.value || '',
        submitted_by: els.reportedBy?.value?.trim?.() || '',
        worker_name: els.workerName?.value?.trim?.() || '',
        incident_kind: els.kind?.value || 'near_miss',
        severity: els.severity?.value || 'medium',
        job_code: els.jobCode?.value?.trim?.() || '',
        work_order_number: els.workOrder?.value?.trim?.() || '',
        route_code: els.routeCode?.value?.trim?.() || '',
        equipment_code: els.equipmentCode?.value?.trim?.() || '',
        anonymous_report: !!els.anonymous?.checked,
        medical_treatment_required: !!els.medical?.checked,
        lost_time: !!els.lostTime?.checked,
        property_damage: !!els.propertyDamage?.checked,
        vehicle_involved: !!els.vehicle?.checked,
        immediate_hazard_controlled: !!els.immediateFixed?.checked,
        event_summary: els.eventSummary?.value?.trim?.() || '',
        what_happened: els.description?.value?.trim?.() || '',
        immediate_actions_taken: els.immediateActions?.value?.trim?.() || '',
        root_cause_summary: els.rootCause?.value?.trim?.() || '',
        corrective_action_owner: els.actionOwner?.value?.trim?.() || '',
        corrective_action_status: els.actionStatus?.value || 'open',
        corrective_action_due_date: els.actionDue?.value || '',
        witness_names: els.witnesses?.value?.trim?.() || ''
      };
      if (!payload.site || !payload.date || !payload.submitted_by || !payload.event_summary || !payload.what_happened) {
        throw new Error('Please complete Site, Date, Reported By, Event Summary, and What Happened.');
      }
      return payload;
    }

    async function submit(event) {
      event.preventDefault();
      let payload;
      try { payload = collectPayload(); } catch (err) {
        setSummary(err?.message || 'Please complete the incident form.', true);
        return;
      }
      try {
        const resp = await sendToFunction('resend-email', { formType: 'F', payload });
        const submissionId = resp?.id || resp?.record?.id || null;
        if (submissionId && Array.isArray(state.images) && state.images.length && typeof uploadImagesForSubmission === 'function') {
          await uploadImagesForSubmission(state.images, submissionId);
        }
        setSummary('Incident / near miss submitted.');
        resetForm();
      } catch (err) {
        console.error(err);
        const list = typeof getOutbox === 'function' ? getOutbox() : [];
        list.push({ formType: 'resend-email', payload: { formType: 'F', payload }, localImages: state.images.slice() });
        if (typeof setOutbox === 'function') setOutbox(list);
        setSummary(`Saved locally to the outbox instead. ${err?.message || 'The network or server was unavailable.'}`, true);
      }
    }

    function bindEvents() {
      els.form?.addEventListener('submit', submit);
      els.imageAddBtn?.addEventListener('click', () => {
        const files = Array.from(els.imageFiles?.files || []);
        if (!files.length) return;
        const caption = els.imageCaption?.value?.trim?.() || '';
        const imageType = els.imageType?.value || 'general';
        files.forEach((file) => state.images.push({ file, image_type: imageType, caption }));
        renderImageRows(state.images, els.imageBody);
        if (els.imageFiles) els.imageFiles.value = '';
        if (els.imageCaption) els.imageCaption.value = '';
      });
      els.imageBody?.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-remove-index]');
        if (!btn) return;
        const idx = Number(btn.getAttribute('data-remove-index'));
        if (!Number.isFinite(idx)) return;
        state.images.splice(idx, 1);
        renderImageRows(state.images, els.imageBody);
      });
    }

    function init() {
      ensureLayout();
      if (els.date && !els.date.value) els.date.value = todayISO();
      bindEvents();
      return true;
    }

    return { init, resetForm };
  }

  window.YWIFormsIncident = { create: createIncidentForm };
})();
