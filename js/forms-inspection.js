'use strict';

/* =========================================================
   js/forms-inspection.js
   Site Inspection form module

   Purpose:
   - move Site Inspection form logic out of app.js
   - manage roster rows and hazard rows
   - manage approval signature
   - manage optional image queue
   - submit form C payload
   - save failed submissions to outbox
========================================================= */

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
        <td>${escHtml(img.file.name || '')}</td>
        <td>${escHtml(img.image_type || '')}</td>
        <td>${escHtml(bytesLabel(img.file.size || 0))}</td>
        <td>${escHtml(img.caption || '')}</td>
        <td><button type="button" data-remove-index="${idx}">Remove</button></td>
      `;
      body.appendChild(tr);
    });
  }

  function wireImageRemover(state, body) {
    body?.addEventListener('click', (e) => {
      const btn = (e.target instanceof Element)
        ? e.target.closest('button[data-remove-index]')
        : null;
      if (!btn) return;

      const idx = Number(btn.dataset.removeIndex);
      if (Number.isNaN(idx)) return;

      state.splice(idx, 1);
      renderImageRows(state, body);
    });
  }

  function createInspectionForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    const els = {
      form: $('#inspForm'),
      site: $('#insp_site'),
      date: $('#insp_date'),
      inspector: $('#insp_inspector'),

      rosterBody: ensureTBody('inspRoster'),
      hazardsBody: ensureTBody('inspHazards'),
      addWorkerBtn: $('#inspAddWorker'),
      addHazardBtn: $('#inspAddHazard'),

      approver: $('#insp_approver'),
      approverOther: $('#insp_approver_other'),
      clearSigBtn: $('#inspClearSig'),
      sigCanvas: $('#insp_approver_canvas'),

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

    function addWorkerRow() {
      if (!els.rosterBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="iw-name" placeholder="Full name" required></td>
        <td>
          <select class="iw-role">
            <option value="worker">Worker</option>
            <option value="staff">Staff</option>
            <option value="foreman">Foreman</option>
            <option value="supervisor">Supervisor</option>
            <option value="visitor">Visitor</option>
          </select>
        </td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
      `;
      els.rosterBody.appendChild(tr);
    }

    function addHazardRow() {
      if (!els.hazardsBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="hz-desc" placeholder="Describe hazard" required></td>
        <td><input type="text" class="hz-loc" placeholder="Where?"></td>
        <td>
          <select class="hz-risk">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </td>
        <td><input type="text" class="hz-action" placeholder="Action to fix"></td>
        <td><input type="text" class="hz-assigned" placeholder="Assigned to"></td>
        <td style="text-align:center"><input type="checkbox" class="hz-done"></td>
        <td><input type="text" class="hz-doneby" placeholder="Completed by"></td>
        <td><input type="date" class="hz-donedate"></td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
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

      if (els.approver && !els.approver.value) {
        els.approver.value = 'Krista';
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

      if (els.approver) {
        els.approver.value = 'Krista';
      }

      if (els.approverOther) {
        els.approverOther.value = '';
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
        ? Array.from(els.rosterBody.querySelectorAll('tr')).map((tr) => ({
            name: tr.querySelector('.iw-name')?.value?.trim?.() || '',
            role_on_site: tr.querySelector('.iw-role')?.value || 'worker'
          })).filter((r) => r.name)
        : [];

      const hazards = els.hazardsBody
        ? Array.from(els.hazardsBody.querySelectorAll('tr')).map((tr) => ({
            hazard: tr.querySelector('.hz-desc')?.value?.trim?.() || '',
            location: tr.querySelector('.hz-loc')?.value?.trim?.() || '',
            risk: tr.querySelector('.hz-risk')?.value || 'Low',
            action: tr.querySelector('.hz-action')?.value?.trim?.() || '',
            assigned_to: tr.querySelector('.hz-assigned')?.value?.trim?.() || '',
            completed: !!tr.querySelector('.hz-done')?.checked,
            completed_by: tr.querySelector('.hz-doneby')?.value?.trim?.() || '',
            completed_date: tr.querySelector('.hz-donedate')?.value || null
          })).filter((h) => h.hazard)
        : [];

      let approverName = els.approver?.value || '';
      if (approverName === 'Other') {
        const other = els.approverOther?.value?.trim?.() || '';
        if (!other) {
          throw new Error('Please type the approver name.');
        }
        approverName = other;
      }

      if (!state.sigPad || (state.sigPad.isEmpty && state.sigPad.isEmpty())) {
        throw new Error('HSE approval signature is required.');
      }

      return {
        site,
        date,
        inspector,
        roster,
        hazards,
        openHazards: hazards.some((h) => !h.completed),
        approved: true,
        approver_name: approverName,
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

        alert('Site inspection submitted.');
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
      wireImageRemover(state.images, els.imageBody);

      els.addWorkerBtn?.addEventListener('click', addWorkerRow);
      els.addHazardBtn?.addEventListener('click', addHazardRow);

      els.rosterBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove') {
          btn.closest('tr')?.remove();
        }
      });

      els.hazardsBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove') {
          btn.closest('tr')?.remove();
        }
      });

      els.clearSigBtn?.addEventListener('click', () => {
        if (state.sigPad?.clear) {
          state.sigPad.clear();
        }
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
            image_type: els.imageType?.value || 'general',
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
