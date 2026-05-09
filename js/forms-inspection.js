/* File: js/forms-inspection.js
   Brief description: Site Inspection form module.
   Handles worker roster rows, hazard rows, approver signature, optional image queue,
   payload building, submit flow, and outbox fallback when the server or network is unavailable.
*/

'use strict';

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function bytesLabel(size) {
    const n = Number(size || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function ensureTBody(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return null;

    let tbody = table.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      table.appendChild(tbody);
    }

    return tbody;
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
        <td>${escHtml(img.image_type || '')}</td>
        <td>${escHtml(bytesLabel(img.file?.size || 0))}</td>
        <td>${escHtml(img.caption || '')}</td>
        <td><button type="button" data-remove-index="${idx}">Remove</button></td>
      `;
      body.appendChild(tr);
    });
  }


  function ensureLayout() {
    const section = document.getElementById('inspect');
    if (!section || section.dataset.layoutReady === '1') return;
    section.dataset.layoutReady = '1';
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Site Inspection</h2>
          <p class="section-subtitle">Record workforce on site, hazards, corrective actions, and approver sign-off. Keep the inspection focused on machinery/tools, lifting/posture, weather/heat, and chemicals/public interaction.</p>
        </div>
      </div>
      <form id="inspForm">
        <div class="grid">
          <label>Site
            <input id="insp_site" type="text" list="site-options" placeholder="Site name" required>
          </label>
          <label>Date
            <input id="insp_date" type="date" required>
          </label>
          <label>Inspector
            <input id="insp_inspector" type="text" list="employee-options" placeholder="Inspector" required>
          </label>
        </div>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Workers on Site</h3></div>
        <div class="table-scroll">
          <table id="inspRoster"><thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Actions</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="form-footer" style="margin-top:10px;"><button id="inspAddWorker" type="button" class="secondary">Add Worker</button></div>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Hazards</h3></div>
        <div class="notice" style="margin-bottom:12px;">Use category-focused rows so field reviews capture machinery/blades, lifting/posture, weather/heat, and chemicals/public interaction clearly.</div>
        <div class="form-footer" style="margin-top:10px;gap:8px;flex-wrap:wrap;">
          <button id="inspAddHazard" type="button" class="secondary">Add Hazard</button>
          <button id="inspAddMachineryHazard" type="button" class="secondary">+ Machinery / Tools</button>
          <button id="inspAddLiftingHazard" type="button" class="secondary">+ Lifting / Posture</button>
          <button id="inspAddWeatherHazard" type="button" class="secondary">+ Weather / Heat</button>
          <button id="inspAddChemicalHazard" type="button" class="secondary">+ Chemicals / Public</button>
        </div>
        <div class="table-scroll">
          <table id="inspHazards"><thead><tr><th>Category</th><th>Hazard</th><th>Location</th><th>Risk</th><th>Action</th><th>Assigned To</th><th>Completed</th><th>Completed By</th><th>Completed Date</th><th>Actions</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="grid" style="margin-top:12px;">
          <label>Approver
            <select id="insp_approver">
              <option value="">Select approver</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Admin">Admin</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>Other Approver
            <input id="insp_approver_other" type="text" placeholder="Enter approver name">
          </label>
        </div>
        <label style="display:block;margin-top:12px;">Approver Signature
          <canvas id="insp_approver_canvas" width="600" height="180" style="width:100%;max-width:100%;border:1px solid rgba(148,163,184,.25);border-radius:10px;background:#fff;"></canvas>
        </label>
        <div class="form-footer" style="margin-top:10px;"><button id="inspClearSig" type="button" class="secondary">Clear Signature</button></div>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Images</h3></div>
        <div class="grid">
          <label>Files<input id="insp_image_files" type="file" accept="image/*" multiple></label>
          <label>Image Type
            <select id="insp_image_type"><option value="general">General</option><option value="hazard">Hazard</option><option value="site">Site</option><option value="equipment">Equipment</option></select>
          </label>
          <label>Caption<input id="insp_image_caption" type="text" placeholder="Optional caption"></label>
        </div>
        <div class="form-footer" style="margin-top:10px;"><button id="insp_image_add" type="button" class="secondary">Add Images</button></div>
        <div class="table-scroll"><table id="insp_images_table"><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Caption</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
        <div class="form-footer" style="margin-top:18px;"><button type="submit">Submit Inspection</button></div>
      </form>
    `;
  }

  function createInspectionForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    ensureLayout();

    const els = {
      form: $('#inspForm'),
      site: $('#insp_site'),
      date: $('#insp_date'),
      inspector: $('#insp_inspector'),

      rosterBody: ensureTBody('inspRoster'),
      addWorkerBtn: $('#inspAddWorker'),

      hazardsBody: ensureTBody('inspHazards'),
      addHazardBtn: $('#inspAddHazard'),
      addMachineryHazardBtn: $('#inspAddMachineryHazard'),
      addLiftingHazardBtn: $('#inspAddLiftingHazard'),
      addWeatherHazardBtn: $('#inspAddWeatherHazard'),
      addChemicalHazardBtn: $('#inspAddChemicalHazard'),

      approver: $('#insp_approver'),
      approverOther: $('#insp_approver_other'),
      sigCanvas: $('#insp_approver_canvas'),
      clearSigBtn: $('#inspClearSig'),

      imageFiles: $('#insp_image_files'),
      imageType: $('#insp_image_type'),
      imageCaption: $('#insp_image_caption'),
      imageAddBtn: $('#insp_image_add'),
      imageBody: $('#insp_images_table')?.querySelector('tbody') || null
    };

    const state = {
      images: [],
      sigPad: null
    };

    function addWorkerRow(values = {}) {
      if (!els.rosterBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="insp-worker-name" list="employee-options" placeholder="Full name" value="${escHtml(values.name || '')}" required></td>
        <td>
          <select class="insp-worker-role">
            <option value="worker" ${values.role_on_site === 'worker' ? 'selected' : ''}>Worker</option>
            <option value="staff" ${values.role_on_site === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="site_leader" ${values.role_on_site === 'site_leader' ? 'selected' : ''}>Site Leader</option>
            <option value="supervisor" ${values.role_on_site === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="visitor" ${values.role_on_site === 'visitor' ? 'selected' : ''}>Visitor</option>
          </select>
        </td>
        <td><div class="controls"><button type="button" data-act="remove-worker">Remove</button></div></td>
      `;
      els.rosterBody.appendChild(tr);
    }

    const HAZARD_PRESETS = {
      machinery_tools: { category: 'machinery_tools', hazard: 'Moving blades / pinch points / thrown-object exposure', action: 'Verify guards, lockout, and task-specific tool controls.' },
      lifting_posture: { category: 'lifting_posture', hazard: 'Manual handling / awkward posture / uneven terrain', action: 'Check crew size, lift aids, reach height, and rotation needs.' },
      weather_heat: { category: 'weather_heat', hazard: 'Heat, sun, humidity, or weather exposure', action: 'Review hydration, clothing, rest, and worker-specific heat risk.' },
      chemicals_public: { category: 'chemicals_public', hazard: 'Chemical handling / public traffic / cones-barriers', action: 'Confirm PPE, SDS awareness, cones/barriers, and site communication.' }
    };

    function addHazardRow(values = {}) {
      if (!els.hazardsBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="insp-category">
            <option value="general" ${(!values.category || values.category === 'general') ? 'selected' : ''}>General</option>
            <option value="machinery_tools" ${values.category === 'machinery_tools' ? 'selected' : ''}>Machinery / Tools</option>
            <option value="lifting_posture" ${values.category === 'lifting_posture' ? 'selected' : ''}>Lifting / Posture</option>
            <option value="weather_heat" ${values.category === 'weather_heat' ? 'selected' : ''}>Weather / Heat</option>
            <option value="chemicals_public" ${values.category === 'chemicals_public' ? 'selected' : ''}>Chemicals / Public</option>
            <option value="slip_trip_fall" ${values.category === 'slip_trip_fall' ? 'selected' : ''}>Slip / Trip / Fall</option>
            <option value="traffic" ${values.category === 'traffic' ? 'selected' : ''}>Traffic</option>
          </select>
        </td>
        <td><input type="text" class="insp-hazard" placeholder="Hazard" value="${escHtml(values.hazard || '')}" required></td>
        <td><input type="text" class="insp-location" placeholder="Location" value="${escHtml(values.location || '')}"></td>
        <td>
          <select class="insp-risk">
            <option value="low" ${values.risk === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${values.risk === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${values.risk === 'high' ? 'selected' : ''}>High</option>
            <option value="critical" ${values.risk === 'critical' ? 'selected' : ''}>Critical</option>
          </select>
        </td>
        <td><input type="text" class="insp-action" placeholder="Action taken / required" value="${escHtml(values.action || '')}"></td>
        <td><input type="text" class="insp-assigned" list="employee-options" placeholder="Assigned to" value="${escHtml(values.assigned_to || '')}"></td>
        <td>
          <select class="insp-completed">
            <option value="no" ${values.completed === 'no' ? 'selected' : ''}>No</option>
            <option value="yes" ${values.completed === 'yes' ? 'selected' : ''}>Yes</option>
          </select>
        </td>
        <td><input type="text" class="insp-completed-by" placeholder="Completed by" value="${escHtml(values.completed_by || '')}"></td>
        <td><input type="date" class="insp-completed-date" value="${escHtml(values.completed_date || '')}"></td>
        <td><div class="controls"><button type="button" data-act="remove-hazard">Remove</button></div></td>
      `;
      els.hazardsBody.appendChild(tr);
    }

    function seed() {
      if (els.date && !els.date.value) {
        els.date.value = todayISO();
      }

      if (els.rosterBody && els.rosterBody.children.length === 0) {
        addWorkerRow();
      }

      if (els.hazardsBody && els.hazardsBody.children.length === 0) {
        addHazardRow();
      }
    }

    function initSignaturePad() {
      if (window.SignaturePad && els.sigCanvas && !state.sigPad) {
        try {
          state.sigPad = new window.SignaturePad(els.sigCanvas, {
            minWidth: 0.7,
            maxWidth: 2.2,
            throttle: 8
          });
        } catch (err) {
          console.warn('SignaturePad init failed for inspection', err);
        }
      }
    }

    function resetForm() {
      els.form?.reset();

      if (els.date) {
        els.date.value = todayISO();
      }

      if (els.rosterBody) {
        els.rosterBody.innerHTML = '';
      }

      if (els.hazardsBody) {
        els.hazardsBody.innerHTML = '';
      }

      seed();

      if (state.sigPad?.clear) {
        state.sigPad.clear();
      }

      clearImageState(state.images, els.imageBody, els.imageFiles, els.imageCaption);
    }

    function collectPayload() {
      const site = els.site?.value?.trim?.() || '';
      const date = els.date?.value || '';
      const inspector = els.inspector?.value?.trim?.() || '';

      if (!site || !date || !inspector) {
        throw new Error('Please fill Site, Date, and Inspector.');
      }

      const roster = els.rosterBody
        ? Array.from(els.rosterBody.querySelectorAll('tr')).map((tr) => {
            const name = tr.querySelector('.insp-worker-name')?.value?.trim?.() || '';
            const role = tr.querySelector('.insp-worker-role')?.value || 'worker';
            return { name, role_on_site: role };
          }).filter((r) => r.name)
        : [];

      const hazards = els.hazardsBody
        ? Array.from(els.hazardsBody.querySelectorAll('tr')).map((tr) => {
            const category = tr.querySelector('.insp-category')?.value || 'general';
            const hazard = tr.querySelector('.insp-hazard')?.value?.trim?.() || '';
            const location = tr.querySelector('.insp-location')?.value?.trim?.() || '';
            const risk = tr.querySelector('.insp-risk')?.value || 'low';
            const action = tr.querySelector('.insp-action')?.value?.trim?.() || '';
            const assigned_to = tr.querySelector('.insp-assigned')?.value?.trim?.() || '';
            const completed = tr.querySelector('.insp-completed')?.value || 'no';
            const completed_by = tr.querySelector('.insp-completed-by')?.value?.trim?.() || '';
            const completed_date = tr.querySelector('.insp-completed-date')?.value || '';

            return {
              category,
              hazard,
              location,
              risk,
              action,
              assigned_to,
              completed,
              completed_by,
              completed_date: completed_date || null
            };
          }).filter((r) => r.hazard)
        : [];

      if (!hazards.length) {
        throw new Error('Please add at least one hazard row.');
      }

      const approverValue = els.approver?.value || '';
      const approver =
        approverValue === 'Other'
          ? (els.approverOther?.value?.trim?.() || '')
          : approverValue;

      if (!approver) {
        throw new Error('Please select or enter an approver.');
      }

      if (!state.sigPad || (state.sigPad.isEmpty && state.sigPad.isEmpty())) {
        throw new Error('Approver signature is required.');
      }

      return {
        site,
        date,
        inspector,
        roster,
        hazards,
        approver,
        approver_signature_png: state.sigPad.toDataURL('image/png')
      };
    }

    async function submit(e) {
      e.preventDefault();

      let payload;
      try {
        payload = collectPayload();
      } catch (err) {
        alert(err.message || 'Please complete the form.');
        return;
      }

      try {
        const resp = await sendToFunction('C', payload);
        const submissionId = resp?.id;

        if (submissionId && state.images.length) {
          await uploadImagesForSubmission(state.images, submissionId);
        }

        alert('Site Inspection submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'C',
          payload,
          localImages: [...state.images]
        });
        setOutbox(outbox);

        alert('Offline/server error. Saved to Outbox.');
      }
    }

    function bindEvents() {
      els.addWorkerBtn?.addEventListener('click', () => addWorkerRow());
      els.addHazardBtn?.addEventListener('click', () => addHazardRow());
      els.addMachineryHazardBtn?.addEventListener('click', () => addHazardRow(HAZARD_PRESETS.machinery_tools));
      els.addLiftingHazardBtn?.addEventListener('click', () => addHazardRow(HAZARD_PRESETS.lifting_posture));
      els.addWeatherHazardBtn?.addEventListener('click', () => addHazardRow(HAZARD_PRESETS.weather_heat));
      els.addChemicalHazardBtn?.addEventListener('click', () => addHazardRow(HAZARD_PRESETS.chemicals_public));

      els.rosterBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove-worker') {
          btn.closest('tr')?.remove();
        }
      });

      els.hazardsBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove-hazard') {
          btn.closest('tr')?.remove();
        }
      });

      els.clearSigBtn?.addEventListener('click', () => {
        if (state.sigPad?.clear) {
          state.sigPad.clear();
        }
      });

      els.imageBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element)
          ? e.target.closest('button[data-remove-index]')
          : null;
        if (!btn) return;

        const idx = Number(btn.dataset.removeIndex);
        if (Number.isNaN(idx)) return;

        state.images.splice(idx, 1);
        renderImageRows(state.images, els.imageBody);
      });

      els.imageAddBtn?.addEventListener('click', () => {
        const files = Array.from(els.imageFiles?.files || []);
        if (!files.length) {
          alert('Choose at least one image file.');
          return;
        }

        files.forEach((file) => {
          state.images.push({
            file,
            image_type: els.imageType?.value || 'hazard',
            caption: els.imageCaption?.value?.trim?.() || ''
          });
        });

        renderImageRows(state.images, els.imageBody);

        if (els.imageFiles) els.imageFiles.value = '';
        if (els.imageCaption) els.imageCaption.value = '';
      });

      els.form?.addEventListener('submit', submit);
    }

    async function init() {
      initSignaturePad();
      seed();
      bindEvents();
    }

    return {
      init,
      seed,
      resetForm,
      collectPayload,
      state
    };
  }

  window.YWIFormsInspection = {
    create: createInspectionForm
  };
})();
