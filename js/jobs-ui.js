/* File: js/jobs-ui.js
   Brief description: Jobs and equipment planning UI.
   Renders live forms inside the Jobs and Equipment sections, supports pool-aware reservation requests,
   restores saved jobs into the form, and adds role-aware requirement approval controls.
*/

'use strict';

(function () {
  const JOB_DRAFT_KEY = 'ywi_job_draft_v1';
  const EQUIPMENT_DRAFT_KEY = 'ywi_equipment_draft_v1';

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
      notifications: [],
      inspections: [],
      maintenance: [],
      editingJobId: null,
      editingEquipmentCode: '',
      signaturePads: { worker: null, supervisor: null, admin: null },
      checkoutPhotos: [],
      returnPhotos: [],
      checkoutPhotoFiles: [],
      returnPhotoFiles: []
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
              <p class="section-subtitle">Create jobs, restore saved jobs back into the form, request pool-based reservations, and approve or reject requirement exceptions.</p>
            </div>
            <div class="admin-heading-actions">
              <a href="#equipment" class="secondary" id="job_open_equipment_link">Open Equipment Interface</a>
              <button id="job_load" class="secondary" type="button">Reload</button>
              <button id="job_clear" class="secondary" type="button">New Job</button>
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
          <div id="job_access_notice" class="notice" style="display:none;margin-top:14px;"></div>
          <div id="job_summary" class="notice" style="display:none;margin-top:14px;"></div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Saved Jobs</h3>
            <div class="table-scroll">
              <table id="job_list_table">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Site</th><th>Status</th><th>Approval</th><th>Dates</th><th>Action</th>
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
              <p class="section-subtitle">Manage rental-style asset records, pool keys, serials, images, purchase history, signed checkout/return events, and post-return damage evidence.</p>
            </div>
            <div class="admin-heading-actions">
              <a href="#admin" class="secondary" id="eq_open_admin_link">Open Admin Queue</a>
              <button id="eq_load" class="secondary" type="button">Reload</button>
              <button id="eq_clear" class="secondary" type="button">New Item</button>
            </div>
          </div>
          <div class="grid">
            <label>Equipment Code<input id="eq_code" type="text" /></label>
            <label>Equipment Name<input id="eq_name" type="text" /></label>
            <label>Category<input id="eq_category" type="text" /></label>
            <label>Pool Key<input id="eq_pool_key" type="text" /></label>
            <label>Home Site<select id="eq_home_site"></select></label>
            <label>Status<input id="eq_status" type="text" value="available" /></label>
            <label>Current Job<input id="eq_current_job_code" type="text" /></label>
            <label>Assigned Supervisor<input id="eq_assigned_supervisor" type="text" /></label>
            <label>Serial<input id="eq_serial" type="text" /></label>
            <label>Asset Tag<input id="eq_asset_tag" type="text" /></label>
            <label>Manufacturer<input id="eq_manufacturer" type="text" /></label>
            <label>Model<input id="eq_model" type="text" /></label>
            <label>Year<input id="eq_year" type="number" min="1900" max="2100" /></label>
            <label>Purchase Date<input id="eq_purchase_date" type="date" /></label>
            <label>Purchase Price<input id="eq_purchase_price" type="number" min="0" step="0.01" /></label>
            <label>Condition<input id="eq_condition" type="text" value="ready" /></label>
            <label>Image URL<input id="eq_image_url" type="url" /></label>
            <label>Service Interval (days)<input id="eq_service_interval_days" type="number" min="0" step="1" /></label>
            <label>Last Service<input id="eq_last_service_date" type="date" /></label>
            <label>Next Service Due<input id="eq_next_service_due_date" type="date" /></label>
            <label>Last Inspection<input id="eq_last_inspection_at" type="date" /></label>
            <label>Next Inspection Due<input id="eq_next_inspection_due_date" type="date" /></label>
            <label>Defect Status<input id="eq_defect_status" type="text" value="clear" /></label>
            <label>Defect Notes<input id="eq_defect_notes" type="text" /></label>
            <label style="display:flex;align-items:center;gap:8px;"> <input id="eq_is_locked_out" type="checkbox" /> Locked Out </label>
          </div>
          <label style="display:block;margin-top:12px;">Comments
            <textarea id="eq_comments" rows="2" placeholder="Damage notes, maintenance notes, rental comments"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="eq_notes" rows="3"></textarea>
          </label>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Checkout / Return Signatures</h3>
            <div class="grid">
              <label>Worker Signature<input id="eq_worker_signature" type="text" placeholder="Worker sign-off name" /></label>
              <label>Supervisor Signature<input id="eq_supervisor_signature" type="text" placeholder="Supervisor sign-off name" /></label>
              <label>Admin Signature<input id="eq_admin_signature" type="text" placeholder="Admin sign-off name" /></label>
              <label>Checkout Condition<input id="eq_checkout_condition" type="text" placeholder="Ready / worn / damaged" /></label>
              <label>Return Condition<input id="eq_return_condition" type="text" placeholder="Returned condition" /></label>
              <label style="display:flex;align-items:center;gap:8px;"><input id="eq_damage_reported" type="checkbox" /> Damage noted on return</label>
            </div>
            <label style="display:block;margin-top:12px;">Damage Notes
              <textarea id="eq_damage_notes" rows="2" placeholder="Describe cracks, dents, missing parts, or new wear found on return."></textarea>
            </label>
            <div class="grid" style="margin-top:12px;">
              <label>Checkout Photos<input id="eq_checkout_photos" type="file" accept="image/*" multiple /></label>
              <label>Return / Damage Photos<input id="eq_return_photos" type="file" accept="image/*" multiple /></label>
            </div>
            <div class="grid compact" style="margin-top:8px;">
              <div><strong>Checkout Evidence</strong><div id="eq_checkout_photo_preview" class="photo-preview-grid"></div></div>
              <div><strong>Return / Damage Evidence</strong><div id="eq_return_photo_preview" class="photo-preview-grid"></div></div>
            </div>
            <div class="grid" style="margin-top:12px;">
              <div class="signature-capture-block">
                <label style="display:block;">Worker Signature Capture</label>
                <canvas id="eq_worker_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_worker_signature_clear" class="secondary" type="button">Clear Worker Signature</button></div>
              </div>
              <div class="signature-capture-block">
                <label style="display:block;">Supervisor Signature Capture</label>
                <canvas id="eq_supervisor_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_supervisor_signature_clear" class="secondary" type="button">Clear Supervisor Signature</button></div>
              </div>
              <div class="signature-capture-block">
                <label style="display:block;">Admin Signature Capture</label>
                <canvas id="eq_admin_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_admin_signature_clear" class="secondary" type="button">Clear Admin Signature</button></div>
              </div>
            </div>
          </div>
          <div class="form-footer" style="margin-top:12px;">
            <button id="eq_save" class="primary" type="button">Save Equipment</button>
            <button id="eq_checkout" class="secondary" type="button">Check Out</button>
            <button id="eq_return" class="secondary" type="button">Return</button>
            <button id="eq_add_inspection" class="secondary" type="button">Record Inspection</button>
            <button id="eq_add_maintenance" class="secondary" type="button">Record Service</button>
            <button id="eq_lockout" class="secondary" type="button">Lockout</button>
            <button id="eq_clear_lockout" class="secondary" type="button">Clear Lockout</button>
          </div>
          <div id="equipment_access_notice" class="notice" style="display:none;margin-top:14px;"></div>
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
                <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Serial</th><th>Pool</th><th>Service Due</th><th>Inspection Due</th><th>Lockout</th><th>Action</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Checkout / Return History</h3>
            <div class="table-scroll">
              <table id="eq_history_table">
                <thead><tr><th>Equipment</th><th>Job</th><th>Out</th><th>Return</th><th>Worker</th><th>Supervisor</th><th>Admin</th><th>Condition</th><th>Photos</th><th>Damage</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;"><h3 style="margin-top:0;">Evidence Gallery</h3><button id="eq_retry_pending_uploads" class="secondary" type="button">Retry Pending Evidence Sync</button></div>
            <div id="eq_gallery_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
            <div id="eq_gallery" class="photo-preview-grid"><span class="muted">Select a history row gallery to view equipment evidence.</span></div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Inspection History</h3>
            <div class="table-scroll">
              <table id="eq_inspection_table">
                <thead><tr><th>Equipment</th><th>Date</th><th>Status</th><th>Inspector</th><th>Due</th><th>Notes</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Maintenance / Service History</h3>
            <div class="table-scroll">
              <table id="eq_maintenance_table">
                <thead><tr><th>Equipment</th><th>Date</th><th>Type</th><th>Provider</th><th>Cost</th><th>Notes</th></tr></thead>
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
        jobClear: $('#job_clear'),
        jobAccessNotice: $('#job_access_notice'),
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
        eqPoolKey: $('#eq_pool_key'),
        eqAssetTag: $('#eq_asset_tag'),
        eqManufacturer: $('#eq_manufacturer'),
        eqModel: $('#eq_model'),
        eqYear: $('#eq_year'),
        eqPurchaseDate: $('#eq_purchase_date'),
        eqPurchasePrice: $('#eq_purchase_price'),
        eqCondition: $('#eq_condition'),
        eqImageUrl: $('#eq_image_url'),
        eqServiceIntervalDays: $('#eq_service_interval_days'),
        eqLastServiceDate: $('#eq_last_service_date'),
        eqNextServiceDueDate: $('#eq_next_service_due_date'),
        eqLastInspectionAt: $('#eq_last_inspection_at'),
        eqNextInspectionDueDate: $('#eq_next_inspection_due_date'),
        eqDefectStatus: $('#eq_defect_status'),
        eqDefectNotes: $('#eq_defect_notes'),
        eqIsLockedOut: $('#eq_is_locked_out'),
        eqComments: $('#eq_comments'),
        eqAccessNotice: $('#equipment_access_notice'),
        eqWorkerSignature: $('#eq_worker_signature'),
        eqSupervisorSignature: $('#eq_supervisor_signature'),
        eqAdminSignature: $('#eq_admin_signature'),
        eqWorkerSignatureCanvas: $('#eq_worker_signature_canvas'),
        eqSupervisorSignatureCanvas: $('#eq_supervisor_signature_canvas'),
        eqAdminSignatureCanvas: $('#eq_admin_signature_canvas'),
        eqWorkerSignatureClear: $('#eq_worker_signature_clear'),
        eqSupervisorSignatureClear: $('#eq_supervisor_signature_clear'),
        eqAdminSignatureClear: $('#eq_admin_signature_clear'),
        eqCheckoutCondition: $('#eq_checkout_condition'),
        eqReturnCondition: $('#eq_return_condition'),
        eqDamageReported: $('#eq_damage_reported'),
        eqDamageNotes: $('#eq_damage_notes'),
        eqCheckoutPhotos: $('#eq_checkout_photos'),
        eqReturnPhotos: $('#eq_return_photos'),
        eqCheckoutPhotoPreview: $('#eq_checkout_photo_preview'),
        eqReturnPhotoPreview: $('#eq_return_photo_preview'),
        eqNotes: $('#eq_notes'),
        eqSave: $('#eq_save'),
        eqLoad: $('#eq_load'),
        eqClear: $('#eq_clear'),
        eqCheckout: $('#eq_checkout'),
        eqReturn: $('#eq_return'),
        eqAddInspection: $('#eq_add_inspection'),
        eqAddMaintenance: $('#eq_add_maintenance'),
        eqLockout: $('#eq_lockout'),
        eqClearLockout: $('#eq_clear_lockout'),
        eqSummary: $('#eq_summary'),
        eqListBody: $('#eq_list_table tbody'),
        eqPoolBody: $('#eq_pool_table tbody'),
        eqHistoryBody: $('#eq_history_table tbody'),
        eqGallery: $('#eq_gallery'),
        eqGallerySummary: $('#eq_gallery_summary'),
        eqRetryPendingUploads: $('#eq_retry_pending_uploads'),
        eqInspectionBody: $('#eq_inspection_table tbody'),
        eqMaintenanceBody: $('#eq_maintenance_table tbody')
      };
    }


    function initSignaturePads() {
      const e = els();
      const pairs = [
        ['worker', e.eqWorkerSignatureCanvas, e.eqWorkerSignatureClear],
        ['supervisor', e.eqSupervisorSignatureCanvas, e.eqSupervisorSignatureClear],
        ['admin', e.eqAdminSignatureCanvas, e.eqAdminSignatureClear]
      ];
      pairs.forEach(([key, canvas, clearBtn]) => {
        if (!canvas || typeof window.SignaturePad !== 'function') return;
        if (!state.signaturePads[key]) {
          state.signaturePads[key] = new window.SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.1 });
        }
        if (clearBtn && clearBtn.dataset.bound !== '1') {
          clearBtn.dataset.bound = '1';
          clearBtn.addEventListener('click', () => state.signaturePads[key]?.clear());
        }
      });
    }

    function clearSignaturePads() {
      Object.values(state.signaturePads).forEach((pad) => pad?.clear?.());
    }

    function collectSignaturePayload() {
      return {};
    }


    const EVIDENCE_QUEUE_KEY = 'ywi_equipment_evidence_queue_v1';

    function readEvidenceQueue() {
      try { return JSON.parse(localStorage.getItem(EVIDENCE_QUEUE_KEY) || '[]'); } catch { return []; }
    }
    function writeEvidenceQueue(items) {
      try { localStorage.setItem(EVIDENCE_QUEUE_KEY, JSON.stringify(Array.isArray(items) ? items : [])); } catch {}
    }
    function queueEvidenceUploads(items = [], reason = '') {
      if (!Array.isArray(items) || !items.length) return;
      const queue = readEvidenceQueue();
      const safe = items.map((item) => ({
        signoutId: item.signoutId,
        stage: item.stage || 'checkout',
        evidenceKind: item.evidenceKind || 'photo',
        signerRole: item.signerRole || '',
        caption: item.caption || '',
        equipmentItemId: item.equipmentItemId || '',
        jobId: item.jobId || '',
        fileName: item.file?.name || 'upload.png',
        fileType: item.file?.type || 'image/png',
        fileDataUrl: item.fileDataUrl || '',
        queuedAt: new Date().toISOString(),
        reason: String(reason || '')
      })).filter((item) => item.signoutId && item.fileDataUrl);
      writeEvidenceQueue(queue.concat(safe));
    }
    function queuedEvidenceCount() { return readEvidenceQueue().length; }
    async function retryPendingEvidenceUploads() {
      const queue = readEvidenceQueue();
      if (!queue.length) return { retried: 0, remaining: 0 };
      let retried = 0;
      const remaining = [];
      for (const item of queue) {
        try {
          const file = dataUrlToFile(item.fileDataUrl, item.fileName || 'upload.png');
          await api.uploadEquipmentEvidenceBatch([{ signoutId: item.signoutId, stage: item.stage, evidenceKind: item.evidenceKind, signerRole: item.signerRole, caption: item.caption, equipmentItemId: item.equipmentItemId, jobId: item.jobId, file }]);
          retried += 1;
        } catch {
          remaining.push(item);
        }
      }
      writeEvidenceQueue(remaining);
      return { retried, remaining: remaining.length };
    }

    function dataUrlToFile(dataUrl, fileName) {
      const parts = String(dataUrl || '').split(',');
      const header = parts[0] || '';
      const body = parts[1] || '';
      const mimeMatch = header.match(/data:([^;]+);base64/i);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], fileName, { type: mimeType });
    }

    async function uploadEquipmentEvidence(signoutId, stage) {
      if (!signoutId || !api?.uploadEquipmentEvidenceBatch) return [];
      const uploads = [];
      const photoFiles = stage === 'checkout' ? state.checkoutPhotoFiles : state.returnPhotoFiles;
      photoFiles.forEach((file, index) => uploads.push({ signoutId, stage, evidenceKind: 'photo', caption: `${stage} evidence ${index + 1}`, file }));
      ['worker','supervisor','admin'].forEach((role) => {
        const pad = state.signaturePads[role];
        if (pad && !pad.isEmpty()) {
          uploads.push({ signoutId, stage, evidenceKind: 'signature', signerRole: role, caption: `${stage} ${role} signature`, file: dataUrlToFile(pad.toDataURL('image/png'), `${stage}-${role}-signature.png`) });
        }
      });
      if (!uploads.length) return [];
      try {
        return await api.uploadEquipmentEvidenceBatch(uploads);
      } catch (err) {
        const uploadsWithData = await Promise.all(uploads.map(async (item) => ({ ...item, fileDataUrl: await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Failed to read ${item.file?.name || 'evidence file'}`));
          reader.readAsDataURL(item.file);
        }) })));
        queueEvidenceUploads(uploadsWithData, err?.message || 'upload_failed');
        throw err;
      }
    }

    function normalizePhotoList(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          return value ? [value] : [];
        }
      }
      return [];
    }

    function renderPhotoPreviews() {
      const e = els();
      const renderInto = (host, items) => {
        if (!host) return;
        host.innerHTML = normalizePhotoList(items).map((src) => `<a href="${escHtml(src)}" target="_blank" rel="noopener"><img src="${escHtml(src)}" alt="Evidence photo" class="evidence-thumb" /></a>`).join('') || '<span class="muted">No photos selected.</span>';
      };
      renderInto(e.eqCheckoutPhotoPreview, state.checkoutPhotos);
      renderInto(e.eqReturnPhotoPreview, state.returnPhotos);
    }

    function filesToDataUrls(fileList) {
      const files = Array.from(fileList || []).filter((file) => /^image\//i.test(file.type || ''));
      return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(`Failed to read image ${file.name}`));
        reader.readAsDataURL(file);
      })));
    }

    async function handleEvidenceFiles(input, bucket) {
      const files = input?.files;
      if (!files?.length) return;
      state[bucket] = await filesToDataUrls(files);
      state[bucket === 'checkoutPhotos' ? 'checkoutPhotoFiles' : 'returnPhotoFiles'] = Array.from(files);
      renderPhotoPreviews();
    }

    async function runConnectionDiagnostics(targetEl) {
      if (!api?.diagnoseConnections) return;
      try {
        const diag = await api.diagnoseConnections();
        const failed = (diag.checks || []).filter((row) => !row.ok);
        if (failed.length) setNotice(targetEl, failed.map((row) => row.message).join(' '), true);
      } catch (err) {
        setNotice(targetEl, err?.message || 'Connection diagnostics failed.', true);
      }
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
      const access = getAccessProfile(getCurrentRole());
      const allowed = !!access.canManageJobs || !!access.canManageAdminDirectory;
      if (e.jobsSection) e.jobsSection.style.display = '';
      if (e.equipmentSection) e.equipmentSection.style.display = '';
      setNotice(
        e.jobAccessNotice,
        allowed
          ? 'You can manage jobs from this screen.'
          : 'You can view the Jobs area, but your role cannot create or edit jobs yet. Ask a supervisor, job admin, or admin for access.',
        !allowed
      );
      setNotice(
        e.eqAccessNotice,
        allowed
          ? 'You can manage equipment from this screen.'
          : 'You can view the Equipment area, but your role cannot check out, return, or edit equipment yet. Ask a supervisor, job admin, or admin for access.',
        !allowed
      );
      document.body.dataset.canApproveJobs = canApprove() ? 'true' : 'false';
      syncActionLocks();
    }


    function syncActionLocks() {
      const allowed = canManage();
      const editableIds = [
        'job_code','job_name','job_site_name','job_type','job_status','job_priority','job_start_date','job_end_date',
        'job_supervisor_name','job_signing_supervisor_name','job_admin_name','job_client_name','job_notes',
        'eq_code','eq_name','eq_category','eq_pool_key','eq_home_site','eq_status','eq_current_job_code','eq_assigned_supervisor',
        'eq_serial','eq_asset_tag','eq_manufacturer','eq_model','eq_year','eq_purchase_date','eq_purchase_price','eq_condition',
        'eq_image_url','eq_service_interval_days','eq_last_service_date','eq_next_service_due_date','eq_last_inspection_at',
        'eq_next_inspection_due_date','eq_defect_status','eq_defect_notes','eq_is_locked_out','eq_comments','eq_notes',
        'eq_worker_signature','eq_supervisor_signature','eq_admin_signature','eq_checkout_condition','eq_return_condition','eq_damage_notes','eq_damage_reported','eq_checkout_photos','eq_return_photos'
      ];
      editableIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !allowed;
      });
      ['job_add_equipment','job_request_approval','job_save','job_clear','eq_save','eq_checkout','eq_return','eq_add_inspection','eq_add_maintenance','eq_lockout','eq_clear_lockout','eq_clear'].forEach((id)=>{
        const el = document.getElementById(id);
        if (el) el.disabled = !allowed;
      });
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
      const lockedApproval = !canApprove();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="job-eq-name" placeholder="Harness / Lift / specific asset" value="${escHtml(row.equipment_name || row.name || '')}"></td>
        <td><input type="text" class="job-eq-pool" placeholder="pool key" value="${escHtml(row.equipment_pool_key || row.pool_key || '')}"></td>
        <td><input type="number" class="job-eq-needed" min="1" step="1" value="${escHtml(row.needed_qty ?? 1)}"></td>
        <td><input type="number" class="job-eq-reserved" min="0" step="1" value="${escHtml(row.reserved_qty ?? 0)}"></td>
        <td>
          <select class="job-eq-approval" ${lockedApproval ? 'disabled' : ''}>
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


    function safeLocalSet(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }

    function safeLocalGet(key) {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    }

    function saveJobDraft() {
      const e = els();
      safeLocalSet(JOB_DRAFT_KEY, {
        job_code: e.jobCode?.value || '',
        job_name: e.jobName?.value || '',
        site_name: e.jobSiteName?.value || '',
        job_type: e.jobType?.value || '',
        status: e.jobStatus?.value || '',
        priority: e.jobPriority?.value || '',
        start_date: e.jobStartDate?.value || '',
        end_date: e.jobEndDate?.value || '',
        supervisor_name: e.jobSupervisorName?.value || '',
        signing_supervisor_name: e.jobSigningSupervisorName?.value || '',
        admin_name: e.jobAdminName?.value || '',
        client_name: e.jobClientName?.value || '',
        notes: e.jobNotes?.value || '',
        request_approval: !!e.jobRequestApproval?.checked,
        requirements: collectRequirements()
      });
    }

    function saveEquipmentDraft() {
      const e = els();
      safeLocalSet(EQUIPMENT_DRAFT_KEY, {
        equipment_code: e.eqCode?.value || '',
        equipment_name: e.eqName?.value || '',
        category: e.eqCategory?.value || '',
        equipment_pool_key: e.eqPoolKey?.value || '',
        home_site: e.eqHomeSite?.value || '',
        status: e.eqStatus?.value || '',
        current_job_code: e.eqCurrentJobCode?.value || '',
        assigned_supervisor_name: e.eqAssignedSupervisor?.value || '',
        serial_number: e.eqSerial?.value || '',
        asset_tag: e.eqAssetTag?.value || '',
        manufacturer: e.eqManufacturer?.value || '',
        model_number: e.eqModel?.value || '',
        purchase_year: e.eqYear?.value || '',
        purchase_date: e.eqPurchaseDate?.value || '',
        purchase_price: e.eqPurchasePrice?.value || '',
        condition_status: e.eqCondition?.value || '',
        image_url: e.eqImageUrl?.value || '',
        service_interval_days: e.eqServiceIntervalDays?.value || '',
        last_service_date: e.eqLastServiceDate?.value || '',
        next_service_due_date: e.eqNextServiceDueDate?.value || '',
        last_inspection_at: e.eqLastInspectionAt?.value || '',
        next_inspection_due_date: e.eqNextInspectionDueDate?.value || '',
        defect_status: e.eqDefectStatus?.value || '',
        defect_notes: e.eqDefectNotes?.value || '',
        is_locked_out: !!e.eqIsLockedOut?.checked,
        comments: e.eqComments?.value || '',
        notes: e.eqNotes?.value || '',
        worker_signature_name: e.eqWorkerSignature?.value || '',
        supervisor_signature_name: e.eqSupervisorSignature?.value || '',
        admin_signature_name: e.eqAdminSignature?.value || '',
        checkout_condition: e.eqCheckoutCondition?.value || '',
        return_condition: e.eqReturnCondition?.value || '',
        damage_reported: !!e.eqDamageReported?.checked,
        damage_notes: e.eqDamageNotes?.value || ''
      });
    }

    function restoreDrafts() {
      const e = els();
      const jobDraft = safeLocalGet(JOB_DRAFT_KEY);
      const eqDraft = safeLocalGet(EQUIPMENT_DRAFT_KEY);
      if (jobDraft && !state.editingJobId && !e.jobCode?.value && !state.jobs.length) {
        e.jobCode.value = jobDraft.job_code || '';
        e.jobName.value = jobDraft.job_name || '';
        e.jobSiteName.value = jobDraft.site_name || '';
        e.jobType.value = jobDraft.job_type || '';
        e.jobStatus.value = jobDraft.status || 'planned';
        e.jobPriority.value = jobDraft.priority || 'normal';
        e.jobStartDate.value = jobDraft.start_date || '';
        e.jobEndDate.value = jobDraft.end_date || '';
        e.jobSupervisorName.value = jobDraft.supervisor_name || '';
        e.jobSigningSupervisorName.value = jobDraft.signing_supervisor_name || '';
        e.jobAdminName.value = jobDraft.admin_name || '';
        e.jobClientName.value = jobDraft.client_name || '';
        e.jobNotes.value = jobDraft.notes || '';
        e.jobRequestApproval.checked = !!jobDraft.request_approval;
        if (e.jobEquipmentBody) e.jobEquipmentBody.innerHTML = '';
        (Array.isArray(jobDraft.requirements) && jobDraft.requirements.length ? jobDraft.requirements : [{ needed_qty: 1, reserved_qty: 0 }]).forEach(addEquipmentRequirementRow);
        setNotice(e.jobSummary, 'Recovered unsaved job draft from this device.');
      }
      if (eqDraft && !state.editingEquipmentCode && !e.eqCode?.value && !state.equipment.length) {
        e.eqCode.value = eqDraft.equipment_code || '';
        e.eqName.value = eqDraft.equipment_name || '';
        e.eqCategory.value = eqDraft.category || '';
        e.eqPoolKey.value = eqDraft.equipment_pool_key || '';
        e.eqHomeSite.value = eqDraft.home_site || '';
        e.eqStatus.value = eqDraft.status || 'available';
        e.eqCurrentJobCode.value = eqDraft.current_job_code || '';
        e.eqAssignedSupervisor.value = eqDraft.assigned_supervisor_name || '';
        e.eqSerial.value = eqDraft.serial_number || '';
        e.eqAssetTag.value = eqDraft.asset_tag || '';
        e.eqManufacturer.value = eqDraft.manufacturer || '';
        e.eqModel.value = eqDraft.model_number || '';
        e.eqYear.value = eqDraft.purchase_year || '';
        e.eqPurchaseDate.value = eqDraft.purchase_date || '';
        e.eqPurchasePrice.value = eqDraft.purchase_price || '';
        e.eqCondition.value = eqDraft.condition_status || 'ready';
        e.eqImageUrl.value = eqDraft.image_url || '';
        e.eqServiceIntervalDays.value = eqDraft.service_interval_days || '';
        e.eqLastServiceDate.value = eqDraft.last_service_date || '';
        e.eqNextServiceDueDate.value = eqDraft.next_service_due_date || '';
        e.eqLastInspectionAt.value = eqDraft.last_inspection_at || '';
        e.eqNextInspectionDueDate.value = eqDraft.next_inspection_due_date || '';
        e.eqDefectStatus.value = eqDraft.defect_status || 'clear';
        e.eqDefectNotes.value = eqDraft.defect_notes || '';
        e.eqIsLockedOut.checked = !!eqDraft.is_locked_out;
        e.eqComments.value = eqDraft.comments || '';
        e.eqNotes.value = eqDraft.notes || '';
        e.eqWorkerSignature.value = eqDraft.worker_signature_name || '';
        e.eqSupervisorSignature.value = eqDraft.supervisor_signature_name || '';
        e.eqAdminSignature.value = eqDraft.admin_signature_name || '';
        e.eqCheckoutCondition.value = eqDraft.checkout_condition || '';
        e.eqReturnCondition.value = eqDraft.return_condition || '';
        e.eqDamageReported.checked = !!eqDraft.damage_reported;
        e.eqDamageNotes.value = eqDraft.damage_notes || '';
        setNotice(e.eqSummary, 'Recovered unsaved equipment draft from this device.');
      }
    }

    function clearDrafts(kind = 'all') {
      try {
        if (kind === 'all' || kind === 'job') localStorage.removeItem(JOB_DRAFT_KEY);
        if (kind === 'all' || kind === 'equipment') localStorage.removeItem(EQUIPMENT_DRAFT_KEY);
      } catch {}
    }

    function clearJobForm() {
      const e = els();
      state.editingJobId = null;
      [e.jobCode, e.jobName, e.jobType, e.jobStatus, e.jobPriority, e.jobStartDate, e.jobEndDate, e.jobSupervisorName, e.jobSigningSupervisorName, e.jobAdminName, e.jobClientName].forEach((el) => { if (el) el.value = ''; });
      if (e.jobStatus) e.jobStatus.value = 'planned';
      if (e.jobPriority) e.jobPriority.value = 'normal';
      if (e.jobSiteName) e.jobSiteName.value = '';
      if (e.jobNotes) e.jobNotes.value = '';
      if (e.jobRequestApproval) e.jobRequestApproval.checked = false;
      if (e.jobEquipmentBody) e.jobEquipmentBody.innerHTML = '';
      addEquipmentRequirementRow({ needed_qty: 1, reserved_qty: 0 });
      clearDrafts('job');
      setNotice(e.jobSummary, 'Ready for a new job entry.');
    }

    function clearEquipmentForm() {
      const e = els();
      state.editingEquipmentCode = '';
      [e.eqCode, e.eqName, e.eqCategory, e.eqStatus, e.eqCurrentJobCode, e.eqAssignedSupervisor, e.eqSerial, e.eqPoolKey, e.eqAssetTag, e.eqManufacturer, e.eqModel, e.eqYear, e.eqPurchaseDate, e.eqPurchasePrice, e.eqCondition, e.eqImageUrl, e.eqComments, e.eqWorkerSignature, e.eqSupervisorSignature, e.eqAdminSignature, e.eqCheckoutCondition, e.eqReturnCondition, e.eqDamageNotes].forEach((el) => { if (el) el.value = ''; });
      if (e.eqStatus) e.eqStatus.value = 'available';
      if (e.eqCondition) e.eqCondition.value = 'ready';
      if (e.eqHomeSite) e.eqHomeSite.value = '';
      if (e.eqDamageReported) e.eqDamageReported.checked = false;
      if (e.eqNotes) e.eqNotes.value = '';
      state.checkoutPhotos = [];
      state.returnPhotos = [];
      state.checkoutPhotoFiles = [];
      state.returnPhotoFiles = [];
      if (e.eqCheckoutPhotos) e.eqCheckoutPhotos.value = '';
      if (e.eqReturnPhotos) e.eqReturnPhotos.value = '';
      renderPhotoPreviews();
      clearSignaturePads();
      clearDrafts('equipment');
      setNotice(e.eqSummary, 'Ready for a new equipment entry.');
    }

    function loadJobIntoForm(jobRow) {
      const e = els();
      if (!jobRow) return;
      state.editingJobId = jobRow.id;
      e.jobCode.value = jobRow.job_code || '';
      e.jobName.value = jobRow.job_name || '';
      e.jobSiteName.value = jobRow.site_code || jobRow.site_name || '';
      e.jobType.value = jobRow.job_type || '';
      e.jobStatus.value = jobRow.status || 'planned';
      e.jobPriority.value = jobRow.priority || 'normal';
      e.jobStartDate.value = jobRow.start_date || '';
      e.jobEndDate.value = jobRow.end_date || '';
      e.jobSupervisorName.value = jobRow.supervisor_name || '';
      e.jobSigningSupervisorName.value = jobRow.signing_supervisor_name || '';
      e.jobAdminName.value = jobRow.admin_name || '';
      e.jobClientName.value = jobRow.client_name || '';
      e.jobNotes.value = jobRow.notes || '';
      e.jobRequestApproval.checked = ['requested','pending'].includes(String(jobRow.approval_status || '').toLowerCase());
      e.jobEquipmentBody.innerHTML = '';
      const reqs = state.requirements.filter((row) => Number(row.job_id) === Number(jobRow.id));
      (reqs.length ? reqs : [{ needed_qty: 1, reserved_qty: 0 }]).forEach(addEquipmentRequirementRow);
      setNotice(e.jobSummary, `Loaded job ${jobRow.job_code} into the form for editing.`);
      window.YWIRouter?.showSection?.('jobs', { skipFocus: true });
    }

    function loadEquipmentIntoForm(row) {
      const e = els();
      if (!row) return;
      state.editingEquipmentCode = row.equipment_code || '';
      e.eqCode.value = row.equipment_code || '';
      e.eqName.value = row.equipment_name || '';
      e.eqCategory.value = row.category || '';
      e.eqHomeSite.value = row.home_site_code || row.home_site_name || '';
      e.eqStatus.value = row.status || 'available';
      e.eqCurrentJobCode.value = row.current_job_code || '';
      e.eqAssignedSupervisor.value = row.assigned_supervisor_name || '';
      e.eqSerial.value = row.serial_number || '';
      e.eqPoolKey.value = row.equipment_pool_key || '';
      e.eqAssetTag.value = row.asset_tag || '';
      e.eqManufacturer.value = row.manufacturer || '';
      e.eqModel.value = row.model_number || '';
      e.eqYear.value = row.purchase_year || '';
      e.eqPurchaseDate.value = row.purchase_date || '';
      e.eqPurchasePrice.value = row.purchase_price ?? '';
      e.eqCondition.value = row.condition_status || 'ready';
      e.eqImageUrl.value = row.image_url || '';
      e.eqComments.value = row.comments || '';
      e.eqNotes.value = row.notes || '';
      clearSignaturePads();
      setNotice(e.eqSummary, `Loaded equipment ${row.equipment_code} into the form for editing.`);
      window.YWIRouter?.showSection?.('equipment', { skipFocus: true });
    }

    function renderJobs() {
      const e = els();
      if (!e.jobListBody) return;
      e.jobListBody.innerHTML = '';
      state.jobs.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escHtml(row.job_code)}</td><td>${escHtml(row.job_name)}</td><td>${escHtml(row.site_name || row.site_code || '')}</td><td>${escHtml(row.status || '')}</td><td>${escHtml(row.approval_status || '')}</td><td>${escHtml(row.start_date || '')}${row.end_date ? ` → ${escHtml(row.end_date)}` : ''}</td><td><button type="button" class="secondary" data-job-load="${escHtml(row.id)}">Load</button></td>`;
        e.jobListBody.appendChild(tr);
      });
    }



    function renderGallery(signoutId = null) {
      const e = els();
      if (!e.eqGallery) return;
      const row = state.signouts.find((item) => Number(item.id) === Number(signoutId || state.selectedGallerySignoutId));
      if (!row || !Array.isArray(row.evidence_assets) || !row.evidence_assets.length) {
        e.eqGallery.innerHTML = '<span class="muted">Select a history row gallery to view equipment evidence.</span>';
        setNotice(e.eqGallerySummary, signoutId ? 'No evidence assets were found for that checkout / return record.' : '');
        return;
      }
      state.selectedGallerySignoutId = Number(row.id);
      e.eqGallery.innerHTML = `
        <div class="form-footer" style="margin-bottom:10px;">
          <button type="button" class="secondary" data-gallery-select-all="1">Select all</button>
          <button type="button" class="secondary" data-gallery-bulk-delete="${escHtml(row.id)}">Delete selected</button>
        </div>
      ` + row.evidence_assets.map((asset) => `
        <div class="evidence-asset-card">
          <label class="muted" style="display:flex;gap:6px;align-items:center;font-size:12px;"><input type="checkbox" data-gallery-asset="${escHtml(asset.id)}" />Select</label>
          <a href="${escHtml(asset.public_url || asset.storage_path || '#')}" target="_blank" rel="noopener">
            <img src="${escHtml(asset.public_url || asset.storage_path || '')}" alt="${escHtml(asset.caption || asset.evidence_kind || 'Evidence asset')}" class="evidence-thumb" />
          </a>
          <div class="muted" style="font-size:12px;">${escHtml(asset.stage || '')} • ${escHtml(asset.evidence_kind || '')} ${asset.signer_role ? `• ${escHtml(asset.signer_role)}` : ''}</div>
          <div class="muted" style="font-size:12px;">${escHtml(asset.caption || '')}</div>
          <div class="muted" style="font-size:12px;">Progress: Ready</div>
          <div class="form-footer" style="margin-top:8px;">
            <label class="secondary" style="cursor:pointer;">Replace<input type="file" accept="image/*" data-replace-evidence="${escHtml(asset.id)}" data-signout-id="${escHtml(row.id)}" data-stage="${escHtml(asset.stage || 'return')}" data-kind="${escHtml(asset.evidence_kind || 'photo')}" data-role="${escHtml(asset.signer_role || '')}" style="display:none;" /></label>
            <button type="button" class="secondary" data-delete-evidence="${escHtml(asset.id)}">Delete</button>
          </div>
        </div>
      `).join('');
      setNotice(e.eqGallerySummary, `Viewing ${row.evidence_assets.length} evidence asset(s) for ${row.equipment_code || row.equipment_item_id}. Use Select all and Delete selected for bulk cleanup.${queuedEvidenceCount() ? ` Pending offline uploads: ${queuedEvidenceCount()}.` : ''}`);
    }

    function renderEquipment() {
      const e = els();
      if (e.eqListBody) {
        e.eqListBody.innerHTML = '';
        state.equipment.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code)}</td><td>${escHtml(row.equipment_name)}</td><td>${escHtml(row.status)}</td><td>${escHtml(row.serial_number || '')}</td><td>${escHtml(row.equipment_pool_key || '')}</td><td>${escHtml(row.next_service_due_date || '')}</td><td>${escHtml(row.next_inspection_due_date || '')}</td><td>${row.is_locked_out ? 'Yes' : 'No'}</td><td><button type="button" class="secondary" data-equipment-load="${escHtml(row.equipment_code)}">Load</button></td>`;
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
      if (e.eqHistoryBody) {
        e.eqHistoryBody.innerHTML = '';
        state.signouts.forEach((row) => {
          const tr = document.createElement('tr');
          const photoCount = Number(row.checkout_photo_count || 0) + Number(row.return_photo_count || 0);
          tr.innerHTML = `<td>${escHtml(row.equipment_code || row.equipment_item_id || '')}</td><td>${escHtml(row.job_code || row.job_id || '')}</td><td>${escHtml(row.checked_out_at || '')}</td><td>${escHtml(row.returned_at || '')}</td><td>${escHtml(row.checkout_worker_signature_name || row.return_worker_signature_name || '')}</td><td>${escHtml(row.checkout_supervisor_signature_name || row.return_supervisor_signature_name || '')}</td><td>${escHtml(row.checkout_admin_signature_name || row.return_admin_signature_name || '')}</td><td>${escHtml(row.checkout_condition || '')}${row.return_condition ? ` → ${escHtml(row.return_condition)}` : ''}</td><td>${photoCount ? `<button type="button" class="secondary" data-view-gallery="${escHtml(row.id)}">View (${photoCount})</button>` : '—'}</td><td>${row.damage_reported ? escHtml(row.damage_notes || 'Damage noted') : '—'}</td>`;
          e.eqHistoryBody.appendChild(tr);
        });
      }
      if (e.eqInspectionBody) {
        e.eqInspectionBody.innerHTML = '';
        state.inspections.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code || '')}</td><td>${escHtml(row.inspected_at || '')}</td><td>${escHtml(row.inspection_status || '')}</td><td>${escHtml(row.inspector_name || '')}</td><td>${escHtml(row.next_due_date || '')}</td><td>${escHtml(row.notes || '')}</td>`;
          e.eqInspectionBody.appendChild(tr);
        });
      }
      renderGallery();
      if (e.eqMaintenanceBody) {
        e.eqMaintenanceBody.innerHTML = '';
        state.maintenance.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code || '')}</td><td>${escHtml(row.performed_at || '')}</td><td>${escHtml(row.maintenance_type || '')}</td><td>${escHtml(row.provider_name || '')}</td><td>${escHtml(row.cost_amount || '')}</td><td>${escHtml(row.notes || '')}</td>`;
          e.eqMaintenanceBody.appendChild(tr);
        });
      }
    }



    async function deleteEvidenceAsset(assetId) {
      if (!assetId) return;
      setNotice(els().eqGallerySummary, 'Deleting evidence asset…');
      await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      await loadData();
      renderGallery(state.selectedGallerySignoutId);
    }

    async function bulkDeleteEvidenceAssets(signoutId) {
      const selected = Array.from(document.querySelectorAll('[data-gallery-asset]:checked')).map((el) => Number(el.value || el.dataset.galleryAsset || 0)).filter(Boolean);
      if (!selected.length) {
        setNotice(els().eqGallerySummary, 'Select one or more evidence assets first.');
        return;
      }
      setNotice(els().eqGallerySummary, `Deleting ${selected.length} selected evidence asset(s)…`);
      for (const assetId of selected) {
        await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      }
      await loadData();
      renderGallery(signoutId || state.selectedGallerySignoutId);
    }

    async function replaceEvidenceAsset(inputEl) {
      const file = inputEl?.files?.[0];
      if (!file) return;
      const assetId = Number(inputEl.dataset.replaceEvidence || 0);
      const signoutId = Number(inputEl.dataset.signoutId || 0);
      if (!assetId || !signoutId) return;
      setNotice(els().eqGallerySummary, 'Replacing evidence asset… Upload in progress.');
      await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      await api.uploadEquipmentEvidenceBatch([{ signoutId, stage: inputEl.dataset.stage || 'return', evidenceKind: inputEl.dataset.kind || 'photo', signerRole: inputEl.dataset.role || '', caption: 'Replacement evidence upload', file }]);
      await loadData();
      renderGallery(signoutId);
      setNotice(els().eqGallerySummary, 'Evidence asset replaced successfully.');
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
        state.inspections = Array.isArray(resp?.inspections) ? resp.inspections : [];
        state.maintenance = Array.isArray(resp?.maintenance) ? resp.maintenance : [];
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
        clearDrafts('job');
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
          equipment_pool_key: e.eqPoolKey?.value?.trim?.() || '',
          asset_tag: e.eqAssetTag?.value?.trim?.() || '',
          manufacturer: e.eqManufacturer?.value?.trim?.() || '',
          model_number: e.eqModel?.value?.trim?.() || '',
          purchase_year: e.eqYear?.value ? Number(e.eqYear.value) : null,
          purchase_date: e.eqPurchaseDate?.value || null,
          purchase_price: e.eqPurchasePrice?.value ? Number(e.eqPurchasePrice.value) : null,
          condition_status: e.eqCondition?.value?.trim?.() || '',
          image_url: e.eqImageUrl?.value?.trim?.() || '',
          service_interval_days: e.eqServiceIntervalDays?.value ? Number(e.eqServiceIntervalDays.value) : null,
          last_service_date: e.eqLastServiceDate?.value || null,
          next_service_due_date: e.eqNextServiceDueDate?.value || null,
          last_inspection_at: e.eqLastInspectionAt?.value || null,
          next_inspection_due_date: e.eqNextInspectionDueDate?.value || null,
          defect_status: e.eqDefectStatus?.value?.trim?.() || 'clear',
          defect_notes: e.eqDefectNotes?.value?.trim?.() || '',
          is_locked_out: !!e.eqIsLockedOut?.checked,
          comments: e.eqComments?.value?.trim?.() || '',
          notes: e.eqNotes?.value?.trim?.() || ''
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Equipment save failed');
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} saved.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Failed to save equipment.', true);
      }
    }

    async function checkoutEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'checkout', equipment_code: e.eqCode?.value?.trim?.() || '', job_code: e.eqCurrentJobCode?.value?.trim?.() || '', supervisor_name: e.eqAssignedSupervisor?.value?.trim?.() || '', worker_signature_name: e.eqWorkerSignature?.value?.trim?.() || '', supervisor_signature_name: e.eqSupervisorSignature?.value?.trim?.() || '', admin_signature_name: e.eqAdminSignature?.value?.trim?.() || '', checkout_condition: e.eqCheckoutCondition?.value?.trim?.() || '', notes: e.eqNotes?.value?.trim?.() || '', ...collectSignaturePayload() });
        if (!resp?.ok) throw new Error(resp?.error || 'Checkout failed');
        try { await uploadEquipmentEvidence(resp?.signout_id || resp?.record?.id, 'checkout'); } catch (uploadErr) { setNotice(e.eqSummary, `Equipment checked out, but evidence upload failed: ${uploadErr?.message || uploadErr}`, true); }
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} checked out.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Checkout failed.', true);
      }
    }

    async function returnEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'return', equipment_code: e.eqCode?.value?.trim?.() || '', worker_signature_name: e.eqWorkerSignature?.value?.trim?.() || '', supervisor_signature_name: e.eqSupervisorSignature?.value?.trim?.() || '', admin_signature_name: e.eqAdminSignature?.value?.trim?.() || '', return_condition: e.eqReturnCondition?.value?.trim?.() || '', return_notes: e.eqNotes?.value?.trim?.() || '', damage_reported: !!e.eqDamageReported?.checked, damage_notes: e.eqDamageNotes?.value?.trim?.() || '', ...collectSignaturePayload() });
        if (!resp?.ok) throw new Error(resp?.error || 'Return failed');
        try { await uploadEquipmentEvidence(resp?.signout_id || resp?.record?.id, 'return'); } catch (uploadErr) { setNotice(e.eqSummary, `Equipment returned, but evidence upload failed: ${uploadErr?.message || uploadErr}`, true); }
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} returned.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Return failed.', true);
      }
    }


    async function recordInspection() {
      const e = els();
      try {
        const inspection_status = window.prompt('Inspection status (pass / fail / needs_service):', e.eqDefectStatus?.value || 'pass') || 'pass';
        const notes = window.prompt('Inspection notes:', e.eqDefectNotes?.value || '') || '';
        const next_due_date = window.prompt('Next inspection due date (YYYY-MM-DD):', e.eqNextInspectionDueDate?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'inspect', equipment_code: e.eqCode?.value?.trim?.() || '', inspection_status, notes, next_due_date });
        if (!resp?.ok) throw new Error(resp?.error || 'Inspection save failed');
        setNotice(e.eqSummary, `Inspection recorded for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Inspection save failed.', true);
      }
    }

    async function recordMaintenance() {
      const e = els();
      try {
        const maintenance_type = window.prompt('Service type:', 'service') || 'service';
        const provider_name = window.prompt('Provider / technician:', '') || '';
        const cost_amount = window.prompt('Cost amount:', '') || '';
        const performed_at = window.prompt('Performed date (YYYY-MM-DD):', e.eqLastServiceDate?.value || '') || '';
        const next_due_date = window.prompt('Next service due date (YYYY-MM-DD):', e.eqNextServiceDueDate?.value || '') || '';
        const notes = window.prompt('Service notes:', e.eqNotes?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'maintenance', equipment_code: e.eqCode?.value?.trim?.() || '', maintenance_type, provider_name, cost_amount, performed_at, next_due_date, notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Maintenance save failed');
        setNotice(e.eqSummary, `Maintenance recorded for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Maintenance save failed.', true);
      }
    }

    async function setLockout(isLocked) {
      const e = els();
      try {
        const notes = window.prompt(isLocked ? 'Lockout reason:' : 'Clear lockout notes:', e.eqDefectNotes?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: isLocked ? 'defect_lockout' : 'defect_clear', equipment_code: e.eqCode?.value?.trim?.() || '', notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Lockout update failed');
        setNotice(e.eqSummary, isLocked ? `Equipment ${e.eqCode?.value || ''} locked out.` : `Lockout cleared for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Lockout update failed.', true);
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
      const allowApprove = canApprove();
      const allowRequest = canManage();
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
                      ${allowRequest ? `<button type="button" class="secondary" data-requirement-action="request_approval" data-id="${escHtml(row.id)}">Request</button>` : ''}
                      ${allowApprove ? `<button type="button" class="secondary" data-requirement-action="approve" data-id="${escHtml(row.id)}">Approve</button>` : ''}
                      ${allowApprove ? `<button type="button" class="secondary" data-requirement-action="reject" data-id="${escHtml(row.id)}">Reject</button>` : ''}
                      ${!allowApprove && !allowRequest ? `<span class="muted">View only</span>` : ''}
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
        const action = btn.getAttribute('data-requirement-action');
        if ((action === 'approve' || action === 'reject') && !canApprove()) {
          setNotice(e.jobSummary, 'Admin access is required for requirement approvals.', true);
          return;
        }
        if (action === 'request_approval' && !canManage()) {
          setNotice(e.jobSummary, 'Supervisor+ access is required to request approval.', true);
          return;
        }
        updateRequirementApproval(btn.getAttribute('data-id'), action);
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
      if (e.jobListBody && e.jobListBody.dataset.bound !== '1') {
        e.jobListBody.dataset.bound = '1';
        e.jobListBody.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-job-load]');
          if (!btn) return;
          const row = state.jobs.find((job) => String(job.id) === String(btn.getAttribute('data-job-load')));
          loadJobIntoForm(row);
        });
      }
      if (e.eqListBody && e.eqListBody.dataset.bound !== '1') {
        e.eqListBody.dataset.bound = '1';
        e.eqListBody.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-equipment-load]');
          if (!btn) return;
          const row = state.equipment.find((item) => String(item.equipment_code) === String(btn.getAttribute('data-equipment-load')));
          loadEquipmentIntoForm(row);
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
      if (e.jobClear && e.jobClear.dataset.bound !== '1') {
        e.jobClear.dataset.bound = '1';
        e.jobClear.addEventListener('click', clearJobForm);
      }
      if (e.eqSave && e.eqSave.dataset.bound !== '1') {
        e.eqSave.dataset.bound = '1';
        e.eqSave.addEventListener('click', saveEquipment);
      }
      if (e.eqLoad && e.eqLoad.dataset.bound !== '1') {
        e.eqLoad.dataset.bound = '1';
        e.eqLoad.addEventListener('click', loadData);
      }
      if (e.eqClear && e.eqClear.dataset.bound !== '1') {
        e.eqClear.dataset.bound = '1';
        e.eqClear.addEventListener('click', clearEquipmentForm);
      }
      if (e.eqCheckout && e.eqCheckout.dataset.bound !== '1') {
        e.eqCheckout.dataset.bound = '1';
        e.eqCheckout.addEventListener('click', checkoutEquipment);
      }
      if (e.eqReturn && e.eqReturn.dataset.bound !== '1') {
        e.eqReturn.dataset.bound = '1';
        e.eqReturn.addEventListener('click', returnEquipment);
      }
      if (e.eqAddInspection && e.eqAddInspection.dataset.bound !== '1') {
        e.eqAddInspection.dataset.bound = '1';
        e.eqAddInspection.addEventListener('click', recordInspection);
      }
      if (e.eqAddMaintenance && e.eqAddMaintenance.dataset.bound !== '1') {
        e.eqAddMaintenance.dataset.bound = '1';
        e.eqAddMaintenance.addEventListener('click', recordMaintenance);
      }
      if (e.eqLockout && e.eqLockout.dataset.bound !== '1') {
        e.eqLockout.dataset.bound = '1';
        e.eqLockout.addEventListener('click', () => setLockout(true));
      }
      if (e.eqClearLockout && e.eqClearLockout.dataset.bound !== '1') {
        e.eqClearLockout.dataset.bound = '1';
        e.eqClearLockout.addEventListener('click', () => setLockout(false));
      }
      if (e.jobsSection && e.jobsSection.dataset.autosaveBound !== '1') {
        e.jobsSection.dataset.autosaveBound = '1';
        e.jobsSection.addEventListener('input', () => { saveJobDraft(); saveEquipmentDraft(); });
        e.jobsSection.addEventListener('change', () => { saveJobDraft(); saveEquipmentDraft(); });
      }
    }

    async function init() {
      ensureLayout();
      bind();
      applyRoleVisibility();
      await loadData();
      if (!state.jobs.length) clearJobForm();
      if (!state.equipment.length) clearEquipmentForm();
      restoreDrafts();
      initSignaturePads();
      renderRequirementReviewPanel();
    }

    return { init, applyRoleVisibility, loadData };
  }

  window.YWIJobsUI = { create: createJobsUI };
})();
