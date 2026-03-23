/* File: js/forms-drill.js
   Brief description: Emergency Drill form module.
   Handles participant rows, supervisor signature, optional image queue,
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

  function createDrillForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    const els = {
      form: $('#drForm'),
      site: $('#dr_site'),
      date: $('#dr_date'),
      supervisor: $('#dr_supervisor'),
      drillType: $('#dr_type'),
      startTime: $('#dr_start'),
      endTime: $('#dr_end'),
      scenario: $('#dr_scenario'),
      evaluation: $('#dr_eval'),
      followUp: $('#dr_followup'),
      nextDrillDate: $('#dr_next_date'),
      issues: $('#dr_issues'),

      rosterBody: ensureTBody('drRoster'),
      addPartBtn: $('#drAddPart'),

      sigCanvas: $('#dr_supervisor_canvas'),
      clearSigBtn: $('#drClearSig'),

      imageFiles: $('#dr_image_files'),
      imageType: $('#dr_image_type'),
      imageCaption: $('#dr_image_caption'),
      imageAddBtn: $('#dr_image_add'),
      imageBody: $('#dr_images_table')?.querySelector('tbody') || null
    };

    const state = {
      images: [],
      sigPad: null
    };

    function addParticipantRow(values = {}) {
      if (!els.rosterBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="dr-name" list="employee-options" placeholder="Full name" value="${escHtml(values.name || '')}" required></td>
        <td>
          <select class="dr-role">
            <option value="worker" ${values.role_on_site === 'worker' ? 'selected' : ''}>Worker</option>
            <option value="staff" ${values.role_on_site === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="site_leader" ${values.role_on_site === 'site_leader' ? 'selected' : ''}>Site Leader</option>
            <option value="supervisor" ${values.role_on_site === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="visitor" ${values.role_on_site === 'visitor' ? 'selected' : ''}>Visitor</option>
          </select>
        </td>
        <td><input type="text" class="dr-company" placeholder="Company" value="${escHtml(values.company || '')}"></td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
      `;
      els.rosterBody.appendChild(tr);
    }

    function seed() {
      if (els.date && !els.date.value) {
        els.date.value = todayISO();
      }

      if (els.rosterBody && els.rosterBody.children.length === 0) {
        addParticipantRow();
        addParticipantRow();
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
          console.warn('SignaturePad init failed for drill', err);
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
        seed();
      }

      if (state.sigPad?.clear) {
        state.sigPad.clear();
      }

      clearImageState(state.images, els.imageBody, els.imageFiles, els.imageCaption);
    }

    function collectPayload() {
      const site = els.site?.value?.trim?.() || '';
      const date = els.date?.value || '';
      const supervisor = els.supervisor?.value?.trim?.() || '';
      const drillType = els.drillType?.value?.trim?.() || '';
      const startTime = els.startTime?.value || '';
      const endTime = els.endTime?.value || '';
      const scenario = els.scenario?.value?.trim?.() || '';
      const evaluation = els.evaluation?.value?.trim?.() || '';
      const followUp = els.followUp?.value?.trim?.() || '';
      const nextDrillDate = els.nextDrillDate?.value || null;
      const issues = !!els.issues?.checked;

      if (!site || !date || !supervisor || !drillType || !startTime || !endTime) {
        throw new Error('Please fill Site, Date, Supervisor, Drill Type, Start Time, and End Time.');
      }

      if (!state.sigPad || (state.sigPad.isEmpty && state.sigPad.isEmpty())) {
        throw new Error('Supervisor signature is required.');
      }

      const participants = els.rosterBody
        ? Array.from(els.rosterBody.querySelectorAll('tr')).map((tr) => {
            const name = tr.querySelector('.dr-name')?.value?.trim?.() || '';
            const role = tr.querySelector('.dr-role')?.value || 'worker';
            const company = tr.querySelector('.dr-company')?.value?.trim?.() || '';
            return { name, role_on_site: role, company };
          }).filter((r) => r.name)
        : [];

      return {
        site,
        date,
        supervisor,
        drill_type: drillType,
        start_time: startTime,
        end_time: endTime,
        scenario_notes: scenario,
        participants,
        evaluation,
        follow_up_actions: followUp,
        next_drill_date: nextDrillDate,
        issues,
        supervisor_signature_png: state.sigPad.toDataURL('image/png')
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
        const resp = await sendToFunction('A', payload);
        const submissionId = resp?.id;

        if (submissionId && state.images.length) {
          await uploadImagesForSubmission(state.images, submissionId);
        }

        alert('Emergency drill submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'A',
          payload,
          localImages: [...state.images]
        });
        setOutbox(outbox);

        alert('Offline/server error. Saved to Outbox.');
      }
    }

    function bindEvents() {
      els.addPartBtn?.addEventListener('click', () => addParticipantRow());

      els.rosterBody?.addEventListener('click', (e) => {
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
            image_type: els.imageType?.value || 'status',
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

  window.YWIFormsDrill = {
    create: createDrillForm
  };
})();
