/* File: js/forms-toolbox.js
   Brief description: Toolbox Talk form module.
   Handles attendee rows, optional image queue, payload building, submit flow,
   and outbox fallback when the server or network is unavailable.
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
    const section = document.getElementById('toolbox');
    if (!section || section.dataset.layoutReady === '1') return;
    section.dataset.layoutReady = '1';
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Toolbox Talk</h2>
          <p class="section-subtitle">Daily toolbox discussion, attendees, and optional evidence images.</p>
        </div>
      </div>
      <div id="tb_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
      <form id="toolboxForm">
        <div class="grid">
          <label>Site
            <input id="tb_site" type="text" list="site-options" placeholder="Site name" required>
          </label>
          <label>Date
            <input id="tb_date" type="date" required>
          </label>
          <label>Submitted By
            <input id="tb_leader" type="text" list="employee-options" placeholder="Leader / supervisor" required>
          </label>
        </div>
        <label style="display:block;margin-top:12px;">Topic / Notes
          <textarea id="tb_topic" rows="4" placeholder="Topic, hazards, reminders, work plan"></textarea>
        </label>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Attendees</h3></div>
        <div class="table-scroll">
          <table id="tbAttendees">
            <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Actions</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="form-footer" style="margin-top:10px;">
          <button id="tbAddRowBtn" type="button" class="secondary">Add Attendee</button>
        </div>
        <div class="section-heading" style="margin-top:18px;"><h3 style="margin:0;">Images</h3></div>
        <div class="grid">
          <label>Files
            <input id="tb_image_files" type="file" accept="image/*" multiple>
          </label>
          <label>Image Type
            <select id="tb_image_type">
              <option value="general">General</option>
              <option value="hazard">Hazard</option>
              <option value="site">Site</option>
              <option value="equipment">Equipment</option>
            </select>
          </label>
          <label>Caption
            <input id="tb_image_caption" type="text" placeholder="Optional caption">
          </label>
        </div>
        <div class="form-footer" style="margin-top:10px;">
          <button id="tb_image_add" type="button" class="secondary">Add Images</button>
        </div>
        <div class="table-scroll">
          <table id="tb_images_table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Caption</th><th>Actions</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="form-footer" style="margin-top:18px;">
          <button type="submit">Submit Toolbox Talk</button>
        </div>
      </form>
    `;
  }

  function createToolboxForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    ensureLayout();

    const els = {
      form: $('#toolboxForm'),
      site: $('#tb_site'),
      date: $('#tb_date'),
      leader: $('#tb_leader'),
      topic: $('#tb_topic'),

      attendeesBody: ensureTBody('tbAttendees'),
      addRowBtn: $('#tbAddRowBtn'),

      imageFiles: $('#tb_image_files'),
      imageType: $('#tb_image_type'),
      imageCaption: $('#tb_image_caption'),
      imageAddBtn: $('#tb_image_add'),
      imageBody: $('#tb_images_table')?.querySelector('tbody') || null
    };

    const state = {
      images: []
    };

    function addAttendeeRow(values = {}) {
      if (!els.attendeesBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="tb-name" list="employee-options" placeholder="Full name" value="${escHtml(values.name || '')}" required></td>
        <td>
          <select class="tb-role">
            <option value="worker" ${values.role_on_site === 'worker' ? 'selected' : ''}>Worker</option>
            <option value="staff" ${values.role_on_site === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="site_leader" ${values.role_on_site === 'site_leader' ? 'selected' : ''}>Site Leader</option>
            <option value="supervisor" ${values.role_on_site === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="visitor" ${values.role_on_site === 'visitor' ? 'selected' : ''}>Visitor</option>
          </select>
        </td>
        <td><input type="text" class="tb-company" placeholder="Company" value="${escHtml(values.company || '')}"></td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
      `;
      els.attendeesBody.appendChild(tr);
    }

    function seed() {
      if (els.date && !els.date.value) {
        els.date.value = todayISO();
      }

      if (els.attendeesBody && els.attendeesBody.children.length === 0) {
        addAttendeeRow();
        addAttendeeRow();
      }
    }

    function resetForm() {
      els.form?.reset();

      if (els.date) {
        els.date.value = todayISO();
      }

      if (els.attendeesBody) {
        els.attendeesBody.innerHTML = '';
        seed();
      }

      clearImageState(state.images, els.imageBody, els.imageFiles, els.imageCaption);
    }

    function collectPayload() {
      const site = els.site?.value?.trim?.() || '';
      const date = els.date?.value || '';
      const leader = els.leader?.value?.trim?.() || '';
      const topic = els.topic?.value?.trim?.() || '';

      if (!site || !date || !leader) {
        throw new Error('Please fill Site, Date, and Submitted By.');
      }

      const attendees = els.attendeesBody
        ? Array.from(els.attendeesBody.querySelectorAll('tr')).map((tr) => {
            const name = tr.querySelector('.tb-name')?.value?.trim?.() || '';
            const role = tr.querySelector('.tb-role')?.value || 'worker';
            const company = tr.querySelector('.tb-company')?.value?.trim?.() || '';
            return { name, role_on_site: role, company };
          }).filter((r) => r.name)
        : [];

      if (!attendees.length) {
        throw new Error('Please add at least one attendee.');
      }

      return {
        site,
        date,
        submitted_by: leader,
        topic_notes: topic,
        attendees
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
        const resp = await sendToFunction('E', payload);
        const submissionId = resp?.id;

        if (submissionId && state.images.length) {
          await uploadImagesForSubmission(state.images, submissionId);
        }

        alert('Toolbox Talk submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'E',
          payload,
          localImages: [...state.images]
        });
        setOutbox(outbox);

        alert('Offline/server error. Saved to Outbox.');
      }
    }

    function bindEvents() {
      els.addRowBtn?.addEventListener('click', () => addAttendeeRow());

      els.attendeesBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove') {
          btn.closest('tr')?.remove();
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

  window.YWIFormsToolbox = {
    create: createToolboxForm
  };
})();
