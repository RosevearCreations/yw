/* File: js/profile-ui.js
   Brief description: Self profile, crew directory, and session/settings UI module.
   Lets employees view and update their own profile details, supervisors view crew records,
   and admins view the broader people directory from a non-CRUD screen.
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

  function createProfileUI(config = {}) {
    const api = config.api;
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAuthState = config.getAuthState || (() => ({}));
    const getAccessProfile = config.getAccessProfile || (() => ({ canViewCrew: false, roleLabel: 'Worker' }));

    const els = {
      meSection: $('#me'),
      crewSection: $('#crew'),
      settingsSection: $('#settings'),
      meSummary: $('#me_summary'),
      crewSummary: $('#crew_summary'),
      sessionSummary: $('#settings_session_summary'),
      sessionWhoami: $('#settings_whoami'),
      sessionRole: $('#settings_role'),
      sessionExpires: $('#settings_expires'),
      sessionEmailValidation: $('#settings_email_validation'),
      sessionPhoneValidation: $('#settings_phone_validation'),
      sessionLogout: $('#settings_logout'),
      sessionSettingsHint: $('#settings_future_hint'),

      meName: $('#me_full_name'),
      meEmail: $('#me_email'),
      meRole: $('#me_role'),
      mePhone: $('#me_phone'),
      meAddress1: $('#me_address1'),
      meAddress2: $('#me_address2'),
      meCity: $('#me_city'),
      meProvince: $('#me_province'),
      mePostal: $('#me_postal_code'),
      meVehicle: $('#me_vehicle_make_model'),
      mePlate: $('#me_vehicle_plate'),
      mePosition: $('#me_current_position'),
      meTrade: $('#me_trade_specialty'),
      meStartDate: $('#me_start_date'),
      meStrengths: $('#me_strengths'),
      meEmployeeNumber: $('#me_employee_number'),
      meDefaultSupervisorName: $('#me_default_supervisor_name'),
      meOverrideSupervisorName: $('#me_override_supervisor_name'),
      meDefaultAdminName: $('#me_default_admin_name'),
      meOverrideAdminName: $('#me_override_admin_name'),
      mePhoneVerified: $('#me_phone_verified'),
      mePreviousEmployee: $('#me_previous_employee'),
      mePrefs: $('#me_feature_preferences'),
      meEmergencyName: $('#me_emergency_contact_name'),
      meEmergencyPhone: $('#me_emergency_contact_phone'),
      meSave: $('#me_save'),
      meReload: $('#me_reload'),
      safetySummary: $('#me_safety_summary'),
      trainingCourse: $('#me_training_course_id'),
      trainingCompletedAt: $('#me_training_completed_at'),
      trainingTrainer: $('#me_training_trainer_name'),
      trainingProvider: $('#me_training_provider_name'),
      trainingCertificate: $('#me_training_certificate_number'),
      trainingNotes: $('#me_training_notes'),
      trainingSave: $('#me_training_self_ack'),
      trainingTableBody: document.querySelector('#me_training_record_table tbody'),
      sdsProductName: $('#me_sds_product_name'),
      sdsChemicalName: $('#me_sds_chemical_name'),
      sdsRevisionDate: $('#me_sds_revision_date'),
      sdsJobCode: $('#me_sds_job_code'),
      sdsWorkOrder: $('#me_sds_work_order_number'),
      sdsRouteCode: $('#me_sds_route_code'),
      sdsEquipmentCode: $('#me_sds_equipment_code'),
      sdsNotes: $('#me_sds_notes'),
      sdsSave: $('#me_sds_self_ack'),
      sdsPromptBody: document.querySelector('#me_sds_prompt_table tbody'),
      timeSummary: $('#me_time_summary'),
      timeJob: $('#me_time_job_id'),
      timeNotes: $('#me_time_notes'),
      timeClockIn: $('#me_time_clock_in'),
      timeBreakStart: $('#me_time_break_start'),
      timeBreakEnd: $('#me_time_break_end'),
      timeClockOut: $('#me_time_clock_out'),
      timeStatus: $('#me_time_status'),
      timeActiveSince: $('#me_time_active_since'),
      timePaidMinutes: $('#me_time_paid_minutes'),
      timeBreakMinutes: $('#me_time_break_minutes'),
      timeLocationStatus: $('#me_time_location_status'),
      timePhotoNote: $('#me_time_photo_note'),
      timePhotoFile: $('#me_time_photo_file'),
      timeCaptureLocation: $('#me_time_capture_location'),
      timeRecentBody: document.querySelector('#me_time_recent_table tbody'),

      crewSearch: $('#crew_search'),
      crewRoleFilter: $('#crew_role_filter'),
      crewLoad: $('#crew_load'),
      crewTableBody: $('#crew_table tbody')
    };

    const PROFILE_DRAFT_KEY = 'ywi_profile_self_draft_v1';
    const state = { selfProfile: null, crewRows: [], selfLoadVersion: 0, crewLoadVersion: 0, timeClockContext: null, bound: false, routeBound: false, initialized: false };


    function refreshEls() {
      Object.assign(els, {
        meSection: $('#me'),
        crewSection: $('#crew'),
        settingsSection: $('#settings'),
        meSummary: $('#me_summary'),
        crewSummary: $('#crew_summary'),
        sessionSummary: $('#settings_session_summary'),
        sessionWhoami: $('#settings_whoami'),
        sessionRole: $('#settings_role'),
        sessionExpires: $('#settings_expires'),
        sessionEmailValidation: $('#settings_email_validation'),
        sessionPhoneValidation: $('#settings_phone_validation'),
        sessionLogout: $('#settings_logout'),
        sessionSettingsHint: $('#settings_future_hint'),
        meName: $('#me_full_name'),
        meEmail: $('#me_email'),
        meRole: $('#me_role'),
        mePhone: $('#me_phone'),
        meAddress1: $('#me_address1'),
        meAddress2: $('#me_address2'),
        meCity: $('#me_city'),
        meProvince: $('#me_province'),
        mePostal: $('#me_postal_code'),
        meVehicle: $('#me_vehicle_make_model'),
        mePlate: $('#me_vehicle_plate'),
        mePosition: $('#me_current_position'),
        meTrade: $('#me_trade_specialty'),
        meStartDate: $('#me_start_date'),
        meStrengths: $('#me_strengths'),
        meEmployeeNumber: $('#me_employee_number'),
        meDefaultSupervisorName: $('#me_default_supervisor_name'),
        meOverrideSupervisorName: $('#me_override_supervisor_name'),
        meDefaultAdminName: $('#me_default_admin_name'),
        meOverrideAdminName: $('#me_override_admin_name'),
        mePhoneVerified: $('#me_phone_verified'),
        mePreviousEmployee: $('#me_previous_employee'),
        mePrefs: $('#me_feature_preferences'),
        meEmergencyName: $('#me_emergency_contact_name'),
        meEmergencyPhone: $('#me_emergency_contact_phone'),
        meSave: $('#me_save'),
        meReload: $('#me_reload'),
        safetySummary: $('#me_safety_summary'),
        trainingCourse: $('#me_training_course_id'),
        trainingCompletedAt: $('#me_training_completed_at'),
        trainingTrainer: $('#me_training_trainer_name'),
        trainingProvider: $('#me_training_provider_name'),
        trainingCertificate: $('#me_training_certificate_number'),
        trainingNotes: $('#me_training_notes'),
        trainingSave: $('#me_training_self_ack'),
        trainingTableBody: document.querySelector('#me_training_record_table tbody'),
        sdsProductName: $('#me_sds_product_name'),
        sdsChemicalName: $('#me_sds_chemical_name'),
        sdsRevisionDate: $('#me_sds_revision_date'),
        sdsJobCode: $('#me_sds_job_code'),
        sdsWorkOrder: $('#me_sds_work_order_number'),
        sdsRouteCode: $('#me_sds_route_code'),
        sdsEquipmentCode: $('#me_sds_equipment_code'),
        sdsNotes: $('#me_sds_notes'),
        sdsSave: $('#me_sds_self_ack'),
        sdsPromptBody: document.querySelector('#me_sds_prompt_table tbody'),
        timeSummary: $('#me_time_summary'),
        timeJob: $('#me_time_job_id'),
        timeNotes: $('#me_time_notes'),
        timeClockIn: $('#me_time_clock_in'),
        timeBreakStart: $('#me_time_break_start'),
        timeBreakEnd: $('#me_time_break_end'),
        timeClockOut: $('#me_time_clock_out'),
        timeStatus: $('#me_time_status'),
        timeActiveSince: $('#me_time_active_since'),
        timePaidMinutes: $('#me_time_paid_minutes'),
        timeBreakMinutes: $('#me_time_break_minutes'),
        timeLocationStatus: $('#me_time_location_status'),
        timePhotoNote: $('#me_time_photo_note'),
        timePhotoFile: $('#me_time_photo_file'),
        timeCaptureLocation: $('#me_time_capture_location'),
      timeLocationStatus: $('#me_time_location_status'),
      timePhotoNote: $('#me_time_photo_note'),
      timePhotoFile: $('#me_time_photo_file'),
      timeCaptureLocation: $('#me_time_capture_location'),
        timeRecentBody: document.querySelector('#me_time_recent_table tbody'),
        crewSearch: $('#crew_search'),
        crewRoleFilter: $('#crew_role_filter'),
        crewLoad: $('#crew_load'),
        crewTableBody: $('#crew_table tbody')
      });
    }


    function ensureLayout() {
      const meSection = document.getElementById('me');
      if (meSection && meSection.dataset.layoutReady !== '1') {
        meSection.dataset.layoutReady = '1';
        meSection.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>My Profile</h2>
              <p class="section-subtitle">View and update your staff profile, contact information, and assigned reporting lines.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="me_reload" class="secondary" type="button">Reload</button>
              <button id="me_save" class="primary" type="button">Save Profile</button>
            </div>
          </div>
          <div id="me_summary" class="notice" style="display:none;margin-bottom:14px;"></div>
          <div class="grid">
            <label>Full Name<input id="me_full_name" type="text" /></label>
            <label>Email<input id="me_email" type="email" readonly /></label>
            <label>Role<input id="me_role" type="text" readonly /></label>
            <label>Phone<input id="me_phone" type="text" /></label>
            <label>Position<input id="me_current_position" type="text" /></label>
            <label>Trade / Specialty<input id="me_trade_specialty" type="text" /></label>
            <label>Start Date<input id="me_start_date" type="date" /></label>
            <label>Employee Number<input id="me_employee_number" type="text" /></label>
            <label>Vehicle<input id="me_vehicle_make_model" type="text" /></label>
            <label>Plate<input id="me_vehicle_plate" type="text" /></label>
            <label>Phone Verified<input id="me_phone_verified" type="text" readonly /></label>
            <label>Previous Employee<input id="me_previous_employee" type="text" readonly /></label>
            <label>Address 1<input id="me_address1" type="text" /></label>
            <label>Address 2<input id="me_address2" type="text" /></label>
            <label>City<input id="me_city" type="text" /></label>
            <label>Province<input id="me_province" type="text" /></label>
            <label>Postal Code<input id="me_postal_code" type="text" /></label>
            <label>Default Supervisor<input id="me_default_supervisor_name" type="text" readonly /></label>
            <label>Override Supervisor<input id="me_override_supervisor_name" type="text" readonly /></label>
            <label>Default Admin<input id="me_default_admin_name" type="text" readonly /></label>
            <label>Override Admin<input id="me_override_admin_name" type="text" readonly /></label>
            <label>Emergency Contact<input id="me_emergency_contact_name" type="text" /></label>
            <label>Emergency Phone<input id="me_emergency_contact_phone" type="text" /></label>
          </div>
          <label style="display:block;margin-top:12px;">Strengths<textarea id="me_strengths" rows="3"></textarea></label>
          <label style="display:block;margin-top:12px;">Preferences / Notes<textarea id="me_feature_preferences" rows="3"></textarea></label>
          <div class="section-heading" style="margin-top:20px;">
            <div>
              <h3 style="margin:0;">Site Time Clock</h3>
              <p class="section-subtitle">Clock in on arrival, pause unpaid breaks, and sign out when leaving the site.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="me_time_clock_in" class="secondary" type="button">Clock In</button>
              <button id="me_time_break_start" class="secondary" type="button">Start Unpaid Break</button>
              <button id="me_time_break_end" class="secondary" type="button">End Break</button>
              <button id="me_time_clock_out" class="primary" type="button">Clock Out</button>
            </div>
          </div>
          <div id="me_time_summary" class="notice" style="display:none;margin-bottom:14px;"></div>
          <div class="grid">
            <label>Job / Site<select id="me_time_job_id"></select></label>
            <label>Current Status<input id="me_time_status" type="text" readonly /></label>
            <label>Active Since<input id="me_time_active_since" type="text" readonly /></label>
            <label>Paid Minutes<input id="me_time_paid_minutes" type="text" readonly /></label>
            <label>Unpaid Break Minutes<input id="me_time_break_minutes" type="text" readonly /></label>
            <label>Location Status<input id="me_time_location_status" type="text" readonly /></label>
            <label style="display:flex;align-items:center;gap:8px;"><input id="me_time_capture_location" type="checkbox" checked /> Use current location on clock in/out</label>
          </div>
          <label style="display:block;margin-top:12px;">Clock Notes<textarea id="me_time_notes" rows="2" placeholder="Optional site or shift note"></textarea></label>
          <label style="display:block;margin-top:12px;">Arrival / Departure Photo Note<textarea id="me_time_photo_note" rows="2" placeholder="Optional photo or geofence note for supervisor review"></textarea></label>
          <label style="display:block;margin-top:12px;">Attendance Photo<input id="me_time_photo_file" type="file" accept="image/*" /></label>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="me_time_recent_table">
              <thead><tr><th>Signed In</th><th>Job</th><th>Status</th><th>Paid</th><th>Break</th><th>Signed Out</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        `
      }
      const crewSection = document.getElementById('crew');
      if (crewSection && crewSection.dataset.layoutReady !== '1') {
        crewSection.dataset.layoutReady = '1';
        crewSection.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>Crew</h2>
              <p class="section-subtitle">Supervisor and Admin view of staff records and reporting lines.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="crew_load" class="secondary" type="button">Reload Crew</button>
            </div>
          </div>
          <div id="crew_summary" class="notice" style="display:none;margin-bottom:14px;"></div>
          <div class="grid">
            <label>Search<input id="crew_search" type="text" placeholder="Name, email, role, position" /></label>
            <label>Role Filter
              <select id="crew_role_filter">
                <option value="">All roles</option>
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
                <option value="worker">Worker</option>
              </select>
            </label>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="crew_table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Position</th><th>Trade</th><th>Phone</th><th>Active</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        `
      }
    }




function ensureSelfServiceLayout() {
  const meSection = document.getElementById('me');
  if (!meSection || meSection.querySelector('#me_safety_summary')) return;
  meSection.insertAdjacentHTML('beforeend', `
      <div class="section-heading" style="margin-top:20px;">
        <div>
          <h3 style="margin:0;">Worker Safety Self-Service</h3>
          <p class="section-subtitle">Self-acknowledge training completions and SDS prompts so supervisors can review without chasing paper records.</p>
        </div>
      </div>
      <div id="me_safety_summary" class="notice" style="display:none;margin-bottom:14px;"></div>
      <div class="grid">
        <label>Training Course<select id="me_training_course_id"></select></label>
        <label>Completed Date<input id="me_training_completed_at" type="date" /></label>
        <label>Trainer / Source<input id="me_training_trainer_name" type="text" placeholder="Supervisor, vendor, or self-study source" /></label>
        <label>Provider<input id="me_training_provider_name" type="text" placeholder="Provider or platform" /></label>
        <label>Certificate / Licence<input id="me_training_certificate_number" type="text" placeholder="Optional certificate or licence number" /></label>
      </div>
      <label style="display:block;margin-top:12px;">Training Notes<textarea id="me_training_notes" rows="2" placeholder="Optional completion note for supervisor verification"></textarea></label>
      <div class="admin-heading-actions" style="margin-top:10px;">
        <button id="me_training_self_ack" class="secondary" type="button">Save Training Acknowledgement</button>
      </div>
      <div class="table-scroll" style="margin-top:12px;">
        <table id="me_training_record_table">
          <thead><tr><th>Course</th><th>Status</th><th>Completed</th><th>Expires</th><th>Verification</th><th>Method</th></tr></thead>
          <tbody><tr><td colspan="6" class="muted">Load your profile to view training history.</td></tr></tbody>
        </table>
      </div>
      <div class="section-heading" style="margin-top:20px;">
        <div>
          <h3 style="margin:0;">SDS Prompt Queue</h3>
          <p class="section-subtitle">Acknowledge products and chemical prompts tied to your current training, jobs, routes, and equipment context.</p>
        </div>
      </div>
      <div class="grid">
        <label>Product Name<input id="me_sds_product_name" type="text" placeholder="Product or product family" /></label>
        <label>Chemical Name<input id="me_sds_chemical_name" type="text" placeholder="Optional chemical name" /></label>
        <label>SDS Revision Date<input id="me_sds_revision_date" type="date" /></label>
        <label>Job Code<input id="me_sds_job_code" type="text" placeholder="Optional job code" /></label>
        <label>Work Order<input id="me_sds_work_order_number" type="text" placeholder="Optional work order" /></label>
        <label>Route Code<input id="me_sds_route_code" type="text" placeholder="Optional route" /></label>
        <label>Equipment Code<input id="me_sds_equipment_code" type="text" placeholder="Optional equipment code" /></label>
      </div>
      <label style="display:block;margin-top:12px;">SDS Notes<textarea id="me_sds_notes" rows="2" placeholder="Optional acknowledgement note or context"></textarea></label>
      <div class="admin-heading-actions" style="margin-top:10px;">
        <button id="me_sds_self_ack" class="secondary" type="button">Record SDS Acknowledgement</button>
      </div>
      <div class="table-scroll" style="margin-top:12px;">
        <table id="me_sds_prompt_table">
          <thead><tr><th>Prompt</th><th>Status</th><th>Acknowledged</th><th>Expiry</th><th>Context</th><th>Action</th></tr></thead>
          <tbody><tr><td colspan="6" class="muted">Load your profile to view SDS prompts.</td></tr></tbody>
        </table>
      </div>
  `);
}

function renderSelfSafety(payload) {
  const courses = Array.isArray(payload?.self_training_available_courses) ? payload.self_training_available_courses : [];
  const trainingRows = Array.isArray(payload?.self_training_records) ? payload.self_training_records : [];
  const sdsRows = Array.isArray(payload?.self_sds_acknowledgements) ? payload.self_sds_acknowledgements : [];
  const sdsPrompts = Array.isArray(payload?.self_sds_prompts) ? payload.self_sds_prompts : [];

  if (els.trainingCourse) {
    const options = courses.map((row) => `<option value="${escHtml(row.id)}">${escHtml([row.course_code, row.course_name].filter(Boolean).join(' — ') || row.course_name || row.id)}</option>`).join('');
    els.trainingCourse.innerHTML = `<option value="">Select self-service course</option>${options}`;
  }
  if (els.trainingCompletedAt && !els.trainingCompletedAt.value) els.trainingCompletedAt.value = new Date().toISOString().slice(0, 10);

  if (els.trainingTableBody) {
    els.trainingTableBody.innerHTML = trainingRows.map((row) => `
      <tr>
        <td>${escHtml(row.course_name || '')}</td>
        <td>${escHtml(row.completion_status || '')}${row.is_expired ? '<div class="report-mini-note">Expired</div>' : row.expires_within_30_days ? '<div class="report-mini-note">Expiring</div>' : ''}</td>
        <td>${escHtml(row.completed_at || '')}</td>
        <td>${escHtml(row.expires_at || '')}</td>
        <td>${row.verification_pending ? '<span class="status-chip warn">Pending</span>' : (row.verified_at ? `<span class="status-chip ok">Verified ${escHtml(row.verified_at)}</span>` : '')}</td>
        <td>${escHtml(row.acknowledgement_method || '')}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="muted">No self-service training records are available yet.</td></tr>';
  }

  const promptMap = new Map();
  for (const row of sdsPrompts) {
    const key = String(row.training_record_id || row.course_id || row.product_name || crypto.randomUUID());
    promptMap.set(key, row);
  }
  for (const row of sdsRows) {
    if (!row.linked_training_record_id) continue;
    const key = String(row.linked_training_record_id);
    if (!promptMap.has(key)) promptMap.set(key, row);
  }
  const promptRows = Array.from(promptMap.values());
  if (els.sdsPromptBody) {
    els.sdsPromptBody.innerHTML = promptRows.map((row) => `
      <tr>
        <td>${escHtml(row.course_name || row.product_name || row.chemical_name || 'SDS prompt')}</td>
        <td>${escHtml(row.prompt_status || row.status || row.sds_status || '')}</td>
        <td>${escHtml(row.acknowledged_at || '')}</td>
        <td>${escHtml(row.expires_at || '')}</td>
        <td>${escHtml(row.prompt_context_label || [row.job_code, row.work_order_number, row.route_code, row.equipment_code].filter(Boolean).join(' / '))}</td>
        <td><button type="button" class="secondary" data-sds-prompt='${escHtml(JSON.stringify({ training_record_id: row.training_record_id || row.linked_training_record_id || '', course_name: row.course_name || '', product_name: row.product_name || row.course_name || '', chemical_name: row.chemical_name || '', job_code: row.job_code || '', work_order_number: row.work_order_number || '', route_code: row.route_code || '', equipment_code: row.equipment_code || '', prompt_context_label: row.prompt_context_label || '' }))}'>Use</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="muted">No SDS prompts are due for your profile right now.</td></tr>';
  }

  const duePromptCount = promptRows.filter((row) => row.prompt_due || row.is_expired || row.expires_within_7_days).length;
  const verificationPending = trainingRows.filter((row) => row.verification_pending).length;
  setNotice(els.safetySummary, `Loaded ${trainingRows.length} training record(s), ${promptRows.length} SDS prompt row(s), ${verificationPending} training verification item(s), and ${duePromptCount} due SDS prompt(s).`);
}

async function saveTrainingSelfAcknowledgement() {
  try {
    const courseId = els.trainingCourse?.value || '';
    if (!courseId) throw new Error('Choose a self-service training course first.');
    setNotice(els.safetySummary, 'Saving training acknowledgement...');
    const resp = await api.manageAdminEntity({
      entity: 'training_self_acknowledgement',
      action: 'create',
      course_id: courseId,
      completed_at: els.trainingCompletedAt?.value || null,
      trainer_name: els.trainingTrainer?.value?.trim?.() || null,
      provider_name: els.trainingProvider?.value?.trim?.() || null,
      certificate_number: els.trainingCertificate?.value?.trim?.() || null,
      notes: els.trainingNotes?.value?.trim?.() || null,
    });
    if (!resp?.ok) throw new Error(resp?.error || 'Training acknowledgement failed.');
    setNotice(els.safetySummary, 'Training acknowledgement saved.');
    await loadSelfProfile();
  } catch (err) {
    console.error(err);
    setNotice(els.safetySummary, err?.message || 'Training acknowledgement failed.');
  }
}

async function saveWorkerSdsAcknowledgement(overrides = {}) {
  try {
    const payload = {
      entity: 'worker_sds_self_acknowledgement',
      action: 'create',
      linked_training_record_id: overrides.training_record_id || null,
      product_name: overrides.product_name || els.sdsProductName?.value?.trim?.() || null,
      chemical_name: overrides.chemical_name || els.sdsChemicalName?.value?.trim?.() || null,
      sds_revision_date: els.sdsRevisionDate?.value || null,
      job_code: overrides.job_code || els.sdsJobCode?.value?.trim?.() || null,
      work_order_number: overrides.work_order_number || els.sdsWorkOrder?.value?.trim?.() || null,
      route_code: overrides.route_code || els.sdsRouteCode?.value?.trim?.() || null,
      equipment_code: overrides.equipment_code || els.sdsEquipmentCode?.value?.trim?.() || null,
      notes: els.sdsNotes?.value?.trim?.() || null,
      product_context: {
        prompt_context_label: overrides.prompt_context_label || null,
        course_name: overrides.course_name || null,
      },
    };
    if (!payload.product_name && !payload.chemical_name) throw new Error('Enter the product or chemical name for the SDS acknowledgement.');
    setNotice(els.safetySummary, 'Recording SDS acknowledgement...');
    const resp = await api.manageAdminEntity(payload);
    if (!resp?.ok) throw new Error(resp?.error || 'SDS acknowledgement failed.');
    setNotice(els.safetySummary, 'SDS acknowledgement recorded.');
    await loadSelfProfile();
  } catch (err) {
    console.error(err);
    setNotice(els.safetySummary, err?.message || 'SDS acknowledgement failed.');
  }
}

    function loadDraft() {
      try { return JSON.parse(localStorage.getItem(PROFILE_DRAFT_KEY) || '{}'); } catch { return {}; }
    }

    function saveDraft() {
      try {
        localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify({
          full_name: els.meName?.value || '',
          phone: els.mePhone?.value || '',
          address_line1: els.meAddress1?.value || '',
          address_line2: els.meAddress2?.value || '',
          city: els.meCity?.value || '',
          province: els.meProvince?.value || '',
          postal_code: els.mePostal?.value || '',
          vehicle_make_model: els.meVehicle?.value || '',
          vehicle_plate: els.mePlate?.value || '',
          current_position: els.mePosition?.value || '',
          trade_specialty: els.meTrade?.value || '',
          start_date: els.meStartDate?.value || '',
          strengths: els.meStrengths?.value || '',
          employee_number: els.meEmployeeNumber?.value || '',
          feature_preferences: els.mePrefs?.value || '',
          emergency_contact_name: els.meEmergencyName?.value || '',
          emergency_contact_phone: els.meEmergencyPhone?.value || ''
        }));
      } catch {}
    }

    function clearDraft() {
      try { localStorage.removeItem(PROFILE_DRAFT_KEY); } catch {}
    }

    function restoreDraft() {
      const draft = loadDraft();
      if (!draft || !Object.keys(draft).length) return false;
      const assign = (el, value) => { if (el && !el.value) el.value = value || ''; };
      assign(els.meName, draft.full_name);
      assign(els.mePhone, draft.phone);
      assign(els.meAddress1, draft.address_line1);
      assign(els.meAddress2, draft.address_line2);
      assign(els.meCity, draft.city);
      assign(els.meProvince, draft.province);
      assign(els.mePostal, draft.postal_code);
      assign(els.meVehicle, draft.vehicle_make_model);
      assign(els.mePlate, draft.vehicle_plate);
      assign(els.mePosition, draft.current_position);
      assign(els.meTrade, draft.trade_specialty);
      assign(els.meStartDate, draft.start_date);
      assign(els.meStrengths, draft.strengths);
      assign(els.meEmployeeNumber, draft.employee_number);
      assign(els.mePrefs, draft.feature_preferences);
      assign(els.meEmergencyName, draft.emergency_contact_name);
      assign(els.meEmergencyPhone, draft.emergency_contact_phone);
      setNotice(els.meSummary, 'Recovered unsaved profile draft from this device.');
      return true;
    }

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

    function renderSession() {
      const authState = getAuthState() || {};
      const profile = authState.profile || {};
      const access = getAccessProfile(getCurrentRole());
      if (els.sessionWhoami) els.sessionWhoami.value = profile.full_name || profile.email || authState.user?.email || '';
      if (els.sessionRole) els.sessionRole.value = access.roleLabel || authState.role || 'Worker';
      if (els.sessionExpires) {
        const expiresAt = authState.session?.expires_at ? new Date(authState.session.expires_at * 1000).toLocaleString() : '';
        els.sessionExpires.value = expiresAt;
      }
      if (els.sessionEmailValidation) els.sessionEmailValidation.value = authState.user?.email_confirmed_at ? 'Verified' : 'Verification pending';
      if (els.sessionPhoneValidation) els.sessionPhoneValidation.value = authState.profile?.phone_verified ? 'Verified' : 'Verification pending';
    }

    function renderSelf(profile) {
      state.selfProfile = profile || null;
      if (!profile) {
        if (els.trainingTableBody) els.trainingTableBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to view training history.</td></tr>';
        if (els.sdsPromptBody) els.sdsPromptBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to view SDS prompts.</td></tr>';
        return;
      }
      if (els.meName) els.meName.value = profile.full_name || '';
      if (els.meEmail) els.meEmail.value = profile.email || '';
      if (els.meRole) els.meRole.value = profile.role || '';
      if (els.mePhone) els.mePhone.value = profile.phone || '';
      if (els.meAddress1) els.meAddress1.value = profile.address_line1 || '';
      if (els.meAddress2) els.meAddress2.value = profile.address_line2 || '';
      if (els.meCity) els.meCity.value = profile.city || '';
      if (els.meProvince) els.meProvince.value = profile.province || '';
      if (els.mePostal) els.mePostal.value = profile.postal_code || '';
      if (els.meVehicle) els.meVehicle.value = profile.vehicle_make_model || '';
      if (els.mePlate) els.mePlate.value = profile.vehicle_plate || '';
      if (els.mePosition) els.mePosition.value = profile.current_position || '';
      if (els.meTrade) els.meTrade.value = profile.trade_specialty || '';
      if (els.meStartDate) els.meStartDate.value = profile.start_date || '';
      if (els.meStrengths) els.meStrengths.value = profile.strengths || '';
      if (els.meEmployeeNumber) els.meEmployeeNumber.value = profile.employee_number || '';
      if (els.meDefaultSupervisorName) els.meDefaultSupervisorName.value = profile.default_supervisor_name || '';
      if (els.meOverrideSupervisorName) els.meOverrideSupervisorName.value = profile.override_supervisor_name || '';
      if (els.meDefaultAdminName) els.meDefaultAdminName.value = profile.default_admin_name || '';
      if (els.meOverrideAdminName) els.meOverrideAdminName.value = profile.override_admin_name || '';
      if (els.mePhoneVerified) els.mePhoneVerified.value = profile.phone_verified ? 'Yes' : 'No';
      if (els.mePreviousEmployee) els.mePreviousEmployee.value = profile.previous_employee ? 'Yes' : 'No';
      if (els.mePrefs) els.mePrefs.value = profile.feature_preferences || '';
      if (els.meEmergencyName) els.meEmergencyName.value = profile.emergency_contact_name || '';
      if (els.meEmergencyPhone) els.meEmergencyPhone.value = profile.emergency_contact_phone || '';
    }


    function renderTimeClock(context) {
      state.timeClockContext = context || { active_entry: null, recent_entries: [], available_jobs: [] };
      const jobs = Array.isArray(state.timeClockContext.available_jobs) ? state.timeClockContext.available_jobs : [];
      if (els.timeJob) {
        els.timeJob.innerHTML = `<option value="">Select active job / site</option>` + jobs.map((row) => {
          const label = [row.job_code, row.job_name, row.site_name].filter(Boolean).join(' — ');
          return `<option value="${escHtml(row.id)}">${escHtml(label || row.id)}</option>`;
        }).join('');
      }
      const active = state.timeClockContext.active_entry || null;
      if (active && els.timeJob) els.timeJob.value = String(active.job_id || '');
      if (els.timeStatus) els.timeStatus.value = active ? String(active.clock_status || '').replaceAll('_', ' ') : 'Not clocked in';
      if (els.timeActiveSince) els.timeActiveSince.value = active?.signed_in_at_local || active?.signed_in_at || '';
      if (els.timePaidMinutes) els.timePaidMinutes.value = String(active?.paid_work_minutes ?? 0);
      if (els.timeBreakMinutes) els.timeBreakMinutes.value = String(active?.unpaid_break_minutes ?? 0);
      if (els.timeLocationStatus) els.timeLocationStatus.value = active ? ([active.clock_in_geofence_status || active.clock_in_geo_source || 'recorded', active.clock_in_geofence_distance_meters ? `${active.clock_in_geofence_distance_meters}m` : ''].filter(Boolean).join(' — ')) : 'Waiting';
      if (els.timePhotoFile) els.timePhotoFile.value = '';
      if (els.timeRecentBody) {
        const recent = Array.isArray(state.timeClockContext.recent_entries) ? state.timeClockContext.recent_entries : [];
        els.timeRecentBody.innerHTML = recent.map((row) => `
          <tr>
            <td>${escHtml(row.signed_in_at_local || row.signed_in_at || '')}</td>
            <td>${escHtml([row.job_code, row.job_name].filter(Boolean).join(' — '))}</td>
            <td>${escHtml(String(row.clock_status || '').replaceAll('_', ' '))}</td>
            <td>${escHtml(String(row.paid_work_minutes ?? 0))}</td>
            <td>${escHtml(String(row.unpaid_break_minutes ?? 0))}</td>
            <td>${escHtml(row.signed_out_at_local || row.signed_out_at || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No recent site time entries yet.</td></tr>';
      }
      if (els.timeClockIn) els.timeClockIn.disabled = !!active;
      if (els.timeBreakStart) els.timeBreakStart.disabled = !active || String(active?.clock_status || '') !== 'active';
      if (els.timeBreakEnd) els.timeBreakEnd.disabled = !active || String(active?.clock_status || '') !== 'paused';
      if (els.timeClockOut) els.timeClockOut.disabled = !active;
    }

    async function loadTimeClockContext() {
      try {
        const authState = getAuthState();
        if (!authState?.isAuthenticated || authState?.isLoggingOut) {
          renderTimeClock(null);
          return;
        }
        setNotice(els.timeSummary, 'Loading time clock...');
        const resp = await (api.fetchMyTimeClockContext ? api.fetchMyTimeClockContext() : api.accountRecoveryAction({ action: 'list_my_time_clock_context' }, true));
        renderTimeClock(resp || null);
        setNotice(els.timeSummary, '');
      } catch (err) {
        console.error(err);
        setNotice(els.timeSummary, err?.message || 'Failed to load your time clock.');
      }
    }

    async function runTimeClockAction(action) {
      try {
        const payload = { notes: els.timeNotes?.value?.trim?.() || null };
        if (action === 'employee_clock_in') payload.job_id = els.timeJob?.value || null;
        if (els.timePhotoNote?.value) payload.photo_note = els.timePhotoNote.value.trim() || null;
        if (els.timeCaptureLocation?.checked && navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }));
            payload.latitude = position?.coords?.latitude ?? null;
            payload.longitude = position?.coords?.longitude ?? null;
            payload.accuracy_m = position?.coords?.accuracy ?? null;
            payload.geo_source = 'browser_geolocation';
          } catch (geoErr) {
            console.warn('Geolocation unavailable for time clock action.', geoErr);
            payload.geo_source = 'unknown';
          }
        }
        const resp = await (api.employeeTimeClockAction ? api.employeeTimeClockAction(action, payload) : api.accountRecoveryAction({ action, ...payload }, true));
        if (!resp?.ok) throw new Error(resp?.error || 'Time clock action failed.');
        const entry = resp.entry || resp.active_entry || null;
        const photoFile = els.timePhotoFile?.files?.[0] || null;
        if (photoFile && entry?.id && (action === 'employee_clock_in' || action === 'employee_clock_out') && api.uploadEmployeeTimePhoto) {
          const formData = new FormData();
          formData.set('time_entry_id', String(entry.id));
          formData.set('stage', action === 'employee_clock_in' ? 'clock_in' : 'clock_out');
          if (els.timePhotoNote?.value?.trim?.()) formData.set('caption', els.timePhotoNote.value.trim());
          formData.set('file', photoFile);
          await api.uploadEmployeeTimePhoto(formData, true);
          await loadTimeClockContext();
        } else {
          renderTimeClock(resp);
        }
        const messageMap = {
          employee_clock_in: 'Signed in to site time.',
          employee_start_break: 'Unpaid break started.',
          employee_end_break: 'Unpaid break ended.',
          employee_clock_out: 'Signed out from site time.'
        };
        setNotice(els.timeSummary, messageMap[action] || 'Time clock updated.');
      } catch (err) {
        console.error(err);
        setNotice(els.timeSummary, err?.message || 'Time clock action failed.');
      }
    }

    function renderCrew(rows) {
      state.crewRows = Array.isArray(rows) ? rows : [];
      if (!els.crewTableBody) return;
      els.crewTableBody.innerHTML = '';
      state.crewRows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.full_name || '')}</td>
          <td>${escHtml(row.email || '')}</td>
          <td>${escHtml(row.role || '')}</td>
          <td>${escHtml(row.current_position || '')}</td>
          <td>${escHtml(row.trade_specialty || '')}</td>
          <td>${escHtml(row.phone || '')}</td>
          <td>${row.is_active ? 'Yes' : 'No'}</td>
        `;
        els.crewTableBody.appendChild(tr);
      });
    }

    async function loadSelfProfile() {
      const loadVersion = (state.selfLoadVersion += 1);
      try {
        const authState = getAuthState();
        if (!authState?.isAuthenticated || authState?.isLoggingOut) {
          renderSelf(null);
          return;
        }
        setNotice(els.meSummary, 'Loading your profile...');
        const localProfile = authState?.profile || state.selfProfile || null;
        if (localProfile) renderSelf(localProfile);
        const resp = await api.fetchProfileScope('self');
        if (loadVersion !== state.selfLoadVersion) return;
        const profile = resp?.profile || resp?.profiles?.[0] || localProfile || null;
        renderSelf(profile);
        renderSelfSafety(resp || {});
        restoreDraft();
        setNotice(els.meSummary, profile ? '' : 'No profile record was returned.');
      } catch (err) {
        if (loadVersion !== state.selfLoadVersion) return;
        const authState = getAuthState();
        if (authState?.isLoggingOut || !authState?.isAuthenticated) return;
        const fallbackProfile = authState?.profile || state.selfProfile || null;
        if (fallbackProfile) renderSelf(fallbackProfile);
        renderSelfSafety({});
        console.error(err);
        setNotice(els.meSummary, fallbackProfile ? 'Loaded the last available profile details on this device. Live refresh failed.' : 'Failed to load your profile.');
      }
    }

    async function saveSelfProfile() {
      try {
        setNotice(els.meSummary, 'Saving your profile...');
        const resp = await api.saveMyProfile({
          full_name: els.meName?.value?.trim?.() || null,
          phone: els.mePhone?.value?.trim?.() || null,
          address_line1: els.meAddress1?.value?.trim?.() || null,
          address_line2: els.meAddress2?.value?.trim?.() || null,
          city: els.meCity?.value?.trim?.() || null,
          province: els.meProvince?.value?.trim?.() || null,
          postal_code: els.mePostal?.value?.trim?.() || null,
          vehicle_make_model: els.meVehicle?.value?.trim?.() || null,
          vehicle_plate: els.mePlate?.value?.trim?.() || null,
          current_position: els.mePosition?.value?.trim?.() || null,
          trade_specialty: els.meTrade?.value?.trim?.() || null,
          start_date: els.meStartDate?.value || null,
          strengths: els.meStrengths?.value?.trim?.() || null,
          employee_number: els.meEmployeeNumber?.value?.trim?.() || null,
          feature_preferences: els.mePrefs?.value?.trim?.() || null,
          emergency_contact_name: els.meEmergencyName?.value?.trim?.() || null,
          emergency_contact_phone: els.meEmergencyPhone?.value?.trim?.() || null
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Profile save failed');
        clearDraft();
        setNotice(els.meSummary, 'Your profile was saved.');
        await loadSelfProfile();
      } catch (err) {
        console.error(err);
        setNotice(els.meSummary, err?.message || 'Failed to save your profile.');
      }
    }

    async function loadCrew() {
      const loadVersion = (state.crewLoadVersion += 1);
      const access = getAccessProfile(getCurrentRole());
      const authState = getAuthState();
      if (!access.canViewCrew || !authState?.isAuthenticated || authState?.isLoggingOut) {
        renderCrew([]);
        return;
      }
      try {
        setNotice(els.crewSummary, 'Loading crew view...');
        const resp = await api.fetchProfileScope({
          scope: 'crew',
          search: els.crewSearch?.value?.trim?.() || '',
          role_filter: els.crewRoleFilter?.value || ''
        });
        if (loadVersion !== state.crewLoadVersion) return;
        renderCrew(resp?.profiles || []);
        setNotice(els.crewSummary, `Loaded ${resp?.profiles?.length || 0} people.`);
      } catch (err) {
        if (loadVersion !== state.crewLoadVersion) return;
        const currentState = getAuthState();
        if (currentState?.isLoggingOut || !currentState?.isAuthenticated) return;
        console.error(err);
        setNotice(els.crewSummary, 'Failed to load crew records.');
      }
    }

    async function clearCurrentSession() {
      if (!window.confirm('Log out of this current session?')) return;
      try {
        await window.YWI_AUTH.logout();
      } catch (err) {
        console.error(err);
        setNotice(els.sessionSummary, 'Failed to clear the current session.');
      }
    }

    function applyRoleVisibility() {
      const access = getAccessProfile(getCurrentRole());
      if (els.crewSection) els.crewSection.style.display = access.canViewCrew ? '' : 'none';
      renderSession();
    }

    function bind() {
      if (!state.bound) {
        document.addEventListener('ywi:auth-changed', () => {
          ensureLayout();
          ensureSelfServiceLayout();
          refreshEls();
          applyRoleVisibility();
          const authState = getAuthState();
          if (!authState?.isAuthenticated) {
            renderSelf(null);
            renderSelfSafety({});
            renderCrew([]);
            setNotice(els.meSummary, '');
            setNotice(els.crewSummary, '');
            return;
          }
          loadSelfProfile();
          loadTimeClockContext();
          if (getAccessProfile(getCurrentRole()).canViewCrew) loadCrew();
        });
        document.addEventListener('ywi:route-shown', (event) => {
          const allowed = event?.detail?.allowed || event?.detail?.requested || '';
          if (!['me', 'crew', 'settings'].includes(String(allowed))) return;
          ensureLayout();
          ensureSelfServiceLayout();
          refreshEls();
          applyRoleVisibility();
          if (allowed === 'me' && getAuthState()?.isAuthenticated) { loadSelfProfile(); loadTimeClockContext(); }
          if (allowed === 'crew' && getAuthState()?.isAuthenticated && getAccessProfile(getCurrentRole()).canViewCrew) loadCrew();
        });
        document.addEventListener('click', (event) => {
          const btn = event.target instanceof Element ? event.target.closest('[data-sds-prompt]') : null;
          if (!btn) return;
          try {
            const payload = JSON.parse(btn.getAttribute('data-sds-prompt') || '{}');
            if (els.sdsProductName && !els.sdsProductName.value) els.sdsProductName.value = payload.product_name || payload.course_name || '';
            if (els.sdsChemicalName && !els.sdsChemicalName.value) els.sdsChemicalName.value = payload.chemical_name || '';
            if (els.sdsJobCode) els.sdsJobCode.value = payload.job_code || '';
            if (els.sdsWorkOrder) els.sdsWorkOrder.value = payload.work_order_number || '';
            if (els.sdsRouteCode) els.sdsRouteCode.value = payload.route_code || '';
            if (els.sdsEquipmentCode) els.sdsEquipmentCode.value = payload.equipment_code || '';
            saveWorkerSdsAcknowledgement(payload);
          } catch (err) {
            console.error(err);
            setNotice(els.safetySummary, 'Could not load the selected SDS prompt.');
          }
        });
        state.bound = true;
      }

      if (els.meReload && els.meReload.dataset.bound !== '1') {
        els.meReload.dataset.bound = '1';
        els.meReload.addEventListener('click', loadSelfProfile);
      }
      if (els.meSave && els.meSave.dataset.bound !== '1') {
        els.meSave.dataset.bound = '1';
        els.meSave.addEventListener('click', saveSelfProfile);
      }
      if (els.trainingSave && els.trainingSave.dataset.bound !== '1') {
        els.trainingSave.dataset.bound = '1';
        els.trainingSave.addEventListener('click', saveTrainingSelfAcknowledgement);
      }
      if (els.sdsSave && els.sdsSave.dataset.bound !== '1') {
        els.sdsSave.dataset.bound = '1';
        els.sdsSave.addEventListener('click', () => saveWorkerSdsAcknowledgement({}));
      }
      if (els.crewLoad && els.crewLoad.dataset.bound !== '1') {
        els.crewLoad.dataset.bound = '1';
        els.crewLoad.addEventListener('click', loadCrew);
      }
      if (els.timeClockIn && els.timeClockIn.dataset.bound !== '1') {
        els.timeClockIn.dataset.bound = '1';
        els.timeClockIn.addEventListener('click', () => runTimeClockAction('employee_clock_in'));
      }
      if (els.timeBreakStart && els.timeBreakStart.dataset.bound !== '1') {
        els.timeBreakStart.dataset.bound = '1';
        els.timeBreakStart.addEventListener('click', () => runTimeClockAction('employee_start_break'));
      }
      if (els.timeBreakEnd && els.timeBreakEnd.dataset.bound !== '1') {
        els.timeBreakEnd.dataset.bound = '1';
        els.timeBreakEnd.addEventListener('click', () => runTimeClockAction('employee_end_break'));
      }
      if (els.timeClockOut && els.timeClockOut.dataset.bound !== '1') {
        els.timeClockOut.dataset.bound = '1';
        els.timeClockOut.addEventListener('click', () => runTimeClockAction('employee_clock_out'));
      }
      if (els.sessionLogout && els.sessionLogout.dataset.bound !== '1') {
        els.sessionLogout.dataset.bound = '1';
        els.sessionLogout.addEventListener('click', clearCurrentSession);
      }
    }

    async function init() {
      ensureLayout();
      ensureSelfServiceLayout();
      refreshEls();
      bind();
      applyRoleVisibility();
      await loadSelfProfile();
      await loadTimeClockContext();
      if (getAccessProfile(getCurrentRole()).canViewCrew) await loadCrew();
      state.initialized = true;
    }

    return { init, loadSelfProfile, loadCrew, applyRoleVisibility };
  }

  window.YWIProfileUI = { create: createProfileUI };
})();
