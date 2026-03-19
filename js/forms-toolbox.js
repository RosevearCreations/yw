'use strict';

/* =========================================================
   js/forms-toolbox.js
   Toolbox Talk form module

   Purpose:
   - move Toolbox Talk form logic out of app.js
   - manage attendee rows
   - manage optional image queue
   - submit form E payload
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

  function createToolboxForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    const els = {
      form: $('#toolboxForm'),
      date: $('#tb_date'),
      site: $('#tb_site'),
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

    function addAttendeeRow() {
      if (!els.attendeesBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="att-name" placeholder="Full name" required></td>
        <td>
          <select class="att-role">
            <option value="worker">Worker</option>
            <option value="staff">Staff</option>
            <option value="site_leader">Site Leader</option>
            <option value="supervisor">Supervisor</option>
            <option value="visitor">Visitor</option>
          </select>
        </td>
        <td><input type="text" class="att-company" placeholder="Company"></td>
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

      const rows = els.attendeesBody
        ? Array.from(els.attendeesBody.querySelectorAll('tr'))
        : [];

      const attendees = rows.map((tr) => {
        const name = tr.querySelector('.att-name')?.value?.trim?.() || '';
        const role = tr.querySelector('.att-role')?.value || 'worker';
        const company = tr.querySelector('.att-company')?.value?.trim?.() || '';

        return {
          name,
          role_on_site: role,
          company
        };
      }).filter((r) => r.name);

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

        alert('Toolbox talk submitted.');
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
      wireImageRemover(state.images, els.imageBody);

      els.addRowBtn?.addEventListener('click', addAttendeeRow);

      els.attendeesBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;
        if (btn.dataset.act === 'remove') {
          btn.closest('tr')?.remove();
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
